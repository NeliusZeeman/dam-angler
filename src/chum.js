import * as THREE from '../vendor/three.module.js';

// Breadcrumbs: thrown at a spot in the water, they draw fish in for a while
// -- a real feeding-spot mechanic, not just a flat bite-chance button.
export const CHUM_RADIUS = 3.2;
export const CHUM_DURATION = 75; // seconds
export const CHUM_MULTIPLIER = 2.0;
export const CHUM_COST = 15;

export function createChumSystem(scene) {
  const spots = [];

  function spawn(point) {
    const group = new THREE.Group();
    group.position.copy(point);
    group.position.y = 0.03;
    scene.add(group);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd9b878, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(CHUM_RADIUS, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const crumbMat = new THREE.MeshStandardMaterial({ color: 0xc9a468, roughness: 0.9 });
    const crumbs = [];
    for (let i = 0; i < 10; i++) {
      const crumb = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 6), crumbMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * CHUM_RADIUS * 0.7;
      crumb.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      crumb.userData.bobPhase = Math.random() * Math.PI * 2;
      group.add(crumb);
      crumbs.push(crumb);
    }

    spots.push({ position: point.clone(), radius: CHUM_RADIUS, age: 0, duration: CHUM_DURATION, group, ring, crumbs });
  }

  function update(deltaSeconds, elapsedSeconds) {
    for (let i = spots.length - 1; i >= 0; i--) {
      const spot = spots[i];
      spot.age += deltaSeconds;
      const lifeFrac = spot.age / spot.duration;
      spot.ring.material.opacity = Math.max(0, 0.32 * (1 - lifeFrac));
      for (const crumb of spot.crumbs) {
        crumb.position.y = 0.02 + Math.sin(elapsedSeconds * 1.4 + crumb.userData.bobPhase) * 0.015;
      }
      if (spot.age >= spot.duration) {
        scene.remove(spot.group);
        spots.splice(i, 1);
      }
    }
  }

  function multiplierAt(point) {
    let mult = 1;
    for (const spot of spots) {
      const dx = point.x - spot.position.x;
      const dz = point.z - spot.position.z;
      if (Math.hypot(dx, dz) <= spot.radius) mult = Math.max(mult, CHUM_MULTIPLIER);
    }
    return mult;
  }

  return { spawn, update, multiplierAt, activeCount: () => spots.length };
}
