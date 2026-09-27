// The Dam Angler API. Everything under /api; the game files themselves are
// served by nginx in production (or by `staticDir` in development).
import express from 'express';
import {
  COOKIE, createRateLimiter, readCookie, sessionCookie, createSession, userForToken, endSession,
  createUser, checkLogin, passwordMatches,
} from './auth.js';
import { HttpError } from './validate.js';
import { createPlayer, loadSave, writeSave, recordCatch, importGuest } from './saves.js';
import { allDamStats, damStats } from './stats.js';

export function createApp({ db, secureCookies = false, staticDir = null, limiter = createRateLimiter() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // nginx on the same machine passes the real IP
  app.use(express.json({ limit: '256kb' }));

  const setSession = (res, token) => res.setHeader('Set-Cookie', sessionCookie(token, { secure: secureCookies }));
  const tooMany = () => new HttpError(429, 'Too many tries — wait 15 minutes and try again.');

  async function requireUser(req, res, next) {
    const user = await userForToken(db, readCookie(req, COOKIE));
    if (!user) throw new HttpError(401, 'Please log in.');
    req.user = user;
    next();
  }

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.post('/api/auth/signup', async (req, res) => {
    if (!limiter.hit(`ip:${req.ip}`)) throw tooMany();
    const { email, username, password, agree, guestSave, guestCatches } = req.body || {};
    if (agree !== true) throw new HttpError(400, 'Please read and accept the privacy notice.');
    const user = await createUser(db, { email, username, password });
    await createPlayer(db, user.id);
    await importGuest(db, user.id, { guestSave, guestCatches });
    setSession(res, await createSession(db, user.id, req.get('user-agent')));
    const { save, version } = await loadSave(db, user.id);
    res.status(201).json({ user: { username: user.username, email: user.email }, save, version });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { login, password } = req.body || {};
    const account = `acct:${String(login ?? '').trim().toLowerCase()}`;
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
    const { save, baseVersion } = req.body || {};
    const result = await writeSave(db, req.user.id, save, baseVersion);
    if (!result.ok) return res.status(409).json({ error: 'Another device saved first.', save: result.save, version: result.version });
    res.json({ version: result.version });
  });

  app.post('/api/me/catches', requireUser, async (req, res) => {
    const { stored } = await recordCatch(db, req.user.id, req.body);
    res.status(stored ? 201 : 200).json({ ok: true });
  });

  app.delete('/api/me', requireUser, async (req, res) => {
    if (!limiter.hit(`ip:${req.ip}`)) throw tooMany();
    if (!(await passwordMatches(db, req.user.id, req.body?.password))) throw new HttpError(401, 'That password isn\'t right.');
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]); // sessions, save, gear, catches go with it
    res.setHeader('Set-Cookie', sessionCookie('', { secure: secureCookies, clear: true }));
    res.json({ ok: true });
  });

  app.get('/api/dams/stats', async (req, res) => res.json(await allDamStats(db)));
  app.get('/api/dams/:locationId/stats', async (req, res) => res.json(await damStats(db, req.params.locationId)));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  if (staticDir) app.use(express.static(staticDir));

  // Errors become a plain sentence the game can show.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request wasn\'t valid.' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });
  return app;
}
