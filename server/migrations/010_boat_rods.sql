-- Boat rods: a catch on one of the boat's own rods, on the fish it's rigged
-- for, earns extra level points (src/boatRods.js, levels.boatPoints).
ALTER TABLE catches ADD COLUMN IF NOT EXISTS boat_pts integer NOT NULL DEFAULT 0;
