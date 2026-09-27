# Dam Angler — Admin area and player management (Part A)

**Status:** design approved in chat 2026-09-27.
**Branch/folder:** `v2` in `Game\Dam Angler V2`. Built and tested locally first
(`npm run dev`, made-up players), then deployed with `update_dam_angler.sh`.
**Next:** Part B (game tuning engine) adds its screens to this admin area.

## Goal

A private admin area at `angler.homeprojecthub.co.za/admin` where the owner
sees how the game is doing (players, activity, catches, records), looks up any
player, gives or takes credits with a reason, and deletes players — every
action recorded.

## Access: three locks

1. **Cloudflare Access** on `/admin*` and `/api/admin/*`: a one-time code sent to
   the owner's email before the page even loads. Configured by the owner in the
   Cloudflare Zero Trust dashboard (guided); not needed locally.
2. **Admin role:** `users.role` is `'player'` or `'admin'`. Only set from the
   server's command line: `node --env-file=server/.env server/make-admin.js <username>`
   (also `--remove`). No web path can grant it.
3. **Password re-check** for destructive actions: deleting a player, and credit
   changes larger than 10,000 in either direction.

Every `/api/admin/*` route requires a logged-in session whose user has
`role = 'admin'`; otherwise 403 (401 if not logged in). Rate-limited like the
rest of the API.

## Screens (`admin.html`, `src/admin/*.js`)

| Screen | Content |
|---|---|
| Dashboard | players total; new in last 7 days; active today / last 7 days (by `last_seen_at`); catches today / total; credits held by all players; top 10 biggest fish (species, kg, player, dam, date); catches per dam |
| Players | search by username or email (partial, case-insensitive); columns: username, email, joined, last seen, credits, fish caught, best fish; sort by any column; 50 per page |
| Player | account details; owned gear and current rig; drag and last spot; catches (newest first, 100 shown); credit history (newest first, 100 shown); buttons: give/take credits, delete |
| Give/take credits | amount (non-zero whole number, ±1,000,000 max), reason (3–200 characters, required); balance can't go below 0; recorded in `credit_log` (reason `admin`, ref = the reason text) and `admin_log` |
| Delete player | type the player's username + the admin's own password; removes the account and everything with it (cascade); recorded in `admin_log` with the deleted username |
| Admin log | newest first: when, which admin, action, target username, details |

Rules: admins cannot be deleted from the page; an admin cannot delete
themselves; the log is read-only.

## Database (migration 004)

- `users.role text NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin'))`
- `users.last_seen_at timestamptz` — updated at most once every 5 minutes per
  user by authenticated requests
- `credit_log.reason` also allows `'admin'`
- `admin_log (id, admin_id → users ON DELETE SET NULL, admin_username, action
  text CHECK IN ('credits','delete-player'), target_user_id bigint,
  target_username text, details jsonb, created_at)` — keeps usernames as text
  so entries survive deleted accounts

## API

| Method | Path | Returns / does |
|---|---|---|
| GET | `/api/admin/me` | `{ username }` if admin (the page checks this first) |
| GET | `/api/admin/overview` | dashboard numbers, top 10, per-dam totals |
| GET | `/api/admin/players?q=&sort=&dir=&page=` | `{ players, total, page }` |
| GET | `/api/admin/players/:id` | `{ player, gear, rig, catches, credits }` |
| POST | `/api/admin/players/:id/credits` | `{ amount, reason, password? }` → `{ credits }` |
| DELETE | `/api/admin/players/:id` | `{ confirmUsername, password }` → `{ ok }` |
| GET | `/api/admin/log?page=` | `{ entries, total, page }` |

`sort` is one of a fixed list (username, joined, lastSeen, credits, catches,
best); anything else falls back to `joined`. All inputs validated like the rest
of the API.

## Page and security

- `/admin` served by the API with its own per-visit CSP nonce (same as
  `index.html`); nginx sends `/admin` to the API.
- The admin page is plain HTML/JS/CSS with no libraries; all text inserted with
  `textContent` or escaped.
- `noindex` so search engines never list it.
- Works on PC, tablet and phone.

## Local testing

- `npm run dev` seeds ~50 made-up players with catches, purchases and credit
  history, plus an admin account whose login is written to
  `server/dev-admin.txt` (gitignored) — never shown in chat.
- Server tests (PGlite): non-admins get 403 on every admin route and 401 when
  logged out; role can't be set through any player route; overview numbers;
  search and sort; credits (limits, below-zero refused, reason required, logged
  in both logs, big changes need the password); delete (username + password
  required, admins and self refused, cascade, logged); emails only in admin
  responses.

## Deploy

1. Update the server as usual (migration 004 runs; nginx gets the `/admin` route).
2. On the server: `node --env-file=server/.env server/make-admin.js neliuszeeman`.
3. Owner adds a Cloudflare Access application for
   `angler.homeprojecthub.co.za/admin` and `/api/admin` (email one-time PIN,
   allow only the owner's email) — step-by-step guide provided.
