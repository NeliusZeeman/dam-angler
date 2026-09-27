-- The server keeps the books: every change to a player's credits, and why.
-- (Catches pay, purchases and breadcrumbs cost; a guest's progress can be
-- carried in once at sign-up.)
CREATE TABLE credit_log (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount      integer NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('catch', 'buy', 'chum', 'guest-import')),
  ref         text CHECK (ref IS NULL OR length(ref) <= 80),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_log_user_idx ON credit_log (user_id, created_at);
