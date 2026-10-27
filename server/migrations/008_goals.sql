-- Challenges claimed, and monthly competition prizes paid.
ALTER TABLE credit_log DROP CONSTRAINT credit_log_reason_check;
ALTER TABLE credit_log ADD CONSTRAINT credit_log_reason_check
  CHECK (reason IN ('catch', 'buy', 'chum', 'guest-import', 'admin', 'challenge', 'prize'));

CREATE TABLE challenge_claims (
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  challenge_id text NOT NULL CHECK (challenge_id ~ '^[dw]:\d{4}-\d\d-\d\d:\d$'),
  reward       integer NOT NULL CHECK (reward >= 0),
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE comp_awards (
  comp_id    text NOT NULL CHECK (comp_id ~ '^c:\d{4}-\d\d:[ab]$'),
  rank       smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  user_id    bigint REFERENCES users (id) ON DELETE SET NULL,
  username   text CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$'),
  weight_kg  numeric(7, 2) NOT NULL,
  reward     integer NOT NULL CHECK (reward >= 0),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comp_id, rank)
);
