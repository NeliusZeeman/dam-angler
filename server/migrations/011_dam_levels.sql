-- Real dam levels: the Department of Water and Sanitation's weekly State of
-- Dams (server/damLevels.js fetches it), so the web game and the PC game
-- show the same water. One row per DWS dam; location_id is the game's dam
-- where there is one.
CREATE TABLE IF NOT EXISTS dam_levels (
  dam_name text PRIMARY KEY,
  location_id text,
  province text NOT NULL,
  fsc_mcm real,
  pct real,
  last_week_pct real,
  last_year_pct real,
  report_date date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dam_levels_location ON dam_levels (location_id);
