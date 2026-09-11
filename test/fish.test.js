import assert from 'node:assert';
import { FISH_SPECIES, rollForBite, randomWeightFor } from '../src/fish.js';

{
  assert.strictEqual(FISH_SPECIES.length, 3);
  const ids = FISH_SPECIES.map(f => f.id).sort();
  assert.deepStrictEqual(ids, ['bass', 'carp', 'tilapia']);
  console.log('PASS: exactly 3 species defined (tilapia, carp, bass)');
}

{
  const tilapia = FISH_SPECIES.find(f => f.id === 'tilapia');
  for (let i = 0; i < 200; i++) {
    const w = randomWeightFor(tilapia);
    assert.ok(w >= tilapia.minWeightKg && w <= tilapia.maxWeightKg, `weight ${w} out of bounds`);
  }
  console.log('PASS: randomWeightFor stays within species min/max');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const goodLure = bass.preferredLureIds[0];
  const badLure = 'wrong-lure-id';
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;

  let goodBites = 0, badBites = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: goodLure, deltaSeconds: 1 })) goodBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: badLure, deltaSeconds: 1 })) badBites++;
  }
  assert.ok(goodBites > badBites * 2, `expected goodBites (${goodBites}) to clearly exceed badBites (${badBites})`);
  console.log(`PASS: matching lure bites more often (good=${goodBites}, bad=${badBites})`);
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const farOutTemp = bass.tempRangeC[1] + 20;
  let bites = 0;
  for (let i = 0; i < 500; i++) {
    if (rollForBite({ species: bass, waterTempC: farOutTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) bites++;
  }
  assert.strictEqual(bites, 0, `expected 0 bites far outside temp range, got ${bites}`);
  console.log('PASS: no bites when water temp is far outside species range');
}

console.log('All fish tests passed.');
