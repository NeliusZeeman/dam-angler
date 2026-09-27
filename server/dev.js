// Local test server: the whole game plus the API on http://localhost:5180,
// with an in-memory Postgres (PGlite) -- nothing to install, nothing kept.
//   npm run dev
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate.js';
import { createApp, DEFAULT_INDEX } from './app.js';
import { wrapPglite } from './test/helpers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = wrapPglite(new PGlite());
await migrate(db);
const port = Number(process.env.PORT) || 5180;
createApp({ db, staticDir: root, indexFile: DEFAULT_INDEX }).listen(port, () => console.log(`Dam Angler dev: http://localhost:${port}`));
