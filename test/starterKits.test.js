import assert from 'node:assert';
import { RODS, REELS, LINES, HOOKS, LURES, STARTER_KITS, STARTER_ITEMS, rigCheck, getGearById } from '../src/gear.js';

// Stand-in for the browser's storage so save.js loads under node.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { normalizeSave, DEFAULT_SAVE } = await import('../src/save.js');

// Every kit is real gear, and rigs up without a mismatch.
for (const k of STARTER_KITS) {
  const rod = getGearById(RODS, k.rod), reel = getGearById(REELS, k.reel), line = getGearById(LINES, k.line);
  assert.ok(rod && reel && line, `${k.id}: rod, reel and line exist`);
  for (const h of k.hooks) assert.ok(getGearById(HOOKS, h), `${k.id}: hook ${h} exists`);
  for (const l of k.lures) assert.ok(getGearById(LURES, l), `${k.id}: bait ${l} exists`);
  const rig = rigCheck({ rod, reel, line, lure: getGearById(LURES, k.lures[0]) });
  assert.ok(rig.ok, `${k.id} kit matches: ${rig.issues.join('; ')}`);
}
assert.ok(STARTER_KITS.some((k) => k.id === 'bass') && STARTER_KITS.some((k) => k.id === 'carp'), 'bass and carp kits');

// A new player owns every kit; an old save is given them without losing
// what was bought.
for (const id of STARTER_ITEMS.rod) assert.ok(DEFAULT_SAVE.ownedRodIds.includes(id));
const old = normalizeSave({ ownedRodIds: ['rod-starter', 'rod-heavy'], ownedLureIds: ['bread-bait'] });
assert.ok(old.ownedRodIds.includes('rod-heavy'), 'bought rod kept');
for (const id of STARTER_ITEMS.rod) assert.ok(old.ownedRodIds.includes(id), `old save gets ${id}`);
for (const id of STARTER_ITEMS.lure) assert.ok(old.ownedLureIds.includes(id), `old save gets ${id}`);
assert.equal(new Set(old.ownedRodIds).size, old.ownedRodIds.length, 'no doubles');

console.log(`starter kits ok (${STARTER_KITS.length} kits)`);
