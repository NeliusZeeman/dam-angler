import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { FISH_SPECIES } from '../src/fish.js';
import { SPECIES_LOOK } from '../src/fish3d.js';

// Every fish in the game has its Blender model (tools/build-fish-models.mjs),
// and each model holds the parts the game uses, laid out the game's way.
for (const species of FISH_SPECIES) {
  const path = `assets/fish3d/${species.id}.glb`;
  assert.ok(existsSync(path), `${species.id} has a model (run node tools/build-fish-models.mjs)`);
  const glb = readFileSync(path);
  assert.strictEqual(glb.toString('ascii', 0, 4), 'glTF', `${species.id}.glb is a glTF binary`);
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
  const names = gltf.meshes.map((m) => m.name);
  for (const part of ['Body', 'BodyLow', 'Fins', 'Eyes']) {
    assert.ok(names.includes(part), `${species.id} model has ${part}`);
  }
  const look = SPECIES_LOOK[species.id];
  if (look?.barbels || look?.teeth) assert.ok(names.includes('Extras'), `${species.id} model has its whiskers/teeth`);

  // Same frame as the built-in fish: snout toward +x at about 0.26 x length,
  // the tail fin reaching behind -0.2 x length.
  const body = gltf.meshes[names.indexOf('Body')].primitives[0];
  const pos = gltf.accessors[body.attributes.POSITION];
  const len = look.shape[0];
  assert.ok(Math.abs(pos.max[0] - 0.26 * len) < 0.02 * len, `${species.id} snout at +x (${pos.max[0]})`);
  assert.ok(pos.min[0] < -0.19 * len, `${species.id} body runs back to the tail stalk (${pos.min[0]})`);
  assert.ok(body.attributes.TEXCOORD_0 !== undefined && body.attributes.COLOR_0 !== undefined,
    `${species.id} body carries skin UVs and shading`);
}

console.log(`PASS: ${FISH_SPECIES.length} fish models present and laid out for the game`);
