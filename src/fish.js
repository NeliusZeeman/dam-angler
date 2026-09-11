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
  },
];

export function randomWeightFor(species) {
  return species.minWeightKg + Math.random() * (species.maxWeightKg - species.minWeightKg);
}

export function rollForBite({ species, waterTempC, equippedLureId, deltaSeconds }) {
  const [minT, maxT] = species.tempRangeC;
  if (waterTempC < minT || waterTempC > maxT) return false;

  const lureMatch = species.preferredLureIds.includes(equippedLureId);
  const lureMultiplier = lureMatch ? 1.0 : 0.15;

  const perSecondChance = 0.02 * species.aggressiveness * lureMultiplier;
  const chance = 1 - Math.pow(1 - perSecondChance, deltaSeconds);
  return Math.random() < chance;
}
