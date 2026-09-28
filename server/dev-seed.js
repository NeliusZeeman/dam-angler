// Made-up players for trying the admin area locally (`npm run dev`): ~50
// anglers with catches over the last month, purchases, breadcrumbs, and one
// admin account whose login is written to server/dev-admin.txt (gitignored).
// Never used on the real server.
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUser } from './auth.js';
import { createPlayer, recordCatch, buyItem, spendCredits } from './saves.js';
import { setRole } from './admin.js';
import { FISH_SPECIES, randomWeightFor, trophyWeightFor } from '../src/fish.js';
import { LOCATIONS } from '../src/locations.js';

const FIRST = ['sipho', 'annemarie', 'thabo', 'johan', 'lerato', 'pieter', 'zanele', 'kobus', 'naledi', 'riaan',
  'ayesha', 'marius', 'bongani', 'elna', 'tshepo', 'hennie', 'nomsa', 'dewald', 'palesa', 'gerrit'];
const LAST = ['karp', 'bass', 'barbel', 'kurper', 'tiger', 'yellow', 'vlei', 'dam', 'rivier', 'hengel'];
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000);

// A small repeatable random generator, so the test data looks the same each run.
function seeded(seed = 7) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export async function seedDevData(db, { players = 50, adminFile = null } = {}) {
  const rnd = seeded();
  const species = new Map(FISH_SPECIES.map((s) => [s.id, s]));
  const used = new Set();
  for (let i = 0; i < players; i++) {
    let username;
    do { username = `${pick(FIRST, rnd)}_${pick(LAST, rnd)}${Math.floor(rnd() * 90) + 10}`; } while (used.has(username));
    used.add(username);
    const user = await createUser(db, { email: `${username.replace(/_/g, '.')}@example.co.za`, username, password: 'test-player-pass' });
    await createPlayer(db, user.id);
    const joined = 1 + rnd() * 60;
    const seen = rnd() < 0.3 ? rnd() * 0.9 : rnd() * Math.min(joined, 30);
    await db.query('UPDATE users SET created_at = $2, last_login_at = $3, last_seen_at = $3 WHERE id = $1', [user.id, daysAgo(joined), daysAgo(seen)]);
    const trips = Math.floor(rnd() ** 2 * 40);
    for (let t = 0; t < trips; t++) {
      const loc = pick(LOCATIONS, rnd);
      const sp = species.get(pick(loc.speciesIds, rnd));
      if (!sp) continue;
      const weightKg = rnd() < 0.01 ? trophyWeightFor(sp) : randomWeightFor(sp);
      await recordCatch(db, user.id, {
        id: randomUUID(), speciesId: sp.id, locationId: loc.id, weightKg: Math.min(weightKg, sp.maxWeightKg * 2.05),
        caughtAt: daysAgo(rnd() * Math.min(joined, 30)).toISOString(), timeOfDay: pick(['morning', 'midday', 'sunset', 'night'], rnd),
      });
    }
    for (const [kind, id] of [['lure', 'worm'], ['hook', 'hook-baitholder'], ['line', 'line-mono-12'], ['rod', 'rod-spinning']]) {
      if (rnd() < 0.5) { try { await buyItem(db, user.id, kind, id); } catch { /* not enough credits */ } }
    }
    if (rnd() < 0.4) { try { await spendCredits(db, user.id, 'chum'); } catch { /* not enough credits */ } }
  }
  // The admin you log in with locally.
  const password = randomBytes(9).toString('base64url');
  const admin = await createUser(db, { email: 'admin@example.co.za', username: 'dev_admin', password });
  await createPlayer(db, admin.id);
  await setRole(db, 'dev_admin', 'admin');
  // Plenty of credits for trying out all the tackle in the shop.
  await db.query('UPDATE player_state SET credits = $2 WHERE user_id = $1', [admin.id, DEV_ADMIN_CREDITS]);
  await db.query('INSERT INTO credit_log (user_id, amount, reason, ref) VALUES ($1, $2, $3, $4)', [admin.id, DEV_ADMIN_CREDITS, 'admin', 'local testing']);
  if (adminFile) {
    writeFileSync(adminFile, `Local test admin (made-up data, this PC only)\nusername: dev_admin\npassword: ${password}\nStarts with ${DEV_ADMIN_CREDITS.toLocaleString('en-ZA')} credits for testing tackle.\n`);
  }
  return { players, admin: 'dev_admin' };
}

export const DEV_ADMIN_CREDITS = 1_000_000;
export const DEV_ADMIN_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dev-admin.txt');
