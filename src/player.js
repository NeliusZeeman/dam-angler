import * as THREE from '../vendor/three.module.js';
import { POND_CENTER, WALK_RADIUS, DOCK_ANGLE } from './pond.js';

const MOVE_SPEED = 0.5; // radians/sec walked around the ring
const MAX_LOOK_YAW = Math.PI / 2.6;
const LOOK_DRAG_SENSITIVITY = 0.0032;

export function createPlayerController({ camera, domElement }) {
  let theta = DOCK_ANGLE;
  let lookYaw = 0;
  let dragging = false;
  let lastX = 0;
  const pressed = new Set();
  const lookAtTarget = new THREE.Vector3();

  domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    lookYaw = Math.min(MAX_LOOK_YAW, Math.max(-MAX_LOOK_YAW, lookYaw - dx * LOOK_DRAG_SENSITIVITY));
  });

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
      pressed.add(e.code);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
  });

  function update(deltaSeconds) {
    if (pressed.has('ArrowLeft') || pressed.has('KeyA')) theta -= MOVE_SPEED * deltaSeconds;
    if (pressed.has('ArrowRight') || pressed.has('KeyD')) theta += MOVE_SPEED * deltaSeconds;

    const x = POND_CENTER.x + Math.cos(theta) * WALK_RADIUS;
    const z = POND_CENTER.z + Math.sin(theta) * WALK_RADIUS;
    camera.position.set(x, 1.6, z);

    lookAtTarget.set(POND_CENTER.x, 0.6, POND_CENTER.z);
    camera.lookAt(lookAtTarget);
    camera.rotateY(lookYaw);
  }

  function isWalking() {
    return pressed.has('ArrowLeft') || pressed.has('ArrowRight') || pressed.has('KeyA') || pressed.has('KeyD');
  }

  return { update, isWalking, getTheta: () => theta };
}
