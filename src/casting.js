import * as THREE from '../vendor/three.module.js';

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

export function createCasting({ scene, camera, domElement, getRod, rodTip, waterMesh, onSplash, onWake }) {
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

  function releaseCastAt(aim) {
    if (phase !== 'aiming') return;
    const rod = getRod();
    const maxReach = BASE_CAST_REACH + power * rod.castDistance;
    const toAim = new THREE.Vector3().subVectors(aim, camera.position);
    toAim.y = 0;
    const aimDistance = toAim.length();
    const clampedDistance = Math.min(aimDistance, maxReach);
    toAim.normalize();

    launchTarget.copy(camera.position).addScaledVector(toAim, clampedDistance);
    launchTarget.y = 0;
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
      const decay = Math.max(0, 1 - TWITCH_DECAY_PER_SEC * deltaSeconds);
      twitchOffset.multiplyScalar(decay);
      bobber.position.copy(restPosition).add(twitchOffset);
      updateLineCurve(0.22);
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
    } else {
      castArmed = false;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (phase === 'aiming') updateAimFromPointer(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (phase === 'aiming' && castArmed) {
      // The longer this was held, the further it casts (power meter).
      // Only a press that actually started idle/hanging arms a cast -- a
      // press that was mid-reel never does, even if it's still held down
      // when the reel-in finishes and drops into 'hanging'.
      releaseCastAt(aimPoint);
    } else if (phase === 'waiting' && pressing && pressTimer <= REEL_HOLD_THRESHOLD) {
      tapRod();
    }
    castArmed = false;
    pressing = false;
  });

  function getState() {
    return { phase, power };
  }

  return {
    update, getState, onBite, triggerBite,
    resetToIdle, onTwitch, tapRod, bobberPosition: bobber.position,
    updateAimFromPointer, aimPoint,
  };
}
