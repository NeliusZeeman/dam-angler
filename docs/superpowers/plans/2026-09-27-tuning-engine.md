# Tuning Engine (Part B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draft → preview → publish tuning of fish, tackle, spots and ~30 engine settings, used by both game and server.

**Architecture:** `src/tuning/` (registry, ENGINE, applyTuning) is shared by game and server. Game modules read engine numbers from `ENGINE` at use time. Server keeps draft + versions in Postgres (`server/tuning.js`) and applies the published values in-process. Spec: `docs/superpowers/specs/2026-09-27-tuning-engine-design.md`.

**Tech Stack:** plain ES modules; Express/pg; PGlite tests; admin page JS.

## Global Constraints

- `applyTuning({})` must leave the game exactly as built-in: all existing game and server tests keep passing unchanged.
- Keys `group.item.field`; values validated (type/min/max) on the server; unknown keys refused.
- Only the owner (admin role) can change tuning; every publish/rollback/import in `admin_log`.
- Preview (`/?tuning=draft`) only for a logged-in admin; online saving and catches off while previewing.
- Local only: no push, no deploy.

---

### Task 1: ENGINE settings + game modules read them
**Files:** Create `src/tuning/engine.js`; modify `src/minigame.js`, `src/fightMotion.js`, `src/castPhysics.js`, `src/fish.js`, `src/main.js`, `src/economy.js`, `server/saves.js`; test `test/tuning-engine.test.js`.
**Produces:** `ENGINE` (nested object: bites, fight, motion, cast, money), `ENGINE_DEFAULTS`, `resetEngine()`.
- [ ] Test: defaults equal the old constants; changing `ENGINE.fight.snapAt` changes when minigame snaps; `ENGINE.money.chumCost` changes `CHUM_COST` use.
- [ ] Replace constants with `ENGINE` reads at use time; run all tests (must pass unchanged); commit.

### Task 2: Registry + applyTuning
**Files:** Create `src/tuning/registry.js`, `src/tuning/apply.js`; test `test/tuning-apply.test.js`.
**Produces:** `TUNABLES` (array of `{key, group, item, field, label, hint, type, min, max, step, unit, defaultValue}`), `tunable(key)`, `validateValue(key, value) -> cleanValue | throws`, `applyTuning(values)`, `resetTuning()`.
- [ ] Test: registry covers every species/gear/spot; `applyTuning({})` is a no-op; overrides change live data and reset restores; shares re-balance to 100; activity change updates activeTimes; out-of-range/unknown refused.
- [ ] Implement; run tests; commit.

### Task 3: Server storage, publish, rollback, export/import
**Files:** Create `server/migrations/005_tuning.sql`, `server/tuning.js`, `server/test/tuning.test.js`; modify `server/app.js`, `server/admin.js` (router), `server/index.js` (apply published at start).
**Produces:** routes per spec; `loadPublished(db)`, `applyPublished(db)`.
- [ ] Test: public GET empty then published values; draft invisible until publish; publish applies in-process (payout and price change); rollback; discard; export/import (unknown keys skipped + reported); validation; non-admin refused; logged.
- [ ] Implement; run tests; commit.

### Task 4: Game loads tuning; preview
**Files:** Modify `src/main.js`, `src/cloud.js` (disable in preview), `server/app.js` (draft endpoint for admin preview); test in browser.
- [ ] Game fetches `/api/tuning` (or admin draft with `?tuning=draft`) before the title screen and applies it; preview banner; cloud off in preview.

### Task 5: Tuning screens
**Files:** Create `src/admin/tuning.js`; modify `src/admin/admin.js`, `admin.html`, `src/admin/admin.css`.
- [ ] Tuning tab: groups/items/search, value rows with hint/default/reset, draft count, publish with note, discard, play with draft, export, import, history + rollback.
- [ ] Browser check (desktop + phone) on `npm run dev`; commit.
