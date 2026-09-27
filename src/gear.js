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
// maxKg is roughly the pull the blank is built to lift (its line class):
// bend it past that and it locks up -- no more cushion, and the hook takes
// every jolt.
// shockAbsorb is how much of a fish's sudden run the blank soaks up before
// it reaches the line: moderate/through rods cushion lunges (why bass
// crankbait rods are moderate action, and why carp rods fight "like a
// bungee"), stiff fast rods pass the shock straight on.
export const RODS = [
  {
    id: 'rod-starter', maxKg: 5, name: 'Starter Rod (Fibreglass)', tier: 1, cost: 0, castSpeed: 17, spread: 4, tensionTolerance: 1.0,
    action: 'moderate', power: 'light', flex: { length: 1.0, softness: 1.45 }, shockAbsorb: 0.15,
    look: { blank: 0x3a2a1c, wrap: 0x9a2a22 },
  },
  // A light 1.8m "kurper rod": a soft, sensitive tip shows the tiniest
  // nibble, so small-mouthed kurper and bluegill get hooked more often.
  // SA shops sell kurper combos from ~R450 (Okuma Fin Chaser).
  {
    id: 'rod-kurper', maxKg: 3.5, name: 'Ultralight Kurper Rod (1.8m)', tier: 1, cost: 150, castSpeed: 18, spread: 2.2, tensionTolerance: 1.1,
    action: 'moderate', power: 'light', flex: { length: 0.9, softness: 1.6 }, shockAbsorb: 0.25,
    biteBonus: { 'mozambique-tilapia': 1.2, 'banded-tilapia': 1.25, bluegill: 1.2 },
    note: 'Sensitive tip — kurper nibbles turn into hook-ups',
    look: { blank: 0x6a4a2a, wrap: 0xe0c040 },
  },
  {
    id: 'rod-spinning', maxKg: 7, name: 'Spinning Rod', tier: 2, cost: 250, castSpeed: 23, spread: 2.5, tensionTolerance: 1.4,
    action: 'fast', power: 'medium', flex: { length: 0.55, softness: 1.0 }, shockAbsorb: 0.05,
    look: { blank: 0x5d6670, wrap: 0x1f4f9a },
  },
  // A 9ft 5-weight: the standard SA trout and yellowfish fly rod. Short,
  // accurate casts to ~25m (the line, not a weight, carries the fly), a soft
  // full-length bend that protects light tippet.
  {
    id: 'rod-fly', maxKg: 4.5, name: 'Fly Rod (2.7m 5-weight)', tier: 2, cost: 350, castSpeed: 17.5, spread: 1.3, tensionTolerance: 1.45, fly: true,
    action: 'moderate', power: 'light', flex: { length: 1.4, softness: 1.7 }, shockAbsorb: 0.45,
    look: { blank: 0x3e4a2a, wrap: 0xb08a3a },
  },
  // A short 7ft 3-weight for small mountain streams: delicate presentation
  // under overhanging trees, and a small fish feels like a big one.
  {
    id: 'rod-fly-3wt', maxKg: 3, name: 'Stream Fly Rod (2.1m 3-weight)', tier: 2, cost: 390, castSpeed: 17, spread: 1.25, tensionTolerance: 1.5, fly: true,
    action: 'moderate', power: 'light', flex: { length: 1.3, softness: 1.9 }, shockAbsorb: 0.5,
    biteBonus: { 'rainbow-trout': 1.15, 'brown-trout': 1.2, 'clanwilliam-yellowfish': 1.15, bluegill: 1.1 },
    note: 'Mountain streams: soft landing, spooks fewer trout',
    look: { blank: 0x5a3a22, wrap: 0x2f6a4a },
  },
  // Moderate action so a bass can properly eat a crankbait and the flex keeps
  // the trebles pinned when it lunges and jumps.
  {
    id: 'rod-bass', maxKg: 8, name: 'Bass Crankbait Rod', tier: 2, cost: 420, castSpeed: 21.5, spread: 1.2, tensionTolerance: 1.6,
    action: 'moderate', power: 'medium', flex: { length: 0.95, softness: 1.3 }, shockAbsorb: 0.32,
    look: { blank: 0x1d3a26, wrap: 0xd8d8d8 },
  },
  // A 7ft medium-heavy casting rod for a baitcaster: the SA bass standard
  // for frogs, jigs and crankbaits in heavy cover.
  {
    id: 'rod-baitcast', maxKg: 11, name: 'Baitcasting Rod (2.1m MH)', tier: 3, cost: 560, castSpeed: 24, spread: 1.2, tensionTolerance: 1.75,
    action: 'fast', power: 'medium-heavy', flex: { length: 0.7, softness: 0.9 }, shockAbsorb: 0.15,
    biteBonus: { 'largemouth-bass': 1.1 },
    note: 'Pinpoint casts into cover, backbone to drag bass out',
    look: { blank: 0x1a1a2e, wrap: 0xc03030 },
  },
  // 12ft, 2.75lb test curve, through action: casts a heavy lead a long way
  // and bends right down into the handle under a big carp.
  {
    id: 'rod-carp', maxKg: 12, name: 'Carp Rod (3.6m, 1.25kg TC)', tier: 3, cost: 650, castSpeed: 35, spread: 3, tensionTolerance: 1.9,
    action: 'through', power: 'medium-heavy', flex: { length: 1.45, softness: 1.15 }, shockAbsorb: 0.45,
    look: { blank: 0x2b2b30, wrap: 0x6b8f3a },
  },
  // Real SA barbel/tigerfish rigs call for a rod "with backbone and pulling
  // power" and a big reel -- fast action, heavy power: it hardly budges.
  {
    id: 'rod-heavy', maxKg: 18, name: 'Heavy-Duty Rod', tier: 3, cost: 900, castSpeed: 31, spread: 2.5, tensionTolerance: 2.2,
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
    id: 'line-starter', name: 'Starter Mono 4.5kg', tier: 1, cost: 0,
    breakKg: 4.5, type: 'mono', castMultiplier: 1.0, note: 'Fine for kurper; big fish will snap it',
  },
  {
    id: 'line-mono-12', name: 'Berkley Trilene XL 5.4kg', tier: 1, cost: 60,
    breakKg: 5.4, type: 'mono', castMultiplier: 1.02, note: 'Supple all-rounder — bait and float fishing',
  },
  {
    id: 'line-carp-15', name: 'Carp Mono 6.8kg', tier: 2, cost: 120,
    breakKg: 6.8, type: 'mono', castMultiplier: 1.0, note: 'The SA carp standard — minimum for casting a mielie-bom',
  },
  {
    id: 'line-fluoro', name: 'Berkley Vanish Fluorocarbon 6.8kg', tier: 2, cost: 260,
    breakKg: 6.8, type: 'fluoro', castMultiplier: 1.0, biteBonus: LINE_SHY,
    note: 'Near-invisible: bass, tigers and yellowfish bite more',
  },
  {
    id: 'line-mono-20', name: 'Trilene Big Game 9.1kg', tier: 2, cost: 200,
    breakKg: 9.1, type: 'mono', castMultiplier: 0.95, note: 'Thick and tough — barbel and big carp',
  },
  {
    id: 'line-fluoro-10', name: 'Seaguar Fluorocarbon 4.5kg', tier: 1, cost: 180,
    breakKg: 4.5, type: 'fluoro', castMultiplier: 1.02, biteBonus: { ...LINE_SHY, 'rainbow-trout': 1.15, 'clanwilliam-yellowfish': 1.15 },
    note: 'Light and invisible: clear-water bass and yellows. Snaps on big fish',
  },
  {
    id: 'line-braid', name: 'Sufix 832 Braid 9.2kg', tier: 3, cost: 380,
    breakKg: 9.2, type: 'braid', castMultiplier: 1.15, note: 'Thin, casts far, no stretch — runs hit harder (SA shops ~R700)',
  },
  {
    id: 'line-jbraid-30', name: 'Daiwa J-Braid X8 13.6kg', tier: 3, cost: 600,
    breakKg: 13.6, type: 'braid', castMultiplier: 1.12, note: 'Top braid for barbel and big carp (SA shops ~R1,000)',
  },
  // Frogging: bass hide under hyacinth mats and a frog is fished on heavy
  // braid that cuts through the weed and hauls the fish straight out.
  {
    id: 'line-braid-50', name: 'PowerPro Braid 22.7kg', tier: 3, cost: 750,
    breakKg: 22.7, type: 'braid', castMultiplier: 1.05, note: 'Frog fishing in hyacinth and heavy tigers — nothing breaks it',
  },
  // Fly lines: the thick, heavy line itself is what gets cast -- it loads
  // the fly rod and carries a weightless fly out. A thin nylon tippet at the
  // end is what the fish is on, so breakKg is the tippet's. SA fly shops:
  // Airflo Forge WF5F ~R700, RIO Gold ~R1,700. A 4X tippet (6lb) is the
  // usual trout and Vaal yellowfish choice; 1X (12lb) for streamers and big
  // largemouth yellows.
  {
    id: 'line-fly-float', name: 'Floating Fly Line WF5F + 4X Tippet 2.7kg', tier: 2, cost: 380,
    breakKg: 2.7, type: 'fly', sinking: false, castMultiplier: 1.15,
    biteBonus: { 'rainbow-trout': 1.25, 'brown-trout': 1.25, 'smallmouth-yellowfish': 1.2, 'clanwilliam-yellowfish': 1.25, bluegill: 1.15 },
    note: 'For dry flies and nymphs — fine tippet, gentle landing. Fly rod only (SA shops ~R700)',
  },
  {
    id: 'line-fly-sink', name: 'Intermediate Sinking Fly Line WF6I + 1X Tippet 5.4kg', tier: 3, cost: 460,
    breakKg: 5.4, type: 'fly', sinking: true, castMultiplier: 1.12,
    biteBonus: { 'largemouth-yellowfish': 1.3, 'brown-trout': 1.2, 'rainbow-trout': 1.1, 'largemouth-bass': 1.1, tigerfish: 1.1 },
    note: 'Sinks slowly: streamers deep for big trout and largemouth yellows. Fly rod only (SA shops ~R900)',
  },
].map((l) => ({ ...l, breakStrength: l.breakKg / 4.5 }));

// Reels: a bigger, smoother spool casts further, and a better drag system
// absorbs a fish's runs during the fight (dragBonus adds to rod tolerance).
export const REELS = [
  { id: 'reel-starter', name: 'Starter Reel', tier: 1, cost: 0, castMultiplier: 1.0, dragBonus: 0 },
  { id: 'reel-spinning', name: 'Spinning Reel (Coffee Grinder)', tier: 2, cost: 200, castMultiplier: 1.18, dragBonus: 0.15 },
  // Low-profile baitcaster: thumb on the spool for control, strong star drag.
  // SA shops: ~R600-R3,000 (Shimano, Okuma, Abu, 13 Fishing).
  { id: 'reel-baitcaster', name: 'Baitcaster Reel (Low Profile)', tier: 2, cost: 450, castMultiplier: 1.25, dragBonus: 0.25, note: 'Bass and tiger lures, strong drag (SA shops ~R600-R3,000)' },
  // The big-pit / baitrunner style reel SA carp and barbel anglers use for
  // long casts and heavy fish.
  { id: 'reel-bigpit', name: 'Big Pit Reel', tier: 3, cost: 700, castMultiplier: 1.4, dragBonus: 0.35 },
  // Fly reels hold the fly line; you cast off the rod, not the reel, so they
  // add no distance -- a good disc drag is what lands a running yellowfish.
  // SA shops: entry fly reels ~R1,000-1,500, a machined reel like the
  // Origin II 5/6/7 ~R3,500.
  { id: 'reel-fly', name: 'Fly Reel 5/6 (Click & Pawl)', tier: 2, cost: 220, castMultiplier: 1.0, dragBonus: 0.12, fly: true, note: 'Holds the fly line. Fly rod only (SA shops ~R1,200)' },
  { id: 'reel-fly-disc', name: 'Machined Fly Reel 5/6/7 (Sealed Disc Drag)', tier: 3, cost: 650, castMultiplier: 1.0, dragBonus: 0.3, fly: true, note: 'Smooth drag for big yellows and trout runs (SA shops ~R3,500)' },
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
  // Chod rig: a short stiff rig with a pop-up that sits just above weed or
  // silt, where a bottom bait would be hidden.
  {
    id: 'hook-chod', name: 'Chod Rig Size 6 (for Pop-Ups)', cost: 95, tensionBonus: 0.12,
    speciesBonus: { 'common-carp': 1.1, 'mirror-carp': 1.15 }, isWireTrace: false,
    strengthKg: 11, holdBonus: 0.35,
    biteBonus: { 'common-carp': 1.25, 'mirror-carp': 1.3 },
    note: 'Presents a pop-up over weed and silt',
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
    id: 'hook-wire-trace', name: 'Wire Trace 18kg + 1/0 Hook', cost: 180, tensionBonus: 0.15,
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
  // Flies: worked like a lure (a little movement brings them to life).
  // Nymphs for yellowfish and trout under the surface, dry flies for rising
  // fish, streamers for predators -- largemouth yellows, bass, even tigers.
  {
    id: 'fly-nymph', fly: true, name: 'Nymph (Gold-bead Hare\'s Ear #12)', kind: 'lure', cost: 40,
    note: 'Sinks: yellowfish and trout feed below the surface',
    speciesIds: ['rainbow-trout', 'brown-trout', 'smallmouth-yellowfish', 'largescale-yellowfish', 'clanwilliam-yellowfish', 'bluegill', 'mudfish', 'common-carp'],
  },
  {
    id: 'fly-dry', fly: true, name: 'Dry Fly (Parachute Adams #14)', kind: 'lure', cost: 40,
    note: 'Floats: trout and bluegill rising at dawn and dusk',
    speciesIds: ['rainbow-trout', 'brown-trout', 'clanwilliam-yellowfish', 'bluegill', 'smallmouth-yellowfish'],
  },
  {
    id: 'fly-streamer', fly: true, name: 'Streamer (Woolly Bugger #8)', kind: 'lure', cost: 55,
    note: 'Big predators: largemouth yellows, trout, bass and tigers',
    speciesIds: ['largemouth-yellowfish', 'rainbow-trout', 'brown-trout', 'largemouth-bass', 'smallmouth-bass', 'tigerfish', 'largescale-yellowfish'],
  },
  // More SA fly patterns. The Red-Eyed Damsel (Hugh Huntley) and Walker's
  // Killer are South African originals; the Zak is the Vaal and
  // Sterkfontein yellowfish nymph.
  {
    id: 'fly-damsel', fly: true, name: 'Red-Eyed Damsel (#10)', kind: 'lure', cost: 45,
    note: 'SA stillwater classic: rainbows cruising the shallows in spring and summer',
    speciesIds: ['rainbow-trout', 'brown-trout', 'bluegill', 'smallmouth-yellowfish', 'largemouth-bass'],
  },
  {
    id: 'fly-walkers-killer', fly: true, name: 'Walker\'s Killer (#8)', kind: 'lure', cost: 45,
    note: 'SA\'s famous wet fly — dragonfly nymph, trout dams at dusk',
    speciesIds: ['rainbow-trout', 'brown-trout', 'largemouth-yellowfish', 'largemouth-bass'],
  },
  {
    id: 'fly-zak', fly: true, name: 'Zak Nymph (#14)', kind: 'lure', cost: 40,
    note: 'The yellowfish nymph for the Vaal, Sterkfontein and Vanderkloof',
    speciesIds: ['smallmouth-yellowfish', 'clanwilliam-yellowfish', 'largescale-yellowfish', 'rainbow-trout', 'brown-trout'],
  },
  // Carp baits beyond mielies. SA shops: boilies ~R130 a kilo (Carp Pro),
  // pop-ups ~R55-R130, a Korda method feeder ~R115.
  {
    id: 'boilies', name: 'Boilies (Carp Pro 1kg)', kind: 'bait', cost: 70,
    note: 'Hard round baits kurper can\'t nibble off — for bigger carp',
    speciesIds: ['common-carp', 'mirror-carp', 'catfish'],
  },
  {
    id: 'pop-up', name: 'Pop-Ups (Fluoro 14mm)', kind: 'bait', cost: 60,
    note: 'Floats just off the bottom over weed — best on a chod rig',
    speciesIds: ['common-carp', 'mirror-carp'],
  },
  {
    id: 'method-feeder', name: 'Method Feeder (Korda 50g)', kind: 'bait', cost: 80,
    castDrag: 0.005, heavy: true, groundbait: true,
    note: 'Heavy: casts far · pellets and groundbait round the hook',
    speciesIds: ['common-carp', 'mirror-carp', 'mudfish', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mozambique-tilapia', 'bluegill'],
  },
  {
    id: 'dough-bait', name: 'Pap Dough Bait', kind: 'bait', cost: 15,
    note: 'Mielie-meal dough with flavour — the kurper and carp all-rounder',
    speciesIds: ['mozambique-tilapia', 'banded-tilapia', 'common-carp', 'mirror-carp', 'mudfish', 'bluegill'],
  },
  // Bass lures. SA shops: Sensation Baby-B crankbait ~R95.
  {
    id: 'crankbait', name: 'Crankbait (Sensation Baby-B)', kind: 'lure', cost: 95,
    note: 'Dives and wobbles — bass on rocky points and drop-offs',
    speciesIds: ['largemouth-bass', 'smallmouth-bass', 'largemouth-yellowfish', 'tigerfish'],
  },
  {
    id: 'topwater-frog', name: 'Topwater Frog (Hollow Body)', kind: 'lure', cost: 110,
    note: 'Walked over hyacinth and pads — explosive bass strikes in low light',
    speciesIds: ['largemouth-bass', 'catfish'],
  },
  {
    id: 'bass-jig', name: 'Flipping Jig (14g)', kind: 'lure', cost: 100,
    note: 'Dropped into cover and hopped on the bottom — big bass',
    speciesIds: ['largemouth-bass', 'smallmouth-bass'],
  },
  // Barbel and tiger baits.
  {
    id: 'sardine', name: 'Sardine Cut Bait', kind: 'bait', cost: 30,
    note: 'Oily and smelly — barbel find it in the dark, tigers take it too',
    speciesIds: ['catfish', 'tigerfish'],
  },
  {
    id: 'rapala-minnow', name: 'Rapala Minnow Plug', kind: 'lure', cost: 150,
    note: 'Jerked fast — tigerfish, largemouth yellows and bass (needs wire for tigers)',
    speciesIds: ['tigerfish', 'largemouth-yellowfish', 'largemouth-bass', 'smallmouth-bass', 'brown-trout'],
  },
  { id: 'frog-bait', name: 'Frog (Platanna)', kind: 'bait', cost: 45, speciesIds: ['catfish'] },
  { id: 'spinner', name: 'Spinnerbait', kind: 'lure', cost: 90, speciesIds: ['largemouth-bass', 'smallmouth-bass', 'tigerfish', 'mozambique-tilapia', 'banded-tilapia', 'smallmouth-yellowfish', 'largescale-yellowfish'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', kind: 'lure', cost: 120, speciesIds: ['largemouth-bass'] },
  { id: 'spoon-lure', name: 'Spoon Lure', kind: 'lure', cost: 140, speciesIds: ['tigerfish', 'largemouth-bass', 'smallmouth-bass', 'largescale-yellowfish'] },
];

// Tackle box sections: gear grouped by the kind of fishing it's for, the
// way a SA tackle shop lays out its aisles. An item can sit in more than
// one (a spinnerbait is bass and tigerfish tackle; mielies are carp and
// everyday bait).
export const TACKLE_SECTIONS = [
  { id: 'general', label: 'General', blurb: 'Everyday tackle: kurper, a bit of everything, and where everyone starts.' },
  { id: 'carp', label: 'Carp', blurb: 'Long rods, big-pit reels, hair rigs and mieliebom — the SA carp scene.' },
  { id: 'bass', label: 'Bass', blurb: 'Accurate rods, fluorocarbon and braid, soft plastics and spinnerbaits for largemouth and smallmouth.' },
  { id: 'fly', label: 'Fly & Trout', blurb: 'Fly rod, fly reels, fly lines and flies — trout, yellowfish and bluegill.' },
  { id: 'predator', label: 'Barbel & Tiger', blurb: 'Heavy rods, strong line, circle hooks and wire traces for barbel and tigerfish.' },
];
const SECTIONS_OF = {
  'rod-starter': ['general'], 'rod-kurper': ['general'], 'rod-spinning': ['general', 'bass'], 'rod-fly': ['fly'],
  'rod-fly-3wt': ['fly'], 'rod-bass': ['bass'], 'rod-baitcast': ['bass', 'predator'],
  'rod-carp': ['carp'], 'rod-heavy': ['predator'],
  'line-starter': ['general'], 'line-mono-12': ['general'], 'line-carp-15': ['carp'], 'line-fluoro': ['bass'],
  'line-mono-20': ['predator', 'carp'], 'line-braid': ['bass', 'general'], 'line-jbraid-30': ['predator', 'carp'],
  'line-fly-float': ['fly'], 'line-fly-sink': ['fly'], 'line-fluoro-10': ['bass', 'general'], 'line-braid-50': ['bass', 'predator'],
  'reel-starter': ['general'], 'reel-spinning': ['general', 'bass'], 'reel-bigpit': ['carp', 'predator'],
  'reel-fly': ['fly'], 'reel-fly-disc': ['fly'], 'reel-baitcaster': ['bass', 'predator'],
  'hook-small': ['general'], 'hook-baitholder': ['general'], 'hook-double-j': ['carp', 'general'],
  'hook-carp-hair': ['carp'], 'hook-chod': ['carp'], 'hook-circle': ['predator'], 'hook-offset-worm': ['bass'], 'hook-wire-trace': ['predator'],
  'bread-bait': ['general', 'carp'], worm: ['general'], mielies: ['general', 'carp'], mieliebom: ['carp'],
  'chicken-liver': ['predator'], 'fly-nymph': ['fly'], 'fly-dry': ['fly'], 'fly-streamer': ['fly'],
  'frog-bait': ['predator'], 'fly-damsel': ['fly'], 'fly-walkers-killer': ['fly'], 'fly-zak': ['fly'],
  boilies: ['carp'], 'pop-up': ['carp'], 'method-feeder': ['carp'], 'dough-bait': ['general', 'carp'],
  crankbait: ['bass'], 'topwater-frog': ['bass'], 'bass-jig': ['bass'], sardine: ['predator'], 'rapala-minnow': ['predator', 'bass'], spinner: ['bass', 'predator'], 'soft-plastic': ['bass'], 'spoon-lure': ['bass', 'predator'],
};
// Anything new and unlisted shows under General until it's given a home.
export function sectionsFor(item) {
  return SECTIONS_OF[item.id] || ['general'];
}

// Does this rig belong together? Wrong pairings still work, just badly:
// a fly weighs nothing, so without a fly rod and fly line it drops at your
// feet; a fly line won't load a stiff spinning rod; a fly rod folds under a
// mieliebom. castFactor scales cast distance, biteFactor bites; issues are
// shown in the tackle box and when you cast.
export function rigCheck({ rod, reel, line, lure }) {
  const flyRod = !!rod?.fly, flyLine = line?.type === 'fly', flyReel = !!reel?.fly, fly = !!lure?.fly;
  let castFactor = 1, biteFactor = 1;
  const issues = [];
  if (flyLine && !flyRod) { castFactor *= 0.35; issues.push('Fly line only casts off a fly rod'); }
  if (flyReel && !flyRod) { castFactor *= 0.6; issues.push("A fly reel can't cast off this rod — use the fly rod"); }
  if (flyRod && !flyLine) { castFactor *= 0.55; issues.push("The fly rod needs a fly line — ordinary line won't load it"); }
  if (flyRod && reel && !flyReel) { castFactor *= 0.9; issues.push('The fly rod works best with a fly reel'); }
  if (fly && !(flyRod && flyLine)) {
    castFactor *= 0.4; biteFactor *= 0.85;
    issues.push('Flies weigh almost nothing — cast them with the fly rod and a fly line');
  }
  if (lure && !fly && flyRod) {
    if (lure.heavy) { castFactor *= 0.45; issues.push(`${lure.name.split(' (')[0]} is far too heavy for a fly rod`); }
    else if (flyLine) { castFactor *= 0.6; issues.push("Bait and lures don't cast on fly line — tie on a fly"); }
  }
  // Line to suit the fly: a floating line keeps a dry fly up and drifts a
  // nymph naturally; a sinking line gets a streamer down but drowns a dry.
  if (fly && flyRod && flyLine) {
    const deep = lure.id === 'fly-streamer' || lure.id === 'fly-walkers-killer';
    if (line.sinking) biteFactor *= deep ? 1.2 : lure.id === 'fly-dry' ? 0.6 : 1;
    else biteFactor *= deep ? 1 : 1.15;
    if (line.sinking && lure.id === 'fly-dry') issues.push('A sinking line drowns a dry fly — use the floating line');
  }
  return { flyRig: flyRod && flyLine && fly, castFactor, biteFactor, issues, ok: issues.length === 0 };
}

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
