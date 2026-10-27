# Landing the fish (gameplay piece 4 of 5)

Approved 2026-10-27.

## Snags and cover
Fish that live in cover (habitat.structure, plus carp and barbel) bolt for the nearest
weed / reeds / lily pads / timber / hyacinth within 15 m (not within 6 m of the angler).
"It's heading for the reeds! Rod up — turn its head!" Rod held up (lift >= 0.2) turns
its head away; harder while winding. In the cover it's snagged: winding only loads the
line; stop winding 2 s and it swims out (35 %/s); stuck 12 s and the line parts
(loss report "Snagged").

## The net
Fish >= 0.5 kg wait at your feet until netted: "Net it! Click when it's calm". A calm
fish (not running/jumping) goes in; a lively one bolts back to 75 % with a tension
spike. Smaller fish are swung in as before. A landing net shows in the water.

## Weigh-in, keep or release
The catch card's scale ticks up to the weight. Release (default, also Enter/Esc) pays
the normal credits and counts as released; Keep pays x1.2. Protected fish
(largemouth and Clanwilliam yellowfish) can only be released. This session at this
dam: each release +5 % bites (max +25 %); each kept fish -10 % bites for its species
(max -30 %).

## Server
Migration 007 adds `catches.kept`; the server pays the keep bonus itself (never for a
protected fish) and the catch log counts `released`.

## Tuning
Game settings → Landing the fish.
