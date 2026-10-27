// Challenges and competitions on the server. Everything is worked out from
// the catches the server itself recorded, with the same rules the game
// shows (src/goals.js), so a reward or prize can't be claimed for fish
// nobody caught.
import { HttpError } from './validate.js';
import { changeCredits, creditsOf } from './saves.js';
import { challengesFor, progressOf, competitionsFor, compPrizes, monthKey, previousMonthKey, periodOf } from '../src/goals.js';

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));
const toCatch = (r) => ({
  speciesId: r.species_id, weightKg: Number(r.weight_kg), kept: !!r.kept, locationId: r.location_id,
  timeOfDay: r.time_of_day, trophy: !!r.trophy, caughtAt: new Date(r.caught_at).toISOString(),
});

// Today's and this week's challenges, with this player's progress.
export async function challengeState(db, userId, now = Date.now()) {
  const list = challengesFor(now);
  const from = Math.min(...list.map((c) => periodOf(c.kind === 'weekly' ? 'week' : 'day', c.period)[0]));
  const rows = (await db.query(
    'SELECT species_id, weight_kg, kept, location_id, time_of_day, trophy, caught_at FROM catches WHERE user_id = $1 AND caught_at >= $2',
    [userId, new Date(from).toISOString()],
  )).rows;
  const catches = rows.map(toCatch);
  const claimed = new Set((await db.query(
    'SELECT challenge_id FROM challenge_claims WHERE user_id = $1 AND challenge_id = ANY($2)', [userId, list.map((c) => c.id)],
  )).rows.map((r) => r.challenge_id));
  return list.map((c) => ({ ...c, progress: progressOf(c, catches), claimed: claimed.has(c.id) }));
}

// Pays a finished challenge, once.
export async function claimChallenge(db, userId, id, now = Date.now()) {
  const ch = (await challengeState(db, userId, now)).find((c) => c.id === String(id));
  if (!ch) throw new HttpError(400, 'That challenge has ended.');
  if (ch.claimed) return { credits: await creditsOf(db, userId), reward: 0 };
  if (ch.progress < ch.need) throw new HttpError(400, 'Not done yet.');
  return inTx(db, async (tx) => {
    const ins = await tx.query(
      'INSERT INTO challenge_claims (user_id, challenge_id, reward) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING challenge_id',
      [userId, ch.id, ch.reward],
    );
    if (!ins.rows.length) return { credits: await creditsOf(tx, userId), reward: 0 };
    const credits = await changeCredits(tx, userId, ch.reward, 'challenge', ch.id);
    return { credits, reward: ch.reward };
  });
}

// Everyone's best fish for a competition: one row per angler, heaviest
// first (the earlier catch wins a tie).
async function standings(db, comp) {
  const [start, end] = periodOf('month', comp.month);
  const rows = (await db.query(
    `SELECT DISTINCT ON (c.user_id) c.user_id, u.username, c.weight_kg, c.caught_at
       FROM catches c JOIN users u ON u.id = c.user_id
      WHERE c.species_id = $1 AND ($2::text IS NULL OR c.location_id = $2)
        AND c.caught_at >= $3 AND c.caught_at < $4
      ORDER BY c.user_id, c.weight_kg DESC, c.caught_at`,
    [comp.speciesId, comp.locationId, new Date(start).toISOString(), new Date(end).toISOString()],
  )).rows;
  return rows
    .map((r) => ({ userId: String(r.user_id), username: r.username, weightKg: Number(r.weight_kg), at: new Date(r.caught_at).getTime() }))
    .sort((a, b) => b.weightKg - a.weightKg || a.at - b.at);
}

// Pays out a finished month's competitions (once -- safe to call often).
export async function awardMonth(db, month) {
  const prizes = compPrizes();
  for (const comp of competitionsFor(month)) {
    const done = (await db.query('SELECT 1 FROM comp_awards WHERE comp_id = $1 LIMIT 1', [comp.id])).rows.length;
    if (done) continue;
    const top = (await standings(db, comp)).slice(0, 3);
    if (!top.length) continue;
    await inTx(db, async (tx) => {
      for (let i = 0; i < top.length; i++) {
        const w = top[i];
        const ins = await tx.query(
          `INSERT INTO comp_awards (comp_id, rank, user_id, username, weight_kg, reward)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING rank`,
          [comp.id, i + 1, w.userId, w.username, w.weightKg, prizes[i]],
        );
        if (ins.rows.length && prizes[i] > 0) await changeCredits(tx, w.userId, prizes[i], 'prize', comp.id);
      }
    });
  }
}

// This month's competitions (top 10 and your place) and last month's winners.
export async function competitionState(db, userId, now = Date.now()) {
  const month = monthKey(now);
  const last = previousMonthKey(month);
  await awardMonth(db, last);
  const wins = new Map((await db.query('SELECT user_id, count(*)::int AS n FROM comp_awards WHERE rank = 1 AND user_id IS NOT NULL GROUP BY user_id')).rows
    .map((r) => [String(r.user_id), r.n]));
  const current = [];
  for (const comp of competitionsFor(month)) {
    const all = await standings(db, comp);
    const row = (w, i) => ({ rank: i + 1, username: w.username, weightKg: w.weightKg, wins: wins.get(w.userId) || 0 });
    const mine = all.findIndex((w) => w.userId === String(userId));
    current.push({ ...comp, top: all.slice(0, 10).map(row), me: mine >= 0 ? row(all[mine], mine) : null, entrants: all.length });
  }
  const winners = [];
  for (const comp of competitionsFor(last)) {
    const rows = (await db.query('SELECT rank, username, weight_kg, reward FROM comp_awards WHERE comp_id = $1 ORDER BY rank', [comp.id])).rows;
    winners.push({ ...comp, winners: rows.map((r) => ({ rank: r.rank, username: r.username, weightKg: Number(r.weight_kg), reward: r.reward })) });
  }
  return { month, current, prizes: compPrizes(), last: winners };
}
