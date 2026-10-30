// The WebGPU graphics setting ("Ultra+"). Off, the game draws with WebGL
// and its own GLSL shaders exactly as before; on, every custom look (sky,
// mist, water, ground, swaying grass, fish, the net, the picture pipeline)
// is built from three.js node materials instead, which run on WebGPU.
//
// The WebGPU build of three.js is big (over 2 MB), so it's only fetched
// when this setting is picked and the browser can actually do WebGPU.

// `ready` once the WebGPU code is loaded; `on` while a game runs with it.
export const GPU = { on: false, ready: false, W: null, T: null, nodes: null, post: null };

// Whether this browser has a WebGPU graphics card to talk to at all.
export async function webgpuAvailable() {
  try {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

// Loads the WebGPU build and the node-material versions of the game's
// shaders. Returns false if anything is missing.
export async function loadGpu() {
  if (GPU.ready) return true;
  try {
    const [W, T] = await Promise.all([
      import('../../vendor/three.webgpu.js'),
      import('../../vendor/three.tsl.js'),
    ]);
    Object.assign(GPU, { W, T });
    const [nodes, post] = await Promise.all([import('./gpu/nodes.js'), import('./gpu/postGpu.js')]);
    Object.assign(GPU, { nodes, post, ready: true });
    return true;
  } catch (err) {
    console.warn('WebGPU graphics unavailable, using WebGL:', err);
    return false;
  }
}
