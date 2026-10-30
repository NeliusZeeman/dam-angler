import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { SCENERY_MODELS, groundSetFor } from '../src/sceneryAssets.js';
import { LOCATIONS } from '../src/locations.js';

// Every scanned model and texture the game asks for is in assets/scenery
// (tools/build-scenery.mjs, tools/blender/build_people.py).
for (const key of SCENERY_MODELS) {
  const path = `assets/scenery/models/${key}.glb`;
  assert.ok(existsSync(path), `${key} model present`);
  assert.strictEqual(readFileSync(path).toString('ascii', 0, 4), 'glTF', `${key}.glb is a glTF binary`);
}
const textures = new Set(['rock', 'barkGum', 'barkWillow', 'planks']);
for (const loc of LOCATIONS) {
  const set = groundSetFor(loc);
  textures.add(set.grass);
  textures.add(set.soil);
}
for (const key of textures) {
  for (const map of ['diff', 'nor', 'rough']) {
    assert.ok(existsSync(`assets/scenery/textures/${key}_${map}.jpg`), `${key} ${map} texture present`);
  }
}

// The right ground for the right water.
const byId = (id) => LOCATIONS.find((l) => l.id === id);
assert.strictEqual(groundSetFor(byId('jozini')).grass, 'grassLush', 'KZN grass is lush');
assert.strictEqual(groundSetFor(byId('loskop')).soil, 'redSoil', 'Loskop banks are red');
assert.strictEqual(groundSetFor(byId('vaal')).soil, 'mudDry', 'the Vaal banks are dry silt');

console.log(`PASS: ${SCENERY_MODELS.length} scenery models and ${textures.size} texture sets present`);
