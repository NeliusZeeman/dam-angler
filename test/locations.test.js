import assert from 'node:assert';
import { LOCATIONS, getLocationById } from '../src/locations.js';
import { FISH_SPECIES, pickGuaranteedBite, rollDamBite } from '../src/fish.js';
import { createDam } from '../src/dam.js';
import { PROVINCES } from '../src/regions.js';

{
  // At least 5 fishing spots in every one of South Africa's nine provinces,
  // with rivers and fly-fishing water among them.
  assert.strictEqual(PROVINCES.length, 9);
  for (const p of PROVINCES) {
    const spots = LOCATIONS.filter((l) => l.province === p.id);
    assert.ok(spots.length >= 5, `${p.name} has only ${spots.length} spots`);
  }
  assert.ok(LOCATIONS.every((l) => PROVINCES.some((p) => p.id === l.province)), 'every spot belongs to a province');
  const rivers = LOCATIONS.filter((l) => l.kind === 'river' || l.kind === 'stream');
  const fly = LOCATIONS.filter((l) => l.fly);
  assert.ok(rivers.length >= 12, `rivers and streams count too (${rivers.length})`);
  assert.ok(fly.length >= 10, `fly-fishing waters (${fly.length})`);
  console.log(`PASS: ${LOCATIONS.length} spots in all 9 provinces (${rivers.length} rivers/streams, ${fly.length} fly-fishing waters)`);
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
  // No two spots should fish exactly alike (same fish in the same mix).
  const key = (l) => JSON.stringify(Object.entries(l.catchShare).sort());
  for (let i = 0; i < LOCATIONS.length; i++) {
    for (let j = i + 1; j < LOCATIONS.length; j++) {
      assert.ok(key(LOCATIONS[i]) !== key(LOCATIONS[j]), `${LOCATIONS[i].id} and ${LOCATIONS[j].id} fish identically`);
    }
  }
  console.log('PASS: every spot has its own catch mix');
}

{
  // Fish only where they really live:
  const where = (id) => LOCATIONS.filter((l) => l.speciesIds.includes(id));
  // tigerfish: Jozini, the Pongola below it, and the Lowveld Crocodile River.
  assert.deepStrictEqual(where('tigerfish').map((l) => l.id).sort(), ['crocodile-river', 'jozini', 'pongola-river']);
  // Orange-Vaal yellowfish never in the Limpopo/Olifants/Pongola systems or the Cape.
  for (const l of where('smallmouth-yellowfish')) assert.ok(!['limpopo', 'mpumalanga', 'kwazulu-natal', 'western-cape'].includes(l.province), `smallmouth yellows at ${l.id}?`);
  for (const l of where('largemouth-yellowfish')) assert.ok(['free-state', 'northern-cape', 'north-west', 'gauteng', 'eastern-cape'].includes(l.province), `largemouth yellows at ${l.id}?`);
  // Largescale yellowfish: Limpopo/Olifants/Crocodile/Pongola systems, never with the smallmouth.
  for (const l of where('largescale-yellowfish')) {
    assert.ok(['gauteng', 'mpumalanga', 'limpopo', 'kwazulu-natal'].includes(l.province), `largescale yellows at ${l.id}?`);
    assert.ok(!l.speciesIds.includes('smallmouth-yellowfish'), `${l.id} mixes largescale and smallmouth yellows`);
  }
  // Clanwilliam yellowfish: Western Cape only. Trout: only in cold water.
  assert.ok(where('clanwilliam-yellowfish').every((l) => l.province === 'western-cape'));
  for (const l of [...where('rainbow-trout'), ...where('brown-trout')]) assert.ok(l.tempOffset <= -3, `trout in warm water at ${l.id}`);
  console.log('PASS: every fish only where it really lives (tigers in the Lowveld, trout in cold water, ...)');
}

{
  assert.strictEqual(getLocationById('vaal').id, 'vaal');
  assert.strictEqual(getLocationById('nonexistent').id, LOCATIONS[0].id, 'unknown id should fall back to first location');
  console.log('PASS: getLocationById resolves by id and falls back safely');
}

{
  // Every spot builds, and the angler starts somewhere they can stand: out
  // on a stand over the water, or on the bank a few steps from it.
  for (const loc of LOCATIONS) {
    assert.ok(loc.dam, `${loc.id} must declare its water`);
    const dam = createDam(loc.dam, 7);
    assert.ok(dam.isWalkable(dam.spawn.x, dam.spawn.z), `${loc.id} spawn must be walkable`);
    if (dam.stands.length) assert.ok(dam.isWater(dam.spawn.x, dam.spawn.z), `${loc.id} spawn is out on the stand`);
    else assert.ok(dam.waterDist(dam.spawn.x, dam.spawn.z) > -8, `${loc.id} spawn is on the bank near the water`);
    assert.ok(dam.isWater(0, dam.shoreZ(0) + 3) && !dam.isWater(0, -40), `${loc.id}: water to the north, land to the south`);
    if (loc.kind === 'river' || loc.kind === 'stream') {
      assert.ok(dam.spec.flow > 0, `${loc.id} flows`);
      assert.ok(dam.farShoreZ(0) - dam.shoreZ(0) < 130, `${loc.id}: a river has a near far bank`);
    }
  }
  console.log('PASS: every spot builds; rivers flow and have a far bank');
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

{
  // Each kind of water fishes the way the research says, with the right
  // bait at a summer water temperature (winter at 10°C for the trout).
  const top = (id, lure, kind, timeOfDay, zone = 'open', season = 26) => {
    const loc = getLocationById(id);
    const list = FISH_SPECIES.filter((s) => loc.speciesIds.includes(s.id));
    const counts = {};
    for (let i = 0; i < 3000; i++) {
      const s = pickGuaranteedBite(list, {
        waterTempC: Math.max(2, season + (loc.tempOffset || 0)), equippedLureId: lure, timeOfDay, lureKind: kind,
        habitat: { zone, depthFactor: 0.5 },
      }, loc.catchShare);
      if (s) counts[s.id] = (counts[s.id] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  assert.strictEqual(top('dullstroom', 'fly-streamer', 'lure', 'morning'), 'rainbow-trout', 'Dullstroom: trout on a streamer');
  assert.strictEqual(top('dullstroom', 'fly-streamer', 'lure', 'sunset', 'open', 10), 'rainbow-trout', 'Dullstroom trout still bite in winter');
  assert.strictEqual(top('vaal-parys', 'fly-nymph', 'lure', 'midMorning'), 'smallmouth-yellowfish', 'Parys: yellows on nymphs');
  assert.strictEqual(top('vanderkloof', 'fly-streamer', 'lure', 'morning', 'structure'), 'largemouth-yellowfish', 'Vanderkloof: largemouth yellows on streamers');
  assert.strictEqual(top('pongola-river', 'spinner', 'lure', 'morning', 'structure'), 'tigerfish', 'Pongola: tigers on spinners');
  assert.strictEqual(top('cederberg-olifants', 'fly-nymph', 'lure', 'midMorning'), 'clanwilliam-yellowfish', 'Cederberg: Clanwilliam yellows');
  assert.strictEqual(top('albert-falls', 'soft-plastic', 'lure', 'morning', 'structure'), 'largemouth-bass', 'Albert Falls: bass in summer');
  assert.strictEqual(top('stettynskloof', 'spinner', 'lure', 'morning', 'structure'), 'smallmouth-bass', 'Stettynskloof: smallmouth bass');
  assert.strictEqual(top('darlington', 'chicken-liver', 'bait', 'night'), 'catfish', 'Karoo dam at night: barbel');
  console.log('PASS: every kind of water fishes true to the research with the right bait');
}

console.log('All location tests passed.');
