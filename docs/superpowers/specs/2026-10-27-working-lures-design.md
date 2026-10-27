# Working lures (gameplay piece 2 of 5)

Approved 2026-10-27.

## Goal
Each lure has its proper retrieve, worked with the existing controls (hold = reel,
tap = twitch, sweep = retrieve). How well it's worked changes bites, and a fish can
be seen following the lure in.

## Retrieves (`src/lureAction.js`)
| Lure | Retrieve |
|---|---|
| Crankbait, spinnerbait | steady wind, 0.6–2.2 m/s |
| Spoon | steady with the odd pause (flutter) |
| Rapala minnow | twitch-twitch-pause |
| Soft plastic, flipping jig | hop and let it sink 1.5 s+ |
| Topwater frog | short twitches, long pauses |
| Streamer, Walker's Killer, damsel | strip in short tugs |
| Nymph, Zak | slow small strips |
| Dry fly | leave it still (dead drift) |

The last 5 s of the retrieve (speed, share of time moving, twitches, longest pause)
are scored 0..1 with a hint: Good action / Too fast / Too slow / Let it pause /
Twitch it / Keep it moving / Leave it still. Bait isn't scored.

## Effects
- Lure bites × 0.35 (bad) … × 2.5 (perfect).
- With action ≥ 0.6 and the lure within 30 m, a fish may start following
  (0.09/s × quality): seen just behind the lure, closing in for 2.5–5.5 s. Keep the
  action ≥ 0.35 and it hits (a take from piece 1); let it drop and it turns away.
- Holding to reel brings a lure in at a steady crank (1.4 m/s); bait still comes in fast.

## Shown
An action meter above the distance counter while a lure or fly is in the water.

## Tuning
Game settings → Working lures: bad/best bite multipliers, follow chance, lure reel speed.
