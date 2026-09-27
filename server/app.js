// The Dam Angler API. Everything under /api; the game files themselves are
// served by nginx in production (or by `staticDir` in development), except
// the page itself (index.html), which is served from here so each visit gets
// its own Content-Security-Policy nonce.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  COOKIE, createRateLimiter, readCookie, sessionCookie, createSession, userForToken, endSession,
  createUser, checkLogin, passwordMatches,
} from './auth.js';
import { HttpError } from './validate.js';
import { createPlayer, loadSave, writeSave, recordCatch, importGuest, buyItem, spendCredits } from './saves.js';
import { allDamStats, damStats } from './stats.js';
import { createAdminRouter } from './admin.js';
import { publishedForPlayers } from './tuning.js';

// What the game page may load: only its own files. Inline script only with
// this visit's nonce (the version loader in index.html), no plugins, no
// framing by other sites (clickjacking), forms only back to us.
export function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'", // the game positions things with inline styles
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

export function createApp({
  db, secureCookies = false, staticDir = null, indexFile = null, adminFile = null,
  limiter = createRateLimiter(),
  // Per-player limits on how fast saves and catches can come in (a real
  // game can't land 40 fish in 5 minutes).
  playLimiter = createRateLimiter({ limit: 40, windowMs: 5 * 60 * 1000 }),
  saveLimiter = createRateLimiter({ limit: 150, windowMs: 5 * 60 * 1000 }),
  publicLimiter = createRateLimiter({ limit: 120, windowMs: 60 * 1000 }),
  adminLimiter = createRateLimiter({ limit: 600, windowMs: 5 * 60 * 1000 }),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // nginx on the same machine passes the real IP
  app.use(securityHeaders);

  // Changes only from our own page: JSON bodies (a plain HTML form on
  // another site can't send those), and if the browser says where the
  // request came from, it must be this site. Stops cross-site request
  // forgery on top of the SameSite cookie.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* garbage origin */ }
      if (host !== req.get('host')) throw new HttpError(403, 'Requests must come from the game itself.');
    }
    if (!req.is('application/json')) throw new HttpError(415, 'Requests must be JSON.');
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));

  const setSession = (res, token) => res.setHeader('Set-Cookie', sessionCookie(token, { secure: secureCookies }));
  const tooMany = () => new HttpError(429, 'Too many tries — wait 15 minutes and try again.');
  const slowDown = () => new HttpError(429, 'That\'s faster than the game can go — slow down a little.');
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

  async function requireUser(req, res, next) {
    const user = await userForToken(db, readCookie(req, COOKIE));
    if (!user) throw new HttpError(401, 'Please log in.');
    req.user = user;
    next();
  }

  // The admin area: a logged-in account marked admin (server/make-admin.js).
  async function requireAdmin(req, res, next) {
    const user = await userForToken(db, readCookie(req, COOKIE));
    if (!user) throw new HttpError(401, 'Please log in.');
    if (user.role !== 'admin') throw new HttpError(403, 'Admins only.');
    if (!adminLimiter.hit(`a:${user.id}`)) throw slowDown();
    req.user = user;
    next();
  }

  // The game page, with a fresh nonce for its one inline script.
  if (indexFile) {
    const template = readFileSync(indexFile, 'utf8');
    const servePage = (req, res) => {
      const nonce = randomBytes(16).toString('base64');
      res.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce));
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(template.replace(/<script>/g, `<script nonce="${nonce}">`));
    };
    app.get(['/', '/index.html'], servePage);
  }

  // The admin page: same strict policy, never indexed by search engines.
  // (It shows nothing by itself -- all data comes from /api/admin, which
  // checks the admin role on every request.)
  if (adminFile) {
    const adminTemplate = readFileSync(adminFile, 'utf8');
    app.get('/admin', (req, res) => {
      const nonce = randomBytes(16).toString('base64');
      res.setHeader('Content-Security-Policy', contentSecurityPolicy(nonce));
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.type('html').send(adminTemplate.replace(/<script /g, `<script nonce="${nonce}" `));
    });
    app.get('/admin/', (req, res) => res.redirect(301, '/admin'));
  }

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.post('/api/auth/signup', async (req, res) => {
    if (!limiter.hit(`ip:${req.ip}`)) throw tooMany();
    const { email, username, password, agree, guestSave, guestCatches } = body(req);
    if (agree !== true) throw new HttpError(400, 'Please read and accept the privacy notice.');
    const user = await createUser(db, { email, username, password });
    await createPlayer(db, user.id);
    await importGuest(db, user.id, { guestSave, guestCatches: Array.isArray(guestCatches) ? guestCatches : [] });
    setSession(res, await createSession(db, user.id, req.get('user-agent')));
    const { save, version } = await loadSave(db, user.id);
    res.status(201).json({ user: { username: user.username, email: user.email }, save, version });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { login, password } = body(req);
    const account = `acct:${String(login ?? '').trim().toLowerCase().slice(0, 254)}`;
    if (!limiter.hit(`ip:${req.ip}`) || !limiter.hit(account)) throw tooMany();
    const user = await checkLogin(db, login, password);
    limiter.reset(account);
    setSession(res, await createSession(db, user.id, req.get('user-agent')));
    const { save, version } = await loadSave(db, user.id);
    res.json({ user: { username: user.username, email: user.email }, save, version });
  });

  app.post('/api/auth/logout', async (req, res) => {
    await endSession(db, readCookie(req, COOKIE));
    res.setHeader('Set-Cookie', sessionCookie('', { secure: secureCookies, clear: true }));
    res.json({ ok: true });
  });

  app.get('/api/me', requireUser, async (req, res) => {
    const { save, version } = await loadSave(db, req.user.id);
    res.json({ user: { username: req.user.username, email: req.user.email }, save, version });
  });

  app.put('/api/me/save', requireUser, async (req, res) => {
    if (!saveLimiter.hit(`u:${req.user.id}`)) throw slowDown();
    const { save, baseVersion } = body(req);
    const result = await writeSave(db, req.user.id, save, baseVersion);
    if (!result.ok) return res.status(409).json({ error: 'Another device saved first.', save: result.save, version: result.version });
    res.json({ version: result.version });
  });

  app.post('/api/me/catches', requireUser, async (req, res) => {
    if (!playLimiter.hit(`u:${req.user.id}`)) throw slowDown();
    const { stored, payout, credits } = await recordCatch(db, req.user.id, body(req));
    if (stored) statsCache.clear();
    res.status(stored ? 201 : 200).json({ ok: true, payout, credits });
  });

  // Buying from the tackle box: the server checks the price and the balance.
  app.post('/api/me/buy', requireUser, async (req, res) => {
    if (!saveLimiter.hit(`u:${req.user.id}`)) throw slowDown();
    const { kind, itemId } = body(req);
    res.json(await buyItem(db, req.user.id, String(kind ?? ''), String(itemId ?? '')));
  });

  // Credits used up in the game (breadcrumbs).
  app.post('/api/me/spend', requireUser, async (req, res) => {
    if (!saveLimiter.hit(`u:${req.user.id}`)) throw slowDown();
    res.json(await spendCredits(db, req.user.id, String(body(req).what ?? '')));
  });

  app.delete('/api/me', requireUser, async (req, res) => {
    if (!limiter.hit(`ip:${req.ip}`)) throw tooMany();
    if (!(await passwordMatches(db, req.user.id, body(req).password))) throw new HttpError(401, 'That password isn\'t right.');
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]); // sessions, save, gear, catches go with it
    res.setHeader('Set-Cookie', sessionCookie('', { secure: secureCookies, clear: true }));
    statsCache.clear();
    res.json({ ok: true });
  });

  // Public stats: cached for 15 s so nobody can hammer the database with them.
  const statsCache = new Map();
  async function cached(key, fn) {
    const hit = statsCache.get(key);
    if (hit && Date.now() - hit.at < 15000) return hit.data;
    const data = await fn();
    statsCache.set(key, { at: Date.now(), data });
    return data;
  }
  const publicLimit = (req) => { if (!publicLimiter.hit(`ip:${req.ip}`)) throw slowDown(); };
  app.get('/api/dams/stats', async (req, res) => { publicLimit(req); res.json(await cached('all', () => allDamStats(db))); });
  app.get('/api/dams/:locationId/stats', async (req, res) => {
    publicLimit(req);
    const id = String(req.params.locationId).slice(0, 64);
    res.json(await cached(`dam:${id}`, () => damStats(db, id)));
  });

  // The published game tuning (see server/tuning.js), loaded by the game on start.
  app.get('/api/tuning', async (req, res) => { publicLimit(req); res.json(await publishedForPlayers(db)); });

  app.use('/api/admin', requireAdmin, createAdminRouter({ db, statsCache }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  if (staticDir) {
    // Development only: never hand out the server code, secrets or git data.
    app.use((req, res, next) => (/^\/(\.|server\/|node_modules\/|docs\/|test\/|tools\/|backups\/|package)/.test(req.path) ? res.status(404).end() : next()));
    app.use(express.static(staticDir, { dotfiles: 'deny', index: false }));
  }

  // Errors become a plain sentence the game can show; details stay in the log.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'That request wasn\'t valid.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });
  return app;
}

export const DEFAULT_INDEX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
export const DEFAULT_ADMIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin.html');
