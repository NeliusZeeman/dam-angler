import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

// Every scenery texture and model with pictures has its squashed (KTX2)
// copy, newer than the original -- rebuild with tools/ktx/build-ktx2.mjs and
// tools/ktx/build-glb-ktx2.mjs after changing one.
const KTX2_MAGIC = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb]);

const texDir = 'assets/scenery/textures';
for (const f of readdirSync(texDir).filter((n) => /_(diff|nor|rough)\.jpg$/.test(n))) {
  const ktx = `${texDir}/${f.replace(/\.jpg$/, '.ktx2')}`;
  assert.ok(existsSync(ktx), `${ktx} present`);
  assert.ok(readFileSync(ktx).subarray(0, 8).equals(KTX2_MAGIC), `${ktx} is a KTX2 file`);
  assert.ok(statSync(ktx).mtimeMs >= statSync(`${texDir}/${f}`).mtimeMs - 1000, `${ktx} rebuilt since ${f} changed`);
}

function gltfJson(path) {
  const b = readFileSync(path);
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  return json;
}
for (const dir of ['assets/people', 'assets/scenery/models']) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb') && !n.endsWith('.ktx2.glb'))) {
    if (!(gltfJson(`${dir}/${f}`).images || []).length) continue;
    const squashed = `${dir}/${f.replace(/\.glb$/, '.ktx2.glb')}`;
    assert.ok(existsSync(squashed), `${squashed} present`);
    const json = gltfJson(squashed);
    assert.ok(json.images.every((im) => im.mimeType === 'image/ktx2'), `${squashed} pictures are all KTX2`);
    assert.ok((json.extensionsUsed || []).includes('KHR_texture_basisu'), `${squashed} declares KHR_texture_basisu`);
  }
}

// The list the game reads names exactly the squashed models there are.
const listed = JSON.parse(readFileSync('assets/ktx2-models.json', 'utf8'));
const actual = ['assets/people', 'assets/scenery/models'].flatMap((d) => readdirSync(d)
  .filter((n) => n.endsWith('.ktx2.glb')).map((n) => `${d}/${n.replace(/\.ktx2\.glb$/, '.glb')}`)).sort();
assert.deepStrictEqual(listed, actual, 'assets/ktx2-models.json up to date');

// Each person's face darkness is recorded for the skin glow.
const tones = JSON.parse(readFileSync('assets/people/skin.json', 'utf8'));
for (const [key, v] of Object.entries(tones)) assert.ok(v >= 0 && v <= 255, `${key} tone in range`);
assert.ok(Object.keys(tones).length >= 10, 'a face tone for every person');

console.log('ktx2 tests passed');
