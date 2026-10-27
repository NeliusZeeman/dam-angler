// Things to chase: daily and weekly challenges, and the monthly online
// competitions. Shared by the game and the server -- the server checks the
// same rules against the catches it has recorded before it pays anything.
//
// A catch here is { speciesId, weightKg, kept, locationId, timeOfDay, trophy, caughtAt }.

import { ENGINE } from './tuning/engine.js';
import { FISH_SPECIES } from './fish.js';
import { LOCATIONS } from './locations.js';

// ── Time: days and weeks run on South African time (UTC+2, no DST) ──
const SA_OFFSET_MS = 2 * 3600 * 1000;
const saDate = (ms) => new Date(ms + SA_OFFSET_MS);
const pad = (n) => String(n).padStart(2, '0');
export function dayKey(ms = Date.now()) {
  const d = saDate(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// The Monday that starts this week.
export function weekKey(ms = Date.now()) {
  const d = saDate(ms);
  const back = (d.getUTCDay() + 6) % 7;
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back) - SA_OFFSET_MS);
}
export function monthKey(ms = Date.now()) {
  const d = saDate(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
// [start, end) in real time (ms) for a day / week / month key.
export function periodOf(kind, key) {
  const [y, m, d] = key.split('-').map(Number);
  if (kind === 'month') return [Date.UTC(y, m - 1, 1) - SA_OFFSET_MS, Date.UTC(y, m, 1) - SA_OFFSET_MS];
  const start = Date.UTC(y, m - 1, d) - SA_OFFSET_MS;
  return [start, start + (kind === 'week' ? 7 : 1) * 86_400_000];
}
export function previousMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

// A small repeatable random series from a text seed (same for everyone).
function seeded(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let s = h || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
const pick = (list, r) => list[Math.floor(r() * list.length)];

const SPECIES = new Map(FISH_SPECIES.map((s) => [s.id, s]));
const TIME_NAMES = { morning: 'in the morning', midMorning: 'mid-morning', midday: 'at midday', afternoon: 'in the afternoon', sunset: 'at sunset', lateTwilight: 'at dusk', night: 'at night' };
// Fish most players meet: challenges stick to these.
const COMMON = ['mozambique-tilapia', 'common-carp', 'largemouth-bass', 'catfish', 'smallmouth-yellowfish', 'bluegill'];
const ROUND = (kg) => Math.max(0.5, Math.round(kg * 2) / 2);
const plural = (n, name) => (n === 1 ? `a ${name}` : `${n} ${name}`);
const shortName = (id) => SPECIES.get(id).name.toLowerCase().replace(/^mozambique tilapia.*/, 'kurper');

// A challenge: { id, kind, text, need, reward, match }. `match` picks the
// catches that count: species, minKg, released, locationId, timeOfDay,
// trophy; `distinct` counts different species instead of fish.
function makeChallenge(r, kind, i) {
  const big = kind === 'weekly';
  const scale = big ? 3 : 1;
  const sp = pick(COMMON, r);
  const s = SPECIES.get(sp);
  const where = LOCATIONS.filter((l) => l.speciesIds.includes(sp));
  const type = pick(big ? ['count', 'release', 'distinct', 'trophyish', 'anyCount'] : ['count', 'release', 'time', 'bigAt', 'anyAt', 'distinct'], r);
  const reward = (base) => Math.round(base * (big ? ENGINE.goals.weeklyReward : ENGINE.goals.dailyReward));
  switch (type) {
    case 'count': {
      const n = (2 + Math.floor(r() * 3)) * scale;
      return { text: `Catch ${plural(n, shortName(sp))}`, need: n, match: { species: sp }, reward: reward(1) };
    }
    case 'release': {
      const kg = ROUND(s.maxWeightKg * (0.2 + r() * 0.15));
      const n = (1 + Math.floor(r() * 2)) * scale;
      return { text: `Release ${plural(n, shortName(sp))} over ${kg} kg`, need: n, match: { species: sp, minKg: kg, released: true }, reward: reward(1.3) };
    }
    case 'time': {
      const t = pick(Object.keys(TIME_NAMES), r);
      const n = 1 + Math.floor(r() * 2);
      return { text: `Land ${n === 1 ? 'a fish' : `${n} fish`} ${TIME_NAMES[t]}`, need: n, match: { timeOfDay: t }, reward: reward(1) };
    }
    case 'bigAt': {
      const loc = pick(where.length ? where : LOCATIONS, r);
      const kg = ROUND(s.maxWeightKg * (0.25 + r() * 0.15));
      return { text: `Catch a ${shortName(sp)} over ${kg} kg at ${loc.name}`, need: 1, match: { species: sp, minKg: kg, locationId: loc.id }, reward: reward(1.5) };
    }
    case 'anyAt': {
      const loc = pick(LOCATIONS, r);
      const n = 3 + Math.floor(r() * 3);
      return { text: `Catch ${n} fish at ${loc.name}`, need: n, match: { locationId: loc.id }, reward: reward(1.2) };
    }
    case 'distinct': {
      const n = big ? 6 : 3;
      return { text: `Catch ${n} different species`, need: n, match: { distinct: true }, reward: reward(1.4) };
    }
    case 'trophyish': {
      const kg = ROUND(s.maxWeightKg * 0.6);
      return { text: `Land a ${shortName(sp)} over ${kg} kg`, need: 1, match: { species: sp, minKg: kg }, reward: reward(1.5) };
    }
    default: {
      const n = 15;
      return { text: `Catch ${n} fish`, need: n, match: {}, reward: reward(1) };
    }
  }
}

// Today's three challenges and this week's one -- the same for everyone.
export function challengesFor(ms = Date.now()) {
  const day = dayKey(ms), week = weekKey(ms);
  const rd = seeded(`day:${day}`), rw = seeded(`week:${week}`);
  const out = [];
  const seen = new Set();
  for (let i = 0; out.length < 3 && i < 20; i++) {
    const c = makeChallenge(rd, 'daily', i);
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    out.push({ id: `d:${day}:${out.length}`, kind: 'daily', period: day, ...c });
  }
  out.push({ id: `w:${week}:0`, kind: 'weekly', period: week, ...makeChallenge(rw, 'weekly', 0) });
  return out;
}

export function matches(m, c) {
  if (m.species && c.speciesId !== m.species) return false;
  if (m.minKg && !(c.weightKg > m.minKg)) return false;
  if (m.released && c.kept) return false;
  if (m.locationId && c.locationId !== m.locationId) return false;
  if (m.timeOfDay && c.timeOfDay !== m.timeOfDay) return false;
  if (m.trophy && !c.trophy) return false;
  return true;
}

// How far along a challenge is, from catches in its period.
export function progressOf(ch, catches) {
  const [start, end] = periodOf(ch.kind === 'weekly' ? 'week' : 'day', ch.period);
  const inPeriod = catches.filter((c) => { const t = new Date(c.caughtAt).getTime(); return t >= start && t < end && matches(ch.match, c); });
  const done = ch.match.distinct ? new Set(inPeriod.map((c) => c.speciesId)).size : inPeriod.length;
  return Math.min(ch.need, done);
}

// ── Monthly competitions: the heaviest fish of a kind, this month ──
const COMP_SPECIES = ['largemouth-bass', 'common-carp', 'catfish', 'smallmouth-yellowfish', 'mozambique-tilapia', 'tigerfish', 'rainbow-trout'];
export function competitionsFor(month) {
  const r = seeded(`month:${month}`);
  const a = pick(COMP_SPECIES, r);
  let b = pick(COMP_SPECIES, r);
  if (b === a) b = COMP_SPECIES[(COMP_SPECIES.indexOf(a) + 1) % COMP_SPECIES.length];
  const homes = LOCATIONS.filter((l) => l.speciesIds.includes(b));
  const loc = homes.length ? pick(homes, r) : null;
  return [
    { id: `c:${month}:a`, month, speciesId: a, locationId: null, title: `Heaviest ${SPECIES.get(a).name} this month` },
    { id: `c:${month}:b`, month, speciesId: b, locationId: loc?.id || null, title: `Heaviest ${SPECIES.get(b).name}${loc ? ` at ${loc.name}` : ''} this month` },
  ];
}
export const compPrizes = () => [ENGINE.goals.prize1, ENGINE.goals.prize2, ENGINE.goals.prize3];
