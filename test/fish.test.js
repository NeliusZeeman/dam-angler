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

{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let normalBites = 0, boostedBites = 0;
  const trials = 3000;
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) normalBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, biteChanceMultiplier: 2 })) boostedBites++;
  }
  assert.ok(boostedBites > normalBites, `expected boosted bites (${boostedBites}) to exceed normal bites (${normalBites})`);
  console.log(`PASS: biteChanceMultiplier increases bite rate (normal=${normalBites}, boosted=${boostedBites})`);
}

{
  // Every species declares at least one preferred time, and sunset/twilight
  // together must cover every species (the two "golden hour" bite windows).
  for (const species of FISH_SPECIES) {
    assert.ok(Array.isArray(species.activeTimes) && species.activeTimes.length > 0, `${species.id} must declare activeTimes`);
  }
  const coversGoldenHour = FISH_SPECIES.every((s) => s.activeTimes.includes('sunset') || s.activeTimes.includes('twilight'));
  assert.ok(coversGoldenHour, 'every species should be active during sunset and/or twilight');
  console.log('PASS: every species declares activeTimes and is covered by sunset/twilight');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let onTimeBites = 0, offTimeBites = 0;
  const trials = 3000;
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, timeOfDay: 'twilight' })) onTimeBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, timeOfDay: 'day' })) offTimeBites++;
  }
  assert.ok(onTimeBites > offTimeBites, `expected bass to bite more at twilight (${onTimeBites}) than during the day (${offTimeBites})`);
  console.log(`PASS: bass (a twilight species) bites more during its active time (twilight=${onTimeBites}, day=${offTimeBites})`);
}

{
  // Omitting timeOfDay entirely (timeOfDay: null) must not gate bites — keeps
  // rollForBite backward compatible for callers that don't track time.
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let bites = 0;
  for (let i = 0; i < 500; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) bites++;
  }
  assert.ok(bites > 0, 'expected some bites when timeOfDay is omitted');
  console.log('PASS: omitting timeOfDay does not gate bites');
}

console.log('All fish tests passed.');
