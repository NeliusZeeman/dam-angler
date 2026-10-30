import { ENGINE } from './tuning/engine.js';

// Levels: points for what you land make your level; the level unlocks
// better gear in the shop and brings the bigger fish on. Worked out from
// the catch log alone (and competition places), so the server -- which
// keeps the catch log -- comes to the same level as the game.

// Level points from a catch log ({ speciesId: { count, totalKg, pbs,
// trophies, released, bestWeightKg } }) and competition places ([1, 3, ...]).
export function pointsFromLog(catchLog = {}, compPlaces = []) {
  const L = ENGINE.levels;
  let pts = 0;
  for (const e of Object.values(catchLog || {})) {
    if (!e || !(e.count > 0)) continue;
    // Old logs kept no running total: call it half the best, each time.
    const kg = Number.isFinite(e.totalKg) ? e.totalKg : e.count * (e.bestWeightKg || 0) * 0.5;
    pts += kg * L.perKg + L.firstSpecies + (e.pbs || 0) * L.personalBest
      + (e.trophies || 0) * L.trophy + (e.released || 0) * L.release + (e.bosses || 0) * L.boss + (e.boatPts || 0);
  }
  for (const place of compPlaces || []) pts += [0, L.comp1, L.comp2, L.comp3][place] || 0;
  return Math.round(pts);
}

// Points a single catch adds, given the log entry from before it.
export function pointsForCatch({ weightKg, trophy = false, boss = false, kept = true }, before = null) {
  const L = ENGINE.levels;
  let pts = weightKg * L.perKg + (trophy ? L.trophy : 0) + (boss ? L.boss : 0) + (kept ? 0 : L.release);
  if (!before || !(before.count > 0)) pts += L.firstSpecies;
  else if (weightKg > (before.bestWeightKg || 0)) pts += L.personalBest;
  return Math.round(pts);
}

// The extra level points a boat rod earns on the fish it's rigged for
// (boatRods.js): the bonus share of what the fish's weight, a trophy or a
// boss is worth. Kept in the log as boatPts.
export function boatPoints({ weightKg, trophy = false, boss = false }, bonus = 1) {
  const L = ENGINE.levels;
  if (!(bonus > 1)) return 0;
  return Math.round((weightKg * L.perKg + (trophy ? L.trophy : 0) + (boss ? L.boss : 0)) * (bonus - 1));
}

// Points needed to reach `level` (level 1 needs none).
export function pointsForLevel(level) {
  const L = ENGINE.levels;
  const n = Math.max(1, Math.min(L.maxLevel, Math.floor(level)));
  return Math.round(L.curveBase * Math.pow(n - 1, L.curvePower));
}

export function levelFor(points) {
  const L = ENGINE.levels;
  let level = 1;
  while (level < L.maxLevel && points >= pointsForLevel(level + 1)) level++;
  return level;
}

// Where you stand: level, points, and how far to the next one.
export function levelInfo(points) {
  const level = levelFor(points);
  const from = pointsForLevel(level);
  const top = level >= ENGINE.levels.maxLevel;
  const to = top ? from : pointsForLevel(level + 1);
  return { level, points, from, to, top, share: top ? 1 : (points - from) / Math.max(1, to - from) };
}

// The level a piece of gear (or a combo) unlocks at: cheap kit is open to
// everyone; each doubling of price above that needs a few more levels.
export function gearLevel(item) {
  if (!item) return 1;
  if (Number.isFinite(item.level)) return item.level;
  const L = ENGINE.levels;
  const cost = item.cost || 0;
  if (cost <= L.gearFreeCost) return 1;
  return Math.max(1, Math.min(L.maxLevel, Math.round(1 + L.gearLevelsPerDoubling * Math.log2(cost / L.gearFreeCost))));
}

// How skewed toward small fish the bites are at a level: a weight is
// min + (max - min) * u^skew, so 1 is an even spread, higher means mostly
// small ones. (How big they can get is sizeCap's job.)
export function sizeSkew(level = 1) {
  const L = ENGINE.levels;
  return Math.max(L.sizeSkewMin, L.sizeSkewStart - (Math.max(1, level) - 1) * L.sizeSkewPerLevel);
}

// The biggest a fish can run for you, as a share of the species' size range
// (min to max): a beginner hooks the small, easy ones; the full range opens
// up as you climb.
export function sizeCap(level = 1) {
  const L = ENGINE.levels;
  return Math.min(1, L.sizeCapStart + (Math.max(1, level) - 1) * L.sizeCapPerLevel);
}

// Now and then a BOSS: a fish at the top of your range or past it, to
// really test you at the level you're at.
export function rollBoss(rng = Math.random) {
  return rng() < ENGINE.levels.bossChance;
}
export function bossWeightFor(species, level = 1, rng = Math.random) {
  const cap = sizeCap(level);
  const share = Math.min(1, cap * 0.9 + rng() * ENGINE.levels.bossReach);
  return species.minWeightKg + share * (species.maxWeightKg - species.minWeightKg);
}
