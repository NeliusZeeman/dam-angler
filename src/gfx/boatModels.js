import * as THREE from '../../vendor/three.module.js';
import { assetTag } from '../versionCheck.js';

// The Blender-made boats (tools/blender/build_boats.py): one file per kind,
// assets/scenery/models/boat-<kind>.glb, with ambient occlusion baked into
// the vertex colours. Each holds 'body', the moving 'prop' or 'paddle',
// and 'spot-<rod|sit|paddle>-<n>' markers where the crew go. Loaded before
// the game starts (not on Low); gfx/boats.js falls back to its built boats
// when a file is missing.

const files = new Map(); // kind -> glTF scene
const shiny = new Set(); // every boat material, for setBoatLight
let loader = null;

// Each boat in its own colour: metal-flake bass boats, painted aluminium
// tiger boats, bright plastic kayaks.
const PAINTS = {
  bass: [0x96161a, 0x1a3f8f, 0x16171b, 0x5d6168, 0x1d6b3a, 0x5a1f6e, 0xb8541a],
  tiger: [0x1c4628, 0x5b5a3c, 0x1e2f4f, 0x8c9096, 0x2d3a2a],
  ski: [0x143c8c, 0xa5161c, 0x16171b, 0xd0601a, 0x127070],
  kayak: [0xe6781a, 0xe8c21a, 0x6fbf2a, 0xc81e1e, 0x55603a, 0x2a8fd0],
  pontoon: [0x143c8c, 0x7a1c1c, 0x1d5a3a],
  houseboat: [0x1e5a46, 0x143c8c, 0x7a3a1c],
  yacht: [0x142a5a, 0x7a1c1c, 0x1d5a3a],
};

// A sky-and-water picture the shiny paint and chrome reflect.
let envMap = null;
function reflections() {
  if (envMap) return envMap;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#6f9fd8');
  grad.addColorStop(0.42, '#cfe0ee');
  grad.addColorStop(0.5, '#e8eef0');
  grad.addColorStop(0.53, '#5d6b5a');
  grad.addColorStop(0.62, '#2f4446');
  grad.addColorStop(1, '#1d2b2e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  envMap = new THREE.CanvasTexture(c);
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  envMap.colorSpace = THREE.SRGBColorSpace;
  return envMap;
}

export async function loadBoatModels(kinds = []) {
  const want = [...new Set(kinds)].filter((k) => PAINTS[k] && !files.has(k));
  if (!want.length) return;
  if (!loader) {
    const { GLTFLoader } = await import('../../vendor/addons/loaders/GLTFLoader.js');
    loader = new GLTFLoader();
  }
  await Promise.all(want.map(async (kind) => {
    try {
      const gltf = await loader.loadAsync(`assets/scenery/models/boat-${kind}.glb${assetTag()}`);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material;
        m.envMap = reflections();
        m.envMapIntensity = 0.8;
        shiny.add(m);
        if (m.transparent) o.castShadow = false; // glass
      });
      files.set(kind, gltf.scene);
    } catch (err) {
      console.warn('Boat model not loaded:', kind, err?.message || err);
    }
  }));
}

export function hasBoatModel(kind) {
  return files.has(kind);
}

// A copy of a boat (meshes shared), in its own paint. Returns the group,
// the moving parts and where the crew go, or null when not loaded.
export function boatModel(kind, rng = Math.random) {
  const src = files.get(kind);
  if (!src) return null;
  const group = src.clone(true);
  const colours = PAINTS[kind];
  const paint = new THREE.Color(colours[Math.floor(rng() * colours.length)]);
  const copies = new Map();
  let prop = null, paddle = null;
  const spots = [];
  group.traverse((o) => {
    if (o.isMesh && /^paint/.test(o.material.name)) {
      if (!copies.has(o.material)) {
        const m = o.material.clone();
        m.color.copy(paint);
        shiny.add(m);
        copies.set(o.material, m);
      }
      o.material = copies.get(o.material);
    }
    if (o.name === 'prop') prop = o;
    if (o.name === 'paddle') paddle = o;
    const s = /^spot-(\w+)-\d+$/.exec(o.name);
    if (s) spots.push({ kind: s[1], x: o.position.x, y: o.position.y, z: o.position.z, turn: o.rotation.y });
  });
    return { group, prop, paddle, spots };
}

// Dim the reflections at dusk and night (light: the sky light's strength).
export function setBoatLight(light) {
  const k = 0.8 * Math.max(0.05, Math.min(1, light / 0.8));
  for (const m of shiny) m.envMapIntensity = k;
}
