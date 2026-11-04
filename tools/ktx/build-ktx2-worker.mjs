// Writes vendor/addons/libs/basis/ktx2-worker.js: the same worker three.js's
// KTX2Loader assembles in the page (its constants, basis_transcoder.js and
// its worker function), saved as a real file.
//
// Why: KTX2Loader starts the worker from a blob: address, and a blob worker
// inherits the page's Content-Security-Policy. The Basis transcoder (built
// with Emscripten embind) creates functions at start-up, which the game's
// policy rightly forbids -- so the worker hung and every squashed texture
// failed. A worker loaded from its own file takes its policy from that
// file's response instead, while the page keeps its strict one.
// gfx/ktx2.js points KTX2Loader's worker pool at this file.
//
//   cd tools/ktx && npm install      (once)
//   node tools/ktx/build-ktx2-worker.mjs     (after updating three.js)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const basis = join(root, 'vendor', 'addons', 'libs', 'basis');
const jsContent = readFileSync(join(basis, 'basis_transcoder.js'), 'utf8');
const fn = KTX2Loader.BasisWorker.toString();
const body = [
  '/* KTX2Loader worker, saved as a file by tools/ktx/build-ktx2-worker.mjs */',
  '/* constants */',
  'let _EngineFormat = ' + JSON.stringify(KTX2Loader.EngineFormat),
  'let _EngineType = ' + JSON.stringify(KTX2Loader.EngineType),
  'let _TranscoderFormat = ' + JSON.stringify(KTX2Loader.TranscoderFormat),
  'let _BasisFormat = ' + JSON.stringify(KTX2Loader.BasisFormat),
  '/* basis_transcoder.js */',
  jsContent,
  '/* worker */',
  fn.substring(fn.indexOf('{') + 1, fn.lastIndexOf('}')),
].join('\n');
writeFileSync(join(basis, 'ktx2-worker.js'), body);
console.log(`ktx2-worker.js ${Math.round(body.length / 1024)} KB`);
