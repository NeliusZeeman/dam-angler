import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { PEOPLE } from '../src/people.js';

// The campsite people (tools/blender/build_campers.py) are all there, and
// the motions file has every motion the camp and boat crews play
// (gfx/campLife.js, gfx/boats.js).
for (const name of PEOPLE) assert.ok(existsSync(`assets/people/${name}.glb`), `${name}.glb`);

// The clip names, from the GLB's JSON chunk.
const glb = readFileSync('assets/people/motions.glb');
const jsonLen = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const clips = new Set((gltf.animations || []).map((a) => a.name));
const USED = ['idle', 'walk', 'stroll', 'sit', 'sitRelaxed', 'sitLook', 'sitBreathe', 'drink', 'drinkIdle', 'crouch', 'work',
  'cheer', 'photo', 'clap', 'talk', 'laugh', 'lookAround', 'stretch'];
for (const c of USED) assert.ok(clips.has(c), `motion ${c}`);

// Walking moves at a real walking pace (it sets how fast people cross the camp).
const { walkSpeed } = JSON.parse(readFileSync('assets/people/motions.json', 'utf8'));
assert.ok(walkSpeed.walk > 0.8 && walkSpeed.walk < 1.8, `walk ${walkSpeed.walk} m/s`);

// And the braai fire flipbook.
assert.ok(existsSync('assets/scenery/textures/fire-flipbook.webp'), 'fire flipbook');

console.log(`people ok (${PEOPLE.length} people, ${clips.size} motions)`);
