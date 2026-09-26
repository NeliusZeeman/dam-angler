// Where a hooked fish is, second by second, while you fight it -- pure
// maths, no graphics, so it can be tested. casting.js moves the float and
// line to it and main.js draws the fish when it breaks the surface.
//
// The fish is free: it swims where it likes. Ease off and it wanders in any
// direction -- out into the dam, off to the side, even back toward you --
// taking line as it goes. Put pressure on (reel) and it pulls away against
// you while the reel winds it in; a strong run still strips line off
// against the drag. It tires as the fight goes on (the fight meter), its
// runs weaken and it comes up from the deep. Jumpers leap clear now and then.
//
// Per-species fight styles, from angling reports:
//   tigerfish  -- fast, and famous for jumping and head-shaking to throw the
//                 hook (Jozini guides: the first jump comes within seconds)
//   bass       -- largemouth jump and tail-walk; smallmouth dive and jump less
//   yellowfish -- explosive runs and head-shakes, rarely jump
//   carp       -- long, powerful runs, stay down, take a long time to tire
//   barbel     -- slow, deep, dogged and very strong; never jumps
//   kurper, mudfish -- short darting runs
//
//   runSpeed m/s in a run · runEvery [min,max] s between runs · swing how far
//   off "straight away" a run under pressure can head (radians) · jumpRate
//   jumps per second · jumpHeight metres · depth metres it holds at ·
//   stamina how long it takes to tire (1 = a quick kurper; carp ~2.2).
export const FIGHT_STYLES = {
  'mozambique-tilapia': { runSpeed: 1.6, runEvery: [1.2, 2.5], swing: 1.6, jumpRate: 0, jumpHeight: 0, depth: 0.5, stamina: 1.1 },
  'banded-tilapia': { runSpeed: 1.4, runEvery: [1.0, 2.0], swing: 1.7, jumpRate: 0, jumpHeight: 0, depth: 0.4, stamina: 1.0 },
  'common-carp': { runSpeed: 2.2, runEvery: [2.5, 5.0], swing: 1.2, jumpRate: 0, jumpHeight: 0, depth: 1.0, stamina: 1.8 },
  'mirror-carp': { runSpeed: 2.0, runEvery: [3.0, 6.0], swing: 1.1, jumpRate: 0, jumpHeight: 0, depth: 1.3, stamina: 2.0 },
  'largemouth-bass': { runSpeed: 2.4, runEvery: [1.2, 2.5], swing: 1.5, jumpRate: 0.09, jumpHeight: 0.8, depth: 0.6, stamina: 1.35 },
  'smallmouth-bass': { runSpeed: 2.6, runEvery: [1.0, 2.2], swing: 1.6, jumpRate: 0.05, jumpHeight: 0.7, depth: 0.9, stamina: 1.45 },
  catfish: { runSpeed: 1.5, runEvery: [3.0, 6.0], swing: 0.9, jumpRate: 0, jumpHeight: 0, depth: 1.8, stamina: 1.9 },
  tigerfish: { runSpeed: 3.4, runEvery: [0.8, 1.8], swing: 1.7, jumpRate: 0.2, jumpHeight: 1.3, depth: 0.5, stamina: 1.4, firstJump: [1.5, 3.5] },
  'smallmouth-yellowfish': { runSpeed: 3.0, runEvery: [1.5, 3.0], swing: 1.3, jumpRate: 0.005, jumpHeight: 0.4, depth: 0.8, stamina: 1.5 },
  'largescale-yellowfish': { runSpeed: 3.2, runEvery: [1.5, 3.0], swing: 1.3, jumpRate: 0.01, jumpHeight: 0.5, depth: 0.9, stamina: 1.6 },
  mudfish: { runSpeed: 1.3, runEvery: [2.0, 4.0], swing: 1.2, jumpRate: 0, jumpHeight: 0, depth: 1.0, stamina: 1.3 },
};
const DEFAULT_STYLE = { runSpeed: 1.8, runEvery: [1.5, 3.0], swing: 1.4, jumpRate: 0, jumpHeight: 0, depth: 0.8, stamina: 1.3 };

export function fightStyleFor(speciesId) {
  return FIGHT_STYLES[speciesId] || DEFAULT_STYLE;
}

// How long a fish takes to tire: its species stamina, more for a big one.
export function fightStamina(speciesId, weightKg = 1) {
  return fightStyleFor(speciesId).stamina * (0.8 + Math.min(1, weightKg / 6) * 0.6);
}

const MIN_DISTANCE = 1.0; // reeled right in to the rod tip (as far as the water allows)
const RUN_SECONDS = 1.3; // how long a burst lasts
export const REEL_SPEED = 1.5; // m/s of line the reel winds in while you hold
export const LINE_ON_SPOOL = 140; // m -- a fish can't run further than this

// start/rod: {x, z}. isWater(x, z) keeps the fish off the bank.
export function createFightMotion({ start, rod, style = DEFAULT_STYLE, isWater = () => true, rng = Math.random, reelSpeed = REEL_SPEED }) {
  const range = (r) => r[0] + rng() * (r[1] - r[0]);
  let x = start.x, z = start.z;
  let heading = Math.atan2(z - rod.z, x - rod.x); // straight away from the angler
  let runLeft = 0.6; // it bolts the moment it feels the hook
  let nextRun = range(style.runEvery);
  let nextJump = style.jumpRate > 0 ? (style.firstJump ? range(style.firstJump) : -Math.log(1 - rng() * 0.999) / style.jumpRate) : Infinity;
  let jumpT = -1, jumpDur = 1, jumpH = 0;
  let depth = style.depth * 0.5;
  let speed = 0;

  const state = {
    x, z, y: 0, depth, heading, speed: 0, jumping: false, jumpStarted: false, jumpLanded: false,
    running: true, takingLine: false, distance: Math.hypot(start.x - rod.x, start.z - rod.z),
  };

  function update(dt, { progress = 0, holding = false } = {}) {
    state.jumpStarted = false;
    state.jumpLanded = false;

    // Runs: a fresh burst every few seconds. Under pressure it pulls away
    // from you; left alone it goes wherever it likes -- any direction.
    nextRun -= dt;
    if (nextRun <= 0) {
      nextRun = range(style.runEvery);
      runLeft = RUN_SECONDS * (0.7 + rng() * 0.6);
      const away = Math.atan2(z - rod.z, x - rod.x);
      heading = holding ? away + (rng() * 2 - 1) * style.swing : rng() * Math.PI * 2;
    }
    const running = runLeft > 0;
    runLeft -= dt;
    // Tiring: the further the fight goes, the weaker its runs.
    const tire = 1 - 0.55 * Math.min(1, progress);
    const targetSpeed = style.runSpeed * tire * (running ? 1 : 0.35);
    speed += (targetSpeed - speed) * Math.min(1, dt * 4);

    // Swim, turning away from the bank when it runs out of water.
    const before = Math.hypot(x - rod.x, z - rod.z);
    let nx = x + Math.cos(heading) * speed * dt;
    let nz = z + Math.sin(heading) * speed * dt;
    if (!isWater(nx, nz)) {
      heading += Math.PI * (0.6 + rng() * 0.8);
      nx = x; nz = z;
    }

    // The line. Reeling winds it in at the reel's speed; whatever the fish
    // gains swimming away beyond that, it strips off against the drag.
    // Not reeling: no pull at all -- the fish goes where it swims.
    const dx = nx - rod.x, dz = nz - rod.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    let newDist = dist;
    if (holding) newDist = Math.max(MIN_DISTANCE, dist - reelSpeed * dt);
    newDist = Math.min(newDist, LINE_ON_SPOOL);
    if (newDist !== dist) {
      const cx = rod.x + (dx / dist) * newDist, cz = rod.z + (dz / dist) * newDist;
      if (isWater(cx, cz)) { nx = cx; nz = cz; }
    }
    x = nx; z = nz;
    const distance = Math.hypot(x - rod.x, z - rod.z);

    // Depth: holds deep while strong, comes up as it tires.
    const wantDepth = style.depth * (1 - 0.7 * Math.min(1, progress));
    depth += (wantDepth - depth) * Math.min(1, dt * 1.5);

    // Jumps.
    if (jumpT >= 0) {
      jumpT += dt;
      if (jumpT >= jumpDur) {
        jumpT = -1;
        state.jumpLanded = true;
      }
    } else if (style.jumpRate > 0) {
      nextJump -= dt;
      if (nextJump <= 0 && distance > MIN_DISTANCE + 1) {
        jumpT = 0;
        jumpDur = 0.8 + rng() * 0.5;
        jumpH = style.jumpHeight * (0.7 + rng() * 0.6);
        state.jumpStarted = true;
        nextJump = -Math.log(1 - rng() * 0.999) / style.jumpRate + jumpDur;
      }
    }
    const jumping = jumpT >= 0;
    const arc = jumping ? Math.sin((jumpT / jumpDur) * Math.PI) : 0;

    Object.assign(state, {
      x, z, depth, heading, speed, running, jumping,
      // Line going out: the fish is further than a moment ago.
      takingLine: distance > before + 1e-4,
      // Height above the water surface: negative under water.
      y: jumping ? arc * jumpH : -depth,
      // Nose up leaving the water, nose down going back in.
      pitch: jumping ? Math.cos((jumpT / jumpDur) * Math.PI) * 0.9 : 0,
      jumpDuration: jumpDur,
      distance,
    });
    return state;
  }

  return { update, state };
}
