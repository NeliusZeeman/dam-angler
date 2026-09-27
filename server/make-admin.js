// Makes an account an admin (or a player again). Command line only -- there
// is deliberately no way to do this from a web page.
//   node --env-file=server/.env server/make-admin.js <username>
//   node --env-file=server/.env server/make-admin.js <username> --remove
import { createPgDb } from './db.js';
import { migrate } from './migrate.js';
import { setRole } from './admin.js';

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.log('Usage: node --env-file=server/.env server/make-admin.js <username> [--remove]');
  process.exit(1);
}
const db = createPgDb(process.env.DATABASE_URL);
try {
  await migrate(db);
  const role = flag === '--remove' ? 'player' : 'admin';
  const ok = await setRole(db, username, role);
  console.log(ok ? `${username} is now ${role === 'admin' ? 'an admin' : 'a player'}.` : `No account called "${username}".`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await db.end();
}
