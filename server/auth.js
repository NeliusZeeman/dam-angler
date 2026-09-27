// Accounts: sign up, log in, log out, delete. Passwords are bcrypt hashes;
// a login is a random token in an httpOnly cookie, and only its sha256 is
// stored, so a copy of the database can't be used to log in as anyone.
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { HttpError, checkEmail, checkUsername, checkPassword, checkLoginName } from './validate.js';

export const COOKIE = 'da_session';
const SESSION_DAYS = 30;
const BCRYPT_COST = 11;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Slows down password guessing: at most `limit` tries per key in `windowMs`.
export function createRateLimiter({ limit = 10, windowMs = 15 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return {
    // Records a try; returns false once the key is over the limit.
    hit(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
      return recent.length <= limit;
    },
    reset(key) { hits.delete(key); },
  };
}

export function readCookie(req, name = COOKIE) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token, { secure = false, clear = false } = {}) {
  const parts = [`${COOKIE}=${clear ? '' : encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${clear ? 0 : SESSION_DAYS * 86400}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export async function createSession(db, userId, userAgent = '') {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + interval '${SESSION_DAYS} days', $3)`,
    [sha256(token), userId, String(userAgent).slice(0, 200)],
  );
  return token;
}

export async function userForToken(db, token) {
  if (!token) return null;
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.email, u.role,
            (u.last_seen_at IS NULL OR u.last_seen_at < now() - interval '5 minutes') AS stale
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  const user = rows[0];
  if (!user) return null;
  // "Last seen" for the admin dashboard -- written at most every 5 minutes.
  if (user.stale) await db.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]);
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

export async function endSession(db, token) {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export async function createUser(db, { email, username, password }) {
  const e = checkEmail(email);
  const u = checkUsername(username);
  const p = checkPassword(password);
  const taken = (await db.query(
    'SELECT lower(email) = $1 AS email_taken, lower(username) = lower($2) AS name_taken FROM users WHERE lower(email) = $1 OR lower(username) = lower($2)',
    [e, u],
  )).rows;
  if (taken.some((r) => r.email_taken)) throw new HttpError(409, 'There is already an account with that email. Log in instead.');
  if (taken.some((r) => r.name_taken)) throw new HttpError(409, 'That username is taken — try another.');
  const hash = await bcrypt.hash(p, BCRYPT_COST);
  const { rows } = await db.query(
    'INSERT INTO users (email, username, password_hash, last_login_at) VALUES ($1, $2, $3, now()) RETURNING id, username, email',
    [e, u, hash],
  );
  return rows[0];
}

// Email or username + password. The same message either way, so nobody can
// use the login form to find out which emails have accounts.
// A real bcrypt hash of nothing in particular: checked when the account
// doesn't exist, so a wrong username takes as long as a wrong password and
// response times don't give away which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

export async function checkLogin(db, login, password) {
  const key = checkLoginName(login);
  const { rows } = await db.query(
    'SELECT id, username, email, password_hash FROM users WHERE lower(email) = $1 OR lower(username) = $1',
    [key],
  );
  const user = rows[0];
  const pw = typeof password === 'string' ? password.slice(0, 200) : '';
  const ok = await bcrypt.compare(pw, user ? user.password_hash : DUMMY_HASH) && !!user;
  if (!ok) throw new HttpError(401, 'Wrong email/username or password.');
  await db.query('UPDATE users SET last_login_at = now(), last_seen_at = now() WHERE id = $1', [user.id]);
  return { id: user.id, username: user.username, email: user.email };
}

// Expired logins are removed (run now and then by the server).
export async function deleteExpiredSessions(db) {
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
}

export async function passwordMatches(db, userId, password) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return !!rows[0] && bcrypt.compare(String(password ?? ''), rows[0].password_hash);
}
