import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

// The Blender boats (tools/blender/build_boats.py): every kind is there,
// with its body, baked shading, moving parts and crew spots (gfx/boats.js).
const KINDS = ['bass', 'tiger', 'kayak', 'ski', 'pontoon', 'houseboat', 'yacht'];
for (const kind of KINDS) {
  const file = `assets/scenery/models/boat-${kind}.glb`;
  assert.ok(existsSync(file), file);
  const glb = readFileSync(file);
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  const names = gltf.nodes.map((n) => n.name);
  assert.ok(names.includes('body'), `${kind} body`);
  assert.ok(names.some((n) => /^spot-(rod|sit|paddle)-\d+$/.test(n)), `${kind} crew spots`);
  if (['bass', 'tiger', 'ski', 'pontoon', 'houseboat'].includes(kind)) assert.ok(names.includes('prop'), `${kind} prop`);
  if (kind === 'kayak') assert.ok(names.includes('paddle'), 'kayak paddle');
  // The ambient occlusion rides in the vertex colours.
  assert.ok(gltf.meshes.some((m) => m.primitives.some((p) => 'COLOR_0' in p.attributes)), `${kind} baked shading`);
  assert.ok(gltf.materials.some((m) => m.name === 'paint'), `${kind} paint`);
  assert.ok(glb.length < 1.2e6, `${kind} under 1.2 MB`);
}
console.log(`boat models ok (${KINDS.length} kinds)`);
