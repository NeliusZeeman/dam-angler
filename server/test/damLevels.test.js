import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newTestDb, startTestServer } from './helpers.js';
import { parseProvincePage, saveLevels, refreshLevels, LOCATION_BY_DWS } from '../damLevels.js';

const page = readFileSync(new URL('./fixtures/dws-nw.html', import.meta.url), 'utf8');
let db, srv;
before(async () => { db = await newTestDb(); srv = await startTestServer(db); });
after(async () => { await srv.close(); await db.end(); });

test('reads a DWS province page: date and every dam with its levels', () => {
  const { reportDate, rows } = parseProvincePage(page, 'NW');
  assert.match(reportDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(rows.length >= 15);
  const h = rows.find((r) => r.damName === 'Hartbeespoort Dam');
  assert.ok(h, 'Hartbeespoort is in the North West table');
  assert.ok(h.pct > 0 && h.pct < 150);
  assert.ok(h.fsc > 100);
  // "#100.0" (carried forward) still reads as a number
  assert.ok(rows.every((r) => Number.isFinite(r.pct)));
});

test('stores the levels and serves them by the game\'s dam ids', async () => {
  const parsed = parseProvincePage(page, 'NW');
  assert.equal(await saveLevels(db, parsed), parsed.rows.length);
  const r = await srv.client().get('/api/dams/levels');
  assert.equal(r.status, 200);
  assert.equal(r.body.reportDate, parsed.reportDate);
  assert.match(r.body.source, /Water and Sanitation/);
  const h = r.body.dams.hartbeespoort;
  assert.equal(h.damName, 'Hartbeespoort Dam');
  assert.equal(h.pct, parsed.rows.find((x) => x.damName === 'Hartbeespoort Dam').pct);
  assert.ok(r.body.dams.boskop && r.body.dams.buffelspoort);
  // only dams the game has
  assert.ok(Object.keys(r.body.dams).every((id) => Object.values(LOCATION_BY_DWS).includes(id)));
});

test('a refresh survives DWS being down (old figures stay)', async () => {
  const before = await db.query('SELECT count(*)::int AS n FROM dam_levels');
  const n = await refreshLevels(db, async () => { throw new Error('offline'); });
  assert.equal(n, 0);
  const after = await db.query('SELECT count(*)::int AS n FROM dam_levels');
  assert.equal(after.rows[0].n, before.rows[0].n);
});
