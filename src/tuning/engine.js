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
    haulOver: 0.14, // winding against a slipping drag loads the line only a little past it
    lungeOver: 0.15, // ...winding while it runs and takes line jolts it much further
    stickChance: 0.1, // how often a cheap, jerky drag sticks on a lunge
    lineWear: 0.06, // how fast hard-loaded line frays under a fish heavier than its rating (per second at full load)
    hookStrainSeconds: 3.5, // hauling harder than the hook holds for this long before it can open
    hookOpenRate: 0.12, // ...then this x the overload, per second, it opens
    shockFactor: 1.5, // the most a fish can load the line, x its steady pull (a lunge, a head-shake)
    tireRelief: 0.6, // a beaten fish pulls this much less than a fresh one
    slipGain: 0.15, // winding while the spool slips gains only this share of line
    wearFrom: 0.6, // line loaded past this share of its strength starts to fray
    dragTension: 0.28,
    dragTire: 0.45,
    jumpStrain: 0.25,
    throwChancePerSecond: 0.3,
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
    snagMaxSeconds: 20, // stuck longer than this and the line parts
    snagMinDistance: 6, // m -- no snags right at your feet
    coverReach: 15, // m -- how far a fish will bolt for cover
    coverChance: 0.3, // chance a run heads for the nearest cover
    straySnagChance: 0.08, // per second, a fish swimming over cover tangles in it anyway
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
  // Things to chase (goals.js).
  goals: {
    dailyReward: 60, // credits for an everyday daily challenge (harder ones x1.2-1.5)
    weeklyReward: 350, // for the weekly one
    prize1: 1500, // monthly competition: 1st
    prize2: 800,
    prize3: 400,
  },
  // Levels (levels.js): points for what you land, the level they make,
  // gear unlocked by level, bigger fish biting as you climb.
  levels: {
    perKg: 10, // points per kg landed
    firstSpecies: 50, // your first of a species
    personalBest: 20, // beating your best of a species
    trophy: 150, // a 1-in-300 trophy
    release: 3, // putting one back
    comp1: 400, // monthly competition: 1st
    comp2: 250,
    comp3: 120,
    curveBase: 60, // points to reach level L: curveBase * (L-1)^curvePower
    curvePower: 1.8,
    maxLevel: 30,
    gearFreeCost: 60, // gear up to this price needs no level
    gearLevelsPerDoubling: 2.5, // each doubling of price above that: this many levels
    sizeSkewStart: 2.1, // a beginner mostly hooks small fish (higher = smaller)
    sizeSkewPerLevel: 0.07, // ...and it eases each level
    sizeSkewMin: 0.45, // at the top, big fish are common
    sizeCapStart: 0.3, // a level-1 angler's fish run up to this share of the species' size range
    sizeCapPerLevel: 0.035, // ...and the cap opens this much per level (full range at ~21)
    bossChance: 0.04, // share of bites that are a BOSS for your level (1 in 25)
    bossReach: 0.35, // a boss runs up to this much of the size range past your cap
    boss: 120, // points for landing a boss
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
