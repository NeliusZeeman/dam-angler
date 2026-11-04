// Squashes the game's tiling scenery textures into KTX2 (Basis Universal
// UASTC + Zstandard). A phone's graphics chip reads these as they are
// (ASTC / ETC2 / BC7: one byte a pixel) instead of unpacking each JPG to
// four bytes a pixel, so the same pictures use a quarter of the memory and
// upload without the stall. The JPGs stay as the fallback.
//
//   cd tools/ktx && npm install      (once)
//   node tools/ktx/build-ktx2.mjs [nameFilter]
//
// Colour maps (_diff) are sRGB; normal maps get Basis' normal-map tuning;
// roughness maps are plain linear data.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'assets', 'scenery', 'textures');
const filter = process.argv[2] || '';

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

// Normal maps need UASTC (ETC1S blocks show as faceting in the lighting);
// colour and roughness look the same in ETC1S at a fraction of the download.
const RDO = Number(process.env.RDO || 2);
const ETC1S_Q = Number(process.env.Q || 255);
function optionsFor(name) {
  const colour = name.endsWith('_diff.jpg');
  const normal = name.endsWith('_nor.jpg');
  return {
    imageDecoder,
    isUASTC: normal && process.env.NORMAL !== 'etc1s',
    generateMipmap: true,
    needSupercompression: true,
    // Rate-distortion tuning: smaller files for a barely visible cost.
    enableRDO: normal,
    rdoQualityLevel: RDO,
    qualityLevel: ETC1S_Q,
    compressionLevel: 4,
    isPerceptual: colour,
    isSetKTX2SRGBTransferFunc: colour,
    isNormalMap: normal,
    // Stored the way TextureLoader shows a JPG (flipY), so UVs and normal-map
    // green match the fallback.
    isYFlip: true,
  };
}

const files = readdirSync(dir).filter((f) => /_(diff|nor|rough)\.jpg$/.test(f) && f.includes(filter));
let jpgBytes = 0, ktxBytes = 0;
for (const f of files) {
  const t0 = Date.now();
  const out = await encodeToKTX2(new Uint8Array(readFileSync(join(dir, f))), optionsFor(f));
  const target = f.replace(/\.jpg$/, '.ktx2');
  writeFileSync(join(dir, target), out);
  jpgBytes += statSync(join(dir, f)).size;
  ktxBytes += out.length;
  console.log(`${target}  ${Math.round(out.length / 1024)} KB  (${Date.now() - t0} ms)`);
}
console.log(`${files.length} textures: JPG ${Math.round(jpgBytes / 1024)} KB -> KTX2 ${Math.round(ktxBytes / 1024)} KB`);
