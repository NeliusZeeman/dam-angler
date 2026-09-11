import * as THREE from '../vendor/three.module.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, -0.3, -12);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.0);
  sunLight.position.set(10, 20, 10);
  scene.add(sunLight);

  const dockGeo = new THREE.BoxGeometry(3, 0.2, 4);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22 });
  const dock = new THREE.Mesh(dockGeo, dockMat);
  dock.position.set(0, 0.4, 4);
  scene.add(dock);

  const groundGeo = new THREE.CircleGeometry(13, 32);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5c2f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.15;
  scene.add(ground);

  const swayGroup = new THREE.Group();
  scene.add(swayGroup);

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f });
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 4;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + Math.random() * 0.5, 5), reedMat);
    reed.position.set(Math.cos(angle) * radius, 0.5, -10 + Math.sin(angle) * radius);
    swayGroup.add(reed);
  }

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3f });
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 10;
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.2, 10), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(Math.cos(angle) * radius, 0.16, -10 + Math.sin(angle) * radius);
    scene.add(lily);
  }

  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4326 });
  const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a });
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 25 + Math.random() * 15;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), treeTrunkMat);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), treeLeafMat);
    leaves.position.y = 2.5;
    const tree = new THREE.Group();
    tree.add(trunk, leaves);
    tree.position.set(Math.cos(angle) * radius, 1.5, -30 + Math.sin(angle) * radius);
    swayGroup.add(tree);
  }

  return { scene, camera, sunLight, ambientLight, swayGroup };
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

export function updateSun(sunLight, ambientLight, season) {
  const seasonLight = {
    summer: { sun: 0xfff2d0, sunI: 1.1, ambI: 0.65 },
    autumn: { sun: 0xffd9a0, sunI: 0.9, ambI: 0.55 },
    winter: { sun: 0xcfe3ff, sunI: 0.7, ambI: 0.5 },
    spring: { sun: 0xffffe0, sunI: 1.0, ambI: 0.6 },
  }[season];
  sunLight.color.set(seasonLight.sun);
  sunLight.intensity = seasonLight.sunI;
  ambientLight.intensity = seasonLight.ambI;
}
