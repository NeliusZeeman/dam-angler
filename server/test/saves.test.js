import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';

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
const fullSave = {
  locationId: 'jozini', startTimeOfDay: 'sunset', credits: 950,
  ownedRodIds: ['rod-starter', 'rod-heavy'], ownedLineIds: ['line-starter', 'line-jbraid-30'],
  ownedReelIds: ['reel-starter', 'reel-bigpit'], ownedHookIds: ['hook-small', 'hook-wire-trace'],
  ownedLureIds: ['bread-bait', 'chicken-liver', 'not-a-real-bait'],
  equippedRodId: 'rod-heavy', equippedLineId: 'line-jbraid-30', equippedReelId: 'reel-bigpit',
  equippedHookId: 'hook-wire-trace', equippedLureId: 'chicken-liver', drag: 0.4,
  settings: { quality: 'high', volume: 0.5 },
};
const aCatch = (extra = {}) => ({
  id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg: 7.25, lengthCm: 88,
  trophy: false, payout: 120, timeOfDay: 'night', caughtAt: new Date().toISOString(), ...extra,
});

test('a save goes up and comes back the same, on any device', async () => {
  const p = await player();
  const put = await p.c.put('/api/me/save', { save: fullSave, baseVersion: p.version });
  assert.equal(put.status, 200);
  // "Another device": log in fresh.
  const other = srv.client();
  await other.post('/api/auth/login', { login: p.user.username, password: 'password1' });
  const { body } = await other.get('/api/me');
  assert.equal(body.version, put.body.version);
  const s = body.save;
  assert.equal(s.credits, 950);
  assert.equal(s.locationId, 'jozini');
  assert.equal(s.startTimeOfDay, 'sunset');
  assert.deepEqual(s.ownedRodIds.sort(), ['rod-heavy', 'rod-starter']);
  assert.ok(!s.ownedLureIds.includes('not-a-real-bait'), 'unknown gear is dropped');
  assert.equal(s.equippedLureId, 'chicken-liver');
  assert.equal(s.equippedHookId, 'hook-wire-trace');
  assert.ok(Math.abs(s.drag - 0.4) < 1e-6);
  assert.deepEqual(s.settings, { quality: 'high', volume: 0.5 });
});

test('if another device saved first, the server says so (409) and sends its save', async () => {
  const p = await player();
  const first = await p.c.put('/api/me/save', { save: { ...fullSave, credits: 100 }, baseVersion: p.version });
  const stale = await p.c.put('/api/me/save', { save: { ...fullSave, credits: 5 }, baseVersion: p.version });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.save.credits, 100);
  assert.equal(stale.body.version, first.body.version);
});

test('gear is never taken away, and equipped gear must be owned', async () => {
  const p = await player();
  const v1 = (await p.c.put('/api/me/save', { save: fullSave, baseVersion: p.version })).body.version;
  const v2 = await p.c.put('/api/me/save', {
    save: { ...fullSave, ownedRodIds: ['rod-starter'], equippedRodId: 'rod-carp' }, baseVersion: v1,
  });
  assert.equal(v2.status, 200);
  const s = (await p.c.get('/api/me')).body.save;
  assert.ok(s.ownedRodIds.includes('rod-heavy'), 'the heavy rod bought earlier is still owned');
  assert.equal(s.equippedRodId, 'rod-starter', 'a rod you don\'t own can\'t be equipped');
});

test('bad saves are refused with a sentence', async () => {
  const p = await player();
  const r = await p.c.put('/api/me/save', { save: { ...fullSave, credits: -5 }, baseVersion: p.version });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /negative/);
});

test('a catch sent twice is stored once, and builds the catch log', async () => {
  const p = await player();
  const c1 = aCatch();
  assert.equal((await p.c.post('/api/me/catches', c1)).status, 201);
  assert.equal((await p.c.post('/api/me/catches', c1)).status, 200);
  await p.c.post('/api/me/catches', aCatch({ weightKg: 9.5, trophy: false }));
  await p.c.post('/api/me/catches', aCatch({ speciesId: 'tigerfish', weightKg: 4, trophy: true }));
  const log = (await p.c.get('/api/me')).body.save.catchLog;
  assert.deepEqual(log.catfish, { count: 2, bestWeightKg: 9.5 });
  assert.deepEqual(log.tigerfish, { count: 1, bestWeightKg: 4, trophies: 1 });
});

test('impossible catches are refused', async () => {
  const p = await player();
  assert.equal((await p.c.post('/api/me/catches', aCatch({ speciesId: 'shark' }))).status, 400);
  assert.equal((await p.c.post('/api/me/catches', aCatch({ locationId: 'atlantis' }))).status, 400);
  const huge = await p.c.post('/api/me/catches', aCatch({ weightKg: 500 }));
  assert.equal(huge.status, 400);
  assert.match(huge.body.error, /isn't possible/);
  assert.equal((await p.c.post('/api/me/catches', aCatch({ id: 'nope' }))).status, 400);
});

test('a guest who signs up keeps their progress and catches', async () => {
  const guestSave = { ...fullSave, credits: 300, catchLog: { 'common-carp': { count: 5, bestWeightKg: 6.1 }, catfish: { count: 1, bestWeightKg: 3 } } };
  const guestCatches = [aCatch({ weightKg: 3 })];
  const p = await player({ guestSave, guestCatches });
  assert.equal(p.save.credits, 300);
  assert.ok(p.save.ownedRodIds.includes('rod-heavy'));
  assert.deepEqual(p.save.catchLog['common-carp'], { count: 5, bestWeightKg: 6.1 });
  assert.equal(p.save.catchLog.catfish.count, 1, 'the catch sent along isn\'t counted twice');
});

test('you must be logged in to save', async () => {
  const r = await srv.client().put('/api/me/save', { save: fullSave, baseVersion: 0 });
  assert.equal(r.status, 401);
});
