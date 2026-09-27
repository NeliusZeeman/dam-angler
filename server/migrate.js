// Applies server/migrations/NNN_*.sql in order, once each, recording them in
// schema_migrations. Safe to run on every deploy.
//   node --env-file=server/.env server/migrate.js
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(DIR)).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(DIR, file), 'utf8');
    const run = async (tx) => {
      await (tx.exec ? tx.exec(sql) : tx.query(sql));
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    };
    if (db.transaction) await db.transaction(run);
    else await run(db);
    applied.push(file);
  }
  return applied;
}

// Run directly: migrate the database in DATABASE_URL.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { createPgDb } = await import('./db.js');
  const db = createPgDb(process.env.DATABASE_URL);
  try {
    const applied = await migrate(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
  } finally {
    await db.end();
  }
}
