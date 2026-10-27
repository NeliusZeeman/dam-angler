-- Electronics (fish finders) are a new kind of gear a player can own.
ALTER TABLE player_gear DROP CONSTRAINT IF EXISTS player_gear_kind_check;
ALTER TABLE player_gear ADD CONSTRAINT player_gear_kind_check
  CHECK (kind IN ('rod', 'line', 'reel', 'hook', 'lure', 'gadget'));
