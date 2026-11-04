import { assetTag } from '../versionCheck.js';

// Squashed textures (tools/ktx/): KTX2 files the graphics chip keeps
// compressed -- a quarter of the memory of an unpacked JPG or WebP, and no
// stall while a big picture is unpacked. Used only when the chip reads one
// of the compressed formats; otherwise everything loads the plain files.

let loader = null;
let pending = null;
let squashedModels = new Set(); // model paths with a .ktx2.glb copy

// The KTX2Loader for this device, or null. `gpuRenderer` is the WebGPU
// renderer when there is one; on WebGL a throwaway context is asked.
export function compressedLoader(gpuRenderer = null) {
  pending ||= make(gpuRenderer);
  return pending;
}

// The loader if it is already known (null while loading or not supported).
export const ktx2Loader = () => loader;

async function make(gpuRenderer) {
  try {
    const support = gpuRenderer || webglFormats();
    if (!support) return null;
    const { KTX2Loader } = await import('../../vendor/addons/loaders/KTX2Loader.js');
    const l = new KTX2Loader().setTranscoderPath('vendor/addons/libs/basis/').detectSupport(support);
    const c = l.workerConfig;
    if (!(c.astcSupported || c.etc2Supported || c.etc1Supported || c.dxtSupported || c.bptcSupported)) {
      l.dispose();
      return null;
    }
    const list = await fetch(`assets/ktx2-models.json${assetTag()}`).then((r) => r.json()).catch(() => []);
    squashedModels = new Set(list);
    loader = l;
  } catch (err) {
    console.warn('Compressed textures unavailable:', err?.message || err);
  }
  return loader;
}

// The WebGL renderer is made after loading, so ask a throwaway context
// which compressed formats this chip reads.
function webglFormats() {
  const gl = document.createElement('canvas').getContext('webgl2');
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

// Loads a model: its squashed copy (<name>.ktx2.glb) when compressed
// textures are on, the plain .glb otherwise or if that copy fails.
// `tag` is the version query (assetTag()).
export async function loadGltf(gltfLoader, path, tag = '') {
  if (loader && squashedModels.has(path)) {
    try {
      return await gltfLoader.loadAsync(`${path.replace(/\.glb$/, '.ktx2.glb')}${tag}`);
    } catch (err) {
      console.warn('Squashed model failed, using plain:', path, err?.message || err);
    }
  }
  return gltfLoader.loadAsync(`${path}${tag}`);
}
