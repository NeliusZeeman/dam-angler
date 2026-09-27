// Credits: what a fish pays, and what things cost. Shared by the game and
// the server -- when you're logged in the server does the sums itself, so
// both sides must get exactly the same answer.

import { ENGINE } from './tuning/engine.js';

// Breadcrumbs (chum), per throw: the built-in price (live: chumCost()).
export const CHUM_COST = 15;
export const chumCost = () => ENGINE.money.chumCost;

// A number 0..1 that's always the same for the same id (FNV-1a hash). Used
// for a catch's ±10% "market price" wobble, so the game and the server
// agree on the payout to the credit.
export function randomFromId(id) {
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

export function calculatePayout({ species, weightKg, rod, line, hook = null, rand = Math.random }) {
  const gearQuality = (rod.tier + line.tier) / 2; // 1.0 .. 3.0
  const gearMultiplier = 1 + (gearQuality - 1) * 0.1; // 1.0 .. 1.2
  const hookBonus = (hook && hook.speciesBonus && hook.speciesBonus[species.id]) || 1;
  const randomness = 0.9 + rand() * 0.2; // 0.9 .. 1.1
  const raw = species.baseValuePerKg * weightKg * gearMultiplier * hookBonus * randomness;
  return Math.max(1, Math.round(raw));
}

// A trophy is 1.5-2.1x the species' usual maximum (fish.js trophyWeightFor).
export const isTrophyWeight = (species, weightKg) => weightKg > species.maxWeightKg * 1.4;

// What one landed fish pays: its value on the gear it was caught on, the
// wobble fixed by the catch's id, and triple for a trophy.
export function catchPayout({ species, weightKg, rod, line, hook = null, trophy = false, catchId }) {
  const base = calculatePayout({ species, weightKg, rod, line, hook, rand: () => randomFromId(catchId) });
  return base * (trophy ? 3 : 1);
}
