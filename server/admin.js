// The admin area's server side: how the game is doing, looking up players,
// giving or taking credits, deleting players -- every action recorded in
// admin_log. Mounted at /api/admin behind requireAdmin (app.js).
import express from 'express';
import { HttpError } from './validate.js';
import { passwordMatches } from './auth.js';
import { loadSave } from './saves.js';
import { createTuningAdminRouter } from './tuning.js';
import { createRateLimiter } from './auth.js';

const PAGE_SIZE = 50;
export const MAX_ADMIN_CREDITS = 1_000_000;
export const PASSWORD_ABOVE = 10_000; // credit changes bigger than this need the admin's password

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));
const bad = (m) => new HttpError(400, m);
const iso = (d) => (d ? new Date(d).toISOString() : null);
const num = (v) => (v === null || v === undefined ? null : Number(v));

// Command line only (server/make-admin.js): marks an account admin or player.
export async function setRole(db, username, role) {
  if (!['admin', 'player'].includes(role)) throw new Error('role must be admin or player');
  const { rows } = await db.query('UPDATE users SET role = $2 WHERE lower(username) = lower($1) RETURNING username', [username, role]);
  return rows.length > 0;
}

function pageOf(v) {
  const p = Math.floor(Number(v));
  return Number.isFinite(p) && p >= 1 && p <= 100000 ? p : 1;
}

function userId(v) {
  if (!/^\d{1,18}$/.test(String(v))) throw new HttpError(404, 'No such player.');
  return String(v);
}

async function getUser(db, id) {
  const u = (await db.query('SELECT id, username, email, role, created_at, last_login_at, last_seen_at FROM users WHERE id = $1', [id])).rows[0];
  if (!u) throw new HttpError(404, 'No such player.');
  return u;
}

export async function overview(db) {
  const q = async (sql, params) => (await db.query(sql, params)).rows[0];
  const players = await q(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new7,
      count(*) FILTER (WHERE last_seen_at > now() - interval '1 day')::int AS active1,
      count(*) FILTER (WHERE last_seen_at > now() - interval '7 days')::int AS active7
    FROM users`);
  const catches = await q(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE caught_at > now() - interval '1 day')::int AS today
    FROM catches`);
  const credits = await q('SELECT coalesce(sum(credits), 0)::bigint AS held FROM player_state');
  const top = (await db.query(`SELECT c.species_id, c.weight_kg, c.location_id, c.caught_at, c.trophy, u.username, u.id AS user_id
      FROM catches c JOIN users u ON u.id = c.user_id ORDER BY c.weight_kg DESC, c.caught_at ASC LIMIT 10`)).rows;
  const dams = (await db.query(`SELECT location_id, count(*)::int AS total, max(weight_kg)::float AS best
      FROM catches GROUP BY location_id ORDER BY count(*) DESC`)).rows;
  return {
    players: { total: players.total, newThisWeek: players.new7, activeToday: players.active1, activeThisWeek: players.active7 },
    catches: { total: catches.total, today: catches.today },
    creditsHeld: Number(credits.held),
    topCatches: top.map((r) => ({
      speciesId: r.species_id, weightKg: Number(r.weight_kg), locationId: r.location_id, caughtAt: iso(r.caught_at),
      trophy: r.trophy, username: r.username, userId: String(r.user_id),
    })),
    dams: dams.map((d) => ({ locationId: d.location_id, total: d.total, bestKg: Number(d.best) })),
  };
}

// Whitelisted sort columns (anything else sorts by date joined).
const SORTS = {
  username: 'lower(u.username)', joined: 'u.created_at', lastSeen: 'u.last_seen_at',
  credits: 'ps.credits', catches: 'coalesce(c.n, 0)', best: 'b.weight_kg',
};

export async function listPlayers(db, { q = '', sort = 'joined', dir = 'desc', page = 1 } = {}) {
  const search = String(q ?? '').trim().slice(0, 100);
  // Search is a plain "contains"; % and _ typed by the admin match literally.
  const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const order = SORTS[sort] || SORTS.joined;
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  const p = pageOf(page);
  const where = `($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2)`;
  const total = (await db.query(`SELECT count(*)::int AS n FROM users u WHERE ${where}`, [search, like])).rows[0].n;
  const rows = (await db.query(
    `SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_seen_at, ps.credits,
            coalesce(c.n, 0)::int AS catches, b.species_id AS best_species, b.weight_kg AS best_kg
       FROM users u
       LEFT JOIN player_state ps ON ps.user_id = u.id
       LEFT JOIN (SELECT user_id, count(*) AS n FROM catches GROUP BY user_id) c ON c.user_id = u.id
       LEFT JOIN (SELECT DISTINCT ON (user_id) user_id, species_id, weight_kg FROM catches
                   ORDER BY user_id, weight_kg DESC) b ON b.user_id = u.id
      WHERE ${where}
      ORDER BY ${order} ${direction} NULLS LAST, u.id
      LIMIT ${PAGE_SIZE} OFFSET $3`,
    [search, like, (p - 1) * PAGE_SIZE],
  )).rows;
  return {
    total, page: p, pageSize: PAGE_SIZE,
    players: rows.map((r) => ({
      id: String(r.id), username: r.username, email: r.email, role: r.role,
      joined: iso(r.created_at), lastSeen: iso(r.last_seen_at), credits: num(r.credits) ?? 0,
      catches: r.catches, best: r.best_kg === null ? null : { speciesId: r.best_species, weightKg: Number(r.best_kg) },
    })),
  };
}

export async function playerDetail(db, rawId) {
  const id = userId(rawId);
  const u = await getUser(db, id);
  const { save } = await loadSave(db, id);
  const catches = (await db.query(
    `SELECT id, species_id, location_id, weight_kg, length_cm, trophy, payout, time_of_day, caught_at
       FROM catches WHERE user_id = $1 ORDER BY caught_at DESC LIMIT 100`, [id])).rows;
  const credits = (await db.query(
    'SELECT amount, reason, ref, created_at FROM credit_log WHERE user_id = $1 ORDER BY id DESC LIMIT 100', [id])).rows;
  const counts = (await db.query('SELECT count(*)::int AS n FROM catches WHERE user_id = $1', [id])).rows[0];
  return {
    player: {
      id: String(u.id), username: u.username, email: u.email, role: u.role,
      joined: iso(u.created_at), lastLogin: iso(u.last_login_at), lastSeen: iso(u.last_seen_at),
      credits: save?.credits ?? 0, totalCatches: counts.n,
    },
    save,
    catches: catches.map((c) => ({
      id: c.id, speciesId: c.species_id, locationId: c.location_id, weightKg: Number(c.weight_kg), lengthCm: c.length_cm,
      trophy: c.trophy, payout: c.payout, timeOfDay: c.time_of_day, caughtAt: iso(c.caught_at),
    })),
    creditHistory: credits.map((c) => ({ amount: c.amount, reason: c.reason, ref: c.ref, at: iso(c.created_at) })),
  };
}

function cleanReason(reason) {
  const r = String(reason ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (r.length < 3 || r.length > 200) throw bad('Give a reason of 3 to 200 characters.');
  return r;
}

async function logAction(tx, admin, action, target, details) {
  await tx.query(
    `INSERT INTO admin_log (admin_id, admin_username, action, target_user_id, target_username, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [admin.id, admin.username, action, target.id, target.username, JSON.stringify(details)],
  );
}

export async function adjustCredits(db, admin, rawId, { amount, reason, password } = {}) {
  const id = userId(rawId);
  const a = Number(amount);
  if (!Number.isInteger(a) || a === 0 || Math.abs(a) > MAX_ADMIN_CREDITS) {
    throw bad(`The amount must be a whole number from -${MAX_ADMIN_CREDITS.toLocaleString('en-ZA')} to ${MAX_ADMIN_CREDITS.toLocaleString('en-ZA')}, not 0.`);
  }
  const why = cleanReason(reason);
  const target = await getUser(db, id);
  if (Math.abs(a) > PASSWORD_ABOVE && !(await passwordMatches(db, admin.id, password))) {
    throw new HttpError(401, `Changes over ${PASSWORD_ABOVE.toLocaleString('en-ZA')} credits need your password.`);
  }
  return inTx(db, async (tx) => {
    const { rows } = await tx.query(
      'UPDATE player_state SET credits = credits + $2 WHERE user_id = $1 AND credits + $2 >= 0 RETURNING credits',
      [id, a],
    );
    if (!rows.length) throw bad(`${target.username} doesn't have that many credits to take.`);
    await tx.query('INSERT INTO credit_log (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)', [id, a, 'admin', why]);
    await logAction(tx, admin, 'credits', target, { amount: a, reason: why, balance: rows[0].credits });
    return { credits: rows[0].credits };
  });
}

export async function deletePlayer(db, admin, rawId, { confirmUsername, password } = {}) {
  const id = userId(rawId);
  const target = await getUser(db, id);
  if (String(target.id) === String(admin.id)) throw bad('You can\'t delete your own account here.');
  if (target.role === 'admin') throw bad('Admin accounts can\'t be deleted here.');
  if (String(confirmUsername ?? '').trim().toLowerCase() !== target.username.toLowerCase()) {
    throw bad(`Type the username "${target.username}" to confirm.`);
  }
  if (!(await passwordMatches(db, admin.id, password))) throw new HttpError(401, 'That password isn\'t right.');
  const counts = (await db.query(
    'SELECT (SELECT count(*) FROM catches WHERE user_id = $1)::int AS catches, (SELECT credits FROM player_state WHERE user_id = $1) AS credits',
    [id],
  )).rows[0];
  await inTx(db, async (tx) => {
    await logAction(tx, admin, 'delete-player', target, { email: target.email, catches: counts.catches, credits: counts.credits ?? 0 });
    await tx.query('DELETE FROM users WHERE id = $1', [id]); // sessions, save, gear, catches, credit history go with it
  });
  return { ok: true };
}

export async function adminLog(db, { page = 1 } = {}) {
  const p = pageOf(page);
  const total = (await db.query('SELECT count(*)::int AS n FROM admin_log')).rows[0].n;
  const rows = (await db.query(
    `SELECT admin_username, action, target_user_id, target_username, details, created_at
       FROM admin_log ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET $1`, [(p - 1) * PAGE_SIZE])).rows;
  return {
    total, page: p, pageSize: PAGE_SIZE,
    entries: rows.map((r) => ({
      admin: r.admin_username, action: r.action, targetId: r.target_user_id === null ? null : String(r.target_user_id),
      target: r.target_username, details: r.details, at: iso(r.created_at),
    })),
  };
}

export function createAdminRouter({ db, statsCache = null, tuningLimiter = createRateLimiter({ limit: 60, windowMs: 5 * 60 * 1000 }) }) {
  const r = express.Router();
  r.use('/tuning', createTuningAdminRouter({ db, limiter: tuningLimiter }));
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
  r.get('/me', (req, res) => res.json({ username: req.user.username }));
  r.get('/overview', async (req, res) => res.json(await overview(db)));
  r.get('/players', async (req, res) => res.json(await listPlayers(db, req.query)));
  r.get('/players/:id', async (req, res) => res.json(await playerDetail(db, req.params.id)));
  r.post('/players/:id/credits', async (req, res) => res.json(await adjustCredits(db, req.user, req.params.id, body(req))));
  r.delete('/players/:id', async (req, res) => {
    const out = await deletePlayer(db, req.user, req.params.id, body(req));
    statsCache?.clear();
    res.json(out);
  });
  r.get('/log', async (req, res) => res.json(await adminLog(db, req.query)));
  return r;
}
