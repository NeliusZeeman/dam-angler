// Rods differ the way real ones do:
//   castSpeed -- m/s the rod can launch the rig at full power (see
//             castPhysics.js): roughly 24m for the fibreglass starter, 38m
//             spinning, 34m bass, 52m heavy, 62m for the 12ft carp rod.
//   spread  -- casting accuracy, degrees of scatter (the bass rod is the
//             pinpoint one: it's built for dropping lures on structure).
//   action -- WHERE the blank bends. Fast bends only in the tip; moderate
//             through about the top half; "through" (parabolic) all the way
//             down into the handle.
//   power  -- HOW HARD it is to bend (light .. heavy).
// flex.length is how much of the 1.45m flexing blank takes the bend (short
// = fast action), flex.softness scales how far it bows under the same load.
// shockAbsorb is how much of a fish's sudden run the blank soaks up before
// it reaches the line: moderate/through rods cushion lunges (why bass
// crankbait rods are moderate action, and why carp rods fight "like a
// bungee"), stiff fast rods pass the shock straight on.
export const RODS = [
  {
    id: 'rod-starter', name: 'Starter Rod (Fibreglass)', tier: 1, cost: 0, castSpeed: 17, spread: 4, tensionTolerance: 1.0,
    action: 'moderate', power: 'light', flex: { length: 1.0, softness: 1.45 }, shockAbsorb: 0.15,
    look: { blank: 0x3a2a1c, wrap: 0x9a2a22 },
  },
  {
    id: 'rod-spinning', name: 'Spinning Rod', tier: 2, cost: 250, castSpeed: 23, spread: 2.5, tensionTolerance: 1.4,
    action: 'fast', power: 'medium', flex: { length: 0.55, softness: 1.0 }, shockAbsorb: 0.05,
    look: { blank: 0x5d6670, wrap: 0x1f4f9a },
  },
  // Moderate action so a bass can properly eat a crankbait and the flex keeps
  // the trebles pinned when it lunges and jumps.
  {
    id: 'rod-bass', name: 'Bass Crankbait Rod', tier: 2, cost: 420, castSpeed: 21.5, spread: 1.2, tensionTolerance: 1.6,
    action: 'moderate', power: 'medium', flex: { length: 0.95, softness: 1.3 }, shockAbsorb: 0.32,
    look: { blank: 0x1d3a26, wrap: 0xd8d8d8 },
  },
  // 12ft, 2.75lb test curve, through action: casts a heavy lead a long way
  // and bends right down into the handle under a big carp.
  {
    id: 'rod-carp', name: 'Carp Rod (2.75lb TC)', tier: 3, cost: 650, castSpeed: 35, spread: 3, tensionTolerance: 1.9,
    action: 'through', power: 'medium-heavy', flex: { length: 1.45, softness: 1.15 }, shockAbsorb: 0.45,
    look: { blank: 0x2b2b30, wrap: 0x6b8f3a },
  },
  // Real SA barbel/tigerfish rigs call for a rod "with backbone and pulling
  // power" and a big reel -- fast action, heavy power: it hardly budges.
  {
    id: 'rod-heavy', name: 'Heavy-Duty Rod', tier: 3, cost: 900, castSpeed: 31, spread: 2.5, tensionTolerance: 2.2,
    action: 'fast', power: 'heavy', flex: { length: 0.6, softness: 0.6 }, shockAbsorb: 0.1,
    look: { blank: 0x121216, wrap: 0xc9a13a },
  },
];

// castMultiplier: thinner, slicker line flies off the spool further --
// braid is the long-cast choice, thick fluoro a touch less so.
export const LINES = [
  { id: 'line-starter', name: 'Starter Line (10lb)', tier: 1, cost: 0, breakStrength: 1.0, castMultiplier: 1.0 },
  { id: 'line-braid', name: 'Braided Line (20lb)', tier: 2, cost: 150, breakStrength: 1.6, castMultiplier: 1.15 },
  { id: 'line-fluoro', name: 'Fluorocarbon Leader (30lb)', tier: 3, cost: 500, breakStrength: 2.4, castMultiplier: 1.08 },
];

// Reels: a bigger, smoother spool casts further, and a better drag system
// absorbs a fish's runs during the fight (dragBonus adds to rod tolerance).
export const REELS = [
  { id: 'reel-starter', name: 'Starter Reel', tier: 1, cost: 0, castMultiplier: 1.0, dragBonus: 0 },
  { id: 'reel-spinning', name: 'Spinning Reel (Coffee Grinder)', tier: 2, cost: 200, castMultiplier: 1.18, dragBonus: 0.15 },
  // The big-pit / baitrunner style reel SA carp and barbel anglers use for
  // long casts and heavy fish.
  { id: 'reel-bigpit', name: 'Big Pit Reel', tier: 3, cost: 700, castMultiplier: 1.4, dragBonus: 0.35 },
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
  { id: 'bread-bait', name: 'Bread Bait', kind: 'bait', cost: 0, speciesIds: ['mozambique-tilapia', 'common-carp', 'mirror-carp', 'mudfish'] },
  { id: 'worm', name: 'Worm', kind: 'bait', cost: 20, speciesIds: ['mozambique-tilapia', 'banded-tilapia', 'common-carp', 'mirror-carp', 'catfish', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish'] },
  { id: 'mielies', name: 'Mielies (Corn)', kind: 'bait', cost: 20, speciesIds: ['common-carp', 'mirror-carp', 'mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish'] },
  { id: 'chicken-liver', name: 'Chicken Liver', kind: 'bait', cost: 35, speciesIds: ['catfish'] },
  { id: 'frog-bait', name: 'Frog (Platanna)', kind: 'bait', cost: 45, speciesIds: ['catfish'] },
  { id: 'spinner', name: 'Spinnerbait', kind: 'lure', cost: 90, speciesIds: ['largemouth-bass', 'smallmouth-bass', 'tigerfish', 'mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', kind: 'lure', cost: 120, speciesIds: ['largemouth-bass'] },
  { id: 'spoon-lure', name: 'Spoon Lure', kind: 'lure', cost: 140, speciesIds: ['tigerfish', 'largemouth-bass', 'smallmouth-bass', 'largescale-yellowfish'] },
];

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
