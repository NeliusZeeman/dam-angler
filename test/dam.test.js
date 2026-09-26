import assert from 'node:assert';
import { createDam, DECK_Y } from '../src/dam.js';
import { simulateCast, launchSpeed, DRAG } from '../src/castPhysics.js';
import { RODS, getGearById } from '../src/gear.js';

const spec = {
  shore: { wobble: 2, features: [{ x: 40, width: 20, amount: 10 }] },
  structure: [{ x: 40, width: 20, reach: 25, density: 1, kind: 'pads' }],
  farShore: 400, maxDepth: 15, depthSlope: 30,
  stands: [{ x: 0, length: 7 }],
};
const dam = createDam(spec, 3);

{
  assert.ok(dam.isWater(0, 50), 'water out in front');
  assert.ok(!dam.isWater(0, -30), 'land behind');
  assert.ok(!dam.isWater(0, 900), 'the far bank is land again');
  // A bay pushes the water in toward the land.
  assert.ok(dam.shoreZ(40) < dam.shoreZ(-40) - 5, 'bay pulls the shoreline in');
  console.log('PASS: water to the north, land to the south, bays cut into the bank');
}

{
  const near = dam.depthAt(0, dam.shoreZ(0) + 2);
  const mid = dam.depthAt(0, dam.shoreZ(0) + 25);
  const far = dam.depthAt(0, dam.shoreZ(0) + 120);
  assert.ok(near < mid && mid < far, 'depth shelves away from the bank');
  assert.ok(dam.depthFactorAt(0, dam.shoreZ(0) + 1) < 0.2, 'the margin is shallow');
  assert.ok(dam.depthFactorAt(0, dam.shoreZ(0) + 150) > 0.8, 'far out is deep');
  console.log('PASS: depth shelves off from the bank');
}

{
  assert.strictEqual(dam.zoneAt(40, dam.shoreZ(40) + 8).type, 'structure', 'in the pad bay');
  assert.strictEqual(dam.zoneAt(40, dam.shoreZ(40) + 60).type, 'open', 'beyond the pads');
  assert.strictEqual(dam.zoneAt(-60, dam.shoreZ(-60) + 8).type, 'open', 'no structure along this bank');
  console.log('PASS: structure zones sit where the dam spec puts them');
}

{
  const stand = dam.stands[0];
  assert.ok(dam.isWalkable(0, stand.zEnd - 0.5), 'can walk out to the end of the stand');
  assert.ok(dam.isWater(0, stand.zEnd - 0.5), 'and the stand end is over water');
  assert.strictEqual(dam.floorHeight(0, stand.zEnd - 0.5), DECK_Y, 'standing on the deck');
  assert.ok(!dam.isWalkable(3, stand.zEnd - 0.5), 'but not off the side into the water');
  assert.ok(dam.isWalkable(-30, dam.shoreZ(-30) - 5), 'free to roam the land');
  assert.ok(dam.groundHeight(0, dam.shoreZ(0) - 30) > 0.1, 'land sits above the water');
  assert.ok(dam.groundHeight(0, dam.shoreZ(0) + 30) < -1, 'the lake bed sits below it');
  console.log('PASS: stands and land are walkable, the water is not');
}

{
  const from = { x: 0, y: 2.2, z: 0 };
  const cast = (speed, drag = DRAG.bait, wind) => simulateCast({ from, dirX: 0, dirZ: 1, speed, drag, wind });
  const soft = cast(12), hard = cast(30);
  assert.ok(hard.distance > soft.distance * 2, 'a hard cast goes much further');
  assert.ok(Math.abs(hard.landing.y) < 1e-6, 'lands on the water surface');
  const lure = cast(30, DRAG.lure);
  assert.ok(lure.distance > hard.distance, 'a dense lure cuts through the air further than a float rig');
  const tailwind = cast(25, DRAG.bait, { x: 0, z: 6 });
  const headwind = cast(25, DRAG.bait, { x: 0, z: -6 });
  assert.ok(tailwind.distance > headwind.distance, 'wind carries a cast');
  const byId = (id) => getGearById(RODS, id);
  const d = (rod) => cast(launchSpeed(rod, 1)).distance;
  assert.ok(d(byId('rod-carp')) > d(byId('rod-spinning')) && d(byId('rod-spinning')) > d(byId('rod-starter')),
    'carp rod out-casts the spinning rod, which out-casts the starter');
  console.log('PASS: cast distance comes from rod, power, rig and wind');
}

console.log('All dam tests passed.');
