import assert from 'node:assert';
import { LOCATIONS, getLocationById } from '../src/locations.js';
import { FISH_SPECIES } from '../src/fish.js';
import { createPondShape } from '../src/pondShape.js';

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
  // Every location must describe a pond shape that actually builds.
  for (const loc of LOCATIONS) {
    assert.ok(loc.shape && typeof loc.shape.baseRadius === 'number', `${loc.id} must declare a shape`);
    const shape = createPondShape({ seedStr: loc.id, ...loc.shape });
    assert.ok(shape.radiusAt(0) > 0 && shape.radiusAt(3) > 0, `${loc.id}'s shape must produce positive radii`);
  }
  console.log('PASS: every location declares a buildable pond shape');
}

{
  // The bass-famous dams (Bronkhorstspruit, Loskop -- jetties/timber/lily
  // pads everywhere) should have noticeably more structure than a calmer,
  // more open water like Roodeplaat.
  const totalCoveCoverage = (loc) => loc.shape.coves.reduce((sum, c) => sum + c.width * (c.density ?? 1), 0);
  const bronk = LOCATIONS.find((l) => l.id === 'bronkhorstspruit');
  const loskop = LOCATIONS.find((l) => l.id === 'loskop');
  const roodeplaat = LOCATIONS.find((l) => l.id === 'roodeplaat');
  assert.ok(totalCoveCoverage(bronk) > totalCoveCoverage(roodeplaat) * 1.5,
    'Bronkhorstspruit (bass factory) should have substantially more structure coverage than Roodeplaat');
  assert.ok(totalCoveCoverage(loskop) > totalCoveCoverage(roodeplaat) * 1.5,
    'Loskop (bass record water) should have substantially more structure coverage than Roodeplaat');
  console.log('PASS: bass-famous dams have substantially more lily-pad/structure coverage');
}

console.log('All location tests passed.');
