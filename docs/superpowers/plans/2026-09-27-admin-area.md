# Admin Area (Part A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locked-down `/admin` area: dashboard, player search/detail, give/take credits, delete players, admin log.

**Architecture:** New `server/admin.js` (queries + actions) mounted under `/api/admin` in `server/app.js` behind `requireAdmin`. The page is `admin.html` + `src/admin/admin.js` + `src/admin/admin.css`, served by the API with a per-visit CSP nonce (like `index.html`). Spec: `docs/superpowers/specs/2026-09-27-admin-area-design.md`.

**Tech Stack:** Node 22 / Express 5 / pg; PGlite for tests; plain browser JS (no libraries).

## Global Constraints

- Work in `Game\Dam Angler V2`, branch `v2`; local only in this plan (no deploy, no push).
- Every `/api/admin/*` route: 401 logged out, 403 non-admin.
- Role only settable by `server/make-admin.js` on the command line.
- Credits: whole number, non-zero, |amount| ≤ 1,000,000; reason 3–200 chars; never below 0; |amount| > 10,000 needs the admin's password.
- Delete: needs `confirmUsername` equal to the target's username and the admin's password; admins and self can't be deleted.
- All admin actions written to `admin_log`; credit changes also to `credit_log` (reason `admin`, ref = reason text).
- Emails only in admin responses. All page text via `textContent`/escaping. `noindex`.
- Metric units only; South African English copy.

---

### Task 1: Roles, last seen, admin log (migration 004) and make-admin

**Files:** Create `server/migrations/004_admin.sql`, `server/make-admin.js`, `server/test/admin-access.test.js`; modify `server/auth.js` (`userForToken` returns `role`, touches `last_seen_at` every 5 min), `server/app.js` (`requireAdmin`), `server/test/migrate.test.js`.

**Interfaces — produces:** `setRole(db, username, role) -> boolean`; `req.user.role`; middleware `requireAdmin`.

- [ ] Tests: logged-out 401 and player 403 on `/api/admin/me`; admin gets `{username}`; `setRole` promotes/demotes; signup/save can't set role; `last_seen_at` set on authenticated request.
- [ ] Implement; run `node --test "server/test/*.test.js"`; commit.

### Task 2: Admin API

**Files:** Create `server/admin.js`, `server/test/admin.test.js`; modify `server/app.js`.

**Interfaces — produces:** `overview(db)`, `listPlayers(db, {q, sort, dir, page})`, `playerDetail(db, id)`, `adjustCredits(db, admin, id, {amount, reason, password})`, `deletePlayer(db, admin, id, {confirmUsername, password})`, `adminLog(db, {page})`; routes per spec.

- [ ] Tests: overview numbers on seeded data; search partial/case-insensitive incl. email; sort whitelist; detail has gear/rig/catches/credit history; credits limits, reason, below-zero refused, >10,000 needs password, both logs written; delete needs username + password, refuses admins/self, cascades, logged; log paging.
- [ ] Implement; run tests; commit.

### Task 3: Admin page

**Files:** Create `admin.html`, `src/admin/admin.js`, `src/admin/admin.css`; modify `server/app.js` (serve `/admin` with nonce), `server/deploy/nginx-angler.conf` (`location = /admin` → API), `tools/stamp-version.mjs` only if needed.

- [ ] Screens: dashboard, players (search/sort/paging), player (details, credits form, delete form), admin log; phone-friendly.
- [ ] Browser check on `npm run dev` (desktop + phone size, no CSP violations); commit.

### Task 4: Local test data

**Files:** Create `server/dev-seed.js`; modify `server/dev.js`, `.gitignore` (`server/dev-admin.txt`).

- [ ] ~50 made-up players with catches, purchases, credits; one admin whose login is written to `server/dev-admin.txt`.
- [ ] Run everything; commit.
