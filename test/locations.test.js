import assert from 'node:assert';
import { LOCATIONS, getLocationById } from '../src/locations.js';
import { FISH_SPECIES } from '../src/fish.js';

{
  assert.strictEqual(LOCATIONS.length, 3);
  console.log('PASS: exactly 3 locations defined');
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
  // The three locations should not all offer the same fish -- that would
  // defeat the point of picking a place to fish.
  const [a, b, c] = LOCATIONS.map((loc) => new Set(loc.speciesIds));
  const same = (x, y) => x.size === y.size && [...x].every((id) => y.has(id));
  assert.ok(!(same(a, b) && same(b, c)), 'locations should not all offer an identical species mix');
  console.log('PASS: locations have distinct species mixes');
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

console.log('All location tests passed.');
