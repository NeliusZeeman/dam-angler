export function calculatePayout({ species, weightKg, rod, line, hook = null }) {
  const gearQuality = (rod.tier + line.tier) / 2; // 1.0 .. 3.0
  const gearMultiplier = 1 + (gearQuality - 1) * 0.1; // 1.0 .. 1.2
  const hookBonus = (hook && hook.speciesBonus && hook.speciesBonus[species.id]) || 1;
  const randomness = 0.9 + Math.random() * 0.2; // 0.9 .. 1.1
  const raw = species.baseValuePerKg * weightKg * gearMultiplier * hookBonus * randomness;
  return Math.max(1, Math.round(raw));
}
