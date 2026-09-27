// Attacks the API the way someone malicious would, and checks each one is
// refused cleanly (never a crash, never stored).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';
import { createRateLimiter } from '../auth.js';
import { DEFAULT_INDEX } from '../app.js';

let db, srv;
before(async () => { db = await newTestDb(); srv = await startTestServer(db, { indexFile: DEFAULT_INDEX }); });
after(async () => { await srv.close(); await db.end(); });

const signup = (c, fields) => c.post('/api/auth/signup', { email: 'ok@example.com', username: 'okname', password: 'password1', agree: true, ...fields });

test('usernames can\'t carry HTML, script or SQL, and official names are reserved', async () => {
  for (const username of ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "x' OR '1'='1", 'robert"); DROP TABLE users;--', 'ab', 'a'.repeat(21), 'nelius zeeman', 'néliüs', 'admin', 'Dam_Angler', '']) {
    const r = await signup(srv.client(), { username, email: `${randomUUID().slice(0, 8)}@example.com` });
    assert.equal(r.status, 400, `refused: ${username}`);
  }
  const n = (await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  assert.equal(n, 0, 'none of them were stored');
});

test('emails can only be plain addresses', async () => {
  for (const email of ['<script>@x.com', 'a"b@x.com', 'a b@x.com', 'x@<b>.com', "o'hare@x.com", 'x@x', 'x@x..com', `${'a'.repeat(70)}@x.com`, 'x@x.com\n<script>']) {
    const r = await signup(srv.client(), { email, username: `u${randomUUID().slice(0, 8).replace(/-/g, '')}` });
    assert.equal(r.status, 400, `refused: ${JSON.stringify(email)}`);
  }
  assert.equal((await signup(srv.client(), { email: 'Jan.Smit+dam@Mail.co.za', username: 'jansmit' })).status, 201, 'a normal one is fine');
});

test('passwords: too short, over 72 bytes, control characters or not text are refused', async () => {
  for (const password of ['short', 'x'.repeat(73), 'ñ'.repeat(40), 'pass\u0000word1', ['password1'], { a: 1 }, 12345678]) {
    const r = await signup(srv.client(), { password, email: `${randomUUID().slice(0, 8)}@example.com`, username: `p${randomUUID().slice(0, 8).replace(/-/g, '')}` });
    assert.equal(r.status, 400, `refused: ${JSON.stringify(password)}`);
  }
});

test('SQL injection in the login box just fails to log in', async () => {
  for (const login of ["' OR 1=1 --", "admin'--", 'jansmit\' OR \'x\'=\'x', '"; DELETE FROM users; --', 'x'.repeat(5000)]) {
    const r = await srv.client().post('/api/auth/login', { login, password: "' OR '1'='1" });
    assert.equal(r.status, 401, `refused: ${login.slice(0, 30)}`);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1, 'nothing was deleted');
});

test('other websites can\'t make changes (CSRF), and only JSON is accepted', async () => {
  const evil = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ login: 'jansmit', password: 'password1' }),
  });
  assert.equal(evil.status, 403);
  const form = await fetch(`${srv.base}/api/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.equal(form.status, 415);
  const same = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: srv.base },
    body: JSON.stringify({ login: 'jansmit', password: 'password1' }),
  });
  assert.equal(same.status, 200, 'the game itself still can');
});

test('broken or odd request bodies never crash the server', async () => {
  const raw = (body) => fetch(`${srv.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal((await raw('{not json')).status, 400);
  assert.equal((await raw('[1,2,3]')).status, 401);
  assert.equal((await raw('"just a string"')).status, 400);
  assert.equal((await raw(JSON.stringify({ __proto__: { admin: true }, login: 'x', password: 'y' }))).status, 401);
  assert.equal((await raw(JSON.stringify({ login: 'x', password: 'y'.repeat(100000) }))).status, 400, 'oversized body refused');
  assert.deepEqual({}.admin, undefined, 'no prototype pollution');
});

test('saves: made-up settings and impossible numbers are cleaned or refused', async () => {
  const c = srv.client();
  const me = await signup(c, { email: 'saver@example.com', username: 'saver' });
  const settings = { quality: '<script>', volume: 7, showHints: 'yes', evil: '<img onerror=x>', turnSpeed: 1.5 };
  const put = await c.put('/api/me/save', { save: { credits: 5, settings, locationId: '<b>x</b>' }, baseVersion: me.body.version });
  assert.equal(put.status, 200);
  const s = (await c.get('/api/me')).body.save;
  assert.deepEqual(s.settings, { volume: 1, turnSpeed: 1.5 });
  assert.equal(s.locationId, null);
  const huge = await c.put('/api/me/save', { save: { credits: 1e20 }, baseVersion: put.body.version });
  assert.equal(huge.status, 400);
});

test('catches: fish must live at that spot, and nobody can flood the records', async () => {
  const c = srv.client();
  await c.post('/api/auth/login', { login: 'saver', password: 'password1' });
  const tigerAtHarties = await c.post('/api/me/catches', { id: randomUUID(), speciesId: 'tigerfish', locationId: 'hartbeespoort', weightKg: 3 });
  assert.equal(tigerAtHarties.status, 400);
  assert.match(tigerAtHarties.body.error, /isn't found at that spot/);

  const db2 = await newTestDb();
  const s2 = await startTestServer(db2, { playLimiter: createRateLimiter({ limit: 40, windowMs: 300000 }) });
  const p = s2.client();
  await signup(p, { email: 'flood@example.com', username: 'flooder' });
  let last;
  for (let i = 0; i < 41; i++) last = await p.post('/api/me/catches', { id: randomUUID(), speciesId: 'common-carp', locationId: 'hartbeespoort', weightKg: 2 });
  assert.equal(last.status, 429);
  await s2.close();
  await db2.end();
});

test('security headers on every response; the page gets a CSP with a fresh nonce', async () => {
  const api = await fetch(`${srv.base}/api/health`);
  assert.equal(api.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(api.headers.get('x-frame-options'), 'DENY');
  assert.equal(api.headers.get('cache-control'), 'no-store');
  assert.equal(api.headers.get('x-powered-by'), null);
  const page1 = await fetch(`${srv.base}/`);
  const page2 = await fetch(`${srv.base}/index.html`);
  const csp = page1.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  const n1 = (await page1.text()).match(/<script nonce="([^"]+)">/)[1];
  const n2 = (await page2.text()).match(/<script nonce="([^"]+)">/)[1];
  assert.ok(csp.includes(n1) && n1 !== n2, 'each visit gets its own nonce');
});

test('the database itself refuses bad usernames and emails', async () => {
  const HASH = `$2a$11$${'a'.repeat(53)}`;
  await db.query("INSERT INTO users (email, username, password_hash) VALUES ('dbok@b.co', 'db_ok', $1)", [HASH]); // a good row is fine
  await assert.rejects(db.query("INSERT INTO users (email, username, password_hash) VALUES ('a@b.co', '<script>', $1)", [HASH]));
  await assert.rejects(db.query("INSERT INTO users (email, username, password_hash) VALUES ('<x>@b.co', 'fine_name', $1)", [HASH]));
  await assert.rejects(db.query("INSERT INTO users (email, username, password_hash) VALUES ('c@b.co', 'fine_name', 'plaintext-password')"), 'passwords can only be stored hashed');
});
