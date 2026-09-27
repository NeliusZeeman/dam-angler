import assert from 'node:assert';
import { createCloud, mergeOnConflict } from '../src/cloud.js';

// A pretend browser storage and a pretend server.
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function fakeServer() {
  const s = { online: true, version: 3, save: null, catches: new Map(), calls: [], saveStatus: null, credits: 100, prices: { 'rod-heavy': 900, 'rod-spinning': 50 }, owned: ['rod-starter'] };
  s.fetch = async (url, opts) => {
    if (!s.online) throw new TypeError('Failed to fetch');
    const path = url.replace('/api', '');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    s.calls.push(`${opts.method} ${path}`);
    const reply = (status, data) => ({ status, json: async () => data });
    if (path === '/me/catches') {
      if (!s.catches.has(body.id)) s.credits += 10;
      s.catches.set(body.id, body);
      return reply(201, { ok: true, credits: s.credits });
    }
    if (path === '/me/buy') {
      const price = s.prices[body.itemId];
      if (s.credits < price) return reply(400, { error: 'Not enough credits' });
      s.credits -= price;
      s.owned.push(body.itemId);
      return reply(200, { credits: s.credits });
    }
    if (path === '/me/spend') { s.credits -= 15; return reply(200, { credits: s.credits }); }
    if (path === '/me/save') {
      if (s.saveStatus === 409 || body.baseVersion !== s.version) { s.saveStatus = null; return reply(409, { save: s.save, version: s.version }); }
      s.save = body.save;
      s.version++;
      return reply(200, { version: s.version });
    }
    if (path === '/me') return reply(200, { user: { username: 'nelius' }, save: { ...(s.save || {}), credits: s.credits, ownedRodIds: s.owned, equippedRodId: 'rod-starter' }, version: s.version });
    if (path === '/auth/login') return reply(200, { user: { username: 'nelius' }, save: s.save, version: s.version });
    return reply(404, {});
  };
  return s;
}
// Timers we run by hand.
function manualTimers() {
  const t = { list: [] };
  t.set = (fn) => { t.list.push(fn); return fn; };
  t.clear = (fn) => { t.list = t.list.filter((x) => x !== fn); };
  t.run = async () => { const fns = t.list; t.list = []; for (const fn of fns) fn(); await new Promise((r) => setTimeout(r, 0)); };
  return t;
}
const loggedIn = () => fakeStorage({ 'da-cloud-user': JSON.stringify({ username: 'nelius', version: 3 }) });
const base = { credits: 10, ownedRodIds: ['rod-starter'], equippedRodId: 'rod-starter', catchLog: { x: 1 } };

{
  // Many saves in a row go out as one call, without the catch log.
  const srv = fakeServer();
  const t = manualTimers();
  const cloud = createCloud({ fetchImpl: srv.fetch, storage: loggedIn(), setTimer: t.set, clearTimer: t.clear });
  for (let i = 0; i < 5; i++) cloud.queueSave({ ...base, drag: 0.1 * i });
  await t.run();
  await cloud.flush();
  assert.deepEqual(srv.calls, ['PUT /me/save']);
  assert.equal(srv.save.drag, 0.4);
  assert.equal(srv.save.credits, undefined, 'credits are never sent in a save');
  assert.equal(srv.save.catchLog, undefined);
  assert.equal(cloud.status(), 'synced');
  console.log('PASS: saves are batched into one call');
}

{
  // Offline: everything waits (even across a reload) and goes when back online.
  const srv = fakeServer();
  srv.online = false;
  const storage = loggedIn();
  const t = manualTimers();
  let cloud = createCloud({ fetchImpl: srv.fetch, storage, setTimer: t.set, clearTimer: t.clear });
  const c = cloud.queueCatch({ speciesId: 'catfish', locationId: 'jozini', weightKg: 5 });
  cloud.queueSave({ ...base, drag: 0.77 });
  await cloud.flush();
  assert.equal(cloud.status(), 'offline');
  // "Reload the page", then the connection comes back.
  cloud = createCloud({ fetchImpl: srv.fetch, storage, setTimer: t.set, clearTimer: t.clear });
  srv.online = true;
  await cloud.flush();
  assert.ok(srv.catches.has(c.id));
  assert.equal(srv.save.drag, 0.77);
  assert.equal(cloud.status(), 'synced');
  console.log('PASS: offline saves and catches survive a reload and sync later');
}

{
  // Another device saved first: credits and gear are the server's; this
  // device's rig and settings are kept and sent again.
  const srv = fakeServer();
  srv.save = { ...base, credits: 500, ownedRodIds: ['rod-starter', 'rod-carp'], equippedRodId: 'rod-starter', drag: 0.3 };
  srv.saveStatus = 409;
  let replaced = null;
  const t = manualTimers();
  const cloud = createCloud({ fetchImpl: srv.fetch, storage: loggedIn(), setTimer: t.set, clearTimer: t.clear, onSaveReplaced: (s) => { replaced = s; } });
  cloud.queueSave({ ...base, credits: 99999, ownedRodIds: ['rod-starter', 'rod-carp'], equippedRodId: 'rod-carp', drag: 0.5 });
  await cloud.flush();
  assert.ok(replaced, 'the game is handed the merged save');
  assert.equal(replaced.credits, 500, 'the server\'s credits');
  assert.equal(replaced.equippedRodId, 'rod-carp', 'this device\'s rig');
  assert.equal(replaced.drag, 0.5);
  assert.equal(srv.save.equippedRodId, 'rod-carp', 'merged save sent back');
  assert.equal(srv.save.credits, undefined, 'credits are never sent in a save');
  // Rigging something the server says you don't own falls back to its choice.
  const m = mergeOnConflict({ equippedRodId: 'rod-heavy' }, { ownedRodIds: ['rod-starter'], equippedRodId: 'rod-starter', credits: 1 });
  assert.equal(m.equippedRodId, 'rod-starter');
  console.log('PASS: a clash between devices keeps the server\'s books and this device\'s rig');
}

{
  // The server's balance is the one the game shows; purchases and
  // breadcrumbs go in the order they happened.
  const srv = fakeServer();
  let credits = null;
  const t = manualTimers();
  const cloud = createCloud({ fetchImpl: srv.fetch, storage: loggedIn(), setTimer: t.set, clearTimer: t.clear, onCredits: (c) => { credits = c; } });
  cloud.queueCatch({ speciesId: 'catfish', locationId: 'jozini', weightKg: 5 });
  cloud.queueBuy('rod', 'rod-spinning');
  cloud.queueSpend('chum');
  await cloud.flush();
  assert.deepEqual(srv.calls, ['POST /me/catches', 'POST /me/buy', 'POST /me/spend']);
  assert.equal(credits, 100 + 10 - 50 - 15);
  console.log('PASS: catches, purchases and breadcrumbs go in order; the server\'s balance wins');
}

{
  // A purchase the server refuses (not enough credits there): the server's
  // gear and credits replace this device's.
  const srv = fakeServer();
  srv.credits = 20;
  let replaced = null;
  const t = manualTimers();
  const cloud = createCloud({ fetchImpl: srv.fetch, storage: loggedIn(), setTimer: t.set, clearTimer: t.clear, onSaveReplaced: (s) => { replaced = s; } });
  cloud.queueBuy('rod', 'rod-heavy');
  await cloud.flush();
  assert.ok(replaced, 'the server\'s save is taken back');
  assert.equal(replaced.credits, 20);
  assert.deepEqual(replaced.ownedRodIds, ['rod-starter'], 'the rod that wasn\'t paid for is gone');
  console.log('PASS: a refused purchase is undone on this device');
}

{
  // As a guest, catches are kept on the device for when you sign up.
  const storage = fakeStorage();
  const cloud = createCloud({ fetchImpl: async () => { throw new Error('no server'); }, storage });
  cloud.queueCatch({ speciesId: 'common-carp', locationId: 'vaal', weightKg: 3 });
  cloud.queueCatch({ speciesId: 'common-carp', locationId: 'vaal', weightKg: 4 });
  const kept = JSON.parse(storage.getItem('da-guest-catches'));
  assert.equal(kept.length, 2);
  assert.ok(kept[0].id && kept[0].id !== kept[1].id);
  assert.equal(cloud.status(), 'guest');
  assert.equal(await cloud.available(), false);
  console.log('PASS: guest catches are kept for sign-up; no server means guest play');
}
