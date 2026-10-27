import assert from 'node:assert';
import { baitDepth, depthMultiplier, slopeAt, onWindwardBank, readSpot, waterMultiplier, describeSpot } from '../src/waterReading.js';
import { LURES, getGearById } from '../src/gear.js';

const lure = (id) => getGearById(LURES, id);

{
  // Float depth: shallower than the water -> mid-water; deeper -> on the bottom.
  assert.deepStrictEqual(baitDepth({ lure: lure('bread-bait'), floatDepthM: 1, waterDepthM: 3 }), { depth: 1, onBottom: false });
  assert.ok(baitDepth({ lure: lure('bread-bait'), floatDepthM: 3.5, waterDepthM: 2.4 }).onBottom, 'float set deeper than the water: bait on the bottom');
  assert.ok(baitDepth({ lure: lure('mieliebom'), waterDepthM: 3 }).onBottom, 'a feeder is always on the bottom');
  assert.strictEqual(baitDepth({ lure: lure('topwater-frog'), waterDepthM: 3 }).depth, 0, 'a frog is on top');
  assert.ok(baitDepth({ lure: lure('bass-jig'), waterDepthM: 4 }).onBottom, 'a jig is on the bottom');
  console.log('PASS: where the bait fishes — float depth, feeders, lures');
}

{
  const onBottom = { depth: 2.4, onBottom: true }, midShallow = { depth: 1, onBottom: false };
  assert.ok(depthMultiplier('common-carp', onBottom) > depthMultiplier('common-carp', midShallow), 'carp feed on the bottom');
  assert.ok(depthMultiplier('mozambique-tilapia', midShallow) > depthMultiplier('mozambique-tilapia', { depth: 4, onBottom: true }), 'kurper feed shallow');
  assert.ok(depthMultiplier('tigerfish', { depth: 0.5, onBottom: false }) > 1, 'tigers near the top');
  console.log('PASS: right depth, more bites');
}

{
  // A shelf: 1 m deep, then the bottom drops to 6 m.
  const depthAt = (x) => (x < 10 ? 1 : x < 14 ? 1 + (x - 10) * 1.25 : 6);
  assert.ok(slopeAt(depthAt, 12, 0) > 0.5, 'the edge of the shelf is a drop-off');
  assert.ok(slopeAt(depthAt, 2, 0) < 0.05, 'the flat is not');
  // Water for x < 20; wind blowing towards +x.
  const isWater = (x) => x < 20;
  assert.ok(onWindwardBank(isWater, 12, 0, 1, 0, 5), 'wind blowing onto the bank 8 m away');
  assert.ok(!onWindwardBank(isWater, 12, 0, -1, 0, 5), 'not when it blows the other way');
  assert.ok(!onWindwardBank(isWater, 12, 0, 1, 0, 0.5), 'not in a calm');
  const dam = { depthAt: (x, z) => depthAt(x, z), isWater, zoneAt: () => ({ type: 'structure', kind: 'weed' }) };
  const spot = readSpot(dam, 12, 0, { windDirX: 1, windDirZ: 0, windSpeed: 5 });
  assert.ok(spot.dropOff && spot.windward && spot.zone === 'weed');
  assert.match(describeSpot(spot), /m deep · weed bed · drop-off · wind blowing in/);
  const bait = { depth: 2, onBottom: false };
  assert.ok(waterMultiplier('largemouth-bass', spot, bait) > waterMultiplier('largemouth-bass', { ...spot, dropOff: false }, bait), 'bass like a drop-off');
  assert.ok(waterMultiplier('common-carp', spot, { depth: 3, onBottom: true }) > waterMultiplier('common-carp', { ...spot, windward: false }, { depth: 3, onBottom: true }), 'carp follow the wind');
  console.log('PASS: drop-offs and the windward bank');
}

console.log('All water reading tests passed.');
