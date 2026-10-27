// Reading the water: how deep the bait is fishing, where fish feed in the
// water column, drop-offs, and the bank the wind is blowing onto.

import { ENGINE } from './tuning/engine.js';
import { rigFor } from './gfx/terminalTackle.js';

// Where each fish feeds: 'bottom', or a [min, max] depth band in metres.
export const FEED_DEPTH = {
  'common-carp': 'bottom', 'mirror-carp': 'bottom', catfish: 'bottom', mudfish: 'bottom',
  'mozambique-tilapia': [0.4, 2], 'banded-tilapia': [0.3, 1.6], bluegill: [0.3, 1.8],
  'largemouth-bass': [0.8, 3.5], 'smallmouth-bass': [1, 3.5],
  'smallmouth-yellowfish': [1, 4], 'largescale-yellowfish': [1.2, 5], 'largemouth-yellowfish': [1, 5], 'clanwilliam-yellowfish': [0.8, 3.5],
  'rainbow-trout': [0.5, 3], 'brown-trout': [1, 4],
  tigerfish: [0, 2],
};

// How deep each lure swims (metres), or 'bottom' / 'surface'.
const LURE_DEPTH = {
  'topwater-frog': 'surface', 'frog-bait': 'surface', 'fly-dry': 'surface',
  spinner: 0.8, crankbait: 1.5, 'rapala-minnow': 1.0, 'spoon-lure': 1.6,
  'soft-plastic': 'bottom', 'bass-jig': 'bottom',
  'fly-nymph': 1.0, 'fly-zak': 1.2, 'fly-streamer': 1.5, 'fly-walkers-killer': 1.2, 'fly-damsel': 1.0,
};

// Where the bait or lure is fishing: { depth (m), onBottom }.
export function baitDepth({ lure, floatDepthM = 1.5, waterDepthM }) {
  const water = Math.max(0.1, waterDepthM);
  const rig = rigFor(lure);
  if (rig === 'float') {
    const d = Math.min(floatDepthM, water);
    return { depth: d, onBottom: floatDepthM >= water - 0.1 };
  }
  if (rig === 'bottom') return { depth: water, onBottom: true };
  const l = LURE_DEPTH[lure?.id] ?? (lure?.kind === 'lure' ? 1 : water);
  if (l === 'bottom') return { depth: water, onBottom: true };
  if (l === 'surface') return { depth: 0, onBottom: false };
  return { depth: Math.min(l, water), onBottom: l >= water - 0.1 };
}

// Bites for the depth the bait is fishing at: right depth x1.4, a long way
// off down to x0.35 (tunable as ENGINE.water.rightDepth).
export function depthMultiplier(speciesId, bait) {
  const want = FEED_DEPTH[speciesId];
  const best = ENGINE.water.rightDepth;
  if (!want) return 1;
  if (want === 'bottom') return bait.onBottom ? best : 0.55;
  const [lo, hi] = want;
  const off = bait.depth < lo ? lo - bait.depth : bait.depth > hi ? bait.depth - hi : 0;
  return off === 0 ? best : Math.max(0.35, best - off * 0.5);
}

// How steeply the bottom falls away here (metres of depth per metre).
export function slopeAt(depthAt, x, z, r = 3) {
  const d = [depthAt(x + r, z), depthAt(x - r, z), depthAt(x, z + r), depthAt(x, z - r)];
  return (Math.max(...d) - Math.min(...d)) / (2 * r);
}

// Is this spot close to the bank the wind is blowing onto? Walks down-wind
// from it: if land comes within `reach` metres, food is being blown here.
export function onWindwardBank(isWater, x, z, windDirX, windDirZ, windSpeed, reach = 25) {
  if (windSpeed < ENGINE.water.windMin) return false;
  const len = Math.hypot(windDirX, windDirZ) || 1;
  const dx = windDirX / len, dz = windDirZ / len;
  for (let d = 3; d <= reach; d += 3) if (!isWater(x + dx * d, z + dz * d)) return true;
  return false;
}

// Fish that patrol drop-offs, and fish that follow the wind.
const DROP_OFF_FISH = new Set(['largemouth-bass', 'smallmouth-bass', 'smallmouth-yellowfish', 'largescale-yellowfish', 'largemouth-yellowfish', 'clanwilliam-yellowfish', 'tigerfish', 'rainbow-trout', 'brown-trout']);
const WIND_FISH = new Set(['common-carp', 'mirror-carp', 'smallmouth-yellowfish', 'largescale-yellowfish', 'largemouth-yellowfish', 'mozambique-tilapia']);

// Everything about a spot that matters for the fish: { depthM, zone, dropOff, windward }.
export function readSpot(dam, x, z, wind = {}) {
  const zone = dam.zoneAt(x, z);
  return {
    depthM: dam.depthAt(x, z),
    zone: zone.type === 'structure' ? zone.kind : null,
    dropOff: slopeAt(dam.depthAt, x, z) >= ENGINE.water.dropOffSlope,
    windward: onWindwardBank(dam.isWater, x, z, wind.windDirX ?? 1, wind.windDirZ ?? 0, wind.windSpeed ?? 0),
  };
}

// Bites for a spot and how the bait is presented there.
export function waterMultiplier(speciesId, spot, bait) {
  let m = depthMultiplier(speciesId, bait);
  if (spot.dropOff && DROP_OFF_FISH.has(speciesId)) m *= ENGINE.water.dropOffBonus;
  if (spot.windward && WIND_FISH.has(speciesId)) m *= ENGINE.water.windBonus;
  return m;
}

const ZONE_NAMES = { pads: 'lily pads', reeds: 'reeds', timber: 'drowned timber', weed: 'weed bed', hyacinth: 'hyacinth' };
export const zoneName = (kind) => (kind ? ZONE_NAMES[kind] || kind : null);

// "2.4 m deep · weed bed · drop-off · wind blowing in"
export function describeSpot(spot) {
  return [`${spot.depthM.toFixed(1)} m deep`, zoneName(spot.zone), spot.dropOff ? 'drop-off' : null, spot.windward ? 'wind blowing in' : null]
    .filter(Boolean).join(' · ');
}
