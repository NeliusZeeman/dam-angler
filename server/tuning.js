// Game tuning on the server: the admin's draft, published versions, roll
// back, export/import -- and the published values applied in this process,
// so payouts, prices and catch checks follow the tuning too.
import express from 'express';
import { HttpError } from './validate.js';
import { tunable, validateValue, crossCheck } from '../src/tuning/registry.js';
import { applyTuning } from '../src/tuning/apply.js';

const inTx = (db, fn) => (db.transaction ? db.transaction(fn) : fn(db));
const iso = (d) => (d ? new Date(d).toISOString() : null);
const MAX_VALUES = 5000;

// What players get right now, kept in memory (refreshed on every publish).
let live = null; // { version, values }

export async function loadPublished(db) {
  const row = (await db.query('SELECT id, values FROM tuning_versions ORDER BY id DESC LIMIT 1')).rows[0];
  return row ? { version: Number(row.id), values: row.values || {} } : { version: 0, values: {} };
}

// Loads the published tuning and applies it in this process.
export async function applyPublished(db) {
  live = await loadPublished(db);
  applyTuning(live.values);
  return live;
}

// Tests: forget what's cached between separate test databases.
export function forgetPublished() { live = null; }

export async function publishedForPlayers(db) {
  if (!live) await applyPublished(db);
  return live;
}

async function draftValues(db) {
  const rows = (await db.query('SELECT key, value FROM tuning_draft ORDER BY key')).rows;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function replaceDraft(tx, values, by) {
  await tx.query('DELETE FROM tuning_draft');
  for (const [key, value] of Object.entries(values)) {
    await tx.query('INSERT INTO tuning_draft (key, value, updated_by) VALUES ($1, $2, $3)', [key, JSON.stringify(value), by]);
  }
}

async function logAction(tx, admin, action, details) {
  await tx.query(
    'INSERT INTO admin_log (admin_id, admin_username, action, details) VALUES ($1, $2, $3, $4)',
    [admin.id, admin.username, action, JSON.stringify(details)],
  );
}

// Cleans a whole set of values: known keys with valid values are kept, the
// rest are reported.
function cleanSet(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new HttpError(400, 'That isn\'t a set of tuning values.');
  const entries = Object.entries(values);
  if (entries.length > MAX_VALUES) throw new HttpError(400, 'Too many values.');
  const clean = {};
  const skipped = [];
  for (const [key, value] of entries) {
    try {
      const v = validateValue(key, value);
      // Same as built-in? Then it isn't an override.
      if (JSON.stringify(v) !== JSON.stringify(tunable(key).defaultValue)) clean[key] = v;
    } catch (err) {
      skipped.push(err.message);
    }
  }
  return { clean, skipped };
}

export async function adminState(db) {
  const published = await loadPublished(db);
  const versions = (await db.query(
    `SELECT id, note, published_by, published_at, (SELECT count(*) FROM jsonb_object_keys(values))::int AS count
       FROM tuning_versions ORDER BY id DESC LIMIT 50`)).rows;
  return {
    draft: await draftValues(db),
    published: published.values,
    publishedVersion: published.version,
    versions: versions.map((v) => ({ id: String(v.id), note: v.note, by: v.published_by, at: iso(v.published_at), count: v.count })),
  };
}

export async function setDraftValue(db, admin, key, value) {
  if (!tunable(key)) throw new HttpError(400, `Unknown setting "${String(key).slice(0, 80)}".`);
  if (value === null || value === undefined) {
    await db.query('DELETE FROM tuning_draft WHERE key = $1', [key]);
    return { key, value: null };
  }
  let v;
  try { v = validateValue(key, value); } catch (err) { throw new HttpError(400, err.message); }
  if (JSON.stringify(v) === JSON.stringify(tunable(key).defaultValue)) {
    await db.query('DELETE FROM tuning_draft WHERE key = $1', [key]);
    return { key, value: null };
  }
  await db.query(
    `INSERT INTO tuning_draft (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(v), admin.username],
  );
  return { key, value: v };
}

export async function discardDraft(db) {
  const published = await loadPublished(db);
  await inTx(db, (tx) => replaceDraft(tx, published.values, 'discard'));
}

async function publishValues(db, admin, values, note, action) {
  const problems = crossCheck(values);
  if (problems.length) throw new HttpError(400, `Can't publish yet: ${problems.join(' ')}`);
  const previous = await loadPublished(db);
  const id = await inTx(db, async (tx) => {
    const { rows } = await tx.query(
      'INSERT INTO tuning_versions (values, note, published_by) VALUES ($1, $2, $3) RETURNING id',
      [JSON.stringify(values), note, admin.username],
    );
    await replaceDraft(tx, values, admin.username);
    const changed = new Set([...Object.keys(values), ...Object.keys(previous.values)]);
    let differences = 0;
    for (const k of changed) if (JSON.stringify(values[k]) !== JSON.stringify(previous.values[k])) differences++;
    await logAction(tx, admin, action, { version: Number(rows[0].id), note, values: Object.keys(values).length, changed: differences });
    return Number(rows[0].id);
  });
  await applyPublished(db);
  return { version: id };
}

function cleanNote(note) {
  const n = String(note ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (n.length < 3 || n.length > 300) throw new HttpError(400, 'Add a short note about what changed (3 to 300 characters).');
  return n;
}

export async function publishDraft(db, admin, note) {
  const { clean } = cleanSet(await draftValues(db));
  return publishValues(db, admin, clean, cleanNote(note), 'tuning-publish');
}

export async function rollbackTo(db, admin, versionId) {
  if (!/^\d{1,18}$/.test(String(versionId))) throw new HttpError(404, 'No such version.');
  const row = (await db.query('SELECT id, values FROM tuning_versions WHERE id = $1', [versionId])).rows[0];
  if (!row) throw new HttpError(404, 'No such version.');
  const { clean } = cleanSet(row.values);
  return publishValues(db, admin, clean, `Rolled back to version ${row.id}`, 'tuning-rollback');
}

export async function exportValues(db, which = 'published') {
  const values = which === 'draft' ? await draftValues(db) : (await loadPublished(db)).values;
  return { game: 'dam-angler', kind: 'tuning', which: which === 'draft' ? 'draft' : 'published', exportedAt: new Date().toISOString(), values };
}

export async function importValues(db, admin, file) {
  const values = file && typeof file === 'object' && file.values ? file.values : file;
  const { clean, skipped } = cleanSet(values);
  await inTx(db, async (tx) => {
    await replaceDraft(tx, clean, admin.username);
    await logAction(tx, admin, 'tuning-import', { imported: Object.keys(clean).length, skipped: skipped.length });
  });
  return { imported: Object.keys(clean).length, skipped };
}

export function createTuningAdminRouter({ db, limiter }) {
  const r = express.Router();
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
  const slow = (req) => { if (limiter && !limiter.hit(`t:${req.user.id}`)) throw new HttpError(429, 'Slow down a little.'); };
  r.get('/', async (req, res) => res.json(await adminState(db)));
  // The draft, for playing the game with it (preview).
  r.get('/draft', async (req, res) => res.json({ values: await draftValues(db) }));
  r.put('/draft', async (req, res) => { const b = body(req); res.json(await setDraftValue(db, req.user, String(b.key ?? ''), b.value)); });
  r.delete('/draft', async (req, res) => { await discardDraft(db); res.json({ ok: true }); });
  r.post('/publish', async (req, res) => { slow(req); res.json(await publishDraft(db, req.user, body(req).note)); });
  r.post('/rollback', async (req, res) => { slow(req); res.json(await rollbackTo(db, req.user, body(req).versionId)); });
  r.get('/export', async (req, res) => {
    const data = await exportValues(db, req.query.which === 'draft' ? 'draft' : 'published');
    res.setHeader('Content-Disposition', `attachment; filename="dam-angler-tuning-${data.which}.json"`);
    res.json(data);
  });
  r.post('/import', async (req, res) => { slow(req); res.json(await importValues(db, req.user, body(req))); });
  return r;
}
