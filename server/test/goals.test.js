import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newTestDb } from './helpers.js';
import { createUser } from '../auth.js';
import { createPlayer, recordCatch, creditsOf } from '../saves.js';
import { challengeState, claimChallenge, competitionState } from '../goals.js';
import { challengesFor, competitionsFor, compPrizes } from '../../src/goals.js';

let db;
before(async () => { db = await newTestDb(); });
after(async () => { await db.end(); });

let n = 0;
async function angler() {
  n++;
  const u = await createUser(db, { email: `g${n}@e.co`, username: `goal${n}`, password: 'password1' });
  await createPlayer(db, u.id);
  return u.id;
}
const fish = (userId, c) => recordCatch(db, userId, { id: randomUUID(), ...c });

test('a daily challenge is paid once, only when the server has the catches', async () => {
  const now = Date.parse('2026-10-27T12:00:00+02:00');
  const ch = challengesFor(now).find((c) => c.id === 'd:2026-10-27:1'); // "Land 2 fish mid-morning"
  assert.equal(ch.match.timeOfDay, 'midMorning');
  const me = await angler();
  const morning = { speciesId: 'catfish', locationId: 'jozini', weightKg: 4, timeOfDay: 'midMorning', caughtAt: '2026-10-27T09:00:00+02:00' };
  await fish(me, morning);
  await assert.rejects(claimChallenge(db, me, ch.id, now), /Not done yet/);
  await fish(me, { ...morning, timeOfDay: 'midday' }); // doesn't count
  await assert.rejects(claimChallenge(db, me, ch.id, now), /Not done yet/);
  await fish(me, morning);
  const state = (await challengeState(db, me, now)).find((c) => c.id === ch.id);
  assert.equal(state.progress, 2);
  const before = await creditsOf(db, me);
  const paid = await claimChallenge(db, me, ch.id, now);
  assert.equal(paid.reward, ch.reward);
  assert.equal(paid.credits, before + ch.reward);
  const again = await claimChallenge(db, me, ch.id, now);
  assert.equal(again.reward, 0, 'claiming twice pays nothing');
  assert.equal(await creditsOf(db, me), before + ch.reward);
  await assert.rejects(claimChallenge(db, me, 'd:2026-10-20:0', now), /ended/);
});

test('monthly competition: top 3 paid once when the month is over; the leaderboard shows your place', async () => {
  const comp = competitionsFor('2026-09')[0];
  assert.equal(comp.speciesId, 'largemouth-bass');
  const players = [await angler(), await angler(), await angler(), await angler()];
  const weights = [2.1, 3.4, 1.2, 2.9];
  for (let i = 0; i < 4; i++) {
    await fish(players[i], { speciesId: 'largemouth-bass', locationId: 'hartbeespoort', weightKg: weights[i], caughtAt: '2026-09-15T10:00:00+02:00' });
  }
  // A bass caught in October doesn't count for September.
  await fish(players[2], { speciesId: 'largemouth-bass', locationId: 'hartbeespoort', weightKg: 4.4, caughtAt: '2026-10-02T10:00:00+02:00' });
  const before = await Promise.all(players.map((p) => creditsOf(db, p)));
  const state = await competitionState(db, players[0], Date.parse('2026-10-15T12:00:00+02:00'));
  const last = state.last.find((c) => c.id === comp.id);
  assert.deepEqual(last.winners.map((w) => w.weightKg), [3.4, 2.9, 2.1]);
  const prizes = compPrizes();
  const after1 = await Promise.all(players.map((p) => creditsOf(db, p)));
  assert.equal(after1[1] - before[1], prizes[0], '1st paid');
  assert.equal(after1[3] - before[3], prizes[1], '2nd paid');
  assert.equal(after1[0] - before[0], prizes[2], '3rd paid');
  assert.equal(after1[2] - before[2], 0, '4th gets nothing');
  await competitionState(db, players[1], Date.parse('2026-10-16T12:00:00+02:00'));
  const after2 = await Promise.all(players.map((p) => creditsOf(db, p)));
  assert.deepEqual(after2, after1, 'prizes are paid once');
  // October: player 3's 4.4 kg leads, and the winner of September shows a trophy.
  const oct = state.current.find((c) => c.speciesId === 'largemouth-bass');
  if (oct) {
    assert.equal(oct.top[0].weightKg, 4.4);
    assert.equal(oct.me, null, 'no October bass for player 1 yet');
  }
});
