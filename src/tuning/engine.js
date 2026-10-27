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
  // The take and the strike (strike.js): how long you have to strike
  // after the real bite shows, and how often the hook takes hold.
  strike: {
    lureWindow: 0.55, // s -- a fish hitting a lure
    flyWindow: 0.6,
    nibbleWindow: 0.6, // kurper on a float
    floatWindow: 0.8, // float pulled straight under
    slideWindow: 1.2, // float sliding away
    runWindow: 2.5, // a run on a bottom rig (x1.3 on a baitrunner)
    pullWindow: 1.5, // barbel's slow pull
    hookup: 0.92, // a well-timed strike sets the hook
    tigerHookup: 0.5, // a tiger's bony mouth
    circleStrikeHookup: 0.55, // striking a circle hook pulls it out
    selfHookHair: 0.85, // hair / chod rig, if you wait
    selfHookCircle: 0.92,
    selfHookTreble: 0.3, // a fish hitting a treble lure
    comeBackSeconds: 8, // after a strike too early, bites x3 for this long
  },
  // Working a lure (lureAction.js).
  lures: {
    badBites: 0.35, // bites with a dead or wrong retrieve (x normal)
    bestBites: 2.5, // bites with a perfect retrieve
    followChance: 0.09, // per second, with good action, a fish starts following
    reelSpeed: 1.4, // m/s a lure comes in while you hold to reel (bait: faster)
  },
  // Reading the water (waterReading.js).
  water: {
    rightDepth: 1.4, // bites with the bait at the depth the fish feed at
    dropOffSlope: 0.18, // metres of depth per metre that count as a drop-off
    dropOffBonus: 1.35, // bass, yellowfish, trout and tigers on a drop-off
    windBonus: 1.3, // carp and yellowfish on the bank the wind blows onto
    windMin: 2.7, // wind needed for that (game units; x3 = km/h, so ~8 km/h)
  },
  // Landing the fish: snags, the net, keep or release.
  landing: {
    netMinKg: 0.5, // fish this size and up need the net; smaller ones are swung in
    snagFreeChance: 0.35, // per second, easing off, a snagged fish swims out
    snagEaseSeconds: 2, // ...after you've eased off this long
    snagMaxSeconds: 12, // stuck longer than this and the line parts
    snagMinDistance: 6, // m -- no snags right at your feet
    coverReach: 15, // m -- how far a fish will bolt for cover
    steerLift: 0.2, // rod held at least this high (0..1) steers it off the cover
    keepBonus: 1.2, // a kept fish pays this much more
    releaseBoost: 0.05, // each fish released here: bites +5% this session
    releaseBoostMax: 0.25,
    keepPenalty: 0.1, // each fish kept: that species' bites -10% here this session
    keepPenaltyMax: 0.3,
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
