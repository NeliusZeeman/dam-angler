import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../migrate.js';
import { wrapPglite } from './helpers.js';

test('migrations create every table, and running them again changes nothing', async () => {
  const db = wrapPglite(new PGlite());
  const first = await migrate(db);
  assert.deepEqual(first, ['001_init.sql', '002_constraints.sql', '003_credit_log.sql']);
  const second = await migrate(db);
  assert.deepEqual(second, []);
  const tables = (await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  )).rows.map((r) => r.table_name);
  for (const t of ['catches', 'player_gear', 'player_state', 'schema_migrations', 'sessions', 'users']) {
    assert.ok(tables.includes(t), `${t} exists`);
  }
  await db.end();
});

test('emails and usernames are unique whatever their case', async () => {
  const db = wrapPglite(new PGlite());
  await migrate(db);
  const H = `$2a$11$${'a'.repeat(53)}`; // bcrypt-shaped (the table only takes hashes)
  await db.query("INSERT INTO users (email, username, password_hash) VALUES ('a@b.co', 'Nelius', $1)", [H]);
  await assert.rejects(db.query("INSERT INTO users (email, username, password_hash) VALUES ('A@B.CO', 'other', $1)", [H]));
  await assert.rejects(db.query("INSERT INTO users (email, username, password_hash) VALUES ('c@d.co', 'NELIUS', $1)", [H]));
  await db.end();
});
