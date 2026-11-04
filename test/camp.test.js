import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// The Blender camp gear and jetty parts (tools/build-camp.mjs).
function gltf(path) {
  const b = readFileSync(path);
  assert.strictEqual(b.toString('ascii', 0, 4), 'glTF', `${path} is a glTF binary`);
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
const tris = (json, node) => json.meshes[node.mesh].primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);

// Every camp piece at three levels, each lighter than the last.
const camp = gltf('assets/scenery/models/camp.glb');
const nodes = new Map(camp.nodes.map((n) => [n.name, n]));
for (const name of ['tentDome', 'bowTent', 'gazebo', 'bakkieHilux', 'bakkieRanger', 'bakkieDmax', 'cruiser', 'suv', 'trailer', 'braaiStand', 'potjie', 'campChair', 'campTable', 'powerPost', 'caravan', 'cooler']) {
  const lods = [0, 1, 2].map((l) => nodes.get(`${name}_lod${l}`));
  assert.ok(lods.every(Boolean), `${name} has three levels`);
  const t = lods.map((n) => tris(camp, n));
  assert.ok(t[0] > t[1] && t[1] > t[2], `${name} levels get lighter (${t.join(' > ')})`);
  // Baked soft shade (tools/blender/bake_light.py) on every level.
  for (const n of lods) assert.ok(camp.meshes[n.mesh].primitives.every((p) => 'COLOR_0' in p.attributes), `${n.name} has baked shade`);
}
// The materials the game recolours.
const names = new Set(camp.materials.map((m) => m.name));
assert.ok(names.has('fly') && names.has('paint') && names.has('chair'), 'tent fly-sheet, vehicle paint and chair materials present');

// Jetty parts, light enough to set out hundreds of.
const jetty = gltf('assets/scenery/models/jetty.glb');
const parts = new Map(jetty.nodes.map((n) => [n.name, n]));
for (const name of ['plank0', 'plank1', 'plank2', 'post', 'brace', 'cleat']) {
  assert.ok(parts.get(name), `jetty ${name} present`);
  assert.ok(tris(jetty, parts.get(name)) < 600, `jetty ${name} is light`);
}
console.log('camp tests passed');
