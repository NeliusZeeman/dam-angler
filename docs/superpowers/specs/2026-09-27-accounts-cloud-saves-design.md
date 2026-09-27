# Dam Angler v2 — Accounts, cloud saves and dam stats

**Status:** approved in chat 2026-09-27, awaiting review of this written spec.
**Branch/folder:** `v2` in `Game\Dam Angler V2`. v1 (`master`, tag `v1.0`, live at
angler.homeprojecthub.co.za) is not touched.

## Goal

A player signs up with email, username and password, and can move between
phone, tablet and PC without losing anything: credits, gear, what's rigged,
drag, last spot and the catch log all live on the server. Every dam shows
public stats (total fish caught, biggest fish and who caught it). Personal
details are private to the player.

## Where it runs

Same pattern as the solar app on 192.168.1.36 (Debian 13, Node 22,
Postgres 17, nginx, Cloudflare Tunnel):

| Piece | Location |
|---|---|
| Game files | `~/online_app/dam-angler-v2` (git clone, branch `v2`) |
| API | systemd service `dam-angler-api`, Node 22, `127.0.0.1:8100` |
| Web | new nginx site `angler-v2.homeprojecthub.co.za`: static game + `/api/` → 8100 |
| HTTPS | new ingress rule in `/etc/cloudflared/config.yml` + DNS route for the subdomain |
| Database | existing `dam_anglers` on localhost:5432, user `nelius_app` |
| Secrets | `~/online_app/dam-angler-v2/server/.env` (`DATABASE_URL`, `SESSION_SECRET`), mode 600, never in git |

## Server (`server/`)

Node 22 ES modules. Dependencies: `express`, `pg`, `bcryptjs`. Dev:
`@electric-sql/pglite` (real Postgres in memory for tests). The server imports
the game's own data modules (`src/fish.js`, `src/gear.js`, `src/locations.js`)
to validate ids and weights.

Files:
- `server/index.js` — starts the app on `PORT` (default 8100)
- `server/app.js` — builds the Express app from a `db` (so tests can pass PGlite)
- `server/db.js` — `pg` pool from `DATABASE_URL`; exposes `query(text, params)`
- `server/migrate.js` + `server/migrations/NNN_*.sql` — ordered SQL, recorded in `schema_migrations`
- `server/auth.js` — signup, login, logout, sessions, rate limiting
- `server/saves.js` — map between the game's save object and the tables
- `server/stats.js` — public dam stats
- `server/validate.js` — checks input against the game data

## Tables

```
users          id bigserial PK, email text unique (stored lower-case),
               username text unique (case-insensitive, 3-20 chars [A-Za-z0-9_]),
               password_hash text, created_at, last_login_at
sessions       token_hash text PK (sha256 of the cookie token), user_id FK
               on delete cascade, created_at, expires_at (30 days), user_agent
player_state   user_id PK FK cascade, credits int >= 0, equipped_rod/line/reel/
               hook/lure text, drag real, location_id text, start_time text,
               settings jsonb, version int (bumped on every write), updated_at
player_gear    user_id FK cascade, kind text (rod|line|reel|hook|lure),
               item_id text, acquired_at; PK (user_id, kind, item_id)
catches        id uuid PK (made by the client, so resending is harmless),
               user_id FK cascade, species_id, location_id, weight_kg numeric(6,2),
               length_cm int, trophy bool, payout int, time_of_day text,
               caught_at timestamptz; indexes on (location_id, weight_kg desc),
               (user_id), (location_id, species_id)
```

The catch log (count, best weight, trophies per species) is worked out from
`catches`, not stored twice.

## API

All JSON. Login is an `httpOnly`, `SameSite=Lax` cookie (`Secure` behind HTTPS).

| Method | Path | Does |
|---|---|---|
| POST | `/api/auth/signup` | `{email, username, password, guestSave?}` → account + session. A guest's progress moves into the new account. |
| POST | `/api/auth/login` | `{login (email or username), password}` → session |
| POST | `/api/auth/logout` | ends this session |
| GET | `/api/me` | `{user: {username, email}, save, version}` |
| PUT | `/api/me/save` | `{save, baseVersion}` → `{version}`; `409 {save, version}` if another device saved first |
| POST | `/api/me/catches` | one catch `{id, speciesId, locationId, weightKg, lengthCm, trophy, payout, timeOfDay, caughtAt}`; same `id` twice = stored once |
| DELETE | `/api/me` | `{password}` → deletes the account and everything with it |
| GET | `/api/dams/stats` | every spot: total caught, biggest fish (species, kg, username, date) |
| GET | `/api/dams/:locationId/stats` | one spot: totals, record, per-species counts and bests |

Rules:
- Passwords at least 8 characters, hashed with bcrypt (cost 11).
- Login and signup: at most 10 tries per 15 minutes per IP and per account; then `429`.
- Errors are plain sentences the game can show ("That username is taken").
- Only usernames are ever public; emails appear only in `/api/me`.
- Validation: ids must exist in the game data; a catch's weight must be ≤ the
  species' trophy maximum; credits ≥ 0.
- Not in scope yet: server-side anti-cheat on credits (the client still
  reports credits). Noted for later.

## Syncing between devices

- Guests play exactly as v1 (save in the browser).
- Logged in: on start the game fetches `/api/me` and uses the server save.
- Any change (catch, buy, equip, drag, settings, spot) saves locally at once
  and is sent to the server, batched to at most one save call every 2 s.
- Catches are sent on their own, each with its own id, so they are never lost
  or doubled.
- Offline: calls wait in a queue in the browser and are sent when the
  connection returns ("Saved on this device — will sync" shows meanwhile).
- `409` (another device saved first): take the server's save, keep any gear
  either side owns, and re-send. Catches never conflict.

## Game changes (`src/`)

- `src/cloud.js` — API calls, the offline queue, sync status
- `src/accountPanel.js` — Log in / Sign up / Log out / Delete account screens
- Main menu: "Log in or sign up to save online" / "Signed in as <name>"
- Sign-up screen: POPIA privacy notice (what's kept, why, delete any time) and
  an "I agree" tick
- New Game spot cards: "Record: 12.4 kg Common Carp by nelius · 153 caught"
- Catch card: "New dam record!" when it beats the spot's record
- `main.js`: send each catch; call the batched save after every save change

## Testing

- `node --test server/test/` against PGlite: signup/login/logout, wrong
  password, duplicate email/username, rate limit, save round trip, 409
  conflict, catch sent twice stored once, dam stats and record holder, delete
  cascades, emails never in public responses.
- Existing game tests keep passing.
- On the server: `curl` health check through nginx, then sign up and play on
  two browsers and check both see the same save.

## Deploy

`tools/deploy-v2.sh` (run from the PC): push branch `v2` to GitHub, then over
SSH: `git pull`, `npm ci --omit=dev`, `node server/migrate.js`, restart
`dam-angler-api`. The nginx site, systemd unit and tunnel route are set up
once.
