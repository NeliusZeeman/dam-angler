import * as THREE from '../vendor/three.module.js';
import { assetTag } from './versionCheck.js';

// Photo-scanned scenery from Poly Haven (CC0), prepared in Blender by
// tools/build-scenery.mjs: tiling textures for the ground, bark and jetty
// planks, and real models -- boulders, bushes, stumps, logs and camp gear.
// Loaded before a game starts (not on Low); every user falls back to the
// game's own painted textures and built shapes when a file is missing.

const textures = new Map(); // key -> { map, normalMap, roughnessMap }
const models = new Map(); // key -> [variant, ...]
let gltfLoader = null;
const texLoader = new THREE.TextureLoader();

function loadTex(url, srgb) {
  return new Promise((resolve, reject) => {
    texLoader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      resolve(t);
    }, undefined, reject);
  });
}

async function loadTextureSet(key) {
  if (textures.has(key)) return;
  const base = `assets/scenery/textures/${key}`;
  const tag = assetTag();
  const [map, normalMap, roughnessMap] = await Promise.all([
    loadTex(`${base}_diff.jpg${tag}`, true), loadTex(`${base}_nor.jpg${tag}`, false), loadTex(`${base}_rough.jpg${tag}`, false),
  ]);
  textures.set(key, { map, normalMap, roughnessMap });
}

// Each top-level object in a model file is one variant (a file of bushes
// holds several different bushes). Each is moved to stand at the origin,
// its parts' transforms baked in, so it can be planted anywhere.
function variantsOf(gltf, whole) {
  const out = [];
  gltf.scene.updateMatrixWorld(true);
  // A piece of camp gear is one thing however many parts its file has.
  for (const node of whole ? [gltf.scene] : gltf.scene.children) {
    const parts = [];
    const box = new THREE.Box3();
    node.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geometry.computeBoundingBox();
      box.union(geometry.boundingBox);
      parts.push({ geometry, material: prepareMaterial(o.material) });
    });
    if (!parts.length) continue;
    const centre = box.getCenter(new THREE.Vector3());
    for (const p of parts) p.geometry.translate(-centre.x, -box.min.y, -centre.z);
    out.push({ parts, size: box.getSize(new THREE.Vector3()) });
  }
  return out;
}

// See-through leaves are cut out (alpha test) rather than blended, so the
// bushes sort correctly and cast leafy shadows.
function prepareMaterial(m) {
  // Files with no material of their own (the people: vertex colours only)
  // get glTF's default, which is bare metal.
  if (!m.map && m.metalness === 1) {
    m.metalness = 0;
    m.roughness = 0.8;
  }
  if (m.transparent || m.alphaTest > 0) {
    m.transparent = false;
    m.alphaTest = 0.5;
    m.side = THREE.DoubleSide;
  }
  return m;
}

async function loadModel(key) {
  if (models.has(key)) return;
  if (!gltfLoader) {
    const { GLTFLoader } = await import('../vendor/addons/loaders/GLTFLoader.js');
    gltfLoader = new GLTFLoader();
  }
  const gltf = await gltfLoader.loadAsync(`assets/scenery/models/${key}.glb${assetTag()}`);
  models.set(key, variantsOf(gltf, WHOLE.has(key)));
}

const WHOLE = new Set(['chair', 'picnicTable', 'braaiDrum', 'crate', 'bucket', 'lantern']);

export const SCENERY_MODELS = [
  'boulderA', 'boulderB', 'boulderC', 'rockSmall', 'stones', 'bushRooibos', 'shrubA', 'shrubB', 'weed',
  'stump', 'deadTrunk', 'branches', 'chair', 'picnicTable', 'braaiDrum', 'crate', 'bucket', 'lantern',
  // Made in Blender from scratch (tools/blender/build_people.py).
  'personSit', 'personStand', 'personRod',
];

// Which ground, soil and bark this water needs.
export function textureKeysFor(location) {
  return [groundSetFor(location).grass, groundSetFor(location).soil, 'rock', 'barkGum', 'barkWillow', 'planks'];
}

// Lush coastal and subtropical grass in KwaZulu-Natal and the Lowveld, dry
// tufts in the Karoo and Northern Cape, Highveld veld elsewhere; red soil at
// Loskop and the Lowveld, dry mud on the silty Vaal and Free State dams.
export function groundSetFor(location) {
  const region = `${location?.province || ''} ${location?.region || ''}`;
  const id = location?.id || '';
  const lush = /kwazulu|kzn|lowveld|limpopo|mpumalanga/i.test(region) || /jozini|albert|midmar/.test(id);
  const dry = /karoo|northern cape|eastern cape|western cape/i.test(region);
  const red = /loskop|red/i.test(id) || location?.scenery?.ground?.red;
  const silty = /vaal|free state|bloemhof|allemans/i.test(region + ' ' + id);
  return {
    grass: lush ? 'grassLush' : dry ? 'grassDry' : 'grass',
    soil: red ? 'redSoil' : silty ? 'mudDry' : 'sand',
  };
}

// Loads what this water needs; gives up quietly after `timeoutMs`.
export async function loadScenery(location, timeoutMs = 10000) {
  const jobs = [
    ...textureKeysFor(location).map((k) => loadTextureSet(k)),
    ...SCENERY_MODELS.map((k) => loadModel(k)),
  ].map((p) => p.catch((err) => console.warn('Scenery file not loaded:', err?.message || err)));
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, timeoutMs))]);
}

export function scanTexture(key) {
  return textures.get(key) || null;
}

export function scanModel(key) {
  return models.get(key) || null;
}

// Plants many copies of one variant: one instanced mesh per part, per 32 m
// patch of ground, so patches out of view aren't drawn.
// `placements` are { x, y, z, rotY, scale, tilt? }.
const dummy = new THREE.Object3D();
const PATCH = 32;
export function plantVariant(scene, variant, placements, options = {}) {
  const patches = new Map();
  for (const p of placements) {
    const key = `${Math.floor(p.x / PATCH)},${Math.floor(p.z / PATCH)}`;
    if (!patches.has(key)) patches.set(key, []);
    patches.get(key).push(p);
  }
  return [...patches.values()].flatMap((list) => plantPatch(scene, variant, list, options));
}

function plantPatch(scene, variant, placements, { castShadow = true, receiveShadow = true } = {}) {
  const meshes = [];
  if (!placements.length) return meshes;
  for (const part of variant.parts) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.tiltX || 0, p.rotY || 0, p.tiltZ || 0);
      dummy.scale.setScalar(p.scale || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

// One copy of a variant as an ordinary group (camp gear, a single boulder).
export function variantObject(variant) {
  const group = new THREE.Group();
  for (const part of variant.parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
