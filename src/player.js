import * as THREE from '../vendor/three.module.js';
import { POND_CENTER, WALK_RADIUS, DOCK_ANGLE } from './pond.js';

const MOVE_SPEED = 0.5; // radians/sec walked around the ring
const MAX_LOOK_YAW = Math.PI / 3.4; // how far the view turns toward a cursor at the screen edge
const LOOK_SMOOTHING = 6; // higher = snappier follow

// The mouse is the aiming mechanism, so it must never need to be dragged:
// the view turns softly toward wherever the cursor is, and the cast lands
// where the cursor points on the water. Walking is A/D or arrows.
export function createPlayerController({ camera, domElement }) {
  let theta = DOCK_ANGLE;
  let lookYaw = 0;
  let targetYaw = 0;
  const pressed = new Set();
  const lookAtTarget = new THREE.Vector3();

  window.addEventListener('mousemove', (e) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    // Dead zone in the middle so small aiming adjustments don't swing the view.
    const dead = 0.15;
    const mag = Math.max(0, Math.abs(ndcX) - dead) / (1 - dead);
    targetYaw = -Math.sign(ndcX) * Math.min(1, mag) * MAX_LOOK_YAW;
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

    lookYaw += (targetYaw - lookYaw) * Math.min(1, deltaSeconds * LOOK_SMOOTHING);
    lookAtTarget.set(POND_CENTER.x, 0.6, POND_CENTER.z);
    camera.lookAt(lookAtTarget);
    camera.rotateY(lookYaw);
  }

  function isWalking() {
    return pressed.has('ArrowLeft') || pressed.has('ArrowRight') || pressed.has('KeyA') || pressed.has('KeyD');
  }

  return { update, isWalking, getTheta: () => theta };
}
