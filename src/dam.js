import { fbm, smoothstep } from './gfx/noise.js';

// A real dam shoreline instead of a closed pond. Land lies to the south
// (z < shoreZ(x)), the dam's open water to the north, running either to a
// far shore (`farShore` metres out) or clean to the horizon.
//
//   shore.features  -- bays (+amount: water pushes into the land) and
//                      headlands/points (-amount) along the shoreline
//   structure       -- weed beds, lily pads, reeds, drowned timber or
//                      hyacinth reaching out from the bank at some x
//   stands          -- wooden angling stands / jetties built out over the
//                      water; the first one is where the angler starts
//
// Pure math (no Three.js) so the fishing logic can be unit-tested.

export const DECK_Y = 0.45; // stand deck height above the water

export function createDam(spec = {}, seed = 1) {
  const {
    shore = {}, structure = [], farShore = null, maxDepth = 12, depthSlope = 30,
    bankSteepness = 1, beachWidth = 3, hills = 4, stands = [],
  } = spec;
  const wobble = shore.wobble ?? 3;
  const features = shore.features ?? [];

  // Near shoreline, as z for a given x (with gentle natural wobble).
  function shoreZ(x) {
    let z = (fbm(x * 0.012 + 11.3, 3.7, { octaves: 3, seed }) - 0.5) * 2 * wobble;
    for (const f of features) {
      const t = (x - f.x) / f.width;
      z -= f.amount * Math.exp(-t * t);
    }
    return z;
  }

  function farShoreZ(x) {
    if (!farShore) return Infinity;
    return farShore + (fbm(x * 0.004 + 5.1, 9.2, { octaves: 3, seed: seed + 7 }) - 0.5) * farShore * 0.35;
  }

  // Metres into the water (negative on land) -- distance to the nearer shore.
  function waterDist(x, z) {
    return Math.min(z - shoreZ(x), farShoreZ(x) - z);
  }

  function isWater(x, z) {
    return waterDist(x, z) > 0;
  }

  // Water depth in metres: shelving away from the bank toward maxDepth.
  function depthAt(x, z) {
    const d = waterDist(x, z);
    if (d <= 0) return 0;
    const shelf = 1 - Math.exp(-d / depthSlope);
    const variation = 0.85 + 0.3 * fbm(x * 0.02, z * 0.02, { octaves: 2, seed: seed + 3 });
    return maxDepth * shelf * variation;
  }

  // 0 at the bank, 1 in the deepest water -- drives the depth-loving /
  // shallow-loving species bonuses.
  function depthFactorAt(x, z) {
    return Math.min(1, depthAt(x, z) / (maxDepth * 0.9));
  }

  // Structure (pads, reeds, timber, hyacinth) close enough to the bank here?
  function zoneAt(x, z) {
    const d = waterDist(x, z);
    let best = { type: 'open', density: 0, kind: null };
    if (d <= 0) return best;
    for (const s of structure) {
      const t = (x - s.x) / s.width;
      const along = Math.exp(-t * t);
      const reach = s.reach ?? 25;
      const density = (s.density ?? 1) * along * (1 - smoothstep(reach * 0.7, reach, d));
      if (density > best.density) best = { type: density > 0.25 ? 'structure' : 'open', density, kind: s.kind || 'pads' };
    }
    return best;
  }

  // Ground height (land) or lake-bed height (under water).
  function groundHeight(x, z) {
    const d = waterDist(x, z);
    if (d > 0) return 0.012 - Math.min(depthAt(x, z), d * 0.35 * bankSteepness + 0.15);
    const land = -d;
    const bump = (fbm(x * 0.15, z * 0.15, { octaves: 3, seed: seed + 11 }) - 0.5) * 0.08 * smoothstep(0.5, 3, land);
    const beach = land * 0.045 * bankSteepness;
    const rise = smoothstep(beachWidth, beachWidth + 45, land) * bankSteepness * 3;
    const roll = fbm(x * 0.012, z * 0.012, { octaves: 4, seed: seed + 1 });
    const hillAmount = smoothstep(20, 150, land) * hills * (0.2 + roll * 1.5);
    return 0.012 + beach + rise + hillAmount + bump;
  }

  // Stands: built straight out from the bank over the water.
  const standBoxes = stands.map((st, i) => {
    const z0 = shoreZ(st.x);
    const width = st.width ?? 2.2;
    const length = st.length ?? 7;
    return {
      index: i, x: st.x, kind: st.kind || 'jetty', width, length,
      zLand: z0 - 3, zEnd: z0 + length, deckY: DECK_Y,
    };
  });

  function standAt(x, z) {
    for (const b of standBoxes) {
      if (Math.abs(x - b.x) <= b.width / 2 && z >= b.zLand && z <= b.zEnd) return b;
    }
    return null;
  }

  // Where an angler can stand: dry land, or out on a stand's deck.
  function isWalkable(x, z) {
    return !!standAt(x, z) || waterDist(x, z) < -0.35;
  }

  // Height of whatever you're standing on.
  function floorHeight(x, z) {
    const b = standAt(x, z);
    return b ? Math.max(b.deckY, groundHeight(x, z)) : groundHeight(x, z);
  }

  const main = standBoxes[0];
  const spawn = main
    ? { x: main.x, z: main.zEnd - 1.6, yaw: Math.PI }
    : { x: 0, z: shoreZ(0) - 4, yaw: Math.PI };

  return {
    shoreZ, farShoreZ, waterDist, isWater, depthAt, depthFactorAt, zoneAt,
    groundHeight, floorHeight, isWalkable, standAt, stands: standBoxes, spawn,
    spec: { maxDepth, depthSlope, farShore, beachWidth, bankSteepness, hills, structure },
  };
}
