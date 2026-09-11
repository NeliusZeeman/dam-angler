import * as THREE from '../vendor/three.module.js';
import { createGrassTexture, createWoodTexture, createSkyDome, setSkyColors } from './textures.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfeeff, 24, 85);

  const { sky, skyUniforms } = createSkyDome(scene);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, -0.3, -12);

  const hemiLight = new THREE.HemisphereLight(0xbfe0ff, 0x3d5c2f, 0.55);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.2);
  sunLight.position.set(10, 20, 10);
  scene.add(sunLight);

  const woodTexture = createWoodTexture();
  const dockGeo = new THREE.BoxGeometry(3, 0.2, 4);
  const dockMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.85 });
  const dock = new THREE.Mesh(dockGeo, dockMat);
  dock.position.set(0, 0.4, 4);
  scene.add(dock);

  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 });
  for (const [px, pz] of [[-1.4, 2.2], [1.4, 2.2], [-1.4, 5.8], [1.4, 5.8]]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, 0.12, pz);
    scene.add(post);
  }

  const grassTexture = createGrassTexture();
  const groundGeo = new THREE.CircleGeometry(13, 48);
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.15;
  scene.add(ground);

  const swayGroup = new THREE.Group();
  scene.add(swayGroup);

  const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.7 });
  const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 });
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 4;
    const height = 0.9 + Math.random() * 0.6;
    const reed = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, height, 5), reedStemMat);
    stem.position.y = height / 2;
    reed.add(stem);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 2, 6), reedHeadMat);
    head.position.y = height + 0.05;
    reed.add(head);
    reed.position.set(Math.cos(angle) * radius, 0.15, -10 + Math.sin(angle) * radius);
    swayGroup.add(reed);
  }

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3f, roughness: 0.6 });
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 10;
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.2, 10), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(Math.cos(angle) * radius, 0.16, -10 + Math.sin(angle) * radius);
    scene.add(lily);
  }

  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4326, roughness: 0.9 });
  const treeLeafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x3a7d45, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x275a30, roughness: 0.8 }),
  ];
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 22 + Math.random() * 15;
    const tree = new THREE.Group();
    const trunkHeight = 2.4 + Math.random() * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkHeight, 6), treeTrunkMat);
    trunk.position.y = trunkHeight / 2;
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
      tree.add(blob);
    }

    tree.position.set(Math.cos(angle) * radius, 0, -30 + Math.sin(angle) * radius);
    swayGroup.add(tree);
  }

  return { scene, camera, sunLight, ambientLight, hemiLight, swayGroup, skyUniforms };
}

export function setupCameraControls(camera, domElement) {
  let yaw = 0;
  let dragging = false;
  let lastX = 0;
  const maxYaw = Math.PI / 4;

  domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yaw = Math.min(maxYaw, Math.max(-maxYaw, yaw - dx * 0.003));
    camera.rotation.y = yaw;
  });
}

export function updateSway(swayGroup, elapsedSeconds, windSpeed) {
  const amplitude = Math.min(0.15, windSpeed * 0.015);
  swayGroup.children.forEach((child, i) => {
    child.rotation.z = Math.sin(elapsedSeconds * 2 + i) * amplitude;
  });
}

export function updateSun(sunLight, ambientLight, hemiLight, skyUniforms, season) {
  const seasonLight = {
    summer: { sun: 0xfff2d0, sunI: 1.2, ambI: 0.35, hemiI: 0.6 },
    autumn: { sun: 0xffd9a0, sunI: 1.0, ambI: 0.3, hemiI: 0.5 },
    winter: { sun: 0xcfe3ff, sunI: 0.8, ambI: 0.28, hemiI: 0.45 },
    spring: { sun: 0xffffe0, sunI: 1.1, ambI: 0.32, hemiI: 0.55 },
  }[season];
  sunLight.color.set(seasonLight.sun);
  sunLight.intensity = seasonLight.sunI;
  ambientLight.intensity = seasonLight.ambI;
  hemiLight.intensity = seasonLight.hemiI;
  setSkyColors(skyUniforms, season);
}
