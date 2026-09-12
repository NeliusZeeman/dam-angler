import * as THREE from '../vendor/three.module.js';

const TWITCH_COOLDOWN = 0.35;
const TWITCH_KICK_UP = 0.14;
const TWITCH_KICK_SIDE = 0.08;
const TWITCH_DECAY_PER_SEC = 7;

export function createCasting({ scene, camera, domElement, getRod, rodTip, waterMesh, onSplash }) {
  const bobberGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const bobberMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
  const bobber = new THREE.Mesh(bobberGeo, bobberMat);
  bobber.visible = false;
  scene.add(bobber);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
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

  let phase = 'idle';
  let power = 0;
  let holding = false;
  let airTime = 0;
  const AIR_DURATION = 1.2;
  const launchTarget = new THREE.Vector3();
  let biteCallback = null;
  let twitchCallback = null;
  let twitchCooldown = 0;
  let fightProfile = null;
  let fightTimer = 0;

  function startAimHold() {
    if (phase !== 'idle') return;
    phase = 'aiming';
    power = 0;
  }

  function releaseCast() {
    if (phase !== 'aiming') return;
    const rod = getRod();
    const maxDistance = 4 + power * rod.castDistance;

    const toAim = new THREE.Vector3().subVectors(aimPoint, camera.position);
    toAim.y = 0;
    const aimDistance = toAim.length();
    const clampedDistance = Math.min(aimDistance, maxDistance);
    toAim.normalize();

    launchTarget.copy(camera.position).addScaledVector(toAim, clampedDistance);
    launchTarget.y = 0;
    phase = 'inAir';
    airTime = 0;
    bobber.visible = true;
    line.visible = true;
  }

  function triggerBite(bite) {
    if (phase !== 'waiting') return;
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
    power = 0;
    bobber.visible = false;
    line.visible = false;
    twitchOffset.set(0, 0, 0);
    fightOffset.set(0, 0, 0);
    fightProfile = null;
  }

  function updateLine() {
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, rodTipWorld.x, rodTipWorld.y, rodTipWorld.z);
    positions.setXYZ(1, bobber.position.x, bobber.position.y, bobber.position.z);
    positions.needsUpdate = true;
  }

  function update(deltaSeconds, windState) {
    rodTip.getWorldPosition(rodTipWorld);

    if (phase === 'aiming' && holding) {
      power = Math.min(1, power + deltaSeconds * 0.6);
    }

    if (twitchCooldown > 0) {
      twitchCooldown = Math.max(0, twitchCooldown - deltaSeconds);
    }

    if (phase === 'inAir') {
      airTime += deltaSeconds;
      const t = Math.min(1, airTime / AIR_DURATION);
      target.copy(rodTipWorld).lerp(launchTarget, t);
      target.x += windState.windDirX * windState.windSpeed * 0.02 * t;
      target.z += windState.windDirZ * windState.windSpeed * 0.02 * t;
      target.y = Math.sin(t * Math.PI) * 1.5;
      bobber.position.copy(target);
      updateLine();
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
      updateLine();
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
      updateLine();
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
    if (phase === 'idle') {
      updateAimFromPointer(e.clientX, e.clientY);
      startAimHold();
      holding = true;
    } else if (phase === 'waiting') {
      tapRod();
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (phase === 'aiming') updateAimFromPointer(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (phase === 'aiming') { releaseCast(); }
    holding = false;
  });

  function getState() {
    return { phase, power };
  }

  return {
    update, getState, startAimHold, releaseCast, onBite, triggerBite,
    resetToIdle, onTwitch, tapRod, bobberPosition: bobber.position,
    updateAimFromPointer, aimPoint,
  };
}
