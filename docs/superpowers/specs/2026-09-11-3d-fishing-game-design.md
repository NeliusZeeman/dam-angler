# 3D Pond Fishing Game — Design Spec

## Overview
Browser-based 3D fishing game. Player sits at a pond dock/shore, casts lines, catches South African freshwater fish (carp, tilapia, bass), earns credits, buys better gear. Built with Three.js, no build step, no backend — open `index.html` in a browser, progress saved to `localStorage`.

## Tech Stack
- Three.js (via CDN, vendored copy also kept locally for offline play)
- Vanilla JS (ES modules), HTML, CSS — no framework, no bundler
- `localStorage` for save data (credits, owned gear, unlocked fish log)
- No backend, no network calls

## File Layout
```
index.html
/src
  main.js          - app bootstrap, render loop
  scene.js          - pond, skybox, shore, dock, lighting
  water.js          - water shader/mesh, ripple effects
  environment.js    - season/time-of-day/weather cycle, wind
  fish.js           - fish definitions + AI/movement + bite logic
  casting.js         - cast aim/power input, line physics, bobber
  minigame.js       - reel/QTE bite minigame
  gear.js           - rods, lines, lures/bait definitions
  economy.js        - credits, catch payout calc
  shop.js           - upgrade shop UI logic
  save.js           - localStorage load/save
  ui.js             - HUD (credits, gear indicator, catch log, season/weather display)
/assets
  (textures, simple geometries generated in-code where possible to avoid asset dependencies)
/docs/superpowers/specs
  this file
```

## Scene & Camera
- Fixed shore/dock viewpoint: camera positioned at water's edge, slight height (sitting position), looking out over the pond. Camera can pan left/right (mouse drag or arrow keys) within a limited arc — no free-fly.
- Pond: circular/irregular water mesh, animated shader (Fresnel + moving normal map or procedural ripple) tinted by current water temperature (bluer when cold, greener/warmer tint in summer).
- Shore detail: reeds, lily pads, rocks placed around pond edge; simple low-poly trees in background.
- Lighting: directional light (sun) with position/color driven by time-of-day; ambient light adjusts with season/weather.

## Environment System
- **Seasons**: Summer → Autumn → Winter → Spring cycle, each lasting a fixed in-game duration (e.g. 20 real minutes of play), progressing automatically. Season shown in HUD.
- **Water temperature**: derived from season (+ minor randomness), displayed in HUD (°C). Drives which fish are active/biting.
- **Wind**: periodic gusts (random interval), visualized via reed/tree sway and ripple direction on water, and applies lateral drift to the cast line while it's in the air and to the bobber.
- **Time of day**: slow day/night cycle affecting lighting and which fish are more active (optional stretch, kept simple: just lighting shift, no full fish-behavior gate on it to keep scope bounded).

## Fish
Three species at launch, each with: name, min/max weight, preferred temp range, preferred depth band, base credit value per kg, bite-aggressiveness (affects bite frequency), preferred lure/bait types.

- **Tilapia** — warm water lover, shallow, common, low-medium value, easy bite.
- **Carp** — broad temp tolerance, mid-depth, medium value, medium difficulty (stronger fight in minigame).
- **Bass** — prefers cooler water, structure/plant edges, highest value, hardest fight.

Fish are not individually simulated swimming models in full detail — a lightweight pool: each active fish is a data object with a position near a plant/structure zone and a "interest" roll each tick based on temp/lure match; when triggered, a bite event fires for the nearest matching rod in the water.

## Gear
- **Rods** (3 tiers): affects cast distance/accuracy and max line tension tolerated (less snapping on strong fish).
- **Lines** (3 tiers): affects break strength (chance of snapping fish that fight hard).
- **Lures/Bait** (matched to species preference): affects bite rate for matching fish; wrong lure = much lower bite chance.
- Gear is bought in the shop with credits, equipped from an inventory panel, persists via save file.

## Core Loop
1. Player aims cast (drag to set direction/power) and releases.
2. Line arcs out (simple projectile/physics arc, wind affects trajectory) and bobber lands, ripple plays.
3. Environment/fish system rolls for bites over time based on temp, lure match, and gear.
4. On bite: bobber dips, brief window to click "hook" (miss = fish gets away).
5. On hook: reel minigame — keep tension bar in a safe zone by timed clicks/holds while fish pulls; gear stats widen the safe zone / slow tension rise.
6. Success = fish caught, added to catch log, credits awarded based on species/weight/value.
7. Failure (line snaps or fish escapes) = no reward, brief feedback, resume fishing.
8. Credits spent in shop between casts to upgrade rod/line/lures, unlocking access to better fish.

## Economy
- Credit payout = base species value × weight × small randomness × gear-quality multiplier (better gear = slightly better handling, not directly higher payout, to keep skill relevant).
- Shop lists gear tiers with credit cost, locked until affordable, previous tier can be "sold"/replaced (simple swap, no resale value — keeps economy simple).

## UI/HUD
- Top bar: credits, current season + water temp, wind indicator.
- Bottom: equipped rod/line/lure indicator, cast power meter (while aiming), tension bar (during reel minigame).
- Side panel (toggle): shop, catch log/fish inventory.

## Save Data
`localStorage` key holds: credits, owned gear list, equipped gear, catch log (species counts/best weights), current season progress. Loaded on boot; if absent, initialize defaults (starter rod/line/lure, 0 credits).

## Out of Scope (kept simple deliberately)
- No multiplayer, no accounts/backend.
- No full fish-swimming AI/pathfinding — lightweight probability model instead.
- No mobile touch controls in v1 (mouse/keyboard only).
- No real-world clock/weather API — all cycles are simulated in-game.
