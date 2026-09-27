-- Safety nets in the database itself, so nothing odd gets stored even if the
-- server code ever let it through: plain-character usernames and emails,
-- sane numbers, short text fields.

ALTER TABLE users
  ADD CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  ADD CONSTRAINT users_email_format CHECK (email ~ '^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$' AND length(email) <= 254),
  ADD CONSTRAINT users_hash_format CHECK (password_hash ~ '^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$');

ALTER TABLE sessions
  ADD CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT sessions_user_agent_len CHECK (user_agent IS NULL OR length(user_agent) <= 200);

ALTER TABLE player_state
  ADD CONSTRAINT player_credits_max CHECK (credits <= 100000000),
  ADD CONSTRAINT player_drag_range CHECK (drag IS NULL OR (drag >= 0.05 AND drag <= 0.9)),
  ADD CONSTRAINT player_ids_len CHECK (
    coalesce(length(equipped_rod), 0) <= 40 AND coalesce(length(equipped_line), 0) <= 40
    AND coalesce(length(equipped_reel), 0) <= 40 AND coalesce(length(equipped_hook), 0) <= 40
    AND coalesce(length(equipped_lure), 0) <= 40 AND coalesce(length(location_id), 0) <= 64
    AND coalesce(length(start_time), 0) <= 20),
  ADD CONSTRAINT player_settings_size CHECK (length(settings::text) <= 2000),
  ADD CONSTRAINT player_imported_size CHECK (length(imported_log::text) <= 8000);

ALTER TABLE player_gear
  ADD CONSTRAINT gear_item_format CHECK (item_id ~ '^[a-z0-9-]{1,40}$');

ALTER TABLE catches
  ADD CONSTRAINT catches_ids_format CHECK (species_id ~ '^[a-z0-9-]{1,40}$' AND location_id ~ '^[a-z0-9-]{1,64}$'),
  ADD CONSTRAINT catches_weight_max CHECK (weight_kg <= 200),
  ADD CONSTRAINT catches_length_range CHECK (length_cm IS NULL OR (length_cm >= 0 AND length_cm <= 500)),
  ADD CONSTRAINT catches_payout_range CHECK (payout >= 0 AND payout <= 1000000),
  ADD CONSTRAINT catches_time_len CHECK (time_of_day IS NULL OR length(time_of_day) <= 20);
