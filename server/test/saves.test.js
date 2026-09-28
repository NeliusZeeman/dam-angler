import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';
import { catchPayout } from '../../src/economy.js';
import { FISH_SPECIES } from '../../src/fish.js';
import { RODS, LINES, HOOKS, COMBOS } from '../../src/gear.js';
import { GUEST_IMPORT_LIMIT } from '../saves.js';

let db, srv;
before(async () => { db = await newTestDb(); srv = await startTestServer(db); });
after(async () => { await srv.close(); await db.end(); });

let n = 0;
async function player(extra = {}) {
  const c = srv.client();
  n++;
  const r = await c.post('/api/auth/signup', { email: `p${n}@e.co`, username: `player${n}`, password: 'password1', agree: true, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { c, ...r.body };
}
// Gives a player credits the honest way: by landing fish.
async function earn(c, times = 1, weightKg = 12) {
  let last;
  for (let i = 0; i < times; i++) {
    last = await c.post('/api/me/catches', { id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg });
    assert.equal(last.status, 201);
  }
  return last.body.credits;
}
const species = (id) => FISH_SPECIES.find((s) => s.id === id);
const byId = (list, id) => list.find((x) => x.id === id);
const rig = { locationId: 'jozini', startTimeOfDay: 'sunset', drag: 0.4, settings: { quality: 'high', volume: 0.5 } };

test('a catch pays exactly what the game shows, worked out by the server', async () => {
  const p = await player();
  const id = randomUUID();
  const r = await p.c.post('/api/me/catches', { id, speciesId: 'catfish', locationId: 'jozini', weightKg: 7.25, payout: 999999, trophy: true });
  assert.equal(r.status, 201);
  const expected = catchPayout({ species: species('catfish'), weightKg: 7.25, rod: RODS[0], line: LINES[0], hook: HOOKS[0], trophy: false, catchId: id });
  assert.equal(r.body.payout, expected, 'the payout the game sent (999999) is ignored');
  assert.equal(r.body.credits, expected);
  const again = await p.c.post('/api/me/catches', { id, speciesId: 'catfish', locationId: 'jozini', weightKg: 7.25 });
  assert.equal(again.status, 200);
  assert.equal(again.body.credits, expected, 'the same catch sent twice pays once');
});

test('a save can\'t set credits or hand out gear', async () => {
  const p = await player();
  const r = await p.c.put('/api/me/save', {
    save: { ...rig, credits: 5_000_000, ownedRodIds: ['rod-starter', 'rod-heavy'], equippedRodId: 'rod-heavy' },
    baseVersion: p.version,
  });
  assert.equal(r.status, 200);
  const s = (await p.c.get('/api/me')).body.save;
  assert.equal(s.credits, 0, 'credits stay what the server says');
  assert.deepEqual(s.ownedRodIds, ['rod-starter'], 'no free rod');
  assert.equal(s.equippedRodId, 'rod-starter', 'can\'t rig what you don\'t own');
  // The rest of the save does come through, on every device.
  assert.equal(s.locationId, 'jozini');
  assert.equal(s.startTimeOfDay, 'sunset');
  assert.ok(Math.abs(s.drag - 0.4) < 1e-6);
  assert.deepEqual(s.settings, { quality: 'high', volume: 0.5 });
});

test('buying: the real price, only with enough credits, and the gear is yours on every device', async () => {
  const p = await player();
  const broke = await p.c.post('/api/me/buy', { kind: 'rod', itemId: 'rod-spinning' });
  assert.equal(broke.status, 400);
  assert.match(broke.body.error, /Not enough credits/);
  const credits = await earn(p.c, 3);
  const buy = await p.c.post('/api/me/buy', { kind: 'rod', itemId: 'rod-spinning' });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.credits, credits - byId(RODS, 'rod-spinning').cost);
  const twice = await p.c.post('/api/me/buy', { kind: 'rod', itemId: 'rod-spinning' });
  assert.equal(twice.body.credits, buy.body.credits, 'buying what you own costs nothing');
  assert.equal((await p.c.post('/api/me/buy', { kind: 'rod', itemId: 'rod-imaginary' })).status, 400);
  const other = srv.client();
  await other.post('/api/auth/login', { login: p.user.username, password: 'password1' });
  const s = (await other.get('/api/me')).body.save;
  assert.ok(s.ownedRodIds.includes('rod-spinning'));
  assert.equal(s.credits, buy.body.credits);
  // Now it can be rigged.
  await other.put('/api/me/save', { save: { ...rig, equippedRodId: 'rod-spinning' }, baseVersion: (await other.get('/api/me')).body.version });
  assert.equal((await other.get('/api/me')).body.save.equippedRodId, 'rod-spinning');
});

test('a combo: one price for the rod and reel, and its parts aren\'t sold on their own', async () => {
  const p = await player();
  const combo = COMBOS.find((c) => c.id === 'combo-okuma-fin-chaser');
  assert.equal((await p.c.post('/api/me/buy', { kind: 'combo', itemId: combo.id })).status, 400, 'not without the credits');
  const credits = await earn(p.c, 2);
  const lone = await p.c.post('/api/me/buy', { kind: 'rod', itemId: combo.rodId });
  assert.equal(lone.status, 400);
  assert.match(lone.body.error, /combo/);
  const buy = await p.c.post('/api/me/buy', { kind: 'combo', itemId: combo.id });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.credits, credits - combo.cost);
  const s = (await p.c.get('/api/me')).body.save;
  assert.ok(s.ownedRodIds.includes(combo.rodId) && s.ownedReelIds.includes(combo.reelId), 'both are yours');
  const twice = await p.c.post('/api/me/buy', { kind: 'combo', itemId: combo.id });
  assert.equal(twice.body.credits, buy.body.credits, 'buying it again costs nothing');
  assert.equal((await p.c.post('/api/me/buy', { kind: 'combo', itemId: 'combo-imaginary' })).status, 400);
});

test('breadcrumbs cost 15 credits, and not without them', async () => {
  const p = await player();
  assert.equal((await p.c.post('/api/me/spend', { what: 'chum' })).status, 400);
  const credits = await earn(p.c, 1);
  const r = await p.c.post('/api/me/spend', { what: 'chum' });
  assert.equal(r.body.credits, credits - 15);
  assert.equal((await p.c.post('/api/me/spend', { what: 'free-money' })).status, 400);
});

test('the payout uses the gear the fish was caught on — only if you own it', async () => {
  const p = await player();
  await earn(p.c, 4);
  await p.c.post('/api/me/buy', { kind: 'hook', itemId: 'hook-double-j' });
  const owned = randomUUID();
  const withHook = await p.c.post('/api/me/catches', { id: owned, speciesId: 'common-carp', locationId: 'hartbeespoort', weightKg: 5, gear: { hookId: 'hook-double-j' } });
  assert.equal(withHook.body.payout, catchPayout({ species: species('common-carp'), weightKg: 5, rod: RODS[0], line: LINES[0], hook: byId(HOOKS, 'hook-double-j'), catchId: owned }));
  const fake = randomUUID();
  const notOwned = await p.c.post('/api/me/catches', { id: fake, speciesId: 'common-carp', locationId: 'hartbeespoort', weightKg: 5, gear: { rodId: 'rod-heavy', lineId: 'line-jbraid-30' } });
  assert.equal(notOwned.body.payout, catchPayout({ species: species('common-carp'), weightKg: 5, rod: RODS[0], line: LINES[0], hook: HOOKS[0], catchId: fake }), 'unowned gear earns no bonus');
});

test('a trophy is decided by the weight, not by the game saying so', async () => {
  const p = await player();
  const tiger = species('tigerfish');
  await p.c.post('/api/me/catches', { id: randomUUID(), speciesId: 'tigerfish', locationId: 'jozini', weightKg: 4, trophy: true });
  await p.c.post('/api/me/catches', { id: randomUUID(), speciesId: 'tigerfish', locationId: 'jozini', weightKg: tiger.maxWeightKg * 1.8, trophy: false });
  const log = (await p.c.get('/api/me')).body.save.catchLog;
  assert.equal(log.tigerfish.count, 2);
  assert.equal(log.tigerfish.trophies, 1);
});

test('if another device saved first, the server says so (409) and sends its save', async () => {
  const p = await player();
  const first = await p.c.put('/api/me/save', { save: { ...rig, drag: 0.2 }, baseVersion: p.version });
  const stale = await p.c.put('/api/me/save', { save: { ...rig, drag: 0.6 }, baseVersion: p.version });
  assert.equal(stale.status, 409);
  assert.ok(Math.abs(stale.body.save.drag - 0.2) < 1e-6);
  assert.equal(stale.body.version, first.body.version);
});

test('every credit change is in the books', async () => {
  const p = await player();
  await earn(p.c, 2);
  await p.c.post('/api/me/spend', { what: 'chum' });
  const uid = (await db.query('SELECT id FROM users WHERE username = $1', [p.user.username])).rows[0].id;
  const log = (await db.query('SELECT reason, amount FROM credit_log WHERE user_id = $1 ORDER BY id', [uid])).rows;
  assert.deepEqual(log.map((r) => r.reason), ['catch', 'catch', 'chum']);
  const sum = log.reduce((a, r) => a + r.amount, 0);
  assert.equal(sum, (await p.c.get('/api/me')).body.save.credits, 'the books add up to the balance');
});

test('impossible catches are refused', async () => {
  const p = await player();
  const aCatch = (extra) => ({ id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg: 5, ...extra });
  assert.equal((await p.c.post('/api/me/catches', aCatch({ speciesId: 'shark' }))).status, 400);
  assert.equal((await p.c.post('/api/me/catches', aCatch({ locationId: 'atlantis' }))).status, 400);
  const huge = await p.c.post('/api/me/catches', aCatch({ weightKg: 500 }));
  assert.equal(huge.status, 400);
  assert.match(huge.body.error, /isn't possible/);
  assert.equal((await p.c.post('/api/me/catches', aCatch({ id: 'nope' }))).status, 400);
});

test('a guest who signs up keeps their progress — up to the import limit', async () => {
  const guestSave = {
    ...rig, credits: 300, ownedRodIds: ['rod-starter', 'rod-heavy'], equippedRodId: 'rod-heavy',
    catchLog: { 'common-carp': { count: 5, bestWeightKg: 6.1 }, catfish: { count: 1, bestWeightKg: 3 } },
  };
  const guestCatches = [{ id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg: 3 }];
  const p = await player({ guestSave, guestCatches });
  assert.equal(p.save.credits, 300);
  assert.ok(p.save.ownedRodIds.includes('rod-heavy'));
  assert.equal(p.save.equippedRodId, 'rod-heavy');
  assert.deepEqual(p.save.catchLog['common-carp'], { count: 5, bestWeightKg: 6.1 });
  assert.equal(p.save.catchLog.catfish.count, 1, 'the catch sent along isn\'t counted twice');

  // A "guest" claiming a fortune gets the limit's worth, not the fortune.
  const greedy = await player({ guestSave: { ...guestSave, credits: 9_000_000, ownedRodIds: RODS.map((r) => r.id) } });
  const gearValue = greedy.save.ownedRodIds.reduce((sum, id) => sum + byId(RODS, id).cost, 0);
  assert.ok(gearValue + greedy.save.credits <= GUEST_IMPORT_LIMIT, `imported ${gearValue} of gear + ${greedy.save.credits} credits`);
  assert.ok(greedy.save.credits < 9_000_000);
});

test('you must be logged in to save, buy or spend', async () => {
  const c = srv.client();
  assert.equal((await c.put('/api/me/save', { save: rig, baseVersion: 0 })).status, 401);
  assert.equal((await c.post('/api/me/buy', { kind: 'rod', itemId: 'rod-spinning' })).status, 401);
  assert.equal((await c.post('/api/me/spend', { what: 'chum' })).status, 401);
});
