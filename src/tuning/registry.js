// Every value the admin area can tune: fish, tackle, spots and the engine
// settings. Each entry knows its key, a label and a plain-English hint, its
// limits, its built-in default, and how to set it on the live game data.
//
// Keys: group.item.field -- e.g. fish.common-carp.maxWeightKg,
// gear.rod.rod-carp.castSpeed, spot.jozini.share.tigerfish,
// engine.fight.snapAt.
import { FISH_SPECIES } from '../fish.js';
import { RODS, LINES, REELS, HOOKS, LURES, COMBOS } from '../gear.js';
import { LOCATIONS } from '../locations.js';
import { FIGHT_STYLES } from '../fightMotion.js';
import { ENGINE, ENGINE_DEFAULTS } from './engine.js';

const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ─── Field descriptions ─────────────────────────────────────────────────────
const FISH_FIELDS = {
  minWeightKg: { label: 'Smallest weight', unit: 'kg', min: 0.01, max: 100, step: 0.01, hint: 'The lightest this fish usually comes. Each fish hooked weighs somewhere between the smallest and biggest.' },
  maxWeightKg: { label: 'Biggest weight', unit: 'kg', min: 0.05, max: 200, step: 0.05, hint: 'The heaviest normal fish. Trophies (the rare big one) are 1.5–2.1× this, and the server refuses anything heavier than 2.1×.' },
  tempMinC: { label: 'Coldest water it bites in', unit: '°C', min: -5, max: 40, step: 0.5, hint: 'Below this water temperature it won\'t take a bait at all.' },
  tempMaxC: { label: 'Warmest water it bites in', unit: '°C', min: -5, max: 45, step: 0.5, hint: 'Above this water temperature it won\'t take a bait at all.' },
  baseValuePerKg: { label: 'Credits per kg', unit: 'credits', min: 0, max: 1000, step: 1, hint: 'What it pays per kilogram, before the gear bonus (up to +20%), a hook bonus and a ±10% wobble. Trophies pay triple.' },
  aggressiveness: { label: 'Aggressiveness', unit: '', min: 0, max: 1, step: 0.05, hint: 'How hard it hits a bait once interested (0 = timid nibbler, 1 = smashes it).' },
  activity: { label: 'Feeding through the day', unit: '', min: 0, max: 1, step: 0.05, type: 'array7', hint: 'How hard it feeds in each part of the day: morning, mid-morning, midday, afternoon, sunset, late twilight, night. 1 = feeding flat out, 0 = not feeding.' },
};
const FIGHT_FIELDS = {
  runSpeed: { label: 'Run speed', unit: 'm/s', min: 0.1, max: 10, step: 0.1, hint: 'How fast it swims on a run when hooked (bigger fish run faster on top of this).' },
  stamina: { label: 'Stamina', unit: '', min: 0.1, max: 10, step: 0.1, hint: 'How long it takes to tire. Higher = longer fight.' },
  swing: { label: 'Zig-zag', unit: 'rad', min: 0, max: 3.14, step: 0.05, hint: 'How far it swings sideways while running away from you.' },
  jumpRate: { label: 'Jumps', unit: 'per s', min: 0, max: 2, step: 0.01, hint: 'How often it leaps (0 = never jumps). Reeling during a jump risks it throwing the hook.' },
  jumpHeight: { label: 'Jump height', unit: 'm', min: 0, max: 5, step: 0.1, hint: 'How high it leaps out of the water.' },
  depth: { label: 'Fighting depth', unit: 'm', min: 0, max: 5, step: 0.1, hint: 'How deep it holds while fighting; it comes up as it tires.' },
};
const GEAR_COMMON = {
  cost: { label: 'Price', unit: 'credits', min: 0, max: 100000, step: 1, type: 'integer', hint: 'What it costs in the tackle box. The server charges this price.' },
  inShop: { label: 'In the shop', type: 'boolean', hint: 'Off = players can\'t buy it any more (anyone who owns it keeps it).' },
};
const GEAR_FIELDS = {
  rod: {
    castSpeed: { label: 'Cast speed', unit: 'm/s', min: 5, max: 60, step: 0.5, hint: 'How fast the rod launches the rig at full power — the main thing that sets cast distance.' },
    spread: { label: 'Cast scatter', unit: '°', min: 0, max: 20, step: 0.1, hint: 'How far casts wander off the aim (lower = more accurate).' },
    tensionTolerance: { label: 'Strength', unit: '', min: 0.5, max: 5, step: 0.05, hint: 'How much strain the rod takes off the line in a fight (higher = the line sits lower on the gauge).' },
    maxKg: { label: 'Rated load', unit: 'kg', min: 0.5, max: 100, step: 0.5, hint: 'The pull it\'s built to lift. Bent past this it locks up and the hook takes every jolt.' },
    shockAbsorb: { label: 'Shock absorbing', unit: '', min: 0, max: 0.9, step: 0.01, hint: 'How much of a lunge the blank soaks up before it reaches the line (soft rods cushion more).' },
  },
  line: {
    breakKg: { label: 'Breaking strain', unit: 'kg', min: 0.5, max: 100, step: 0.1, hint: 'The pull that snaps it.' },
    castMultiplier: { label: 'Cast distance factor', unit: '×', min: 0.5, max: 2, step: 0.01, hint: 'Thin, slick lines fly further (1 = normal).' },
  },
  reel: {
    castMultiplier: { label: 'Cast distance factor', unit: '×', min: 0.5, max: 2, step: 0.01, hint: 'A bigger, smoother spool casts further (1 = normal).' },
    dragBonus: { label: 'Drag quality', unit: '', min: 0, max: 1, step: 0.01, hint: 'A smooth drag eases the fight and doesn\'t stick on a lunge (0 = cheap and jerky).' },
  },
  hook: {
    strengthKg: { label: 'Strength', unit: 'kg', min: 0.5, max: 100, step: 0.5, hint: 'Roughly the pull before it straightens under a big fish.' },
    holdBonus: { label: 'Hold', unit: '', min: 0, max: 0.95, step: 0.01, hint: 'How well it stays in — on jumps and slack line (0 = drops out easily).' },
    tensionBonus: { label: 'Fight bonus', unit: '', min: 0, max: 1, step: 0.01, hint: 'A well-set hook eases the fight a little.' },
  },
  lure: {},
  combo: {},
};
const GEAR_LISTS = { rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES, combo: COMBOS };
const GEAR_GROUP = { rod: 'Rods', line: 'Lines', reel: 'Reels', hook: 'Hooks', lure: 'Baits', combo: 'Combos' };

const ENGINE_FIELDS = {
  bites: {
    rate: { label: 'Bite rate', min: 0.001, max: 0.5, step: 0.001, hint: 'Base chance per second that a fish suited to your bait takes it. Higher = faster bites everywhere.' },
    guaranteeSeconds: { label: 'Guaranteed bite after', unit: 's', min: 10, max: 900, step: 5, hint: 'A line left in the water this long always gets a bite (bites get more likely as it gets close).' },
    trophyChance: { label: 'Trophy chance', min: 0, max: 0.2, step: 0.0005, hint: 'Share of bites that are the big one (0.0033 = 1 in 300).' },
    activeThreshold: { label: '"Feeding" level for tips', min: 0.1, max: 1, step: 0.05, hint: 'A fish counts as "feeding now" in the What\'s biting tips when its feeding level is at least this.' },
  },
  fight: {
    snapAt: { label: 'Line snaps at', min: 0.5, max: 1.2, step: 0.01, hint: 'Share of the tension bar where the line snaps.' },
    reelTensionRate: { label: 'Tension build-up when reeling', min: 0.05, max: 3, step: 0.01, hint: 'How quickly the line loads up while you hold the reel.' },
    slackRate: { label: 'Tension drop when easing off', min: 0.05, max: 3, step: 0.01, hint: 'How quickly the line relaxes when you stop reeling.' },
    progressRate: { label: 'Reeling progress', min: 0.02, max: 2, step: 0.01, hint: 'How fast reeling tires the fish and wins line (higher = shorter fights).' },
    progressLossRate: { label: 'Fish recovers', min: 0, max: 1, step: 0.01, hint: 'How fast the fish gets its strength back while you rest.' },
    slackLimitSeconds: { label: 'Slack line allowed', unit: 's', min: 0.5, max: 30, step: 0.5, hint: 'Seconds of slack line before the hook drops out.' },
    slackThreshold: { label: 'Slack point', min: 0, max: 0.5, step: 0.01, hint: 'Tension below this counts as slack.' },
    defaultDrag: { label: 'Starting drag', min: 0.05, max: 0.9, step: 0.01, hint: 'Drag new players start with (share of line strength; a third is the angler\'s rule).' },
    haulOver: { label: 'Winding past the drag', min: 0, max: 1, step: 0.01, hint: 'How far the line can load past the drag setting while you keep winding.' },
    lungeOver: { label: 'Winding into a lunge', min: 0, max: 1, step: 0.01, hint: 'How far the line loads past the drag if you keep winding while the fish runs and takes line.' },
    stickChance: { label: 'Jerky drag sticks', min: 0, max: 1, step: 0.05, hint: 'Chance a cheap reel drag sticks for a moment when the fish lunges, overshooting its setting.' },
    lineWear: { label: 'Line wear', min: 0, max: 0.5, step: 0.005, hint: 'How fast line frays when a fish heavier than its rating keeps it loaded hard. 0 = never wears.' },
    hookStrainSeconds: { label: 'Hook holds for', unit: 's', min: 0, max: 10, step: 0.1, hint: 'Seconds of hauling harder than the hook is rated before it can start to open.' },
    hookOpenRate: { label: 'Hook opening rate', min: 0, max: 2, step: 0.05, hint: 'Per second, x how far over its rating the pull is, the chance an overloaded hook opens.' },
    shockFactor: { label: 'Hardest jolt', unit: '×', min: 1, max: 4, step: 0.05, hint: 'The most a fish can ever load the line, as a multiple of its steady pull. Small fish can never break strong line.' },
    tireRelief: { label: 'Tired fish pulls less', min: 0, max: 0.95, step: 0.05, hint: 'How much less a beaten fish pulls than a fresh one (0 = never tires).' },
    slipGain: { label: 'Winding on a slipping drag', min: 0, max: 1, step: 0.05, hint: 'Share of normal line gained while the fish pulls harder than the drag (the spool just turns). Low = a loose drag on a big fish is a long fight.' },
    wearFrom: { label: 'Wear starts at', min: 0.3, max: 0.9, step: 0.01, hint: 'Share of the line strength where hard loading starts to fray it. A drag set below this keeps the line safe.' },
    dragTension: { label: 'Tension on a run', min: 0.05, max: 1, step: 0.01, hint: 'How tight the line sits while a fish takes line against the drag.' },
    dragTire: { label: 'Runs tire the fish', min: 0, max: 2, step: 0.01, hint: 'How much a run against the drag wears the fish down.' },
    jumpStrain: { label: 'Jump strain', min: 0, max: 2, step: 0.01, hint: 'Extra tension from reeling while a fish is in the air.' },
    throwChancePerSecond: { label: 'Hook thrown on a jump', min: 0, max: 5, step: 0.05, hint: 'Chance per second of reeling through a jump that the fish throws the hook.' },
    landReach: { label: 'Landing reach', unit: 'm', min: 1, max: 20, step: 0.1, hint: 'How close a fish must be to land it.' },
  },
  strike: {
    lureWindow: { label: 'Strike time: lure hit', unit: 's', min: 0.1, max: 5, step: 0.05, hint: 'How long after a fish hits a lure you have to strike.' },
    flyWindow: { label: 'Strike time: fly take', unit: 's', min: 0.1, max: 5, step: 0.05, hint: 'How long after a fish takes a fly you have to strike.' },
    nibbleWindow: { label: 'Strike time: kurper on a float', unit: 's', min: 0.1, max: 5, step: 0.05, hint: 'After the nibbles, once the float goes under.' },
    floatWindow: { label: 'Strike time: float pulled under', unit: 's', min: 0.1, max: 5, step: 0.05, hint: 'An aggressive fish on a float.' },
    slideWindow: { label: 'Strike time: float sliding away', unit: 's', min: 0.1, max: 5, step: 0.05, hint: 'A carp or heavy fish on a float.' },
    runWindow: { label: 'Strike time: a run (bottom rig)', unit: 's', min: 0.1, max: 8, step: 0.1, hint: 'Carp and barbel on the bottom. 30% longer on a baitrunner.' },
    pullWindow: { label: 'Strike time: slow pull', unit: 's', min: 0.1, max: 8, step: 0.1, hint: 'Barbel on liver or sardine.' },
    hookup: { label: 'Hook-up on a good strike', min: 0, max: 1, step: 0.01, hint: 'Chance a well-timed strike sets the hook.' },
    tigerHookup: { label: 'Hook-up on a tigerfish', min: 0, max: 1, step: 0.01, hint: 'Their bony mouth: even a good strike often fails (+0.1 on treble lures).' },
    circleStrikeHookup: { label: 'Hook-up striking a circle hook', min: 0, max: 1, step: 0.01, hint: 'Striking hard pulls a circle hook out — better to just wind.' },
    selfHookHair: { label: 'Self-hook: hair / chod rig', min: 0, max: 1, step: 0.01, hint: 'Chance a hair or chod rig hooks the fish if you do not strike.' },
    selfHookCircle: { label: 'Self-hook: circle hook', min: 0, max: 1, step: 0.01, hint: 'Chance a circle hook hooks the fish if you do not strike.' },
    selfHookTreble: { label: 'Self-hook: treble lure', min: 0, max: 1, step: 0.01, hint: 'Chance a fish hitting a treble lure hooks itself.' },
    comeBackSeconds: { label: 'Fish comes back after an early strike', unit: 's', min: 0, max: 60, step: 1, hint: 'Bites are three times as likely for this long after striking too early.' },
  },
  lures: {
    badBites: { label: 'Bites on a badly worked lure', unit: '×', min: 0, max: 3, step: 0.05, hint: 'Bite chance with a dead or wrong retrieve, compared with normal.' },
    bestBites: { label: 'Bites on a well worked lure', unit: '×', min: 0.5, max: 6, step: 0.05, hint: 'Bite chance with a perfect retrieve, compared with normal.' },
    followChance: { label: 'Fish following the lure', unit: 'per s', min: 0, max: 1, step: 0.01, hint: 'With good action, how often a fish starts following the lure in.' },
    reelSpeed: { label: 'Lure reel-in speed', unit: 'm/s', min: 0.3, max: 5, step: 0.1, hint: 'How fast a lure comes in while you hold to reel (a steady crank).' },
  },
  water: {
    rightDepth: { label: 'Bites at the right depth', unit: '×', min: 1, max: 4, step: 0.05, hint: 'With the bait where the fish feed (bottom, or their depth band). Far off drops to x0.35.' },
    dropOffSlope: { label: 'Drop-off steepness', unit: 'm/m', min: 0.02, max: 1, step: 0.01, hint: 'How steep the bottom must fall away to count as a drop-off.' },
    dropOffBonus: { label: 'Bites on a drop-off', unit: '×', min: 1, max: 4, step: 0.05, hint: 'Bass, yellowfish, trout and tigers patrolling a drop-off.' },
    windBonus: { label: 'Bites on the windward bank', unit: '×', min: 1, max: 4, step: 0.05, hint: 'Carp, yellowfish and kurper where the wind blows food onto the bank.' },
    windMin: { label: 'Wind for the windward bank', min: 0, max: 20, step: 0.1, hint: 'Wind strength needed (x3 = km/h; 2.7 is about 8 km/h).' },
  },
  landing: {
    netMinKg: { label: 'Fish that need the net', unit: 'kg', min: 0, max: 20, step: 0.1, hint: 'This size and up must be netted; smaller fish are swung straight in.' },
    snagFreeChance: { label: 'Snagged fish swims out', unit: 'per s', min: 0, max: 1, step: 0.01, hint: 'While you ease off, the chance each second a snagged fish frees itself.' },
    snagEaseSeconds: { label: 'Ease off before it swims out', unit: 's', min: 0, max: 10, step: 0.5, hint: 'How long you must stop reeling before a snagged fish can swim out.' },
    snagMaxSeconds: { label: 'Snag time before the line parts', unit: 's', min: 2, max: 60, step: 1, hint: 'Stuck in cover longer than this and it breaks off.' },
    snagMinDistance: { label: 'No snags closer than', unit: 'm', min: 0, max: 30, step: 0.5, hint: 'Fish this close to you cannot get snagged.' },
    coverReach: { label: 'Bolts for cover within', unit: 'm', min: 0, max: 50, step: 1, hint: 'How far a hooked fish will run to reach weed, reeds or timber.' },
    coverChance: { label: 'Bolts for cover', min: 0, max: 1, step: 0.05, hint: 'Chance each run of a carp, bass or barbel heads for the nearest weed, reeds or timber.' },
    straySnagChance: { label: 'Snags by chance', min: 0, max: 2, step: 0.01, hint: 'Per second, chance a fish swimming over cover tangles in it without aiming for it.' },
    steerLift: { label: 'Rod height to steer it off cover', min: 0, max: 1, step: 0.05, hint: 'Hold the reel with the rod at least this high to turn a fish away from cover.' },
    keepBonus: { label: 'Keep: extra credits', unit: '×', min: 1, max: 3, step: 0.05, hint: 'A kept fish pays this much more than a released one. The server pays it.' },
    releaseBoost: { label: 'Release: bites boost per fish', min: 0, max: 0.5, step: 0.01, hint: 'Each fish released at a dam raises bites there this session.' },
    releaseBoostMax: { label: 'Release: most boost', min: 0, max: 2, step: 0.05, hint: 'The most that releasing can raise bites at one dam.' },
    keepPenalty: { label: 'Keep: fewer bites per fish', min: 0, max: 0.5, step: 0.01, hint: 'Each fish kept lowers bites of that species at that dam this session.' },
    keepPenaltyMax: { label: 'Keep: most drop', min: 0, max: 0.9, step: 0.05, hint: 'The most that keeping can lower one species bites at a dam.' },
  },
  motion: {
    runSeconds: { label: 'Length of a run', unit: 's', min: 0.2, max: 10, step: 0.1, hint: 'How long each run lasts.' },
    reelSpeed: { label: 'Reel speed', unit: 'm/s', min: 0.2, max: 10, step: 0.1, hint: 'How fast the reel winds line in during a fight.' },
    lineOnSpool: { label: 'Line on the spool', unit: 'm', min: 20, max: 500, step: 5, hint: 'Furthest a hooked fish can run.' },
  },
  cast: {
    gravity: { label: 'Gravity', unit: 'm/s²', min: 1, max: 20, step: 0.01, hint: 'Pulls the rig down in flight (lower = longer, floatier casts).' },
    launchElevation: { label: 'Launch angle', unit: 'rad', min: 0.1, max: 1.2, step: 0.01, hint: 'Angle the rig leaves the rod at (0.55 ≈ 31°, the best distance angle).' },
  },
  goals: {
    dailyReward: { label: 'Daily challenge reward', unit: 'credits', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Credits for an everyday daily challenge; harder ones pay 1.2-1.5x.' },
    weeklyReward: { label: 'Weekly challenge reward', unit: 'credits', min: 0, max: 50000, step: 10, type: 'integer', hint: 'Credits for the weekly challenge.' },
    prize1: { label: 'Competition prize: 1st', unit: 'credits', min: 0, max: 100000, step: 50, type: 'integer', hint: 'Paid by the server when the month ends.' },
    prize2: { label: 'Competition prize: 2nd', unit: 'credits', min: 0, max: 100000, step: 50, type: 'integer', hint: 'Paid by the server to the runner-up when the month ends.' },
    prize3: { label: 'Competition prize: 3rd', unit: 'credits', min: 0, max: 100000, step: 50, type: 'integer', hint: 'Paid by the server to third place when the month ends.' },
  },
  levels: {
    perKg: { label: 'Points per kg', unit: 'pts', min: 0, max: 1000, step: 1, hint: 'Level points for every kg landed.' },
    firstSpecies: { label: 'First of a species', unit: 'pts', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Bonus for your first fish of a species.' },
    personalBest: { label: 'Personal best', unit: 'pts', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Bonus for beating your best of a species.' },
    trophy: { label: 'Trophy', unit: 'pts', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Bonus for a 1-in-300 trophy.' },
    release: { label: 'Release', unit: 'pts', min: 0, max: 1000, step: 1, type: 'integer', hint: 'Bonus for putting a fish back.' },
    comp1: { label: 'Competition 1st', unit: 'pts', min: 0, max: 100000, step: 10, type: 'integer', hint: 'Points for winning a monthly competition.' },
    comp2: { label: 'Competition 2nd', unit: 'pts', min: 0, max: 100000, step: 10, type: 'integer', hint: 'Points for second place.' },
    comp3: { label: 'Competition 3rd', unit: 'pts', min: 0, max: 100000, step: 10, type: 'integer', hint: 'Points for third place.' },
    curveBase: { label: 'Level curve size', unit: 'pts', min: 1, max: 10000, step: 1, hint: 'Points to reach level L = this x (L-1)^power.' },
    curvePower: { label: 'Level curve steepness', min: 1, max: 3, step: 0.05, hint: 'Higher = later levels take much longer.' },
    maxLevel: { label: 'Top level', min: 2, max: 100, step: 1, type: 'integer', hint: 'The highest level.' },
    gearFreeCost: { label: 'Gear with no level', unit: 'credits', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Gear up to this price can be bought at level 1.' },
    gearLevelsPerDoubling: { label: 'Gear levels per price doubling', min: 0, max: 10, step: 0.1, hint: 'Each doubling of price above the free price needs this many more levels.' },
    sizeSkewStart: { label: 'Beginner fish size', min: 0.2, max: 5, step: 0.05, hint: 'How strongly a level-1 angler hooks small fish (1 = even spread, higher = smaller).' },
    sizeSkewPerLevel: { label: 'Bigger fish per level', min: 0, max: 1, step: 0.01, hint: 'How much the size skew eases with each level.' },
    sizeSkewMin: { label: 'Top-level fish size', min: 0.2, max: 2, step: 0.05, hint: 'The skew at the top (below 1 = big fish more common than small).' },
    sizeCapStart: { label: 'Beginner size cap', min: 0.05, max: 1, step: 0.05, hint: 'Biggest fish a level-1 angler hooks, as a share of the species size range.' },
    sizeCapPerLevel: { label: 'Size cap per level', min: 0, max: 0.5, step: 0.005, hint: 'How much the size cap opens up each level.' },
    bossChance: { label: 'Boss fish chance', min: 0, max: 0.5, step: 0.005, hint: 'Share of bites that are a BOSS fish for your level.' },
    bossReach: { label: 'Boss size past the cap', min: 0, max: 1, step: 0.05, hint: 'How far past your size cap a boss can run (share of the species range).' },
    boss: { label: 'Boss points', unit: 'pts', min: 0, max: 10000, step: 5, type: 'integer', hint: 'Points for landing a boss fish.' },
  },
  money: {
    chumCost: { label: 'Breadcrumbs price', unit: 'credits', min: 0, max: 10000, step: 1, type: 'integer', hint: 'Credits per throw of breadcrumbs.' },
    guestImportLimit: { label: 'Guest progress limit', unit: 'credits', min: 0, max: 1000000, step: 100, type: 'integer', hint: 'Most a guest can bring into a new account (credits plus gear value).' },
  },
};
const ENGINE_GROUP = { bites: 'Bites', strike: 'Strike', lures: 'Working lures', water: 'Reading the water', landing: 'Landing the fish', goals: 'Challenges & competitions', fight: 'Fight', motion: 'Hooked fish', cast: 'Casting', money: 'Money' };

// ─── Building the list ──────────────────────────────────────────────────────
export const TUNABLES = [];
const BY_KEY = new Map();
function add(entry) {
  const t = { type: 'number', unit: '', step: 0.01, ...entry };
  t.defaultValue = copy(t.get());
  TUNABLES.push(t);
  BY_KEY.set(t.key, t);
}

for (const s of FISH_SPECIES) {
  const item = { group: 'Fish', item: s.id, itemLabel: s.name };
  for (const [field, meta] of Object.entries(FISH_FIELDS)) {
    const get = field === 'tempMinC' ? () => s.tempRangeC[0] : field === 'tempMaxC' ? () => s.tempRangeC[1] : () => s[field];
    const set = field === 'tempMinC' ? (v) => { s.tempRangeC[0] = v; } : field === 'tempMaxC' ? (v) => { s.tempRangeC[1] = v; } : (v) => { s[field] = copy(v); };
    add({ ...item, ...meta, key: `fish.${s.id}.${field}`, field, get, set });
  }
  for (const lureId of s.preferredLureIds) {
    const lure = LURES.find((l) => l.id === lureId);
    if (!lure) continue;
    const hadAffinity = !!s.lureAffinity && lureId in s.lureAffinity;
    add({
      ...item, key: `fish.${s.id}.lure.${lureId}`, field: `lure.${lureId}`, label: `Likes: ${lure.name}`, min: 0, max: 3, step: 0.05,
      hint: 'How much it goes for this bait (1 = a normal favourite, 0 = ignores it, above 1 = loves it).',
      get: () => s.lureAffinity?.[lureId] ?? 1,
      set: (v) => {
        // Only write an entry when it differs from "normal" (1), so a reset
        // leaves the data exactly as built.
        if (v === 1 && !hadAffinity) { if (s.lureAffinity) delete s.lureAffinity[lureId]; return; }
        s.lureAffinity = s.lureAffinity || {};
        s.lureAffinity[lureId] = v;
      },
    });
  }
  const style = FIGHT_STYLES[s.id];
  if (style) {
    for (const [field, meta] of Object.entries(FIGHT_FIELDS)) {
      add({ ...item, ...meta, key: `fish.${s.id}.fight.${field}`, field: `fight.${field}`, label: `Fight: ${meta.label}`, get: () => style[field], set: (v) => { style[field] = v; } });
    }
  }
}

for (const [kind, list] of Object.entries(GEAR_LISTS)) {
  for (const g of list) {
    const item = { group: GEAR_GROUP[kind], item: `${kind}.${g.id}`, itemLabel: g.name };
    for (const [field, meta] of Object.entries({ ...GEAR_COMMON, ...GEAR_FIELDS[kind] })) {
      if (field !== 'inShop' && g[field] === undefined) continue;
      const get = field === 'inShop' ? () => g.inShop !== false : () => g[field];
      const set = field === 'breakKg' ? (v) => { g.breakKg = v; g.breakStrength = v / 4.5; }
        : field === 'inShop' ? (v) => { if (v) delete g.inShop; else g.inShop = false; }
          : (v) => { g[field] = v; };
      add({ ...item, ...meta, key: `gear.${kind}.${g.id}.${field}`, field, get, set });
    }
  }
}

for (const loc of LOCATIONS) {
  const item = { group: 'Spots', item: loc.id, itemLabel: loc.name };
  for (const speciesId of Object.keys(loc.catchShare || {})) {
    const sp = FISH_SPECIES.find((f) => f.id === speciesId);
    add({
      ...item, key: `spot.${loc.id}.share.${speciesId}`, field: `share.${speciesId}`, label: `Share: ${sp?.name || speciesId}`,
      unit: '%', min: 0, max: 100, step: 1,
      hint: 'This fish\'s share of the catch here. Shares are re-balanced to add up to 100%, so raising one lowers the others.',
      get: () => loc.catchShare[speciesId], set: (v) => { loc.catchShare[speciesId] = v; },
    });
  }
  const hadTemp = 'tempOffset' in loc;
  add({
    ...item, key: `spot.${loc.id}.tempOffset`, field: 'tempOffset', label: 'Water temperature', unit: '°C', min: -15, max: 15, step: 0.5,
    hint: 'How much warmer (+) or colder (−) the water runs than a Highveld dam — decides which fish bite (trout need cold).',
    get: () => loc.tempOffset ?? 0,
    set: (v) => { if (v === 0 && !hadTemp) delete loc.tempOffset; else loc.tempOffset = v; },
  });
}

for (const [area, fields] of Object.entries(ENGINE_FIELDS)) {
  for (const [field, meta] of Object.entries(fields)) {
    add({
      group: 'Game settings', item: area, itemLabel: ENGINE_GROUP[area], ...meta,
      key: `engine.${area}.${field}`, field, get: () => ENGINE[area][field], set: (v) => { ENGINE[area][field] = v; },
    });
  }
}
// The engine's defaults come from ENGINE_DEFAULTS (the list is built after
// any earlier tuning could have run in the same process).
for (const t of TUNABLES) if (t.key.startsWith('engine.')) { const [, a, f] = t.key.split('.'); t.defaultValue = ENGINE_DEFAULTS[a][f]; }

export const tunable = (key) => BY_KEY.get(key);
export const GROUPS = ['Fish', 'Rods', 'Lines', 'Reels', 'Combos', 'Hooks', 'Baits', 'Spots', 'Game settings'];

// Checks a value for a key; returns the clean value or throws with a sentence.
export function validateValue(key, value) {
  const t = BY_KEY.get(key);
  if (!t) throw new Error(`Unknown setting "${String(key).slice(0, 80)}".`);
  const range = `${t.min} to ${t.max}${t.unit ? ` ${t.unit}` : ''}`;
  if (t.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${t.itemLabel} — ${t.label}: must be on or off.`);
    return value;
  }
  if (t.type === 'array7') {
    if (!Array.isArray(value) || value.length !== 7 || !value.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= t.min && x <= t.max)) {
      throw new Error(`${t.itemLabel} — ${t.label}: needs 7 numbers from ${range}.`);
    }
    return value.map((x) => Math.round(x * 1000) / 1000);
  }
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n) || n < t.min || n > t.max) throw new Error(`${t.itemLabel} — ${t.label}: must be from ${range}.`);
  if (t.type === 'integer' && !Number.isInteger(n)) throw new Error(`${t.itemLabel} — ${t.label}: must be a whole number.`);
  return n;
}

// Values that don't make sense together (checked after applying a set).
export function crossCheck(values) {
  const problems = [];
  for (const s of FISH_SPECIES) {
    const v = (f) => { const key = `fish.${s.id}.${f}`; return values[key] ?? BY_KEY.get(key).defaultValue; };
    if (v('minWeightKg') >= v('maxWeightKg')) problems.push(`${s.name}: the smallest weight must be below the biggest.`);
    if (v('tempMinC') >= v('tempMaxC')) problems.push(`${s.name}: the coldest water must be below the warmest.`);
  }
  return problems;
}
