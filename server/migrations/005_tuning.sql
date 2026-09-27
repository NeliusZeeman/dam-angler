-- Game tuning (admin area): the draft being worked on, and every published
-- version. Only values that differ from the game's built-in ones are kept.
CREATE TABLE tuning_draft (
  key         text PRIMARY KEY CHECK (length(key) <= 120),
  value       jsonb NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- The newest row is what players get.
CREATE TABLE tuning_versions (
  id            bigserial PRIMARY KEY,
  values        jsonb NOT NULL,
  note          text CHECK (note IS NULL OR length(note) <= 300),
  published_by  text NOT NULL,
  published_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_log DROP CONSTRAINT admin_log_action_check;
ALTER TABLE admin_log ADD CONSTRAINT admin_log_action_check
  CHECK (action IN ('credits', 'delete-player', 'tuning-publish', 'tuning-rollback', 'tuning-import'));
