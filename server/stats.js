// Public dam stats: how many fish each spot has given up, and the biggest
// one with who caught it. Only usernames are ever shown -- never emails.
import { HttpError, isKnownLocation } from './validate.js';

const record = (r) => (r ? {
  speciesId: r.species_id, weightKg: Number(r.weight_kg), username: r.username, caughtAt: new Date(r.caught_at).toISOString(),
} : null);

// Biggest fish per dam (ties go to whoever caught it first).
const RECORDS_SQL = `
  SELECT DISTINCT ON (c.location_id) c.location_id, c.species_id, c.weight_kg, c.caught_at, u.username
    FROM catches c JOIN users u ON u.id = c.user_id
   WHERE ($1::text IS NULL OR c.location_id = $1)
   ORDER BY c.location_id, c.weight_kg DESC, c.caught_at ASC`;

export async function allDamStats(db) {
  const totals = (await db.query('SELECT location_id, count(*)::int AS total FROM catches GROUP BY location_id')).rows;
  const records = (await db.query(RECORDS_SQL, [null])).rows;
  const dams = {};
  for (const t of totals) dams[t.location_id] = { total: t.total, record: null };
  for (const r of records) dams[r.location_id].record = record(r);
  return { dams };
}

export async function damStats(db, locationId) {
  if (!isKnownLocation(locationId)) throw new HttpError(404, 'No such fishing spot.');
  const species = (await db.query(
    `SELECT species_id, count(*)::int AS count, max(weight_kg)::float AS best
       FROM catches WHERE location_id = $1 GROUP BY species_id ORDER BY count(*) DESC, species_id`,
    [locationId],
  )).rows;
  const top = (await db.query(RECORDS_SQL, [locationId])).rows[0];
  return {
    locationId,
    total: species.reduce((sum, s) => sum + s.count, 0),
    record: record(top),
    species: species.map((s) => ({ speciesId: s.species_id, count: s.count, bestKg: Number(s.best) })),
  };
}
