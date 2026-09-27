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
const LOCATION_SPECIES = new Map(LOCATIONS.map((l) => [l.id, new Set(l.speciesIds)]));
const TIMES = new Set(['morning', 'midMorning', 'midday', 'afternoon', 'sunset', 'lateTwilight', 'night']);
// A trophy can be up to 2.1x the species' usual maximum (see fish.js).
const TROPHY_FACTOR = 2.1;

export const isKnownLocation = (id) => LOCATION_IDS.has(id);
export const isKnownGear = (kind, id) => GEAR_IDS[kind]?.has(id) ?? false;

// Only plain characters get into the database: an email is letters,
// numbers and . _ % + - before the @, a normal domain after it -- no
// quotes, angle brackets, spaces or anything else that could be turned into
// code when shown somewhere.
const EMAIL = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/;
export function checkEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (e.length > 254 || !EMAIL.test(e) || e.includes('..')) throw bad('Please enter a valid email address.');
  return e;
}

// Usernames are public (dam records), so only letters, numbers and _ --
// nothing that can be read as HTML or script -- and no official-sounding
// names someone could use to pretend to be the game.
const RESERVED = /^(admin|administrator|root|system|support|moderator|mod|staff|owner|dam_?angler|null|undefined|anonymous|guest)$/i;
export function checkUsername(username) {
  const u = String(username ?? '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) throw bad('Usernames are 3 to 20 letters, numbers or underscores.');
  if (RESERVED.test(u)) throw bad('That username is reserved — try another.');
  return u;
}

// Passwords are never shown or stored, only hashed -- but bcrypt only uses
// the first 72 bytes, so longer ones are refused rather than silently cut.
export function checkPassword(password) {
  if (typeof password !== 'string') throw bad('Passwords need at least 8 characters.');
  if (password.length < 8) throw bad('Passwords need at least 8 characters.');
  if (Buffer.byteLength(password, 'utf8') > 72) throw bad('That password is too long (72 characters at most).');
  if (/[\u0000-\u001f\u007f]/.test(password)) throw bad('Passwords can\'t contain control characters.');
  return password;
}

// The login box: an email or a username, nothing else.
export function checkLoginName(login) {
  const l = String(login ?? '').trim().toLowerCase();
  if (!l || l.length > 254 || !/^[a-z0-9._%+@-]+$/.test(l)) throw new HttpError(401, 'Wrong email/username or password.');
  return l;
}

// Only the settings the game has, with sane values.
const SETTING_RULES = {
  quality: (v) => (['auto', 'high', 'low'].includes(v) ? v : undefined),
  showHints: (v) => (typeof v === 'boolean' ? v : undefined),
  turnSpeed: (v) => (Number.isFinite(v) ? Math.min(3, Math.max(0.2, v)) : undefined),
  volume: (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined),
  lastVolume: (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined),
};
export function cleanSettings(settings) {
  const out = {};
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return out;
  for (const [key, rule] of Object.entries(SETTING_RULES)) {
    const v = rule(settings[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const MAX_CREDITS = 100_000_000;

// Cleans a save from the game. Unknown gear is dropped, the free starter
// items are always owned, and anything equipped must be owned.
export function cleanSave(save) {
  if (!save || typeof save !== 'object') throw bad('No save was sent.');
  const credits = Number(save.credits ?? 0);
  if (!Number.isFinite(credits) || credits < 0) throw bad('Credits can\'t be negative.');
  if (credits > MAX_CREDITS) throw bad('That many credits isn\'t possible.');
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
  out.settings = cleanSettings(save.settings);
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
  // Only fish that really live there -- no tigerfish records at Harties.
  if (!LOCATION_SPECIES.get(c.locationId).has(sp.id)) throw bad(`${sp.name} isn't found at that spot.`);
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
