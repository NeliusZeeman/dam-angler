// Species, timing, rarity and bite-feel are grounded in real South African
// freshwater angling: dawn/dusk are the prime windows for most species,
// barbel (catfish) and tigerfish favor dusk into full dark, and each fish's
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
    baseValuePerKg: 8,
    // Common warm-water grazer, South Africa's classic "bream" — bites
    // readily through the day, but still needs the right bait.
    aggressiveness: 0.55,
    activeTimes: ['morning', 'midMorning', 'midday', 'afternoon'],
    bite: { speed: 'fast', style: 'nibble', label: 'Quick nibbles' },
  },
  {
    id: 'banded-tilapia',
    name: 'Banded Tilapia',
    rarity: 'common',
    minWeightKg: 0.15,
    maxWeightKg: 0.7,
    tempRangeC: [16, 28],
    preferredLureIds: ['worm', 'mielies', 'spinner'],
    baseValuePerKg: 7,
    // Widespread river/dam species, smaller and a touch more skittish than
    // its Mozambique cousin, but just as willing to bite.
    aggressiveness: 0.5,
    activeTimes: ['morning', 'midMorning', 'afternoon'],
    bite: { speed: 'fast', style: 'nibble', label: 'Darting little taps' },
  },
  {
    id: 'common-carp',
    name: 'Common Carp',
    rarity: 'uncommon',
    minWeightKg: 1.0,
    maxWeightKg: 8.0,
    tempRangeC: [12, 28],
    preferredLureIds: ['worm', 'mielies'],
    baseValuePerKg: 14,
    aggressiveness: 0.32,
    // Opportunistic bottom feeder — morning and afternoon, bridging into
    // sunset as the water cools.
    activeTimes: ['morning', 'afternoon', 'sunset'],
    bite: { speed: 'slow', style: 'steady', label: 'A long, steady pull' },
  },
  {
    id: 'mirror-carp',
    name: 'Mirror Carp',
    rarity: 'rare',
    minWeightKg: 3.0,
    maxWeightKg: 14,
    tempRangeC: [13, 27],
    preferredLureIds: ['worm', 'mielies'],
    baseValuePerKg: 20,
    // The prized big-scaled carp variant — cautious, and a rare hookup, but
    // a genuinely heavy fish when it happens.
    aggressiveness: 0.16,
    activeTimes: ['afternoon', 'sunset'],
    bite: { speed: 'slow', style: 'heavy', label: 'Slow, immovable weight' },
  },
  {
    id: 'largemouth-bass',
    name: 'Largemouth Bass',
    rarity: 'uncommon',
    minWeightKg: 0.5,
    maxWeightKg: 4.5,
    tempRangeC: [10, 24],
    preferredLureIds: ['spinner', 'soft-plastic', 'spoon-lure'],
    baseValuePerKg: 22,
    aggressiveness: 0.22,
    // Dawn/dusk ambush predator, per the "early morning and late afternoon"
    // research finding.
    activeTimes: ['morning', 'sunset', 'lateTwilight'],
    bite: { speed: 'fast', style: 'aggressive', label: 'Aggressive strike!' },
  },
  {
    id: 'smallmouth-bass',
    name: 'Smallmouth Bass',
    rarity: 'rare',
    minWeightKg: 0.3,
    maxWeightKg: 2.2,
    tempRangeC: [8, 19],
    preferredLureIds: ['spinner', 'spoon-lure'],
    baseValuePerKg: 26,
    // Less common in SA (mostly cooler Western/Eastern Cape streams and
    // dams) and a famously fierce pound-for-pound fighter.
    aggressiveness: 0.14,
    activeTimes: ['morning', 'lateTwilight'],
    bite: { speed: 'fast', style: 'aggressive', label: 'Explosive strike!' },
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
    activeTimes: ['lateTwilight', 'night'],
    bite: { speed: 'slow', style: 'heavy', label: 'A heavy, dogged pull' },
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
    // Explosive but scarce dusk striker. Needs a wire trace rig or it bites
    // clean through the line — see main.js's tigerfish handling.
    aggressiveness: 0.08,
    activeTimes: ['sunset', 'lateTwilight'],
    requiresWireTrace: true,
    bite: { speed: 'fast', style: 'aggressive', label: 'Violent, thrashing strike!' },
  },
];

export function randomWeightFor(species) {
  return species.minWeightKg + Math.random() * (species.maxWeightKg - species.minWeightKg);
}

export function rollForBite({ species, waterTempC, equippedLureId, deltaSeconds, biteChanceMultiplier = 1, timeOfDay = null }) {
  const [minT, maxT] = species.tempRangeC;
  if (waterTempC < minT || waterTempC > maxT) return false;

  const lureMatch = species.preferredLureIds.includes(equippedLureId);
  const lureMultiplier = lureMatch ? 1.0 : 0.15;

  const timeMatch = timeOfDay === null || !species.activeTimes || species.activeTimes.includes(timeOfDay);
  const timeMultiplier = timeMatch ? 1.0 : 0.25;

  const perSecondChance = 0.02 * species.aggressiveness * lureMultiplier * timeMultiplier * biteChanceMultiplier;
  const chance = 1 - Math.pow(1 - perSecondChance, deltaSeconds);
  return Math.random() < chance;
}
