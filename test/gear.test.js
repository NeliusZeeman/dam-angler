import assert from 'node:assert';
import { RODS, LINES, REELS, HOOKS, LURES, getGearById } from '../src/gear.js';
import { FISH_SPECIES } from '../src/fish.js';

{
  assert.strictEqual(RODS.length, 5);
  assert.strictEqual(LINES.length, 3);
  console.log('PASS: five rods (across 3 tiers) and 3 line tiers');
}

{
  const ACTIONS = ['fast', 'moderate', 'through'];
  for (const rod of RODS) {
    assert.ok(ACTIONS.includes(rod.action), `${rod.id} has a real rod action`);
    assert.ok(rod.flex.length > 0 && rod.flex.length <= 1.45, `${rod.id} flex length within the blank`);
    assert.ok(rod.flex.softness > 0, `${rod.id} has a softness`);
  }
  const byId = (id) => getGearById(RODS, id);
  // Action = where it bends: fast rods bend only in the tip, through-action
  // carp rods all the way down, moderate bass rods in between.
  assert.ok(byId('rod-spinning').flex.length < byId('rod-bass').flex.length);
  assert.ok(byId('rod-bass').flex.length < byId('rod-carp').flex.length);
  // A moderate bass crankbait rod bows more and cushions lunges better than
  // a fast spinning rod; the heavy barbel/tiger rod is the stiffest of all.
  assert.ok(byId('rod-bass').flex.softness > byId('rod-spinning').flex.softness);
  assert.ok(byId('rod-bass').shockAbsorb > byId('rod-spinning').shockAbsorb);
  assert.ok(RODS.every((r) => r.flex.softness >= byId('rod-heavy').flex.softness));
  // Casting: the 12ft carp rod throws furthest, the fibreglass starter least;
  // the bass rod gives up a little distance for the tightest accuracy.
  assert.ok(RODS.every((r) => r.castSpeed <= byId('rod-carp').castSpeed));
  assert.ok(RODS.every((r) => r.castSpeed >= byId('rod-starter').castSpeed));
  assert.ok(RODS.every((r) => r.spread >= byId('rod-bass').spread));
  console.log('PASS: rod action/power match real freshwater rods');
}

{
  const sortedRods = [...RODS].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedRods.length; i++) {
    assert.ok(sortedRods[i].cost > sortedRods[i - 1].cost, 'rod cost should increase with tier');
    assert.ok(sortedRods[i].tensionTolerance >= sortedRods[i - 1].tensionTolerance, 'tension tolerance should not decrease with tier');
  }
  const sortedLines = [...LINES].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedLines.length; i++) {
    assert.ok(sortedLines[i].cost > sortedLines[i - 1].cost, 'line cost should increase with tier');
    assert.ok(sortedLines[i].breakStrength >= sortedLines[i - 1].breakStrength, 'break strength should not decrease with tier');
  }
  console.log('PASS: higher tiers cost more and have equal-or-better stats');
}

{
  const lureIds = new Set(LURES.map(l => l.id));
  for (const species of FISH_SPECIES) {
    for (const lureId of species.preferredLureIds) {
      assert.ok(lureIds.has(lureId), `lure "${lureId}" referenced by ${species.id} is missing from LURES`);
    }
  }
  console.log('PASS: all species-preferred lures exist in LURES');
}

{
  const found = getGearById(RODS, RODS[1].id);
  assert.strictEqual(found, RODS[1]);
  assert.strictEqual(getGearById(RODS, 'nonexistent'), undefined);
  console.log('PASS: getGearById finds by id and returns undefined when missing');
}

{
  assert.ok(HOOKS.length >= 4, 'expected at least 4 hook/rig options');
  const starter = HOOKS.find((h) => h.cost === 0);
  assert.ok(starter, 'expected a free starter hook');
  console.log('PASS: hooks/rigs are defined with a free starter option');
}

{
  const wireTrace = HOOKS.find((h) => h.isWireTrace);
  assert.ok(wireTrace, 'expected a wire trace rig among HOOKS');
  const tigerfish = FISH_SPECIES.find((f) => f.id === 'tigerfish');
  assert.ok(tigerfish && tigerfish.requiresWireTrace, 'tigerfish must be flagged as requiring a wire trace');
  console.log('PASS: a wire trace rig exists and tigerfish requires it');
}

{
  // Every non-starter hook must have a non-negative tensionBonus and a
  // well-formed speciesBonus map (values > 1, keys matching real species).
  const speciesIds = new Set(FISH_SPECIES.map((f) => f.id));
  for (const hook of HOOKS) {
    assert.ok(hook.tensionBonus >= 0, `${hook.id} tensionBonus should be non-negative`);
    for (const [speciesId, bonus] of Object.entries(hook.speciesBonus)) {
      assert.ok(speciesIds.has(speciesId), `${hook.id} speciesBonus references unknown species "${speciesId}"`);
      assert.ok(bonus > 1, `${hook.id} speciesBonus for ${speciesId} should be a boost (> 1)`);
    }
  }
  console.log('PASS: hook tensionBonus/speciesBonus are well-formed');
}

{
  for (const lure of LURES) {
    assert.ok(lure.kind === 'bait' || lure.kind === 'lure', `${lure.id} must be kind 'bait' or 'lure'`);
  }
  const spinner = LURES.find((l) => l.id === 'spinner');
  assert.strictEqual(spinner.kind, 'lure', 'spinner is a worked lure');
  console.log('PASS: every bait/lure declares a kind; spinner is a worked lure');
}

{
  // Better reels cast further and fight better; braid casts further than
  // the starter line. This is what makes upgrades feel like upgrades.
  assert.strictEqual(REELS.length, 3);
  const sortedReels = [...REELS].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedReels.length; i++) {
    assert.ok(sortedReels[i].cost > sortedReels[i - 1].cost, 'reel cost should increase with tier');
    assert.ok(sortedReels[i].castMultiplier > sortedReels[i - 1].castMultiplier, 'better reels should cast further');
    assert.ok(sortedReels[i].dragBonus >= sortedReels[i - 1].dragBonus, 'drag should not get worse with tier');
  }
  assert.ok(REELS.find((r) => r.cost === 0), 'expected a free starter reel');
  const braid = LINES.find((l) => l.id === 'line-braid');
  const starterLine = LINES.find((l) => l.id === 'line-starter');
  assert.ok(braid.castMultiplier > starterLine.castMultiplier, 'braid should cast further than starter line');
  console.log('PASS: reels and braid extend cast distance by tier');
}

console.log('All gear tests passed.');
