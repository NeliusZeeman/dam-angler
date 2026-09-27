# Accounts, Cloud Saves and Dam Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players sign up/log in and keep one save across devices; every dam shows public catch stats.

**Architecture:** An Express API (`server/`) on the game server talks to Postgres through a tiny `db.query(text, params)` interface (pg in production, PGlite in tests). The browser game keeps saving to localStorage exactly as v1; `src/cloud.js` mirrors every save and every catch to the API with an offline queue. Spec: `docs/superpowers/specs/2026-09-27-accounts-cloud-saves-design.md`.

**Tech Stack:** Node 22 ES modules, express 5, pg, bcryptjs; tests `node --test` + @electric-sql/pglite; game is Three.js ES modules (no bundler).

## Global Constraints

- Work only in `Game\Dam Angler V2`, branch `v2`. Never push to `master`.
- Secrets only in `server/.env` (gitignored, mode 600 on the server).
- Only usernames are public; emails only in `/api/me`.
- Metric units only in anything the player sees.
- Game must still work fully as a guest with no server (file:// or v1-style static hosting).
- Existing game tests (`for f in test/*.test.js; do node "$f"; done`) keep passing.

---

### Task 1: Server skeleton, database and migrations

**Files:** Create `package.json`, `server/db.js`, `server/migrate.js`, `server/migrations/001_init.sql`, `server/test/helpers.js`, `server/test/migrate.test.js`; modify `.gitignore` (`server/.env`).

**Interfaces — produces:**
- `createPgDb(connectionString) -> { query(text, params) -> {rows}, end() }`
- `migrate(db) -> string[]` (names of migrations applied this run; idempotent)
- test helper `newTestDb() -> Promise<db>` (PGlite, migrated)

- [ ] Test: migrating twice applies once; all five tables exist.
- [ ] Implement `001_init.sql` with the tables in the spec (users, sessions, player_state, player_gear, catches, indexes; username/email uniqueness on `lower()`).
- [ ] `npm install`, run `node --test server/test/`, commit.

### Task 2: Accounts (signup, login, logout, me, delete)

**Files:** Create `server/auth.js`, `server/app.js`, `server/index.js`, `server/validate.js` (username/email/password rules), `server/test/auth.test.js`.

**Interfaces — produces:**
- `createApp({ db, secureCookies = false }) -> express app`
- routes `POST /api/auth/signup|login|logout`, `GET /api/me`, `DELETE /api/me`
- `requireUser` middleware sets `req.user = { id, username, email }`
- cookie name `da_session`

- [ ] Tests: signup sets cookie and `/api/me` works; duplicate email/username (any case) → 409 with a sentence; short password → 400; wrong password → 401; 11th bad login in 15 min → 429; logout kills the session; delete needs the password and removes everything; emails lowercased.
- [ ] Implement (bcrypt cost 11; token = 32 random bytes base64url; store sha256; 30-day expiry).
- [ ] Run tests, commit.

### Task 3: Saves and catches

**Files:** Create `server/saves.js`, `server/test/saves.test.js`; extend `server/validate.js`, `server/app.js`.

**Interfaces — produces:**
- `loadSave(db, userId) -> { save, version }` (save = the game's save object incl. `catchLog` built from `catches`)
- `writeSave(db, userId, save, baseVersion) -> { ok: true, version } | { ok: false, save, version }`
- routes `PUT /api/me/save`, `POST /api/me/catches`; signup accepts `guestSave` (+ `guestCatches`)

- [ ] Tests: round trip of every save field; stale `baseVersion` → 409 with server save; unknown gear ids dropped; negative credits → 400; catch stored once when sent twice; catch with unknown species or impossible weight → 400; catchLog counts/bests/trophies come from catches; guest save carried into a new account.
- [ ] Implement, run tests, commit.

### Task 4: Public dam stats

**Files:** Create `server/stats.js`, `server/test/stats.test.js`; extend `server/app.js`.

**Interfaces — produces:** `GET /api/dams/stats -> { dams: { [locationId]: { total, record: {speciesId, weightKg, username, caughtAt} | null } } }`, `GET /api/dams/:id/stats -> { total, record, species: [{speciesId, count, bestKg}] }`

- [ ] Tests: totals, record holder by username, no email anywhere in the JSON, unknown dam → 404.
- [ ] Implement, run tests, commit.

### Task 5: Game client — cloud sync

**Files:** Create `src/cloud.js`, `test/cloud.test.js`; modify `src/save.js` (save listeners), `src/main.js` (load cloud save at start, send catches, dam record on catch card), `src/ui.js` (catch card record line).

**Interfaces — produces (`src/cloud.js`):**
- `createCloud({ fetchImpl = fetch, storage = localStorage, base = '/api' })` → `{ available(), me(), signup(), login(), logout(), deleteAccount(), queueSave(save), queueCatch(catch), flush(), damStats(), status(), onStatus(fn) }`
- `mergeOnConflict(localSave, serverSave) -> save` (server wins, gear lists unioned)

- [ ] Tests (fake fetch + fake storage): saves batch to one call; offline queue survives a "reload" and flushes later; 409 merges and resends; catches queued with ids and sent once.
- [ ] Implement and wire into main.js; run all tests, commit.

### Task 6: Account screens, POPIA notice, spot records

**Files:** Create `src/accountPanel.js`; modify `src/mainMenu.js`, `src/startMenu.js`, `src/style.css`.

- [ ] Main menu shows "Log in or sign up to save online" or "Signed in as <name> · Log out".
- [ ] Sign-up form: email, username, password, privacy notice + "I agree" tick; login form; delete account (password).
- [ ] Spot cards show "Record: 12.4 kg Common Carp by nelius · 153 caught" when stats load.
- [ ] Check in a browser against a local API (PGlite-backed dev server), both desktop and phone size; commit.

### Task 7: Deploy to 192.168.1.36

**Files:** Create `tools/deploy-v2.sh`, `server/deploy/dam-angler-api.service`, `server/deploy/nginx-angler-v2.conf`.

- [ ] Push branch `v2` to GitHub; clone to `~/online_app/dam-angler-v2` on the server; write `server/.env` there (mode 600).
- [ ] `npm ci --omit=dev`, migrate against `dam_anglers`, install + start the systemd unit (127.0.0.1:8100).
- [ ] nginx site for `angler-v2.homeprojecthub.co.za` (static + `/api/` proxy), `nginx -t`, reload.
- [ ] Cloudflare: add the ingress rule and DNS route; restart cloudflared; confirm v1 still answers.
- [ ] Smoke test through HTTPS: sign up, save, log in from a second browser, same save; dam stats visible.
