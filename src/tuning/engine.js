// The game's engine settings -- bites, the fight, how the hooked fish moves,
// casting, money -- in one live object. The game reads them the moment it
// needs them, so the admin area's tuning (tuning/apply.js) takes effect
// without touching the code. ENGINE_DEFAULTS are the built-in values.

const DEFAULTS = {
  bites: {
    rate: 0.035, // base chance per second a suited fish takes the bait
    guaranteeSeconds: 90, // a line left in this long is sure to get a bite
    trophyChance: 1 / 300, // share of bites that are the big one
    activeThreshold: 0.75, // feeding level that counts as "active" in the tips
  },
  fight: {
    snapAt: 0.9, // share of the line's strength where it snaps
    reelTensionRate: 0.42,
    slackRate: 0.55,
    progressRate: 0.22,
    progressLossRate: 0.05,
    slackLimitSeconds: 4,
    slackThreshold: 0.06,
    defaultDrag: 0.33,
    haulOver: 0.35,
    dragTension: 0.28,
    dragTire: 0.45,
    jumpStrain: 0.25,
    throwChancePerSecond: 0.8,
    landReach: 4.2, // metres from you a fish must be to land it
  },
  motion: {
    runSeconds: 1.3,
    reelSpeed: 1.5, // m/s the reel winds in
    lineOnSpool: 140, // m -- a fish can't run further than this
  },
  cast: {
    gravity: 9.81,
    launchElevation: 0.55, // radians (~31°)
  },
  money: {
    chumCost: 15,
    guestImportLimit: 10_000,
  },
};

const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === 'object' && deepFreeze(v)); return Object.freeze(o); };
export const ENGINE_DEFAULTS = deepFreeze(JSON.parse(JSON.stringify(DEFAULTS)));
export const ENGINE = JSON.parse(JSON.stringify(DEFAULTS));

// Back to the built-in values.
export function resetEngine() {
  for (const [group, values] of Object.entries(ENGINE_DEFAULTS)) Object.assign(ENGINE[group], values);
}
