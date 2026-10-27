# Reading the water (gameplay piece 3 of 5)

Approved 2026-10-27.

## Goal
Where and how deep you fish matters, and you can find out.

## Rules (`src/waterReading.js`)
- **Feeding depth per fish:** carp, barbel, mudfish on the bottom; kurper/bluegill
  0.3–2 m; bass 0.8–3.5 m; yellowfish 0.8–5 m; trout 0.5–4 m; tigers 0–2 m.
- **Where the bait fishes:** float rigs at the float depth (deeper than the water =
  on the bottom, float lying flat); feeders and bottom baits on the bottom; lures at
  their running depth (frog/dry fly on top, crankbait ~1.5 m, jig/soft plastic on the
  bottom, …).
- **Bites:** right depth × 1.4 (tunable), falling to × 0.35 far off. Drop-off (bottom
  falling ≥ 0.18 m per m) × 1.35 for bass, yellowfish, trout, tigers. Windward bank
  (wind ≥ ~8 km/h blowing onto land within 25 m down-wind) × 1.3 for carp, yellowfish,
  kurper.

## Player sees
- **After landing:** "Touched bottom: 2.4 m — weed bed · on a drop-off" /
  "Float at 1.2 m in 4.3 m of water" / "Float lying flat — bait on the bottom in 2.4 m".
- **Fish finders** (new gear kind `gadget`, owned = in use):
  Deeper START (850 credits, ~R1,700): depth, cover, drop-off, wind where you aim.
  Garmin Striker Vivid 4cv (2,000 credits, ~R4,000): also "fish ▮▮▮" activity there.
- **Tackle Box:** Float depth slider (0.3–4 m) under the drag; Electronics tab.

## Server
Migration 006 allows `gadget` in `player_gear.kind`; saves carry `ownedGadgetIds`
(server-owned, bought only); `settings.floatDepth` cleaned to 0.3–4 m.

## Tuning
Game settings → Reading the water.
