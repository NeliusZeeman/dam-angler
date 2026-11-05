// Real dam levels from the Department of Water and Sanitation's weekly State
// of Dams (https://www.dws.gov.za/Hydrology/Weekly/), stored in dam_levels
// and served at /api/dams/levels so every copy of the game -- the web game
// and the PC game, online or catching up later -- shows the same water.
// Source credit: Department of Water and Sanitation, Republic of South Africa.

const BASE = 'https://www.dws.gov.za/Hydrology/Weekly/ProvinceWeek.aspx?region=';
export const REGIONS = ['EC', 'FS', 'G', 'KN', 'LP', 'M', 'NC', 'NW', 'WC'];
export const SOURCE = 'Department of Water and Sanitation, State of Dams (weekly)';

// The game's dams by their DWS names (where the names differ, the DWS one).
export const LOCATION_BY_DWS = {
  'Hartbeespoort Dam': 'hartbeespoort', 'Vaal Dam': 'vaal', 'Pongolapoort Dam': 'jozini',
  'Bronkhorstspruit Dam': 'bronkhorstspruit', 'Loskop Dam': 'loskop', 'Roodeplaat Dam': 'roodeplaat',
  'Rietvlei Dam': 'rietvlei', 'Sterkfontein Dam': 'sterkfontein', 'Gariep Dam': 'gariep',
  'Allemanskraal Dam': 'allemanskraal', 'Bloemhof Dam': 'bloemhof', 'Roodekopjes Dam': 'roodekoppies',
  'Boskop Dam': 'boskop', 'Buffelspoort Dam': 'buffelspoort', 'Heyshope Dam': 'heyshope',
  'Witbank Dam': 'witbank', 'Blyderivierpoort Dam': 'blydepoort', 'Tzaneen Dam': 'tzaneen',
  'Ebenezer Dam': 'ebenezer', 'Flag Boshielo Dam': 'flag-boshielo', 'Magoebaskloof Dam': 'magoebaskloof',
  'Albert Falls Dam': 'albert-falls', 'Midmar Dam': 'midmar', 'Darlington Dam': 'darlington',
  'Xonxa Dam': 'xonxa', 'Theewaterskloof Dam': 'theewaterskloof', 'Clanwilliam Dam': 'clanwilliam',
  'Stettynskloof Dam': 'stettynskloof', 'Vanderkloof Dam': 'vanderkloof', 'Spitskop Dam': 'spitskop',
};

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
// "#100.0" means DWS carried last week's figure forward; still the latest.
const pct = (s) => { const n = Number(String(s).replace('#', '')); return Number.isFinite(n) && s !== '' ? n : null; };

// One province page -> { reportDate, rows: [{ damName, province, fsc, pct, lastWeek, lastYear }] }
export function parseProvincePage(html, province) {
  const date = html.match(/State of Dams on (\d{4}-\d{2}-\d{2})/);
  const rows = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1]));
    // Dam | River | Photo | Indicators | FSC | This Week | Last Week | Last Year
    if (cells.length !== 8 || !/Dam$/.test(cells[0]) || pct(cells[5]) === null) continue;
    rows.push({ damName: cells[0], province, fsc: pct(cells[4]), pct: pct(cells[5]), lastWeek: pct(cells[6]), lastYear: pct(cells[7]) });
  }
  return { reportDate: date ? date[1] : null, rows };
}

// Every province's page; a province that fails is skipped (the rest still count).
export async function fetchDwsLevels(fetchImpl = fetch) {
  const all = [];
  let reportDate = null;
  for (const region of REGIONS) {
    try {
      const r = await fetchImpl(BASE + region, { headers: { 'User-Agent': 'DamAngler/2 (dam levels for the game)' }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) continue;
      const page = parseProvincePage(await r.text(), region);
      reportDate = reportDate ?? page.reportDate;
      all.push(...page.rows);
    } catch (e) {
      console.error(`dam levels: ${region} failed: ${e.message}`);
    }
  }
  return { reportDate, rows: all };
}

export async function saveLevels(db, { reportDate, rows }) {
  if (!reportDate || rows.length === 0) return 0;
  for (const r of rows) {
    await db.query(
      `INSERT INTO dam_levels (dam_name, location_id, province, fsc_mcm, pct, last_week_pct, last_year_pct, report_date, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (dam_name) DO UPDATE SET location_id = $2, province = $3, fsc_mcm = $4, pct = $5,
         last_week_pct = $6, last_year_pct = $7, report_date = $8, fetched_at = now()`,
      [r.damName, LOCATION_BY_DWS[r.damName] ?? null, r.province, r.fsc, r.pct, r.lastWeek, r.lastYear, reportDate],
    );
  }
  return rows.length;
}

// The game's dams: { reportDate, source, dams: { locationId: { pct, lastWeek, lastYear, damName } } }
export async function levelsForGame(db) {
  const { rows } = await db.query(
    `SELECT location_id, dam_name, pct, last_week_pct, last_year_pct, report_date
       FROM dam_levels WHERE location_id IS NOT NULL ORDER BY location_id`,
  );
  const dams = {};
  let reportDate = null;
  for (const r of rows) {
    const d = r.report_date instanceof Date ? r.report_date.toISOString().slice(0, 10) : String(r.report_date).slice(0, 10);
    if (!reportDate || d > reportDate) reportDate = d;
    dams[r.location_id] = { damName: r.dam_name, pct: r.pct, lastWeek: r.last_week_pct, lastYear: r.last_year_pct, reportDate: d };
  }
  return { reportDate, source: SOURCE, dams };
}

// Fetch and store; logs and carries on if DWS is down (the old figures stay).
export async function refreshLevels(db, fetchImpl = fetch) {
  try {
    const got = await fetchDwsLevels(fetchImpl);
    const n = await saveLevels(db, got);
    console.log(`dam levels: ${n} dams for ${got.reportDate}`);
    return n;
  } catch (e) {
    console.error(`dam levels: refresh failed: ${e.message}`);
    return 0;
  }
}
