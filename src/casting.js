import * as THREE from '../vendor/three.module.js';

const TWITCH_COOLDOWN = 0.35;
const TWITCH_KICK_UP = 0.14;
const TWITCH_KICK_SIDE = 0.08;
const TWITCH_DECAY_PER_SEC = 7;

export function createCasting({ scene, camera, domElement, getRod, rodTip }) {
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

  let phase = 'idle';
  let power = 0;
  let holding = false;
  let airTime = 0;
  const AIR_DURATION = 1.2;
  const launchTarget = new THREE.Vector3();
  let biteCallback = null;
  let twitchCallback = null;
  let twitchCooldown = 0;

  function startAimHold() {
    if (phase !== 'idle') return;
    phase = 'aiming';
    power = 0;
  }

  function releaseCast() {
    if (phase !== 'aiming') return;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const rod = getRod();
    const distance = 4 + power * rod.castDistance;
    launchTarget.copy(camera.position).addScaledVector(forward, distance);
    launchTarget.y = 0;
    phase = 'inAir';
    airTime = 0;
    bobber.visible = true;
    line.visible = true;
  }

  function triggerBite() {
    if (phase !== 'waiting') return;
    phase = 'biting';
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
      }
    }

    if (phase === 'waiting' || phase === 'biting') {
      const decay = Math.max(0, 1 - TWITCH_DECAY_PER_SEC * deltaSeconds);
      twitchOffset.multiplyScalar(decay);
      bobber.position.copy(restPosition).add(twitchOffset);
      updateLine();
    }
  }

  domElement.addEventListener('mousedown', () => {
    if (phase === 'idle') { startAimHold(); holding = true; }
    else if (phase === 'waiting') { tapRod(); }
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
  };
}
