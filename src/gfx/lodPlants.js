import * as THREE from '../../vendor/three.module.js';
import { GPU } from './gpu.js';
import { lodModel } from '../sceneryAssets.js';

// Plants Blender models that come at three levels of detail (the trees and
// the reeds; sceneryAssets.js lodModel). Every plant of a kind and shape is
// an instance of the same model, drawn at one level by its distance from
// you: lod0 within `lod.near` metres, lod1 to `lod.mid`, lod2 (pictures on
// crossed cards) beyond. Who is at which level is worked out a few times a
// second, or straight away when you move a couple of metres.
//
// planted: kind -> variant index -> [{ x, y, z, h, rotY, tiltX? }], h = height
//   in metres (the models are 1 unit tall).
// look(kind, variant, part, level) -> { material, depth?, castShadow, receiveShadow }
const dummy = new THREE.Object3D();

export function plantLods(scene, planted, { lod, look }) {
  const sets = [];
  for (const [kind, byVariant] of Object.entries(planted)) {
    const model = lodModel(kind);
    byVariant.forEach((list, v) => {
      if (!list?.length) return;
      const matrices = list.map((t) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(t.tiltX || 0, t.rotY, 0);
        dummy.scale.setScalar(t.h);
        dummy.updateMatrix();
        return dummy.matrix.clone();
      });
      const levels = model[v].lods.map((parts, level) => Object.entries(parts).map(([part, { geometry }]) => {
        const { material, depth, castShadow, receiveShadow } = look(kind, v, part, level);
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        mesh.count = 0;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.frustumCulled = false;
        if (depth) mesh.customDepthMaterial = depth;
        if (GPU.on) {
          // WebGPU wind reads each instance's root and height (wind.js).
          mesh.userData.root = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 4), 4);
          geometry.setAttribute('aRoot', mesh.userData.root);
        }
        scene.add(mesh);
        return mesh;
      }));
      sets.push({ list, matrices, levels });
    });
  }

  let last = null;
  let wait = 0;
  function update(camera, delta = 0.25) {
    wait -= delta;
    const p = camera.position;
    if (wait > 0 && last && last.distanceToSquared(p) < 4) return;
    wait = 0.3;
    (last ||= new THREE.Vector3()).copy(p);
    const near2 = lod.near * lod.near, mid2 = lod.mid * lod.mid;
    for (const set of sets) {
      for (const meshes of set.levels) for (const m of meshes) m.count = 0;
      set.list.forEach((t, i) => {
        const d2 = (t.x - p.x) ** 2 + (t.z - p.z) ** 2;
        const level = d2 < near2 ? 0 : d2 < mid2 ? 1 : 2;
        for (const m of set.levels[level]) {
          const k = m.count++;
          m.setMatrixAt(k, set.matrices[i]);
          if (m.userData.root) m.userData.root.array.set([t.x, t.y, t.z, t.h], k * 4);
        }
      });
      for (const meshes of set.levels) {
        for (const m of meshes) {
          m.instanceMatrix.needsUpdate = true;
          if (m.userData.root) m.userData.root.needsUpdate = true;
        }
      }
    }
  }
  return { update, count: () => sets.reduce((n, s) => n + s.list.length, 0) };
}

// Far cards are lit as if facing mostly up, so they don't go dark when the
// sun is high and the cards stand edge-on to it.
export function liftNormals(geometry) {
  const n = geometry.attributes.normal;
  if (geometry.userData.lifted) return;
  geometry.userData.lifted = true;
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i).multiplyScalar(0.45);
    v.y += 1;
    v.normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}
