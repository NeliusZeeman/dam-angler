export const RODS = [
  { id: 'rod-starter', name: 'Starter Rod', tier: 1, cost: 0, castDistance: 12, tensionTolerance: 1.0 },
  { id: 'rod-sport', name: 'Sport Rod', tier: 2, cost: 250, castDistance: 18, tensionTolerance: 1.4 },
  { id: 'rod-pro', name: 'Pro Rod', tier: 3, cost: 800, castDistance: 24, tensionTolerance: 2.0 },
];

export const LINES = [
  { id: 'line-starter', name: 'Starter Line', tier: 1, cost: 0, breakStrength: 1.0 },
  { id: 'line-braid', name: 'Braided Line', tier: 2, cost: 150, breakStrength: 1.6 },
  { id: 'line-fluoro', name: 'Fluorocarbon Line', tier: 3, cost: 500, breakStrength: 2.4 },
];

export const LURES = [
  { id: 'bread-bait', name: 'Bread Bait', cost: 0, speciesIds: ['tilapia'] },
  { id: 'worm', name: 'Worm', cost: 20, speciesIds: ['tilapia', 'carp'] },
  { id: 'corn', name: 'Sweetcorn', cost: 20, speciesIds: ['carp'] },
  { id: 'spinner', name: 'Spinner Lure', cost: 90, speciesIds: ['bass'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', cost: 120, speciesIds: ['bass'] },
];

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
