// Squashed copies of the game's model files: each picture inside a .glb
// becomes KTX2 (KHR_texture_basisu), written beside it as <name>.ktx2.glb.
// The game loads those where the graphics chip reads compressed textures
// and the plain .glb everywhere else.
//
//   cd tools/ktx && npm install      (once)
//   node tools/ktx/build-glb-ktx2.mjs [nameFilter]
//
// Normal maps are UASTC (ETC1S blocks show as faceting in the lighting);
// colour, roughness and the rest ETC1S. Also writes assets/people/skin.json:
// how dark each person's face picture is, which people.js used to measure
// from the picture itself (a squashed picture can't be read back).

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const filter = process.argv[2] || '';
// DIR=people or DIR=models does just one folder (to run two at once).
const DIRS = ['assets/people', 'assets/scenery/models'].filter((d) => !process.env.DIR || d.endsWith(process.env.DIR));

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

const base = { imageDecoder, generateMipmap: true, needSupercompression: true };
// Models are seen from metres away, so even their normal maps are ETC1S:
// UASTC took minutes per 2048 px picture and doubled the download.
const PASSES = [
  { ...base, slots: /^normalTexture$/, isUASTC: false, qualityLevel: 255, compressionLevel: 4, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  { ...base, slots: /^(baseColorTexture|emissiveTexture)$/, isUASTC: false, qualityLevel: 255, compressionLevel: 4, isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  { ...base, slots: /./, isUASTC: false, qualityLevel: 255, compressionLevel: 4, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
];

// Average brightness (0-255) of a picture, from a 32 px copy -- what
// people.js skinGlow() measures.
async function brightness(image) {
  const { data } = await sharp(image).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const skin = {};
let before = 0, after = 0;
for (const dir of DIRS) {
  for (const f of readdirSync(join(root, dir))) {
    if (!f.endsWith('.glb') || f.endsWith('.ktx2.glb') || f === 'motions.glb' || !f.includes(filter)) continue;
    const t0 = Date.now();
    const src = join(root, dir, f);
    // Already squashed since the model last changed (FORCE=1 redoes it).
    const done = src.replace(/\.glb$/, '.ktx2.glb');
    if (!process.env.FORCE && existsSync(done) && statSync(done).mtimeMs >= statSync(src).mtimeMs) continue;
    const doc = await io.read(src);
    if (!doc.getRoot().listTextures().length) continue;
    for (const pass of PASSES) await doc.transform(ktx2(pass));
    const out = src.replace(/\.glb$/, '.ktx2.glb');
    await io.write(out, doc);
    before += statSync(src).size;
    after += statSync(out).size;
    console.log(`${dir}/${f.replace(/\.glb$/, '.ktx2.glb')}  ${Math.round(statSync(src).size / 1024)} -> ${Math.round(statSync(out).size / 1024)} KB  (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
}
// Every person's face, measured from the plain files each run (quick).
for (const f of readdirSync(join(root, 'assets/people')).filter((n) => n.endsWith('.glb') && !n.endsWith('.ktx2.glb') && n !== 'motions.glb')) {
  const doc = await io.read(join(root, 'assets/people', f));
  for (const m of doc.getRoot().listMaterials()) {
    const tex = m.getBaseColorTexture();
    if (/-head$/.test(m.getName()) && tex?.getImage()) skin[`${f.replace(/\.glb$/, '')}/${m.getName()}`] = Math.round(await brightness(tex.getImage()));
  }
}
writeFileSync(join(root, 'assets/people/skin.json'), JSON.stringify(skin, null, 1) + '\n');
// Which models have a squashed copy (gfx/ktx2.js asks only for those; a
// model with no pictures, like the vertex-coloured people, has none).
const list = ['assets/people', 'assets/scenery/models'].flatMap((d) => readdirSync(join(root, d))
  .filter((n) => n.endsWith('.ktx2.glb')).map((n) => `${d}/${n.replace(/\.ktx2\.glb$/, '.glb')}`)).sort();
writeFileSync(join(root, 'assets/ktx2-models.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`Models: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
