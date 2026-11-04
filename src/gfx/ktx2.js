import * as THREE from '../../vendor/three.module.js';
import { assetTag } from '../versionCheck.js';

// Squashed textures (tools/ktx/): KTX2 files the graphics chip keeps
// compressed -- a quarter of the memory of an unpacked JPG or WebP, and no
// stall while a big picture is unpacked. Used only when the chip reads one
// of the compressed formats and a test picture of each kind loads and
// uploads; otherwise everything loads the plain files.

let loader = null;
let pending = null;
let squashedModels = new Set(); // model paths with a .ktx2.glb copy

// The KTX2Loader for this device, or null. `renderer` is the renderer the
// game will draw with (WebGL or WebGPU), so the formats are that chip's.
export function compressedLoader(renderer = null) {
  pending ||= make(renderer);
  return pending;
}

// The loader if it is already known (null while loading or not supported).
export const ktx2Loader = () => loader;

// Test pictures, one of each squashing (both are loaded for every dam).
const PROBES = ['assets/scenery/textures/rock_rough.ktx2', 'assets/scenery/textures/rock_nor.ktx2'];

async function make(renderer) {
  let l = null;
  try {
    const support = renderer || webglFormats();
    if (!support) return null;
    const { KTX2Loader } = await import('../../vendor/addons/loaders/KTX2Loader.js');
    l = new KTX2Loader().setTranscoderPath('vendor/addons/libs/basis/').detectSupport(support);
    const c = l.workerConfig;
    if (!(c.astcSupported || c.etc2Supported || c.etc1Supported || c.dxtSupported || c.bptcSupported)) throw new Error('no compressed format');
    // Start the unpacking worker from its own file, not the blob: address
    // KTX2Loader would use: a blob worker inherits the page's security
    // policy, which forbids the function-making the Basis transcoder does
    // at start-up, and hung (tools/ktx/build-ktx2-worker.mjs).
    await l.init();
    l.workerPool.setWorkerCreator(() => {
      const worker = new Worker(`vendor/addons/libs/basis/ktx2-worker.js${assetTag()}`);
      const transcoderBinary = l.transcoderBinary.slice(0);
      worker.postMessage({ type: 'init', config: l.workerConfig, transcoderBinary }, [transcoderBinary]);
      return worker;
    });
    // Unpack the test pictures and hand them to the chip: a blocked
    // WebAssembly unpacker or a format the chip refuses shows up here,
    // instead of as blank white leaves and people later.
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('test picture timed out')), 8000));
    const probes = await Promise.race([Promise.all(PROBES.map((p) => l.loadAsync(`${p}${assetTag()}`))), timeout]);
    for (const t of probes) {
      if (!t.isCompressedTexture || !t.mipmaps?.[0]?.data?.byteLength) throw new Error('test picture empty');
      // Draw it and read the pixels back: a chip can take a squashed picture
      // without complaint and still show nothing (WebGPU reports such errors
      // only later), which is the white trees and people.
      if (renderer && !(await shows(renderer, t))) throw new Error('graphics chip draws the test picture blank');
      t.dispose();
    }
    const list = await fetch(`assets/ktx2-models.json${assetTag()}`).then((r) => r.json()).catch(() => []);
    squashedModels = new Set(list);
    loader = l;
  } catch (err) {
    console.warn('Squashed textures off, using plain files:', err?.message || err);
    l?.dispose();
    loader = null;
  }
  return loader;
}

// True if `texture` drawn on a little square off-screen comes out with any
// colour (both test pictures are grey or blue-ish, never black).
async function shows(renderer, texture) {
  const target = new THREE.WebGLRenderTarget(4, 4);
  const scene = new THREE.Scene();
  const square = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(square);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    let px = new Uint8Array(4 * 4 * 4);
    if (renderer.isWebGPURenderer) px = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 4, 4);
    else renderer.readRenderTargetPixels(target, 0, 0, 4, 4, px);
    let brightest = 0;
    for (let i = 0; i < px.length; i += 4) brightest = Math.max(brightest, px[i], px[i + 1], px[i + 2]);
    return brightest > 12;
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    square.geometry.dispose();
    square.material.dispose();
  }
}

// Without a renderer (tool pages), ask a throwaway context which
// compressed formats this chip reads.
function webglFormats() {
  const gl = document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance' });
  if (!gl) return null;
  const found = new Set(gl.getSupportedExtensions() || []);
  const profiles = gl.getExtension('WEBGL_compressed_texture_astc')?.getSupportedProfiles() || [];
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return {
    extensions: {
      has: (name) => found.has(name),
      get: () => ({ getSupportedProfiles: () => profiles }),
    },
  };
}

// Hands the KTX2 loader to a GLTFLoader so it can open squashed models.
export function withKtx2(gltfLoader) {
  if (loader) gltfLoader.setKTX2Loader(loader);
  return gltfLoader;
}

// True if every picture the file asks for came through (GLTFLoader carries
// on without a picture that fails, which would leave it plain white).
function allPictures(gltf) {
  const wanted = (gltf.parser.json.materials || []).filter((m) => m.pbrMetallicRoughness?.baseColorTexture).length;
  const got = new Set();
  gltf.scene.traverse((o) => {
    for (const m of [o.material].flat()) if (m?.map) got.add(m.name || m.uuid);
  });
  return got.size >= wanted;
}

// Loads a model: its squashed copy (<name>.ktx2.glb) when compressed
// textures are on, the plain .glb otherwise, or if that copy fails or
// loses any of its pictures. `tag` is the version query (assetTag()).
export async function loadGltf(gltfLoader, path, tag = '') {
  if (loader && squashedModels.has(path)) {
    try {
      const gltf = await gltfLoader.loadAsync(`${path.replace(/\.glb$/, '.ktx2.glb')}${tag}`);
      if (allPictures(gltf)) return gltf;
      console.warn('Squashed model lost pictures, using plain:', path);
    } catch (err) {
      console.warn('Squashed model failed, using plain:', path, err?.message || err);
    }
  }
  return gltfLoader.loadAsync(`${path}${tag}`);
}
