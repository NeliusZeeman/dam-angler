// Local test server: the whole game plus the API on http://localhost:5180,
// with an in-memory Postgres (PGlite) -- nothing to install, nothing kept.
//   npm run dev
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate.js';
import { createApp, DEFAULT_INDEX, DEFAULT_ADMIN } from './app.js';
import { seedDevData, DEV_ADMIN_FILE } from './dev-seed.js';
import { wrapPglite } from './test/helpers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = wrapPglite(new PGlite());
await migrate(db);
// Made-up players so every admin screen has something to show.
const seeded = await seedDevData(db, { adminFile: DEV_ADMIN_FILE });
console.log(`Made ${seeded.players} test players; admin login is in server/dev-admin.txt`);
const port = Number(process.env.PORT) || 5180;
createApp({ db, staticDir: root, indexFile: DEFAULT_INDEX, adminFile: DEFAULT_ADMIN }).listen(port, () => console.log(`Dam Angler dev: http://localhost:${port}  (admin: http://localhost:${port}/admin)`));
