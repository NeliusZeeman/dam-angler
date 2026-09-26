import * as THREE from '../../vendor/three.module.js';
import { makeRng, seedFromString } from './noise.js';
import { addWindToMaterial } from './wind.js';
import { barkTexture, willowStrandTexture, acaciaLeafTexture, gumLeafTexture } from './pixelTextures.js';

// Geometry accumulator: every tree of a kind is merged into one mesh per
// material, so ~100 trees cost a handful of draw calls.
class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.sway = []; this.idx = []; }
  vert(p, n, u, v, s) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.sway.push(s);
    return this.pos.length / 3 - 1;
  }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// A tapered tube along a polyline (trunks and branches).
function addTube(b, points, radii, sides = 7, sway = 0) {
  let vAcc = 0;
  const rings = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    const ref = Math.abs(t.y) > 0.95 ? v3(1, 0, 0) : UP;
    const n = new THREE.Vector3().crossVectors(t, ref).normalize();
    const bn = new THREE.Vector3().crossVectors(t, n).normalize();
    if (i > 0) vAcc += points[i].distanceTo(points[i - 1]);
    const ring = [];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const dir = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(bn, Math.sin(a));
      const p = points[i].clone().addScaledVector(dir, radii[i]);
      ring.push(b.vert(p, dir, s / sides, vAcc * 0.35, sway * (i / (points.length - 1))));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < sides; s++) b.quad(rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], rings[i + 1][s]);
  }
}

// A leaf card. Normals point away from the canopy centre so the crown
// shades like a soft volume rather than a pile of flat planes.
function addCard(b, center, right, up, canopyCenter, swayTop, swayBottom) {
  const corners = [
    center.clone().sub(right).sub(up), center.clone().add(right).sub(up),
    center.clone().add(right).add(up), center.clone().sub(right).add(up),
  ];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const ids = corners.map((p, i) => {
    const n = p.clone().sub(canopyCenter).normalize().lerp(UP, 0.35).normalize();
    return b.vert(p, n, uvs[i][0], uvs[i][1], i < 2 ? swayBottom : swayTop);
  });
  b.quad(ids[0], ids[1], ids[2], ids[3]);
}

function curve(a, b, lift, segments = 3) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = a.clone().lerp(b, t);
    p.y += Math.sin(t * Math.PI) * lift;
    pts.push(p);
  }
  return pts;
}

function taper(n, r0, r1) {
  return Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / Math.max(1, n - 1)));
}

// ─── Species ────────────────────────────────────────────────────────────────

function buildWillow(bark, leaves, base, rng, scale, leanDir = null) {
  const lean = leanDir ?? rng() * Math.PI * 2;
  const leanAmt = (0.3 + rng() * 0.5) * scale;
  const trunkH = (2.5 + rng() * 1.1) * scale;
  const top = base.clone().add(v3(Math.cos(lean) * leanAmt, trunkH, Math.sin(lean) * leanAmt));
  const trunkPts = [base.clone().setY(base.y - 0.2), base.clone().lerp(top, 0.5).add(v3(0, 0, 0)), top];
  addTube(bark, trunkPts, [0.34 * scale, 0.27 * scale, 0.2 * scale], 8);

  const R = (2.4 + rng() * 0.9) * scale;
  const crown = top.clone().add(v3(Math.cos(lean) * 0.4, 1.2 * scale, Math.sin(lean) * 0.4));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rng() * 0.5;
    const end = crown.clone().add(v3(Math.cos(a) * R * 0.7, 0.4 * scale + rng() * 0.6, Math.sin(a) * R * 0.7));
    addTube(bark, curve(top, end, 0.7 * scale), taper(4, 0.12 * scale, 0.035 * scale), 5);
  }
  // Hanging strands over the whole dome; the ones near the top are short and
  // drape over the crown, the ones round the rim sweep nearly to the ground.
  const STRANDS = 150;
  for (let i = 0; i < STRANDS; i++) {
    const a = rng() * Math.PI * 2;
    const e = Math.pow(rng(), 0.8) * 1.45;
    const out = v3(Math.cos(a), 0, Math.sin(a));
    const attach = crown.clone().add(v3(out.x * Math.cos(e) * R, Math.sin(e) * R * 0.55, out.z * Math.cos(e) * R));
    const drape = e > 1.0 ? 0.6 + rng() * 0.6 : (1.6 + rng() * 2.4) * (1 - e * 0.35);
    let L = drape * scale;
    L = Math.max(0.5, Math.min(L, attach.y - base.y - 0.35));
    const w = (0.32 + rng() * 0.22) * scale;
    const center = attach.clone().add(v3(out.x * 0.1, -L / 2 + 0.08, out.z * 0.1));
    const up = v3(out.x * 0.08, L / 2, out.z * 0.08);
    const tangent = v3(-out.z, 0, out.x);
    const twist = (rng() - 0.5) * 1.2;
    const right = tangent.clone().multiplyScalar(Math.cos(twist)).addScaledVector(out, Math.sin(twist)).multiplyScalar(w / 2);
    addCard(leaves, center, right, up, crown, 0.05, 1);
  }
}

function buildAcacia(bark, leaves, base, rng, scale) {
  const trunkH = (1.5 + rng() * 0.8) * scale;
  const lean = rng() * Math.PI * 2;
  const trunkTop = base.clone().add(v3(Math.cos(lean) * 0.25, trunkH, Math.sin(lean) * 0.25));
  addTube(bark, [base.clone().setY(base.y - 0.2), base.clone().lerp(trunkTop, 0.5), trunkTop], [0.26 * scale, 0.2 * scale, 0.16 * scale], 7);

  const canopyY = trunkH + (1.9 + rng() * 0.6) * scale;
  const Rc = (2.6 + rng() * 1.3) * scale;
  const center = base.clone().add(v3(0, canopyY, 0));
  const nBranches = 3 + Math.floor(rng() * 3);
  for (let k = 0; k < nBranches; k++) {
    const a = (k / nBranches) * Math.PI * 2 + rng() * 0.6;
    const end = base.clone().add(v3(Math.cos(a) * Rc * 0.6, canopyY - 0.15, Math.sin(a) * Rc * 0.6));
    const mid = trunkTop.clone().lerp(end, 0.45).add(v3(0, 0.25 * scale, 0));
    addTube(bark, [trunkTop, mid, end], [0.13 * scale, 0.09 * scale, 0.04 * scale], 5);
  }
  const CARDS = 60;
  for (let i = 0; i < CARDS; i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * Rc;
    const f = rr / Rc;
    const c = center.clone().add(v3(Math.cos(a) * rr, (rng() - 0.5) * 0.45 * scale + (1 - f * f) * 0.35 * scale, Math.sin(a) * rr));
    const s = (1.1 + rng() * 0.7) * scale;
    const b2 = rng() * Math.PI;
    const right = v3(Math.cos(b2), (rng() - 0.5) * 0.3, Math.sin(b2)).multiplyScalar(s / 2);
    const fwd = v3(-Math.sin(b2), (rng() - 0.5) * 0.5, Math.cos(b2)).multiplyScalar(s / 2);
    addCard(leaves, c, right, fwd, center.clone().setY(center.y - 1.5), 0.3 + f * 0.5, 0.3 + f * 0.5);
  }
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const c = center.clone().add(v3(Math.cos(a) * Rc * 0.92, -0.1, Math.sin(a) * Rc * 0.92));
    const s = (0.9 + rng() * 0.5) * scale;
    addCard(leaves, c, v3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(s / 2), v3(0, s * 0.3, 0), center, 0.8, 0.5);
  }
}

function buildGum(bark, leaves, base, rng, scale) {
  const H = (7 + rng() * 4) * scale;
  const bendDir = rng() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push(base.clone().add(v3(Math.cos(bendDir) * t * t * 0.9, t * H - (i === 0 ? 0.3 : 0), Math.sin(bendDir) * t * t * 0.9)));
  }
  addTube(bark, pts, taper(6, 0.38 * scale, 0.1 * scale), 8);
  const clusters = [];
  const nBranches = 4 + Math.floor(rng() * 3);
  for (let k = 0; k < nBranches; k++) {
    const t = 0.45 + rng() * 0.45;
    const from = pts[0].clone().lerp(pts[5], t);
    const a = rng() * Math.PI * 2;
    const len = (1.5 + rng() * 1.8) * scale;
    const end = from.clone().add(v3(Math.cos(a) * len, len * 0.7, Math.sin(a) * len));
    addTube(bark, curve(from, end, 0.3), taper(4, 0.1 * scale, 0.03 * scale), 5);
    clusters.push(end, from.clone().lerp(end, 0.55));
  }
  clusters.push(pts[5].clone().add(v3(0, 0.6, 0)));
  const crown = pts[0].clone().lerp(pts[5], 0.8);
  for (const c of clusters) {
    for (let k = 0; k < 3; k++) {
      const s = (1.6 + rng() * 0.9) * scale;
      const a = (k / 3) * Math.PI + rng() * 0.4;
      const cc = c.clone().add(v3((rng() - 0.5) * 0.8, (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.8));
      addCard(leaves, cc, v3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(s / 2), v3(0, s / 2, 0), crown, 0.2, 0.7);
    }
  }
}

// A drowned tree: bleached trunk standing in the water, a few snapped limbs.
function buildSnag(bark, base, rng) {
  const H = 1.4 + rng() * 2.4;
  const lean = rng() * Math.PI * 2, leanAmt = rng() * 0.6;
  const top = base.clone().add(v3(Math.cos(lean) * leanAmt, H, Math.sin(lean) * leanAmt));
  addTube(bark, [base.clone().setY(-1.2), base.clone().lerp(top, 0.5), top], [0.22, 0.17, 0.08], 6);
  const limbs = 1 + Math.floor(rng() * 3);
  for (let k = 0; k < limbs; k++) {
    const from = base.clone().lerp(top, 0.4 + rng() * 0.5);
    const a = rng() * Math.PI * 2, len = 0.5 + rng() * 1.2;
    const end = from.clone().add(v3(Math.cos(a) * len, len * (0.3 + rng() * 0.6), Math.sin(a) * len));
    addTube(bark, [from, end], [0.07, 0.02], 5);
  }
}

// ─── Materials & seasons ────────────────────────────────────────────────────

const SEASON_TINT = {
  willow: { summer: [0xb8d890, 0.5], autumn: [0xe8c45a, 0.55], winter: [0xa8986c, 0.86], spring: [0xd4f2a0, 0.5] },
  acacia: { summer: [0x9cc27a, 0.5], autumn: [0xb8b070, 0.52], winter: [0x9a9468, 0.66], spring: [0xacd88a, 0.5] },
  gum: { summer: [0xa8bca8, 0.5], autumn: [0xa8b8a0, 0.5], winter: [0x9eb0a0, 0.5], spring: [0xb0c8ae, 0.5] },
};

function leafMaterial(map, windAmount) {
  const mat = addWindToMaterial(new THREE.MeshStandardMaterial({
    map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, color: 0xffffff,
  }), { amount: windAmount, cutout: true });
  const depth = addWindToMaterial(new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5,
  }), { amount: windAmount, cutout: true });
  return { mat, depth };
}

export function createTrees(scene, { dam, terrain, location }) {
  const rng = makeRng(seedFromString(location.id) + 909);
  const weights = location.scenery?.trees || { willow: 0.4, acacia: 0.35, gum: 0.25 };
  const barkDark = new THREE.MeshStandardMaterial({ map: barkTexture('dark'), roughness: 0.95 });
  const barkGum = new THREE.MeshStandardMaterial({ map: barkTexture('gum'), roughness: 0.8 });
  const barkSnag = new THREE.MeshStandardMaterial({ map: barkDark.map, color: 0xc9c2b4, roughness: 0.95 });
  const leafMats = {
    willow: leafMaterial(willowStrandTexture(), 1.8),
    acacia: leafMaterial(acaciaLeafTexture(), 0.35),
    gum: leafMaterial(gumLeafTexture(), 0.7),
  };
  const builders = {
    darkBark: new Builder(), gumBark: new Builder(), snag: new Builder(),
    willow: new Builder(), acacia: new Builder(), gum: new Builder(),
  };

  function pickKind(off) {
    const w = {
      willow: weights.willow * (off < 18 ? 2.0 : 0.35),
      acacia: weights.acacia * (off < 14 ? 0.7 : 1.2),
      gum: weights.gum * (off < 16 ? 0.5 : 1.4),
    };
    const total = w.willow + w.acacia + w.gum;
    let r = rng() * total;
    for (const k of ['willow', 'acacia', 'gum']) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'acacia';
  }

  // Plant a tree at (x, z) -- never out in the water or on the wet margin.
  function placeAt(kind, x, z, scale, leanDir) {
    if (dam.waterDist(x, z) > -1 || dam.standAt(x, z)) return;
    const base = v3(x, terrain.heightAt(x, z), z);
    if (kind === 'bush') buildAcacia(builders.darkBark, builders.acacia, base, rng, scale);
    else if (kind === 'willow') buildWillow(builders.darkBark, builders.willow, base, rng, scale, leanDir);
    else if (kind === 'acacia') buildAcacia(builders.darkBark, builders.acacia, base, rng, scale);
    else buildGum(builders.gumBark, builders.gum, base, rng, scale);
  }
  // `land` = metres back from the near bank.
  const place = (kind, x, land, scale, leanDir) => placeAt(kind, x, dam.shoreZ(x) - land, scale, leanDir);
  // Keep the view out from each stand clear.
  const nearStand = (x, land) => land < 14 && dam.stands.some((st) => Math.abs(x - st.x) < 7);
  const beach = dam.spec.beachWidth;

  // How wooded this dam is: open treeless grassland at Bronkhorstspruit and
  // the Vaal, thick bushveld at Jozini and Loskop.
  const density = location.scenery?.treeDensity ?? 1;

  // A band of trees behind the beach, all along the bank.
  for (let i = 0; i < Math.round(70 * density); i++) {
    const x = (rng() - 0.5) * 800;
    const land = beach + 7 + rng() * 22;
    if (nearStand(x, land)) continue;
    place(pickKind(land), x, land, 0.85 + rng() * 0.4);
  }
  // Scattered further back across the hills, thinning with distance.
  for (let i = 0; i < Math.round(110 * density); i++) {
    const x = (rng() - 0.5) * 1200;
    const land = beach + 30 + Math.pow(rng(), 1.3) * 350;
    place(pickKind(land), x, land, 0.8 + rng() * 0.7);
  }
  // Bushveld scrub: low thorn bushes filling in between the trees.
  for (let i = 0; i < (location.scenery?.bushes ?? 0) * 2; i++) {
    const x = (rng() - 0.5) * 500;
    const land = beach + 3 + Math.pow(rng(), 1.2) * 90;
    if (nearStand(x, land)) continue;
    place('bush', x, land, 0.32 + rng() * 0.25);
  }
  // Willows leaning out over the water from the bank -- the classic SA dam look.
  const waterside = Math.round(weights.willow * 26 * Math.min(1, density));
  for (let i = 0; i < waterside; i++) {
    const x = (rng() - 0.5) * 360;
    if (nearStand(x, 0)) continue;
    place('willow', x, 1.4, 0.8 + rng() * 0.25, Math.PI / 2);
  }
  // The far bank across the dam: a line of trees on the opposite shore.
  if (dam.spec.farShore) {
    for (let i = 0; i < Math.round(90 * density); i++) {
      const x = (rng() - 0.5) * 1600;
      const z = dam.farShoreZ(x) + beach + 4 + Math.pow(rng(), 1.4) * 160;
      placeAt(pickKind(20), x, z, 1.0 + rng() * 0.6);
    }
  }
  // Dead timber standing in the water where the dam spec says (the Vaal's
  // drowned forest, Loskop's and Jozini's timber on the drop-offs).
  for (const zone of dam.spec.structure.filter((st) => st.kind === 'timber')) {
    const count = Math.round(zone.width * zone.density * 0.7);
    for (let k = 0; k < count; k++) {
      const x = zone.x + (rng() - 0.5) * zone.width * 1.6;
      const z = dam.shoreZ(x) + 2 + rng() * zone.reach * 0.85;
      if (dam.standAt(x, z)) continue;
      buildSnag(builders.snag, v3(x, 0, z), rng);
    }
  }

  const add = (builder, material, { cast = true, depth = null } = {}) => {
    if (!builder.idx.length) return null;
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    if (depth) mesh.customDepthMaterial = depth;
    scene.add(mesh);
    return mesh;
  };
  add(builders.darkBark, barkDark);
  add(builders.gumBark, barkGum);
  add(builders.snag, barkSnag);
  for (const kind of ['willow', 'acacia', 'gum']) add(builders[kind], leafMats[kind].mat, { depth: leafMats[kind].depth });

  function setSeason(season) {
    for (const kind of ['willow', 'acacia', 'gum']) {
      const [tint, cut] = SEASON_TINT[kind][season] || SEASON_TINT[kind].summer;
      leafMats[kind].mat.color.set(tint);
      leafMats[kind].mat.alphaTest = cut;
      leafMats[kind].depth.alphaTest = cut;
    }
  }
  setSeason('summer');

  return { setSeason };
}
