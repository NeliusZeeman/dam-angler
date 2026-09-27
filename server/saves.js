// A player's save, split over player_state, player_gear and catches, and put
// back together into the same save object the game keeps in the browser.
import { GEAR_FIELDS, STARTER, cleanSave, cleanCatch, cleanCatchLog } from './validate.js';

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));

// A brand-new player: starter gear, no credits.
export async function createPlayer(db, userId) {
  await db.query('INSERT INTO player_state (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  for (const [kind, id] of Object.entries(STARTER)) {
    await db.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, kind, id]);
  }
}

// The catch log (count, best weight, trophies per species) from the catches
// themselves, plus any log carried over from guest play.
async function catchLogFor(db, userId, imported = {}) {
  const { rows } = await db.query(
    `SELECT species_id, count(*)::int AS count, max(weight_kg)::float AS best,
            count(*) FILTER (WHERE trophy)::int AS trophies
       FROM catches WHERE user_id = $1 GROUP BY species_id`,
    [userId],
  );
  const log = {};
  for (const [id, e] of Object.entries(imported || {})) log[id] = { ...e };
  for (const r of rows) {
    const e = log[r.species_id] || { count: 0, bestWeightKg: 0 };
    e.count += r.count;
    e.bestWeightKg = Math.max(e.bestWeightKg || 0, Number(r.best));
    const trophies = (e.trophies || 0) + r.trophies;
    if (trophies) e.trophies = trophies;
    log[r.species_id] = e;
  }
  return log;
}

export async function loadSave(db, userId) {
  const state = (await db.query('SELECT * FROM player_state WHERE user_id = $1', [userId])).rows[0];
  if (!state) return { save: null, version: 0 };
  const gearRows = (await db.query('SELECT kind, item_id FROM player_gear WHERE user_id = $1 ORDER BY acquired_at, item_id', [userId])).rows;
  const save = {
    locationId: state.location_id,
    startTimeOfDay: state.start_time,
    credits: state.credits,
    drag: state.drag ?? 0.33,
    settings: state.settings || {},
    catchLog: await catchLogFor(db, userId, state.imported_log),
  };
  for (const [kind, [ownedField, equippedField]] of Object.entries(GEAR_FIELDS)) {
    save[ownedField] = gearRows.filter((g) => g.kind === kind).map((g) => g.item_id);
    if (!save[ownedField].includes(STARTER[kind])) save[ownedField].unshift(STARTER[kind]);
    save[equippedField] = state[`equipped_${kind}`] || STARTER[kind];
  }
  return { save, version: state.version };
}

// Writes the save if nobody else has since `baseVersion`. Gear is only ever
// added, so a purchase on one device can't be undone by another.
export async function writeSave(db, userId, rawSave, baseVersion) {
  const s = cleanSave(rawSave);
  const result = await inTx(db, async (tx) => {
    const { rows } = await tx.query(
      `UPDATE player_state SET credits = $3, equipped_rod = $4, equipped_line = $5, equipped_reel = $6,
              equipped_hook = $7, equipped_lure = $8, drag = $9, location_id = $10, start_time = $11,
              settings = $12, version = version + 1, updated_at = now()
        WHERE user_id = $1 AND version = $2 RETURNING version`,
      [userId, Number(baseVersion) || 0, s.credits, s.equipped.rod, s.equipped.line, s.equipped.reel,
        s.equipped.hook, s.equipped.lure, s.drag, s.locationId, s.startTime, JSON.stringify(s.settings)],
    );
    if (!rows.length) return null;
    for (const [kind, ids] of Object.entries(s.gear)) {
      for (const id of ids) {
        await tx.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, kind, id]);
      }
    }
    return rows[0].version;
  });
  if (result === null) {
    const current = await loadSave(db, userId);
    return { ok: false, ...current };
  }
  return { ok: true, version: result };
}

// Stores a catch once; sending the same id again changes nothing.
export async function recordCatch(db, userId, raw) {
  const c = cleanCatch(raw);
  const { rows } = await db.query(
    `INSERT INTO catches (id, user_id, species_id, location_id, weight_kg, length_cm, trophy, payout, time_of_day, caught_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [c.id, userId, c.speciesId, c.locationId, c.weightKg, c.lengthCm, c.trophy, c.payout, c.timeOfDay, c.caughtAt],
  );
  return { stored: rows.length > 0, catch: c };
}

// A guest signing up: their save and catches become the new account's.
export async function importGuest(db, userId, { guestSave, guestCatches } = {}) {
  if (guestSave) {
    // A broken guest save shouldn't stop the account being made.
    try { await writeSave(db, userId, guestSave, 0); } catch { /* keep the fresh starter save */ }
    const log = cleanCatchLog(guestSave.catchLog);
    // Catches sent separately are counted from the catches table; only the
    // part of the old log they don't cover is kept as imported history.
    const sent = new Map();
    for (const c of Array.isArray(guestCatches) ? guestCatches : []) sent.set(c?.speciesId, (sent.get(c?.speciesId) || 0) + 1);
    for (const [id, e] of Object.entries(log)) {
      e.count -= Math.min(e.count, sent.get(id) || 0);
      if (!e.count) delete log[id];
    }
    await db.query('UPDATE player_state SET imported_log = $2 WHERE user_id = $1', [userId, JSON.stringify(log)]);
  }
  for (const c of (Array.isArray(guestCatches) ? guestCatches : []).slice(0, 500)) {
    try { await recordCatch(db, userId, c); } catch { /* skip anything invalid */ }
  }
}
