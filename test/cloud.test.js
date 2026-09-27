import assert from 'node:assert';
import { createCloud, mergeOnConflict } from '../src/cloud.js';

// A pretend browser storage and a pretend server.
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function fakeServer() {
  const s = { online: true, version: 3, save: null, catches: new Map(), calls: [], saveStatus: null };
  s.fetch = async (url, opts) => {
    if (!s.online) throw new TypeError('Failed to fetch');
    const path = url.replace('/api', '');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    s.calls.push(`${opts.method} ${path}`);
    const reply = (status, data) => ({ status, json: async () => data });
    if (path === '/me/catches') { s.catches.set(body.id, body); return reply(201, { ok: true }); }
    if (path === '/me/save') {
      if (s.saveStatus === 409 || body.baseVersion !== s.version) { s.saveStatus = null; return reply(409, { save: s.save, version: s.version }); }
      s.save = body.save;
      s.version++;
      return reply(200, { version: s.version });
    }
    if (path === '/me') return reply(200, { user: { username: 'nelius' }, save: s.save, version: s.version });
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
  for (let i = 0; i < 5; i++) cloud.queueSave({ ...base, credits: i });
  await t.run();
  await cloud.flush();
  assert.deepEqual(srv.calls, ['PUT /me/save']);
  assert.equal(srv.save.credits, 4);
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
  cloud.queueSave({ ...base, credits: 77 });
  await cloud.flush();
  assert.equal(cloud.status(), 'offline');
  // "Reload the page", then the connection comes back.
  cloud = createCloud({ fetchImpl: srv.fetch, storage, setTimer: t.set, clearTimer: t.clear });
  srv.online = true;
  await cloud.flush();
  assert.ok(srv.catches.has(c.id));
  assert.equal(srv.save.credits, 77);
  assert.equal(cloud.status(), 'synced');
  console.log('PASS: offline saves and catches survive a reload and sync later');
}

{
  // Another device saved first: merge (server wins, gear from both kept) and resend.
  const srv = fakeServer();
  srv.save = { ...base, credits: 500, ownedRodIds: ['rod-starter', 'rod-carp'] };
  srv.saveStatus = 409;
  let replaced = null;
  const t = manualTimers();
  const cloud = createCloud({ fetchImpl: srv.fetch, storage: loggedIn(), setTimer: t.set, clearTimer: t.clear, onSaveReplaced: (s) => { replaced = s; } });
  cloud.queueSave({ ...base, credits: 20, ownedRodIds: ['rod-starter', 'rod-fly'] });
  await cloud.flush();
  assert.ok(replaced, 'the game is handed the merged save');
  assert.equal(replaced.credits, 500);
  assert.deepEqual(replaced.ownedRodIds.sort(), ['rod-carp', 'rod-fly', 'rod-starter']);
  assert.deepEqual(srv.save.ownedRodIds.sort(), ['rod-carp', 'rod-fly', 'rod-starter'], 'merged save sent back');
  assert.deepEqual(mergeOnConflict({ ownedLureIds: ['a'] }, { ownedLureIds: ['b'], credits: 1 }).ownedLureIds, ['b', 'a']);
  console.log('PASS: a clash between devices merges and keeps all gear');
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
