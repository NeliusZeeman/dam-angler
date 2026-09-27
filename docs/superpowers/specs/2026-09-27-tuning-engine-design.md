# Dam Angler — Game tuning engine (Part B)

**Status:** design approved in chat 2026-09-27. Built and tested locally only;
not deployed until the owner says so.
**Lives in:** the admin area from Part A (`/admin`, new **Tuning** tab).

## Goal

The owner can change any number that shapes the game — fish, tackle, spot
catch mixes, and the bite/fight/cast/money settings — with a hint for each
saying what it does. Changes are drafted, previewed, then published; the game
and the server both use the published values; every publish can be rolled
back.

## Decisions

- **Only changes are stored.** Code keeps the built-in values (defaults). The
  database holds overrides: `key → value`. Reset = remove the override.
- **Draft → Preview → Publish.** Draft edits are invisible to players. The
  admin can play with the draft. Publish makes the draft live for everyone
  (next time they open the game). Every publish is a version; roll back to
  any version.
- **Existing things only.** No adding fish, gear or spots from the page.
  Tackle items can be taken out of (or put back in) the shop.
- **Export / import** a tuning file (JSON) to move settings between the local
  test and the live site; an import lands in the draft.

## Keys

`group.item.field` (dots; ids keep their hyphens):

| Group | Examples | Fields |
|---|---|---|
| `fish.<speciesId>` | `fish.common-carp.maxWeightKg` | minWeightKg, maxWeightKg, tempMinC, tempMaxC, baseValuePerKg, aggressiveness, activity (7 numbers, morning→night), lure.<lureId> (bait liking), fight.runSpeed, fight.stamina, fight.swing, fight.jumpRate, fight.jumpHeight, fight.depth |
| `gear.<kind>.<itemId>` | `gear.rod.rod-carp.castSpeed` | common: cost, inShop; rod: castSpeed, spread, tensionTolerance, maxKg, shockAbsorb; line: breakKg, castMultiplier; reel: castMultiplier, dragBonus; hook: strengthKg, holdBonus, tensionBonus; lure: (cost/inShop only) |
| `spot.<locationId>` | `spot.jozini.share.tigerfish` | share.<speciesId> (catch mix; shares re-balanced to 100% after tuning), tempOffset |
| `engine.<area>` | `engine.fight.snapAt` | the ~30 settings below |

Engine settings (key → current value):

- **bites:** `engine.bites.rate` (DAM_BITE_RATE 0.035), `engine.bites.guaranteeSeconds` (90), `engine.bites.trophyChance` (1/300), `engine.bites.activeThreshold` (0.75)
- **fight:** `engine.fight.snapAt` (0.9), `reelTensionRate` (0.42), `slackRate` (0.55), `progressRate` (0.22), `progressLossRate` (0.05), `slackLimitSeconds` (4), `slackThreshold` (0.06), `defaultDrag` (0.33), `haulOver` (0.35), `dragTension` (0.28), `dragTire` (0.45), `jumpStrain` (0.25), `throwChancePerSecond` (0.8), `landReach` (4.2)
- **fish movement:** `engine.motion.runSeconds` (1.3), `reelSpeed` (1.5), `lineOnSpool` (140)
- **casting:** `engine.cast.gravity` (9.81), `launchElevation` (0.55)
- **money:** `engine.money.chumCost` (15), `guestImportLimit` (10000)

Every key has in the registry: label, hint (plain English), type (number |
integer | boolean | 7 numbers), min, max, step, unit (kg, °C, m, s,
credits, %), and its built-in default.

## Code structure

| File | Does |
|---|---|
| `src/tuning/registry.js` | Builds the list of tunable keys from the game data (fish, gear, spots) plus the engine list; hints per field type; `validate(key, value)` |
| `src/tuning/engine.js` | `ENGINE` — the live engine settings object (defaults from the constants above) |
| `src/tuning/apply.js` | `applyTuning(values)` — resets everything to defaults, then sets the overrides on the live data (FISH_SPECIES, gear lists, FIGHT_STYLES, LOCATIONS, ENGINE); re-balances spot shares; recomputes anything derived (fish activeTimes, bait lists) |
| game modules | read engine numbers from `ENGINE` at the moment they're used, instead of their own constants (minigame, fightMotion, castPhysics, fish, main, economy, saves) |
| `server/tuning.js` | draft, publish, versions, rollback, export/import; applies the published values in the server process at start-up and after each publish |
| `src/admin/tuning.js` | the Tuning screens |

## Database (migration 005)

- `tuning_draft (key text PK, value jsonb NOT NULL, updated_by text, updated_at)`
- `tuning_versions (id bigserial PK, values jsonb NOT NULL, note text, published_by text, published_at)` — the latest row is live
- `admin_log.action` also allows `tuning-publish`, `tuning-rollback`, `tuning-import`

## API

| Method | Path | Who | Does |
|---|---|---|---|
| GET | `/api/tuning` | anyone | `{ version, values }` — the published overrides (cached) |
| GET | `/api/admin/tuning` | admin | `{ draft, published, publishedVersion, versions: [{id, note, by, at, count}] }` |
| PUT | `/api/admin/tuning/draft` | admin | `{ key, value }` sets a draft value (validated); `value: null` resets it to the default |
| DELETE | `/api/admin/tuning/draft` | admin | discard the whole draft (back to what's published) |
| POST | `/api/admin/tuning/publish` | admin | `{ note }` → new version from the draft |
| POST | `/api/admin/tuning/rollback` | admin | `{ versionId }` → publishes a copy of that version's values |
| GET | `/api/admin/tuning/export?which=draft|published` | admin | download JSON |
| POST | `/api/admin/tuning/import` | admin | `{ values }` → replaces the draft (every key validated; unknown keys reported and skipped) |

The draft always starts as a copy of what's published (after a publish or
discard they're equal).

## Game

- On start, before the title screen, the game fetches `/api/tuning` and
  applies it (no server = built-in values, as before).
- **Preview:** `/?tuning=draft` — only for a logged-in admin — loads the
  draft instead. A banner says "Preview — draft tuning"; online saving and
  catches are switched off while previewing so nothing counts.

## Admin screens (Tuning tab)

- Top bar: number of draft changes; **Publish** (with a note); **Discard
  draft**; **Play with draft**; **Export**; **Import**.
- Left: groups — Fish, Rods, Lines, Reels, Hooks, Baits, Spots, Game
  settings — and the items in each (search box).
- Right: the chosen item's values. Each row: label, hint, default, the value
  (input with min/max), a "changed" marker (draft differs from built-in) and
  a **Reset** button. Changes save to the draft as you go.
- History: every published version (who, when, note, how many values) with
  **Roll back to this**.

## Checks

- Every value validated against its min/max/type on the server (a typo like
  5000 kg for a kurper is refused with a sentence).
- Publish/rollback/import are admin-only, rate-limited and logged.
- Tests: registry covers every fish/gear/spot; defaults round-trip (apply({})
  leaves the game exactly as built-in); overrides change live values and
  reset restores them; shares re-balance; engine settings reach minigame /
  fightMotion / payouts; the server pays and prices with published values;
  draft invisible until publish; rollback; export/import; validation refuses
  out-of-range and unknown keys; non-admins refused everywhere.
