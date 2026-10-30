import * as THREE from '../../vendor/three.module.js';
import { makeRng } from './noise.js';
import { Baker, M, at, person, bakkie } from './camp.js';
import { waterSurfaceY } from '../water.js';
import { peopleReady, makePerson, loadedPeople, isKid } from '../people.js';
import { createLureAngler } from './campLife.js';
import { FISH_SPECIES } from '../fish.js';
import { boatModel, setBoatLight } from './boatModels.js';

// Live crews (people.js) when they're loaded: where each one stands or
// sits in the boat (x across, y deck height, z along toward the bow), and
// whether they're fishing. Kayaks keep their built paddler.
const CREW = {
  bass: [{ x: 0, y: 0.45, z: 1.5, rod: true }, { x: 0.1, y: 0.45, z: -1.7 }],
  tiger: [{ x: 0, y: 0.4, z: 1.2, rod: true }, { x: 0, y: 0.4, z: -1.2, rod: true, turn: Math.PI * 0.5 }],
  ski: [{ x: -0.45, y: 0.35, z: 0.1 }, { x: 0.45, y: 0.35, z: -0.9 }],
  houseboat: [{ x: 1.2, y: 0.68, z: 3.4, rod: true, turn: 0.6 }, { x: -1.0, y: 0.68, z: 2.8 }],
  pontoon: [{ x: -0.8, y: 0.6, z: -1.6 }, { x: 0.8, y: 0.6, z: 0.4 }],
};

// Boats out on the dam -- only the kinds the dam really allows (pegs.js):
// bass boats drifting a bank with an angler casting, ski boats tearing
// past, yachts heeling in the breeze, a houseboat pottering along, kayaks,
// and tiger boats with two anglers. Each follows a loop well out from the
// angler, rides the waves, and leaves rings on the water behind it. A
// slipway (concrete ramp, a bakkie and trailer) and moored boats where the
// spot has them.

// A hull: pointed bow (+z), flat stern, extruded up from the waterline.
function hull(L, W, H, bowAt = 0.2) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -L / 2);
  s.lineTo(W / 2, -L / 2);
  s.lineTo(W / 2, L * bowAt);
  s.quadraticCurveTo(W * 0.42, L * 0.42, 0, L / 2);
  s.quadraticCurveTo(-W * 0.42, L * 0.42, -W / 2, L * bowAt);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(Math.PI / 2); // shape y -> z (length), extrusion -> down
  g.translate(0, H - 0.12, 0); // sits a little low in the water
  return g;
}

const KINDS = {
  bass: { speed: [1.2, 3], loop: [40, 90], build(b, rng, crew = true) {
    b.add(hull(5.6, 2.1, 0.55, 0.25), 0xb03a2e, new THREE.Matrix4());
    b.add(new THREE.BoxGeometry(2.0, 0.06, 4.2), 0x3a3a3a, M(0, 0.44, -0.3)); // carpet deck
    b.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xdddddd, M(0.5, 0.7, -0.4)); // console
    b.add(new THREE.BoxGeometry(0.42, 0.9, 0.5), 0x111111, M(0, 0.5, -3.0)); // outboard
    if (crew) person(b, (m) => M(0, 0.45, 1.4).multiply(m), rng, { holdingRod: true });
    if (crew) person(b, (m) => M(0.1, 0.45, -1.6).multiply(m), rng, { sitting: true });
  } },
  ski: { speed: [7, 11], loop: [80, 160], build(b, rng, crew = true) {
    b.add(hull(6.2, 2.3, 0.75, 0.15), 0xf2f2f2, new THREE.Matrix4());
    b.add(new THREE.BoxGeometry(2.32, 0.14, 6.0), 0x1f5fa8, M(0, 0.42, -0.2));
    b.add(new THREE.BoxGeometry(1.9, 0.4, 0.06), 0x9bc4e2, M(0, 0.9, 0.9, 0, -0.5)); // windscreen
    b.add(new THREE.BoxGeometry(0.5, 0.8, 0.5), 0x111111, M(0, 0.6, -3.2));
    if (crew) person(b, (m) => M(-0.45, 0.4, 0.2).multiply(m), rng, { sitting: true });
    if (crew) person(b, (m) => M(0.45, 0.4, -0.8).multiply(m), rng, { sitting: true });
  } },
  yacht: { speed: [1.5, 3.2], loop: [70, 150], sail: true, build(b, rng, crew = true) {
    b.add(hull(6.5, 2.3, 0.9, 0.1), 0xf5f5f0, new THREE.Matrix4());
    b.add(new THREE.BoxGeometry(1.4, 0.45, 2), 0xe8e4d8, M(0, 0.95, -0.4));
    b.add(new THREE.CylinderGeometry(0.05, 0.06, 8.5, 6), 0xcccccc, M(0, 5, 0.6));
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), 0xcccccc, M(0, 1.6, -0.9, 0, Math.PI / 2));
  } },
  houseboat: { speed: [0.6, 1.2], loop: [60, 120], build(b, rng, crew = true) {
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.45, 0.45, 11, 12), 0x9aa0a6, M(s * 1.6, 0.15, 0, 0, Math.PI / 2));
    b.add(new THREE.BoxGeometry(4.4, 0.15, 11), 0x8a6a48, M(0, 0.62, 0));
    b.add(new THREE.BoxGeometry(3.8, 2.1, 6.5), 0xefe7d2, M(0, 1.75, -1));
    b.add(new THREE.BoxGeometry(4.2, 0.12, 8), 0x4a6a3a, M(0, 2.9, -0.5));
    b.add(new THREE.BoxGeometry(3.82, 0.6, 5.2), 0x22313d, M(0, 2.0, -1));
    if (crew) person(b, (m) => M(1.2, 0.7, 3.2).multiply(m), rng, { holdingRod: true });
    if (crew) person(b, (m) => M(-1.0, 0.7, 2.8).multiply(m), rng, { sitting: true });
  } },
  kayak: { speed: [0.9, 1.5], loop: [30, 70], paddle: true, build(b, rng, crew = true) {
    b.add(hull(4.2, 0.65, 0.32, 0.3), [0xe74c3c, 0xf1c40f, 0x27ae60, 0xe67e22][Math.floor(rng() * 4)], new THREE.Matrix4());
    if (crew) person(b, (m) => M(0, 0.05, 0).multiply(m), rng, { sitting: true });
  } },
  tiger: { speed: [1, 2.6], loop: [40, 100], build(b, rng, crew = true) {
    b.add(hull(4.6, 1.8, 0.6, 0.25), 0xb8bec4, new THREE.Matrix4());
    b.add(new THREE.BoxGeometry(1.6, 0.05, 3.4), 0x6b7378, M(0, 0.4, -0.2));
    b.add(new THREE.BoxGeometry(0.38, 0.7, 0.42), 0x1a1a1a, M(0, 0.45, -2.4));
    if (crew) person(b, (m) => M(0, 0.4, 1.1).multiply(m), rng, { holdingRod: true });
    if (crew) person(b, (m) => M(0, 0.4, -1.3).multiply(m), rng, { holdingRod: true });
  } },
  pontoon: { speed: [0.8, 1.6], loop: [60, 110], build(b, rng, crew = true) {
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.4, 0.4, 7.5, 12), 0xb8bec4, M(s * 1.2, 0.12, 0, 0, Math.PI / 2));
    b.add(new THREE.BoxGeometry(3.2, 0.12, 7.5), 0x5b4a3a, M(0, 0.55, 0));
    b.add(new THREE.BoxGeometry(3.4, 0.08, 4), 0x1f6fb2, M(0, 2.3, -0.5));
    for (const [x, z] of [[-1.5, -2.4], [1.5, -2.4], [-1.5, 1.4], [1.5, 1.4]]) b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 5), 0xcccccc, M(x, 1.45, z));
    if (crew) for (let i = 0; i < 4; i++) person(b, (m) => M((i % 2 ? 0.8 : -0.8), 0.6, i < 2 ? -1.6 : 0.4).multiply(m), rng, { sitting: i % 3 !== 0 });
  } },
};

const SEAT_GEO = new THREE.BoxGeometry(0.42, 0.44, 0.4);
const SEAT_MAT = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 });
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
const sailMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f4, roughness: 0.8, side: THREE.DoubleSide });

// A kayak paddle's stroke: sweep fore and aft, dipping each blade in turn.
// (The Blender paddle lies across the boat; the built one stands on end.)
function stroke(paddle, phase, on, model) {
  if (model) paddle.rotation.set(0, on ? Math.cos(phase) * 0.5 : 0, on ? Math.sin(phase) * 0.42 : 0.04);
  else paddle.rotation.x = on ? Math.sin(phase) * 0.7 : 0;
}

// `crew: false` leaves the people off (your own boat). The Blender boat
// when its file is loaded (boatModels.js), else one built from shapes.
export function buildBoat(kind, rng, { crew = true } = {}) {
  const model = boatModel(kind, rng);
  if (model) {
    const { group, prop, paddle, spots } = model;
    Object.assign(group.userData, { model: true, prop, paddle, spots });
    // No live people: the simple built figures stand in at the crew spots.
    if (crew && spots.length) {
      const b = new Baker();
      for (const sp of spots) person(b, (m) => M(sp.x, sp.y, sp.z, sp.turn).multiply(m), rng, { sitting: sp.kind !== 'rod', holdingRod: sp.kind === 'rod' });
      const people = new THREE.Mesh(b.build(), material);
      people.castShadow = true;
      group.add(people);
    }
    return group;
  }
  const def = KINDS[kind];
  const b = new Baker();
  def.build(b, rng, crew);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(b.build(), material);
  mesh.castShadow = true;
  group.add(mesh);
  if (def.sail) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0, 7.6); s.lineTo(-3.1, 0.2); s.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(s), sailMat);
    sail.rotation.y = Math.PI / 2;
    sail.position.set(0, 1.6, 0.55);
    group.add(sail);
    group.userData.sail = sail;
    const jib = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 6.5), new THREE.Vector2(2.4, 0)])), sailMat);
    jib.rotation.y = Math.PI / 2;
    jib.position.set(0, 1.0, 0.75);
    group.add(jib);
  }
  if (def.paddle) {
    const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    paddle.rotation.z = Math.PI / 2;
    paddle.position.y = 0.8;
    group.add(paddle);
    group.userData.paddle = paddle;
  }
  return group;
}

export function createBoats(scene, { dam, kinds = [], moored = 0, slipway = null, water = null, spawn, seed = 1, terrain = null, speciesIds = [] }) {
  const rng = makeRng(seed + 777);
  const boats = [];
  const live = peopleReady();
  const adults = loadedPeople().filter((n) => !isKid(n));
  const lureFish = speciesIds.map((id) => FISH_SPECIES.find((f) => f.id === id))
    .filter((f) => f && ['largemouth-bass', 'smallmouth-bass', 'tigerfish', 'largemouth-yellowfish', 'smallmouth-yellowfish'].includes(f.id));
  const crews = []; // live crew members: { p, angler, boat }
  const hooks = {};
  // The Blender boats say where their crew go (seats are part of them);
  // the built ones use CREW and get a seat box.
  function addCrew(g, kind) {
    const model = g.userData.model;
    const spots = model ? g.userData.spots.map((sp) => ({ ...sp, rod: sp.kind === 'rod', paddle: sp.kind === 'paddle' })) : CREW[kind] || [];
    for (const c of spots) {
      const p = adults.length ? makePerson(adults[Math.floor(rng() * adults.length)]) : null;
      if (!p) continue;
      p.root.position.set(c.x, c.y, c.z);
      p.root.rotation.y = c.turn || 0;
      g.add(p.root);
      if (!c.rod) {
        p.pose(c.paddle || rng() < 0.5 ? 'sit' : 'sitRelaxed');
        if (!model) {
          // A boat seat under them, the height of a camp chair.
          const seat = new THREE.Mesh(SEAT_GEO, SEAT_MAT);
          seat.position.set(c.x, c.y + 0.22, c.z - 0.08);
          seat.castShadow = true;
          g.add(seat);
        }
      }
      crews.push({ p, g, angler: c.rod ? createLureAngler(scene, p, { rng, species: lureFish, hooks }) : null,
        paddle: c.paddle ? g.userData.paddle : null });
    }
  }
  // A paddler's hands stay on the shaft as it swings.
  const hand = new THREE.Vector3(), pole = new THREE.Vector3();
  function holdPaddle(p, paddle) {
    paddle.updateWorldMatrix(true, false);
    p.root.updateWorldMatrix(true, true);
    for (const [side, s] of [['R', -1], ['L', 1]]) {
      hand.set(s * 0.38, 0, 0).applyMatrix4(paddle.matrixWorld);
      pole.set(s * 0.7, 0.5, -0.3).applyMatrix4(p.root.matrixWorld);
      p.reach(side, hand, pole);
    }
  }
  const clear = (x, z, r) => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      if (!dam.isWater(x + Math.cos(a) * r, z + Math.sin(a) * r) || dam.waterDist(x + Math.cos(a) * r, z + Math.sin(a) * r) < 8) return false;
    }
    return true;
  };
  // Two to four boats out on the water, of the kinds allowed here.
  const count = kinds.length ? Math.min(4, 2 + Math.floor(rng() * 3)) : 0;
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const def = KINDS[kind];
    if (!def) continue;
    let r = def.loop[0] + rng() * (def.loop[1] - def.loop[0]);
    let cx = spawn.x + (rng() - 0.5) * 300, cz = dam.shoreZ(cx) + 70 + r + rng() * 160;
    let tries = 0;
    while (!clear(cx, cz, r) && tries++ < 12) { r *= 0.8; cz = dam.shoreZ(cx) + 50 + r + rng() * 120; }
    if (!clear(cx, cz, r)) continue;
    const withCrew = live && (CREW[kind] || kind === 'kayak');
    const g = buildBoat(kind, rng, { crew: !withCrew });
    scene.add(g);
    if (withCrew) addCrew(g, kind);
    const speed = def.speed[0] + rng() * (def.speed[1] - def.speed[0]);
    boats.push({ g, kind, cx, cz, rx: r, rz: r * (0.5 + rng() * 0.5), t: rng() * Math.PI * 2, w: (speed / r) * (rng() < 0.5 ? 1 : -1), speed, wake: 0, phase: rng() * 10,
      trail: speed > 5 ? createWakeTrail(scene) : null });
  }

  // The slipway: a concrete ramp into the water, a bakkie and empty trailer.
  if (slipway && terrain) {
    const x = spawn.x + slipway.x, z0 = dam.shoreZ(x);
    const b = new Baker();
    const ground = (px, pz) => terrain.heightAt(px, pz);
    const top = ground(x, z0 - 7);
    const len = 14;
    const ramp = new THREE.BoxGeometry(4.5, 0.25, len);
    const slope = Math.atan2(top + 0.6, len);
    b.add(ramp, 0x9b9a94, M(x, (top - 0.6) / 2, z0, 0, slope));
    bakkie(b, at(ground, x - 4, z0 - 12, 0.2), 0xf2f2f2);
    b.add(new THREE.BoxGeometry(1.8, 0.12, 4.5), 0x4a4a4a, at(ground, x + 0.5, z0 - 9.5, 0)(M(0, 0.55, 0)));
    for (const s of [-0.9, 0.9]) b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), 0x151515, at(ground, x + 0.5, z0 - 9.5, 0)(M(s, 0.3, -0.6, 0, 0, Math.PI / 2)));
    const mesh = new THREE.Mesh(b.build(), material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // Moored boats bobbing just off the bank near the slipway (or along it).
  const mooredBoats = [];
  for (let i = 0; i < moored; i++) {
    const kind = kinds.includes('bass') ? 'bass' : kinds[0] || 'tiger';
    // Tied up and empty when there are live crews (theirs are out fishing).
    const g = buildBoat(kind === 'yacht' && i > 0 ? 'bass' : kind, rng, { crew: !live });
    const x = spawn.x + (slipway ? slipway.x : 30) + 7 + i * 4.5;
    const z = dam.shoreZ(x) + 6 + rng() * 3;
    if (!dam.isWater(x, z)) continue;
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.4;
    scene.add(g);
    mooredBoats.push({ g, x, z, phase: rng() * 10 });
  }

  const tmp = new THREE.Vector3();
  let crewTick = 0;
  function update(elapsed, delta, { camera, windDir = null, windSpeed = 0, light = null } = {}) {
    if (light != null) setBoatLight(light);
    let nearest = null, nearestD = Infinity;
    for (const bt of boats) {
      bt.t += bt.w * delta;
      const x = bt.cx + Math.cos(bt.t) * bt.rx, z = bt.cz + Math.sin(bt.t) * bt.rz;
      // Heading along the loop.
      const dx = -Math.sin(bt.t) * bt.rx * Math.sign(bt.w), dz = Math.cos(bt.t) * bt.rz * Math.sign(bt.w);
      const heading = Math.atan2(dx, dz);
      const y = waterSurfaceY(x, z, elapsed);
      // Ride the waves: pitch from bow to stern, roll side to side.
      const L = 2.5;
      const fy = waterSurfaceY(x + Math.sin(heading) * L, z + Math.cos(heading) * L, elapsed);
      const by = waterSurfaceY(x - Math.sin(heading) * L, z - Math.cos(heading) * L, elapsed);
      const fast = bt.speed > 5;
      bt.g.position.set(x, y + (fast ? 0.12 : 0), z);
      bt.g.rotation.set(Math.atan2(by - fy, L * 2) - (fast ? 0.08 : 0), heading, Math.sin(elapsed * 1.3 + bt.phase) * 0.03, 'YXZ');
      if (bt.g.userData.sail) bt.g.rotation.z = 0.12 + Math.min(0.25, windSpeed / 80);
      if (bt.g.userData.paddle) stroke(bt.g.userData.paddle, elapsed * 2.4 + bt.phase, true, bt.g.userData.model);
      if (bt.g.userData.prop) bt.g.userData.prop.rotation.z += delta * bt.speed * 6;
      bt.trail?.update(x, z, heading, bt.speed, elapsed, delta, 3.2);
      if (camera) {
        const d = tmp.set(x, 0, z).distanceTo(camera.position);
        if (d < nearestD) { nearestD = d; nearest = { bt, x, z, heading }; }
      }
    }
    // Rings off the stern of the nearest boat (the ripple pool is small).
    if (water && nearest && nearestD < 220) {
      const bt = nearest.bt;
      bt.wake -= delta;
      if (bt.wake <= 0) {
        bt.wake = bt.speed > 5 ? 0.25 : 0.6;
        water.addRipple(nearest.x - Math.sin(nearest.heading) * 3, nearest.z - Math.cos(nearest.heading) * 3, bt.speed > 5 ? 2.2 : 0.8);
      }
    }
    // The crews: anglers casting and working lures (and now and then into
    // a fish); the rest sit back. Far boats are only stepped now and then.
    crewTick += delta;
    const step = crewTick > 0.3;
    for (const c of crews) {
      const near = camera ? c.g.position.distanceTo(camera.position) < 220 : true;
      if (!near && !step) continue;
      const dt = near ? delta : crewTick;
      c.p.update(dt);
      c.angler?.update(dt);
      if (c.paddle && near) holdPaddle(c.p, c.paddle);
    }
    if (step) crewTick = 0;
    for (const m of mooredBoats) {
      m.g.position.y = waterSurfaceY(m.x, m.z, elapsed);
      m.g.rotation.z = Math.sin(elapsed * 0.9 + m.phase) * 0.03;
      if (m.g.userData.paddle) stroke(m.g.userData.paddle, 0, false, true);
      m.g.rotation.x = Math.sin(elapsed * 0.7 + m.phase) * 0.02;
    }
  }

  return { update, boats, mooredBoats, crews, setHooks: (h) => Object.assign(hooks, h) };
}

// A trail of white water behind a boat under way: a ribbon along its
// track that spreads and fades as it falls behind.
const WAKE_POINTS = 40;
let foamTexture = null;
function foam() {
  if (foamTexture) return foamTexture;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const rng = makeRng(99);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 900; i++) {
    const x = rng() * 64, y = rng() * 128, r = 0.6 + rng() * 2.2;
    const edge = Math.min(x, 64 - x) / 32; // thicker down the middle
    g.fillStyle = `rgba(255,255,255,${(0.15 + rng() * 0.5) * (0.3 + edge)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  foamTexture = new THREE.CanvasTexture(c);
  foamTexture.wrapT = THREE.RepeatWrapping;
  return foamTexture;
}

export function createWakeTrail(scene) {
  const pos = new Float32Array(WAKE_POINTS * 2 * 3);
  const col = new Float32Array(WAKE_POINTS * 2 * 4);
  const uv = new Float32Array(WAKE_POINTS * 2 * 2);
  const index = [];
  for (let i = 0; i < WAKE_POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: foam(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  const pts = []; // { x, z, hx, hz, speed, age }
  let gap = 0, travelled = 0;
  function update(x, z, heading, speed, elapsed, delta, stern = 2.8) {
    for (const p of pts) p.age += delta;
    gap -= delta;
    const moving = Math.abs(speed) > 0.6;
    if (moving && gap <= 0) {
      gap = 0.12;
      pts.unshift({ x: x - Math.sin(heading) * stern, z: z - Math.cos(heading) * stern, hx: Math.cos(heading), hz: -Math.sin(heading), speed: Math.abs(speed), age: 0 });
      if (pts.length > WAKE_POINTS - 1) pts.pop();
    }
    while (pts.length && pts[pts.length - 1].age > 4) pts.pop();
    travelled += Math.abs(speed) * delta;
    mesh.visible = pts.length > 1;
    if (!mesh.visible) return;
    // The ribbon starts right at the stern, whenever the last mark was laid.
    const live = { x: x - Math.sin(heading) * stern, z: z - Math.cos(heading) * stern, hx: Math.cos(heading), hz: -Math.sin(heading), speed: moving ? Math.abs(speed) : 0, age: 0 };
    const all = [live, ...pts];
    for (let i = 0; i < WAKE_POINTS; i++) {
      const p = all[Math.min(i, all.length - 1)];
      const fade = i < all.length ? Math.max(0, 1 - p.age / 4) ** 1.5 * Math.min(1, p.speed / 4) : 0;
      const w = 0.7 + p.age * (0.3 + p.speed * 0.07);
      const y = waterSurfaceY(p.x, p.z, elapsed) + 0.04;
      for (const s of [0, 1]) {
        const k = (i * 2 + s);
        const side = s ? w : -w;
        pos[k * 3] = p.x + p.hx * side; pos[k * 3 + 1] = y; pos[k * 3 + 2] = p.z + p.hz * side;
        col[k * 4] = col[k * 4 + 1] = col[k * 4 + 2] = fade; col[k * 4 + 3] = fade;
        uv[k * 2] = s; uv[k * 2 + 1] = (travelled - i * 0.12 * p.speed) / 6;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
  }
  return { update, mesh };
}

// Your own boat (boatDrive.js moves it): rides the waves like the others,
// spins its prop (or works the paddle) and throws a wake under way.
export function createPlayerBoat(scene, kind, water = null) {
  // Always the first colour of its kind: a red bass boat, a green tiger boat.
  const g = buildBoat(kind, () => 0, { crew: false });
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(g);
  const trail = kind === 'kayak' ? null : createWakeTrail(scene);
  // Your own paddle sits lower and further out than a paddler's, below
  // your eyes rather than across them.
  if (g.userData.model && g.userData.paddle) g.userData.paddle.position.add(new THREE.Vector3(0, -0.28, 0.35));
  let wake = 0, strokes = 0;
  function update(drive, elapsed, delta) {
    const { x, z, heading, speed } = drive.state;
    const L = 2.2;
    const y = waterSurfaceY(x, z, elapsed);
    const fy = waterSurfaceY(x + Math.sin(heading) * L, z + Math.cos(heading) * L, elapsed);
    const by = waterSurfaceY(x - Math.sin(heading) * L, z - Math.cos(heading) * L, elapsed);
    // The bow lifts as it gets on the plane, then settles.
    const plane = Math.min(1, Math.abs(speed) / 5) * (1 - Math.min(1, Math.max(0, (Math.abs(speed) - 8) / 5)) * 0.5);
    g.position.set(x, y + plane * 0.05, z);
    g.rotation.set(Math.atan2(by - fy, L * 2) - plane * 0.07, heading, Math.sin(elapsed * 1.1) * 0.025, 'YXZ');
    if (g.userData.paddle) {
      strokes += delta * Math.min(3, Math.abs(speed) * 2.4);
      stroke(g.userData.paddle, strokes, Math.abs(speed) > 0.2, g.userData.model);
    }
    if (g.userData.prop) g.userData.prop.rotation.z += delta * speed * 8;
    trail?.update(x, z, heading, speed, elapsed, delta, kind === 'tiger' ? 2.6 : 3.1);
    if (water && Math.abs(speed) > 0.4) {
      wake -= delta;
      if (wake <= 0) {
        wake = Math.abs(speed) > 5 ? 0.18 : 0.45;
        water.addRipple(x - Math.sin(heading) * 2.8, z - Math.cos(heading) * 2.8, Math.min(2.5, 0.5 + Math.abs(speed) * 0.2));
      }
    }
  }
  return { group: g, update };
}
