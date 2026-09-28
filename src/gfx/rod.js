import * as THREE from '../../vendor/three.module.js';
import { corkTexture } from './pixelTextures.js';
import { ROD_MODELS, REEL_MODELS, DEFAULT_ROD, DEFAULT_REEL } from './rodModels.js';

// Cantilever beam under a tip load: normalised deflection, slope and the
// arc-length pull-back, for a point `s` metres back from the tip. `flexLen`
// is how much of the blank takes the bend -- the rod's action: a fast rod
// bends only in its top part, a through-action rod all the way to the grip.
function beam(s, flexLen) {
  if (s >= flexLen) return { f: 0, k: 0, back: 0 };
  const u = flexLen - s;
  const r = u / flexLen;
  return {
    f: (r * r * (3 - r)) / 2,
    k: (3 * u * (2 * flexLen - u)) / (2 * flexLen ** 3),
    back: 0.6 * (r ** 3) / flexLen,
  };
}

// Spring behaviour of the rod in hand and of the blank itself.
const POSE_OMEGA = 11; // how briskly the rod follows its target angle
const POSE_ZETA = 0.8;
const BEND_K = 150; // blank stiffness
const BEND_DAMP = 7.5; // light damping so a cast visibly whips and settles
const BEND_INERTIA = 0.35; // how far the tip lags when the rod is swung
const BEND_MAX = 0.6; // metres of tip deflection

// Real rods run 1.8 m to 3.6 m. On screen they're drawn a little shorter
// than life so a 12ft carp rod still fits the view: a 1.8 m rod is 2 m in
// hand, a 3.6 m carp rod about 3 m.
const onScreenLength = (len) => 2.0 * (len / 1.8) ** 0.6;

// The flex lengths in gear.js were tuned on a 1.45 m blank; longer blanks
// bend over the same share of their length.
const FLEX_REF = 1.45;

// How long each kind of handle is, from the butt cap to the front of the
// foregrip (metres, on screen).
const HANDLE_LEN = {
  foam: 0.52, splitCork: 0.46, fullCork: 0.6, longEva: 0.73, shrink: 0.74,
  splitEva: 0.45, fullWells: 0.265, cigar: 0.24,
};

// How far above the handle the first (butt) guide sits, as a share of 2 m.
const BUTT_GUIDE_GAP = { casting: 0.1, snake: 0.09, carp: 0.3, chunky: 0.24, ring: 0.26, onePiece: 0.26 };

let weave = null;
// Woven carbon for the carp rod: a fine diagonal twill in greys.
function weaveTexture() {
  if (weave) return weave;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const band = ((x + y) >> 2) & 1;
      const v = band ? 200 : 140 + ((x * 7 + y * 3) % 5) * 6;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  weave = new THREE.CanvasTexture(c);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.colorSpace = THREE.SRGBColorSpace;
  return weave;
}

// ─── Reels ───────────────────────────────────────────────────────────────────
// Each builder returns { group, from (where the line leaves the reel, in the
// group's frame), spin(amount) }. Local +Y points up the rod toward the tip;
// spinning and fly reels hang toward -Z (under the rod), a baitcaster sits
// toward +Z (on top).

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Cylinder whose axis runs sideways (X), for spools and side plates.
function discX(r0, r1, w, mat, radial = 28) {
  const geo = new THREE.CylinderGeometry(r0, r1, w, radial);
  geo.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

function spinningReel(M, big) {
  const d = big
    ? { body: 0.037, rotor: 0.035, rotorLow: 0.027, rotorH: 0.034, spoolH: 0.05, spoolBack: 0.035, spoolFront: 0.028, z: -0.088, drag: 0.017, dragH: 0.02, arm: 0.078, knob: 0.0085, knobLen: 0.03, bail: 0.0019 }
    : { body: 0.03, rotor: 0.029, rotorLow: 0.022, rotorH: 0.03, spoolH: 0.026, spoolBack: 0.024, spoolFront: 0.024, z: -0.068, drag: 0.009, dragH: 0.012, arm: 0.055, knob: 0.006, knobLen: 0.022, bail: 0.0013 };
  const g = new THREE.Group();
  const z = d.z;
  g.add(box(0.01, big ? 0.08 : 0.07, 0.004, M.reel, 0, 0, -0.002));
  const stemLen = -z - 0.018;
  const stem = box(0.008, 0.02, stemLen, M.reel, 0, 0.004, -(0.003 + stemLen / 2));
  stem.rotation.x = -0.25;
  g.add(stem);

  const gearbox = new THREE.Mesh(new THREE.SphereGeometry(d.body, 18, 12), M.reel);
  gearbox.scale.set(0.8, 1.15, 1);
  gearbox.position.set(0, -0.01, z);
  g.add(gearbox);
  // Coloured trim band where the body meets the rotor.
  const trim = new THREE.Mesh(new THREE.TorusGeometry(d.body * 0.78, 0.0018, 6, 28), M.trim);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(0, 0.013, z);
  g.add(trim);

  const y0 = 0.015;
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(d.rotor, d.rotorLow, d.rotorH, 22, 1, true), M.reel);
  rotor.position.set(0, y0 + d.rotorH / 2, z);
  g.add(rotor);
  const sy = y0 + d.rotorH;
  // Big-pit spools are long and taper toward the front for long casts.
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(d.spoolFront, d.spoolBack, d.spoolH, 26), M.accent);
  spool.position.set(0, sy + d.spoolH / 2, z);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(d.spoolFront - 0.0032, d.spoolBack - 0.0032, d.spoolH * 0.8, 26), M.line);
  line.position.copy(spool.position);
  line.scale.set(1.15, 1, 1.15);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(d.spoolFront, 0.0022, 6, 26), M.accent);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(0, sy + d.spoolH, z);
  const drag = new THREE.Mesh(new THREE.CylinderGeometry(d.drag * 0.82, d.drag, d.dragH, big ? 18 : 12), M.trim);
  drag.position.set(0, sy + d.spoolH + d.dragH / 2, z);
  g.add(spool, line, lip, drag);
  if (big) {
    // Grip ridges round the big front drag knob.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(box(0.003, d.dragH * 0.9, 0.003, M.reel, Math.cos(a) * d.drag * 0.92, drag.position.y, z + Math.sin(a) * d.drag * 0.92));
    }
  }

  const bailY = y0 + d.rotorH * 0.66;
  const bail = new THREE.Mesh(new THREE.TorusGeometry(d.rotor + 0.002, d.bail, 6, 24, Math.PI), M.metal);
  bail.position.set(0, bailY, z);
  bail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 8), M.metal);
  roller.position.set(0, bailY, z + d.rotor + 0.002);
  g.add(bail, roller);

  const crank = new THREE.Group();
  crank.position.set(d.body * 0.87, -0.01, z);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 8), M.accent);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.01;
  const arm = box(0.005, 0.006, d.arm, M.reel, 0.021, 0, -d.arm * 0.44);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(d.knob, d.knob * 1.25, d.knobLen, 12), M.knob);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.021 + d.knobLen / 2, 0, -d.arm * 0.9);
  crank.add(shaft, arm, knob);
  g.add(crank);

  return {
    group: g,
    from: new THREE.Vector3(0, bailY, z + d.rotor + 0.002),
    spin(a) { crank.rotation.x -= a; rotor.rotation.y += a * 5; },
  };
}

// Low-profile baitcaster sitting on top of a trigger-grip rod: oval side
// plates, star drag and twin-paddle handle on the right, level wind in front.
function baitcaster(M) {
  const g = new THREE.Group();
  const bz = 0.032;
  g.add(box(0.01, 0.06, 0.004, M.reel, 0, 0, 0.002));
  g.add(box(0.012, 0.022, 0.02, M.reel, 0, 0, 0.014));
  for (const side of [-1, 1]) {
    const plate = discX(0.028, 0.028, 0.011, M.reel);
    plate.geometry.scale(1, 1.3, 1);
    plate.position.set(side * 0.024, 0, bz);
    g.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0275, 0.0012, 6, 32), side > 0 ? M.trim : M.accent);
    ring.rotation.y = Math.PI / 2;
    ring.scale.set(1, 1.3, 1);
    ring.position.set(side * 0.0305, 0, bz);
    g.add(ring);
  }
  const spool = new THREE.Group();
  spool.position.set(0, 0, bz);
  spool.add(discX(0.02, 0.02, 0.036, M.accent), discX(0.017, 0.017, 0.033, M.line));
  // A couple of holes in the spool so it visibly turns.
  for (const a of [0, Math.PI]) {
    const hole = discX(0.003, 0.003, 0.037, M.trim, 8);
    hole.position.set(0, Math.cos(a) * 0.012, Math.sin(a) * 0.012);
    spool.add(hole);
  }
  g.add(spool);
  g.add(box(0.048, 0.009, 0.005, M.reel, 0, 0.014, bz + 0.027)); // top frame
  g.add(box(0.044, 0.011, 0.006, M.trim, 0, -0.024, bz + 0.022)); // thumb bar
  g.add(box(0.048, 0.005, 0.011, M.reel, 0, 0.03, bz + 0.012)); // front frame
  const lw = 0.036;
  g.add(box(0.046, 0.004, 0.004, M.metal, 0, lw, bz - 0.006)); // level wind
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.0035, 0.0009, 6, 12), M.metal);
  eye.rotation.x = Math.PI / 2;
  eye.position.set(0, lw, bz - 0.006);
  g.add(eye);
  const star = discX(0.014, 0.014, 0.004, M.trim, 5);
  star.position.set(0.035, 0.004, bz);
  g.add(star);
  const crank = new THREE.Group();
  crank.position.set(0.039, 0.004, bz);
  const shaft = discX(0.0025, 0.0025, 0.008, M.metal, 8);
  const arm = box(0.004, 0.078, 0.007, M.reel, 0.006, 0, 0);
  crank.add(shaft, arm);
  for (const side of [-1, 1]) {
    const paddle = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), M.knob);
    paddle.scale.set(0.55, 1.25, 0.75);
    paddle.position.set(0.013, side * 0.038, 0);
    crank.add(paddle);
  }
  g.add(crank);
  return {
    group: g,
    from: new THREE.Vector3(0, lw, bz - 0.006),
    spin(a) { crank.rotation.x -= a; spool.rotation.x -= a * 3; },
  };
}

// Fly reel hanging under the butt: a disc with the spool turning sideways.
// Narrow = classic click & pawl, large = machined large-arbor with ports.
function flyReel(M, large) {
  const R = large ? 0.042 : 0.037;
  const W = large ? 0.028 : 0.018;
  const g = new THREE.Group();
  g.add(box(0.007, 0.055, 0.003, M.reel, 0, 0, -0.0015));
  g.add(box(0.008, 0.012, 0.012, M.reel, 0, 0, -0.009));
  const zc = -(0.015 + R);
  const back = discX(R, R, 0.003, M.reel, 36);
  back.position.set(-W / 2, 0, zc);
  g.add(back);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, large ? 0.0016 : 0.0012, 6, 36), M.accent);
  rim.rotation.y = Math.PI / 2;
  rim.position.set(-W / 2, 0, zc);
  g.add(rim);
  // Frame posts between the plates.
  for (const a of [0.6, 2.2, 3.9]) {
    const post = discX(0.0017, 0.0017, W, M.reel, 6);
    post.position.set(0, Math.cos(a) * R * 0.97, zc + Math.sin(a) * R * 0.97);
    g.add(post);
  }
  const drag = discX(0.01, 0.01, 0.006, M.accent, 16);
  drag.position.set(-W / 2 - 0.004, 0, zc);
  g.add(drag);

  const spool = new THREE.Group();
  spool.position.set(0, 0, zc);
  const face = discX(R * 0.97, R * 0.97, 0.003, M.reel, 36);
  face.position.x = W / 2;
  const line = discX(R * 0.83, R * 0.83, W - 0.004, M.flyLine, 36);
  const hub = discX(R * 0.18, R * 0.18, 0.004, M.accent, 16);
  hub.position.x = W / 2 + 0.0015;
  spool.add(face, line, hub);
  if (large) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const port = discX(R * 0.15, R * 0.15, 0.0012, M.trim, 14);
      port.position.set(W / 2 + 0.0012, Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58);
      spool.add(port);
    }
  } else {
    const faceRim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.95, 0.001, 6, 36), M.accent);
    faceRim.rotation.y = Math.PI / 2;
    faceRim.position.x = W / 2 + 0.0015;
    spool.add(faceRim);
  }
  const knob = discX(0.004, 0.0045, 0.014, M.knob, 10);
  knob.position.set(W / 2 + 0.009, R * 0.62, 0);
  spool.add(knob);
  g.add(spool);
  return {
    group: g,
    from: new THREE.Vector3(0, R * 0.58, zc + R * 0.58),
    spin(a) { spool.rotation.x -= a; },
  };
}

// ─── The rod in hand ─────────────────────────────────────────────────────────
// Built in a "rod frame": origin at the rod tip, local -Y runs back down the
// blank toward the butt. Guides sit on the underside (-Z) of spinning and
// fly rods and on top (+Z) of casting rods. The blank flexes in the frame's
// X/Z plane. Each rod and reel in the shop has its own look (rodModels.js).
export function createPlayerRod(camera) {
  const rodGroup = new THREE.Group();

  const shaftTheta = Math.PI / 2 + 0.35;
  const axis = new THREE.Vector3(0, Math.cos(shaftTheta), Math.sin(shaftTheta));
  // Where the hand holds the rod; each rod is placed so its grip sits here,
  // so a longer rod reaches further out over the water.
  const handAt = new THREE.Vector3(0, 0, -0.7).addScaledVector(axis, 0.69);

  const frame = new THREE.Group();
  frame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
  rodGroup.add(frame);

  const blankMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.18, metalness: 0.45 });
  const clearMat = new THREE.MeshStandardMaterial({ color: 0xf4f0d8, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x9a2a22, roughness: 0.3, metalness: 0.2 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, roughness: 0.15, metalness: 0.95 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.1, metalness: 0.6 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.7 });
  const corkMat = new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.9 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.35, metalness: 0.5 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.45, metalness: 0 });
  const M = {
    reel: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.28, metalness: 0.75, side: THREE.DoubleSide }),
    accent: new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.2, metalness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2b5fb3, roughness: 0.3, metalness: 0.6 }),
    metal: metalMat,
    knob: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }),
    line: new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 }),
    flyLine: new THREE.MeshStandardMaterial({ color: 0xc9d24a, roughness: 0.55 }),
  };

  const tip = new THREE.Object3D();
  frame.add(tip);

  // Rebuilt whenever the rod or reel changes.
  let parts = null;
  let riders = []; // rigid bits riding the flexing blank
  let tubes = []; // bending blank pieces: { geo, rest }
  let threadPath = [];
  let threadGeo = null;
  let spinReelParts = () => {};
  let sFix = 1.45; // where the blank meets the handle
  let builtKey = '';

  function build(m, rm) {
    if (parts) {
      frame.remove(parts);
      parts.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    parts = new THREE.Group();
    frame.add(parts);
    riders = [];
    tubes = [];

    const T = onScreenLength(m.len);
    sFix = T - HANDLE_LEN[m.grip];
    const rAt = (s) => m.tipR + (m.buttR - m.tipR) * Math.min(1, s / sFix);
    const gs = m.seat === 'trigger' ? 1 : -1; // guide side: +1 on top

    function ride(obj, s) {
      riders.push({ obj, s, pos: obj.position.clone(), quat: obj.quaternion.clone() });
      return obj;
    }
    function add(obj, s) {
      parts.add(obj);
      if (s < sFix) ride(obj, s);
      return obj;
    }
    function section(s0, s1, r0, r1, mat, radial = 14) {
      const m2 = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, s1 - s0, radial, 1), mat);
      m2.position.y = -(s0 + s1) / 2;
      return add(m2, (s0 + s1) / 2);
    }
    // A thin rod between two points (guide legs).
    const yUp = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    function strut(a, b, r, mat, s) {
      dir.subVectors(b, a);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 5), mat);
      mesh.position.addVectors(a, b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(yUp, dir.normalize());
      return add(mesh, s);
    }
    // Bending blank piece from s0 to s1.
    function tube(s0, s1, mat) {
      const geo = new THREE.CylinderGeometry(rAt(s0), rAt(s1), s1 - s0, 10, Math.max(4, Math.ceil((s1 - s0) * 30)), false);
      geo.translate(0, -(s0 + s1) / 2, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      parts.add(mesh);
      tubes.push({ geo, rest: Float32Array.from(geo.getAttribute('position').array) });
    }

    // ── Blank ──
    if (m.clearTip) {
      const cl = sFix * m.clearTip;
      tube(0, cl, clearMat);
      tube(cl - 0.002, sFix + 0.02, blankMat);
    } else {
      tube(0, sFix + 0.02, blankMat);
    }
    section(sFix + 0.02, T - 0.004, m.buttR, m.buttR, blankMat, 10); // runs on through the handle
    if (m.weave) weaveTexture().repeat.set(3, Math.round(sFix / 0.007));

    // Ferrule joints, each with a trim wrap either side.
    for (let k = 1; k <= m.ferrules; k++) {
      const s = sFix * (k / (m.ferrules + 1));
      section(s - 0.04, s + 0.04, rAt(s - 0.04) + 0.0011, rAt(s + 0.04) + 0.0011, blankMat, 12);
      section(s - 0.046, s - 0.04, rAt(s) + 0.0015, rAt(s) + 0.0015, wrapMat, 12);
      section(s + 0.04, s + 0.046, rAt(s) + 0.0015, rAt(s) + 0.0015, wrapMat, 12);
    }
    // Decorative butt wrap just above the handle.
    section(sFix - 0.04, sFix - 0.008, rAt(sFix - 0.04) + 0.0012, rAt(sFix) + 0.0012, wrapMat, 14);
    section(sFix - 0.046, sFix - 0.042, rAt(sFix) + 0.0016, rAt(sFix) + 0.0016, metalMat, 14);

    // ── Guides ──
    const linePoints = [];
    const n = m.count;
    const style = m.guides;
    const sLast = sFix - (BUTT_GUIDE_GAP[style] ?? 0.24) * (T / 2);
    const tipRing = style === 'casting' ? 0.0019 : style === 'snake' ? 0.0017 : style === 'chunky' ? 0.0032 : 0.0024;
    const buttRing = m.butt ?? 0.018;
    const strippers = m.strippers || 0;
    for (let i = 0; i < n; i++) {
      const frac = i / (n - 1);
      const s = i === 0 ? 0.01 : sLast * frac ** 1.3;
      let type = style;
      let ring;
      if (style === 'snake' && i >= n - strippers) {
        type = 'ring';
        ring = buttRing * (i === n - 1 ? 1 : 0.7);
      } else if (style === 'snake') {
        ring = tipRing + (0.0042 - tipRing) * frac;
      } else {
        ring = tipRing + (buttRing - tipRing) * frac ** 2;
      }
      if (i === 0) type = style === 'snake' ? 'ring' : type; // every rod ends in a ringed tip-top
      const stand = {
        casting: ring * 0.9 + 0.0015, snake: ring * 0.45 + 0.0006, carp: ring * 1.8 + 0.002,
        chunky: ring * 1.5 + 0.002, onePiece: ring * 1.6 + 0.002,
      }[type] ?? ring * 1.7 + 0.002;
      const rb = rAt(s);
      const cz = gs * (rb + stand + ring);
      const bare = type === 'chunky' || type === 'onePiece' || type === 'snake';
      const tubeR = type === 'chunky' ? ring * 0.3 : type === 'onePiece' ? ring * 0.2 : type === 'snake' ? Math.max(0.0005, ring * 0.16) : Math.max(0.0011, ring * 0.22);
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(ring, tubeR, 8, 20), bare ? metalMat : ceramicMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(0, -s, cz);
      add(ringMesh, s);
      if (!bare) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(ring * 1.22, Math.max(0.0008, ring * 0.06), 6, 20), metalMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.copy(ringMesh.position);
        add(rim, s);
      }
      if (i > 0) {
        const legR = type === 'chunky' ? 0.0014 : type === 'onePiece' ? 0.0011 : type === 'snake' ? 0.0006 : 0.0008;
        const reach = type === 'snake' ? ring * 1.6 + 0.004 : 0.006 + ring * 0.6;
        for (const side of [-1, 1]) {
          const from = type === 'snake'
            ? new THREE.Vector3(0, -s, cz - gs * ring)
            : new THREE.Vector3(side * ring * 0.75, -s, cz - gs * ring * 0.55);
          strut(from, new THREE.Vector3(0, -s + side * reach, gs * (rb + 0.0004)), legR, metalMat, s);
        }
        if (type === 'onePiece' || type === 'carp') {
          strut(new THREE.Vector3(0, -s, cz - gs * ring), new THREE.Vector3(0, -s, gs * rb), legR * 1.3, metalMat, s);
        }
        if (s > 0.05) {
          const w = reach + 0.004;
          section(s - w, s + w, rAt(s - w) + 0.0011, rAt(s + w) + 0.0011, wrapMat);
        }
      }
      linePoints.push({ s, rest: new THREE.Vector3(0, -s, cz) });
    }

    // Hook keeper just above the grip, and the carp rod's line clip.
    const ks = sFix - 0.06;
    const keeper = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0008, 5, 10, Math.PI), metalMat);
    keeper.position.set(0, -ks, gs * (rAt(ks) + 0.002));
    keeper.rotation.y = gs < 0 ? Math.PI / 2 : -Math.PI / 2;
    add(keeper, ks);
    if (m.lineClip) {
      const cs = sFix - 0.1;
      add(box(0.004, 0.014, 0.005, capMat, rAt(cs) + 0.0035, -cs, 0), cs);
    }

    // ── Handle (u = metres from the butt end) ──
    gripMat.color.set(m.gripColor ?? 0x141414);
    const y = (u) => u - T;
    function band(u0, u1, r0, r1, mat, radial = 18) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, u1 - u0, radial, 1), mat);
      mesh.position.y = y((u0 + u1) / 2);
      parts.add(mesh);
      return mesh;
    }
    function lathe(u0, u1, rFn, mat, steps = 16) {
      const pts = [new THREE.Vector2(0.0005, y(u0))];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push(new THREE.Vector2(rFn(t), y(u0 + (u1 - u0) * t)));
      }
      pts.push(new THREE.Vector2(0.0005, y(u1)));
      parts.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 22), mat));
    }
    const winding = (u, r) => band(u, u + 0.004, r + 0.0007, r + 0.0007, metalMat);
    const cap = (u1, r, mat = capMat) => band(0, u1, r * 0.92, r, mat);
    function seat(u0, u1, r, kind = 'spinning') {
      band(u0, u1, r, r, seatMat);
      if (kind === 'fly') {
        if (m.seatWood) band(u0 + 0.014, u1 - 0.02, r + 0.0015, r + 0.0015, woodMat);
        band(u0, u0 + 0.014, r + 0.0022, r + 0.0022, seatMat);
        band(u1 - 0.02, u1, r + 0.0026, r + 0.0022, seatMat);
        winding(u1 - 0.022, r + 0.002);
        return;
      }
      band(u0, u0 + 0.016, r + 0.0032, r + 0.003, seatMat);
      band(u1 - 0.016, u1, r + 0.003, r + 0.0032, seatMat);
      winding(u0 + 0.016, r + 0.0026);
      winding(u1 - 0.02, r + 0.0026);
      if (kind === 'screw') {
        // Screw-down locking collar of a carp reel seat.
        for (let i = 0; i < 4; i++) band(u1 - 0.05 + i * 0.008, u1 - 0.045 + i * 0.008, r + 0.0042, r + 0.0042, seatMat);
      }
      if (kind === 'trigger') {
        // Finger trigger hooking down under the seat.
        const trig = box(0.007, 0.012, 0.024, seatMat, 0, y(u0 + 0.02), -(r + 0.011));
        trig.rotation.x = -0.45;
        parts.add(trig);
      }
    }

    let seatMid, hold, seatR;
    switch (m.grip) {
      case 'splitCork':
        cap(0.012, 0.0135);
        band(0.012, 0.075, 0.0138, 0.0135, corkMat);
        winding(0.075, 0.013);
        winding(0.186, 0.012);
        band(0.19, 0.26, 0.0128, 0.013, corkMat);
        seatR = 0.0105; seat(0.26, 0.37, seatR);
        band(0.37, 0.46, 0.0122, 0.009, corkMat);
        seatMid = hold = 0.315;
        break;
      case 'fullCork':
        cap(0.015, 0.0165);
        lathe(0.015, 0.36, (t) => 0.0157 + 0.0012 * Math.sin(Math.PI * t), corkMat);
        seatR = 0.012; seat(0.36, 0.48, seatR);
        lathe(0.48, 0.6, (t) => 0.0145 - 0.0042 * t, corkMat);
        seatMid = hold = 0.42;
        break;
      case 'longEva':
        cap(0.022, 0.0195);
        band(0.022, 0.42, 0.0172, 0.0165, gripMat);
        seatR = 0.0132; seat(0.42, 0.55, seatR);
        band(0.55, 0.73, 0.0165, 0.0132, gripMat);
        seatMid = hold = 0.485;
        break;
      case 'shrink':
        cap(0.015, 0.0158);
        band(0.015, 0.5, 0.0146, 0.0142, gripMat);
        seatR = 0.0125; seat(0.5, 0.63, seatR, 'screw');
        band(0.63, 0.74, 0.0142, 0.0118, gripMat);
        seatMid = hold = 0.565;
        break;
      case 'splitEva':
        cap(0.014, 0.0155);
        band(0.014, 0.09, 0.0155, 0.0145, gripMat);
        winding(0.09, 0.0138);
        band(0.2, 0.27, 0.0136, 0.014, gripMat);
        seatR = 0.0115; seat(0.27, 0.38, seatR, 'trigger');
        band(0.38, 0.45, 0.0128, 0.0102, gripMat);
        seatMid = hold = 0.325;
        break;
      case 'fullWells':
        cap(0.012, 0.0132, seatMat);
        seatR = 0.0112; seat(0.012, 0.1, seatR, 'fly');
        lathe(0.1, 0.265, (t) => 0.0112
          + 0.0042 * Math.exp(-(((t - 0.14) / 0.12) ** 2))
          + 0.0044 * Math.exp(-(((t - 0.8) / 0.13) ** 2))
          - 0.0032 * Math.max(0, (t - 0.86) / 0.14), corkMat);
        winding(0.265, 0.008);
        seatMid = 0.052; hold = 0.19;
        break;
      case 'cigar':
        cap(0.01, 0.012, seatMat);
        seatR = 0.0104; seat(0.01, 0.085, seatR, 'fly');
        lathe(0.085, 0.24, (t) => 0.0092 + 0.0052 * Math.sin(Math.PI * (0.18 + 0.78 * t)), corkMat);
        winding(0.24, 0.0094);
        seatMid = 0.045; hold = 0.165;
        break;
      default: // foam
        cap(0.015, 0.016);
        band(0.015, 0.3, 0.0158, 0.0148, gripMat);
        seatR = 0.0118; seat(0.3, 0.42, seatR);
        band(0.42, 0.52, 0.0148, 0.0122, gripMat);
        seatMid = hold = 0.36;
    }

    // ── Reel ──
    const reel = rm.style === 'baitcaster' ? baitcaster(M)
      : rm.style === 'fly' ? flyReel(M, rm.arbor === 'large')
        : spinningReel(M, rm.style === 'bigpit');
    const onTop = rm.style === 'baitcaster';
    reel.group.scale.setScalar(rm.size || 1);
    reel.group.position.set(0, y(seatMid), onTop ? seatR : -seatR);
    parts.add(reel.group);
    reel.group.updateMatrix();
    spinReelParts = reel.spin;
    const from = reel.from.clone().applyMatrix4(reel.group.matrix);

    // Line: off the reel, up through each guide (largest first), out of the tip.
    threadPath = [{ s: T - seatMid, rest: from }, ...linePoints.slice().reverse(), { s: 0, rest: new THREE.Vector3(0, 0.002, 0) }];
    threadGeo = new THREE.BufferGeometry().setFromPoints(threadPath.map((p) => p.rest));
    const threaded = new THREE.Line(threadGeo, new THREE.LineBasicMaterial({ color: rm.style === 'fly' ? 0xd4dc70 : 0xf2f2ea, transparent: true, opacity: 0.8 }));
    threaded.frustumCulled = false;
    parts.add(threaded);

    frame.position.copy(handAt).addScaledVector(axis, -(T - hold));
    tip.position.set(0, 0, 0);
  }

  // Held low on the right so the reel and grip sit in the corner of the view
  // with the blank rising toward the water.
  const restTilt = 0.1;
  rodGroup.position.set(0.4, 0, -0.6);
  rodGroup.rotation.set(restTilt, 0, -0.25);
  camera.add(rodGroup);

  // ─── Flex ─────────────────────────────────────────────────────────────────
  // Per-rod action (flexLen) and power (softness); see RODS in gear.js.
  let flexLen = 0.8; // metres of this blank that bend
  let flexFeel = 0.8; // the rod's flex length as tuned, for how far it bends
  let softness = 1;
  const tilt = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const slopeDir = new THREE.Vector3();
  function applyBend(bx, bz) {
    const b2 = bx * bx + bz * bz;
    for (const t of tubes) {
      const pos = t.geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = t.rest[i * 3], y = t.rest[i * 3 + 1], z = t.rest[i * 3 + 2];
        const { f, back } = beam(-y, flexLen);
        pos.setXYZ(i, x + bx * f, y - back * b2, z + bz * f);
      }
      pos.needsUpdate = true;
      t.geo.computeVertexNormals();
    }

    for (const r of riders) {
      const { f, k, back } = beam(r.s, flexLen);
      r.obj.position.set(r.pos.x + bx * f, r.pos.y - back * b2, r.pos.z + bz * f);
      tilt.setFromUnitVectors(up, slopeDir.set(bx * k, 1, bz * k).normalize());
      r.obj.quaternion.copy(tilt).multiply(r.quat);
    }

    const tp = threadGeo.getAttribute('position');
    threadPath.forEach((p, i) => {
      const { f, back } = beam(p.s, flexLen);
      tp.setXYZ(i, p.rest.x + bx * f, p.rest.y - back * b2, p.rest.z + bz * f);
    });
    tp.needsUpdate = true;

    const tipBeam = beam(0, flexLen);
    tip.position.set(bx * tipBeam.f, -tipBeam.back * b2, bz * tipBeam.f);
  }

  // ─── Dynamics ─────────────────────────────────────────────────────────────
  let pitch = restTilt, pitchVel = 0, yaw = 0, yawVel = 0;
  const bend = new THREE.Vector2(), bendVel = new THREE.Vector2();
  const tipWorld = new THREE.Vector3(), prevTip = new THREE.Vector3(), prevTip2 = new THREE.Vector3();
  let history = 0;
  const acc = new THREE.Vector3(), pull = new THREE.Vector3(), gravity = new THREE.Vector3();
  const frameQuat = new THREE.Quaternion();
  const rest = new THREE.Vector3();

  const tipVel = new THREE.Vector3(), awayDir = new THREE.Vector3();

  // targets: { pitch, yaw, pullTarget (world point the line runs to, or
  // null), pull (0..~0.5, how hard the line loads the tip), lineDrag (0..1,
  // how much line is lying in the water and anchoring the tip) }
  function update(dt, targets) {
    if (dt <= 0) return;
    const drag = targets.lineDrag || 0;
    // Line in the water holds the tip back: the rod swings more sluggishly.
    const omega = POSE_OMEGA * (1 - 0.45 * drag);
    const steps = Math.ceil(dt / 0.008);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      pitchVel += (omega ** 2 * (targets.pitch - pitch) - 2 * POSE_ZETA * omega * pitchVel) * h;
      pitch += pitchVel * h;
      yawVel += (omega ** 2 * (targets.yaw - yaw) - 2 * POSE_ZETA * omega * yawVel) * h;
      yaw += yawVel * h;
    }
    rodGroup.rotation.set(pitch, yaw, -0.25);
    camera.updateMatrixWorld(true);

    // Where the straight (unbent) tip is now, and how hard it's accelerating:
    // a swung rod's tip lags behind the swing, then whips through.
    frame.localToWorld(rest.set(0, 0, 0));
    tipWorld.copy(rest);
    frame.getWorldQuaternion(frameQuat).invert();
    if (history >= 2) {
      acc.copy(tipWorld).addScaledVector(prevTip, -2).add(prevTip2).divideScalar(dt * dt);
      if (acc.length() > 400) acc.setLength(400);
      tipVel.subVectors(tipWorld, prevTip).divideScalar(dt);
    } else {
      acc.set(0, 0, 0);
      tipVel.set(0, 0, 0);
      history++;
    }
    prevTip2.copy(prevTip);
    prevTip.copy(tipWorld);
    acc.applyQuaternion(frameQuat);

    // Line load: the tip is drawn toward wherever the line runs.
    let tx = 0, tz = 0;
    let pullAmount = targets.pull || 0;
    if (targets.pullTarget && drag > 0) {
      // Drawing the tip away from a float lying in the water drags the line
      // through it -- the water resists, so the pull (and the bend) builds
      // with how fast you move the rod away. Moving toward it just gives slack.
      awayDir.subVectors(tipWorld, targets.pullTarget).normalize();
      pullAmount += drag * Math.max(0, tipVel.dot(awayDir)) * 0.2;
    }
    if (targets.pullTarget && pullAmount > 0) {
      pull.subVectors(targets.pullTarget, tipWorld).normalize().applyQuaternion(frameQuat);
      // Bend follows the sideways part of the line's pull. Even a line running
      // nearly straight out along the blank still loads the tip, so keep a
      // floor on it instead of letting the rod go dead straight.
      const side = Math.hypot(pull.x, pull.z);
      if (side > 1e-4) {
        const load = pullAmount * Math.max(0.55, side) / side;
        tx = pull.x * load;
        tz = pull.z * load;
      }
    }
    // Line lying in the water resists the tip moving *any* way, sideways
    // included -- so sweeping the rod bows the tip back against the motion.
    if (drag > 0) {
      awayDir.copy(tipVel).applyQuaternion(frameQuat);
      tx -= awayDir.x * drag * 0.09;
      tz -= awayDir.z * drag * 0.09;
    }
    // A little droop under the blank's own weight.
    gravity.set(0, -1, 0).applyQuaternion(frameQuat);
    tx += gravity.x * 0.012;
    tz += gravity.z * 0.012;

    // A softer blank bows further under the same load and swings slower; a
    // stiff, powerful one barely moves and snaps back fast. The load curve
    // saturates smoothly (a blank stiffens as it bends), so a harder pull
    // always bends it a little more rather than hitting a wall.
    const maxBend = BEND_MAX * Math.min(1.3, softness) * (0.6 + flexFeel * 0.4);
    tx *= softness;
    tz *= softness;
    const raw = Math.hypot(tx, tz);
    if (raw > 1e-5) {
      const eased = maxBend * Math.tanh(raw / maxBend);
      tx *= eased / raw;
      tz *= eased / raw;
    }
    const k = BEND_K / softness;
    for (let i = 0; i < steps; i++) {
      // Line in the water also damps the tip's own wobble and makes it lag
      // harder behind a swing.
      const inertia = BEND_INERTIA * (1 + drag * 0.8);
      const damp = BEND_DAMP * (1 + drag * 1.2);
      bendVel.x += (k * (tx - bend.x) - damp * bendVel.x - inertia * acc.x) * h;
      bendVel.y += (k * (tz - bend.y) - damp * bendVel.y - inertia * acc.z) * h;
      bend.addScaledVector(bendVel, h);
    }
    if (bend.length() > maxBend * 1.15) {
      bend.setLength(maxBend * 1.15);
      bendVel.multiplyScalar(0.5);
    }
    applyBend(bend.x, bend.y);
  }

  // Dress the rod as the equipped rod and reel.
  function setRod(rod, reel) {
    const m = ROD_MODELS[rod?.id] || ROD_MODELS[rod?.fly ? 'rod-fly' : DEFAULT_ROD];
    const rm = REEL_MODELS[reel?.id] || REEL_MODELS[rod?.fly ? 'reel-fly' : DEFAULT_REEL];
    const key = `${rod?.id}|${reel?.id}`;
    if (key !== builtKey) {
      build(m, rm);
      builtKey = key;
      history = 0;
    }
    blankMat.color.set(m.blank);
    blankMat.roughness = m.rough;
    blankMat.metalness = m.metal;
    const map = m.weave ? weaveTexture() : null;
    if (blankMat.map !== map) { blankMat.map = map; blankMat.needsUpdate = true; }
    wrapMat.color.set(m.wrap);
    seatMat.color.set(m.seatColor ?? 0x202226);
    if (m.seatWood) woodMat.color.set(m.seatWood);
    M.reel.color.set(rm.body);
    M.reel.metalness = rm.bodyMetal;
    M.accent.color.set(rm.accent);
    M.trim.color.set(rm.trim);
    flexFeel = rod?.flex?.length ?? 0.8;
    flexLen = Math.min(sFix, flexFeel * sFix / FLEX_REF);
    softness = rod?.flex?.softness ?? 1;
    applyBend(bend.x, bend.y);
  }

  // Turn the handle (and rotor or spool) while line is being wound in.
  function spinReel(amount) {
    spinReelParts(amount);
  }

  setRod(null, null);
  return { rodGroup, setRod, tip, spinReel, restTilt, update, getBend: () => bend.length() };
}
