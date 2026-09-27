-- Dam Angler v2: players, their saves and every catch.

CREATE TABLE users (
  id             bigserial PRIMARY KEY,
  email          text NOT NULL,            -- stored lower-case
  username       text NOT NULL,            -- shown publicly, 3-20 chars A-Z a-z 0-9 _
  password_hash  text NOT NULL,            -- bcrypt
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- One row per logged-in device. Only a hash of the cookie token is kept.
CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Everything the game remembers about a player, apart from gear and catches.
CREATE TABLE player_state (
  user_id         bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  credits         integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  equipped_rod    text,
  equipped_line   text,
  equipped_reel   text,
  equipped_hook   text,
  equipped_lure   text,
  drag            real,
  location_id     text,
  start_time      text,
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- A guest's catch log from before they signed up (per species count/best);
  -- added into their catch log, never into the public dam stats.
  imported_log    jsonb NOT NULL DEFAULT '{}'::jsonb,
  version         integer NOT NULL DEFAULT 0,  -- bumped on every write
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Every rod, reel, line, hook and bait a player owns.
CREATE TABLE player_gear (
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('rod', 'line', 'reel', 'hook', 'lure')),
  item_id      text NOT NULL,
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, item_id)
);

-- Every fish landed. The id comes from the game, so sending it twice is harmless.
-- The catch log and the public dam stats are both worked out from here.
CREATE TABLE catches (
  id           uuid PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  species_id   text NOT NULL,
  location_id  text NOT NULL,
  weight_kg    numeric(6, 2) NOT NULL CHECK (weight_kg > 0),
  length_cm    integer,
  trophy       boolean NOT NULL DEFAULT false,
  payout       integer NOT NULL DEFAULT 0,
  time_of_day  text,
  caught_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catches_dam_weight_idx ON catches (location_id, weight_kg DESC);
CREATE INDEX catches_user_idx ON catches (user_id);
CREATE INDEX catches_dam_species_idx ON catches (location_id, species_id);
