import { FISH_SPECIES } from './fish.js';
import { ENGINE } from './tuning/engine.js';

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
  // Rainbows cartwheel out of the water when hooked; browns bore deep and
  // shake their heads; largemouth yellows make long, powerful runs.
  'rainbow-trout': { runSpeed: 3.0, runEvery: [1.0, 2.2], swing: 1.6, jumpRate: 0.08, jumpHeight: 0.8, depth: 0.6, stamina: 1.4 },
  'brown-trout': { runSpeed: 2.4, runEvery: [2.0, 4.0], swing: 1.2, jumpRate: 0.01, jumpHeight: 0.5, depth: 1.0, stamina: 1.7 },
  'largemouth-yellowfish': { runSpeed: 3.4, runEvery: [1.5, 3.0], swing: 1.4, jumpRate: 0.01, jumpHeight: 0.5, depth: 1.0, stamina: 2.0 },
  'clanwilliam-yellowfish': { runSpeed: 3.0, runEvery: [1.5, 3.0], swing: 1.3, jumpRate: 0.005, jumpHeight: 0.4, depth: 0.8, stamina: 1.8 },
  bluegill: { runSpeed: 1.3, runEvery: [0.8, 1.6], swing: 1.8, jumpRate: 0, jumpHeight: 0, depth: 0.4, stamina: 0.8 },
};
const DEFAULT_STYLE = { runSpeed: 1.8, runEvery: [1.5, 3.0], swing: 1.4, jumpRate: 0, jumpHeight: 0, depth: 0.8, stamina: 1.3 };

export function fightStyleFor(speciesId) {
  return FIGHT_STYLES[speciesId] || DEFAULT_STYLE;
}

// How big a fish is for its kind (1 = the species' usual maximum).
function sizeOf(speciesId, weightKg) {
  const species = FISH_SPECIES.find((s) => s.id === speciesId);
  return species ? weightKg / species.maxWeightKg : Math.min(1, weightKg / 6);
}

// How long a fish takes to tire: its species stamina, scaled by how big it
// is for its kind -- a small one gives up quickly, a full-size one fights on,
// a trophy (well past the usual maximum) seems never to tire.
export function fightStamina(speciesId, weightKg = 1) {
  const size = sizeOf(speciesId, weightKg);
  return fightStyleFor(speciesId).stamina * (0.4 + 1.2 * Math.min(2.2, size));
}

// How hard a fish swims and resists the reel: 1 for an average fish of its
// kind, less for a small one, much more for a big one or a trophy.
export function fightStrength(speciesId, weightKg = 1) {
  return 0.7 + 0.6 * Math.min(2.2, sizeOf(speciesId, weightKg));
}

const MIN_DISTANCE = 1.0; // reeled right in to the rod tip (as far as the water allows)
// (How fast the reel winds in: ENGINE.motion.reelSpeed.)

// start/rod: {x, z}. isWater(x, z) keeps the fish off the bank.
export function createFightMotion({ start, rod, style = DEFAULT_STYLE, isWater = () => true, rng = Math.random, reelSpeed = ENGINE.motion.reelSpeed }) {
  const range = (r) => r[0] + rng() * (r[1] - r[0]);
  let x = start.x, z = start.z;
  let heading = Math.atan2(z - rod.z, x - rod.x); // straight away from the angler
  let runLeft = 0.6; // it bolts the moment it feels the hook
  let nextRun = range(style.runEvery);
  let nextJump = style.jumpRate > 0 ? (style.firstJump ? range(style.firstJump) : -Math.log(1 - rng() * 0.999) / style.jumpRate) : Infinity;
  let jumpT = -1, jumpDur = 1, jumpH = 0;
  let depth = style.depth * 0.5;
  let speed = 0;
  // How strong this particular fish is (see fightStrength): bigger fish
  // run faster and give up line more grudgingly. Set once its weight is known.
  let strength = 1;

  const state = {
    x, z, y: 0, depth, heading, speed: 0, jumping: false, jumpStarted: false, jumpLanded: false,
    running: true, takingLine: false, distance: Math.hypot(start.x - rod.x, start.z - rod.z),
  };

  // `drag` is the reel's drag setting (share of the line's strength, a third
  // by default) and `slipping` whether the spool is giving line right now.
  function update(dt, { progress = 0, holding = false, drag = 0.33, slipping = false } = {}) {
    state.jumpStarted = false;
    state.jumpLanded = false;

    // Runs: a fresh burst every few seconds. Under pressure it pulls away
    // from you; left alone it goes wherever it likes -- any direction.
    nextRun -= dt;
    if (nextRun <= 0) {
      nextRun = range(style.runEvery);
      runLeft = ENGINE.motion.runSeconds * (0.7 + rng() * 0.6);
      const away = Math.atan2(z - rod.z, x - rod.x);
      heading = holding ? away + (rng() * 2 - 1) * style.swing : rng() * Math.PI * 2;
    }
    const running = runLeft > 0;
    runLeft -= dt;
    // Tiring: the further the fight goes, the weaker its runs.
    const tire = 1 - 0.55 * Math.min(1, progress);
    const targetSpeed = style.runSpeed * strength * tire * (running ? 1 : 0.35);
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
    // Swimming away pulls line off the spool against the drag: a loose drag
    // lets a strong fish run much further, a tight one stops it short.
    // (At the usual third it's the fish's own pace.)
    if (dist > before) newDist = before + (dist - before) * Math.max(0.3, Math.min(1.6, 1.6 - 1.8 * drag));
    // A heavy fish gives up line more slowly against the reel -- and winding
    // against a slipping drag barely gains any: the spool just turns.
    const reelGain = slipping ? 0.35 : 1;
    if (holding) newDist = Math.max(MIN_DISTANCE, newDist - (reelSpeed * reelGain / (0.55 + 0.45 * strength)) * dt);
    newDist = Math.min(newDist, ENGINE.motion.lineOnSpool);
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

  return { update, state, setStrength: (s) => { strength = s; } };
}
