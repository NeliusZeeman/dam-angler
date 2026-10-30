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
import { GEAR, GEAR_FIELDS, STARTER, STARTER_ITEMS, HttpError, cleanSave, cleanCatch, cleanCatchLog, isKnownGear, speciesById } from './validate.js';
import { catchPayout } from '../src/economy.js';
import { ENGINE } from '../src/tuning/engine.js';
import { COMBOS } from '../src/gear.js';
import { pointsFromLog, levelFor, gearLevel, boatPoints } from '../src/levels.js';
import { boatRodAt, boatBonus } from '../src/boatRods.js';

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));
const gearItem = (kind, id) => GEAR[kind]?.find((i) => i.id === id);

// A guest who signs up brings their progress along, but it was earned where
// the server couldn't see it -- so at most this much (credits plus the price
// of the gear bought) comes across.
// The built-in limit (live value: ENGINE.money.guestImportLimit).
export const GUEST_IMPORT_LIMIT = 10_000;

// A brand-new player: starter gear, no credits.
export async function createPlayer(db, userId) {
  await db.query('INSERT INTO player_state (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  for (const [kind, ids] of Object.entries(STARTER_ITEMS)) {
    for (const id of ids) {
      await db.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, kind, id]);
    }
  }
}

// The catch log (count, best weight, trophies per species) from the catches
// themselves, plus any log carried over from guest play.
async function catchLogFor(db, userId, imported = {}) {
  const { rows } = await db.query(
    `SELECT species_id, count(*)::int AS count, max(weight_kg)::float AS best,
            count(*) FILTER (WHERE trophy)::int AS trophies,
            count(*) FILTER (WHERE NOT kept)::int AS released,
            count(*) FILTER (WHERE boss)::int AS bosses,
            sum(weight_kg)::float AS total_kg,
            sum(boat_pts)::int AS boat_pts,
            count(*) FILTER (WHERE prev_best IS NOT NULL AND weight_kg > prev_best)::int AS pbs
       FROM (SELECT species_id, weight_kg, trophy, kept, boss, boat_pts,
                    max(weight_kg) OVER (PARTITION BY species_id ORDER BY caught_at, id
                                         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
               FROM catches WHERE user_id = $1) c
      GROUP BY species_id`,
    [userId],
  );
  const log = {};
  for (const [id, e] of Object.entries(imported || {})) log[id] = { ...e };
  // Personal bests at each dam.
  const byDam = (await db.query(
    'SELECT species_id, location_id, max(weight_kg)::float AS best FROM catches WHERE user_id = $1 GROUP BY species_id, location_id',
    [userId],
  )).rows;
  for (const r of rows) {
    const e = log[r.species_id] || { count: 0, bestWeightKg: 0 };
    // Weight carried over from guest play (an old log without a total is
    // estimated), before this player's own catches are added in.
    const carriedKg = e.count > 0 ? (Number.isFinite(e.totalKg) ? e.totalKg : e.count * (e.bestWeightKg || 0) * 0.5) : 0;
    e.count += r.count;
    e.bestWeightKg = Math.max(e.bestWeightKg || 0, Number(r.best));
    const trophies = (e.trophies || 0) + r.trophies;
    if (trophies) e.trophies = trophies;
    const released = (e.released || 0) + r.released;
    if (released) e.released = released;
    // Level points: weight landed, personal bests, bosses.
    e.totalKg = Math.round((carriedKg + Number(r.total_kg || 0)) * 100) / 100;
    const pbs = (e.pbs || 0) + r.pbs;
    if (pbs) e.pbs = pbs;
    const bosses = (e.bosses || 0) + r.bosses;
    if (bosses) e.bosses = bosses;
    const boatPts = (e.boatPts || 0) + (r.boat_pts || 0);
    if (boatPts) e.boatPts = boatPts;
    log[r.species_id] = e;
  }
  for (const r of byDam) {
    if (!log[r.species_id]) continue;
    log[r.species_id].bestByDam = { ...(log[r.species_id].bestByDam || {}), [r.location_id]: Number(r.best) };
  }
  return log;
}

async function ownedGear(db, userId) {
  const rows = (await db.query('SELECT kind, item_id FROM player_gear WHERE user_id = $1 ORDER BY acquired_at, item_id', [userId])).rows;
  const owned = {};
  for (const kind of Object.keys(GEAR_FIELDS)) {
    // The starter kits are free: owned even by players from before them.
    const bought = rows.filter((g) => g.kind === kind && !STARTER_ITEMS[kind].includes(g.item_id)).map((g) => g.item_id);
    owned[kind] = [...STARTER_ITEMS[kind], ...bought];
  }
  owned.gadget = rows.filter((g) => g.kind === 'gadget').map((g) => g.item_id);
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
    compPlaces: await compPlacesOf(db, userId),
  };
  for (const [kind, [ownedField, equippedField]] of Object.entries(GEAR_FIELDS)) {
    save[ownedField] = owned[kind];
    const eq = state[`equipped_${kind}`];
    save[equippedField] = eq && owned[kind].includes(eq) ? eq : STARTER[kind];
  }
  save.ownedGadgetIds = owned.gadget;
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
export async function changeCredits(tx, userId, amount, reason, ref) {
  const { rows } = await tx.query(
    'UPDATE player_state SET credits = credits + $2 WHERE user_id = $1 AND credits + $2 >= 0 RETURNING credits',
    [userId, amount],
  );
  if (!rows.length) return null;
  await tx.query('INSERT INTO credit_log (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)', [userId, amount, reason, ref]);
  return rows[0].credits;
}

export const creditsOf = async (db, userId) => (await db.query('SELECT credits FROM player_state WHERE user_id = $1', [userId])).rows[0]?.credits ?? 0;

// Stores a catch once and pays for it (sending the same id again changes
// nothing). The server works out the payout from the fish and the gear it
// was caught on -- gear the player really owns.
// Places won in monthly competitions (1st, 2nd, 3rd) -- level points.
async function compPlacesOf(db, userId) {
  return (await db.query('SELECT rank FROM comp_awards WHERE user_id = $1', [userId])).rows.map((r) => r.rank);
}

// The angler's level, worked out from their catches -- the same sum the game
// does, so gear can't be bought before its level.
export async function levelOf(db, userId) {
  const state = (await db.query('SELECT imported_log FROM player_state WHERE user_id = $1', [userId])).rows[0];
  const log = await catchLogFor(db, userId, state?.imported_log);
  return levelFor(pointsFromLog(log, await compPlacesOf(db, userId)));
}

export async function recordCatch(db, userId, raw, { pay = true } = {}) {
  const c = cleanCatch(raw);
  const sp = speciesById(c.speciesId);
  const owned = await ownedGear(db, userId);
  const state = (await db.query('SELECT equipped_rod, equipped_line, equipped_hook FROM player_state WHERE user_id = $1', [userId])).rows[0] || {};
  const pick = (kind, sent) => [sent, state[`equipped_${kind}`], STARTER[kind]].find((id) => id && owned[kind].includes(id));
  const gear = raw?.gear && typeof raw.gear === 'object' ? raw.gear : {};
  // One of the boat's own rods (only on water where you'd have that boat):
  // its rod, line and hook, and the bonus on the fish it's rigged for.
  const boatRod = boatRodAt(gear.boatRodId, c.locationId);
  const bonus = boatBonus(boatRod, sp.id);
  const payout = catchPayout({
    species: sp, weightKg: c.weightKg, trophy: c.trophy, catchId: c.id, kept: c.kept, bonus,
    rod: boatRod ? boatRod.rod : gearItem('rod', pick('rod', gear.rodId)),
    line: boatRod ? boatRod.line : gearItem('line', pick('line', gear.lineId)),
    hook: boatRod ? boatRod.hook : gearItem('hook', pick('hook', gear.hookId)),
  });
  const boatPts = boatPoints({ weightKg: c.weightKg, trophy: c.trophy, boss: c.boss }, bonus);
  return inTx(db, async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO catches (id, user_id, species_id, location_id, weight_kg, length_cm, trophy, payout, time_of_day, caught_at, kept, boss, boat_pts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [c.id, userId, c.speciesId, c.locationId, c.weightKg, c.lengthCm, c.trophy, pay ? payout : 0, c.timeOfDay, c.caughtAt, c.kept, c.boss, boatPts],
    );
    const stored = rows.length > 0;
    const credits = stored && pay ? await changeCredits(tx, userId, payout, 'catch', c.id) : await creditsOf(tx, userId);
    return { stored, payout: stored && pay ? payout : 0, credits, catch: c };
  });
}

// Buys an item at its real price. Owning it already costs nothing.
export async function buyItem(db, userId, kind, itemId) {
  if (kind === 'combo') return buyCombo(db, userId, itemId);
  if (!isKnownGear(kind, itemId)) throw new HttpError(400, 'That item isn\'t in the tackle box.');
  const item = gearItem(kind, itemId);
  return inTx(db, async (tx) => {
    const have = (await tx.query('SELECT 1 FROM player_gear WHERE user_id = $1 AND kind = $2 AND item_id = $3', [userId, kind, itemId])).rows.length;
    // Taken out of the shop (admin tuning): nobody new can buy it.
    if (!have && item.inShop === false) throw new HttpError(400, `The ${item.name} isn't in the shop any more.`);
    // A combo's own rod or reel only comes with the combo.
    if (!have && item.comboOnly) throw new HttpError(400, `The ${item.name} only comes as part of its combo.`);
    if (!have && gearLevel(item) > await levelOf(tx, userId)) throw new HttpError(400, `The ${item.name} needs level ${gearLevel(item)}.`);
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

// A rod-and-reel combo: one price, both items. Owning both already costs
// nothing; owning only one still pays the combo price, as in the shop.
export async function buyCombo(db, userId, comboId) {
  const combo = COMBOS.find((c) => c.id === comboId);
  if (!combo) throw new HttpError(400, 'That combo isn\'t in the tackle box.');
  const parts = [['rod', combo.rodId], ['reel', combo.reelId]];
  return inTx(db, async (tx) => {
    let owned = 0;
    for (const [kind, id] of parts) {
      owned += (await tx.query('SELECT 1 FROM player_gear WHERE user_id = $1 AND kind = $2 AND item_id = $3', [userId, kind, id])).rows.length;
    }
    if (owned === parts.length) return { credits: await creditsOf(tx, userId), bought: false };
    if (combo.inShop === false) throw new HttpError(400, `The ${combo.name} isn't in the shop any more.`);
    if (gearLevel(combo) > await levelOf(tx, userId)) throw new HttpError(400, `The ${combo.name} needs level ${gearLevel(combo)}.`);
    const credits = await changeCredits(tx, userId, -combo.cost, 'buy', `combo:${comboId}`);
    if (credits === null) throw new HttpError(400, `Not enough credits for the ${combo.name} (${combo.cost}).`);
    for (const [kind, id] of parts) {
      await tx.query('INSERT INTO player_gear (user_id, kind, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, kind, id]);
    }
    return { credits, bought: true };
  });
}

// Spends credits on something used up in the game (breadcrumbs).
const SPEND = { chum: () => ENGINE.money.chumCost };
export async function spendCredits(db, userId, what) {
  const cost = SPEND[what]?.();
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
      let budget = ENGINE.money.guestImportLimit;
      const wanted = [];
      for (const [kind, ids] of Object.entries(s.gear)) for (const id of ids) if (!STARTER_ITEMS[kind]?.includes(id)) wanted.push({ kind, id, cost: gearItem(kind, id).cost });
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
