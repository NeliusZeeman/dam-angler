import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newTestDb, startTestServer } from './helpers.js';
import { createRateLimiter } from '../auth.js';

let db, srv;
before(async () => { db = await newTestDb(); srv = await startTestServer(db); });
after(async () => { await srv.close(); await db.end(); });

const signup = (c, extra = {}) => c.post('/api/auth/signup', { email: 'Nelius@Example.co.za', username: 'nelius', password: 'hunter22x', agree: true, ...extra });

test('sign up starts a session and /api/me shows the new player', async () => {
  const c = srv.client();
  const r = await signup(c);
  assert.equal(r.status, 201);
  assert.match(r.setCookie, /da_session=.+HttpOnly; SameSite=Lax/);
  assert.equal(r.body.user.email, 'nelius@example.co.za', 'emails are stored lower-case');
  const me = await c.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, 'nelius');
  assert.equal(me.body.save.credits, 0);
  assert.deepEqual(me.body.save.ownedRodIds, ['rod-starter']);
  assert.equal(me.body.save.equippedLureId, 'bread-bait');
  const stored = (await db.query("SELECT password_hash FROM users WHERE username = 'nelius'")).rows[0].password_hash;
  assert.ok(stored.startsWith('$2') && !stored.includes('hunter22x'), 'only a bcrypt hash is stored');
});

test('the same email or username (any case) can\'t sign up twice', async () => {
  const a = await signup(srv.client(), { username: 'someoneelse' });
  assert.equal(a.status, 409);
  assert.match(a.body.error, /already an account/);
  const b = await signup(srv.client(), { email: 'other@example.co.za', username: 'NELIUS' });
  assert.equal(b.status, 409);
  assert.match(b.body.error, /username is taken/);
});

test('sign-up rules: password length, username, email, privacy notice', async () => {
  const c = srv.client();
  assert.equal((await signup(c, { email: 'x1@e.co', username: 'abc_1', password: 'short' })).status, 400);
  assert.equal((await signup(c, { email: 'x2@e.co', username: 'a!' })).status, 400);
  assert.equal((await signup(c, { email: 'not-an-email', username: 'abc_2' })).status, 400);
  const noAgree = await signup(c, { email: 'x3@e.co', username: 'abc_3', agree: false });
  assert.equal(noAgree.status, 400);
  assert.match(noAgree.body.error, /privacy notice/);
});

test('log in with email or username; wrong password is refused', async () => {
  const c = srv.client();
  assert.equal((await c.post('/api/auth/login', { login: 'NELIUS', password: 'hunter22x' })).status, 200);
  assert.equal((await c.get('/api/me')).status, 200);
  const byEmail = await srv.client().post('/api/auth/login', { login: 'nelius@example.co.za', password: 'hunter22x' });
  assert.equal(byEmail.status, 200);
  const wrong = await srv.client().post('/api/auth/login', { login: 'nelius', password: 'nope-nope' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Wrong email/username or password.');
  const nobody = await srv.client().post('/api/auth/login', { login: 'ghost', password: 'nope-nope' });
  assert.equal(nobody.body.error, wrong.body.error, 'same message whether or not the account exists');
});

test('log out ends the session', async () => {
  const c = srv.client();
  await c.post('/api/auth/login', { login: 'nelius', password: 'hunter22x' });
  assert.equal((await c.post('/api/auth/logout')).status, 200);
  assert.equal((await c.get('/api/me')).status, 401);
});

test('too many tries are slowed down (429)', async () => {
  let t = 0;
  const limiter = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  for (let i = 0; i < 10; i++) assert.ok(limiter.hit('k'));
  assert.equal(limiter.hit('k'), false);
  t = 2000;
  assert.ok(limiter.hit('k'), 'allowed again after the window');

  const db2 = await newTestDb();
  const s2 = await startTestServer(db2, { limiter: createRateLimiter() });
  const c = s2.client();
  let last;
  for (let i = 0; i < 11; i++) last = await c.post('/api/auth/login', { login: 'ghost', password: 'wrong-pass' });
  assert.equal(last.status, 429);
  await s2.close();
  await db2.end();
});

test('deleting the account needs the password and removes everything', async () => {
  const c = srv.client();
  await signup(c, { email: 'gone@e.co', username: 'goner' });
  assert.equal((await c.del('/api/me', { password: 'wrong-pass' })).status, 401);
  assert.equal((await c.del('/api/me', { password: 'hunter22x' })).status, 200);
  assert.equal((await c.get('/api/me')).status, 401);
  const left = (await db.query("SELECT count(*)::int AS n FROM users WHERE username = 'goner'")).rows[0].n;
  assert.equal(left, 0);
  const orphans = (await db.query('SELECT count(*)::int AS n FROM player_state WHERE user_id NOT IN (SELECT id FROM users)')).rows[0].n;
  assert.equal(orphans, 0);
});
