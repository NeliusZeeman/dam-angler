import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';
import { setRole } from '../admin.js';

let db, srv, admin, sipho, anna;
const PASS = 'password1';

async function signup(username, email = `${username}@example.com`) {
  const c = srv.client();
  const r = await c.post('/api/auth/signup', { email, username, password: PASS, agree: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return c;
}
const idOf = async (username) => String((await db.query('SELECT id FROM users WHERE username = $1', [username])).rows[0].id);
const land = (c, extra) => c.post('/api/me/catches', { id: randomUUID(), speciesId: 'common-carp', locationId: 'hartbeespoort', weightKg: 4, ...extra });

before(async () => {
  db = await newTestDb();
  srv = await startTestServer(db);
  admin = await signup('boss', 'boss@example.com');
  assert.ok(await setRole(db, 'boss', 'admin'));
  sipho = await signup('sipho', 'sipho.m@mail.co.za');
  anna = await signup('annemarie', 'anna@example.com');
  await land(sipho, { weightKg: 8.4 });
  await land(sipho, { weightKg: 2.2 });
  await land(anna, { weightKg: 12.2 });
  await land(anna, { speciesId: 'catfish', locationId: 'jozini', weightKg: 9 });
});
after(async () => { await srv.close(); await db.end(); });

const ROUTES = [
  ['get', '/api/admin/me'], ['get', '/api/admin/overview'], ['get', '/api/admin/players'],
  ['get', '/api/admin/players/1'], ['post', '/api/admin/players/1/credits'], ['del', '/api/admin/players/1'],
  ['get', '/api/admin/log'],
];

test('every admin route: 401 when logged out, 403 for an ordinary player', async () => {
  const out = srv.client();
  for (const [m, p] of ROUTES) assert.equal((await out[m](p)).status, 401, `${m} ${p} logged out`);
  for (const [m, p] of ROUTES) assert.equal((await sipho[m](p)).status, 403, `${m} ${p} as a player`);
  assert.deepEqual((await admin.get('/api/admin/me')).body, { username: 'boss' });
});

test('nobody can make themselves admin through the game', async () => {
  const c = await signup('sneaky');
  await c.post('/api/auth/signup', { email: 'x2@example.com', username: 'sneaky2', password: PASS, agree: true, role: 'admin' });
  const v = (await c.get('/api/me')).body.version;
  await c.put('/api/me/save', { save: { role: 'admin', settings: { role: 'admin' } }, baseVersion: v });
  const roles = (await db.query("SELECT username, role FROM users WHERE username LIKE 'sneaky%'")).rows;
  assert.ok(roles.every((r) => r.role === 'player'));
  assert.equal((await c.get('/api/admin/me')).status, 403);
});

test('make-admin can also take the role away again', async () => {
  await signup('temp_admin');
  assert.ok(await setRole(db, 'TEMP_ADMIN', 'admin'));
  assert.ok(await setRole(db, 'temp_admin', 'player'));
  assert.equal(await setRole(db, 'nobody_here', 'admin'), false);
  await assert.rejects(setRole(db, 'temp_admin', 'god'));
});

test('dashboard: players, activity, catches, credits, top fish and dams', async () => {
  const o = (await admin.get('/api/admin/overview')).body;
  const users = (await db.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  assert.equal(o.players.total, users);
  assert.equal(o.players.newThisWeek, users);
  assert.ok(o.players.activeToday >= 3, 'people who logged in today count as active');
  assert.equal(o.catches.total, 4);
  assert.equal(o.catches.today, 4);
  const held = (await db.query('SELECT sum(credits)::int AS n FROM player_state')).rows[0].n;
  assert.equal(o.creditsHeld, held);
  assert.equal(o.topCatches[0].username, 'annemarie');
  assert.equal(o.topCatches[0].weightKg, 12.2);
  assert.deepEqual(o.dams.map((d) => d.locationId), ['hartbeespoort', 'jozini']);
});

test('player search: part of a username or email, any case; sorting; paging', async () => {
  const byName = (await admin.get('/api/admin/players?q=SIP')).body;
  assert.deepEqual(byName.players.map((p) => p.username), ['sipho']);
  const byEmail = (await admin.get('/api/admin/players?q=mail.co.za')).body;
  assert.deepEqual(byEmail.players.map((p) => p.username), ['sipho']);
  assert.equal((await admin.get('/api/admin/players?q=%25')).body.total, 0, '% is searched for literally');
  const sipRow = byName.players[0];
  assert.equal(sipRow.catches, 2);
  assert.deepEqual(sipRow.best, { speciesId: 'common-carp', weightKg: 8.4 });
  const byCatches = (await admin.get('/api/admin/players?sort=catches&dir=desc')).body.players;
  assert.ok(['sipho', 'annemarie'].includes(byCatches[0].username));
  const weird = await admin.get('/api/admin/players?sort=password_hash;DROP%20TABLE%20users&dir=sideways&page=-4');
  assert.equal(weird.status, 200, 'an unknown sort just falls back');
  assert.equal(weird.body.page, 1);
  assert.ok(!JSON.stringify(weird.body).includes('$2'), 'no password hashes anywhere');
});

test('player page: details, gear, rig, catches and credit history', async () => {
  const d = (await admin.get(`/api/admin/players/${await idOf('annemarie')}`)).body;
  assert.equal(d.player.username, 'annemarie');
  assert.equal(d.player.email, 'anna@example.com');
  assert.equal(d.player.totalCatches, 2);
  assert.deepEqual(d.save.ownedRodIds, ['rod-starter']);
  assert.equal(d.catches[0].speciesId, 'catfish', 'newest first');
  assert.ok(d.creditHistory.every((h) => h.reason === 'catch'));
  assert.equal((await admin.get('/api/admin/players/999999')).status, 404);
  assert.equal((await admin.get('/api/admin/players/abc')).status, 404);
});

test('give and take credits: limits, a reason, never below zero, both logs', async () => {
  const id = await idOf('sipho');
  const before = (await admin.get(`/api/admin/players/${id}`)).body.player.credits;
  const give = await admin.post(`/api/admin/players/${id}/credits`, { amount: 500, reason: 'Competition prize — biggest carp' });
  assert.equal(give.status, 200);
  assert.equal(give.body.credits, before + 500);
  assert.equal((await sipho.get('/api/me')).body.save.credits, before + 500, 'the player sees it straight away');
  assert.equal((await admin.post(`/api/admin/players/${id}/credits`, { amount: 5, reason: 'no' })).status, 400, 'reason too short');
  for (const amount of [0, 1.5, 'lots', 2_000_000, -2_000_000]) {
    assert.equal((await admin.post(`/api/admin/players/${id}/credits`, { amount, reason: 'testing limits' })).status, 400, `amount ${amount}`);
  }
  const tooMuch = await admin.post(`/api/admin/players/${id}/credits`, { amount: -(before + 501), reason: 'taking too much' });
  assert.equal(tooMuch.status, 400);
  assert.match(tooMuch.body.error, /doesn't have that many credits/);
  const big = await admin.post(`/api/admin/players/${id}/credits`, { amount: 20_000, reason: 'big refund' });
  assert.equal(big.status, 401, 'over 10,000 needs the password');
  assert.equal((await admin.post(`/api/admin/players/${id}/credits`, { amount: 20_000, reason: 'big refund', password: PASS })).status, 200);
  const hist = (await admin.get(`/api/admin/players/${id}`)).body.creditHistory;
  assert.deepEqual(hist.slice(0, 2).map((h) => [h.reason, h.amount, h.ref]), [['admin', 20000, 'big refund'], ['admin', 500, 'Competition prize — biggest carp']]);
  const log = (await admin.get('/api/admin/log')).body.entries;
  assert.equal(log[0].action, 'credits');
  assert.equal(log[0].admin, 'boss');
  assert.equal(log[0].target, 'sipho');
  assert.equal(log[0].details.amount, 20000);
});

test('delete a player: username and password to confirm; admins and yourself are safe', async () => {
  const victim = await signup('leaver', 'leaver@example.com');
  await land(victim, { weightKg: 3 });
  const id = await idOf('leaver');
  assert.equal((await admin.del(`/api/admin/players/${id}`, { confirmUsername: 'wrong', password: PASS })).status, 400);
  assert.equal((await admin.del(`/api/admin/players/${id}`, { confirmUsername: 'leaver', password: 'nope-nope' })).status, 401);
  assert.equal((await admin.del(`/api/admin/players/${await idOf('boss')}`, { confirmUsername: 'boss', password: PASS })).status, 400, 'not yourself');
  await signup('other_admin');
  await setRole(db, 'other_admin', 'admin');
  assert.equal((await admin.del(`/api/admin/players/${await idOf('other_admin')}`, { confirmUsername: 'other_admin', password: PASS })).status, 400, 'not another admin');
  const ok = await admin.del(`/api/admin/players/${id}`, { confirmUsername: 'LEAVER', password: PASS });
  assert.equal(ok.status, 200);
  assert.equal((await victim.get('/api/me')).status, 401, 'their login stops working');
  for (const t of ['users', 'player_state', 'player_gear', 'catches', 'credit_log', 'sessions']) {
    const col = t === 'users' ? 'id' : 'user_id';
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = $1`, [id])).rows[0].n, 0, `${t} cleaned`);
  }
  const entry = (await admin.get('/api/admin/log')).body.entries[0];
  assert.deepEqual([entry.action, entry.target, entry.details.catches], ['delete-player', 'leaver', 1], 'the log keeps the name');
});

test('emails only ever show in the admin area', async () => {
  const pub = JSON.stringify((await srv.client().get('/api/dams/stats')).body);
  assert.ok(!pub.includes('@'));
  const adminList = JSON.stringify((await admin.get('/api/admin/players')).body);
  assert.ok(adminList.includes('anna@example.com'));
});

test('being active is recorded (for the dashboard)', async () => {
  await db.query("UPDATE users SET last_seen_at = now() - interval '2 days' WHERE username = 'annemarie'");
  await anna.get('/api/me');
  const seen = (await db.query("SELECT last_seen_at > now() - interval '1 minute' AS fresh FROM users WHERE username = 'annemarie'")).rows[0].fresh;
  assert.equal(seen, true);
});
