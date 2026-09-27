// Checks what players send against the rules and against the game's own
// data (the same fish, gear and spots the game uses), so nothing unknown or
// impossible gets into the database.
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, REELS, HOOKS, LURES } from '../src/gear.js';
import { LOCATIONS } from '../src/locations.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new HttpError(400, message);

export const GEAR = { rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES };
// Save field names for each kind of gear.
export const GEAR_FIELDS = {
  rod: ['ownedRodIds', 'equippedRodId'],
  line: ['ownedLineIds', 'equippedLineId'],
  reel: ['ownedReelIds', 'equippedReelId'],
  hook: ['ownedHookIds', 'equippedHookId'],
  lure: ['ownedLureIds', 'equippedLureId'],
};
// What every player starts with (the free items).
export const STARTER = { rod: 'rod-starter', line: 'line-starter', reel: 'reel-starter', hook: 'hook-small', lure: 'bread-bait' };

const GEAR_IDS = Object.fromEntries(Object.entries(GEAR).map(([k, list]) => [k, new Set(list.map((i) => i.id))]));
const SPECIES = new Map(FISH_SPECIES.map((s) => [s.id, s]));
const LOCATION_IDS = new Set(LOCATIONS.map((l) => l.id));
const TIMES = new Set(['morning', 'midMorning', 'midday', 'afternoon', 'sunset', 'lateTwilight', 'night']);
// A trophy can be up to 2.1x the species' usual maximum (see fish.js).
const TROPHY_FACTOR = 2.1;

export const isKnownLocation = (id) => LOCATION_IDS.has(id);
export const isKnownGear = (kind, id) => GEAR_IDS[kind]?.has(id) ?? false;

export function checkEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('Please enter a valid email address.');
  return e;
}

export function checkUsername(username) {
  const u = String(username ?? '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) throw bad('Usernames are 3 to 20 letters, numbers or underscores.');
  return u;
}

export function checkPassword(password) {
  const p = String(password ?? '');
  if (p.length < 8) throw bad('Passwords need at least 8 characters.');
  if (p.length > 200) throw bad('That password is too long.');
  return p;
}

// Cleans a save from the game. Unknown gear is dropped, the free starter
// items are always owned, and anything equipped must be owned.
export function cleanSave(save) {
  if (!save || typeof save !== 'object') throw bad('No save was sent.');
  const credits = Number(save.credits ?? 0);
  if (!Number.isFinite(credits) || credits < 0) throw bad('Credits can\'t be negative.');
  const out = { credits: Math.floor(credits), gear: {}, equipped: {} };
  for (const [kind, [ownedField, equippedField]] of Object.entries(GEAR_FIELDS)) {
    const owned = new Set([STARTER[kind]]);
    for (const id of Array.isArray(save[ownedField]) ? save[ownedField] : []) {
      if (isKnownGear(kind, id)) owned.add(id);
    }
    out.gear[kind] = [...owned];
    out.equipped[kind] = owned.has(save[equippedField]) ? save[equippedField] : STARTER[kind];
  }
  const drag = Number(save.drag);
  out.drag = Number.isFinite(drag) ? Math.min(0.9, Math.max(0.05, drag)) : null;
  out.locationId = isKnownLocation(save.locationId) ? save.locationId : null;
  out.startTime = TIMES.has(save.startTimeOfDay) ? save.startTimeOfDay : null;
  const settings = save.settings && typeof save.settings === 'object' && !Array.isArray(save.settings) ? save.settings : {};
  if (JSON.stringify(settings).length > 4000) throw bad('Settings are too large.');
  out.settings = settings;
  return out;
}

// A guest's old catch log (from before they had an account): per species
// count, best weight and trophies. Kept as-is, never counted in dam stats.
export function cleanCatchLog(log) {
  const out = {};
  if (!log || typeof log !== 'object') return out;
  for (const [id, e] of Object.entries(log)) {
    const sp = SPECIES.get(id);
    if (!sp || !e) continue;
    const count = Math.max(0, Math.floor(Number(e.count) || 0));
    if (!count) continue;
    out[id] = {
      count,
      bestWeightKg: Math.min(sp.maxWeightKg * TROPHY_FACTOR, Math.max(0, Number(e.bestWeightKg) || 0)),
      ...(e.trophies ? { trophies: Math.min(count, Math.max(0, Math.floor(Number(e.trophies)))) } : {}),
    };
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanCatch(c) {
  if (!c || typeof c !== 'object') throw bad('No catch was sent.');
  if (!UUID.test(String(c.id ?? ''))) throw bad('A catch needs an id.');
  const sp = SPECIES.get(c.speciesId);
  if (!sp) throw bad('Unknown fish.');
  if (!isKnownLocation(c.locationId)) throw bad('Unknown fishing spot.');
  const weightKg = Number(c.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > sp.maxWeightKg * TROPHY_FACTOR + 0.01) {
    throw bad(`That weight isn't possible for a ${sp.name}.`);
  }
  const lengthCm = Number.isFinite(Number(c.lengthCm)) ? Math.max(0, Math.min(500, Math.round(Number(c.lengthCm)))) : null;
  const payout = Math.max(0, Math.min(1_000_000, Math.floor(Number(c.payout) || 0)));
  let caughtAt = new Date(c.caughtAt ?? Date.now());
  if (Number.isNaN(caughtAt.getTime()) || caughtAt.getTime() > Date.now() + 86_400_000) caughtAt = new Date();
  return {
    id: c.id.toLowerCase(), speciesId: sp.id, locationId: c.locationId,
    weightKg: Math.round(weightKg * 100) / 100, lengthCm, trophy: !!c.trophy, payout,
    timeOfDay: TIMES.has(c.timeOfDay) ? c.timeOfDay : null, caughtAt: caughtAt.toISOString(),
  };
}
