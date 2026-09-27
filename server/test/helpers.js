// Tests run against PGlite: a real Postgres compiled to WebAssembly, in
// memory, so no database server is needed.
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../migrate.js';
import { createApp } from '../app.js';
import { createRateLimiter } from '../auth.js';

export function wrapPglite(pg) {
  return {
    query: (text, params) => pg.query(text, params),
    exec: (sql) => pg.exec(sql),
    transaction: (fn) => pg.transaction((tx) => fn({ query: (t, p) => tx.query(t, p), exec: (s) => tx.exec(s) })),
    end: () => pg.close(),
  };
}

export async function newTestDb() {
  const db = wrapPglite(new PGlite());
  await migrate(db);
  return db;
}

// Starts the app on a free port. Returns a small client that keeps the
// session cookie like a browser would.
export async function startTestServer(db, options = {}) {
  // Every test client comes from 127.0.0.1, so tests get a roomy limiter
  // unless they're testing the limit itself.
  const roomy = () => createRateLimiter({ limit: 100000 });
  const app = createApp({ db, limiter: roomy(), playLimiter: roomy(), saveLimiter: roomy(), publicLimiter: roomy(), ...options });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    close: () => new Promise((resolve) => server.close(resolve)),
    client: () => makeClient(base),
  };
}

function makeClient(base) {
  let cookie = '';
  async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: set };
  }
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b ?? {}),
    put: (p, b) => call('PUT', p, b ?? {}),
    del: (p, b) => call('DELETE', p, b ?? {}),
    get cookie() { return cookie; },
  };
}
