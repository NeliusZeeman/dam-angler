// Puts a set of tuned values onto the live game: everything goes back to
// its built-in value first, then each override is set. Used by the game (on
// start, from /api/tuning) and by the server (the published values).
import { TUNABLES, tunable } from './registry.js';
import { FISH_SPECIES } from '../fish.js';
import { LOCATIONS } from '../locations.js';
import { TIME_OF_DAY_PHASES } from '../environment.js';
import { ENGINE } from './engine.js';

const copy = (v) => JSON.parse(JSON.stringify(v));

function refreshDerived(touchedSpots) {
  // Which parts of the day each fish counts as "feeding" (tips).
  for (const s of FISH_SPECIES) {
    s.activeTimes = TIME_OF_DAY_PHASES.filter((_, i) => s.activity[i] >= ENGINE.bites.activeThreshold);
  }
  // A spot whose catch mix was tuned: shares back to 100% in total.
  for (const loc of LOCATIONS) {
    if (!touchedSpots.has(loc.id) || !loc.catchShare) continue;
    const total = Object.values(loc.catchShare).reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    for (const k of Object.keys(loc.catchShare)) loc.catchShare[k] = Math.round((loc.catchShare[k] / total) * 1000) / 10;
  }
}

// Everything back to how it was built.
export function resetTuning() {
  for (const t of TUNABLES) t.set(copy(t.defaultValue));
  refreshDerived(new Set());
}

// `values`: { key: value }. Unknown keys are skipped (e.g. a value for a
// fish that was since removed from the game). Returns the keys applied.
export function applyTuning(values = {}) {
  resetTuning();
  const applied = [];
  const touchedSpots = new Set();
  for (const [key, value] of Object.entries(values || {})) {
    const t = tunable(key);
    if (!t) continue;
    t.set(copy(value));
    applied.push(key);
    if (key.startsWith('spot.') && key.includes('.share.')) touchedSpots.add(key.split('.')[1]);
  }
  refreshDerived(touchedSpots);
  return applied;
}
