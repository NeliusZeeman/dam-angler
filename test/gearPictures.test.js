import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { RODS, REELS, LINES, HOOKS, LURES, GADGETS, COMBOS } from '../src/gear.js';

// Every Tackle Box item has its Blender-rendered picture
// (tools/build-gear-pictures.mjs). Without one the game photographs the
// model itself, so this is about the look, not about anything breaking.
const KINDS = { rod: RODS, reel: REELS, line: LINES, hook: HOOKS, lure: LURES, gadget: GADGETS, combo: COMBOS };
let count = 0;
for (const [kind, list] of Object.entries(KINDS)) {
  for (const item of list) {
    assert.ok(existsSync(`assets/gear/${kind}-${item.id}.webp`), `${kind} ${item.id} has its picture`);
    count++;
  }
}
console.log(`PASS: ${count} Tackle Box pictures present`);
