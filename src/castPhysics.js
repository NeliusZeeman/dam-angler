import { ENGINE } from './tuning/engine.js';
// Casting as real projectile flight. The rod sets how fast it can launch the
// lure (a 12ft carp rod throws a heavy lead a long way, a light fibreglass
// rod doesn't), the power meter sets how much of that you use, and then
// gravity, air drag and the wind take over. A hard cast flies fast and far;
// a soft one lobs out short and slow.


// Air drag per unit speed. A float-and-bait rig is light and catches the air;
// a spinner or spoon is dense and cuts through it.
export const DRAG = { bait: 0.012, lure: 0.007 };

export function launchSpeed(rod, power, castMultiplier = 1) {
  const p = Math.min(1.35, Math.max(0, power));
  return rod.castSpeed * (0.28 + 0.72 * p) * Math.sqrt(castMultiplier);
}

// Fly the lure from `from` along the horizontal direction (dirX, dirZ).
// `surfaceAt(x, z)` is the water level or ground height under a point; the
// flight ends when the lure drops onto it. Returns where it landed, how long
// it was in the air, and the path (sampled every `dt`) for the animation.
export function simulateCast({
  from, dirX, dirZ, speed, elevation = ENGINE.cast.launchElevation, drag = DRAG.bait,
  wind = { x: 0, z: 0 }, surfaceAt = () => 0, dt = 1 / 60, maxTime = 12,
}) {
  const len = Math.hypot(dirX, dirZ) || 1;
  const hx = dirX / len, hz = dirZ / len;
  let x = from.x, y = from.y, z = from.z;
  let vx = hx * Math.cos(elevation) * speed;
  let vy = Math.sin(elevation) * speed;
  let vz = hz * Math.cos(elevation) * speed;
  const path = [{ x, y, z }];
  let t = 0;
  while (t < maxTime) {
    // Drag acts against the lure's motion through the air, which is its
    // velocity relative to the wind.
    const rx = vx - wind.x, rz = vz - wind.z;
    const sp = Math.hypot(rx, vy, rz);
    vx -= drag * sp * rx * dt;
    vy -= (ENGINE.cast.gravity + drag * sp * vy) * dt;
    vz -= drag * sp * rz * dt;
    const px = x, py = y, pz = z;
    x += vx * dt; y += vy * dt; z += vz * dt;
    t += dt;
    const floor = surfaceAt(x, z);
    if (vy < 0 && y <= floor) {
      // Interpolate to the exact touchdown within this step.
      const prevFloor = surfaceAt(px, pz);
      const a = (py - prevFloor) / Math.max(1e-6, (py - prevFloor) - (y - floor));
      x = px + (x - px) * a; z = pz + (z - pz) * a;
      y = surfaceAt(x, z);
      t -= dt * (1 - a);
      path.push({ x, y, z });
      break;
    }
    path.push({ x, y, z });
  }
  const distance = Math.hypot(x - from.x, z - from.z);
  return { landing: { x, y, z }, time: t, distance, path };
}
