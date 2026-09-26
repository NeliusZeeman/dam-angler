import assert from 'node:assert';
import { LOCATIONS, getLocationById } from '../src/locations.js';
import { FISH_SPECIES, pickGuaranteedBite, rollDamBite } from '../src/fish.js';
import { createDam } from '../src/dam.js';

{
  assert.strictEqual(LOCATIONS.length, 6);
  console.log('PASS: six locations defined');
}

{
  const validIds = new Set(FISH_SPECIES.map((s) => s.id));
  for (const loc of LOCATIONS) {
    assert.ok(Array.isArray(loc.speciesIds) && loc.speciesIds.length > 0, `${loc.id} must list speciesIds`);
    for (const id of loc.speciesIds) {
      assert.ok(validIds.has(id), `${loc.id} references unknown species "${id}"`);
    }
  }
  console.log('PASS: every location lists only real species ids');
}

{
  // No two locations should offer an identical species mix -- that would
  // defeat the point of picking a place to fish.
  for (let i = 0; i < LOCATIONS.length; i++) {
    for (let j = i + 1; j < LOCATIONS.length; j++) {
      const a = new Set(LOCATIONS[i].speciesIds);
      const b = new Set(LOCATIONS[j].speciesIds);
      const same = a.size === b.size && [...a].every((id) => b.has(id));
      assert.ok(!same, `${LOCATIONS[i].id} and ${LOCATIONS[j].id} should not have identical species mixes`);
    }
  }
  console.log('PASS: every location has a distinct species mix');
}

{
  // Tigerfish (the signature Jozini fish) should only be available there.
  const withTigerfish = LOCATIONS.filter((loc) => loc.speciesIds.includes('tigerfish'));
  assert.deepStrictEqual(withTigerfish.map((l) => l.id), ['jozini']);
  console.log('PASS: tigerfish is exclusive to Jozini, matching its real range');
}

{
  assert.strictEqual(getLocationById('vaal').id, 'vaal');
  assert.strictEqual(getLocationById('nonexistent').id, LOCATIONS[0].id, 'unknown id should fall back to first location');
  console.log('PASS: getLocationById resolves by id and falls back safely');
}

{
  // Every location describes a stretch of dam that builds, with at least one
  // stand to fish from, and the angler starts somewhere they can stand --
  // out over the water on the first stand.
  for (const loc of LOCATIONS) {
    assert.ok(loc.dam, `${loc.id} must declare a dam`);
    const dam = createDam(loc.dam, 7);
    assert.ok(dam.stands.length >= 1, `${loc.id} needs at least one angling stand`);
    assert.ok(dam.isWalkable(dam.spawn.x, dam.spawn.z), `${loc.id} spawn must be walkable`);
    assert.ok(dam.isWater(dam.spawn.x, dam.spawn.z), `${loc.id} spawn is out over the water on the stand`);
    assert.ok(dam.isWater(0, 60) && !dam.isWater(0, -40), `${loc.id}: water to the north, land to the south`);
  }
  console.log('PASS: every location declares a buildable dam with a walkable stand');
}

{
  // The bass-famous dams (Bronkhorstspruit, Loskop -- jetties/timber/lily
  // pads everywhere) should have noticeably more structure than a calmer,
  // more open water like Roodeplaat.
  const coverage = (loc) => loc.dam.structure
    .filter((s) => s.kind !== 'reeds')
    .reduce((sum, s) => sum + s.width * s.reach * (s.density ?? 1), 0);
  const bronk = LOCATIONS.find((l) => l.id === 'bronkhorstspruit');
  const loskop = LOCATIONS.find((l) => l.id === 'loskop');
  const roodeplaat = LOCATIONS.find((l) => l.id === 'roodeplaat');
  assert.ok(coverage(bronk) > coverage(roodeplaat) * 1.5,
    'Bronkhorstspruit (bass factory) should have substantially more structure than Roodeplaat');
  assert.ok(coverage(loskop) > coverage(roodeplaat) * 1.5,
    'Loskop (bass record water) should have substantially more structure than Roodeplaat');
  console.log('PASS: bass-famous dams have substantially more lily-pad/structure coverage');
}

{
  // Each dam's catch shares cover exactly its species and add up to 100%.
  for (const loc of LOCATIONS) {
    const ids = Object.keys(loc.catchShare || {}).sort();
    assert.deepStrictEqual(ids, [...loc.speciesIds].sort(), `${loc.id} catchShare must match speciesIds`);
    const total = Object.values(loc.catchShare).reduce((a, b) => a + b, 0);
    assert.strictEqual(total, 100, `${loc.id} catch shares add to ${total}, not 100`);
  }
  console.log('PASS: every dam has a catch-share table matching its species');
}

{
  // Simulate a long session at each dam and check the most-caught fish
  // matches the forum/venue reports. Bait anglers (mielies, open water,
  // morning) mostly land carp on the Highveld dams; a spinner in the
  // Loskop timber is bass; Jozini is tigers and kurper.
  const tally = (locId, lureId, lureKind, zone, timeOfDay = 'morning') => {
    const loc = getLocationById(locId);
    const list = FISH_SPECIES.filter((s) => loc.speciesIds.includes(s.id));
    const counts = {};
    for (let i = 0; i < 4000; i++) {
      const s = pickGuaranteedBite(list, {
        waterTempC: 22, equippedLureId: lureId, timeOfDay, lureKind,
        habitat: { zone, depthFactor: 0.5 },
      }, loc.catchShare);
      counts[s.id] = (counts[s.id] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  };
  for (const id of ['hartbeespoort', 'bronkhorstspruit', 'roodeplaat']) {
    assert.strictEqual(tally(id, 'mielies', 'bait', 'open')[0], 'common-carp', `${id}: carp should top a mielie session`);
    assert.strictEqual(tally(id, 'bread-bait', 'bait', 'open')[0], 'common-carp', `${id}: carp should top a bread session`);
  }
  // Vaal feeder anglers: yellowfish and carp make up most of the bag.
  const vaalMielies = tally('vaal', 'mielies', 'bait', 'open');
  assert.ok(vaalMielies.slice(0, 2).includes('smallmouth-yellowfish') && vaalMielies.slice(0, 2).includes('common-carp'),
    `Vaal mielie session should be led by yellowfish and carp, got ${vaalMielies.slice(0, 3)}`);
  assert.ok(vaalMielies.includes('mudfish'), 'mudfish turn up on the Vaal');
  // Smallmouth yellowfish is a Vaal-Orange fish: nowhere else on our map.
  assert.deepStrictEqual(LOCATIONS.filter((l) => l.speciesIds.includes('smallmouth-yellowfish')).map((l) => l.id), ['vaal']);
  // Largescale yellowfish: Olifants (Loskop, Bronkhorstspruit) and Pongola
  // (Jozini) systems only -- never alongside the smallmouth.
  assert.deepStrictEqual(LOCATIONS.filter((l) => l.speciesIds.includes('largescale-yellowfish')).map((l) => l.id).sort(),
    ['bronkhorstspruit', 'jozini', 'loskop']);
  assert.strictEqual(tally('loskop', 'spinner', 'lure', 'structure')[0], 'largemouth-bass', 'Loskop spinner in timber: bass');
  assert.ok(tally('jozini', 'spinner', 'lure', 'structure', 'sunset')[0] === 'tigerfish', 'Jozini spinner at dusk: tigerfish');
  console.log('PASS: simulated catches match what anglers report at each dam');
}

{
  // No more list-order advantage: over many seconds of waiting at a dam,
  // bites are spread by weight, and the first-listed species doesn't win
  // just for being first.
  const loc = getLocationById('hartbeespoort');
  const list = FISH_SPECIES.filter((s) => loc.speciesIds.includes(s.id));
  const counts = {};
  let bites = 0;
  for (let i = 0; i < 200000 && bites < 3000; i++) {
    const s = rollDamBite(list, loc.catchShare, {
      waterTempC: 22, equippedLureId: 'mielies', timeOfDay: 'morning', lureKind: 'bait',
      habitat: { zone: 'open', depthFactor: 0.5 }, deltaSeconds: 1, biteChanceMultiplier: 5,
    });
    if (s) { bites++; counts[s.id] = (counts[s.id] || 0) + 1; }
  }
  assert.ok(counts['common-carp'] > counts['mozambique-tilapia'] * 2, `carp ${counts['common-carp']} vs tilapia ${counts['mozambique-tilapia']}`);
  console.log('PASS: one fair roll per frame -- carp outnumber tilapia at Harties on mielies');
}

console.log('All location tests passed.');
