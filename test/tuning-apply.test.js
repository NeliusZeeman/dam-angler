import assert from 'node:assert';
import { TUNABLES, tunable, validateValue, crossCheck, GROUPS } from '../src/tuning/registry.js';
import { applyTuning, resetTuning } from '../src/tuning/apply.js';
import { FISH_SPECIES, suitability } from '../src/fish.js';
import { RODS, LINES, REELS, HOOKS, LURES } from '../src/gear.js';
import { LOCATIONS } from '../src/locations.js';
import { FIGHT_STYLES } from '../src/fightMotion.js';
import { ENGINE } from '../src/tuning/engine.js';

const snapshot = () => JSON.stringify({ FISH_SPECIES, RODS, LINES, REELS, HOOKS, LURES, FIGHT_STYLES, ENGINE, shares: LOCATIONS.map((l) => [l.id, l.catchShare, l.tempOffset]) });

{
  // Every fish, every item of tackle and every spot can be tuned; every
  // entry has a hint and sensible limits.
  for (const s of FISH_SPECIES) assert.ok(tunable(`fish.${s.id}.maxWeightKg`), s.id);
  for (const [kind, list] of Object.entries({ rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES })) {
    for (const g of list) assert.ok(tunable(`gear.${kind}.${g.id}.cost`) && tunable(`gear.${kind}.${g.id}.inShop`), g.id);
  }
  for (const l of LOCATIONS) assert.ok(tunable(`spot.${l.id}.tempOffset`), l.id);
  for (const t of TUNABLES) {
    assert.ok(t.hint && t.hint.length > 15, `${t.key} has a hint`);
    assert.ok(GROUPS.includes(t.group), `${t.key} group`);
    if (t.type !== 'boolean') assert.ok(t.min < t.max, `${t.key} range`);
    assert.doesNotThrow(() => validateValue(t.key, t.defaultValue), `${t.key}: its built-in value ${JSON.stringify(t.defaultValue)} is within its own limits`);
  }
  assert.equal(new Set(TUNABLES.map((t) => t.key)).size, TUNABLES.length, 'keys are unique');
  console.log(`PASS: ${TUNABLES.length} tunable values, each with a hint and limits that fit its built-in value`);
}

{
  // Applying nothing leaves the game exactly as built.
  const before = snapshot();
  applyTuning({});
  assert.equal(snapshot(), before);
  console.log('PASS: no tuning = the game exactly as built');
}

{
  const before = snapshot();
  const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');
  const rod = RODS.find((r) => r.id === 'rod-carp');
  const line = LINES.find((l) => l.id === 'line-starter');
  applyTuning({
    'fish.common-carp.maxWeightKg': 25, 'fish.common-carp.tempMinC': 5, 'fish.common-carp.activity': [1, 1, 1, 1, 1, 1, 1],
    'fish.common-carp.lure.mielies': 2.5, 'fish.common-carp.fight.stamina': 4,
    'gear.rod.rod-carp.castSpeed': 40, 'gear.line.line-starter.breakKg': 9, 'gear.lure.worm.inShop': false,
    'spot.jozini.share.tigerfish': 90, 'engine.fight.snapAt': 0.95, 'engine.money.chumCost': 30,
    'not.a.real.key': 5,
  });
  assert.equal(carp.maxWeightKg, 25);
  assert.equal(carp.tempRangeC[0], 5);
  assert.deepEqual(carp.activeTimes.length, 7, 'feeding all day now shows in the tips');
  assert.equal(carp.lureAffinity.mielies, 2.5);
  assert.ok(suitability(carp, { waterTempC: 6, equippedLureId: 'mielies' }) > 0, 'bites in colder water now');
  assert.equal(FIGHT_STYLES['common-carp'].stamina, 4);
  assert.equal(rod.castSpeed, 40);
  assert.equal(line.breakKg, 9);
  assert.equal(line.breakStrength, 2, 'derived values follow');
  assert.equal(LURES.find((l) => l.id === 'worm').inShop, false);
  const joz = LOCATIONS.find((l) => l.id === 'jozini').catchShare;
  assert.ok(Math.abs(Object.values(joz).reduce((a, b) => a + b, 0) - 100) < 0.5, 'spot shares add up to 100% again');
  assert.ok(joz.tigerfish > 50);
  assert.equal(ENGINE.fight.snapAt, 0.95);
  assert.equal(ENGINE.money.chumCost, 30);
  // A second, different set replaces the first completely.
  applyTuning({ 'gear.rod.rod-carp.castSpeed': 36 });
  assert.equal(carp.maxWeightKg, FISH_SPECIES.find((f) => f.id === 'common-carp').maxWeightKg);
  assert.equal(rod.castSpeed, 36);
  resetTuning();
  assert.equal(snapshot(), before, 'reset puts everything back');
  console.log('PASS: tuning changes the live game, re-balances spots, and resets cleanly');
}

{
  assert.throws(() => validateValue('fish.mozambique-tilapia.maxWeightKg', 5000), /must be from/);
  assert.throws(() => validateValue('fish.common-carp.activity', [1, 2]), /7 numbers/);
  assert.throws(() => validateValue('gear.rod.rod-carp.cost', 10.5), /whole number/);
  assert.throws(() => validateValue('gear.rod.rod-carp.inShop', 'yes'), /on or off/);
  assert.throws(() => validateValue('nope.nope', 1), /Unknown setting/);
  assert.throws(() => validateValue('fish.common-carp.maxWeightKg', '12'), /must be from/, 'text isn\'t a number');
  assert.deepEqual(crossCheck({ 'fish.common-carp.minWeightKg': 30 }), ['Common Carp: the smallest weight must be below the biggest.']);
  assert.deepEqual(crossCheck({}), []);
  console.log('PASS: bad values are refused with a sentence');
}
