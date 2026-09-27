// Every value the admin area can tune: fish, tackle, spots and the engine
// settings. Each entry knows its key, a label and a plain-English hint, its
// limits, its built-in default, and how to set it on the live game data.
//
// Keys: group.item.field -- e.g. fish.common-carp.maxWeightKg,
// gear.rod.rod-carp.castSpeed, spot.jozini.share.tigerfish,
// engine.fight.snapAt.
import { FISH_SPECIES } from '../fish.js';
import { RODS, LINES, REELS, HOOKS, LURES } from '../gear.js';
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
};
const GEAR_LISTS = { rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES };
const GEAR_GROUP = { rod: 'Rods', line: 'Lines', reel: 'Reels', hook: 'Hooks', lure: 'Baits' };

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
    dragTension: { label: 'Tension on a run', min: 0.05, max: 1, step: 0.01, hint: 'How tight the line sits while a fish takes line against the drag.' },
    dragTire: { label: 'Runs tire the fish', min: 0, max: 2, step: 0.01, hint: 'How much a run against the drag wears the fish down.' },
    jumpStrain: { label: 'Jump strain', min: 0, max: 2, step: 0.01, hint: 'Extra tension from reeling while a fish is in the air.' },
    throwChancePerSecond: { label: 'Hook thrown on a jump', min: 0, max: 5, step: 0.05, hint: 'Chance per second of reeling through a jump that the fish throws the hook.' },
    landReach: { label: 'Landing reach', unit: 'm', min: 1, max: 20, step: 0.1, hint: 'How close a fish must be to land it.' },
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
  money: {
    chumCost: { label: 'Breadcrumbs price', unit: 'credits', min: 0, max: 10000, step: 1, type: 'integer', hint: 'Credits per throw of breadcrumbs.' },
    guestImportLimit: { label: 'Guest progress limit', unit: 'credits', min: 0, max: 1000000, step: 100, type: 'integer', hint: 'Most a guest can bring into a new account (credits plus gear value).' },
  },
};
const ENGINE_GROUP = { bites: 'Bites', fight: 'Fight', motion: 'Hooked fish', cast: 'Casting', money: 'Money' };

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
export const GROUPS = ['Fish', 'Rods', 'Lines', 'Reels', 'Hooks', 'Baits', 'Spots', 'Game settings'];

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
