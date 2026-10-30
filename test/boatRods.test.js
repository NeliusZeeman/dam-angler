import assert from 'node:assert';
import { BOAT_RODS, BOAT_ROD_BONUS, boatRodsFor, boatRodAt, boatBonus } from '../src/boatRods.js';
import { BOAT_SPECS, createBoatDrive, RACK_REACH } from '../src/boatDrive.js';
import { FISH_SPECIES } from '../src/fish.js';
import { catchPayout } from '../src/economy.js';
import { boatPoints, pointsFromLog } from '../src/levels.js';
import { DAM_SPOTS } from '../src/pegs.js';
import { rigCheck } from '../src/gear.js';

// Every boat rod is a full outfit on real tackle-box gear, rigged for real fish.
const species = new Set(FISH_SPECIES.map((s) => s.id));
for (const b of BOAT_RODS) {
  assert.ok(b.rod && b.reel && b.line, `${b.id} outfit`);
  assert.ok(b.rod.boatRod && b.rod.inShop === false && b.rod.cost === 0, `${b.id} not for sale`);
  assert.ok(b.rod.maxKg > 0 && b.rod.castSpeed > 0 && b.rod.tier >= 1, `${b.id} fishes`);
  for (const t of b.targets) assert.ok(species.has(t), `${b.id} target ${t}`);
  // Fully rigged: its own hook, and baits its fish take that suit the rod.
  assert.ok(b.hook, `${b.id} hook`);
  assert.ok(b.baits.length && b.baits.every(Boolean), `${b.id} baits`);
  for (const l of b.baits) {
    assert.ok(b.targets.some((t) => FISH_SPECIES.find((s) => s.id === t).preferredLureIds.includes(l.id)), `${b.id}: ${l.id} catches its fish`);
    assert.ok(!l.fly, `${b.id}: no flies on a boat rod`);
    assert.ok(rigCheck({ rod: b.rod, reel: b.reel, line: b.line, lure: l }).castFactor >= 0.99, `${b.id}: ${l.id} casts cleanly`);
  }
}
// Each boat has a rack, and every fish has a boat rod on some boat.
for (const kind of Object.keys(BOAT_SPECS)) assert.ok(boatRodsFor(kind).length >= 2, `${kind} rack`);
for (const id of species) assert.ok(BOAT_RODS.some((b) => b.targets.includes(id)), `a boat rod for ${id}`);

// The bonus: on what it's rigged for only.
const tiger = boatRodsFor('tiger').find((b) => b.targets.includes('tigerfish'));
assert.strictEqual(boatBonus(tiger, 'tigerfish'), BOAT_ROD_BONUS);
assert.strictEqual(boatBonus(tiger, 'common-carp'), 1);
assert.strictEqual(boatBonus(null, 'tigerfish'), 1);
const sp = FISH_SPECIES.find((s) => s.id === 'tigerfish');
const pay = (bonus) => catchPayout({ species: sp, weightKg: 4, rod: tiger.rod, line: tiger.line, catchId: 'x', bonus });
assert.ok(Math.abs(pay(BOAT_ROD_BONUS) / pay(1) - BOAT_ROD_BONUS) < 0.02, 'credits bonus');
assert.strictEqual(boatPoints({ weightKg: 4 }, 1), 0);
assert.ok(boatPoints({ weightKg: 4 }, BOAT_ROD_BONUS) > 0, 'XP bonus');
assert.strictEqual(pointsFromLog({ tigerfish: { count: 1, totalKg: 4, boatPts: 20 } }) - pointsFromLog({ tigerfish: { count: 1, totalKg: 4 } }), 20);

// Only on water where you'd have that boat.
const boatWater = Object.entries(DAM_SPOTS).find(([, s]) => s.boats?.includes('bass'))?.[0];
const bass = boatRodsFor('bass')[0];
assert.ok(boatWater && boatRodAt(bass.id, boatWater), 'boat rod on boat water');
assert.strictEqual(boatRodAt(bass.id, 'no-such-dam'), null);
assert.strictEqual(boatRodAt('rod-starter', boatWater), null);

// Walking the deck: inside the gunwales, round the consoles, reaching the rack.
const dam = { waterDist: () => 50, standAt: () => false, isWater: () => true, isWalkable: () => false };
const drive = createBoatDrive({ dam, kind: 'bass', x: 10, z: 20, heading: 0.7 });
const d = BOAT_SPECS.bass.deck;
let p = drive.walkDeck(0, 1.5, 3, 1.5);
assert.ok(Math.abs(p.x) <= d.halfW, 'kept off the water');
p = drive.walkDeck(0, 1, 0.6, 0.1); // into the console
assert.ok(!(p.x > 0.28 && p.x < 0.9 && p.z > -0.2 && p.z < 0.45), 'round the console');
assert.ok(!drive.atRack(0, 1.5) && drive.atRack(d.rack.x, d.rack.z + RACK_REACH * 0.8), 'rack at the stern');
// The boat's metres and the world's line up with the helm seat.
const w = drive.toWorld(0, BOAT_SPECS.bass.seat), s = drive.seat();
assert.ok(Math.hypot(w.x - s.x, w.z - s.z) < 1e-9, 'toWorld matches the seat');
const m = drive.moveToBoat(Math.sin(0.7), Math.cos(0.7));
assert.ok(Math.abs(m.x) < 1e-9 && Math.abs(m.z - 1) < 1e-9, 'a step toward the bow');
// A kayak has no deck to walk, and its rods are in reach.
assert.ok(createBoatDrive({ dam, kind: 'kayak', x: 0, z: 0 }).atRack(0, 0));

console.log(`boat rods ok (${BOAT_RODS.length} rods)`);
