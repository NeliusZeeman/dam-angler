-- Admin area: who is an admin, when players were last seen, and a record of
-- every admin action.

-- Only ever set from the server's command line (server/make-admin.js).
ALTER TABLE users
  ADD COLUMN role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  ADD COLUMN last_seen_at timestamptz;
CREATE INDEX users_last_seen_idx ON users (last_seen_at);

-- Credits given or taken by an admin.
ALTER TABLE credit_log DROP CONSTRAINT credit_log_reason_check;
ALTER TABLE credit_log ADD CONSTRAINT credit_log_reason_check
  CHECK (reason IN ('catch', 'buy', 'chum', 'guest-import', 'admin'));
ALTER TABLE credit_log DROP CONSTRAINT credit_log_ref_check;
ALTER TABLE credit_log ADD CONSTRAINT credit_log_ref_check CHECK (ref IS NULL OR length(ref) <= 220);

-- Every admin action. Usernames are kept as text so the record survives the
-- accounts being deleted.
CREATE TABLE admin_log (
  id               bigserial PRIMARY KEY,
  admin_id         bigint REFERENCES users (id) ON DELETE SET NULL,
  admin_username   text NOT NULL,
  action           text NOT NULL CHECK (action IN ('credits', 'delete-player')),
  target_user_id   bigint,
  target_username  text,
  details          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_log_created_idx ON admin_log (created_at DESC);
