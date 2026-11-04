import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { TREE_KINDS } from '../src/sceneryAssets.js';

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
console.log('tree tests passed');
