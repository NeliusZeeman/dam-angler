// Rebuilds the boats (assets/scenery/models/boat-<kind>.glb) in Blender
// from tools/blender/build_boats.py: modelled from scratch, shading baked
// in Cycles. Optional: which kinds, and a folder for preview renders.
//
//   node tools/build-boats.mjs [bass,tiger,...] [preview folder]
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

const args = ['--background', '--factory-startup', '--python', join(root, 'tools', 'blender', 'build_boats.py'), '--', root,
  process.argv[2] || '', ...(process.argv[3] ? [process.argv[3]] : [])];
process.exit(spawnSync(findBlender(), args, { stdio: 'inherit' }).status ?? 1);
