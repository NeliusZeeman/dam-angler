// Phones and tablets: a thumb-stick on the left to walk, drag anywhere on
// the view to look around (the screen centre is the aim, like mouse-look),
// and one big rod button on the right that does what the mouse button does:
// hold to charge a cast and release to throw, tap to twitch, hold to reel
// and to fight a fish.

// Touch is the main input (phones, tablets) -- not a laptop that happens to
// have a touchscreen next to its mouse. ?touch=1 forces it on for testing.
export function isTouchDevice() {
  if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
  const mq = (q) => window.matchMedia?.(q).matches ?? false;
  return mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'));
}

// Phones and small tablets get the light graphics settings by default.
export function isSmallOrMobileScreen() {
  const small = Math.min(window.screen?.width || 9999, window.screen?.height || 9999) < 820;
  return isTouchDevice() && (small || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));
}

const STICK_RADIUS = 52; // px the knob can travel from the centre

export function createTouchControls({ container, domElement, player, casting }) {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.innerHTML = `
    <div class="touch-stick" aria-hidden="true"><div class="touch-stick-knob"></div></div>
    <button class="touch-rod" type="button" aria-label="Cast or reel">
      <span class="touch-rod-main">Cast</span><span class="touch-rod-sub">hold, then release</span>
    </button>`;
  container.appendChild(root);
  const stickEl = root.querySelector('.touch-stick');
  const knob = root.querySelector('.touch-stick-knob');
  const rodBtn = root.querySelector('.touch-rod');
  const rodMain = root.querySelector('.touch-rod-main');
  const rodSub = root.querySelector('.touch-rod-sub');

  // --- Thumb-stick ---------------------------------------------------------
  let stickId = null, cx = 0, cy = 0;
  function setKnob(dx, dy) {
    const len = Math.hypot(dx, dy);
    const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    player.setStick(dx / STICK_RADIUS, -dy / STICK_RADIUS);
  }
  stickEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    try { stickEl.setPointerCapture(e.pointerId); } catch { /* keeps working without capture */ }
    const r = stickEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    setKnob(e.clientX - cx, e.clientY - cy);
  });
  stickEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) setKnob(e.clientX - cx, e.clientY - cy);
  });
  const stickEnd = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    setKnob(0, 0);
  };
  stickEl.addEventListener('pointerup', stickEnd);
  stickEl.addEventListener('pointercancel', stickEnd);

  // --- Rod button ----------------------------------------------------------
  let rodId = null;
  let rodEnabled = true;
  rodBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!rodEnabled) return;
    rodId = e.pointerId;
    try { rodBtn.setPointerCapture(e.pointerId); } catch { /* keeps working without capture */ }
    rodBtn.classList.add('pressed');
    casting.pressStart();
    navigator.vibrate?.(8);
  });
  const rodEnd = (e) => {
    if (e.pointerId !== rodId) return;
    rodId = null;
    rodBtn.classList.remove('pressed');
    casting.pressEnd();
  };
  rodBtn.addEventListener('pointerup', rodEnd);
  rodBtn.addEventListener('pointercancel', rodEnd);
  rodBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Look: drag on the view itself --------------------------------------
  const looks = new Map(); // pointerId -> last position
  domElement.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    // Stops the browser also firing mouse events, which would start a cast.
    e.preventDefault();
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  window.addEventListener('pointermove', (e) => {
    const last = looks.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last.x = e.clientX; last.y = e.clientY;
    player.look(dx, dy);
    casting.addMotion(dx, dy); // sweeping the view works a lure, like the mouse
  });
  const lookEnd = (e) => looks.delete(e.pointerId);
  window.addEventListener('pointerup', lookEnd);
  window.addEventListener('pointercancel', lookEnd);

  // The rod button says what it will do right now.
  const LABELS = {
    idle: ['Cast', 'hold, then release'],
    hanging: ['Cast', 'hold, then release'],
    aiming: ['Release', 'to cast'],
    inAir: ['…', ''],
    waiting: ['Reel', 'tap: twitch · hold: reel'],
    reeling: ['Reel', 'keep holding'],
    biting: ['Fight!', 'hold to reel, ease off in the red'],
  };
  let lastPhase = null;
  function update() {
    if (!rodEnabled) return;
    const phase = casting.getState().phase;
    if (phase === lastPhase) return;
    lastPhase = phase;
    const [main, sub] = LABELS[phase] || LABELS.idle;
    rodMain.textContent = main;
    rodSub.textContent = sub;
    rodBtn.dataset.phase = phase;
  }

  function setVisible(v) { root.classList.toggle('hidden', !v); }

  // Off while a catch card is up: lets go of any hold, ignores taps, and
  // says why. Back on when the card closes.
  function setRodEnabled(on) {
    rodEnabled = on;
    rodBtn.disabled = !on;
    rodBtn.classList.toggle('off', !on);
    if (!on) {
      if (rodId !== null) { rodId = null; rodBtn.classList.remove('pressed'); casting.pressEnd(); }
      rodMain.textContent = 'Landed!';
      rodSub.textContent = 'read your catch';
    } else {
      lastPhase = null; // relabel on the next update
    }
  }

  return { update, setVisible, setRodEnabled };
}
