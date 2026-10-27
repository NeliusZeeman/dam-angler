-- Keep or release: whether the angler kept the fish (it pays a little more).
ALTER TABLE catches ADD COLUMN IF NOT EXISTS kept boolean NOT NULL DEFAULT false;
