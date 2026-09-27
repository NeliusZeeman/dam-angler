import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';
import { setRole } from '../admin.js';
import { forgetPublished } from '../tuning.js';
import { resetTuning } from '../../src/tuning/apply.js';
import { catchPayout } from '../../src/economy.js';
import { FISH_SPECIES } from '../../src/fish.js';
import { RODS, LINES, HOOKS } from '../../src/gear.js';

let db, srv, admin, player;
const PASS = 'password1';
async function signup(username) {
  const c = srv.client();
  const r = await c.post('/api/auth/signup', { email: `${username}@example.com`, username, password: PASS, agree: true });
  assert.equal(r.status, 201);
  return c;
}

before(async () => {
  forgetPublished();
  resetTuning();
  db = await newTestDb();
  srv = await startTestServer(db);
  admin = await signup('tuner');
  await setRole(db, 'tuner', 'admin');
  player = await signup('angler1');
});
after(async () => { forgetPublished(); resetTuning(); await srv.close(); await db.end(); });

const put = (key, value) => admin.put('/api/admin/tuning/draft', { key, value });

test('ordinary players can\'t see or change the tuning', async () => {
  for (const [m, p, b] of [['get', '/api/admin/tuning'], ['get', '/api/admin/tuning/draft'], ['put', '/api/admin/tuning/draft', { key: 'engine.money.chumCost', value: 1 }],
    ['del', '/api/admin/tuning/draft'], ['post', '/api/admin/tuning/publish', { note: 'hack' }], ['post', '/api/admin/tuning/rollback', { versionId: 1 }],
    ['get', '/api/admin/tuning/export'], ['post', '/api/admin/tuning/import', { values: {} }]]) {
    assert.equal((await player[m](p, b)).status, 403, `${m} ${p}`);
  }
});

test('nothing published yet: players get the built-in game', async () => {
  const r = await srv.client().get('/api/tuning');
  assert.deepEqual(r.body, { version: 0, values: {} });
});

test('a draft is invisible to players until it\'s published', async () => {
  assert.equal((await put('engine.money.chumCost', 40)).status, 200);
  assert.equal((await put('fish.common-carp.baseValuePerKg', 100)).status, 200);
  assert.deepEqual((await srv.client().get('/api/tuning')).body.values, {});
  const state = (await admin.get('/api/admin/tuning')).body;
  assert.deepEqual(state.draft, { 'engine.money.chumCost': 40, 'fish.common-carp.baseValuePerKg': 100 });
  assert.deepEqual(state.published, {});
  // Breadcrumbs still cost the built-in 15 on the server.
  const c = await signup('angler2');
  await c.post('/api/me/catches', { id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg: 10 });
  const before = (await c.get('/api/me')).body.save.credits;
  assert.equal((await c.post('/api/me/spend', { what: 'chum' })).body.credits, before - 15);
});

test('publishing needs a note, then players and the server use the new values', async () => {
  assert.equal((await admin.post('/api/admin/tuning/publish', { note: '' })).status, 400);
  const pub = await admin.post('/api/admin/tuning/publish', { note: 'Pricier breadcrumbs, carp worth more' });
  assert.equal(pub.status, 200);
  const live = (await srv.client().get('/api/tuning')).body;
  assert.equal(live.version, pub.body.version);
  assert.deepEqual(live.values, { 'engine.money.chumCost': 40, 'fish.common-carp.baseValuePerKg': 100 });
  // The server now charges and pays with the published values.
  const c = await signup('angler3');
  const id = randomUUID();
  const caught = await c.post('/api/me/catches', { id, speciesId: 'common-carp', locationId: 'hartbeespoort', weightKg: 5 });
  const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');
  assert.equal(carp.baseValuePerKg, 100);
  assert.equal(caught.body.payout, catchPayout({ species: carp, weightKg: 5, rod: RODS[0], line: LINES[0], hook: HOOKS[0], catchId: id }));
  assert.equal((await c.post('/api/me/spend', { what: 'chum' })).body.credits, caught.body.credits - 40);
  const log = (await admin.get('/api/admin/log')).body.entries[0];
  assert.equal(log.action, 'tuning-publish');
  assert.equal(log.details.note, 'Pricier breadcrumbs, carp worth more');
});

test('bad values are refused with a sentence', async () => {
  const r = await put('fish.mozambique-tilapia.maxWeightKg', 5000);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Mozambique Tilapia — Biggest weight: must be from/);
  assert.equal((await put('not.a.setting', 1)).status, 400);
  assert.equal((await put('gear.rod.rod-carp.cost', 'free')).status, 400);
  // Values that don't make sense together can't be published.
  await put('fish.common-carp.minWeightKg', 30);
  const pub = await admin.post('/api/admin/tuning/publish', { note: 'broken carp' });
  assert.equal(pub.status, 400);
  assert.match(pub.body.error, /smallest weight must be below the biggest/);
  await put('fish.common-carp.minWeightKg', null); // reset to built-in
  assert.equal((await admin.get('/api/admin/tuning')).body.draft['fish.common-carp.minWeightKg'], undefined);
});

test('taking an item out of the shop stops new sales', async () => {
  await put('gear.lure.worm.inShop', false);
  await admin.post('/api/admin/tuning/publish', { note: 'No more worms' });
  const c = await signup('angler4');
  await c.post('/api/me/catches', { id: randomUUID(), speciesId: 'catfish', locationId: 'jozini', weightKg: 12 });
  const r = await c.post('/api/me/buy', { kind: 'lure', itemId: 'worm' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /isn't in the shop/);
});

test('roll back to an earlier version; discard a draft', async () => {
  const state = (await admin.get('/api/admin/tuning')).body;
  const first = state.versions.at(-1);
  const rb = await admin.post('/api/admin/tuning/rollback', { versionId: first.id });
  assert.equal(rb.status, 200);
  assert.deepEqual((await srv.client().get('/api/tuning')).body.values, { 'engine.money.chumCost': 40, 'fish.common-carp.baseValuePerKg': 100 });
  assert.equal((await admin.get('/api/admin/log')).body.entries[0].action, 'tuning-rollback');
  await put('engine.money.chumCost', 99);
  await admin.del('/api/admin/tuning/draft');
  assert.equal((await admin.get('/api/admin/tuning')).body.draft['engine.money.chumCost'], 40, 'the draft is back to what\'s published');
  assert.equal((await admin.post('/api/admin/tuning/rollback', { versionId: 99999 })).status, 404);
});

test('export and import (import lands in the draft; bad lines are reported)', async () => {
  const file = (await admin.get('/api/admin/tuning/export?which=published')).body;
  assert.equal(file.kind, 'tuning');
  assert.equal(file.values['engine.money.chumCost'], 40);
  const imp = await admin.post('/api/admin/tuning/import', {
    ...file, values: { ...file.values, 'engine.money.chumCost': 25, 'fish.nope.maxWeightKg': 3, 'fish.catfish.maxWeightKg': -1 },
  });
  assert.equal(imp.status, 200);
  assert.equal(imp.body.imported, 2);
  assert.equal(imp.body.skipped.length, 2);
  assert.equal((await admin.get('/api/admin/tuning')).body.draft['engine.money.chumCost'], 25);
  assert.equal((await srv.client().get('/api/tuning')).body.values['engine.money.chumCost'], 40, 'players still on the published value');
});
