import assert from 'node:assert';
import { RODS, LINES, LURES, getGearById } from '../src/gear.js';
import { FISH_SPECIES } from '../src/fish.js';

{
  assert.strictEqual(RODS.length, 3);
  assert.strictEqual(LINES.length, 3);
  console.log('PASS: exactly 3 rod tiers and 3 line tiers');
}

{
  const sortedRods = [...RODS].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedRods.length; i++) {
    assert.ok(sortedRods[i].cost > sortedRods[i - 1].cost, 'rod cost should increase with tier');
    assert.ok(sortedRods[i].castDistance >= sortedRods[i - 1].castDistance, 'cast distance should not decrease with tier');
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

console.log('All gear tests passed.');
