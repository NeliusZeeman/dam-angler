import * as THREE from '../../vendor/three.module.js';
import { corkTexture } from './pixelTextures.js';

// Reel finish by rod tier.
const REEL_BY_TIER = {
  1: { reel: 0x2a2a2a, reelAccent: 0xb0b0b0 },
  2: { reel: 0x1c1c1c, reelAccent: 0xd8d8d8 },
  3: { reel: 0x1a1a1a, reelAccent: 0xd4a640 },
};

// Where the blank meets the handle: everything behind this (foregrip, seat,
// reel, cork) is always rigid.
const S_FIX = 1.45;

// Cantilever beam under a tip load: normalised deflection, slope and the
// arc-length pull-back, for a point `s` metres back from the tip. `flexLen`
// is how much of the blank takes the bend -- the rod's action: a fast rod
// bends only in its top ~0.55m, a through-action rod all the way to 1.45m.
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

// A proper spinning rod held in the right hand: tapered graphite blank with
// thread-wrapped guides that grow toward the reel, EVA foregrip, reel seat,
// cork handle, a spinning reel hanging underneath, and the line threaded
// from the spool up through every guide to the tip.
//
// Built in a "rod frame": origin at the rod tip, local -Y runs back down the
// blank toward the butt, local -Z is the underside where guides and reel
// hang. The blank flexes in the frame's X/Z plane.
export function createPlayerRod(camera) {
  const rodGroup = new THREE.Group();

  const shaftTheta = Math.PI / 2 + 0.35;
  const axis = new THREE.Vector3(0, Math.cos(shaftTheta), Math.sin(shaftTheta));
  const tipLocal = new THREE.Vector3(0, 0, -0.7).addScaledVector(axis, -0.87);

  const frame = new THREE.Group();
  frame.position.copy(tipLocal);
  frame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
  rodGroup.add(frame);

  const blankMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.18, metalness: 0.45 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x9a2a22, roughness: 0.3, metalness: 0.2 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, roughness: 0.15, metalness: 0.95 });
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.1, metalness: 0.6 });
  const evaMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
  const corkMat = new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.9 });
  const reelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.28, metalness: 0.75 });
  const reelAccentMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.2, metalness: 0.9 });

  const BLANK_LEN = 1.5;
  const radiusAt = (s) => 0.0022 + s * 0.0068;

  // Rigid bits riding on the flexing blank: each remembers its rest pose and
  // how far back from the tip it sits.
  const riders = [];
  function ride(obj, s) {
    riders.push({ obj, s, pos: obj.position.clone(), quat: obj.quaternion.clone() });
    return obj;
  }

  function section(s0, s1, r0, r1, mat, radial = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, s1 - s0, radial, 1), mat);
    m.position.y = -(s0 + s1) / 2;
    frame.add(m);
    if (s0 < S_FIX) ride(m, (s0 + s1) / 2);
    return m;
  }

  // The blank itself, finely segmented so it can curve.
  const blankGeo = new THREE.CylinderGeometry(radiusAt(0), radiusAt(BLANK_LEN), BLANK_LEN, 10, 48, false);
  blankGeo.translate(0, -BLANK_LEN / 2, 0);
  const blankRest = Float32Array.from(blankGeo.getAttribute('position').array);
  const blank = new THREE.Mesh(blankGeo, blankMat);
  blank.frustumCulled = false;
  frame.add(blank);

  // Ferrule joint halfway up (two-piece rod), with a decorative wrap each side.
  section(0.72, 0.8, radiusAt(0.72) + 0.0012, radiusAt(0.8) + 0.0012, blankMat);
  section(0.8, 0.806, radiusAt(0.8) + 0.0016, radiusAt(0.806) + 0.0016, wrapMat);
  section(0.714, 0.72, radiusAt(0.714) + 0.0016, radiusAt(0.72) + 0.0016, wrapMat);

  // Guides: big stripping guide near the reel down to a tiny tip-top, each a
  // ceramic-lined ring on a two-legged frame.
  const GUIDES = [
    { s: 0.012, ring: 0.0035, stand: 0.004 },
    { s: 0.17, ring: 0.005, stand: 0.009 },
    { s: 0.36, ring: 0.0065, stand: 0.013 },
    { s: 0.6, ring: 0.009, stand: 0.018 },
    { s: 0.88, ring: 0.013, stand: 0.026 },
    { s: 1.2, ring: 0.021, stand: 0.042 },
  ];
  const linePoints = []; // { s, rest } -- threaded line waypoints
  for (const g of GUIDES) {
    const rb = radiusAt(g.s);
    const cz = -(rb + g.stand + g.ring);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(g.ring, Math.max(0.0012, g.ring * 0.22), 8, 20), ceramicMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -g.s, cz);
    frame.add(ring);
    ride(ring, g.s);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(g.ring * 1.22, 0.0008, 6, 20), metalMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(ring.position);
    frame.add(rim);
    ride(rim, g.s);
    for (const side of [-1, 1]) {
      const legLen = g.stand + g.ring * 0.6;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0011, legLen, 5), metalMat);
      leg.position.set(side * g.ring * 0.45, -g.s + side * 0.004, -(rb + legLen / 2));
      leg.rotation.x = Math.PI / 2;
      leg.rotation.z = side * 0.25;
      frame.add(leg);
      ride(leg, g.s);
    }
    if (g.s > 0.05) section(g.s - 0.012, g.s + 0.012, rb + 0.0011, radiusAt(g.s + 0.012) + 0.0011, wrapMat);
    linePoints.push({ s: g.s, rest: new THREE.Vector3(0, -g.s, cz) });
  }
  const keeper = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0008, 5, 10, Math.PI), metalMat);
  keeper.position.set(0, -1.38, -(radiusAt(1.38) + 0.002));
  keeper.rotation.y = Math.PI / 2;
  frame.add(keeper);
  ride(keeper, 1.38);

  // Handle: EVA foregrip, reel seat with hoods, cork grip, butt cap.
  section(1.42, 1.5, 0.0145, 0.0155, evaMat);
  section(1.5, 1.62, 0.0125, 0.0125, reelMat);
  section(1.5, 1.515, 0.0155, 0.0155, reelAccentMat);
  section(1.605, 1.62, 0.0155, 0.0155, reelAccentMat);
  section(1.62, 1.98, 0.0165, 0.0185, corkMat, 18);
  section(1.98, 2.0, 0.019, 0.017, evaMat, 18);

  // ─── Spinning reel, hanging under the seat ────────────────────────────────
  const reel = new THREE.Group();
  reel.position.set(0, -1.56, -0.0125);
  frame.add(reel);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.004), reelMat);
  foot.position.z = -0.002;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.05), reelMat);
  stem.position.set(0, 0.004, -0.028);
  stem.rotation.x = -0.25;
  reel.add(foot, stem);
  const bodyZ = -0.068;
  const gearbox = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), reelMat);
  gearbox.scale.set(0.8, 1.15, 1);
  gearbox.position.set(0, -0.01, bodyZ);
  reel.add(gearbox);
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.022, 0.03, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.28, metalness: 0.75, side: THREE.DoubleSide }));
  rotor.position.set(0, 0.03, bodyZ);
  reel.add(rotor);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 24), reelAccentMat);
  spool.position.set(0, 0.058, bodyZ);
  reel.add(spool);
  const lineOnSpool = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 }));
  lineOnSpool.position.set(0, 0.058, bodyZ);
  reel.add(lineOnSpool);
  const spoolLip = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0022, 6, 24), reelAccentMat);
  spoolLip.rotation.x = Math.PI / 2;
  spoolLip.position.set(0, 0.071, bodyZ);
  reel.add(spoolLip);
  const dragKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.012, 12), reelMat);
  dragKnob.position.set(0, 0.077, bodyZ);
  reel.add(dragKnob);
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0013, 6, 24, Math.PI), metalMat);
  bail.position.set(0, 0.05, bodyZ);
  bail.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  reel.add(bail);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 8), metalMat);
  roller.position.set(0, 0.05, bodyZ + 0.031);
  reel.add(roller);
  const crankGroup = new THREE.Group();
  crankGroup.position.set(0.026, -0.01, bodyZ);
  const crankShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 8), reelAccentMat);
  crankShaft.rotation.z = Math.PI / 2;
  crankShaft.position.x = 0.01;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.055), reelMat);
  arm.position.set(0.021, 0, -0.024);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0075, 0.022, 10), evaMat);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.033, 0, -0.05);
  crankGroup.add(crankShaft, arm, knob);
  reel.add(crankGroup);

  // Line: off the spool, up through each guide (largest first), out of the tip.
  const spoolFront = new THREE.Vector3(0, -1.56 + 0.05, -0.0125 + bodyZ + 0.031);
  const threadPath = [{ s: 2, rest: spoolFront }, ...linePoints.slice().reverse(), { s: 0, rest: new THREE.Vector3(0, 0.002, 0) }];
  const threadGeo = new THREE.BufferGeometry().setFromPoints(threadPath.map((p) => p.rest));
  const threaded = new THREE.Line(threadGeo, new THREE.LineBasicMaterial({ color: 0xf2f2ea, transparent: true, opacity: 0.8 }));
  threaded.frustumCulled = false;
  frame.add(threaded);

  // The line leaves from the tip-top, which moves as the blank flexes.
  const tip = new THREE.Object3D();
  frame.add(tip);

  // Held low on the right so the reel and cork grip sit in the corner of the
  // view with the blank rising toward the water.
  const restTilt = 0.1;
  rodGroup.position.set(0.4, 0, -0.6);
  rodGroup.rotation.set(restTilt, 0, -0.25);
  camera.add(rodGroup);

  // ─── Flex ─────────────────────────────────────────────────────────────────
  // Per-rod action (flexLen) and power (softness); see RODS in gear.js.
  let flexLen = 0.8;
  let softness = 1;
  const tilt = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const slopeDir = new THREE.Vector3();
  function applyBend(bx, bz) {
    const b2 = bx * bx + bz * bz;
    const pos = blankGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = blankRest[i * 3], y = blankRest[i * 3 + 1], z = blankRest[i * 3 + 2];
      const { f, back } = beam(-y, flexLen);
      pos.setXYZ(i, x + bx * f, y - back * b2, z + bz * f);
    }
    pos.needsUpdate = true;
    blankGeo.computeVertexNormals();

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
    const maxBend = BEND_MAX * Math.min(1.3, softness) * (0.6 + flexLen * 0.4);
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

  function setRod(rod) {
    const a = { ...(REEL_BY_TIER[rod.tier] || REEL_BY_TIER[1]), ...(rod.look || {}) };
    if (a.blank !== undefined) blankMat.color.set(a.blank);
    if (a.wrap !== undefined) wrapMat.color.set(a.wrap);
    flexLen = Math.min(S_FIX, rod.flex?.length ?? 0.8);
    softness = rod.flex?.softness ?? 1;
    reelMat.color.set(a.reel);
    reelAccentMat.color.set(a.reelAccent);
  }

  // Turn the crank and rotor while line is being wound in.
  function spinReel(amount) {
    crankGroup.rotation.x -= amount;
    rotor.rotation.y += amount * 5;
  }

  return { rodGroup, setRod, tip, spinReel, restTilt, update, getBend: () => bend.length() };
}
