// Rebuilds the campsite people and their motions (assets/people) from the
// Microsoft Rocketbox files in art-source/rocketbox (fetch them first:
// python tools/fetch-rocketbox.py), and the braai fire flipbook
// (assets/scenery/textures/fire-flipbook.webp), in Blender.
//
//   node tools/build-campers.mjs [names,motions | fire]
//
// Needs Blender (set BLENDER to its blender.exe if it isn't in the usual place).

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = 'C:/Program Files/Blender Foundation';
  if (existsSync(base)) {
    for (const v of readdirSync(base).filter((d) => d.startsWith('Blender')).sort().reverse()) {
      const exe = join(base, v, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

const only = process.argv[2] || '';
const run = (script, extra = '') => spawnSync(findBlender(), [
  '--background', '--factory-startup', '--python', join(root, 'tools', 'blender', script), '--', root, extra,
], { stdio: 'inherit' }).status ?? 1;

let status = 0;
if (only !== 'fire') status ||= run('build_campers.py', only);
if (!only || only === 'fire') status ||= run('build_fire.py');
process.exit(status);
