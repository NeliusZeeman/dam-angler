// A player's save, split over player_state, player_gear and catches, and put
// back together into the same save object the game keeps in the browser.
//
// The server keeps the books: credits only change through
//   a catch    (+ the payout the server works out itself),
//   a purchase (- the item's real price, only with enough credits),
//   breadcrumbs (- their price),
// each written to credit_log. Whatever credits or gear a save claims are
// ignored -- a save only carries what's rigged, the drag, the spot and the
// settings.
import { GEAR, GEAR_FIELDS, STARTER, HttpError, cleanSave, cleanCatch, cleanCatchLog, isKnownGear, speciesById } from './validate.js';
import { catchPayout, CHUM_COST } from '../src/economy.js';

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));
const gearItem = (kind, id) => GEAR[kind]?.find((i) => i.id === id);

// A guest who signs up brings their progress along, but it was earned where
// the server couldn't see it -- so at most this much (credits plus the price
// of the gear bought) comes across.
export const GUEST_IMPORT_LIMIT = 10_000;

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

async function ownedGear(db, userId) {
  const rows = (await db.query('SELECT kind, item_id FROM player_gear WHERE user_id = $1 ORDER BY acquired_at, item_id', [userId])).rows;
  const owned = {};
  for (const kind of Object.keys(GEAR_FIELDS)) {
    owned[kind] = rows.filter((g) => g.kind === kind).map((g) => g.item_id);
    if (!owned[kind].includes(STARTER[kind])) owned[kind].unshift(STARTER[kind]);
  }
  return owned;
}

export async function loadSave(db, userId) {
  const state = (await db.query('SELECT * FROM player_state WHERE user_id = $1', [userId])).rows[0];
  if (!state) return { save: null, version: 0 };
  const owned = await ownedGear(db, userId);
  const save = {
    locationId: state.location_id,
    startTimeOfDay: state.start_time,
    credits: state.credits,
    drag: state.drag ?? 0.33,
    settings: state.settings || {},
    catchLog: await catchLogFor(db, userId, state.imported_log),
  };
  for (const [kind, [ownedField, equippedField]] of Object.entries(GEAR_FIELDS)) {
    save[ownedField] = owned[kind];
    const eq = state[`equipped_${kind}`];
    save[equippedField] = eq && owned[kind].includes(eq) ? eq : STARTER[kind];
  }
  return { save, version: state.version };
}

// Writes what's rigged, the drag, the spot and the settings -- if nobody else
// has saved since `baseVersion`. Anything equipped must really be owned.
export async function writeSave(db, userId, rawSave, baseVersion) {
  const s = cleanSave(rawSave);
  const owned = await ownedGear(db, userId);
  const equipped = {};
  for (const kind of Object.keys(GEAR_FIELDS)) equipped[kind] = owned[kind].includes(s.equipped[kind]) ? s.equipped[kind] : STARTER[kind];
  const { rows } = await db.query(
    `UPDATE player_state SET equipped_rod = $3, equipped_line = $4, equipped_reel = $5,
            equipped_hook = $6, equipped_lure = $7, drag = $8, location_id = $9, start_time = $10,
            settings = $11, version = version + 1, updated_at = now()
      WHERE user_id = $1 AND version = $2 RETURNING version`,
    [userId, Number(baseVersion) || 0, equipped.rod, equipped.line, equipped.reel,
      equipped.hook, equipped.lure, s.drag, s.locationId, s.startTime, JSON.stringify(s.settings)],
  );
  if (!rows.length) return { ok: false, ...(await loadSave(db, userId)) };
  return { ok: true, version: rows[0].version };
}

// Adds (or takes) credits, never below zero. Returns the new balance, or
// null if there weren't enough.
async function changeCredits(tx, userId, amount, reason, ref) {
  const { rows } = await tx.query(
    'UPDATE player_state SET credits = credits + $2 WHERE user_id = $1 AND credits + $2 >= 0 RETURNING credits',
    [userId, amount],
  );
  if (!rows.length) return null;
  await tx.query('INSERT INTO credit_log (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)', [userId, amount, reason, ref]);
  return rows[0].credits;
}

const creditsOf = async (db, userId) => (await db.query('SELECT credits FROM player_state WHERE user_id = $1', [userId])).rows[0]?.credits ?? 0;

// Stores a catch once and pays for it (sending the same id again changes
// nothing). The server works out the payout from the fish and the gear it
// was caught on -- gear the player really owns.
export async function recordCatch(db, userId, raw, { pay = true } = {}) {
  const c = cleanCatch(raw);
  const sp = speciesById(c.speciesId);
  const owned = await ownedGear(db, userId);
  const state = (await db.query('SELECT equipped_rod, equipped_line, equipped_hook FROM player_state WHERE user_id = $1', [userId])).rows[0] || {};
  const pick = (kind, sent) => [sent, state[`equipped_${kind}`], STARTER[kind]].find((id) => id && owned[kind].includes(id));
  const gear = raw?.gear && typeof raw.gear === 'object' ? raw.gear : {};
  const payout = catchPayout({
    species: sp, weightKg: c.weightKg, trophy: c.trophy, catchId: c.id,
    rod: gearItem('rod', pick('rod', gear.rodId)), line: gearItem('line', pick('line', gear.lineId)),
    hook: gearItem('hook', pick('hook', gear.hookId)),
  });
  return inTx(db, async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO catches (id, user_id, species_id, location_id, weight_kg, length_cm, trophy, payout, time_of_day, caught_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [c.id, userId, c.speciesId, c.locationId, c.weightKg, c.lengthCm, c.trophy, pay ? payout : 0, c.timeOfDay, c.caughtAt],
    );
    const stored = rows.length > 0;
    const credits = stored && pay ? await changeCredits(tx, userId, payout, 'catch', c.id) : await creditsOf(tx, userId);
    return { stored, payout: stored && pay ? payout : 0, credits, catch: c };
  });
}

// Buys an item at its real price. Owning it already costs nothing.
export async function buyItem(db, userId, kind, itemId) {
  if (!isKnownGear(kind, itemId)) throw new HttpError(400, 'That item isn\'t in the tackle box.');
  const item = gearItem(kind, itemId);
  return inTx(db, async (tx) => {
    const have = (await tx.query('SELECT 1 FROM player_gear WHERE user_id = $1 AND kind = $2 AND item_id = $3', [userId, kind, itemId])).rows.length;
    if (have || item.cost === 0) {
      if (!have) await tx.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, kind, itemId]);
      return { credits: await creditsOf(tx, userId), bought: false };
    }
    const credits = await changeCredits(tx, userId, -item.cost, 'buy', `${kind}:${itemId}`);
    if (credits === null) throw new HttpError(400, `Not enough credits for the ${item.name} (${item.cost}).`);
    await tx.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3)', [userId, kind, itemId]);
    return { credits, bought: true };
  });
}

// Spends credits on something used up in the game (breadcrumbs).
const SPEND = { chum: CHUM_COST };
export async function spendCredits(db, userId, what) {
  const cost = SPEND[what];
  if (!cost) throw new HttpError(400, 'Nothing to buy by that name.');
  return inTx(db, async (tx) => {
    const credits = await changeCredits(tx, userId, -cost, what, null);
    if (credits === null) throw new HttpError(400, `Not enough credits (${cost}).`);
    return { credits };
  });
}

// A guest signing up: their gear, credits and catches come along -- up to
// GUEST_IMPORT_LIMIT in total value, cheapest gear first.
export async function importGuest(db, userId, { guestSave, guestCatches } = {}) {
  const catches = (Array.isArray(guestCatches) ? guestCatches : []).slice(0, 500);
  if (guestSave && typeof guestSave === 'object') {
    let s = null;
    try { s = cleanSave(guestSave); } catch { /* a broken guest save: keep the fresh starter one */ }
    if (s) {
      let budget = GUEST_IMPORT_LIMIT;
      const wanted = [];
      for (const [kind, ids] of Object.entries(s.gear)) for (const id of ids) if (id !== STARTER[kind]) wanted.push({ kind, id, cost: gearItem(kind, id).cost });
      wanted.sort((a, b) => a.cost - b.cost);
      await inTx(db, async (tx) => {
        for (const g of wanted) {
          if (g.cost > budget) continue;
          budget -= g.cost;
          await tx.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, g.kind, g.id]);
        }
        const credits = Math.min(s.credits, budget);
        if (credits > 0) await changeCredits(tx, userId, credits, 'guest-import', null);
      });
      try { await writeSave(db, userId, guestSave, 0); } catch { /* keep the starter rig */ }
    }
    const log = cleanCatchLog(guestSave.catchLog);
    // Catches sent separately are counted from the catches table; only the
    // part of the old log they don't cover is kept as imported history.
    const sent = new Map();
    for (const c of catches) sent.set(c?.speciesId, (sent.get(c?.speciesId) || 0) + 1);
    for (const [id, e] of Object.entries(log)) {
      e.count -= Math.min(e.count, sent.get(id) || 0);
      if (!e.count) delete log[id];
    }
    await db.query('UPDATE player_state SET imported_log = $2 WHERE user_id = $1', [userId, JSON.stringify(log)]);
  }
  // Guest catches are already paid for in the guest's credits.
  for (const c of catches) {
    try { await recordCatch(db, userId, c, { pay: false }); } catch { /* skip anything invalid */ }
  }
}
