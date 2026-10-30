import * as THREE from '../../vendor/three.module.js';
import { waterSurfaceY } from '../water.js';
import { GPU } from './gpu.js';

// The landing net: a 42" triangular carp net -- two carbon arms off a
// spreader block, a cord across the front, a 1.8 m handle -- with a soft
// mesh bag that sags, sways and fills when a fish goes in.
//
// Local frame: the spreader block is the origin, +z points away from the
// angler (the open mouth), y is up. The rim lies in the y = 0 plane.

const ARM_LEN = 1.07;
const ARM_SPREAD = 0.56; // radians off the centre line (~32 deg)
const BAG_DEPTH = 0.62;
const HANDLE_LEN = 1.8;
const RIM_SEGMENTS = 56;
const BAG_RINGS = 14;

const REACH_TIME = 0.65;
const SCOOP_TIME = 1.25;
const OUT_TIME = 0.5;
const SHOW_AFTER_SCOOP = 2.2;

const ease = (t) => t * t * (3 - 2 * t);

// Knotted diamond mesh, drawn once: white twine on black, used as the alpha
// map so mipmapping fades it to a gauzy sheet at a distance.
function meshTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  const cells = 4;
  const c = size / cells;
  for (let i = -cells; i <= cells * 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * c, size); ctx.lineTo(i * c + size, 0); ctx.stroke();
  }
  // Knots where the twine crosses.
  ctx.fillStyle = '#fff';
  for (let y = 0; y <= cells; y++) {
    for (let x = 0; x <= cells; x++) {
      ctx.beginPath(); ctx.arc(x * c, y * c, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x * c + c / 2, y * c + c / 2, 3.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// The rim as one closed loop: block -> left arm -> cord -> right arm -> block.
function rimPoints() {
  const tipL = new THREE.Vector3(-Math.sin(ARM_SPREAD) * ARM_LEN, 0, Math.cos(ARM_SPREAD) * ARM_LEN);
  const tipR = new THREE.Vector3(-tipL.x, 0, tipL.z);
  // Arms bow outward a touch under the cord's tension.
  const arm = (tip, side) => (t) => new THREE.Vector3(tip.x * t + side * 0.045 * Math.sin(Math.PI * t), 0, tip.z * t);
  const left = arm(tipL, -1), right = arm(tipR, 1);
  const cord = (t) => tipL.clone().lerp(tipR, t).add(new THREE.Vector3(0, 0, 0.02 * Math.sin(Math.PI * t)));
  // Spend the loop's points by length: arms 1.07 m each, cord ~1.13 m.
  const cordLen = tipL.distanceTo(tipR);
  const total = ARM_LEN * 2 + cordLen;
  const pts = [];
  for (let i = 0; i < RIM_SEGMENTS; i++) {
    const d = (i / RIM_SEGMENTS) * total;
    if (d < ARM_LEN) pts.push(left(d / ARM_LEN));
    else if (d < ARM_LEN + cordLen) pts.push(cord((d - ARM_LEN) / cordLen));
    else pts.push(right(1 - (d - ARM_LEN - cordLen) / ARM_LEN));
  }
  return { pts, tipL, tipR, left, right, cord, perimeter: total };
}

export function createLandingNet(scene, { onSplash } = {}) {
  const group = new THREE.Group();
  group.visible = false;
  const rim = rimPoints();

  const carbon = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.32, metalness: 0.25 });
  const block = new THREE.MeshStandardMaterial({ color: 0x2b2f31, roughness: 0.55, metalness: 0.15 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.35, metalness: 0.9 });
  const eva = new THREE.MeshStandardMaterial({ color: 0x1b1d1c, roughness: 0.95 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x2f3a2c, roughness: 0.9 });

  // Arms and cord.
  const curveOf = (fn, n = 16) => new THREE.CatmullRomCurve3(Array.from({ length: n + 1 }, (_, i) => fn(i / n)));
  const armL = new THREE.Mesh(new THREE.TubeGeometry(curveOf(rim.left), 24, 0.0085, 6), carbon);
  const armR = new THREE.Mesh(new THREE.TubeGeometry(curveOf(rim.right), 24, 0.0085, 6), carbon);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(curveOf(rim.cord), 24, 0.003, 4), cordMat);
  // Little end caps where the cord ties on.
  for (const tip of [rim.tipL, rim.tipR]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), block);
    cap.position.copy(tip);
    group.add(cap);
  }
  // Spreader block with its brass thread.
  const spreader = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.09), block);
  spreader.position.set(0, 0, 0.005);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.035, 10), brass);
  thread.rotation.x = Math.PI / 2;
  thread.position.set(0, 0, -0.06);
  group.add(armL, armR, cord, spreader, thread);

  // Handle: built along +y from the block, aimed at the angler's hand each frame.
  const handle = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.013, HANDLE_LEN, 10).translate(0, HANDLE_LEN / 2 + 0.06, 0), carbon);
  const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.05, 10).translate(0, 0.06 + HANDLE_LEN * 0.5, 0), brass);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.34, 12).translate(0, 0.06 + HANDLE_LEN - 0.2, 0), eva);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.017, 0.03, 12).translate(0, 0.06 + HANDLE_LEN + 0.01, 0), block);
  handle.add(pole, joint, grip, butt);
  group.add(handle);

  // The bag: a grid of rings hanging from the rim, rebuilt each frame so it
  // can sway and fill.
  const cols = RIM_SEGMENTS + 1; // last column repeats the first (seam)
  const rows = BAG_RINGS + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const index = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      uvs[i * 2] = (c / RIM_SEGMENTS) * rim.perimeter / 0.1;
      uvs[i * 2 + 1] = (r / BAG_RINGS) * BAG_DEPTH * 1.4 / 0.1;
      if (r < BAG_RINGS && c < RIM_SEGMENTS) {
        const a = i, b = i + 1, d = i + cols, e = i + cols + 1;
        index.push(a, d, b, b, d, e);
      }
    }
  }
  const bagGeo = new THREE.BufferGeometry();
  bagGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  bagGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  bagGeo.setIndex(index);
  const alpha = meshTexture();
  const bagMat = new THREE.MeshStandardMaterial({
    color: 0x26352a, roughness: 0.9, alphaMap: alpha, transparent: true, opacity: 0.95,
    side: THREE.DoubleSide, depthWrite: false,
  });
  // Below the surface the twine fades into the water's colour within a
  // hand's depth or so -- dam water is never clear.
  const underwater = { uWaterTint: { value: new THREE.Color(0x4a4630) }, uSeeDepth: { value: 0.3 } };
  if (GPU.on) GPU.nodes.netNodes(bagMat, underwater);
  else bagMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, underwater);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nuniform vec3 uWaterTint;\nuniform float uSeeDepth;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float sunk = clamp(-vWorldY / uSeeDepth, 0.0, 1.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uWaterTint, sunk * 0.85);
        gl_FragColor.a *= 1.0 - sunk * sunk;`);
  };
  const bag = new THREE.Mesh(bagGeo, bagMat);
  bag.renderOrder = 2;
  bag.frustumCulled = false;
  group.add(bag);

  const centre = rim.pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / rim.pts.length);

  let fishFill = 0; // 0 empty .. 1 a fish's weight in the bottom
  const sway = new THREE.Vector2(), swayVel = new THREE.Vector2();
  function shapeBag(elapsed, depthScale) {
    const depth = BAG_DEPTH * depthScale * (1 + fishFill * 0.35);
    for (let r = 0; r < rows; r++) {
      const v = r / BAG_RINGS;
      const pull = Math.pow(v, 1.4) * 0.92; // drawn in towards the bottom
      const drop = Math.sin(v * Math.PI / 2) * depth;
      const swing = v * v;
      for (let c = 0; c < cols; c++) {
        const p = rim.pts[c % RIM_SEGMENTS];
        const i = (r * cols + c) * 3;
        // Loose twine ripples a little, more so lower down.
        const flutter = Math.sin(elapsed * 2.3 + c * 0.7 + r * 0.9) * 0.008 * v;
        positions[i] = p.x + (centre.x - p.x) * pull + sway.x * swing + flutter;
        positions[i + 1] = -drop;
        positions[i + 2] = p.z + (centre.z - p.z) * pull + sway.y * swing + flutter;
      }
    }
    bagGeo.attributes.position.needsUpdate = true;
    bagGeo.computeVertexNormals();
    return depth;
  }

  // The fish in the bag after a scoop.
  let caught = null;

  // Animation state.
  let state = 'hidden', t = 0;
  const pos = new THREE.Vector3(), lastPos = new THREE.Vector3(), lastVel = new THREE.Vector3();
  let pitch = 0, yaw = 0;
  const from = new THREE.Vector3(), fromPitch = { v: 0 };
  const target = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function setFrom() { from.copy(pos); fromPitch.v = pitch; }

  // fishPos: the fish (world); playerPos: the angler's feet (world).
  function update(dt, elapsed, { show, fishPos, playerPos }) {
    if (playerPos) {
      // Net hand: left of the rod, about waist high.
      const dx = (fishPos?.x ?? pos.x) - playerPos.x, dz = (fishPos?.z ?? pos.z) - playerPos.z;
      const len = Math.hypot(dx, dz) || 1;
      const fx = dx / len, fz = dz / len;
      hand.set(playerPos.x + fz * 0.35 + fx * 0.3, playerPos.y + 1.0, playerPos.z - fx * 0.35 + fz * 0.3);
      if (state !== 'scoop' && state !== 'shown') yaw = Math.atan2(fx, fz);
      if (fishPos) {
        // Mouth of the net under the fish, block on the angler's side.
        target.set(fishPos.x - fx * 0.62, 0, fishPos.z - fz * 0.62);
        target.y = waterSurfaceY(target.x, target.z, elapsed) + 0.05;
      }
    }

    if (show && (state === 'hidden' || state === 'out')) {
      if (state === 'hidden') { pos.copy(hand).lerp(target, 0.35); pitch = -0.7; }
      setFrom(); state = 'in'; t = 0; group.visible = true;
      fishFill = 0;
      if (caught) { group.remove(caught); caught = null; }
    } else if (!show && (state === 'in' || state === 'held')) {
      setFrom(); state = 'out'; t = 0;
    }

    t += dt;
    let depthScale = 1;
    if (state === 'in') {
      const k = ease(Math.min(1, t / REACH_TIME));
      pos.lerpVectors(from, target, k);
      pos.y += Math.sin(k * Math.PI) * 0.25;
      pitch = THREE.MathUtils.lerp(fromPitch.v, 0.12, k);
      if (t >= REACH_TIME) { state = 'held'; onSplash?.(pos.clone().addScaledVector(tmp.set(Math.sin(yaw), 0, Math.cos(yaw)), 0.8), 0.35); }
    } else if (state === 'held') {
      // Follows the fish slowly, riding the swell.
      pos.lerp(target, 1 - Math.exp(-dt * 3));
      pitch = 0.12 + Math.sin(elapsed * 1.3) * 0.015;
    } else if (state === 'scoop') {
      const k = ease(Math.min(1, t / SCOOP_TIME));
      tmp.copy(hand).lerp(from, 0.45);
      tmp.y = from.y + 0.95;
      pos.lerpVectors(from, tmp, k);
      pitch = THREE.MathUtils.lerp(fromPitch.v, -0.45, k);
      fishFill = Math.min(1, t / 0.35);
      if (t >= SCOOP_TIME) { state = 'shown'; t = 0; }
    } else if (state === 'shown') {
      pitch = -0.45 + Math.sin(elapsed * 2) * 0.02;
      if (t >= SHOW_AFTER_SCOOP) { setFrom(); state = 'out'; t = 0; }
    } else if (state === 'out') {
      const k = ease(Math.min(1, t / OUT_TIME));
      pos.lerpVectors(from, hand, k * 0.6);
      pitch = THREE.MathUtils.lerp(fromPitch.v, -0.8, k);
      depthScale = 1 - k * 0.4;
      if (t >= OUT_TIME) { state = 'hidden'; group.visible = false; if (caught) { group.remove(caught); caught = null; } }
    }
    if (!group.visible) return;

    group.position.copy(pos);
    group.rotation.set(pitch, yaw, 0, 'YXZ');

    // Sway: the bag lags behind how the net is being moved.
    if (dt > 0) {
      const vel = tmp.subVectors(pos, lastPos).multiplyScalar(1 / dt);
      const acc = vel.clone().sub(lastVel).multiplyScalar(1 / dt);
      lastVel.copy(vel);
      const s = Math.sin(yaw), c = Math.cos(yaw);
      const ax = acc.x * c - acc.z * s, az = acc.x * s + acc.z * c;
      swayVel.x += (-28 * sway.x - 4.5 * swayVel.x - Math.max(-30, Math.min(30, ax)) * 0.05) * dt;
      swayVel.y += (-28 * sway.y - 4.5 * swayVel.y - Math.max(-30, Math.min(30, az)) * 0.05) * dt;
      sway.addScaledVector(swayVel, dt);
      sway.clampLength(0, 0.25);
    }
    lastPos.copy(pos);
    const depth = shapeBag(elapsed, depthScale);

    // Handle up to the hand.
    group.updateMatrixWorld(true);
    const local = group.worldToLocal(tmp.copy(hand));
    handle.quaternion.setFromUnitVectors(up, local.normalize());

    if (caught) caught.position.set(centre.x, -depth * 0.62, centre.z * 0.85);
  }

  // A calm fish drawn over the cord: lift it out. `fishMesh` is a fresh model
  // of the fish (already scaled), which rides in the bag.
  function scoop(fishMesh) {
    setFrom(); state = 'scoop'; t = 0; group.visible = true;
    onSplash?.(pos.clone().addScaledVector(tmp.set(Math.sin(yaw), 0, Math.cos(yaw)), 0.6), 1);
    if (caught) group.remove(caught);
    caught = fishMesh || null;
    if (caught) {
      // Curled on its flank in the bottom of the mesh; the net is about 1 m
      // across, so a big fish stays inside it.
      caught.scale.multiplyScalar(Math.min(1, 0.85 / Math.max(0.01, caught.scale.x * 0.62)));
      caught.rotation.set(Math.PI / 2.3, Math.PI / 2, 0.25, 'YXZ');
      group.add(caught);
    }
  }

  const isBusy = () => state !== 'hidden';
  // How far you can see into this water (metres), and its colour.
  function setWater({ seeDepthM, tint } = {}) {
    if (seeDepthM != null) underwater.uSeeDepth.value = Math.max(0.08, seeDepthM);
    if (tint != null) underwater.uWaterTint.value.set(tint);
  }

  scene.add(group);
  return { group, update, scoop, isBusy, setWater };
}
