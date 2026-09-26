import * as THREE from '../vendor/three.module.js';
import { FEED_TYPES, feedIntensity, feedBoostAt } from './feed.js';

// Feeding spots in the water: breadcrumbs thrown by hand, or the groundbait
// a mieliebom leaves around the hook. Fish find the feed, hold on it, then
// drift off as it runs out (see feed.js for the numbers).
export const CHUM_COST = 15;
const MAX_GROUNDBAIT_SPOTS = 3; // older mieliebom piles get eaten up

export function createChumSystem(scene) {
  const spots = [];

  function spawn(point, type = 'bread') {
    const kind = FEED_TYPES[type] ? type : 'bread';
    const { radius, duration } = FEED_TYPES[kind];
    if (kind === 'groundbait') {
      const piles = spots.filter((s) => s.type === 'groundbait');
      if (piles.length >= MAX_GROUNDBAIT_SPOTS) remove(spots.indexOf(piles[0]));
    }

    const group = new THREE.Group();
    group.position.set(point.x, 0.03, point.z);
    scene.add(group);

    const color = kind === 'groundbait' ? 0xe0c060 : 0xd9b878;
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    // Bread floats and bobs; groundbait sinks, so only a faint cloud shows.
    const crumbs = [];
    if (kind === 'bread') {
      const crumbMat = new THREE.MeshStandardMaterial({ color: 0xc9a468, roughness: 0.9 });
      for (let i = 0; i < 10; i++) {
        const crumb = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 6), crumbMat);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * radius * 0.7;
        crumb.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
        crumb.userData.bobPhase = Math.random() * Math.PI * 2;
        group.add(crumb);
        crumbs.push(crumb);
      }
    }

    spots.push({ type: kind, x: point.x, z: point.z, age: 0, duration, group, ring, crumbs });
  }

  function remove(i) {
    if (i < 0) return;
    scene.remove(spots[i].group);
    spots.splice(i, 1);
  }

  function update(deltaSeconds, elapsedSeconds) {
    for (let i = spots.length - 1; i >= 0; i--) {
      const spot = spots[i];
      spot.age += deltaSeconds;
      // The cloud of feed shows while fish are on it.
      const strength = feedIntensity(spot.age, FEED_TYPES[spot.type]);
      spot.ring.material.opacity = 0.08 + 0.26 * strength;
      // Crumbs get eaten as the fish work the spot.
      const eaten = Math.max(0, (spot.age / spot.duration - 0.2) / 0.8);
      spot.crumbs.forEach((crumb, k) => {
        crumb.visible = k / spot.crumbs.length >= eaten;
        crumb.position.y = 0.02 + Math.sin(elapsedSeconds * 1.4 + crumb.userData.bobPhase) * 0.015;
      });
      if (spot.age >= spot.duration) remove(i);
    }
  }

  // Extra bite pull at a point (0 = none); scaled per species at the bite roll.
  function boostAt(point) {
    return feedBoostAt(spots, point.x, point.z);
  }

  // Where fish should gather and how strongly, for the fish you can see.
  function attractors() {
    return spots.map((s) => ({ x: s.x, z: s.z, strength: feedIntensity(s.age, FEED_TYPES[s.type]) }))
      .filter((a) => a.strength > 0.02);
  }

  return { spawn, update, boostAt, attractors, activeCount: () => spots.length };
}
