import * as THREE from '../vendor/three.module.js';
import { createGrassTexture, createWoodTexture, createSkyDome, setSkyColors, createSunGlow } from './textures.js';
import {
  POND_CENTER, SHORE_INNER_RADIUS, SHORE_OUTER_RADIUS, WALK_RADIUS,
  REED_RADIUS, TREE_INNER_RADIUS, TREE_OUTER_RADIUS, DOCK_ANGLE,
  WATER_EDGE_RADIUS, BANK_OUTER_RADIUS, BANK_SURFACE_Y,
} from './pond.js';

export function createScene({ grassTint = 0xffffff } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfeeff, 26, 95);

  const { sky, skyUniforms } = createSkyDome(scene);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  const startX = POND_CENTER.x + Math.cos(DOCK_ANGLE) * WALK_RADIUS;
  const startZ = POND_CENTER.z + Math.sin(DOCK_ANGLE) * WALK_RADIUS;
  camera.position.set(startX, 1.6, startZ);
  camera.lookAt(POND_CENTER.x, 0.6, POND_CENTER.z);
  scene.add(camera);

  const hemiLight = new THREE.HemisphereLight(0xbfe0ff, 0x3d5c2f, 0.55);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.2);
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  // Wide enough to cover the whole walkable shore ring, not just the dock.
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const sunGlow = createSunGlow();
  sunGlow.position.copy(sunLight.position).normalize().multiplyScalar(180);
  scene.add(sunGlow);

  // Outer land: a big darker ground disc so the trees beyond the shore ring
  // stand on something instead of floating over the sky dome.
  const grassTexture = createGrassTexture();
  grassTexture.repeat.set(18, 18);
  const outerTexture = createGrassTexture();
  outerTexture.repeat.set(60, 60);
  const outerGeo = new THREE.RingGeometry(SHORE_OUTER_RADIUS - 0.5, 160, 96, 1);
  const outerMat = new THREE.MeshStandardMaterial({ map: outerTexture, roughness: 1.0, color: 0x9aa88a });
  const outerLand = new THREE.Mesh(outerGeo, outerMat);
  outerLand.rotation.x = -Math.PI / 2;
  outerLand.position.copy(POND_CENTER);
  outerLand.position.y = 0.02;
  outerLand.receiveShadow = true;
  scene.add(outerLand);

  // Pond bed: a dark, murky floor under the translucent water so it reads as
  // depth. It must not receive shadows -- at sunset the reeds' long shadows
  // would otherwise show through the surface as black streaks.
  const bedGeo = new THREE.CircleGeometry(SHORE_INNER_RADIUS + 0.5, 96);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x0b2426, roughness: 1.0 });
  const pondBed = new THREE.Mesh(bedGeo, bedMat);
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.position.copy(POND_CENTER);
  pondBed.position.y = -0.6;
  pondBed.receiveShadow = false;
  scene.add(pondBed);

  // Bank: a sandy/muddy strip between the grass and the water, plus a thin
  // pale waterline where the two meet, so the edge is unmistakable.
  const bankGeo = new THREE.RingGeometry(WATER_EDGE_RADIUS, BANK_OUTER_RADIUS, 96, 1);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x9b8560, roughness: 1.0 });
  const bank = new THREE.Mesh(bankGeo, bankMat);
  bank.rotation.x = -Math.PI / 2;
  bank.position.copy(POND_CENTER);
  bank.position.y = BANK_SURFACE_Y;
  bank.receiveShadow = true;
  scene.add(bank);

  // Waterline sits exactly where the sand meets open water.
  const waterlineGeo = new THREE.RingGeometry(WATER_EDGE_RADIUS - 0.3, WATER_EDGE_RADIUS + 0.05, 128, 1);
  const waterlineMat = new THREE.MeshBasicMaterial({ color: 0xe8efe3, transparent: true, opacity: 0.55 });
  const waterline = new THREE.Mesh(waterlineGeo, waterlineMat);
  waterline.rotation.x = -Math.PI / 2;
  waterline.position.copy(POND_CENTER);
  waterline.position.y = BANK_SURFACE_Y + 0.015;
  scene.add(waterline);

  // Shore: a walkable ring around the whole dam, textured with grass.
  const shoreGeo = new THREE.RingGeometry(BANK_OUTER_RADIUS - 0.1, SHORE_OUTER_RADIUS, 96, 1);
  const shoreMat = new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0, color: grassTint });
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.copy(POND_CENTER);
  shore.position.y = 0.1;
  shore.receiveShadow = true;
  scene.add(shore);

  // A small pier jutting from the shore at the starting position, purely
  // decorative -- the player can cast from anywhere around the ring.
  const woodTexture = createWoodTexture();
  const dockGeo = new THREE.BoxGeometry(3, 0.2, 4);
  const dockMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.85 });
  const dock = new THREE.Mesh(dockGeo, dockMat);
  const dockCenterRadius = (SHORE_INNER_RADIUS + WALK_RADIUS) / 2 - 0.5;
  const dockX = POND_CENTER.x + Math.cos(DOCK_ANGLE) * dockCenterRadius;
  const dockZ = POND_CENTER.z + Math.sin(DOCK_ANGLE) * dockCenterRadius;
  dock.position.set(dockX, 0.3, dockZ);
  dock.rotation.y = DOCK_ANGLE;
  dock.castShadow = true;
  dock.receiveShadow = true;
  scene.add(dock);

  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 });
  for (const [lx, lz] of [[-1.4, -1.6], [1.4, -1.6], [-1.4, 1.6], [1.4, 1.6]]) {
    const post = new THREE.Mesh(postGeo, postMat);
    const rot = DOCK_ANGLE;
    post.position.set(
      dockX + (lx * Math.sin(rot) + lz * Math.cos(rot)),
      0.03,
      dockZ + (-lx * Math.cos(rot) + lz * Math.sin(rot)),
    );
    post.castShadow = true;
    scene.add(post);
  }

  const swayGroup = new THREE.Group();
  scene.add(swayGroup);

  // Reeds, all the way around the waterline.
  const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.7 });
  const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 });
  const REED_COUNT = 90;
  for (let i = 0; i < REED_COUNT; i++) {
    const angle = (i / REED_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
    const radius = REED_RADIUS + (Math.random() - 0.5) * 2.5;
    const height = 0.9 + Math.random() * 0.6;
    const reed = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, height, 5), reedStemMat);
    stem.position.y = height / 2;
    reed.add(stem);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 2, 6), reedHeadMat);
    head.position.y = height + 0.05;
    reed.add(head);
    reed.position.set(
      POND_CENTER.x + Math.cos(angle) * radius,
      0.1,
      POND_CENTER.z + Math.sin(angle) * radius,
    );
    swayGroup.add(reed);
  }

  // Lily pads scattered across the water surface.
  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3f, roughness: 0.6 });
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (SHORE_INNER_RADIUS - 3);
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.2, 10), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(
      POND_CENTER.x + Math.cos(angle) * radius,
      0.16, // clear of the water's vertex-wave amplitude, so no flicker
      POND_CENTER.z + Math.sin(angle) * radius,
    );
    scene.add(lily);
  }

  // Trees ring the outside of the walking path in every direction.
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4326, roughness: 0.9 });
  const treeLeafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x3a7d45, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x275a30, roughness: 0.8 }),
  ];
  const TREE_COUNT = 26;
  for (let i = 0; i < TREE_COUNT; i++) {
    const angle = (i / TREE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const radius = TREE_INNER_RADIUS + Math.random() * (TREE_OUTER_RADIUS - TREE_INNER_RADIUS);
    const tree = new THREE.Group();
    const trunkHeight = 2.4 + Math.random() * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkHeight, 6), treeTrunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const canopyCount = 3 + Math.floor(Math.random() * 2);
    for (let c = 0; c < canopyCount; c++) {
      const blob = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.5, 0),
        treeLeafMats[c % treeLeafMats.length],
      );
      blob.position.set(
        (Math.random() - 0.5) * 1.2,
        trunkHeight + 0.6 + Math.random() * 0.8,
        (Math.random() - 0.5) * 1.2,
      );
      blob.castShadow = true;
      tree.add(blob);
    }

    tree.position.set(
      POND_CENTER.x + Math.cos(angle) * radius,
      0,
      POND_CENTER.z + Math.sin(angle) * radius,
    );
    swayGroup.add(tree);
  }

  return { scene, camera, sunLight, ambientLight, hemiLight, swayGroup, skyUniforms, sunGlow, treeLeafMats };
}

// Trees change with the season: full green in summer, orange in autumn,
// sparse brown-grey in winter, fresh light green in spring.
const SEASON_LEAF_COLORS = {
  summer: [0x2f6b3a, 0x3a7d45, 0x275a30],
  autumn: [0xb8702a, 0xc98a3a, 0x8a5a24],
  winter: [0x6b5a48, 0x7a6a58, 0x5a4a3a],
  spring: [0x7fb35a, 0x93c46a, 0x6aa04a],
};

export function updateSeasonFoliage(treeLeafMats, season) {
  const palette = SEASON_LEAF_COLORS[season] || SEASON_LEAF_COLORS.summer;
  treeLeafMats.forEach((mat, i) => mat.color.set(palette[i % palette.length]));
}

const ROD_TIER_APPEARANCE = {
  1: { color: 0x6b4a2c, reelColor: 0x2a2a2a },
  2: { color: 0x8f97a3, reelColor: 0x1c1c1c },
  3: { color: 0x1c1c22, reelColor: 0xb08a3e },
};

export function createPlayerRod(camera) {
  const rodGroup = new THREE.Group();

  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.4, metalness: 0.3 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 1.7, 8), shaftMat);
  shaft.position.set(0, 0, -0.7);
  shaft.rotation.x = Math.PI / 2 + 0.35;
  rodGroup.add(shaft);

  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 8), gripMat);
  grip.position.set(0, -0.05, 0.15);
  grip.rotation.x = Math.PI / 2 + 0.35;
  rodGroup.add(grip);

  const reelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.6 });
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), reelMat);
  reel.position.set(0, -0.13, 0.12);
  reel.rotation.z = Math.PI / 2;
  rodGroup.add(reel);

  for (let i = 0; i < 3; i++) {
    const guideMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.7 });
    const guide = new THREE.Mesh(new THREE.TorusGeometry(0.02 - i * 0.004, 0.003, 6, 8), guideMat);
    guide.position.set(0, 0.25 * i + 0.05, -0.4 - i * 0.4);
    guide.rotation.x = Math.PI / 2;
    rodGroup.add(guide);
  }

  // Shaft is a cylinder of height 1.7 centered at local (0,0,-0.7), rotated
  // Math.PI/2 + 0.35 about X. Its far end (rod tip) sits at
  // center + (height/2) * rotatedYAxis, where rotatedYAxis = (0, cos(theta), sin(theta)).
  const shaftTheta = Math.PI / 2 + 0.35;
  const rotatedAxis = new THREE.Vector3(0, Math.cos(shaftTheta), Math.sin(shaftTheta));
  const tipLocal = new THREE.Vector3(0, 0, -0.7).addScaledVector(rotatedAxis, -0.87);
  const tip = new THREE.Object3D();
  tip.position.copy(tipLocal);
  rodGroup.add(tip);

  rodGroup.position.set(0.32, -0.32, -0.55);
  rodGroup.rotation.set(0, 0, -0.25);
  camera.add(rodGroup);

  function setTier(tier) {
    const appearance = ROD_TIER_APPEARANCE[tier] || ROD_TIER_APPEARANCE[1];
    shaftMat.color.set(appearance.color);
    reelMat.color.set(appearance.reelColor);
  }

  return { rodGroup, setTier, tip };
}

export function updateSway(swayGroup, elapsedSeconds, windSpeed) {
  const amplitude = Math.min(0.15, windSpeed * 0.015);
  swayGroup.children.forEach((child, i) => {
    child.rotation.z = Math.sin(elapsedSeconds * 2 + i) * amplitude;
  });
}

// Lighting presets for the day cycle, matching the "Sunset Angler" (warm
// gold) and "Twilight Waters" (cool amber-on-indigo) art direction, with
// three extra daytime stages interpolated between them.
const TIME_OF_DAY_LIGHT = {
  // dir: where the sun sits in the sky (x = east/west, y = height). It rises
  // in the east, arcs overhead, and drops onto the western horizon at sunset;
  // at night the same glow becomes a small cool moon high in the sky.
  morning: { sun: 0xffd9b0, sunI: 0.85, ambI: 0.28, hemiI: 0.48, dir: [1.0, 0.22, 0.25], glowScale: 44, glow: 0xffe4b8 },
  midMorning: { sun: 0xfff0d0, sunI: 1.05, ambI: 0.32, hemiI: 0.55, dir: [0.8, 0.6, 0.2], glowScale: 36, glow: 0xfff2d0 },
  midday: { sun: 0xfff2d0, sunI: 1.25, ambI: 0.36, hemiI: 0.62, dir: [0.15, 1.0, 0.1], glowScale: 32, glow: 0xfff8e6 },
  afternoon: { sun: 0xffe3b8, sunI: 1.05, ambI: 0.33, hemiI: 0.55, dir: [-0.65, 0.55, 0.2], glowScale: 40, glow: 0xffe8c0 },
  sunset: { sun: 0xffb27a, sunI: 1.0, ambI: 0.3, hemiI: 0.42, dir: [-1.0, 0.12, 0.3], glowScale: 70, glow: 0xffb070 },
  lateTwilight: { sun: 0xffbd8a, sunI: 0.55, ambI: 0.22, hemiI: 0.3, dir: [-1.0, 0.04, 0.4], glowScale: 60, glow: 0xff9a6a },
  night: { sun: 0x5c6fae, sunI: 0.15, ambI: 0.12, hemiI: 0.18, dir: [0.3, 0.85, -0.5], glowScale: 22, glow: 0xcfd8ff },
};

export function updateSun({ sunLight, ambientLight, hemiLight, skyUniforms, sunGlow, scene }, timeOfDay) {
  const preset = TIME_OF_DAY_LIGHT[timeOfDay] || TIME_OF_DAY_LIGHT.midday;
  sunLight.color.set(preset.sun);
  sunLight.intensity = preset.sunI;
  ambientLight.intensity = preset.ambI;
  hemiLight.intensity = preset.hemiI;

  const dir = new THREE.Vector3(...preset.dir).normalize();
  sunLight.position.copy(dir).multiplyScalar(60);
  if (sunGlow) {
    sunGlow.position.copy(dir).multiplyScalar(180);
    sunGlow.scale.set(preset.glowScale, preset.glowScale, 1);
    sunGlow.material.color.set(preset.glow);
  }

  setSkyColors(skyUniforms, timeOfDay);
  // Fog fades distant objects into the horizon colour, not daylight blue.
  if (scene && scene.fog) scene.fog.color.copy(skyUniforms.bottomColor.value);
  return dir;
}
