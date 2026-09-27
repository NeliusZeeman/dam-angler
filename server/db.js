// The one thing the rest of the server needs from a database:
// `query(text, params) -> { rows }`, Postgres-style $1 placeholders.
// Production uses a pg connection pool; the tests hand in PGlite, which
// has the same query() shape.
import pg from 'pg';

export function createPgDb(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is not set (see server/.env.example)');
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
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
