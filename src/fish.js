import { TIME_OF_DAY_PHASES } from './environment.js';
import { ENGINE } from './tuning/engine.js';

// Species, timing, rarity and bite-feel are grounded in real South African
// freshwater angling and fish-behaviour studies. Each fish's `activity` is
// how hard it feeds through the day, one value per time of day:
//   [morning, midMorning, midday, afternoon, sunset, lateTwilight, night]
// 1 = peak feeding, ~0.1 = almost off the feed. Carp and bass peak at dawn
// and dusk, barbel at night, kurper and yellowfish by day. Each fish's
// `bite` profile drives how the line behaves and fights once hooked.
export const FISH_SPECIES = [
  {
    id: 'mozambique-tilapia',
    name: 'Mozambique Tilapia',
    rarity: 'common',
    minWeightKg: 0.3,
    maxWeightKg: 1.5,
    tempRangeC: [20, 32],
    preferredLureIds: ['bread-bait', 'worm', 'mielies', 'spinner'],
    // Takes a small spinner now and then, but it's a bait fish at heart.
    lureAffinity: { spinner: 0.3 },
    baseValuePerKg: 8,
    // Common warm-water grazer, South Africa's classic "bream" — bites
    // readily through the day, but still needs the right bait.
    aggressiveness: 0.55,
    // Mainly diurnal; feeds through the warm day, quiet after dark.
    activity: [0.7, 1, 0.9, 1, 0.6, 0.2, 0.1],
    bite: { speed: 'fast', style: 'nibble', label: 'Quick nibbles' },
    // Grazes the warm, sun-lit margins -- a shallow-water fish.
    habitat: { shallow: true },
  },
  {
    id: 'banded-tilapia',
    name: 'Banded Tilapia',
    rarity: 'common',
    minWeightKg: 0.15,
    maxWeightKg: 0.7,
    tempRangeC: [16, 28],
    preferredLureIds: ['worm', 'mielies', 'spinner'],
    lureAffinity: { spinner: 0.3 },
    baseValuePerKg: 7,
    // Widespread river/dam species, smaller and a touch more skittish than
    // its Mozambique cousin, but just as willing to bite.
    aggressiveness: 0.5,
    // Diurnal like its cousin; a touch shyer in the midday glare.
    activity: [0.7, 1, 0.8, 1, 0.5, 0.15, 0.05],
    bite: { speed: 'fast', style: 'nibble', label: 'Darting little taps' },
    habitat: { shallow: true },
  },
  {
    id: 'common-carp',
    name: 'Common Carp',
    rarity: 'uncommon',
    minWeightKg: 1.0,
    maxWeightKg: 8.0,
    tempRangeC: [12, 28],
    // Mielies and dough are the classic SA carp baits; bread flake works too.
    preferredLureIds: ['worm', 'mielies', 'bread-bait'],
    baseValuePerKg: 14,
    aggressiveness: 0.32,
    // Opportunistic bottom feeder — feeds from first light through the
    // morning and again from the afternoon into sunset.
    // Dawn and dusk peaks, feeds confidently at night, slow in the midday heat.
    activity: [1, 0.7, 0.35, 0.7, 1, 0.9, 0.8],
    bite: { speed: 'slow', style: 'steady', label: 'A long, steady pull' },
    // Roams the whole dam -- open bottom as much as cover -- so no habitat
    // penalty anywhere (forum reports: most bank anglers' catch is carp).
    habitat: {},
  },
  {
    id: 'mirror-carp',
    name: 'Mirror Carp',
    rarity: 'rare',
    minWeightKg: 3.0,
    maxWeightKg: 14,
    tempRangeC: [13, 27],
    preferredLureIds: ['worm', 'mielies', 'bread-bait'],
    baseValuePerKg: 20,
    // The prized big-scaled carp variant — cautious, and a rare hookup, but
    // a genuinely heavy fish when it happens.
    aggressiveness: 0.16,
    // Big, wary carp: most at home from dusk through the night.
    activity: [0.9, 0.5, 0.25, 0.6, 1, 1, 0.9],
    bite: { speed: 'slow', style: 'heavy', label: 'Slow, immovable weight' },
    // Big, wary, and holds in the deepest water it can find.
    habitat: { deep: true },
  },
  {
    id: 'largemouth-bass',
    name: 'Largemouth Bass',
    rarity: 'uncommon',
    minWeightKg: 0.5,
    maxWeightKg: 4.5,
    tempRangeC: [10, 31], // thrives in warm SA summers; sluggish below ~10°C
    preferredLureIds: ['spinner', 'soft-plastic', 'spoon-lure'],
    baseValuePerKg: 22,
    aggressiveness: 0.22,
    // Dawn/dusk ambush predator, per the "early morning and late afternoon"
    // research finding.
    // Crepuscular: dawn and dusk peaks, deep and slow at midday, some night feeding.
    activity: [1, 0.6, 0.3, 0.6, 1, 0.8, 0.45],
    bite: { speed: 'fast', style: 'aggressive', label: 'Aggressive strike!' },
    // The classic ambush predator -- lives in lily pads, timber and docks.
    habitat: { structure: true },
  },
  {
    id: 'smallmouth-bass',
    name: 'Smallmouth Bass',
    rarity: 'rare',
    minWeightKg: 0.3,
    maxWeightKg: 2.2,
    tempRangeC: [8, 27], // likes it cooler than largemouth, but feeds through a Cape summer
    preferredLureIds: ['spinner', 'spoon-lure'],
    baseValuePerKg: 26,
    // Less common in SA (mostly cooler Western/Eastern Cape streams and
    // dams) and a famously fierce pound-for-pound fighter.
    aggressiveness: 0.14,
    // Low-light hunter: dawn/dusk 'golden hours', feeds under a moon.
    activity: [1, 0.55, 0.25, 0.55, 1, 0.75, 0.4],
    bite: { speed: 'fast', style: 'aggressive', label: 'Explosive strike!' },
    // Hides in submerged timber -- the Vaal Dam "unicorn" in the drowned forest.
    habitat: { structure: true },
  },
  {
    id: 'catfish',
    name: 'Catfish (Barbel)',
    rarity: 'rare',
    minWeightKg: 2.5,
    maxWeightKg: 15,
    tempRangeC: [10, 30],
    preferredLureIds: ['chicken-liver', 'frog-bait', 'worm'],
    baseValuePerKg: 20,
    // "Try evenings or overcast days, when they patrol the margins" — rare
    // bite, but a big, heavy fish when it happens.
    aggressiveness: 0.1,
    // Mostly nocturnal/crepuscular, but will feed by day in murky water.
    activity: [0.4, 0.2, 0.15, 0.25, 0.6, 1, 1],
    bite: { speed: 'slow', style: 'heavy', label: 'A heavy, dogged pull' },
    // Bottom-dwelling barbel -- holds in the deepest water it can find.
    habitat: { deep: true },
  },
  {
    id: 'tigerfish',
    name: 'Tigerfish',
    rarity: 'rare',
    minWeightKg: 1.5,
    maxWeightKg: 8,
    tempRangeC: [18, 30],
    preferredLureIds: ['spoon-lure', 'spinner'],
    baseValuePerKg: 40,
    // Explosive striker. Needs a wire trace rig or it bites clean through
    // the line — see main.js's tigerfish handling.
    aggressiveness: 0.08,
    // Jozini guides: they hunt all day, best early and from late afternoon
    // into dusk; only really switch off in the heat of midday and at night.
    // Visual daylight hunter: best early and late, off the feed at night.
    activity: [1, 0.8, 0.4, 0.85, 1, 0.5, 0.1],
    requiresWireTrace: true,
    bite: { speed: 'fast', style: 'aggressive', label: 'Violent, thrashing strike!' },
    // Shoals chase baitfish over open water and along the drop-offs alike.
    habitat: {},
  },
  {
    // Labeobarbus aeneus, native to the Vaal-Orange system -- the Vaal Dam
    // feeder anglers' bread and butter (43 of 90 fish in one session report).
    id: 'smallmouth-yellowfish',
    name: 'Smallmouth Yellowfish',
    rarity: 'uncommon',
    minWeightKg: 0.4,
    maxWeightKg: 4.5,
    tempRangeC: [10, 27],
    // Mielies and dough on a feeder, worms, and small spinners and flies.
    preferredLureIds: ['mielies', 'worm', 'spinner'],
    lureAffinity: { spinner: 0.5 },
    baseValuePerKg: 16,
    aggressiveness: 0.4,
    // Vaal River telemetry: active by day, inactive at night.
    activity: [0.8, 1, 0.8, 1, 0.8, 0.35, 0.15],
    // Known for a hard, fast fight well above its weight.
    bite: { speed: 'fast', style: 'aggressive', label: 'A sharp tug and a hard run!' },
    habitat: {},
  },
  {
    // Labeobarbus marequensis, the Limpopo/Olifants/Pongola cousin of the
    // smallmouth: bigger-scaled, more predatory, a prized fly and artlure
    // fish in Loskop, Bronkhorstspruit and Jozini.
    id: 'largescale-yellowfish',
    name: 'Largescale Yellowfish',
    rarity: 'rare',
    minWeightKg: 0.5,
    maxWeightKg: 6,
    tempRangeC: [14, 30],
    preferredLureIds: ['worm', 'mielies', 'spinner', 'spoon-lure'],
    lureAffinity: { spinner: 0.6, 'spoon-lure': 0.6 },
    baseValuePerKg: 18,
    aggressiveness: 0.3,
    // Daytime forager on insects, algae and small fish.
    activity: [0.9, 1, 0.7, 1, 0.9, 0.35, 0.15],
    bite: { speed: 'fast', style: 'aggressive', label: 'A slam and a powerful run!' },
    // Holds around rocks, drop-offs and drowned timber.
    habitat: { structure: true },
  },
  {
    // Orange River mudfish / moggel (Labeo capensis, L. umbratus): a
    // bottom-grazing labeo that turns up among the carp on Vaal and Loskop.
    id: 'mudfish',
    name: 'Mudfish',
    rarity: 'common',
    minWeightKg: 0.3,
    maxWeightKg: 3.5,
    tempRangeC: [10, 29],
    preferredLureIds: ['mielies', 'bread-bait', 'worm'],
    baseValuePerKg: 6,
    aggressiveness: 0.35,
    // Bottom grazer on algae and detritus -- feeds steadily, day and night.
    activity: [0.8, 0.9, 0.7, 0.9, 0.8, 0.5, 0.4],
    // Sucker-mouthed grazer: fiddly little taps, then a dogged tug.
    bite: { speed: 'slow', style: 'nibble', label: 'Soft, fiddly taps' },
    // Grazes the silty bottom in the shallows and margins.
    habitat: { shallow: true },
  },
  {
    // Introduced 1890s-1900s; the fly-fishing fish of Dullstroom, the KZN
    // Midlands, Rhodes and the Cape streams. Cold water only (stressed above
    // ~21°C), feeds hardest at dawn and dusk, and famously leaps when hooked.
    id: 'rainbow-trout',
    name: 'Rainbow Trout',
    rarity: 'common',
    minWeightKg: 0.3,
    maxWeightKg: 3.5,
    tempRangeC: [2, 21], // winter trout fishing is prime in SA's cold highlands
    preferredLureIds: ['fly-nymph', 'fly-dry', 'fly-streamer', 'spinner', 'worm'],
    lureAffinity: { spinner: 0.6, worm: 0.4 },
    baseValuePerKg: 22,
    aggressiveness: 0.5,
    activity: [1, 0.8, 0.4, 0.7, 1, 0.6, 0.15],
    bite: { speed: 'fast', style: 'aggressive', label: 'The line zips tight — a trout' },
    habitat: {},
  },
  {
    // Wild browns of the Mooi, Bushmans and Witte rivers: wary, hold under
    // banks and structure, feed from dusk into the night, dogged fighters.
    id: 'brown-trout',
    name: 'Brown Trout',
    rarity: 'uncommon',
    minWeightKg: 0.3,
    maxWeightKg: 4,
    tempRangeC: [2, 19],
    preferredLureIds: ['fly-nymph', 'fly-streamer', 'fly-dry', 'spinner', 'worm'],
    lureAffinity: { 'fly-dry': 0.7, spinner: 0.5, worm: 0.4 },
    baseValuePerKg: 26,
    aggressiveness: 0.35,
    activity: [0.9, 0.6, 0.25, 0.5, 1, 0.9, 0.6],
    bite: { speed: 'medium', style: 'heavy', label: 'A heavy, head-shaking take' },
    habitat: { structure: true },
  },
  {
    // Labeobarbus kimberleyensis of the Orange-Vaal: the country's top
    // freshwater predator on fly (Vanderkloof, Vaal at Parys, Orange at
    // Upington), up to ~9kg on the Vaal. Streamers and spinners.
    id: 'largemouth-yellowfish',
    name: 'Largemouth Yellowfish',
    rarity: 'rare',
    minWeightKg: 1,
    maxWeightKg: 9,
    tempRangeC: [12, 30],
    preferredLureIds: ['fly-streamer', 'spinner', 'spoon-lure', 'worm'],
    lureAffinity: { worm: 0.3 },
    baseValuePerKg: 24,
    aggressiveness: 0.25,
    activity: [1, 0.8, 0.5, 0.8, 1, 0.5, 0.2],
    bite: { speed: 'fast', style: 'aggressive', label: 'A savage hit — a largemouth yellow' },
    habitat: { structure: true },
  },
  {
    // Labeobarbus capensis of the Cederberg Olifants and Doring rivers:
    // endangered, catch-and-release only, spooky sight-fishing on light
    // tippet with nymphs.
    id: 'clanwilliam-yellowfish',
    name: 'Clanwilliam Yellowfish',
    rarity: 'rare',
    minWeightKg: 0.5,
    maxWeightKg: 5,
    tempRangeC: [12, 28],
    preferredLureIds: ['fly-nymph', 'fly-dry', 'fly-streamer', 'worm'],
    lureAffinity: { 'fly-dry': 0.7, 'fly-streamer': 0.6, worm: 0.3 },
    baseValuePerKg: 20,
    aggressiveness: 0.3,
    activity: [0.8, 1, 0.8, 1, 0.8, 0.3, 0.1],
    bite: { speed: 'medium', style: 'steady', label: 'A careful, deliberate take' },
    habitat: {},
  },
  {
    // Bluegill sunfish: common in Western Cape dams (Clanwilliam,
    // Theewaterskloof). Little, bold, bites all day on worms and small flies.
    id: 'bluegill',
    name: 'Bluegill',
    rarity: 'common',
    minWeightKg: 0.08,
    maxWeightKg: 0.6,
    tempRangeC: [12, 32],
    preferredLureIds: ['worm', 'bread-bait', 'fly-dry', 'fly-nymph', 'spinner'],
    lureAffinity: { spinner: 0.4 },
    baseValuePerKg: 10,
    aggressiveness: 0.6,
    activity: [0.7, 1, 0.9, 1, 0.7, 0.2, 0.05],
    bite: { speed: 'fast', style: 'nibble', label: 'Quick little pecks' },
    habitat: { shallow: true },
  },
];

// The times a fish counts as "on the feed" (used by tips and the HUD).
for (const species of FISH_SPECIES) {
  species.activeTimes = TIME_OF_DAY_PHASES.filter((_, i) => species.activity[i] >= ENGINE.bites.activeThreshold);
}

// How strongly loose feed (breadcrumbs, groundbait) pulls each fish in, 0..1.
// Grazers and bottom feeders come straight to it; barbel scavenge it; bass
// and tigers only turn up for the small fish the feed attracts.
const CHUM_AFFINITY = {
  'common-carp': 1, 'mirror-carp': 0.9, 'mozambique-tilapia': 1, 'banded-tilapia': 1,
  mudfish: 1, 'smallmouth-yellowfish': 0.8, 'largescale-yellowfish': 0.7,
  catfish: 0.5, 'largemouth-bass': 0.25, 'smallmouth-bass': 0.25, tigerfish: 0.3,
  'rainbow-trout': 0.2, 'brown-trout': 0.15, 'largemouth-yellowfish': 0.3,
  'clanwilliam-yellowfish': 0.5, bluegill: 0.9,
};
// Flies (fly-fishing): trout and yellowfish are the classic fly fish in SA;
// bass, tigers, carp and bluegill take them too. Species already listing a
// fly keep their own rating; these add flies to the rest.
const FLY_AFFINITY = {
  'smallmouth-yellowfish': { 'fly-nymph': 1.1, 'fly-dry': 0.6, 'fly-streamer': 0.5 },
  'largescale-yellowfish': { 'fly-nymph': 1.0, 'fly-streamer': 0.9 },
  'largemouth-bass': { 'fly-streamer': 0.8 },
  'smallmouth-bass': { 'fly-streamer': 0.8, 'fly-nymph': 0.4 },
  tigerfish: { 'fly-streamer': 0.9 },
  'common-carp': { 'fly-nymph': 0.4 },
  mudfish: { 'fly-nymph': 0.5 },
  'mozambique-tilapia': { 'fly-nymph': 0.3 },
};
// Mieliebom (a groundbait feeder packed with mielie-meal) is a classic SA
// carp method; yellowfish and mudfish love it too, kurper pick at it.
const MIELIEBOM_AFFINITY = {
  'common-carp': 1.3, 'mirror-carp': 1.3, 'smallmouth-yellowfish': 1.1, 'largescale-yellowfish': 0.9,
  mudfish: 1.1, 'mozambique-tilapia': 0.6, 'banded-tilapia': 0.6,
};
// The wider tackle box: carp baits, bass lures, SA fly patterns and
// barbel/tiger baits. How much each fish wants them (1 = as much as its
// favourite everyday bait).
const TACKLE_AFFINITY = {
  'common-carp': { boilies: 1.4, 'pop-up': 1.3, 'method-feeder': 1.3, 'dough-bait': 0.9 },
  'mirror-carp': { boilies: 1.45, 'pop-up': 1.35, 'method-feeder': 1.3, 'dough-bait': 0.9 },
  'mozambique-tilapia': { 'dough-bait': 1.1, 'method-feeder': 0.5 },
  'banded-tilapia': { 'dough-bait': 1.0 },
  mudfish: { 'dough-bait': 0.8, 'method-feeder': 1.0 },
  bluegill: { 'dough-bait': 0.8, 'method-feeder': 0.5, 'fly-damsel': 0.8 },
  'largemouth-bass': { crankbait: 1.1, 'topwater-frog': 1.3, 'bass-jig': 1.2, 'rapala-minnow': 0.9, 'fly-damsel': 0.5, 'fly-walkers-killer': 0.6 },
  'smallmouth-bass': { crankbait: 1.2, 'bass-jig': 1.2, 'rapala-minnow': 0.9 },
  // Liver catches the odd tiger (SA forums), but it's a barbel bait.
  tigerfish: { crankbait: 0.8, 'rapala-minnow': 1.2, sardine: 0.9, 'chicken-liver': 0.12 },
  catfish: { sardine: 1.3, boilies: 0.3, 'topwater-frog': 0.3 },
  'rainbow-trout': { 'fly-damsel': 1.2, 'fly-walkers-killer': 1.1, 'fly-zak': 1.0 },
  'brown-trout': { 'fly-damsel': 0.9, 'fly-walkers-killer': 1.1, 'fly-zak': 0.9, 'rapala-minnow': 0.6 },
  'smallmouth-yellowfish': { 'fly-zak': 1.2, 'fly-damsel': 0.7, 'method-feeder': 1.0 },
  'largescale-yellowfish': { 'fly-zak': 0.9, 'method-feeder': 0.8 },
  'largemouth-yellowfish': { 'fly-walkers-killer': 0.8, crankbait: 0.8, 'rapala-minnow': 1.0 },
  'clanwilliam-yellowfish': { 'fly-zak': 1.1 },
};
for (const species of FISH_SPECIES) {
  species.chumAffinity = CHUM_AFFINITY[species.id] ?? 0.5;
  if (MIELIEBOM_AFFINITY[species.id]) {
    species.preferredLureIds.push('mieliebom');
    species.lureAffinity = { ...(species.lureAffinity || {}), mieliebom: MIELIEBOM_AFFINITY[species.id] };
  }
  for (const [id, affinity] of Object.entries(TACKLE_AFFINITY[species.id] || {})) {
    if (species.preferredLureIds.includes(id)) continue;
    species.preferredLureIds.push(id);
    species.lureAffinity = { ...(species.lureAffinity || {}), [id]: affinity };
  }
  for (const [fly, affinity] of Object.entries(FLY_AFFINITY[species.id] || {})) {
    if (species.preferredLureIds.includes(fly)) continue;
    species.preferredLureIds.push(fly);
    species.lureAffinity = { ...(species.lureAffinity || {}), [fly]: affinity };
  }
}

// How hard a species is feeding at this time of day, 0..1 (1 if unknown).
export function activityAt(species, timeOfDay) {
  if (timeOfDay === null || timeOfDay === undefined) return 1;
  const i = TIME_OF_DAY_PHASES.indexOf(timeOfDay);
  if (i < 0) return 1;
  if (species.activity) return species.activity[i];
  return species.activeTimes?.includes(timeOfDay) ? 1 : 0.25;
}

export function randomWeightFor(species) {
  return species.minWeightKg + Math.random() * (species.maxWeightKg - species.minWeightKg);
}

// The one that almost got away: about 1 bite in 300 is a trophy -- a fish
// far bigger than the species normally runs (1.5-2.1x its usual maximum),
// strong enough to break even the best line if you haul on it.
// The built-in trophy chance (live value: ENGINE.bites.trophyChance).
export const TROPHY_CHANCE = 1 / 300;
export function rollTrophy(rng = Math.random) {
  return rng() < ENGINE.bites.trophyChance;
}
export function trophyWeightFor(species, rng = Math.random) {
  return species.maxWeightKg * (1.5 + rng() * 0.6);
}

// How big this fish is for its kind: 0 = smallest, 1 = the usual maximum,
// above 1 = a trophy.
export function sizeRatio(species, weightKg) {
  return weightKg / species.maxWeightKg;
}

// Length from weight with the standard W = a * L^3 relation (grams,
// centimetres). `a` is the species' condition factor: deep-bodied tilapia
// weigh the most per centimetre, long lean barbel the least.
const CONDITION_FACTOR = {
  'mozambique-tilapia': 0.022, 'banded-tilapia': 0.022,
  'common-carp': 0.017, 'mirror-carp': 0.018,
  'largemouth-bass': 0.017, 'smallmouth-bass': 0.016,
  catfish: 0.006, tigerfish: 0.013,
  'smallmouth-yellowfish': 0.014, 'largescale-yellowfish': 0.015, mudfish: 0.013,
  'rainbow-trout': 0.012, 'brown-trout': 0.012, 'largemouth-yellowfish': 0.013,
  'clanwilliam-yellowfish': 0.014, bluegill: 0.025,
};
export function estimateLengthCm(species, weightKg) {
  const a = CONDITION_FACTOR[species.id] ?? 0.015;
  return Math.cbrt((weightKg * 1000) / a);
}

// Where you actually put the lure matters as much as what's on the end of
// the line: a spinner worked through a lily-pad cove is a bass/tigerfish
// magnet, the same spinner sitting in open water is nothing special to
// them, deep-holding fish (catfish, mirror carp) want the middle of the
// dam, and shallow grazers (tilapia) want the margins near the bank.
export function getHabitatMultiplier(species, { zone, depthFactor, lureKind } = {}) {
  let mult = 1;
  const habitat = species.habitat || {};
  if (habitat.structure) {
    if (zone === 'structure') mult *= lureKind === 'lure' ? 2.2 : 1.6;
    else mult *= 0.55;
  }
  if (habitat.deep) {
    if (depthFactor >= 0.55) mult *= 1.6;
    else if (depthFactor <= 0.3) mult *= 0.5;
  }
  if (habitat.shallow) {
    if (depthFactor <= 0.4) mult *= 1.5;
    else if (depthFactor >= 0.65) mult *= 0.5;
  }
  return mult;
}

export function rollForBite({ species, waterTempC, equippedLureId, deltaSeconds, biteChanceMultiplier = 1, timeOfDay = null, habitat = null, lureKind = null }) {
  const [minT, maxT] = species.tempRangeC;
  if (waterTempC < minT || waterTempC > maxT) return false;

  const lureMatch = species.preferredLureIds.includes(equippedLureId);
  const lureMultiplier = lureMatch ? 1.0 : 0.15;

  const timeMultiplier = activityAt(species, timeOfDay);

  const habitatMultiplier = habitat ? getHabitatMultiplier(species, { ...habitat, lureKind }) : 1;

  const perSecondChance = 0.02 * species.aggressiveness * lureMultiplier * timeMultiplier * habitatMultiplier * biteChanceMultiplier;
  const chance = 1 - Math.pow(1 - perSecondChance, deltaSeconds);
  return Math.random() < chance;
}

// How well the current temp/bait/time/spot suits a species, 0..~2.4.
export function suitability(species, { waterTempC, equippedLureId, timeOfDay = null, habitat = null, lureKind = null }) {
  const [minT, maxT] = species.tempRangeC;
  if (waterTempC < minT || waterTempC > maxT) return 0;
  // A preferred bait counts fully unless the species lists a weaker
  // `lureAffinity` for it (kurper will hit a spinner, just not often).
  const lureMultiplier = species.preferredLureIds.includes(equippedLureId)
    ? (species.lureAffinity?.[equippedLureId] ?? 1.0)
    : 0.15;
  const timeMultiplier = activityAt(species, timeOfDay);
  const habitatMultiplier = habitat ? getHabitatMultiplier(species, { ...habitat, lureKind }) : 1;
  return lureMultiplier * timeMultiplier * habitatMultiplier;
}

// Each dam's `catchShare` says what share of anglers' catches each species
// makes up there (from forum and venue reports). A fish's pull on your line
// is its share of the dam's population times how well your bait, the time
// and the spot suit it. Without a share table every species counts evenly,
// scaled by how readily it bites. `chumBoost` (from feed.js) is the extra
// pull of loose feed where the line sits; each fish feels it by its
// chumAffinity, so breadcrumbs bring carp and kurper, not tigerfish.
// `gearBite(species)` (optional): extra pull from the right hook and line --
// a hair rig for carp, fluorocarbon for line-shy bass (see gear.js biteBonus).
export function catchWeights(speciesList, catchShare, { chumBoost = 0, gearBite = null, ...opts } = {}) {
  return speciesList.map((species) => {
    const share = catchShare ? (catchShare[species.id] ?? 0) : species.aggressiveness;
    const feed = 1 + chumBoost * (species.chumAffinity ?? 0.5);
    const gear = gearBite ? gearBite(species) : 1;
    return share * suitability(species, opts) * feed * gear;
  });
}

function weightedPick(list, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[list.length - 1];
}

// Bites per second with bait, time and spot all in the fish's favour.
// The built-in bite rate (live value: ENGINE.bites.rate).
export const DAM_BITE_RATE = 0.035;

// One roll per frame for the whole dam: does anything bite, and if so which
// fish? Every species gets a fair shot in proportion to its weight -- no
// list-order advantage. Returns the species or null.
export function rollDamBite(speciesList, catchShare, { deltaSeconds, biteChanceMultiplier = 1, ...opts }) {
  // `opts.chumBoost` raises the weights, and so the overall bite rate too.
  const weights = catchWeights(speciesList, catchShare, opts);
  const shareTotal = catchShare
    ? speciesList.reduce((sum, s) => sum + (catchShare[s.id] ?? 0), 0)
    : speciesList.reduce((sum, s) => sum + s.aggressiveness, 0);
  if (shareTotal <= 0) return null;
  const suited = weights.reduce((sum, w) => sum + w, 0) / shareTotal;
  const perSecond = Math.min(0.95, ENGINE.bites.rate * suited * biteChanceMultiplier);
  const chance = 1 - Math.pow(1 - perSecond, deltaSeconds);
  if (Math.random() >= chance) return null;
  return weightedPick(speciesList, weights);
}

// A line that's sat too long picks a fish the same way, so the "guaranteed"
// bite still feels like the right fish for this dam and these conditions.
// Returns null only if literally nothing here can bite (e.g. every local
// species is outside the current water temperature).
export function pickGuaranteedBite(speciesList, opts, catchShare = null) {
  return weightedPick(speciesList, catchWeights(speciesList, catchShare, opts));
}
