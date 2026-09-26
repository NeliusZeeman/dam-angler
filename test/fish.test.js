import assert from 'node:assert';
import { FISH_SPECIES, rollForBite, randomWeightFor, getHabitatMultiplier, estimateLengthCm, activityAt } from '../src/fish.js';

{
  // Real-world sanity checks: a 2kg carp is ~48cm, a 10kg barbel ~1.1m.
  const byId = (id) => FISH_SPECIES.find((s) => s.id === id);
  const carp = estimateLengthCm(byId('common-carp'), 2);
  const barbel = estimateLengthCm(byId('catfish'), 10);
  assert.ok(carp > 44 && carp < 54, `2kg carp length ${carp.toFixed(1)}cm`);
  assert.ok(barbel > 100 && barbel < 125, `10kg barbel length ${barbel.toFixed(1)}cm`);
  assert.ok(estimateLengthCm(byId('tigerfish'), 4) > estimateLengthCm(byId('tigerfish'), 2), 'heavier is longer');
  console.log('PASS: catch lengths estimated from weight are realistic');
}

{
  assert.strictEqual(FISH_SPECIES.length, 11);
  const ids = FISH_SPECIES.map(f => f.id).sort();
  assert.deepStrictEqual(ids, [
    'banded-tilapia', 'catfish', 'common-carp', 'largemouth-bass',
    'largescale-yellowfish', 'mirror-carp', 'mozambique-tilapia', 'mudfish', 'smallmouth-bass',
    'smallmouth-yellowfish', 'tigerfish',
  ]);
  console.log('PASS: exactly 11 species defined, including real SA sub-species');
}

{
  const tilapia = FISH_SPECIES.find(f => f.id === 'mozambique-tilapia');
  for (let i = 0; i < 200; i++) {
    const w = randomWeightFor(tilapia);
    assert.ok(w >= tilapia.minWeightKg && w <= tilapia.maxWeightKg, `weight ${w} out of bounds`);
  }
  console.log('PASS: randomWeightFor stays within species min/max');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const goodLure = bass.preferredLureIds[0];
  const badLure = 'wrong-lure-id';
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;

  let goodBites = 0, badBites = 0;
  const trials = 40000; // bites are ~0.4%/s -- 4000 trials was flaky (~1 run in 40)
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: goodLure, deltaSeconds: 1 })) goodBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: badLure, deltaSeconds: 1 })) badBites++;
  }
  assert.ok(goodBites > badBites * 2, `expected goodBites (${goodBites}) to clearly exceed badBites (${badBites})`);
  console.log(`PASS: matching lure bites more often (good=${goodBites}, bad=${badBites})`);
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const farOutTemp = bass.tempRangeC[1] + 20;
  let bites = 0;
  for (let i = 0; i < 500; i++) {
    if (rollForBite({ species: bass, waterTempC: farOutTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) bites++;
  }
  assert.strictEqual(bites, 0, `expected 0 bites far outside temp range, got ${bites}`);
  console.log('PASS: no bites when water temp is far outside species range');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let normalBites = 0, boostedBites = 0;
  const trials = 40000; // bites are ~0.4%/s -- 4000 trials was flaky (~1 run in 40)
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) normalBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, biteChanceMultiplier: 2 })) boostedBites++;
  }
  assert.ok(boostedBites > normalBites, `expected boosted bites (${boostedBites}) to exceed normal bites (${normalBites})`);
  console.log(`PASS: biteChanceMultiplier increases bite rate (normal=${normalBites}, boosted=${boostedBites})`);
}

{
  for (const species of FISH_SPECIES) {
    assert.ok(Array.isArray(species.activeTimes) && species.activeTimes.length > 0, `${species.id} must declare activeTimes`);
    assert.ok(['common', 'uncommon', 'rare'].includes(species.rarity), `${species.id} must declare a valid rarity`);
  }
  console.log('PASS: every species declares activeTimes and a valid rarity tier');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let onTimeBites = 0, offTimeBites = 0;
  const trials = 40000; // bites are ~0.4%/s -- 4000 trials was flaky (~1 run in 40)
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, timeOfDay: 'sunset' })) onTimeBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1, timeOfDay: 'midday' })) offTimeBites++;
  }
  assert.ok(onTimeBites > offTimeBites, `expected bass to bite more at sunset (${onTimeBites}) than at midday (${offTimeBites})`);
  console.log(`PASS: bass bites more during its active time (sunset=${onTimeBites}, midday=${offTimeBites})`);
}

{
  // Omitting timeOfDay entirely (timeOfDay: null) must not gate bites.
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;
  let bites = 0;
  // ~0.4% a second, so give it long enough that zero bites is vanishingly rare.
  for (let i = 0; i < 5000; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) bites++;
  }
  assert.ok(bites > 0, 'expected some bites when timeOfDay is omitted');
  console.log('PASS: omitting timeOfDay does not gate bites');
}

{
  // Rarity ordering: common species should be much more aggressive (bite
  // more readily) than rare species -- "bigger fish rare, cheap fish easy".
  const tilapia = FISH_SPECIES.find(f => f.id === 'mozambique-tilapia');
  const catfish = FISH_SPECIES.find(f => f.id === 'catfish');
  const tigerfish = FISH_SPECIES.find(f => f.id === 'tigerfish');
  assert.ok(tilapia.aggressiveness > catfish.aggressiveness, 'common tilapia should bite more readily than rare catfish');
  assert.ok(tilapia.aggressiveness > tigerfish.aggressiveness, 'common tilapia should bite more readily than rare tigerfish');
  assert.ok(tigerfish.baseValuePerKg > tilapia.baseValuePerKg, 'rare tigerfish should be worth more per kg than common tilapia');
  assert.ok(catfish.baseValuePerKg > tilapia.baseValuePerKg, 'rare catfish should be worth more per kg than common tilapia');
  console.log('PASS: rare species bite less often and pay more than common species');
}

{
  // Every species declares a bite-feel profile used to drive the line/reel
  // physics; tigerfish must additionally require a wire trace.
  for (const species of FISH_SPECIES) {
    assert.ok(species.bite && species.bite.speed && species.bite.style && species.bite.label,
      `${species.id} must declare a complete bite profile`);
  }
  const tigerfish = FISH_SPECIES.find(f => f.id === 'tigerfish');
  assert.strictEqual(tigerfish.requiresWireTrace, true);
  console.log('PASS: every species declares a bite profile; tigerfish requires a wire trace');
}

{
  // Every species declares a habitat preference; bass/tigerfish/smallmouth
  // want structure, catfish/mirror carp want deep water, tilapia want shallow.
  const bass = FISH_SPECIES.find((f) => f.id === 'largemouth-bass');
  const tilapia = FISH_SPECIES.find((f) => f.id === 'mozambique-tilapia');
  const catfish = FISH_SPECIES.find((f) => f.id === 'catfish');

  const bassInCoverWithLure = getHabitatMultiplier(bass, { zone: 'structure', depthFactor: 0.5, lureKind: 'lure' });
  const bassInOpenWater = getHabitatMultiplier(bass, { zone: 'open', depthFactor: 0.5, lureKind: 'lure' });
  assert.ok(bassInCoverWithLure > bassInOpenWater, 'a bass should favour a spinner worked through cover over open water');

  const bassInCoverWithBait = getHabitatMultiplier(bass, { zone: 'structure', depthFactor: 0.5, lureKind: 'bait' });
  assert.ok(bassInCoverWithLure > bassInCoverWithBait, 'a worked lure in cover should beat bait in the same cover for a structure fish');

  const tilapiaShallow = getHabitatMultiplier(tilapia, { zone: 'open', depthFactor: 0.1, lureKind: 'bait' });
  const tilapiaDeep = getHabitatMultiplier(tilapia, { zone: 'open', depthFactor: 0.9, lureKind: 'bait' });
  assert.ok(tilapiaShallow > tilapiaDeep, 'tilapia should favour the shallows near the bank');

  const catfishDeep = getHabitatMultiplier(catfish, { zone: 'open', depthFactor: 0.9, lureKind: 'bait' });
  const catfishShallow = getHabitatMultiplier(catfish, { zone: 'open', depthFactor: 0.1, lureKind: 'bait' });
  assert.ok(catfishDeep > catfishShallow, 'catfish should favour deep water over the shallows');

  const noPreference = getHabitatMultiplier({ habitat: {} }, { zone: 'structure', depthFactor: 0.9, lureKind: 'lure' });
  assert.strictEqual(noPreference, 1, 'a species with no habitat preference should be unaffected by position');

  console.log('PASS: habitat multiplier rewards spinners-in-cover for bass, shallows for tilapia, depth for catfish');
}

{
  // Daily feeding rhythms match the research on each fish.
  const a = (id, t) => activityAt(FISH_SPECIES.find((s) => s.id === id), t);
  for (const s of FISH_SPECIES) {
    assert.strictEqual(s.activity.length, 7, `${s.id} needs one activity value per time of day`);
    assert.ok(s.activity.every((v) => v >= 0 && v <= 1), `${s.id} activity must be 0..1`);
  }
  // Carp: dawn/dusk peaks, strong at night, slowest in the midday heat.
  assert.ok(a('common-carp', 'morning') > a('common-carp', 'midday') * 2, 'carp: dawn beats midday');
  assert.ok(a('common-carp', 'night') > a('common-carp', 'midday'), 'carp feed at night');
  // Barbel: nocturnal, but not completely off by day.
  assert.ok(a('catfish', 'night') > a('catfish', 'midday') * 4, 'barbel: night feeders');
  assert.ok(a('catfish', 'midday') > 0, 'barbel still feed a little by day');
  // Bass (both): crepuscular -- dawn and dusk beat midday.
  for (const id of ['largemouth-bass', 'smallmouth-bass']) {
    assert.ok(a(id, 'morning') > a(id, 'midday') * 2 && a(id, 'sunset') > a(id, 'midday') * 2, `${id}: low-light feeder`);
  }
  // Day feeders: kurper, yellowfish, tigerfish all switch off at night.
  for (const id of ['mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish', 'tigerfish']) {
    assert.ok(a(id, 'afternoon') > a(id, 'night') * 3, `${id}: daytime feeder`);
  }
  // Unknown time of day never blocks a bite.
  assert.strictEqual(a('catfish', null), 1);
  console.log('PASS: every fish feeds on its real daily rhythm');
}

console.log('All fish tests passed.');
