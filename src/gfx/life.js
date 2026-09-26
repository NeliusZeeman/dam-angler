import * as THREE from '../../vendor/three.module.js';
import { makeRng, seedFromString } from './noise.js';
import { glowTexture } from './pixelTextures.js';

// African fish eagle: dark chestnut body, white head/chest/tail, broad
// fingered wings. Built facing +z.
function buildFishEagle() {
  const eagle = new THREE.Group();
  const chestnut = new THREE.MeshStandardMaterial({ color: 0x6e3318, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.75 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8b830, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), chestnut);
  body.scale.set(1, 0.85, 2.3);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), white);
  chest.scale.set(1, 0.9, 1.1);
  chest.position.set(0, 0.03, 0.42);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), white);
  head.position.set(0, 0.08, 0.78);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), yellow);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.04, 1.0);
  const tailShape = new THREE.Shape();
  tailShape.moveTo(-0.08, 0);
  tailShape.lineTo(0.08, 0);
  tailShape.lineTo(0.22, -0.5);
  tailShape.lineTo(-0.22, -0.5);
  const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), new THREE.MeshStandardMaterial({ color: 0xf2efe6, side: THREE.DoubleSide }));
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0, -0.6);
  eagle.add(body, chest, head, beak, tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.28);
  wingShape.lineTo(1.2, 0.34);
  wingShape.lineTo(2.05, 0.2);
  for (let f = 0; f < 5; f++) {
    wingShape.lineTo(2.25 + f * 0.02, 0.1 - f * 0.1);
    wingShape.lineTo(2.0 - f * 0.02, 0.02 - f * 0.1);
  }
  wingShape.lineTo(1.2, -0.38);
  wingShape.lineTo(0, -0.3);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  wingGeo.rotateX(Math.PI / 2);
  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.05, 0.1);
    const wing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.9, side: THREE.DoubleSide }));
    wing.scale.x = side;
    pivot.add(wing);
    eagle.add(pivot);
    wings.push({ pivot, side });
  }
  eagle.scale.setScalar(1.4);
  return { eagle, wings };
}

function buildDragonfly(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3, emissive: color, emissiveIntensity: 0.15 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.08, 5), bodyMat);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), bodyMat);
  head.position.z = 0.045;
  g.add(body, head);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const [z, len] of [[0.02, 0.06], [0.0, 0.055]]) {
    for (const side of [1, -1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.012), wingMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(side * len / 2, 0.004, z);
      g.add(w);
      wings.push(w);
    }
  }
  return { group: g, wings };
}

export function createWildlife(scene, { dam, location }) {
  const rng = makeRng(seedFromString(location.id) + 818);
  // The eagle works the water out in front of the angler.
  const circleX = dam.spawn.x, circleZ = dam.shoreZ(dam.spawn.x) + 55;

  const { eagle, wings } = buildFishEagle();
  scene.add(eagle);
  let eagleAngle = rng() * Math.PI * 2;
  let flapTimer = 0, nextFlap = 4;

  const flies = [];
  const FLY_COLORS = [0x2f7fd6, 0xc0302a, 0x3aa65a, 0x2f7fd6];
  for (let i = 0; i < 8; i++) {
    const { group, wings: fw } = buildDragonfly(FLY_COLORS[i % FLY_COLORS.length]);
    // Hawking over the margins either side of the stand.
    const x = dam.spawn.x + (rng() - 0.5) * 70;
    const home = new THREE.Vector3(x, 0.5, dam.shoreZ(x) + 1 + rng() * 3);
    group.position.copy(home);
    scene.add(group);
    flies.push({ group, wings: fw, home, target: home.clone(), timer: rng() * 2, velocity: new THREE.Vector3() });
  }

  const FIREFLIES = 70;
  const ffPos = new Float32Array(FIREFLIES * 3);
  const ffCol = new Float32Array(FIREFLIES * 3);
  const ffSeeds = [];
  for (let i = 0; i < FIREFLIES; i++) {
    // Along the bank, from the reeds back into the grass.
    const x = dam.spawn.x + (rng() - 0.5) * 80;
    const z = dam.shoreZ(x) + 0.5 - rng() * 10;
    ffSeeds.push({ x, z, y: 0.3 + rng() * 1.6, phase: rng() * 100, speed: 0.4 + rng() * 0.6 });
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('color', new THREE.BufferAttribute(ffCol, 3));
  const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({
    map: glowTexture(), size: 0.22, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  const tmp = new THREE.Vector3();

  function update(delta, elapsed, atmos) {
    // Eagle: wide lazy circles over the dam, gliding with the odd burst of flaps.
    const day = atmos.sunVis > 0.2;
    eagle.visible = day;
    if (day) {
      eagleAngle += delta * 0.09;
      const radius = 30 + Math.sin(elapsed * 0.05) * 8;
      const height = 21 + Math.sin(elapsed * 0.11) * 4;
      eagle.position.set(circleX + Math.cos(eagleAngle) * radius, height, circleZ + Math.sin(eagleAngle) * radius);
      eagle.rotation.set(0, -eagleAngle, 0);
      eagle.rotateZ(0.32); // bank into the turn
      flapTimer += delta;
      const flapping = flapTimer > nextFlap && flapTimer < nextFlap + 2.4;
      if (flapTimer > nextFlap + 2.4) { flapTimer = 0; nextFlap = 8 + rng() * 10; }
      for (const w of wings) {
        const flap = flapping ? Math.sin(elapsed * 8) * 0.55 : 0.12 + Math.sin(elapsed * 1.3) * 0.03;
        w.pivot.rotation.z = w.side * flap;
      }
    }

    for (const f of flies) {
      f.group.visible = day;
      if (!day) continue;
      f.timer -= delta;
      if (f.timer <= 0) {
        f.timer = 0.6 + rng() * 2.2;
        f.target.copy(f.home).add(tmp.set((rng() - 0.5) * 5, (rng() - 0.5) * 0.6, (rng() - 0.5) * 5));
        f.target.y = Math.max(0.25, f.target.y);
      }
      tmp.subVectors(f.target, f.group.position);
      f.velocity.lerp(tmp.multiplyScalar(3), Math.min(1, delta * 4));
      f.group.position.addScaledVector(f.velocity, delta);
      if (f.velocity.lengthSq() > 0.01) f.group.rotation.y = Math.atan2(f.velocity.x, f.velocity.z);
      const flutter = 0.4 + Math.abs(Math.sin(elapsed * 90 + f.home.x)) * 0.6;
      for (const w of f.wings) w.scale.y = flutter;
    }

    const glow = atmos.nightness;
    fireflies.visible = glow > 0.05;
    if (fireflies.visible) {
      for (let i = 0; i < FIREFLIES; i++) {
        const s = ffSeeds[i];
        const t = elapsed * s.speed + s.phase;
        ffPos[i * 3] = s.x + Math.sin(t * 0.7) * 1.2;
        ffPos[i * 3 + 1] = s.y + Math.sin(t * 1.3) * 0.3;
        ffPos[i * 3 + 2] = s.z + Math.cos(t * 0.5) * 1.2;
        const blink = Math.max(0, Math.sin(t * 2.1)) ** 6 * glow * 7;
        ffCol[i * 3] = blink * 1.0;
        ffCol[i * 3 + 1] = blink * 0.9;
        ffCol[i * 3 + 2] = blink * 0.3;
      }
      ffGeo.attributes.position.needsUpdate = true;
      ffGeo.attributes.color.needsUpdate = true;
    }
  }

  return { update };
}
