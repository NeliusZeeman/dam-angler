import * as THREE from '../../vendor/three.module.js';
import { makeRng, seedFromString } from './noise.js';
import { addWindToMaterial } from './wind.js';
import { lilyPadTexture } from './pixelTextures.js';

// A reed leaf 1 unit tall: long, tapering, arching outward.
function reedLeafGeometry() {
  const LEVELS = 6;
  const pos = [], col = [], nor = [], idx = [];
  for (let k = 0; k <= LEVELS; k++) {
    const y = k / LEVELS;
    const half = 0.5 * Math.pow(1 - y, 0.7);
    const bend = y * y * 0.35;
    const shade = 0.4 + 0.6 * y;
    const tipYellow = Math.max(0, y - 0.75) * 1.6;
    if (k < LEVELS) {
      pos.push(-half, y, bend, half, y, bend);
      for (let s = 0; s < 2; s++) col.push(shade + tipYellow * 0.5, shade + tipYellow * 0.25, shade * 0.85);
      nor.push(-0.2, 0.7, 0.6, 0.2, 0.7, 0.6);
    } else {
      pos.push(0, y, bend);
      col.push(1.3, 1.1, 0.6);
      nor.push(0, 0.7, 0.6);
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

// A bulrush ("papkuil"): green stem, velvety brown seed head, thin spike.
function cattailGeometry() {
  const parts = [];
  const tint = (g, r, gg, b) => {
    const c = [];
    for (let i = 0; i < g.getAttribute('position').count; i++) c.push(r, gg, b);
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  };
  const stem = new THREE.CylinderGeometry(0.006, 0.01, 0.74, 5, 1, true);
  stem.translate(0, 0.37, 0);
  parts.push(tint(stem, 0.34, 0.5, 0.2));
  const head = new THREE.CapsuleGeometry(0.02, 0.13, 3, 7);
  head.translate(0, 0.81, 0);
  parts.push(tint(head, 0.32, 0.19, 0.1));
  const spike = new THREE.ConeGeometry(0.004, 0.14, 4, 1, true);
  spike.translate(0, 0.96, 0);
  parts.push(tint(spike, 0.55, 0.45, 0.3));
  return mergeIndexed(parts);
}

// Water lily: two rings of pointed petals around a golden centre.
function lilyFlowerGeometry() {
  const pos = [], col = [], nor = [], idx = [];
  const ring = (count, len, tilt, offset, shade) => {
    for (let p = 0; p < count; p++) {
      const a = (p / count) * Math.PI * 2 + offset;
      const dx = Math.cos(a), dz = Math.sin(a);
      const px = -dz, pz = dx;
      const base = pos.length / 3;
      const tipR = len * Math.cos(tilt), tipY = len * Math.sin(tilt);
      pos.push(px * 0.018, 0, pz * 0.018, -px * 0.018, 0, -pz * 0.018);
      pos.push(dx * tipR * 0.5 + px * 0.022, tipY * 0.5, dz * tipR * 0.5 + pz * 0.022);
      pos.push(dx * tipR * 0.5 - px * 0.022, tipY * 0.5, dz * tipR * 0.5 - pz * 0.022);
      pos.push(dx * tipR, tipY, dz * tipR);
      for (let i = 0; i < 5; i++) {
        col.push(shade, shade, shade);
        nor.push(0, 1, 0);
      }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3, base + 2, base + 4, base + 3);
    }
  };
  ring(8, 0.09, 0.35, 0, 0.85);
  ring(8, 0.075, 0.9, Math.PI / 8, 1.0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function mergeIndexed(geos) {
  const pos = [], nor = [], col = [], idx = [];
  let offset = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    const index = g.getIndex();
    if (index) for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) idx.push(i + offset);
    offset += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  merged.setIndex(idx);
  return merged;
}

export function createShoreline(scene, { dam, location }) {
  const rng = makeRng(seedFromString(location.id) + 515);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  // Keep the water straight out from every stand open to cast into.
  const nearStand = (x, pad = 3) => dam.stands.some((st) => Math.abs(x - st.x) < st.width / 2 + pad);
  // A point `d` metres out from the near bank at x (negative = up the bank).
  const offBank = (x, d) => [x, dam.shoreZ(x) + d];
  // Random x inside a structure zone (gaussian-ish spread over its width).
  const zoneX = (zone) => zone.x + (rng() + rng() - 1) * zone.width;
  const zones = (kind) => dam.spec.structure.filter((z) => (z.kind || 'pads') === kind);

  // ─── Reeds & bulrushes ────────────────────────────────────────────────────
  const leaves = [], tails = [];
  function clump(x, off, tall) {
    const [cx, cz] = offBank(x, off);
    const nLeaves = 10 + Math.floor(rng() * 10);
    for (let i = 0; i < nLeaves; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.35;
      leaves.push({
        x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r,
        h: (tall ? 1.3 : 0.8) + rng() * (tall ? 1.0 : 0.8), w: 0.04 + rng() * 0.035,
        ry: rng() * Math.PI * 2, tilt: 0.08 + rng() * 0.3,
      });
    }
    const nTails = Math.floor(rng() * (tall ? 5 : 3));
    for (let i = 0; i < nTails; i++) {
      tails.push({
        x: cx + (rng() - 0.5) * 0.5, z: cz + (rng() - 0.5) * 0.5,
        s: (tall ? 1.7 : 1.3) + rng() * 0.6, ry: rng() * Math.PI * 2, tilt: (rng() - 0.5) * 0.12,
      });
    }
  }
  // A scattering of clumps all along the waterline...
  for (let i = 0; i < 110; i++) {
    const x = (rng() - 0.5) * 320;
    if (nearStand(x)) continue;
    clump(x, -0.8 + rng() * 1.6, false);
  }
  // ...thick reed beds standing out in the shallows where the dam has them,
  // and a fringe of reeds around the pad beds and timber.
  for (const zone of dam.spec.structure) {
    const reedBed = (zone.kind || 'pads') === 'reeds';
    const n = Math.round(zone.width * zone.density * (reedBed ? 3.2 : 0.9));
    for (let i = 0; i < n; i++) {
      const x = zoneX(zone);
      if (nearStand(x)) continue;
      clump(x, reedBed ? -0.6 + rng() * Math.min(9, zone.reach * 0.6) : -1 + rng() * 2.5, true);
    }
  }

  const reedMat = addWindToMaterial(new THREE.MeshStandardMaterial({
    color: 0x6f9a44, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide,
  }), { instanced: true, amount: 0.8 });
  const reeds = new THREE.InstancedMesh(reedLeafGeometry(), reedMat, leaves.length);
  leaves.forEach((l, i) => {
    dummy.position.set(l.x, -0.25, l.z);
    dummy.rotation.set(l.tilt * Math.cos(l.ry), l.ry, l.tilt * Math.sin(l.ry));
    dummy.scale.set(l.w, l.h, l.w);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
    const v = rng();
    reeds.setColorAt(i, color.setRGB(0.85 + v * 0.3, 0.9 + v * 0.2, 0.75 + v * 0.2));
  });
  reeds.castShadow = true;
  reeds.receiveShadow = true;
  reeds.frustumCulled = false;
  scene.add(reeds);

  const tailMat = addWindToMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { instanced: true, amount: 0.45 });
  const cattails = new THREE.InstancedMesh(cattailGeometry(), tailMat, Math.max(1, tails.length));
  tails.forEach((t, i) => {
    dummy.position.set(t.x, -0.25, t.z);
    dummy.rotation.set(t.tilt, t.ry, t.tilt * 0.7);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    cattails.setMatrixAt(i, dummy.matrix);
  });
  cattails.count = tails.length;
  cattails.castShadow = true;
  cattails.frustumCulled = false;
  scene.add(cattails);

  // ─── Lily pads, in clusters ───────────────────────────────────────────────
  const pads = [];
  function padCluster(x, d, size) {
    const [cx, cz] = offBank(x, d);
    const n = 4 + Math.floor(rng() * size);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (0.8 + size * 0.12);
      const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
      if (dam.waterDist(px, pz) < 0.7 || dam.standAt(px, pz)) continue;
      pads.push({ x: px, z: pz, s: 0.45 + rng() * 0.6, rot: rng() * Math.PI * 2, y: 0.026 + rng() * 0.012 });
    }
  }
  // Lily-pad beds wherever the dam spec puts them, plus the odd stray raft.
  for (const zone of zones('pads')) {
    const clusters = Math.round(zone.width * zone.reach * zone.density * 0.06);
    for (let i = 0; i < clusters; i++) padCluster(zoneX(zone), 1.5 + rng() * zone.reach * 0.8, 9);
  }
  for (let i = 0; i < 8; i++) {
    const x = (rng() - 0.5) * 200;
    if (!nearStand(x, 5)) padCluster(x, 2 + rng() * 10, 3);
  }

  const padGeo = new THREE.PlaneGeometry(1, 1);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    map: lilyPadTexture(), alphaTest: 0.5, roughness: 0.32, side: THREE.DoubleSide,
  });
  const lily = new THREE.InstancedMesh(padGeo, padMat, Math.max(1, pads.length));
  pads.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(p.s, 1, p.s);
    dummy.updateMatrix();
    lily.setMatrixAt(i, dummy.matrix);
    const v = rng();
    lily.setColorAt(i, color.setRGB(0.85 + v * 0.3, 0.9 + v * 0.2, 0.85 + v * 0.2));
  });
  lily.count = pads.length;
  lily.receiveShadow = true;
  scene.add(lily);

  // Blooms on roughly one pad in six: white, pink, and the native blue lily.
  const bloomPads = pads.filter(() => rng() < 0.17);
  const FLOWER_TINTS = [0xffffff, 0xf4a9c8, 0x8f8ff0, 0xffffff, 0xf7c4da];
  const petalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(lilyFlowerGeometry(), petalMat, Math.max(1, bloomPads.length));
  const centerGeo = new THREE.SphereGeometry(0.024, 8, 6);
  centerGeo.scale(1, 0.5, 1);
  const centers = new THREE.InstancedMesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0xffc629, emissive: 0x3a2800, roughness: 0.6 }), Math.max(1, bloomPads.length));
  bloomPads.forEach((p, i) => {
    const s = 1.2 + rng() * 0.5;
    dummy.position.set(p.x + (rng() - 0.5) * p.s * 0.3, p.y + 0.012, p.z + (rng() - 0.5) * p.s * 0.3);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
    centers.setMatrixAt(i, dummy.matrix);
    petals.setColorAt(i, color.set(FLOWER_TINTS[Math.floor(rng() * FLOWER_TINTS.length)]));
  });
  petals.count = bloomPads.length;
  centers.count = bloomPads.length;
  scene.add(petals, centers);

  // ─── Water hyacinth ───────────────────────────────────────────────────────
  // The invasive floating weed that mats over Hartbeespoort (and Roodeplaat
  // in bad years): rosettes of glossy, round leaves on swollen floats, with
  // lilac flower spikes, drifting in dense rafts against the banks and bays.
  const hyacinthCount = location.scenery?.water?.hyacinth ?? 0;
  let hyacinth = null;
  if (hyacinthCount > 0) {
    const plants = [];
    const hyZones = zones('hyacinth');
    const mats = Math.max(1, Math.round(hyacinthCount / 70));
    for (let m = 0; m < mats && hyZones.length; m++) {
      const zone = hyZones[m % hyZones.length];
      // Rafts pile up against the bank inside the zone, a few drift out.
      const [mx, mz] = offBank(zoneX(zone), 1 + Math.pow(rng(), 1.5) * zone.reach);
      const matR = 1.5 + rng() * 3.5;
      const n = Math.round(hyacinthCount / mats);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * matR;
        const x = mx + Math.cos(a) * r * 1.4, z = mz + Math.sin(a) * r;
        if (dam.waterDist(x, z) < 0.3 || dam.standAt(x, z)) continue;
        plants.push({ x, z, s: 1.1 + rng() * 1.2, rot: rng() * Math.PI * 2, flower: rng() < 0.3 });
      }
    }

    const rosette = [];
    for (let k = 0; k < 7; k++) {
      const leaf = new THREE.CircleGeometry(0.06, 10);
      leaf.scale(1, 0.85, 1);
      leaf.translate(0, 0.07, 0);
      leaf.rotateX(-0.9 - rng() * 0.3); // leaves stand up and out
      leaf.rotateY((k / 7) * Math.PI * 2 + rng() * 0.3);
      leaf.translate(0, 0.015, 0);
      const col = [];
      for (let v = 0; v < leaf.getAttribute('position').count; v++) col.push(0.2, 0.46, 0.12);
      leaf.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      rosette.push(leaf);
      const float = new THREE.SphereGeometry(0.018, 6, 5);
      float.translate(Math.cos((k / 7) * Math.PI * 2) * 0.03, 0.012, -Math.sin((k / 7) * Math.PI * 2) * 0.03);
      const fcol = [];
      for (let v = 0; v < float.getAttribute('position').count; v++) fcol.push(0.35, 0.55, 0.2);
      float.setAttribute('color', new THREE.Float32BufferAttribute(fcol, 3));
      rosette.push(float);
    }
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: THREE.DoubleSide });
    hyacinth = new THREE.InstancedMesh(mergeIndexed(rosette), leafMat, Math.max(1, plants.length));
    const flowers = plants.filter((p) => p.flower);
    const spikeParts = [];
    const stalk = new THREE.CylinderGeometry(0.004, 0.006, 0.2, 5);
    stalk.translate(0, 0.1, 0);
    const scol = [];
    for (let v = 0; v < stalk.getAttribute('position').count; v++) scol.push(0.3, 0.45, 0.2);
    stalk.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3));
    spikeParts.push(stalk);
    for (let k = 0; k < 8; k++) {
      const bloom = new THREE.SphereGeometry(0.022, 6, 5);
      const a = k * 2.1;
      bloom.translate(Math.cos(a) * 0.022, 0.13 + k * 0.012, Math.sin(a) * 0.022);
      const bcol = [];
      for (let v = 0; v < bloom.getAttribute('position').count; v++) bcol.push(0.66, 0.52, 0.86);
      bloom.setAttribute('color', new THREE.Float32BufferAttribute(bcol, 3));
      spikeParts.push(bloom);
    }
    const spikes = new THREE.InstancedMesh(mergeIndexed(spikeParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), Math.max(1, flowers.length));
    let f = 0;
    plants.forEach((p, i) => {
      dummy.position.set(p.x, 0.01, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      hyacinth.setMatrixAt(i, dummy.matrix);
      const v = rng();
      hyacinth.setColorAt(i, color.setRGB(0.85 + v * 0.3, 0.9 + v * 0.25, 0.8 + v * 0.2));
      if (p.flower) spikes.setMatrixAt(f++, dummy.matrix);
    });
    hyacinth.count = plants.length;
    spikes.count = flowers.length;
    hyacinth.receiveShadow = true;
    scene.add(hyacinth, spikes);
  }

  return { reeds, cattails, lily, petals, hyacinth };
}
