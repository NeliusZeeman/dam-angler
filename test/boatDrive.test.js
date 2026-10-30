import assert from 'node:assert';
import { createDam } from '../src/dam.js';
import { createBoatDrive, boatKindFor, mooringFor } from '../src/boatDrive.js';

const dam = createDam({ stands: [{ x: 0 }], maxDepth: 10 }, 3);

assert.equal(boatKindFor(['yacht', 'ski', 'bass']), 'bass');
assert.equal(boatKindFor(['tiger', 'houseboat']), 'tiger');
assert.equal(boatKindFor(['kayak', 'yacht']), 'kayak');
assert.equal(boatKindFor([]), null);

// Moored afloat, off the stand.
const m = mooringFor(dam);
assert.ok(dam.waterDist(m.x, m.z) > 2.5 && !dam.standAt(m.x, m.z), 'moored in clear water');

// Full throttle straight out (north, heading 0) gets going and goes out.
const d = createBoatDrive({ dam, kind: 'bass', x: m.x, z: m.z, heading: 0 });
for (let i = 0; i < 300; i++) d.step(1 / 60, 1, 0, false);
assert.ok(d.state.speed > 4 && d.state.z > m.z + 10, `under way: ${d.state.speed.toFixed(1)} m/s`);
// Off the throttle it coasts to a stop.
for (let i = 0; i < 60 * 30; i++) d.step(1 / 60, 0, 0);
assert.equal(d.state.speed, 0, 'stops');
// Out there you can't step ashore.
assert.equal(d.landingSpot(), null, 'no bank out in open water');

// Driving straight at the bank never puts the boat on land.
const b = createBoatDrive({ dam, kind: 'bass', x: m.x + 30, z: dam.shoreZ(m.x + 30) + 20, heading: Math.PI });
for (let i = 0; i < 60 * 20; i++) {
  b.step(1 / 60, 1, 0, true);
  assert.ok(dam.isWater(b.state.x, b.state.z), 'still afloat');
}
assert.ok(b.landingSpot(), 'beside the bank you can step ashore');
const spot = b.landingSpot();
assert.ok(dam.isWalkable(spot.x, spot.z), 'onto dry ground');

// Steering turns the boat.
const t = createBoatDrive({ dam, kind: 'bass', x: m.x, z: m.z + 60, heading: 0 });
for (let i = 0; i < 120; i++) t.step(1 / 60, 1, 1);
assert.ok(t.state.heading < -0.3, 'A/D steer');

console.log('boat drive ok');

// Wedged in the shallows by the bank it can still back out.
{
  const x = m.x + 30;
  const w = createBoatDrive({ dam, kind: 'bass', x, z: dam.shoreZ(x) + 1.5, heading: 0 });
  for (let i = 0; i < 120; i++) w.step(1 / 60, 1, 0);
  assert.ok(dam.waterDist(w.state.x, w.state.z) > 2, 'drove back out of the shallows');
  console.log('unstuck ok');
}
