// Runs every game test file (test/*.test.js) and fails if any does.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let failed = 0;
for (const f of readdirSync('test').filter((n) => n.endsWith('.test.js')).sort()) {
  const r = spawnSync(process.execPath, [`test/${f}`], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; console.log(`FAIL ${f}\n${(r.stdout + r.stderr).split('\n').slice(-8).join('\n')}`); }
}
console.log(failed ? `${failed} game test file(s) failed` : 'All game tests passed.');
process.exit(failed ? 1 : 0);
