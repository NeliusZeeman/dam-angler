import { makeRng, seedFromString } from './noise.js';
import { scanModel, plantVariant } from '../sceneryAssets.js';

// The bank's undergrowth from the photo-scanned models (sceneryAssets.js):
// rooibos and other shrubs back from the water, weeds along the edge, the
// odd stump, fallen log and scatter of dry branches. Nothing is added when
// the scans haven't loaded (Low graphics, or a slow connection).

export function createDressing(scene, { dam, terrain, location, exclude = () => false, density = 1 }) {
  const rng = makeRng(seedFromString(location.id + (location.pegId || '')) + 909);
  const beach = dam.spec.beachWidth;
  const all = (keys) => keys.flatMap((k) => scanModel(k) || []);
  const bushes = all(['shrubA']);
  const smallBushes = all(['bushRooibos', 'shrubB']);
  const weeds = all(['weed']);
  const stumps = all(['stump']);
  const logs = all(['deadTrunk']);
  const branches = all(['branches']);
  if (!bushes.length && !weeds.length) return null;

  const byVariant = new Map();
  // Weeds and twigs are too small to throw a shadow worth drawing.
  const noShadow = new Set([...weeds, ...branches]);
  function place(variants, x, z, scale, extra = {}) {
    if (!variants.length || exclude(x, z) || dam.isWater(x, z)) return;
    const v = variants[Math.floor(rng() * variants.length)];
    const list = byVariant.get(v) || [];
    list.push({ x, z, y: terrain.heightAt(x, z) - 0.03, rotY: rng() * Math.PI * 2, scale, ...extra });
    byVariant.set(v, list);
  }
  // A spot on the land, `fromBank`..`toBank` metres back from the water.
  function spot(fromBank, toBank, spread = 150) {
    const x = dam.spawn.x + (rng() - 0.5) * 2 * spread;
    const land = beach + fromBank + rng() * (toBank - fromBank);
    return { x, z: dam.shoreZ(x) - land, land };
  }

  // Shrubs in loose clumps, kept off the angler's own patch of bank.
  for (let i = 0; i < Math.round(70 * density); i++) {
    const c = spot(3, 80);
    if (Math.abs(c.x - dam.spawn.x) < 6 && c.land < beach + 12) continue;
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) place(bushes, c.x + (rng() - 0.5) * 3, c.z + (rng() - 0.5) * 3, 0.6 + rng() * 0.5);
  }
  // Low rooibos-type bushes scattered through the veld.
  for (let i = 0; i < Math.round(160 * density); i++) {
    const c = spot(1, 60, 120);
    place(smallBushes, c.x, c.z, 1.3 + rng() * 1.2);
  }
  // Weeds and small plants along the margin and in the grass.
  for (let i = 0; i < Math.round(220 * density); i++) {
    const c = spot(-0.5, rng() < 0.6 ? 6 : 40, 110);
    place(weeds, c.x, c.z, 1.6 + rng() * 1.8);
  }
  for (let i = 0; i < Math.round(7 * density); i++) {
    const c = spot(5, 60);
    place(stumps, c.x, c.z, 0.7 + rng() * 0.6);
  }
  // Fallen logs lie flat (the model already lies down) and a little sunk.
  for (let i = 0; i < Math.round(6 * density); i++) {
    const c = spot(2, 50);
    place(logs, c.x, c.z, 0.8 + rng() * 0.6);
  }
  for (let i = 0; i < Math.round(30 * density); i++) {
    const c = spot(0, 30, 90);
    place(branches, c.x, c.z, 0.8 + rng() * 0.8);
  }

  const meshes = [];
  for (const [variant, placements] of byVariant) meshes.push(...plantVariant(scene, variant, placements, { castShadow: !noShadow.has(variant) }));
  return { meshes };
}
