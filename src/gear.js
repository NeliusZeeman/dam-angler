export const RODS = [
  { id: 'rod-starter', name: 'Starter Rod', tier: 1, cost: 0, castDistance: 12, tensionTolerance: 1.0 },
  { id: 'rod-spinning', name: 'Spinning Rod', tier: 2, cost: 250, castDistance: 18, tensionTolerance: 1.4 },
  // Real SA barbel/tigerfish rigs call for a rod "with backbone and pulling
  // power" and a big reel — this is that rod.
  { id: 'rod-heavy', name: 'Heavy-Duty Rod', tier: 3, cost: 900, castDistance: 24, tensionTolerance: 2.2 },
];

export const LINES = [
  { id: 'line-starter', name: 'Starter Line (10lb)', tier: 1, cost: 0, breakStrength: 1.0 },
  { id: 'line-braid', name: 'Braided Line (20lb)', tier: 2, cost: 150, breakStrength: 1.6 },
  { id: 'line-fluoro', name: 'Fluorocarbon Leader (30lb)', tier: 3, cost: 500, breakStrength: 2.4 },
];

// Hooks/rigs: a small tensionBonus widens the reel minigame's safe zone
// (a better-set hook holds better), and speciesBonus nudges payout for the
// rig it's built for. Wire Trace is not a bonus item — it is required to
// land a tigerfish at all; see requiresWireTrace handling in fish.js/main.js.
export const HOOKS = [
  { id: 'hook-small', name: 'Small Hook', cost: 0, tensionBonus: 0, speciesBonus: {}, isWireTrace: false },
  { id: 'hook-circle', name: 'Circle Hook', cost: 40, tensionBonus: 0.25, speciesBonus: {}, isWireTrace: false },
  // "A double J-hook trace is recommended" for big carp.
  {
    id: 'hook-double-j', name: 'Double J-Hook Rig', cost: 70, tensionBonus: 0.1,
    speciesBonus: { 'common-carp': 1.2, 'mirror-carp': 1.25 }, isWireTrace: false,
  },
  // Tigerfish teeth bite clean through ordinary line without this.
  {
    id: 'hook-wire-trace', name: 'Wire Trace Rig', cost: 180, tensionBonus: 0.15,
    speciesBonus: { tigerfish: 1.15 }, isWireTrace: true,
  },
];

// Bait & lures, matched to real South African tackle for each species.
// kind: 'bait' sits still and waits (mouse movement only wiggles it);
// 'lure' is worked -- moving the mouse sweeps the rod and retrieves it.
export const LURES = [
  { id: 'bread-bait', name: 'Bread Bait', kind: 'bait', cost: 0, speciesIds: ['mozambique-tilapia'] },
  { id: 'worm', name: 'Worm', kind: 'bait', cost: 20, speciesIds: ['mozambique-tilapia', 'banded-tilapia', 'common-carp', 'mirror-carp', 'catfish'] },
  { id: 'mielies', name: 'Mielies (Corn)', kind: 'bait', cost: 20, speciesIds: ['common-carp', 'mirror-carp', 'mozambique-tilapia', 'banded-tilapia'] },
  { id: 'chicken-liver', name: 'Chicken Liver', kind: 'bait', cost: 35, speciesIds: ['catfish'] },
  { id: 'frog-bait', name: 'Frog (Platanna)', kind: 'bait', cost: 45, speciesIds: ['catfish'] },
  { id: 'spinner', name: 'Spinnerbait', kind: 'lure', cost: 90, speciesIds: ['largemouth-bass', 'smallmouth-bass', 'tigerfish', 'mozambique-tilapia', 'banded-tilapia'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', kind: 'lure', cost: 120, speciesIds: ['largemouth-bass'] },
  { id: 'spoon-lure', name: 'Spoon Lure', kind: 'lure', cost: 140, speciesIds: ['tigerfish', 'largemouth-bass', 'smallmouth-bass'] },
];

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
