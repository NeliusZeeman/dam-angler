// Writes version.json: a fingerprint of every game file, so browsers (phones
// especially, and web hosts) can never keep running an old copy.
//
//   node tools/stamp-version.mjs
//
// Runs automatically from "Start Game.bat" and on every git commit (see
// .githooks/pre-commit). index.html reads version.json first and loads each
// code file tagged with this version; the running game re-checks it every
// couple of minutes and offers to update when it changes.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Every module the browser loads (the loader tags each with the version).
const modules = [...walk(join(root, 'src')), ...walk(join(root, 'vendor'))]
  .filter((p) => p.endsWith('.js'))
  .map((p) => relative(root, p).split(sep).join('/'))
  .sort();
// Everything that makes up a release, for the fingerprint.
const fingerprinted = [...modules, 'index.html', 'src/style.css']
  .concat(existsSync(join(root, 'assets', 'fish')) ? readdirSync(join(root, 'assets', 'fish')).filter((f) => f.endsWith('.webp')).map((f) => `assets/fish/${f}`) : []);

const hash = createHash('sha1');
for (const f of fingerprinted) {
  hash.update(f);
  hash.update(readFileSync(join(root, f)));
}
const version = hash.digest('hex').slice(0, 10);

const file = join(root, 'version.json');
let previous = null;
try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first run */ }
if (previous?.version === version) {
  console.log(`version.json already current (${version})`);
} else {
  const built = new Date().toISOString();
  writeFileSync(file, `${JSON.stringify({ version, built, modules }, null, 2)}\n`);
  console.log(`version.json -> ${version} (${modules.length} modules)`);
}
