import assert from 'node:assert';
import { challengesFor, progressOf, matches, dayKey, weekKey, monthKey, periodOf, competitionsFor } from '../src/goals.js';

{
  // SA time: 23:30 UTC on the 27th is already the 28th in SA.
  assert.strictEqual(dayKey(Date.parse('2026-10-27T23:30:00Z')), '2026-10-28');
  assert.strictEqual(weekKey(Date.parse('2026-10-27T10:00:00Z')), '2026-10-26', 'weeks start on Monday');
  assert.strictEqual(monthKey(Date.parse('2026-10-31T22:30:00Z')), '2026-11');
  const [s, e] = periodOf('day', '2026-10-27');
  assert.strictEqual(new Date(s).toISOString(), '2026-10-26T22:00:00.000Z');
  assert.strictEqual(e - s, 86_400_000);
  console.log('PASS: days, weeks and months run on South African time');
}

{
  const a = challengesFor(Date.parse('2026-10-27T08:00:00Z'));
  const b = challengesFor(Date.parse('2026-10-27T20:00:00Z'));
  assert.deepStrictEqual(a, b, 'the same challenges all day, for everyone');
  assert.strictEqual(a.filter((c) => c.kind === 'daily').length, 3);
  assert.strictEqual(a.filter((c) => c.kind === 'weekly').length, 1);
  assert.notDeepStrictEqual(challengesFor(Date.parse('2026-10-28T08:00:00Z')).slice(0, 3), a.slice(0, 3), 'new ones tomorrow');
  for (const c of a) assert.ok(c.need >= 1 && c.reward > 0 && !/\blb\b|\bft\b/.test(c.text), c.text);
  console.log(`PASS: today — ${a.map((c) => c.text).join(' | ')}`);
}

{
  const ch = { kind: 'daily', period: '2026-10-27', need: 2, match: { species: 'common-carp', minKg: 3, released: true } };
  const at = '2026-10-27T09:00:00+02:00';
  const catches = [
    { speciesId: 'common-carp', weightKg: 4, kept: false, caughtAt: at },
    { speciesId: 'common-carp', weightKg: 4, kept: true, caughtAt: at }, // kept: doesn't count
    { speciesId: 'common-carp', weightKg: 2, kept: false, caughtAt: at }, // too small
    { speciesId: 'common-carp', weightKg: 5, kept: false, caughtAt: '2026-10-26T09:00:00+02:00' }, // yesterday
  ];
  assert.strictEqual(progressOf(ch, catches), 1);
  assert.strictEqual(progressOf(ch, [...catches, { speciesId: 'common-carp', weightKg: 3.5, kept: false, caughtAt: at }]), 2);
  const distinct = { kind: 'daily', period: '2026-10-27', need: 3, match: { distinct: true } };
  assert.strictEqual(progressOf(distinct, [catches[0], catches[1], { speciesId: 'bluegill', caughtAt: at }]), 2);
  assert.ok(!matches({ timeOfDay: 'sunset' }, { timeOfDay: 'night' }));
  console.log('PASS: challenge progress counts only the right fish, in the right period');
}

{
  const c = competitionsFor('2026-10');
  assert.strictEqual(c.length, 2);
  assert.deepStrictEqual(competitionsFor('2026-10'), c, 'same competitions for everyone');
  assert.notStrictEqual(c[0].speciesId, c[1].speciesId);
  console.log(`PASS: this month — ${c.map((x) => x.title).join(' | ')}`);
}

console.log('All goals tests passed.');
