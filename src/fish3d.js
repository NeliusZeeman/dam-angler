import * as THREE from '../vendor/three.module.js';
import { POND_CENTER } from './pond.js';

const SPECIES_APPEARANCE = {
  'mozambique-tilapia': { color: 0x9fb8c4, belly: 0xd8e6ea, scale: 1.0 },
  'banded-tilapia': { color: 0x7f9a6c, belly: 0xc9d8ae, scale: 0.75 },
  'common-carp': { color: 0xb9863f, belly: 0xe0c090, scale: 1.3 },
  'mirror-carp': { color: 0x9c7a3a, belly: 0xd8b877, scale: 1.5 },
  'largemouth-bass': { color: 0x4f6b3a, belly: 0xb7c98f, scale: 1.15 },
  'smallmouth-bass': { color: 0x5c7a52, belly: 0xa9c48f, scale: 0.95 },
  catfish: { color: 0x3a3a3c, belly: 0x6b6b6e, scale: 1.7 },
  tigerfish: { color: 0xc9a24a, belly: 0xe8d9a0, scale: 1.1 },
};

export function createFishMesh(speciesId) {
  const appearance = SPECIES_APPEARANCE[speciesId] || SPECIES_APPEARANCE['mozambique-tilapia'];
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: appearance.color, roughness: 0.35, metalness: 0.15 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: appearance.belly, roughness: 0.4, metalness: 0.1 });
  const finMat = new THREE.MeshStandardMaterial({ color: appearance.color, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), bodyMat);
  body.scale.set(1.6, 0.85, 0.55);
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), bellyMat);
  belly.scale.set(1.4, 0.55, 0.5);
  belly.position.set(0, -0.06, 0);
  group.add(belly);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 4), finMat);
  tail.rotation.z = Math.PI / 2;
  tail.scale.set(1, 1, 0.15);
  tail.position.set(-0.27, 0, 0);
  group.add(tail);

  const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 3), finMat);
  dorsalFin.scale.set(1, 1, 0.1);
  dorsalFin.position.set(0.02, 0.12, 0);
  group.add(dorsalFin);

  const finGeo = new THREE.ConeGeometry(0.05, 0.1, 3);
  const leftFin = new THREE.Mesh(finGeo, finMat);
  leftFin.rotation.z = -Math.PI / 3;
  leftFin.scale.set(1, 1, 0.1);
  leftFin.position.set(0.08, -0.04, 0.09);
  group.add(leftFin);

  const rightFin = leftFin.clone();
  rightFin.position.z = -0.09;
  group.add(rightFin);

  const eyeGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.22, 0.03, 0.08);
  group.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.z = -0.08;
  group.add(rightEye);

  group.scale.setScalar(appearance.scale);
  group.userData.tail = tail;
  return group;
}

export function createFishSwarm(scene, speciesIds, count, pondShape) {
  const fishes = [];
  // Bound the swarm by the tightest point of the shoreline so a fish never
  // orbits onto the sand, whichever direction it's heading.
  let minEdge = Infinity;
  for (let i = 0; i < 48; i++) minEdge = Math.min(minEdge, pondShape.radiusAt((i / 48) * Math.PI * 2));
  for (let i = 0; i < count; i++) {
    const speciesId = speciesIds[i % speciesIds.length];
    const mesh = createFishMesh(speciesId);
    const radius = 3 + Math.random() * Math.max(2, minEdge - 5); // stays in open water, off the sand
    const angle = Math.random() * Math.PI * 2;
    mesh.userData.orbitRadius = radius;
    mesh.userData.orbitAngle = angle;
    mesh.userData.orbitSpeed = 0.06 + Math.random() * 0.1;
    // Shallow enough to be seen through the water surface.
    mesh.userData.depth = -0.12 - Math.random() * 0.3;
    // Each fish breaches the surface now and then on its own timer.
    mesh.userData.jumpPeriod = 14 + Math.random() * 30;
    mesh.userData.jumpPhase = Math.random() * 40;
    mesh.visible = true;
    scene.add(mesh);
    fishes.push(mesh);
  }
  return fishes;
}

export function updateFishSwarm(fishes, elapsedSeconds) {
  for (const fish of fishes) {
    const { orbitRadius, orbitSpeed, depth, jumpPeriod, jumpPhase } = fish.userData;
    const angle = fish.userData.orbitAngle + elapsedSeconds * orbitSpeed;
    const x = POND_CENTER.x + Math.cos(angle) * orbitRadius;
    const z = POND_CENTER.z + Math.sin(angle) * orbitRadius;

    // A short arc above the water once per jumpPeriod seconds.
    const cycle = (elapsedSeconds + jumpPhase) % jumpPeriod;
    const jump = cycle < 1.0 ? Math.sin(cycle * Math.PI) * 0.8 : 0;

    fish.position.set(x, depth + Math.sin(elapsedSeconds * 2 + orbitRadius) * 0.06 + jump, z);
    fish.rotation.y = -angle - Math.PI / 2;
    fish.rotation.z = jump > 0 ? Math.sin(cycle * Math.PI) * 0.9 : 0;
    if (fish.userData.tail) {
      fish.userData.tail.rotation.y = Math.sin(elapsedSeconds * 8) * 0.5;
    }
  }
}

export function createCatchReveal(scene) {
  let active = null;

  function spawn(speciesId, worldPosition) {
    if (active) {
      scene.remove(active.mesh);
    }
    const mesh = createFishMesh(speciesId);
    mesh.position.copy(worldPosition);
    mesh.position.y = 0;
    mesh.scale.multiplyScalar(1.8);
    scene.add(mesh);
    active = { mesh, age: 0, duration: 2.2 };
  }

  function update(deltaSeconds) {
    if (!active) return;
    active.age += deltaSeconds;
    const t = active.age / active.duration;
    active.mesh.position.y = Math.sin(Math.min(1, t) * Math.PI) * 1.4;
    active.mesh.rotation.z = Math.sin(active.age * 6) * 0.3;
    active.mesh.rotation.y += deltaSeconds * 2;
    if (active.mesh.userData.tail) {
      active.mesh.userData.tail.rotation.y = Math.sin(active.age * 14) * 0.6;
    }
    if (t >= 1) {
      scene.remove(active.mesh);
      active = null;
    }
  }

  return { spawn, update };
}
