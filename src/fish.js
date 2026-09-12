export const FISH_SPECIES = [
  {
    id: 'tilapia',
    name: 'Tilapia',
    minWeightKg: 0.3,
    maxWeightKg: 1.5,
    tempRangeC: [20, 32],
    preferredLureIds: ['bread-bait', 'worm'],
    baseValuePerKg: 10,
    aggressiveness: 0.9,
    // Warm-water feeder — grazes through the day and keeps biting into the
    // last of the sun-warmed light at sunset.
    activeTimes: ['day', 'sunset'],
  },
  {
    id: 'carp',
    name: 'Carp',
    minWeightKg: 1.0,
    maxWeightKg: 8.0,
    tempRangeC: [12, 28],
    preferredLureIds: ['worm', 'corn'],
    baseValuePerKg: 15,
    aggressiveness: 0.6,
    // Opportunistic bottom feeder — most active across the sunset-to-twilight
    // bridge as the water cools.
    activeTimes: ['sunset', 'twilight'],
  },
  {
    id: 'bass',
    name: 'Bass',
    minWeightKg: 0.5,
    maxWeightKg: 4.5,
    tempRangeC: [8, 22],
    preferredLureIds: ['spinner', 'soft-plastic'],
    baseValuePerKg: 25,
    aggressiveness: 0.35,
    // Classic crepuscular ambush predator — hunts low-light edges at dusk
    // and into the night.
    activeTimes: ['twilight', 'night'],
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
