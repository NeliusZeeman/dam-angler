import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { TREE_KINDS, REED_KINDS } from '../src/sceneryAssets.js';

// Every Blender tree (tools/build-trees.mjs) has each shape at all three
// levels of detail, with the wind's sway values and its real size.
const PARTS = ['lod0_bark', 'lod0_leaves', 'lod1_bark', 'lod1_leaves', 'lod2_far'];
for (const kind of TREE_KINDS) {
  const b = readFileSync(`assets/scenery/models/tree-${kind}.glb`);
  assert.strictEqual(b.toString('ascii', 0, 4), 'glTF', `tree-${kind}.glb is a glTF binary`);
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const nodes = new Map(json.nodes.map((n) => [n.name, n]));
  for (const v of [0, 1]) {
    for (const part of PARTS) {
      const node = nodes.get(`${kind}${v}_${part}`);
      assert.ok(node, `${kind}${v}_${part} present`);
      const prim = json.meshes[node.mesh].primitives[0];
      assert.ok('_SWAY' in prim.attributes, `${kind}${v}_${part} has sway values`);
      // Baked soft shade on the near shapes (tools/blender/bake_light.py).
      if (!part.startsWith('lod2')) assert.ok('COLOR_0' in prim.attributes, `${kind}${v}_${part} has baked shade`);
      const h = node.extras?.height;
      const [lo, hi] = { acacia: [4, 10], gum: [12, 24], willow: [6, 12] }[kind];
      assert.ok(h >= lo && h <= hi, `${kind}${v} is ${h} m tall`);
      // Scaled to 1 unit tall.
      const max = json.accessors[prim.attributes.POSITION].max[1];
      assert.ok(max <= 1.01, `${kind}${v}_${part} fits 1 unit tall (${max})`);
    }
    // The near shape is the detailed one.
    const tris = (part) => json.accessors[json.meshes[nodes.get(`${kind}${v}_${part}`).mesh].primitives[0].indices].count / 3;
    assert.ok(tris('lod0_leaves') > tris('lod1_leaves') && tris('lod0_bark') > tris('lod1_bark'), `${kind}${v} lod1 is lighter`);
  }
}
// The Blender reeds (tools/build-reeds.mjs): both kinds, two clumps each,
// at three levels.
{
  const b = readFileSync('assets/scenery/models/reeds.glb');
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const nodes = new Map(json.nodes.map((n) => [n.name, n]));
  for (const kind of REED_KINDS) {
    for (const v of [0, 1]) {
      for (const part of ['lod0_plant', 'lod1_plant', 'lod2_far']) {
        const node = nodes.get(`${kind}${v}_${part}`);
        assert.ok(node, `${kind}${v}_${part} present`);
        const attrs = json.meshes[node.mesh].primitives[0].attributes;
        assert.ok('_SWAY' in attrs, `${kind}${v}_${part} sways`);
        if (part.endsWith('plant')) assert.ok('COLOR_0' in attrs, `${kind}${v}_${part} has baked shade`);
        const [lo, hi] = { typha: [1.2, 2.6], phragmites: [1.8, 3.6] }[kind];
        assert.ok(node.extras?.height >= lo && node.extras.height <= hi, `${kind}${v} is ${node.extras?.height} m tall`);
      }
    }
  }
}
console.log('tree and reed tests passed');
