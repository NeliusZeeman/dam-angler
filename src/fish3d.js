import * as THREE from '../vendor/three.module.js';
import { fishSkinTexture, finRayTexture } from './gfx/pixelTextures.js';
import { mergeGeometries } from './gfx/terrain.js';

// Each species: size, body proportions, fin layout and a skin recipe that
// fishSkinTexture paints pixel by pixel (back/belly colours, scale pattern,
// markings).
//   fins: 'perch'   spiny front dorsal joined to a soft rear lobe (bass, tilapia)
//         'carp'    one long dorsal, tall at the front
//         'tiger'   short tall dorsal plus a little adipose fin
//         'catfish' low dorsal and anal fins running most of the body
//   tail: 'forked' | 'notched' | 'round'
const SPECIES_LOOK = {
  'mozambique-tilapia': {
    scale: 1.0, shape: [1, 1.05, 0.55], fin: 0x5f6a6a, metal: 0.15, fins: 'perch', tail: 'notched',
    skin: { back: [70, 86, 92], belly: [205, 212, 206], scales: 26, scaleContrast: 0.25, bars: { count: 14, strength: 0.16 }, seed: 1 },
  },
  'banded-tilapia': {
    scale: 0.75, shape: [1, 1.05, 0.55], fin: 0x6f7a4a, metal: 0.12, fins: 'perch', tail: 'notched',
    skin: { back: [88, 102, 60], belly: [204, 198, 150], scales: 26, scaleContrast: 0.22, bars: { count: 16, strength: 0.5 }, seed: 2 },
  },
  'common-carp': {
    scale: 1.3, shape: [1.05, 1.1, 0.6], fin: 0x8a6a3a, metal: 0.2, fins: 'carp', tail: 'forked',
    skin: { back: [96, 78, 40], belly: [228, 192, 112], scales: 15, scaleContrast: 0.45, seed: 3 },
    barbels: 2,
  },
  'mirror-carp': {
    scale: 1.5, shape: [1.05, 1.15, 0.62], fin: 0x7a5e38, metal: 0.25, fins: 'carp', tail: 'forked',
    skin: { back: [92, 76, 44], belly: [216, 188, 122], mirror: true, seed: 4 },
    barbels: 2,
  },
  'largemouth-bass': {
    scale: 1.15, shape: [1.08, 0.95, 0.58], fin: 0x5d7240, metal: 0.12, spiky: true, fins: 'perch', tail: 'notched',
    skin: { back: [58, 80, 40], belly: [224, 228, 192], scales: 30, scaleContrast: 0.2, lateral: { at: 0.05, width: 0.28, strength: 0.55 }, seed: 5 },
  },
  'smallmouth-bass': {
    scale: 0.95, shape: [1.08, 0.92, 0.56], fin: 0x806a40, metal: 0.12, spiky: true, fins: 'perch', tail: 'notched',
    skin: { back: [104, 86, 52], belly: [212, 198, 152], scales: 30, scaleContrast: 0.2, bars: { count: 18, strength: 0.35 }, seed: 6 },
  },
  catfish: {
    scale: 1.7, shape: [1.3, 0.72, 0.72], fin: 0x3a3a38, metal: 0.05, fins: 'catfish', tail: 'round',
    skin: { back: [52, 52, 50], belly: [172, 168, 158], spots: 0.45, seed: 7 },
    barbels: 8,
  },
  tigerfish: {
    scale: 1.1, shape: [1.2, 0.85, 0.5], fin: 0xd9542b, metal: 0.4, spiky: true, teeth: true, fins: 'tiger', tail: 'forked',
    skin: { back: [108, 116, 112], belly: [234, 238, 234], scales: 34, scaleContrast: 0.18, stripes: { count: 3.2, width: 0.2, strength: 0.75 }, seed: 8 },
  },
  // Streamlined, big-scaled, olive-gold back and brassy-yellow flanks.
  'smallmouth-yellowfish': {
    scale: 1.05, shape: [1.12, 0.92, 0.52], fin: 0x9a8448, metal: 0.35, fins: 'carp', tail: 'forked',
    skin: { back: [104, 96, 48], belly: [230, 208, 128], scales: 17, scaleContrast: 0.38, seed: 9 },
    barbels: 2,
  },
  // Deeper and heavier-headed than the smallmouth, with bigger scales and a
  // bronze-olive to silvery-gold sheen.
  'largescale-yellowfish': {
    scale: 1.2, shape: [1.12, 1.0, 0.56], fin: 0x8a7a48, metal: 0.35, fins: 'carp', tail: 'forked',
    skin: { back: [92, 92, 58], belly: [222, 212, 156], scales: 12, scaleContrast: 0.45, seed: 11 },
    barbels: 2,
  },
  // Long, round-bellied grey-olive labeo with a fleshy sucker mouth.
  mudfish: {
    scale: 1.0, shape: [1.15, 0.82, 0.56], fin: 0x5c6258, metal: 0.12, fins: 'carp', tail: 'forked',
    skin: { back: [74, 80, 72], belly: [194, 194, 180], scales: 22, scaleContrast: 0.3, seed: 10 },
    barbels: 2,
  },
};

// The body runs from the tail stalk (t=0) to the snout (t=1) along +x.
const BODY_X0 = -0.2, BODY_X1 = 0.26;
// Half-height and half-width of the body at nine even stations tail->snout.
const HALF_HEIGHT = [0.024, 0.036, 0.062, 0.088, 0.102, 0.104, 0.094, 0.072, 0.05];
const HALF_WIDTH = [0.012, 0.018, 0.03, 0.042, 0.05, 0.052, 0.05, 0.043, 0.032];
const RINGS = 40, SEGMENTS = 24;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Catmull-Rom through evenly spaced samples.
function curve(samples, t) {
  const n = samples.length - 1;
  const f = clamp01(t) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  const p0 = samples[Math.max(0, i - 1)], p1 = samples[i], p2 = samples[i + 1], p3 = samples[Math.min(n, i + 2)];
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
}

// Body cross-section at t: centre line, half-height and half-width, in the
// species' own proportions. The snout rounds off rather than coming to a point.
function bodyAt(look, t) {
  const [len, depth, width] = look.shape;
  const nose = t > 0.84 ? Math.sqrt(Math.max(0, 1 - ((t - 0.84) / 0.16) ** 2)) : 1;
  return {
    x: (BODY_X0 + (BODY_X1 - BODY_X0) * t) * len,
    cy: -0.012 * Math.sin(Math.PI * t) * depth, // a little belly sag
    h: curve(HALF_HEIGHT, t) * depth * nose,
    w: curve(HALF_WIDTH, t) * (width / 0.55) * nose,
  };
}

function buildBody(look) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    const b = bodyAt(look, t);
    for (let j = 0; j <= SEGMENTS; j++) {
      const u = j / SEGMENTS;
      const phi = u * Math.PI * 2;
      // Same wrap as the skin texture: top of the fish where -sin(phi) = 1.
      pos.push(b.x, b.cy - Math.sin(phi) * b.h, Math.cos(phi) * b.w);
      uv.push(u, t);
    }
  }
  const row = SEGMENTS + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * row + j, b = a + row;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Cap the tail stalk (the tail fin sits over it).
  const b0 = bodyAt(look, 0);
  const centre = pos.length / 3;
  pos.push(b0.x, b0.cy, 0); uv.push(0.5, 0);
  for (let j = 0; j < SEGMENTS; j++) idx.push(centre, j + 1, j);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // The texture seam runs down the flank; average its normals so it doesn't
  // show as a crease.
  const n = geo.attributes.normal;
  for (let i = 0; i <= RINGS; i++) {
    const a = i * row, b = a + SEGMENTS;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}

// A fin membrane between a root line (rooted inside the body so it grows out
// of it) and a tip line, both functions of s in 0..1. u runs along the root,
// v from root (0) to edge (1) -- the fin-ray texture's layout.
function membrane(root, tip, cols = 14, rows = 3) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= cols; i++) {
    const s = i / cols;
    const r = root(s), e = tip(s);
    for (let k = 0; k <= rows; k++) {
      const v = k / rows;
      pos.push(r.x + (e.x - r.x) * v, r.y + (e.y - r.y) * v, r.z + (e.z - r.z) * v);
      uv.push(s, v);
    }
  }
  const row = rows + 1;
  for (let i = 0; i < cols; i++) {
    for (let k = 0; k < rows; k++) {
      const a = i * row + k, b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo.toNonIndexed();
}

const V = (x, y, z = 0) => ({ x, y, z });

// Dorsal-fin height along its root (s=0 rear, s=1 front), as a fraction of
// the fin's full height.
const DORSAL = {
  perch: { t0: 0.3, t1: 0.74, height: 0.07, profile: (s, spiky) => Math.max(
    Math.pow(Math.sin(Math.PI * clamp01(s / 0.45)), 0.7) * (s < 0.45 ? 1 : 0),
    s > 0.4 ? (spiky ? 0.45 + 0.35 * Math.pow(Math.abs(Math.cos(s * Math.PI * 8)), 4) : 0.62) * smooth(0.38, 0.48, s) : 0,
  ) },
  carp: { t0: 0.36, t1: 0.8, height: 0.065, profile: (s) => 0.28 + 0.72 * Math.pow(s, 2.5) },
  tiger: { t0: 0.46, t1: 0.63, height: 0.085, profile: (s) => 0.15 + 0.85 * Math.pow(s, 1.4) },
  catfish: { t0: 0.1, t1: 0.74, height: 0.04, profile: (s) => Math.sqrt(Math.sin(Math.PI * s)) },
};
const ANAL = {
  perch: { t0: 0.14, t1: 0.32, height: 0.05 },
  carp: { t0: 0.12, t1: 0.26, height: 0.05 },
  tiger: { t0: 0.12, t1: 0.3, height: 0.055 },
  catfish: { t0: 0.06, t1: 0.52, height: 0.035 },
};
// Tail-fin reach as a function of the vertical position sv (-1 bottom, 1 top).
const TAIL = {
  forked: { len: 0.15, half: 0.1, reach: (sv) => 0.45 + 0.55 * Math.pow(Math.abs(sv), 1.3) },
  notched: { len: 0.12, half: 0.085, reach: (sv) => 0.78 + 0.22 * Math.abs(sv) },
  round: { len: 0.1, half: 0.06, reach: (sv) => 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - sv * sv)) },
};

function buildFins(look) {
  const [len, depth] = look.shape;
  const style = look.fins || 'perch';
  const fins = [];

  // Dorsal: rooted just under the top of the back, raked backwards.
  const d = DORSAL[style];
  fins.push(membrane(
    (s) => { const b = bodyAt(look, d.t0 + (d.t1 - d.t0) * s); return V(b.x, b.cy + b.h * 0.8); },
    (s) => {
      const b = bodyAt(look, d.t0 + (d.t1 - d.t0) * s);
      const hgt = d.height * depth * Math.max(0.04, d.profile(s, look.spiky));
      return V(b.x - hgt * 0.45, b.cy + b.h + hgt);
    },
    style === 'perch' ? 28 : 16,
  ));
  if (style === 'tiger') {
    // Small fleshy adipose fin near the tail.
    fins.push(membrane(
      (s) => { const b = bodyAt(look, 0.12 + 0.07 * s); return V(b.x, b.cy + b.h * 0.8); },
      (s) => { const b = bodyAt(look, 0.12 + 0.07 * s); return V(b.x - 0.01, b.cy + b.h + 0.022 * depth * Math.sin(Math.PI * s)); },
      6, 2,
    ));
  }

  // Anal fin on the underside toward the tail.
  const a = ANAL[style];
  fins.push(membrane(
    (s) => { const b = bodyAt(look, a.t0 + (a.t1 - a.t0) * s); return V(b.x, b.cy - b.h * 0.8); },
    (s) => {
      const b = bodyAt(look, a.t0 + (a.t1 - a.t0) * s);
      const hgt = a.height * depth * (style === 'catfish' ? Math.sqrt(Math.sin(Math.PI * s)) : Math.pow(Math.sin(Math.PI * s), 0.6) * (0.5 + 0.5 * s));
      return V(b.x - hgt * 0.5, b.cy - b.h - Math.max(0.002, hgt));
    },
    12,
  ));

  // Paired fins: pelvics on the belly, pectorals on the flanks behind the gill.
  for (const side of [1, -1]) {
    const pel = bodyAt(look, 0.58);
    fins.push(membrane(
      (s) => { const b = bodyAt(look, 0.54 + 0.08 * s); return V(b.x, b.cy - b.h * 0.85, side * b.w * 0.35); },
      (s) => {
        const b = bodyAt(look, 0.54 + 0.08 * s);
        const r = 0.045 * depth * (0.3 + 0.7 * s);
        return V(b.x - r * 0.9, pel.cy - pel.h - r * 0.55, side * (b.w * 0.35 + r * 0.5));
      },
      6,
    ));
    const pec = bodyAt(look, 0.7);
    fins.push(membrane(
      (s) => { const b = bodyAt(look, 0.67 + 0.06 * s); return V(b.x, b.cy - b.h * 0.3, side * b.w * 0.9); },
      (s) => {
        const r = (style === 'catfish' ? 0.05 : 0.065) * (0.35 + 0.65 * Math.sin(Math.PI * (0.3 + 0.7 * s)));
        return V(pec.x - 0.03 * len + (s - 0.5) * 0.02 - r * 0.8, pec.cy - pec.h * 0.4 - r * 0.25, side * (pec.w * 0.95 + r * 0.6));
      },
      8,
    ));
  }

  // Caudal fin, rooted around the tail stalk so it reads as one piece.
  const tail = TAIL[look.tail || 'forked'];
  const stalk = bodyAt(look, 0.02);
  fins.push(membrane(
    (s) => { const sv = s * 2 - 1; return V(stalk.x, stalk.cy + sv * stalk.h * 0.95); },
    (s) => {
      const sv = s * 2 - 1;
      return V(stalk.x - tail.len * len * tail.reach(sv), stalk.cy + sv * tail.half * depth);
    },
    18, 4,
  ));

  return mergeGeometries(fins);
}

const skinCache = new Map();
function skinFor(speciesId) {
  if (!skinCache.has(speciesId)) {
    const look = SPECIES_LOOK[speciesId] || SPECIES_LOOK['mozambique-tilapia'];
    skinCache.set(speciesId, fishSkinTexture(look.skin));
  }
  return skinCache.get(speciesId);
}
let finTexture = null;

// Geometry is built once per species and shared by every fish of that
// species: the body is one closed skin and all the fins one merged mesh.
const partsCache = new Map();
function speciesParts(speciesId) {
  if (partsCache.has(speciesId)) return partsCache.get(speciesId);
  const look = SPECIES_LOOK[speciesId] || SPECIES_LOOK['mozambique-tilapia'];
  const parts = { look, bodyGeo: buildBody(look), finGeo: buildFins(look) };
  partsCache.set(speciesId, parts);
  return parts;
}

// The whole fish swims: a wave runs from behind the head to the tail tip,
// bending body and fins together, so nothing hinges apart. Uniforms are per
// fish; the program is shared by every fish.
function applySwim(material, swim) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, swim);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uSwimPhase; uniform float uSwimAmp; uniform float uSwimHead; uniform float uSwimSpan; uniform float uSwimK;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float tailness = clamp((uSwimHead - transformed.x) / uSwimSpan, 0.0, 1.0);
        transformed.z += sin(uSwimPhase + transformed.x * uSwimK) * uSwimAmp * tailness * tailness;`);
  };
  material.customProgramCacheKey = () => 'fish-swim';
}

// Drive a fish's swimming: phase advances with time, amp is how hard it beats.
export function setFishSwim(mesh, phase, amp = 1) {
  const swim = mesh.userData.swim;
  if (!swim) return;
  swim.uSwimPhase.value = phase;
  swim.uSwimAmp.value = swim.baseAmp * amp;
}

// detail=false (the ambient swarm) skips eyes, teeth and whiskers -- they're
// only visible on the close-up catch.
export function createFishMesh(speciesId, { detail = true } = {}) {
  const { look, bodyGeo, finGeo } = speciesParts(speciesId);
  const [len, depth] = look.shape;
  if (!finTexture) finTexture = finRayTexture();

  const swim = {
    uSwimPhase: { value: Math.random() * 6 },
    uSwimAmp: { value: 0.045 * len },
    uSwimHead: { value: 0.1 * len },
    uSwimSpan: { value: (0.1 + 0.36) * len },
    uSwimK: { value: 11 / len },
  };
  swim.baseAmp = swim.uSwimAmp.value;

  const bodyMat = new THREE.MeshStandardMaterial({ map: skinFor(speciesId), roughness: 0.32, metalness: look.metal });
  const finMat = new THREE.MeshStandardMaterial({
    map: finTexture, color: look.fin, roughness: 0.55, side: THREE.DoubleSide, alphaTest: 0.5,
  });
  applySwim(bodyMat, swim);
  applySwim(finMat, swim);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(bodyGeo, bodyMat));
  group.add(new THREE.Mesh(finGeo, finMat));
  group.userData.swim = swim;
  group.scale.setScalar(look.scale);
  if (!detail) return group;

  // Eyes sit in the side of the head, just proud of the skin.
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xd9c36a, roughness: 0.2 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.2 });
  const head = bodyAt(look, 0.88);
  const eyeR = 0.017 * Math.min(1.2, depth);
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 12, 8), eyeWhite);
    eye.scale.z = 0.6;
    const ey = head.h * 0.28;
    eye.position.set(head.x, head.cy + ey, side * (head.w * Math.sqrt(1 - 0.28 * 0.28) - eyeR * 0.25));
    const p = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.6, 8, 6), pupil);
    p.position.set(eyeR * 0.1, 0, side * eyeR * 0.6);
    eye.add(p);
    group.add(eye);
  }

  const snout = BODY_X1 * len;
  if (look.barbels) {
    const barbelMat = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.7 });
    for (let i = 0; i < look.barbels; i++) {
      const side = i % 2 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const pts = [];
      const reach = look.barbels > 2 ? 0.12 + tier * 0.03 : 0.05;
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        pts.push(new THREE.Vector3(snout - 0.01 + t * reach * 0.6, -0.015 - tier * 0.008 - t * t * 0.05, side * (0.015 + t * reach * 0.7)));
      }
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.003, 4), barbelMat));
    }
  }

  if (look.teeth) {
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.3 });
    for (let i = 0; i < 6; i++) {
      for (const jaw of [1, -1]) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.018, 4), toothMat);
        const a = (i / 5 - 0.5) * 1.6;
        tooth.position.set(snout - 0.012 - Math.abs(a) * 0.02, jaw * 0.008, Math.sin(a) * 0.022);
        tooth.rotation.z = jaw > 0 ? Math.PI : 0;
        group.add(tooth);
      }
    }
  }

  return group;
}

export function createFishSwarm(scene, speciesIds, count, dam) {
  const fishes = [];
  for (let i = 0; i < count; i++) {
    const speciesId = speciesIds[i % speciesIds.length];
    const mesh = createFishMesh(speciesId, { detail: false });
    // Each fish patrols a lazy circle somewhere in the water off the bank,
    // within sight of the stands, never close enough to swim onto the sand.
    const radius = 2 + Math.random() * 7;
    const cx = dam.spawn.x + (Math.random() - 0.5) * 90;
    const cz = dam.shoreZ(cx) + radius + 3 + Math.pow(Math.random(), 1.4) * 60;
    const angle = Math.random() * Math.PI * 2;
    mesh.userData.orbitCenter = { x: cx, z: cz };
    mesh.userData.orbitRadius = radius;
    mesh.userData.orbitAngle = angle;
    mesh.userData.orbitSpeed = 0.06 + Math.random() * 0.1;
    // Shallow enough to be seen through the water surface, but deep enough
    // that the body (which scales with the fish) stays fully under y=0 --
    // bigger species need more clearance or their back pokes through.
    const scale = mesh.scale.x;
    mesh.userData.depth = -(0.25 + 0.22 * scale) - Math.random() * 0.3;
    // Each fish breaches the surface now and then on its own timer.
    mesh.userData.jumpPeriod = 14 + Math.random() * 30;
    mesh.userData.jumpPhase = Math.random() * 40;
    mesh.userData.wasJumping = false;
    mesh.visible = true;
    scene.add(mesh);
    fishes.push(mesh);
  }
  return fishes;
}

// onBreach(position) fires as a fish leaves the water and again as it
// drops back in, so jumps throw up a splash.
export function updateFishSwarm(fishes, elapsedSeconds, onBreach = null) {
  for (const fish of fishes) {
    const { orbitRadius, orbitSpeed, depth, jumpPeriod, jumpPhase } = fish.userData;
    const angle = fish.userData.orbitAngle + elapsedSeconds * orbitSpeed;
    const { x: cx, z: cz } = fish.userData.orbitCenter;
    const x = cx + Math.cos(angle) * orbitRadius;
    const z = cz + Math.sin(angle) * orbitRadius;

    // A short arc above the water once per jumpPeriod seconds.
    const cycle = (elapsedSeconds + jumpPhase) % jumpPeriod;
    const jumping = cycle < 1.0;
    const jump = jumping ? Math.sin(cycle * Math.PI) * 0.8 : 0;

    fish.position.set(x, depth + Math.sin(elapsedSeconds * 2 + orbitRadius) * 0.06 + jump, z);
    fish.rotation.y = -angle - Math.PI / 2;
    fish.rotation.z = jump > 0 ? Math.sin(cycle * Math.PI) * 0.9 : 0;
    setFishSwim(fish, elapsedSeconds * 7 + orbitRadius * 3, jumping ? 1.6 : 0.8);
    if (onBreach && jumping !== fish.userData.wasJumping) {
      onBreach(fish.position.clone().setY(0));
    }
    fish.userData.wasJumping = jumping;
  }
}

export function createCatchReveal(scene, onSplash = null) {
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
    if (onSplash) onSplash(mesh.position.clone(), 1.6);
  }

  function update(deltaSeconds) {
    if (!active) return;
    active.age += deltaSeconds;
    const t = active.age / active.duration;
    active.mesh.position.y = Math.sin(Math.min(1, t) * Math.PI) * 1.4;
    active.mesh.rotation.z = Math.sin(active.age * 6) * 0.3;
    active.mesh.rotation.y += deltaSeconds * 2;
    // Thrashing on the line.
    setFishSwim(active.mesh, active.age * 14, 2);
    if (t >= 1) {
      scene.remove(active.mesh);
      active = null;
    }
  }

  return { spawn, update };
}
