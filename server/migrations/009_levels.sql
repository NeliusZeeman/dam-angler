-- Levels: a boss fish (the top of the angler's size range for their level)
-- earns bonus level points.
ALTER TABLE catches ADD COLUMN IF NOT EXISTS boss boolean NOT NULL DEFAULT false;
