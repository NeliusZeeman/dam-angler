// The one thing the rest of the server needs from a database:
// `query(text, params) -> { rows }`, Postgres-style $1 placeholders.
// Production uses a pg connection pool; the tests hand in PGlite, which
// has the same query() shape.
import pg from 'pg';

// `schema`: the game's tables live in their own schema (default "angler"),
// which the app user can create itself -- Postgres 15+ no longer lets
// ordinary users create tables in "public".
export function createPgDb(connectionString, { schema = process.env.DB_SCHEMA || 'angler' } = {}) {
  if (!connectionString) throw new Error('DATABASE_URL is not set (see server/.env.example)');
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Bad DB_SCHEMA "${schema}"`);
  const pool = new pg.Pool({ connectionString, max: 10, options: `-c search_path=${schema}` });
  return {
    schema,
    query: (text, params) => pool.query(text, params),
    // Runs fn(tx) inside one transaction on a single connection.
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    end: () => pool.end(),
  };
}
