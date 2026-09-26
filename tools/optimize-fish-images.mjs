// Shrinks the ChatGPT fish pictures for fast loading on phones.
//
//   node tools/optimize-fish-images.mjs            (or double-click "Optimize Fish Images.bat")
//
// For every assets/fish/*.png it writes a .webp next to it: 800px wide,
// transparent background kept, quality 78 -- typically 30-80 KB instead of
// the 2-3 MB PNG. The game loads the .webp and only falls back to the PNG
// if there's no .webp. Needs FFmpeg on the PATH (https://ffmpeg.org).

import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTH = Number(process.argv.find((a) => a.startsWith('--width='))?.split('=')[1]) || 800;
const QUALITY = Number(process.argv.find((a) => a.startsWith('--quality='))?.split('=')[1]) || 78;
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fish');

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('FFmpeg was not found. Install it from https://ffmpeg.org (or: winget install Gyan.FFmpeg) and try again.');
  process.exit(1);
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const pngs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
if (!pngs.length) {
  console.log(`No PNG pictures in ${dir} yet. Save the ChatGPT images there first.`);
  process.exit(0);
}

let before = 0, after = 0;
for (const png of pngs) {
  const src = join(dir, png);
  const out = src.replace(/\.png$/i, '.webp');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', src,
    // Never enlarge a smaller picture; keep the aspect ratio.
    '-vf', `scale='min(${WIDTH},iw)':-2`,
    '-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6', '-pix_fmt', 'yuva420p',
    out,
  ]);
  const a = statSync(src).size, b = statSync(out).size;
  before += a; after += b;
  console.log(`${png.padEnd(30)} ${kb(a).padStart(8)}  ->  ${kb(b).padStart(6)} webp`);
}
console.log(`\nDone: ${pngs.length} picture(s), ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller).`);
