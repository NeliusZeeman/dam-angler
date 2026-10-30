// Renders the Tackle Box pictures in Blender from the gear models in
// art-source/gear (export those first: run tools/gear-export-server.mjs and
// open http://localhost:5191/tools/gear-export.html; it saves one model per
// item). Writes assets/gear/<kind>-<id>.webp.
//
//   node tools/build-gear-pictures.mjs [kind-id,kind-id]
//
// Needs Blender (set BLENDER to its blender.exe if it isn't in the usual place).

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = 'C:\\Program Files\\Blender Foundation';
  if (existsSync(base)) {
    for (const v of readdirSync(base).filter((d) => d.startsWith('Blender')).sort().reverse()) {
      const exe = join(base, v, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

const result = spawnSync(findBlender(), [
  '--background', '--factory-startup', '--python', join(root, 'tools', 'blender', 'render_gear.py'),
  '--', root, process.argv[2] || '',
], { stdio: 'inherit' });
process.exit(result.status ?? 1);
