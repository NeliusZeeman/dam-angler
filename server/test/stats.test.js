import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb, startTestServer } from './helpers.js';

let db, srv;
before(async () => {
  db = await newTestDb();
  srv = await startTestServer(db);
  const catchFor = async (username, catches) => {
    const c = srv.client();
    await c.post('/api/auth/signup', { email: `${username}@secret.co.za`, username, password: 'password1', agree: true });
    for (const k of catches) {
      await c.post('/api/me/catches', { id: randomUUID(), locationId: 'hartbeespoort', payout: 10, caughtAt: new Date().toISOString(), ...k });
    }
  };
  await catchFor('sipho', [{ speciesId: 'common-carp', weightKg: 8.4 }, { speciesId: 'mozambique-tilapia', weightKg: 1.1 }]);
  await catchFor('annemarie', [{ speciesId: 'common-carp', weightKg: 12.2 }, { speciesId: 'catfish', weightKg: 9, locationId: 'jozini' }]);
});
after(async () => { await srv.close(); await db.end(); });

test('every dam: total fish and the record holder by username', async () => {
  const r = await srv.client().get('/api/dams/stats');
  assert.equal(r.status, 200);
  const h = r.body.dams.hartbeespoort;
  assert.equal(h.total, 3);
  assert.equal(h.record.username, 'annemarie');
  assert.equal(h.record.speciesId, 'common-carp');
  assert.equal(h.record.weightKg, 12.2);
  assert.equal(r.body.dams.jozini.total, 1);
});

test('one dam: counts and bests per species', async () => {
  const r = await srv.client().get('/api/dams/hartbeespoort/stats');
  assert.equal(r.body.total, 3);
  const carp = r.body.species.find((s) => s.speciesId === 'common-carp');
  assert.deepEqual(carp, { speciesId: 'common-carp', count: 2, bestKg: 12.2 });
});

test('dam stats never show anyone\'s email', async () => {
  const all = JSON.stringify((await srv.client().get('/api/dams/stats')).body);
  const one = JSON.stringify((await srv.client().get('/api/dams/hartbeespoort/stats')).body);
  assert.ok(!all.includes('secret.co.za') && !one.includes('secret.co.za'));
});

test('a spot with no catches yet, and an unknown spot', async () => {
  const quiet = await srv.client().get('/api/dams/vaal/stats');
  assert.deepEqual({ total: quiet.body.total, record: quiet.body.record }, { total: 0, record: null });
  assert.equal((await srv.client().get('/api/dams/atlantis/stats')).status, 404);
});
