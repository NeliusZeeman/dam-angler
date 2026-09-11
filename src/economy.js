export function calculatePayout({ species, weightKg, rod, line }) {
  const gearQuality = (rod.tier + line.tier) / 2; // 1.0 .. 3.0
  const gearMultiplier = 1 + (gearQuality - 1) * 0.1; // 1.0 .. 1.2
  const randomness = 0.9 + Math.random() * 0.2; // 0.9 .. 1.1
  const raw = species.baseValuePerKg * weightKg * gearMultiplier * randomness;
  return Math.max(1, Math.round(raw));
}
