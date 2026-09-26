import * as THREE from '../../vendor/three.module.js';
import { makeRng, seedFromString } from './noise.js';
import { addWindToMaterial } from './wind.js';


// A single blade, 1 unit tall: tapered, curving slightly forward, dark at
// the root and bright at the tip. Normals lean up so blades light like a
// soft lawn instead of flickering black on their backs.
function bladeGeometry() {
  const LEVELS = 4;
  const pos = [], col = [], nor = [], idx = [];
  for (let k = 0; k <= LEVELS; k++) {
    const y = k / LEVELS;
    const half = 0.5 * Math.pow(1 - y, 0.9);
    const bend = y * y * 0.28;
    const shade = 0.32 + 0.68 * Math.pow(y, 0.8);
    if (k < LEVELS) {
      pos.push(-half, y, bend, half, y, bend);
      col.push(shade, shade, shade * 0.9, shade, shade, shade * 0.9);
      nor.push(-0.15, 0.9, 0.4, 0.15, 0.9, 0.4);
    } else {
      pos.push(0, y, bend);
      col.push(1.05, 1.05, 0.8);
      nor.push(0, 0.9, 0.4);
    }
  }
  for (let k = 0; k < LEVELS - 1; k++) {
    const a = k * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const t = (LEVELS - 1) * 2;
  idx.push(t, t + 1, t + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// A wildflower 1 unit tall: a thin stem and a flat six-petal head facing up.
function flowerGeometry() {
  const pos = [], col = [], nor = [], idx = [];
  const push = (x, y, z, c, n = [0, 1, 0]) => {
    pos.push(x, y, z);
    col.push(c, c, c);
    nor.push(...n);
    return pos.length / 3 - 1;
  };
  const s0 = push(-0.012, 0, 0, 0.25, [0, 0, 1]), s1 = push(0.012, 0, 0, 0.25, [0, 0, 1]);
  const s2 = push(-0.008, 1, 0, 0.3, [0, 0, 1]), s3 = push(0.008, 1, 0, 0.3, [0, 0, 1]);
  idx.push(s0, s1, s2, s1, s3, s2);
  const center = push(0, 1.01, 0, 0.35);
  const PETALS = 6;
  for (let p = 0; p < PETALS; p++) {
    const a = (p / PETALS) * Math.PI * 2;
    const a0 = a - 0.24, a1 = a + 0.24;
    const l = push(Math.cos(a0) * 0.05, 1.01, Math.sin(a0) * 0.05, 1);
    const tip = push(Math.cos(a) * 0.13, 1.03, Math.sin(a) * 0.13, 1);
    const r = push(Math.cos(a1) * 0.05, 1.01, Math.sin(a1) * 0.05, 1);
    idx.push(center, tip, l, center, r, tip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const SEASON_GRASS = {
  summer: 0x6f9a3c,
  autumn: 0xa89a48,
  winter: 0xd2aa62, // Highveld winter: the grass goes to straw
  spring: 0x86b24a,
};

const SEASON_FLOWERS = {
  // Cosmos flowers along every Highveld roadside and dam wall in autumn.
  autumn: { share: 1.0, colors: [0xf2a6d4, 0xffffff, 0xd84f9c, 0xf7c6e4] },
  spring: { share: 0.6, colors: [0xffe14a, 0xffffff, 0xffc93a] },
  summer: { share: 0.2, colors: [0xffffff, 0xffe14a, 0xb88cf0] },
  winter: { share: 0, colors: [0xffffff] },
};

export function createGrass(scene, { dam, terrain, location, exclude = () => false, bladeCount = 60000 }) {
  const rng = makeRng(seedFromString(location.id) + 404);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const beach = dam.spec.beachWidth;

  // Grass grows on the land behind the beach, thickest near the water and
  // around where the angler starts, thinning out along the bank and inland.
  function randomSpot(maxLand) {
    for (let tries = 0; tries < 12; tries++) {
      const x = dam.spawn.x + (rng() < 0.5 ? -1 : 1) * Math.pow(rng(), 1.35) * 120;
      const land = beach - 0.3 + Math.pow(rng(), 1.6) * maxLand;
      if (terrain.sandAt(land) > 0.45) continue;
      const z = dam.shoreZ(x) - land;
      if (exclude(x, z) || dam.isWater(x, z)) continue;
      return { x, z, off: land };
    }
    return null;
  }

  // ─── Blades, grown in tufts ───────────────────────────────────────────────
  const bladeMat = addWindToMaterial(new THREE.MeshStandardMaterial({
    color: SEASON_GRASS.summer, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide,
  }), { instanced: true, amount: 1 });
  const blades = new THREE.InstancedMesh(bladeGeometry(), bladeMat, bladeCount);
  blades.userData.fullCount = bladeCount;
  let n = 0;
  while (n < bladeCount) {
    const spot = randomSpot(70);
    if (!spot) continue;
    const tuft = 6 + Math.floor(rng() * 10);
    const tall = rng() < 0.08;
    for (let k = 0; k < tuft && n < bladeCount; k++) {
      const x = spot.x + (rng() - 0.5) * 0.3;
      const z = spot.z + (rng() - 0.5) * 0.3;
      const h = tall ? 0.45 + rng() * 0.35 : 0.14 + rng() * 0.26;
      const w = 0.018 + rng() * 0.018;
      dummy.position.set(x, terrain.heightAt(x, z) - 0.01, z);
      dummy.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35);
      dummy.scale.set(w, h, w);
      dummy.updateMatrix();
      blades.setMatrixAt(n, dummy.matrix);
      const v = rng();
      color.setRGB(0.8 + v * 0.35, 0.85 + v * 0.25, 0.7 + v * 0.2);
      if (rng() < 0.18) color.setRGB(1.35, 1.15, 0.6); // sun-bleached blades
      blades.setColorAt(n, color);
      n++;
    }
  }
  blades.instanceMatrix.needsUpdate = true;
  blades.instanceColor.needsUpdate = true;
  blades.receiveShadow = true;
  blades.frustumCulled = false;
  blades.layers.set(1);
  scene.add(blades);

  // ─── Wildflowers ──────────────────────────────────────────────────────────
  const FLOWERS = 2600;
  const flowerMat = addWindToMaterial(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.7, side: THREE.DoubleSide,
  }), { instanced: true, amount: 1.4 });
  const flowers = new THREE.InstancedMesh(flowerGeometry(), flowerMat, FLOWERS);
  const flowerSpots = [];
  for (let i = 0; i < FLOWERS; i++) {
    let spot = null;
    while (!spot) spot = randomSpot(40);
    const s = 0.35 + rng() * 0.45;
    dummy.position.set(spot.x, terrain.heightAt(spot.x, spot.z), spot.z);
    dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, color.set(0xffffff));
    flowerSpots.push(rng());
  }
  flowers.instanceMatrix.needsUpdate = true;
  flowers.layers.set(1);
  flowers.frustumCulled = false;
  scene.add(flowers);

  function setSeason(season) {
    bladeMat.color.set(SEASON_GRASS[season] || SEASON_GRASS.summer);
    const spec = SEASON_FLOWERS[season] || SEASON_FLOWERS.summer;
    flowers.count = Math.floor(FLOWERS * spec.share);
    for (let i = 0; i < flowers.count; i++) {
      color.set(spec.colors[Math.floor(flowerSpots[i] * spec.colors.length) % spec.colors.length]);
      flowers.setColorAt(i, color);
    }
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    flowers.visible = flowers.count > 0;
  }
  setSeason('summer');

  return { blades, flowers, setSeason };
}
