const WALK_SPEED = 2.2; // m/s
const RUN_SPEED = 4.6;
const EYE_HEIGHT = 1.6;
const TURN_SPEED = 1.6; // rad/s with Q/E
const MOUSE_LOOK = 0.0022; // rad per pixel of mouse travel
const DRAG_LOOK = 0.0035; // rad per pixel of right-button drag (mouse not captured)
// Browsers occasionally report a bogus huge jump right as the pointer locks or
// the window regains focus; a real flick never moves this far in one event.
const MAX_MOUSE_STEP = 180;
const PITCH_MIN = -1.25, PITCH_MAX = 1.0;

// Free roaming on the bank, first-person style. Click the game to capture the
// mouse; from then on moving the mouse turns your head -- a full 360 degrees
// around and up/down -- and the screen centre is the aim. WASD / arrows walk
// (Shift runs) relative to where you're facing; Q/E also turn. You can walk
// anywhere on dry land and out along the stands, but not into the water.
// `turnSpeed` (from Settings) is the mouse sensitivity.
export function createPlayerController({ camera, domElement, dam, turnSpeed = 1 }) {
  let x = dam.spawn.x, z = dam.spawn.z;
  let yaw = dam.spawn.yaw, pitch = -0.1;
  let eyeY = dam.floorHeight(x, z) + EYE_HEIGHT;
  let bob = 0;
  let dragging = false;
  const pressed = new Set();

  // Pointer lock: the mouse is captured while you fish and released for menus.
  let locked = false;
  let releasing = false; // we let go on purpose (menu opened), not the Esc key
  let lockLostCallback = null;
  let lockChangeCallback = null;
  function lockPointer() {
    if (locked || !domElement.requestPointerLock) return;
    try {
      // Raw mouse movement where supported, without OS acceleration.
      const p = domElement.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => domElement.requestPointerLock()?.catch?.(() => {}));
    } catch { /* not allowed right now -- the next click tries again */ }
  }
  function releasePointer() {
    if (!locked) return;
    releasing = true;
    document.exitPointerLock();
  }
  document.addEventListener('pointerlockchange', () => {
    const was = locked;
    locked = document.pointerLockElement === domElement;
    if (was && !locked && !releasing && lockLostCallback) lockLostCallback();
    if (!locked) releasing = false;
    if (lockChangeCallback) lockChangeCallback(locked);
  });

  // A click on the game while the mouse is free only captures it -- it must
  // not also start a cast. Registered before the casting controls, so it can
  // swallow the event.
  domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !locked && domElement.requestPointerLock) {
      e.stopImmediatePropagation();
      lockPointer();
    }
  });

  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS.includes(e.code)) {
      pressed.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => pressed.delete(e.code));
  window.addEventListener('blur', () => pressed.clear());

  domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  domElement.addEventListener('mousedown', (e) => { if (e.button === 2) dragging = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) dragging = false; });
  function look(dx, dy, perPixel) {
    if (Math.abs(dx) > MAX_MOUSE_STEP || Math.abs(dy) > MAX_MOUSE_STEP) return;
    yaw = (yaw - dx * perPixel * turnSpeed) % (Math.PI * 2);
    pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch - dy * perPixel * turnSpeed));
  }
  window.addEventListener('mousemove', (e) => {
    const perPixel = locked ? MOUSE_LOOK : dragging ? DRAG_LOOK : 0;
    if (perPixel) look(e.movementX, e.movementY, perPixel);
  });

  // Touch: a finger dragged over the view turns your head; the on-screen
  // stick walks (x = strafe, y = forward, each -1..1).
  const stick = { x: 0, y: 0 };

  const has = (...codes) => codes.some((c) => pressed.has(c));

  function tryMove(nx, nz) {
    if (dam.isWalkable(nx, nz)) { x = nx; z = nz; return true; }
    // Slide along the water's edge / stand rail instead of stopping dead.
    if (dam.isWalkable(nx, z)) { x = nx; return true; }
    if (dam.isWalkable(x, nz)) { z = nz; return true; }
    return false;
  }

  function update(dt) {
    if (has('KeyQ')) yaw += TURN_SPEED * turnSpeed * dt;
    if (has('KeyE')) yaw -= TURN_SPEED * turnSpeed * dt;

    let fwd = 0, side = 0;
    if (has('KeyW', 'ArrowUp')) fwd += 1;
    if (has('KeyS', 'ArrowDown')) fwd -= 1;
    if (has('KeyD', 'ArrowRight')) side += 1;
    if (has('KeyA', 'ArrowLeft')) side -= 1;
    // The touch stick walks at the speed it's pushed, and runs near the rim.
    const stickPush = Math.min(1, Math.hypot(stick.x, stick.y));
    if (stickPush > 0.12) { fwd += stick.y; side += stick.x; }
    const moving = fwd !== 0 || side !== 0;
    if (moving) {
      const keySpeed = has('ShiftLeft', 'ShiftRight') ? RUN_SPEED : WALK_SPEED;
      const topSpeed = stickPush > 0.12 ? (stickPush > 0.92 ? RUN_SPEED : WALK_SPEED * stickPush / 0.92) : keySpeed;
      const speed = topSpeed / Math.hypot(fwd, side);
      // Facing direction for this yaw is (-sin, -cos); right is (cos, -sin).
      const dx = (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * speed * dt;
      const dz = (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * speed * dt;
      if (tryMove(x + dx, z + dz)) bob += dt * (speed > WALK_SPEED ? 11 : 8);
    }

    // Step up onto a deck or over a bump smoothly rather than snapping.
    const targetY = dam.floorHeight(x, z) + EYE_HEIGHT;
    eyeY += (targetY - eyeY) * Math.min(1, dt * 10);
    const bobY = moving ? Math.sin(bob) * 0.03 : 0;
    camera.position.set(x, eyeY + bobY, z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  return {
    update,
    isWalking: () => has('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
      || Math.hypot(stick.x, stick.y) > 0.12,
    getPosition: () => ({ x, z }),
    lockPointer,
    releasePointer,
    // Touch look: pixels dragged; perPixel defaults to the mouse feel.
    look: (dx, dy, perPixel = MOUSE_LOOK * 1.6) => look(dx, dy, perPixel),
    setStick: (x, y) => { stick.x = x; stick.y = y; },
    isLocked: () => locked,
    // Fires when the browser takes the mouse back (the Esc key), not when
    // we release it ourselves for a menu.
    onLockLost: (cb) => { lockLostCallback = cb; },
    onLockChange: (cb) => { lockChangeCallback = cb; },
  };
}
