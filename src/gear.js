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

// Lines as SA tackle shops sell them, with their real breaking strains.
//   breakKg   the rated breaking strain. In the fight the tension bar is the
//             share of this the fish is pulling, so a stronger line takes
//             the same fish much further from snapping.
//   type      mono stretches and cushions a fish's lunges; braid has almost
//             no stretch (every run hits harder) but is thin, casts further
//             and is far stronger for its size; fluorocarbon is near
//             invisible under water, so line-shy fish bite more readily.
//   castMultiplier  thin, slick line flies off the spool further.
//   biteBonus  line-shy fish (bass, tigers, yellowfish in clear water) take
//             a bait on fluorocarbon more readily.
// Forum guidance used: carp 12-15lb mono (a SA forum: 14lb/6.8kg is the
// minimum to cast a mielie-bom, 18lb/8.1kg is safer); barbel 20-30lb and
// "the heavier the better"; bass 10-15lb fluoro or 30lb braid; tigerfish a
// 20-30lb leader to a wire trace.
// breakStrength (breakKg relative to the 4.5kg starter) is kept for payouts.
const LINE_SHY = { 'largemouth-bass': 1.25, 'smallmouth-bass': 1.25, tigerfish: 1.2, 'smallmouth-yellowfish': 1.2, 'largescale-yellowfish': 1.2 };
export const LINES = [
  {
    id: 'line-starter', name: 'Starter Mono 10lb (4.5kg)', tier: 1, cost: 0,
    breakKg: 4.5, type: 'mono', castMultiplier: 1.0, note: 'Fine for kurper; big fish will snap it',
  },
  {
    id: 'line-mono-12', name: 'Berkley Trilene XL 12lb (5.4kg)', tier: 1, cost: 60,
    breakKg: 5.4, type: 'mono', castMultiplier: 1.02, note: 'Supple all-rounder — bait and float fishing',
  },
  {
    id: 'line-carp-15', name: 'Carp Mono 15lb (6.8kg)', tier: 2, cost: 120,
    breakKg: 6.8, type: 'mono', castMultiplier: 1.0, note: 'The SA carp standard — minimum for casting a mielie-bom',
  },
  {
    id: 'line-fluoro', name: 'Berkley Vanish Fluorocarbon 15lb (6.8kg)', tier: 2, cost: 260,
    breakKg: 6.8, type: 'fluoro', castMultiplier: 1.0, biteBonus: LINE_SHY,
    note: 'Near-invisible: bass, tigers and yellowfish bite more',
  },
  {
    id: 'line-mono-20', name: 'Trilene Big Game 20lb (9.1kg)', tier: 2, cost: 200,
    breakKg: 9.1, type: 'mono', castMultiplier: 0.95, note: 'Thick and tough — barbel and big carp',
  },
  {
    id: 'line-braid', name: 'Sufix 832 Braid 20lb (9.2kg)', tier: 3, cost: 380,
    breakKg: 9.2, type: 'braid', castMultiplier: 1.15, note: 'Thin, casts far, no stretch — runs hit harder (SA shops ~R700)',
  },
  {
    id: 'line-jbraid-30', name: 'Daiwa J-Braid X8 30lb (13.6kg)', tier: 3, cost: 600,
    breakKg: 13.6, type: 'braid', castMultiplier: 1.12, note: 'Top braid for barbel and big carp (SA shops ~R1,000)',
  },
].map((l) => ({ ...l, breakStrength: l.breakKg / 4.5 }));

// Reels: a bigger, smoother spool casts further, and a better drag system
// absorbs a fish's runs during the fight (dragBonus adds to rod tolerance).
export const REELS = [
  { id: 'reel-starter', name: 'Starter Reel', tier: 1, cost: 0, castMultiplier: 1.0, dragBonus: 0 },
  { id: 'reel-spinning', name: 'Spinning Reel (Coffee Grinder)', tier: 2, cost: 200, castMultiplier: 1.18, dragBonus: 0.15 },
  // The big-pit / baitrunner style reel SA carp and barbel anglers use for
  // long casts and heavy fish.
  { id: 'reel-bigpit', name: 'Big Pit Reel', tier: 3, cost: 700, castMultiplier: 1.4, dragBonus: 0.35 },
];

// Hooks and rigs, as SA anglers use them.
//   strengthKg  roughly the pull a hook takes before a fine wire opens up
//               or it tears out. Put a big fish on a small hook, pull hard,
//               and it straightens -- size and wire matter.
//   holdBonus   0..1: how well it stays in. A hair rig or circle hook sets
//               itself in the corner of the mouth and rarely comes out on
//               a jump or a moment of slack line.
//   biteBonus   the right hook for the fish gets more bites (a size-10 for
//               little kurper mouths, a hair rig for carp, an offset worm
//               hook for bass on soft plastics).
//   tensionBonus  a well-set hook eases the fight a touch.
//   speciesBonus  payout bonus for the fish the rig is built for.
// Wire trace isn't a bonus: it's required to land a tigerfish at all.
export const HOOKS = [
  {
    id: 'hook-small', name: 'Size 10 Fine-Wire Hook', cost: 0, tensionBonus: 0, speciesBonus: {}, isWireTrace: false,
    strengthKg: 2.5, holdBonus: 0, biteBonus: { 'mozambique-tilapia': 1.2, 'banded-tilapia': 1.3, mudfish: 1.1 },
    note: 'Small mouths — kurper love it. Straightens on a big fish',
  },
  {
    id: 'hook-baitholder', name: 'Mustad Baitholder Size 2', cost: 30, tensionBonus: 0.05, speciesBonus: {}, isWireTrace: false,
    strengthKg: 7, holdBonus: 0.1, biteBonus: {},
    note: 'The SA all-rounder for worms, bread and mielies',
  },
  // SA kurper and carp anglers: "a double hook trace with 2x size 8 Owner
  // carp hooks" for bigger fish.
  {
    id: 'hook-double-j', name: 'Double Hook Trace (2x Owner Carp 8)', cost: 70, tensionBonus: 0.1,
    speciesBonus: { 'common-carp': 1.2, 'mirror-carp': 1.25 }, isWireTrace: false,
    strengthKg: 8, holdBonus: 0.15, biteBonus: { 'common-carp': 1.2, 'mirror-carp': 1.2, 'mozambique-tilapia': 1.1 },
    note: 'Two hooks, twice the hold — bigger kurper and carp',
  },
  {
    id: 'hook-carp-hair', name: 'Korda Kurv Size 6 Hair Rig', cost: 110, tensionBonus: 0.15,
    speciesBonus: { 'common-carp': 1.15, 'mirror-carp': 1.2 }, isWireTrace: false,
    strengthKg: 12, holdBonus: 0.35,
    biteBonus: { 'common-carp': 1.35, 'mirror-carp': 1.35, mudfish: 1.1, 'smallmouth-yellowfish': 1.1 },
    note: 'Bait on a hair, bare hook sets itself — the carp specialist rig',
  },
  {
    id: 'hook-circle', name: 'Circle Hook 2/0', cost: 60, tensionBonus: 0.25, speciesBonus: {}, isWireTrace: false,
    strengthKg: 14, holdBonus: 0.4, biteBonus: { catfish: 1.2 },
    note: 'Hooks the corner of the mouth and stays — barbel favourite',
  },
  {
    id: 'hook-offset-worm', name: 'Gamakatsu EWG Offset 3/0', cost: 90, tensionBonus: 0.1, speciesBonus: { 'largemouth-bass': 1.1 }, isWireTrace: false,
    strengthKg: 11, holdBonus: 0.25, biteBonus: { 'largemouth-bass': 1.3, 'smallmouth-bass': 1.3 },
    note: 'Weedless soft-plastic hook for bass in cover',
  },
  // Jozini guides: a 20-30lb leader to 40lb knottable wire. Tigerfish teeth
  // bite clean through ordinary line without it.
  {
    id: 'hook-wire-trace', name: 'Wire Trace 40lb + 1/0 Hook', cost: 180, tensionBonus: 0.15,
    speciesBonus: { tigerfish: 1.15 }, isWireTrace: true,
    strengthKg: 16, holdBonus: 0.1, biteBonus: {},
    note: 'Required for tigerfish — their teeth cut through line',
  },
];

// Bait & lures, matched to real South African tackle for each species.
// kind: 'bait' sits still and waits (mouse movement only wiggles it);
// 'lure' is worked -- moving the mouse sweeps the rod and retrieves it.
export const LURES = [
  { id: 'bread-bait', name: 'Bread Bait', kind: 'bait', cost: 0, speciesIds: ['mozambique-tilapia', 'common-carp', 'mirror-carp', 'mudfish'] },
  { id: 'worm', name: 'Worm', kind: 'bait', cost: 20, speciesIds: ['mozambique-tilapia', 'banded-tilapia', 'common-carp', 'mirror-carp', 'catfish', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish'] },
  { id: 'mielies', name: 'Mielies (Corn)', kind: 'bait', cost: 20, speciesIds: ['common-carp', 'mirror-carp', 'mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish'] },
  // A ball of mielie-meal groundbait packed round a weighted feeder. The
  // weight (~40g) carries it through the air: less drag slowing it than a
  // float rig, so it flies further -- as long as the rod can handle it.
  // Once in, it breaks down into a feeding spot around the hook.
  {
    id: 'mieliebom', name: 'Mieliebom (Groundbait Feeder)', kind: 'bait', cost: 60,
    castDrag: 0.0055, heavy: true, groundbait: true,
    note: 'Heavy: casts further · builds a feeding spot · carp love it',
    speciesIds: ['common-carp', 'mirror-carp', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish', 'mozambique-tilapia', 'banded-tilapia'],
  },
  { id: 'chicken-liver', name: 'Chicken Liver', kind: 'bait', cost: 35, speciesIds: ['catfish'] },
  { id: 'frog-bait', name: 'Frog (Platanna)', kind: 'bait', cost: 45, speciesIds: ['catfish'] },
  { id: 'spinner', name: 'Spinnerbait', kind: 'lure', cost: 90, speciesIds: ['largemouth-bass', 'smallmouth-bass', 'tigerfish', 'mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', kind: 'lure', cost: 120, speciesIds: ['largemouth-bass'] },
  { id: 'spoon-lure', name: 'Spoon Lure', kind: 'lure', cost: 140, speciesIds: ['tigerfish', 'largemouth-bass', 'smallmouth-bass', 'largescale-yellowfish'] },
];

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
