// Production entry point (systemd runs `npm start`): API on 127.0.0.1:PORT
// behind nginx, talking to Postgres at DATABASE_URL (from server/.env).
import { createPgDb } from './db.js';
import { createApp, DEFAULT_INDEX } from './app.js';
import { deleteExpiredSessions } from './auth.js';
import { migrate } from './migrate.js';

const db = createPgDb(process.env.DATABASE_URL);
await migrate(db);
const port = Number(process.env.PORT) || 8100;
const host = process.env.HOST || '127.0.0.1';
const app = createApp({ db, secureCookies: process.env.SECURE_COOKIES !== 'false', indexFile: DEFAULT_INDEX });
// Clear out expired logins every hour.
setInterval(() => deleteExpiredSessions(db).catch((e) => console.error(e)), 60 * 60 * 1000).unref();
app.listen(port, host, () => console.log(`Dam Angler API on http://${host}:${port}`));
