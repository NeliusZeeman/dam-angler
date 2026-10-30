import * as THREE from '../../vendor/three.module.js';
import { makeRng } from './noise.js';
import { mergeGeometries } from './terrain.js';
import { glowTexture } from './pixelTextures.js';
import { scanModel, variantObject } from '../sceneryAssets.js';
import { peopleReady } from '../people.js';
import { assetTag } from '../versionCheck.js';
import { createCampLife } from './campLife.js';

// A weekend camp on the bank: dome tents, a gazebo, camp chairs round a
// braai, a cooler box, a bakkie (and sometimes a caravan), people, and carp
// rods on pods at the water's edge. Everything solid is baked into one
// vertex-coloured mesh; the fire, its smoke and the lanterns move.
//
// spec: { x, back (m up the bank from the waterline), tents, people,
// bakkie, caravan, rods }

const TENT_COLOURS = [0x3f6e3a, 0x2f5f8a, 0xd0782a, 0x8a3a2a, 0x5a6a2a, 0x2a4a6a];
const SHIRTS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0xecf0f1, 0x34495e, 0xe67e22, 0x7d3c98];
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0x5c3a1e, 0xf1c27d];

export class Baker {
  constructor() { this.geos = []; }
  add(geo, color, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    g.applyMatrix4(m);
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.geos.push(g);
  }
  build() { return mergeGeometries(this.geos); }
}

export const M = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

// Local-to-world for a piece placed at (x, z) on the ground, turned `ry`.
export function at(ground, x, z, ry = 0) {
  const base = new THREE.Matrix4().compose(new THREE.Vector3(x, ground(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
  return (m) => base.clone().multiply(m);
}

function tent(b, place, colour, rng) {
  const r = 1.2 + rng() * 0.5;
  // Dome: the inner tent and a darker fly-sheet band round the bottom.
  b.add(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), colour, place(M(0, 0, 0, 0, 0, 0, 1.15, 0.78, 1)));
  b.add(new THREE.CylinderGeometry(r * 1.17, r * 1.2, 0.18, 14, 1, true), new THREE.Color(colour).multiplyScalar(0.6).getHex(), place(M(0, 0.09, 0)));
  // Door, poles and guy ropes.
  b.add(new THREE.CircleGeometry(r * 0.42, 12, 0, Math.PI), 0x1d1d1a, place(M(0, 0.02, r * 1.1, 0, -0.18)));
  b.add(new THREE.TorusGeometry(r * 1.05, 0.015, 4, 20, Math.PI), 0x222222, place(M(0, 0, 0, Math.PI / 4, 0, 0, 1.1, 0.78, 1)));
  b.add(new THREE.TorusGeometry(r * 1.05, 0.015, 4, 20, Math.PI), 0x222222, place(M(0, 0, 0, -Math.PI / 4, 0, 0, 1.1, 0.78, 1)));
}

function gazebo(b, place) {
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), 0x9a9a9a, place(M(x, 1.1, z)));
  b.add(new THREE.ConeGeometry(2.3, 0.8, 4, 1, true), 0x2f6b3c, place(M(0, 2.55, 0, Math.PI / 4)));
  b.add(new THREE.BoxGeometry(3.1, 0.25, 0.02), 0x2f6b3c, place(M(0, 2.05, 1.55)));
  b.add(new THREE.BoxGeometry(3.1, 0.25, 0.02), 0x2f6b3c, place(M(0, 2.05, -1.55)));
  // Fold-up table with a gas bottle and a pot.
  b.add(new THREE.BoxGeometry(1.2, 0.04, 0.6), 0xdedad0, place(M(0, 0.75, -0.6)));
  for (const [x, z] of [[-0.55, -0.85], [0.55, -0.85], [-0.55, -0.35], [0.55, -0.35]]) b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 4), 0x777777, place(M(x, 0.37, z)));
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 10), 0x1f6fb2, place(M(0.4, 0.95, -0.6)));
  b.add(new THREE.CylinderGeometry(0.13, 0.11, 0.14, 10), 0x2b2b2b, place(M(-0.3, 0.84, -0.6)));
}

function chair(b, place, colour) {
  b.add(new THREE.BoxGeometry(0.5, 0.05, 0.45), colour, place(M(0, 0.42, 0)));
  b.add(new THREE.BoxGeometry(0.5, 0.55, 0.05), colour, place(M(0, 0.7, -0.22, 0, -0.15)));
  for (const [x, z] of [[-0.24, 0.2], [0.24, 0.2], [-0.24, -0.2], [0.24, -0.2]]) b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), 0x333333, place(M(x, 0.21, z, 0, z > 0 ? 0.2 : -0.2)));
}

// A person, standing or sat in a camp chair, built from simple shapes.
export function person(b, place, rng, { sitting = false, holdingRod = false } = {}) {
  const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const skin = SKIN[Math.floor(rng() * SKIN.length)];
  const pants = [0x2c3e50, 0x5d4e37, 0x4a5a3a, 0x1f2a44][Math.floor(rng() * 4)];
  const hip = sitting ? 0.48 : 0.9;
  if (sitting) {
    for (const s of [-0.1, 0.1]) {
      b.add(new THREE.CylinderGeometry(0.07, 0.06, 0.42, 6), pants, place(M(s, hip, 0.2, 0, Math.PI / 2)));
      b.add(new THREE.CylinderGeometry(0.06, 0.05, 0.45, 6), pants, place(M(s, 0.24, 0.42)));
    }
  } else {
    for (const s of [-0.1, 0.1]) b.add(new THREE.CylinderGeometry(0.075, 0.06, 0.9, 6), pants, place(M(s, 0.45, 0)));
  }
  b.add(new THREE.CylinderGeometry(0.17, 0.15, 0.6, 8), shirt, place(M(0, hip + 0.32, 0)));
  b.add(new THREE.SphereGeometry(0.11, 10, 8), skin, place(M(0, hip + 0.76, 0)));
  // A hat now and then: a floppy bush hat or a cap.
  if (rng() < 0.5) b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 10), 0x8a7a50, place(M(0, hip + 0.84, 0)));
  for (const s of [-1, 1]) {
    const reach = holdingRod ? 0.7 : 0.15;
    b.add(new THREE.CylinderGeometry(0.05, 0.045, 0.55, 6), shirt, place(M(s * 0.21, hip + 0.32, holdingRod ? 0.15 : 0, 0, -reach)));
  }
  if (holdingRod) b.add(new THREE.CylinderGeometry(0.008, 0.016, 3, 5), 0x1a1a1a, place(M(0, hip + 0.9, 1.4, 0, -1.1)));
}

function braai(b, place) {
  // Half a drum on legs, coals and a grid.
  b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 14, 1, true, 0, Math.PI), 0x2a2a2a, place(M(0, 0.6, 0, 0, 0, Math.PI / 2)));
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), 0x2a2a2a, place(M(s * 0.3, 0.3, 0)));
  b.add(new THREE.BoxGeometry(0.75, 0.05, 0.75), 0x3a1d10, place(M(0, 0.62, 0)));
}

export function bakkie(b, place, colour) {
  b.add(new THREE.BoxGeometry(1.8, 0.7, 5), colour, place(M(0, 0.75, 0)));
  b.add(new THREE.BoxGeometry(1.7, 0.6, 1.9), colour, place(M(0, 1.4, 0.7)));
  b.add(new THREE.BoxGeometry(1.62, 0.45, 1.85), 0x1c2a33, place(M(0, 1.43, 0.7)));
  b.add(new THREE.BoxGeometry(1.7, 0.5, 2.1), 0x2a2a2a, place(M(0, 1.35, -1.4))); // canopy
  for (const [x, z] of [[-0.85, 1.6], [0.85, 1.6], [-0.85, -1.6], [0.85, -1.6]]) b.add(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12), 0x151515, place(M(x, 0.38, z, 0, 0, Math.PI / 2)));
}

function caravan(b, place) {
  b.add(new THREE.BoxGeometry(2.2, 2.1, 5), 0xf2efe6, place(M(0, 1.45, 0)));
  b.add(new THREE.BoxGeometry(2.22, 0.2, 5.02), 0x2f6e9a, place(M(0, 1.2, 0)));
  b.add(new THREE.BoxGeometry(2.24, 0.5, 1.2), 0x1c2a33, place(M(0, 1.85, 1)));
  b.add(new THREE.BoxGeometry(2.24, 0.5, 1.2), 0x1c2a33, place(M(0, 1.85, -1.3)));
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12), 0x151515, place(M(s * 1.05, 0.33, 0, 0, 0, Math.PI / 2)));
  // Awning out the side.
  b.add(new THREE.BoxGeometry(2.4, 0.04, 4), 0xd8a24a, place(M(2.2, 2.3, 0, 0, 0, -0.18)));
}

// Two rods on a pod at the waterline, pointing out over the water, with
// bite alarms. `rods: 1` leaves the right-hand rest empty for a live rod
// (campLife.js) that the angler picks up.
function rodPod(b, place, rods = 2) {
  b.add(new THREE.BoxGeometry(0.9, 0.03, 0.03), 0x333333, place(M(0, 0.5, 0)));
  b.add(new THREE.BoxGeometry(0.9, 0.03, 0.03), 0x333333, place(M(0, 0.35, -1.2)));
  for (const s of [-0.3, 0.3]) {
    if (rods > 1 || s < 0) b.add(new THREE.CylinderGeometry(0.01, 0.022, 3.6, 5), 0x161616, place(M(s, 0.75, 0.3, 0, Math.PI / 2 - 0.12)));
    b.add(new THREE.BoxGeometry(0.06, 0.05, 0.1), [0xe03030, 0x30a030][s > 0 ? 1 : 0], place(M(s, 0.55, 0)));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), 0x2a2a2a, place(M(s, 0.28, -0.9, 0, 0, Math.PI / 2)));
  }
}

// Which way the scanned monobloc chair faces, relative to the built ones.
const SCAN_CHAIR_TURN = Math.PI;

export function createCamp(scene, { dam, terrain, spec, seed = 1, location = {}, maxPeople = 8 }) {
  if (!spec) return null;
  const rng = makeRng(seed + 4242);
  const ground = (x, z) => terrain.heightAt(x, z);
  // Real camp gear from the scans when loaded (sceneryAssets.js): a white
  // plastic monobloc chair, a drum braai, a picnic table, bread crate,
  // bucket and lantern. Built shapes stand in when they're not.
  const scanned = (key, pick = 0) => {
    const variants = scanModel(key);
    return variants?.length ? variants[Math.floor(pick * variants.length) % variants.length] : null;
  };
  const gear = new THREE.Group();
  function addScan(key, x, z, turn = 0, y = null, pick = 0) {
    const variant = scanned(key, pick);
    if (!variant) return false;
    const obj = variantObject(variant);
    obj.position.set(x, y ?? ground(x, z), z);
    obj.rotation.y = turn;
    gear.add(obj);
    return true;
  }
  const seat = (b, place, colour, x, z, turn) => {
    if (!addScan('chair', x, z, turn + SCAN_CHAIR_TURN)) chair(b, place, colour);
  };
  // Live people (people.js, campLife.js) when they're loaded: they take
  // the chairs and rod pods themselves, so none are baked in.
  const live = peopleReady();
  // People modelled in Blender (tools/blender/build_people.py) in place of
  // the block figures: sitting, standing, or standing with a rod.
  const somebody = (b, place, x, z, turn, opts) => {
    if (live) return;
    const key = opts.sitting ? 'personSit' : opts.holdingRod ? 'personRod' : 'personStand';
    if (!addScan(key, x, z, turn, null, rng())) person(b, place, rng, opts);
  };
  const b = new Baker();
  const cx = spec.x;
  const shoreAt = (x) => dam.shoreZ(x);
  // Camp centre on the bank, back from the water.
  const cz = shoreAt(cx) - spec.back;
  const pieces = []; // footprints, to keep grass and trees out
  const put = (x, z, r) => pieces.push({ x, z, r });
  const facing = 0; // tents' doors toward the water (+z)

  for (let i = 0; i < spec.tents; i++) {
    const x = cx + (i - (spec.tents - 1) / 2) * 4.2 + (rng() - 0.5) * 1.2;
    const z = cz - 3 - rng() * 2.5;
    tent(b, at(ground, x, z, facing + (rng() - 0.5) * 0.6), TENT_COLOURS[(i + Math.floor(rng() * 3)) % TENT_COLOURS.length], rng);
    put(x, z, 2.2);
  }
  gazebo(b, at(ground, cx - 1, cz + 1.5, 0.1));
  put(cx - 1, cz + 1.5, 2.6);
  const drum = addScan('braaiDrum', cx + 3, cz + 2.5, rng() * Math.PI);
  if (!drum) braai(b, at(ground, cx + 3, cz + 2.5));
  put(cx + 3, cz + 2.5, 1);
  // A picnic table under the gazebo with a lantern on it, and the bread
  // crate and a bucket by the braai.
  if (addScan('picnicTable', cx - 1, cz + 1.5, Math.PI / 2)) {
    addScan('lantern', cx - 0.7, cz + 1.3, 0.4, ground(cx - 1, cz + 1.5) + 0.75);
  }
  addScan('crate', cx + 4.6, cz + 1.4, 0.7);
  addScan('bucket', cx + 4.4, cz + 3.4, 0.2);
  // Chairs round the braai, with people in some.
  const people = spec.people || 0;
  let seated = 0;
  const chairs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const x = cx + 3 + Math.cos(a) * 1.6, z = cz + 2.5 + Math.sin(a) * 1.6;
    const turn = Math.atan2(-(Math.cos(a)), -(Math.sin(a)));
    const place = at(ground, x, z, turn);
    seat(b, place, [0x1f4e79, 0x2e7d32, 0x8e2b2b, 0x333333][i % 4], x, z, turn);
    chairs.push({ x, z, turn });
    if (seated < Math.ceil(people * 0.6)) { somebody(b, place, x, z, turn, { sitting: true }); seated++; }
  }
  // Cooler box and the vehicles behind the tents.
  b.add(new THREE.BoxGeometry(0.7, 0.45, 0.45), 0xf4f4f0, at(ground, cx + 0.8, cz + 3.5)(M(0, 0.23, 0)));
  b.add(new THREE.BoxGeometry(0.72, 0.08, 0.47), 0x2b6cb0, at(ground, cx + 0.8, cz + 3.5)(M(0, 0.48, 0)));
  if (spec.bakkie) {
    const x = cx - spec.tents * 2.4 - 3, z = cz - 4;
    bakkie(b, at(ground, x, z, 0.4), [0xf2f2f2, 0x9aa0a6, 0x7a2a2a, 0x2a3a5a][Math.floor(rng() * 4)]);
    put(x, z, 3.2);
  }
  if (spec.caravan) {
    const x = cx + spec.tents * 2.4 + 4, z = cz - 4;
    caravan(b, at(ground, x, z, -0.3));
    put(x, z, 3.5);
  }
  // Anglers down at the water: rod pods, and someone standing with a rod.
  const rodSpots = [];
  if (spec.rods) {
    for (const dx of [-6, 7]) {
      const x = cx + dx, z = shoreAt(x) - 1.2;
      rodPod(b, at(ground, x, z, 0), live ? 1 : 2);
      seat(b, at(ground, x - 1.2, z - 1.4, 0.2), 0x2e5d2e, x - 1.2, z - 1.4, 0.2);
      put(x, z, 1.6);
      rodSpots.push([x, z]);
    }
  }
  for (let i = seated; i < people; i++) {
    const nearWater = i === seated && rodSpots.length;
    const x = nearWater ? rodSpots[0][0] + 2.5 : cx + (rng() - 0.5) * 10;
    const z = nearWater ? shoreAt(x) - 1.3 : cz + (rng() - 0.5) * 4;
    const turn = nearWater ? 0 : rng() * Math.PI * 2;
    somebody(b, at(ground, x, z, turn), x, z, turn, { holdingRod: !!nearWater });
  }

  const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  scene.add(gear);

  // The people, alive.
  const life = live ? createCampLife(scene, {
    layout: {
      braai: { x: cx + 3, z: cz + 2.5 }, chairs, cooler: { x: cx + 0.8, z: cz + 3.5 },
      centre: { x: cx + 3, z: cz + 2.5 }, shoreAt, people,
      rodSpots: rodSpots.map(([x, z]) => ({ x, z, chair: { x: x - 1.2, z: z - 1.4, turn: 0.2 } })),
    },
    ground, location, rng, maxPeople,
  }) : null;

  // Fire in the braai, smoke drifting off, and lanterns that glow at night.
  const fireBase = new THREE.Vector3(cx + 3, ground(cx + 3, cz + 2.5) + (drum ? 0.85 : 0.7), cz + 2.5);
  const glowMap = glowTexture();
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xff7a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fire.position.copy(fireBase);
  fire.scale.setScalar(0.9);
  scene.add(fire);
  const fireLight = new THREE.PointLight(0xff8a30, 0, 14, 2);
  fireLight.position.copy(fireBase).add(new THREE.Vector3(0, 0.4, 0));
  scene.add(fireLight);
  // Real flames: a fire simulated in Blender (tools/blender/build_fire.py),
  // played back frame by frame over the coals.
  const FLIP_COLS = 8, FLIP_ROWS = 4;
  const flameMap = new THREE.TextureLoader().load(`assets/scenery/textures/fire-flipbook.webp${assetTag()}`);
  flameMap.colorSpace = THREE.SRGBColorSpace;
  flameMap.repeat.set(1 / FLIP_COLS, 1 / FLIP_ROWS);
  const flames = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameMap, color: 0xffc080, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flames.center.set(0.5, 0.07);
  flames.position.copy(fireBase).add(new THREE.Vector3(0, -0.1, 0));
  flames.scale.set(0.7, 1.05, 1);
  scene.add(flames);
  // Meat on the grid: a coil of boerewors and a couple of chops.
  const meat = new THREE.Group();
  const wors = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 24, Math.PI * 3.2), new THREE.MeshStandardMaterial({ color: 0x5a2414, roughness: 0.45 }));
  wors.rotation.x = Math.PI / 2;
  wors.scale.set(1, 0.85, 1);
  meat.add(wors);
  for (const dx of [0.22, -0.22]) {
    const chop = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x7a3a20, roughness: 0.5 }));
    chop.scale.set(1.3, 1, 0.8);
    chop.position.set(dx, 0, 0.04);
    meat.add(chop);
  }
  meat.position.copy(fireBase).add(new THREE.Vector3(0, 0.02, 0));
  meat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(meat);
  let flameT = Math.random() * 10;
  const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xffe0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lantern.position.set(cx - 1, ground(cx - 1, cz + 1.5) + 2.0, cz + 1.5);
  lantern.scale.setScalar(0.7);
  scene.add(lantern);
  const smokeMat = new THREE.SpriteMaterial({ map: glowMap, color: 0xbfbfbf, transparent: true, opacity: 0.25, depthWrite: false });
  const smoke = Array.from({ length: 8 }, (_, i) => {
    const s = new THREE.Sprite(smokeMat.clone());
    s.userData.age = i / 8;
    scene.add(s);
    return s;
  });

  function update(atmos, elapsed, delta = 1 / 60, wind = { x: 1, y: 0 }, camera = null) {
    life?.update(delta, camera);
    const night = atmos.nightness ?? 0;
    const flick = 0.85 + Math.sin(elapsed * 13) * 0.08 + Math.sin(elapsed * 7.3) * 0.07;
    // The glow round the coals; the flames themselves are the flipbook.
    fire.material.opacity = 0.25 + night * 0.5;
    fire.scale.setScalar((0.6 + night * 0.5) * flick);
    flameT += delta;
    const frame = Math.floor(flameT * 15) % (FLIP_COLS * FLIP_ROWS);
    flameMap.offset.set((frame % FLIP_COLS) / FLIP_COLS, 1 - (Math.floor(frame / FLIP_COLS) + 1) / FLIP_ROWS);
    flames.material.opacity = 0.75 + night * 0.25;
    fireLight.intensity = (0.3 + night * 3.2) * flick;
    lantern.material.opacity = night;
    for (const s of smoke) {
      s.userData.age = (s.userData.age + delta / 6) % 1;
      const a = s.userData.age;
      s.position.set(fireBase.x + wind.x * a * 4, fireBase.y + a * 3.5, fireBase.z + wind.y * a * 4);
      s.scale.setScalar(0.4 + a * 2.2);
      s.material.opacity = 0.22 * (1 - a) * (1 - night * 0.5);
    }
  }

  const exclude = (x, z) => pieces.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r);
  // The whole camp's patch of bank (no trees in the middle of it).
  const area = (x, z) => Math.abs(x - cx) < spec.tents * 2.4 + 9 && z > cz - 9 && z < shoreAt(x) + 1;
  return { mesh, update, exclude, area, life };
}
