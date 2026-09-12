import * as THREE from '../vendor/three.module.js';
import { POND_CENTER, WATER_RADIUS } from './pond.js';

const WATER_LANDING_MARGIN = 1.2; // a cast always lands at least this far into the water
const TWITCH_COOLDOWN = 0.35;
const TWITCH_KICK_UP = 0.14;
const TWITCH_KICK_SIDE = 0.08;
const TWITCH_DECAY_PER_SEC = 7;
const REEL_HOLD_THRESHOLD = 0.18; // press-and-hold longer than this starts reeling in
const REEL_SPEED = 3.2; // units/sec the lure closes toward the rod tip while reeling
const REEL_ARRIVE_DISTANCE = 0.35;
const WAKE_INTERVAL = 0.18; // seconds between wake ripples while reeling
const LINE_SEGMENTS = 12;
const POWER_CHARGE_SECONDS = 1.3; // hold this long for a full-power cast
const BASE_CAST_REACH = 3; // minimum reach even at zero power

// Mouse-motion control. Speeds are in screen-widths per second.
const MOTION_REEL_THRESHOLD = 0.12; // sweep faster than this to work a lure
const MOTION_REEL_GAIN = 7; // lure retrieve speed per unit of mouse speed
const MOTION_REEL_MAX = 5.5; // units/sec cap on motion retrieve
const MOTION_SWAY_GAIN = 3.0; // sideways mouse sweep -> lure swings across
const MOTION_SWAY_DECAY = 5;
const BAIT_WIGGLE_GAIN = 0.35; // bait only wiggles under mouse motion
const FLICK_POWER_GAIN = 0.28; // upward flick on release adds cast power
const FLICK_POWER_MAX = 0.35;

export function createCasting({ scene, camera, domElement, getRod, rodTip, waterMesh, onSplash, onWake, getLureKind = () => 'bait' }) {
  const bobberGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const bobberMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
  const bobber = new THREE.Mesh(bobberGeo, bobberMat);
  bobber.visible = false;
  scene.add(bobber);

  // The line is drawn as a curve (not a straight segment) so it visibly
  // bends/sags between casts and pulls taut while being reeled in.
  const linePositions = new Float32Array((LINE_SEGMENTS + 1) * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const line = new THREE.Line(lineGeo, lineMat);
  line.visible = false;
  scene.add(line);

  const rodTipWorld = new THREE.Vector3();
  const target = new THREE.Vector3();
  const restPosition = new THREE.Vector3();
  const twitchOffset = new THREE.Vector3();
  const aimPoint = new THREE.Vector3(0, 0, -10);
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const fightOffset = new THREE.Vector3();
  const curvePointA = new THREE.Vector3();
  const curvePointB = new THREE.Vector3();
  const curvePointC = new THREE.Vector3();
  const curveOut = new THREE.Vector3();

  let phase = 'idle';
  let airTime = 0;
  const AIR_DURATION = 1.2;
  const launchTarget = new THREE.Vector3();
  let biteCallback = null;
  let twitchCallback = null;
  let twitchCooldown = 0;
  let fightProfile = null;
  let fightTimer = 0;

  let pressing = false;
  let pressTimer = 0;
  let wakeTimer = 0;
  let castArmed = false;
  let power = 0;
  const hangOffset = new THREE.Vector3(0, -0.15, 0.05);

  // Mouse motion state: where the cursor is (NDC) and how fast it's moving.
  const mouseNDC = new THREE.Vector2(0, 0);
  let moveDxAcc = 0; // accumulated since last update, in screen widths
  let moveDyAcc = 0;
  let motionSpeed = 0; // smoothed, screen-widths/sec
  let flickUp = 0; // recent upward speed, for the cast flick bonus
  let lureSway = 0; // sideways offset of a worked lure
  const swayPerp = new THREE.Vector3();
  const motionToTip = new THREE.Vector3();

  // Distance along a flat ray from `origin` in direction `dir` to the point
  // `margin` inside the water's edge. Null if the ray never enters the water.
  function distanceToWaterEntry(origin, dir, margin) {
    const r = WATER_RADIUS - margin;
    const ox = origin.x - POND_CENTER.x;
    const oz = origin.z - POND_CENTER.z;
    const b = 2 * (ox * dir.x + oz * dir.z);
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / 2;
    return t > 0 ? t : null;
  }

  function isPointInWater(point) {
    const dx = point.x - POND_CENTER.x;
    const dz = point.z - POND_CENTER.z;
    return Math.sqrt(dx * dx + dz * dz) < WATER_RADIUS;
  }

  const landingScratch = new THREE.Vector3();

  // Where a cast released right now would land: toward the cursor's point
  // on the water, as far as the current power allows, never short of the
  // water's edge. Shared by the actual cast and the on-water aim ring.
  function computeLanding(aim, castPower, out) {
    const rod = getRod();
    const maxReach = BASE_CAST_REACH + castPower * rod.castDistance;
    const toAim = landingScratch.subVectors(aim, camera.position);
    toAim.y = 0;
    const aimDistance = toAim.length();
    if (aimDistance < 1e-4) toAim.set(0, 0, -1); else toAim.normalize();

    // Even a feather-light tap has to reach the water -- the player stands
    // on the bank, so a short lob that landed on the grass could never be
    // fished (and no fish should ever bite a lure lying on the shore).
    const toWater = distanceToWaterEntry(camera.position, toAim, WATER_LANDING_MARGIN);
    const minReach = toWater !== null ? toWater : maxReach;
    const clampedDistance = Math.max(minReach, Math.min(aimDistance, maxReach));

    out.copy(camera.position).addScaledVector(toAim, clampedDistance);
    out.y = 0;
    return out;
  }

  // Aim ring on the water: shows exactly where the cast will land.
  // Drawn on top of everything (no depth test, late render order) so the
  // dock lip or reeds can never hide where you're aiming.
  const reticle = new THREE.Group();
  const reticleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  reticleRing.rotation.x = -Math.PI / 2;
  reticleRing.renderOrder = 999;
  reticle.add(reticleRing);
  const reticleDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  reticleDot.rotation.x = -Math.PI / 2;
  reticleDot.renderOrder = 999;
  reticle.add(reticleDot);
  reticle.position.y = 0.06;
  reticle.visible = false;
  scene.add(reticle);

  function releaseCastAt(aim) {
    if (phase !== 'aiming') return;
    computeLanding(aim, power, launchTarget);
    phase = 'inAir';
    airTime = 0;
    power = 0;
    bobber.visible = true;
    line.visible = true;
  }

  function triggerBite(bite) {
    if (phase !== 'waiting' && phase !== 'reeling') return;
    phase = 'biting';
    fightProfile = bite || { speed: 'medium', style: 'steady' };
    fightTimer = 0;
    if (biteCallback) biteCallback();
  }

  function onBite(callback) {
    biteCallback = callback;
  }

  function onTwitch(callback) {
    twitchCallback = callback;
  }

  function tapRod() {
    if (phase !== 'waiting' || twitchCooldown > 0) return false;
    twitchCooldown = TWITCH_COOLDOWN;
    twitchOffset.set((Math.random() - 0.5) * TWITCH_KICK_SIDE, TWITCH_KICK_UP, (Math.random() - 0.5) * TWITCH_KICK_SIDE);
    if (twitchCallback) twitchCallback();
    return true;
  }

  function resetToIdle() {
    phase = 'idle';
    bobber.visible = false;
    line.visible = false;
    twitchOffset.set(0, 0, 0);
    fightOffset.set(0, 0, 0);
    fightProfile = null;
    pressing = false;
    pressTimer = 0;
    power = 0;
  }

  function updateLineCurve(sagAmount) {
    curvePointA.copy(rodTipWorld);
    curvePointB.copy(bobber.position);
    curvePointC.lerpVectors(curvePointA, curvePointB, 0.5);
    curvePointC.y -= sagAmount;

    const positions = line.geometry.attributes.position;
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      const inv = 1 - t;
      curveOut.set(
        inv * inv * curvePointA.x + 2 * inv * t * curvePointC.x + t * t * curvePointB.x,
        inv * inv * curvePointA.y + 2 * inv * t * curvePointC.y + t * t * curvePointB.y,
        inv * inv * curvePointA.z + 2 * inv * t * curvePointC.z + t * t * curvePointB.z,
      );
      positions.setXYZ(i, curveOut.x, curveOut.y, curveOut.z);
    }
    positions.needsUpdate = true;
  }

  function update(deltaSeconds, windState) {
    rodTip.getWorldPosition(rodTipWorld);

    // Turn this frame's mouse travel into a smoothed speed, then reset.
    const dt = Math.max(deltaSeconds, 1e-3);
    const rawSpeed = Math.hypot(moveDxAcc, moveDyAcc) / dt;
    motionSpeed += (rawSpeed - motionSpeed) * Math.min(1, dt * 12);
    const upSpeed = Math.max(0, -moveDyAcc) / dt;
    flickUp = Math.max(flickUp * Math.max(0, 1 - dt * 6), upSpeed);
    const frameDx = moveDxAcc;
    moveDxAcc = 0;
    moveDyAcc = 0;

    if (twitchCooldown > 0) {
      twitchCooldown = Math.max(0, twitchCooldown - deltaSeconds);
    }

    if (pressing && phase === 'waiting') {
      pressTimer += deltaSeconds;
      if (pressTimer > REEL_HOLD_THRESHOLD) {
        phase = 'reeling';
        wakeTimer = 0;
      }
    }

    if (phase === 'aiming' && pressing) {
      power = Math.min(1, power + deltaSeconds / POWER_CHARGE_SECONDS);
    }

    // Aim ring: visible whenever a cast is possible, sitting where it would
    // land. While charging it pulses and creeps out toward the cursor.
    const canCast = phase === 'idle' || phase === 'hanging' || phase === 'aiming';
    reticle.visible = canCast;
    if (canCast) {
      computeLanding(aimPoint, phase === 'aiming' ? power : 0, reticle.position);
      reticle.position.y = 0.06;
      // Grow with distance so the ring reads the same size near or far.
      const distFromCamera = reticle.position.distanceTo(camera.position);
      const sizeForDistance = 0.9 + distFromCamera * 0.06;
      const pulse = phase === 'aiming' ? 1 + Math.sin(performance.now() * 0.012) * 0.12 + power * 0.4 : 1;
      reticle.scale.setScalar(sizeForDistance * pulse);
      reticleRing.material.opacity = phase === 'aiming' ? 0.95 : 0.75;
    }

    if (phase === 'inAir') {
      airTime += deltaSeconds;
      const t = Math.min(1, airTime / AIR_DURATION);
      target.copy(rodTipWorld).lerp(launchTarget, t);
      target.x += windState.windDirX * windState.windSpeed * 0.02 * t;
      target.z += windState.windDirZ * windState.windSpeed * 0.02 * t;
      target.y = Math.sin(t * Math.PI) * 1.5;
      bobber.position.copy(target);
      updateLineCurve(0.05);
      if (t >= 1) {
        phase = 'waiting';
        bobber.position.y = 0;
        restPosition.copy(bobber.position);
        twitchOffset.set(0, 0, 0);
        if (onSplash) onSplash(bobber.position);
      }
    }

    if (phase === 'waiting') {
      const lureKind = getLureKind();
      const working = lureKind === 'lure' && motionSpeed > MOTION_REEL_THRESHOLD;

      if (working) {
        // Working a lure: mouse sweeps retrieve it, sideways sweeps swing it.
        motionToTip.subVectors(rodTipWorld, restPosition);
        motionToTip.y = 0;
        const dist = motionToTip.length();
        if (dist <= REEL_ARRIVE_DISTANCE) {
          phase = 'hanging';
          twitchOffset.set(0, 0, 0);
          fightOffset.set(0, 0, 0);
          lureSway = 0;
          castArmed = false;
          return;
        }
        motionToTip.normalize();
        const retrieve = Math.min(MOTION_REEL_MAX, motionSpeed * MOTION_REEL_GAIN);
        restPosition.addScaledVector(motionToTip, retrieve * deltaSeconds);
        lureSway += frameDx * MOTION_SWAY_GAIN;

        wakeTimer += deltaSeconds;
        if (wakeTimer >= WAKE_INTERVAL) {
          wakeTimer = 0;
          if (onWake) onWake(restPosition);
        }
      } else if (lureKind === 'bait' && motionSpeed > MOTION_REEL_THRESHOLD) {
        // Bait just wiggles a little when you move the rod -- it's meant to sit.
        twitchOffset.x += (Math.random() - 0.5) * BAIT_WIGGLE_GAIN * deltaSeconds;
        twitchOffset.z += (Math.random() - 0.5) * BAIT_WIGGLE_GAIN * deltaSeconds;
      }

      lureSway *= Math.max(0, 1 - MOTION_SWAY_DECAY * deltaSeconds);
      motionToTip.subVectors(rodTipWorld, restPosition);
      motionToTip.y = 0;
      motionToTip.normalize();
      swayPerp.set(-motionToTip.z, 0, motionToTip.x);

      const decay = Math.max(0, 1 - TWITCH_DECAY_PER_SEC * deltaSeconds);
      twitchOffset.multiplyScalar(decay);
      bobber.position.copy(restPosition).add(twitchOffset).addScaledVector(swayPerp, lureSway);
      updateLineCurve(working ? 0.08 : 0.22);
    }

    if (phase === 'reeling' && !pressing) {
      phase = 'waiting';
      restPosition.copy(bobber.position);
    }

    if (phase === 'reeling') {
      const toTip = new THREE.Vector3().subVectors(rodTipWorld, bobber.position);
      toTip.y = 0;
      const dist = toTip.length();
      if (dist <= REEL_ARRIVE_DISTANCE) {
        // Settle into a dangling-at-the-rod-tip state rather than hiding the
        // line outright -- and crucially, don't let the mouse press that's
        // still held from reeling arm a new cast on its eventual release.
        phase = 'hanging';
        twitchOffset.set(0, 0, 0);
        fightOffset.set(0, 0, 0);
        castArmed = false;
        return;
      }
      toTip.normalize();
      bobber.position.addScaledVector(toTip, REEL_SPEED * deltaSeconds);
      bobber.position.y = 0.02 + Math.sin(performance.now() * 0.02) * 0.01;

      wakeTimer += deltaSeconds;
      if (wakeTimer >= WAKE_INTERVAL) {
        wakeTimer = 0;
        if (onWake) onWake(bobber.position);
      }

      restPosition.copy(bobber.position);
      updateLineCurve(0.05); // taut while actively reeled
    }

    if (phase === 'hanging') {
      bobber.position.copy(rodTipWorld).add(hangOffset);
      updateLineCurve(0.02);
    }

    if (phase === 'biting') {
      fightTimer += deltaSeconds;
      const speedFreq = { fast: 7, medium: 4, slow: 2 }[fightProfile.speed] || 4;
      const styleAmp = { aggressive: 0.4, heavy: 0.22, steady: 0.14, nibble: 0.08 }[fightProfile.style] || 0.16;
      const jitter = fightProfile.style === 'aggressive' ? 0.5 : fightProfile.style === 'nibble' ? 0.3 : 0.08;

      fightOffset.x = Math.sin(fightTimer * speedFreq) * styleAmp + (Math.random() - 0.5) * jitter * 0.15;
      fightOffset.z = Math.cos(fightTimer * speedFreq * 0.75) * styleAmp * 0.7;
      fightOffset.y = Math.max(0, Math.sin(fightTimer * speedFreq * 1.3)) * styleAmp * 0.5;

      bobber.position.copy(restPosition).add(fightOffset);
      updateLineCurve(0.03); // taut -- there's a fish pulling
    }
  }

  function updateAimFromPointer(clientX, clientY) {
    if (!waterMesh) return;
    const rect = domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(waterMesh)[0];
    if (hit) aimPoint.copy(hit.point);
  }

  let fightHoldCallback = null;
  let fightHolding = false;

  // Hold-click reels a hooked fish too -- same gesture as reeling in the line.
  function onFightHold(callback) {
    fightHoldCallback = callback;
  }

  domElement.addEventListener('mousedown', (e) => {
    if (phase === 'idle' || phase === 'hanging') {
      updateAimFromPointer(e.clientX, e.clientY);
      phase = 'aiming';
      power = 0;
      pressing = true;
      castArmed = true;
    } else if (phase === 'waiting') {
      pressing = true;
      pressTimer = 0;
      castArmed = false;
    } else if (phase === 'biting') {
      fightHolding = true;
      castArmed = false;
      if (fightHoldCallback) fightHoldCallback(true);
    } else {
      castArmed = false;
    }
  });
  window.addEventListener('mousemove', (e) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      moveDxAcc += e.movementX / rect.width;
      moveDyAcc += e.movementY / rect.width;
    }
    // The cursor is the aim: keep the landing point tracking it whenever a
    // cast is possible, not only once the button is down.
    if (phase === 'aiming' || phase === 'idle' || phase === 'hanging') updateAimFromPointer(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (phase === 'aiming' && castArmed) {
      // The longer this was held, the further it casts (power meter), and
      // a sharp upward flick on release adds a bit on top.
      // Only a press that actually started idle/hanging arms a cast -- a
      // press that was mid-reel never does, even if it's still held down
      // when the reel-in finishes and drops into 'hanging'.
      power = Math.min(1, power + Math.min(FLICK_POWER_MAX, flickUp * FLICK_POWER_GAIN));
      releaseCastAt(aimPoint);
    } else if (phase === 'waiting' && pressing && pressTimer <= REEL_HOLD_THRESHOLD) {
      tapRod();
    }
    if (fightHolding) {
      fightHolding = false;
      if (fightHoldCallback) fightHoldCallback(false);
    }
    castArmed = false;
    pressing = false;
  });

  function isBobberInWater() {
    return bobber.visible && isPointInWater(bobber.position);
  }

  function getState() {
    return { phase, power, motionSpeed, working: phase === 'waiting' && getLureKind() === 'lure' && motionSpeed > MOTION_REEL_THRESHOLD };
  }

  // Cursor position (NDC, -1..1) so the rod in hand can follow the mouse.
  function getMouseOffset() {
    return { x: mouseNDC.x, y: mouseNDC.y };
  }

  return {
    update, getState, onBite, triggerBite,
    resetToIdle, onTwitch, tapRod, bobberPosition: bobber.position,
    updateAimFromPointer, aimPoint, onFightHold, isBobberInWater, getMouseOffset,
    getPredictedLanding: (out) => computeLanding(aimPoint, phase === 'aiming' ? power : 0, out || new THREE.Vector3()),
  };
}
