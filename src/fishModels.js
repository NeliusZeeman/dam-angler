import { assetTag } from './versionCheck.js';

// The fish modelled in Blender (assets/fish3d/<species>.glb, made by
// tools/build-fish-models.mjs). Loaded for the dam's own species before a
// game starts; createFishMesh (fish3d.js) uses them when they're here and
// falls back to its own hand-built fish when they aren't (low graphics, an
// old browser, a file that didn't arrive).

const models = new Map(); // speciesId -> { body, bodyLow, fins, eyes, extras }
let loader = null;

async function loadOne(speciesId) {
  if (models.has(speciesId)) return;
  if (!loader) {
    // Imported here, not up top, so the game's tests (in Node) never load it.
    const { GLTFLoader } = await import('../vendor/addons/loaders/GLTFLoader.js');
    loader = new GLTFLoader();
  }
  const gltf = await loader.loadAsync(`assets/fish3d/${speciesId}.glb${assetTag()}`);
  const parts = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const key = { Body: 'body', BodyLow: 'bodyLow', Fins: 'fins', Eyes: 'eyes', Extras: 'extras' }[o.name];
    if (key) parts[key] = o.geometry;
  });
  if (parts.body && parts.fins) models.set(speciesId, parts);
}

// Loads these species' models; gives up quietly after `timeoutMs` so a slow
// connection never holds up the game (those fish use the built-in shapes).
export async function loadFishModels(speciesIds, timeoutMs = 8000) {
  const all = Promise.allSettled(speciesIds.map((id) => loadOne(id).catch((err) => {
    console.warn(`Fish model for ${id} not loaded:`, err?.message || err);
  })));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

export function fishModel(speciesId) {
  return models.get(speciesId) || null;
}
