// Rebuilds the fish models (assets/fish3d/*.glb) in Blender.
//
//   node tools/build-fish-models.mjs [species,ids]
//
// Needs Blender installed (set BLENDER to its blender.exe if it isn't in the
// usual place). The shapes are made by tools/blender/build_fish.py from the
// game's own species looks (SPECIES_LOOK in src/fish3d.js).

import { writeFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SPECIES_LOOK } from '../src/fish3d.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = 'C:\\Program Files\\Blender Foundation';
  if (existsSync(base)) {
    const versions = readdirSync(base).filter((d) => d.startsWith('Blender')).sort().reverse();
    for (const v of versions) {
      const exe = join(base, v, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

const looksPath = join(mkdtempSync(join(tmpdir(), 'fish-')), 'looks.json');
writeFileSync(looksPath, JSON.stringify(SPECIES_LOOK));
const only = process.argv[2] || '';
const out = join(root, 'assets', 'fish3d');
const result = spawnSync(findBlender(), [
  '--background', '--factory-startup', '--python', join(root, 'tools', 'blender', 'build_fish.py'),
  '--', looksPath, out, only,
], { stdio: 'inherit' });
process.exit(result.status ?? 1);
