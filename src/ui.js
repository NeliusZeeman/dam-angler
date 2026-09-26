import { FISH_SPECIES } from './fish.js';
import { windFromLabel } from './weather.js';
import { assetTag } from './versionCheck.js';

export function createHUD(container, { showHints = true, touch = false } = {}) {
  // Touch screens use the on-screen rod button instead of the mouse.
  const press = touch ? 'the rod button' : 'click';
  const tap = touch ? 'hold the rod button' : 'click';
  const bar = document.createElement('div');
  bar.className = 'hud-bar';
  bar.innerHTML = `
    <span id="hud-credits"></span>
    <span id="hud-season"></span>
    <span id="hud-time"></span>
    <span id="hud-wind"></span>
    <span id="hud-gear"></span>
    <span id="hud-status"></span>
    ${showHints ? '<span class="hud-hint">Mouse: look &amp; aim · WASD walk (Shift run) · hold click for power, release to cast · click: twitch · hold click: reel/fight · Esc: menu</span>' : ''}
  `;
  container.appendChild(bar);

  const tensionWrap = document.createElement('div');
  tensionWrap.className = 'hud-tension-wrap';
  tensionWrap.innerHTML = `<div id="hud-tension-bar" class="hud-tension-bar"></div>`;
  container.appendChild(tensionWrap);

  const powerWrap = document.createElement('div');
  powerWrap.className = 'hud-power-wrap';
  powerWrap.innerHTML = `<div class="hud-power-label">Cast power</div><div class="hud-power-track"><div id="hud-power-bar"></div></div>`;
  container.appendChild(powerWrap);

  // Distance counter, bottom centre: where the cast will land, how far it
  // went, how far out the line is, and -- in a fight -- how far the fish is
  // and whether it's taking line or coming in.
  const distEl = document.createElement('div');
  distEl.className = 'hud-distance hidden';
  distEl.innerHTML = '<span class="hud-distance-label"></span><span class="hud-distance-value"></span><span class="hud-distance-trend"></span>';
  container.appendChild(distEl);
  function setDistance(label, meters, { trend = '', highlight = false } = {}) {
    if (label == null || meters == null || !Number.isFinite(meters)) {
      distEl.classList.add('hidden');
      return;
    }
    distEl.classList.remove('hidden');
    distEl.classList.toggle('highlight', highlight);
    distEl.dataset.trend = trend;
    distEl.querySelector('.hud-distance-label').textContent = label;
    distEl.querySelector('.hud-distance-value').textContent = `${meters.toFixed(1)} m`;
    distEl.querySelector('.hud-distance-trend').textContent = trend === 'out' ? 'taking line' : trend === 'in' ? 'coming in' : '';
  }

  const toast = document.createElement('div');
  toast.className = 'hud-toast hidden';
  container.appendChild(toast);
  let toastTimer = null;

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  const TIME_LABELS = {
    morning: 'Morning', midMorning: 'Mid-Morning', midday: 'Midday', afternoon: 'Afternoon',
    sunset: 'Sunset', lateTwilight: 'Late Twilight', night: 'Night',
  };

  const STATUS_LABELS = {
    idle: 'Ready to cast',
    aiming: 'Winding up…',
    inAir: 'Casting',
    waiting: 'Line in the water',
    working: 'Working the lure',
    onBank: `Lure on the sand — hold ${press} to reel it in`,
    reeling: 'Reeling in',
    hanging: `Line hanging — ${tap} to cast`,
    biting: `FISH ON! Hold ${press} to reel`,
  };

  function update({ credits, season, timeOfDay, waterTempC, windSpeed, windDirX = 1, windDirZ = 0, rodName, lineName, reelName, hookName, lureName, castingPhase, tension, power, working = false, lureInWater = true }) {
    if (working && castingPhase === 'waiting') castingPhase = 'working';
    else if (castingPhase === 'waiting' && !lureInWater) castingPhase = 'onBank';
    document.getElementById('hud-credits').textContent = `Credits: ${credits}`;
    document.getElementById('hud-season').textContent = `${season} — ${waterTempC.toFixed(1)}°C`;
    const timeEl = document.getElementById('hud-time');
    timeEl.textContent = TIME_LABELS[timeOfDay] || timeOfDay;
    timeEl.dataset.time = timeOfDay;
    document.getElementById('hud-wind').textContent = windSpeed < 0.4 ? 'Wind: calm' : `Wind: ${Math.round(windSpeed * 3)} km/h ${windFromLabel(windDirX, windDirZ)}`;
    document.getElementById('hud-gear').textContent = `${rodName} | ${reelName || ''} | ${lineName} | ${hookName} | ${lureName}`;
    const statusEl = document.getElementById('hud-status');
    statusEl.textContent = STATUS_LABELS[castingPhase] || castingPhase;
    statusEl.dataset.phase = castingPhase;
    tensionWrap.style.display = (castingPhase === 'biting') ? 'block' : 'none';
    if (tension != null) {
      document.getElementById('hud-tension-bar').style.width = `${Math.min(100, tension * 100)}%`;
      tensionWrap.dataset.danger = tension > 0.72 ? 'true' : 'false';
    }
    powerWrap.style.display = (castingPhase === 'aiming') ? 'block' : 'none';
    if (power != null) {
      document.getElementById('hud-power-bar').style.width = `${Math.min(100, power * 100)}%`;
    }
  }

  return { update, showToast, setDistance };
}

export function renderCatchLog(container, catchLog, { species = FISH_SPECIES, locationName = null } = {}) {
  const rows = species.map((sp) => {
    const entry = catchLog[sp.id] || { count: 0, bestWeightKg: 0 };
    return `<div class="shop-row"><span>${sp.name}</span><span>${entry.count} caught, best ${entry.bestWeightKg.toFixed(2)}kg</span></div>`;
  }).join('');
  const title = locationName ? `Catch Log — ${locationName}` : 'Catch Log';
  container.innerHTML = `<button class="panel-close" data-close="log">Close</button><h3>${title}</h3>${rows}`;
}

const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// The "fish landed" card: the species photo from assets/fish/<id>.png, plus
// weight, length, value and how it compares with your best. Closes with the
// button, Enter, Space or Esc; returns the close function.
let closeActiveCatchCard = null;

// `lockMs`: the close button (and keys) stay inactive this long so a finger
// or key still held from the fight can't dismiss the card unread.
export function showCatchCard(container, { species, weightKg, lengthCm, payout, previousBestKg, count, locationName, timeLabel, lockMs = 0, onClose = null }) {
  closeActiveCatchCard?.();
  const firstEver = count === 1;
  const personalBest = !firstEver && weightKg > previousBestKg;
  const badge = firstEver ? 'First one!' : personalBest ? 'New personal best!' : '';

  const wrap = document.createElement('div');
  wrap.className = 'catch-card-wrap';
  wrap.innerHTML = `
    <div class="catch-card" role="dialog" aria-label="${species.name} landed">
      <div class="catch-photo">
        <img alt="${species.name}" decoding="async" src="assets/fish/${species.id}.webp${assetTag()}">
        <div class="catch-photo-missing">
          <strong>${species.name}</strong>
          <small>Add a picture as assets/fish/${species.id}.png</small>
        </div>
        ${badge ? `<span class="catch-badge">${badge}</span>` : ''}
      </div>
      <div class="catch-body">
        <p class="catch-kicker">Landed · <span class="catch-rarity" data-rarity="${species.rarity}">${RARITY_LABEL[species.rarity] || species.rarity}</span></p>
        <h2 class="catch-name">${species.name}</h2>
        <dl class="catch-stats">
          <div><dt>Weight</dt><dd>${weightKg.toFixed(2)} kg</dd></div>
          <div><dt>Length</dt><dd>${Math.round(lengthCm)} cm</dd></div>
          <div><dt>Value</dt><dd>+${payout} cr</dd></div>
          <div><dt>Your best</dt><dd>${Math.max(weightKg, previousBestKg).toFixed(2)} kg</dd></div>
        </dl>
        <p class="catch-where">Your ${ordinal(count)} ${species.name} · ${locationName}${timeLabel ? ` · ${timeLabel}` : ''}</p>
        <button class="catch-close" type="button"><span class="catch-close-fill"></span><span class="catch-close-label">Keep fishing</span></button>
      </div>
    </div>`;
  container.appendChild(wrap);

  // Small optimised WebP first (see tools/optimize-fish-images.mjs), then
  // the original PNG, then the name-only placeholder.
  const img = wrap.querySelector('img');
  const markMissing = () => wrap.querySelector('.catch-photo').classList.add('missing');
  img.addEventListener('error', () => {
    if (img.src.includes('.webp')) img.src = `assets/fish/${species.id}.png${assetTag()}`;
    else markMissing();
  });

  // Clicks on the card mustn't start a cast behind it.
  wrap.addEventListener('mousedown', (e) => e.stopPropagation());
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

  const btn = wrap.querySelector('.catch-close');
  let locked = lockMs > 0;
  if (locked) {
    btn.classList.add('locked');
    btn.setAttribute('aria-disabled', 'true');
    btn.style.setProperty('--lock-ms', `${lockMs}ms`);
    setTimeout(() => {
      locked = false;
      btn.classList.remove('locked');
      btn.removeAttribute('aria-disabled');
    }, lockMs);
  }

  let closed = false;
  function onKey(e) {
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
      // Swallow them either way -- a held Space from reeling must not
      // reach the game or close the card while it's locked.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!locked && !e.repeat) close();
    }
  }
  function close() {
    if (closed) return;
    closed = true;
    if (closeActiveCatchCard === close) closeActiveCatchCard = null;
    window.removeEventListener('keydown', onKey, true);
    wrap.remove();
    if (onClose) onClose();
  }
  closeActiveCatchCard = close;
  window.addEventListener('keydown', onKey, true);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!locked) close();
  });
  return close;
}

// The "what's biting" hint bubble, top-right under the HUD. Stays up for a
// while, then fades; a new tip replaces the old one.
export function createTipBubble(container) {
  const el = document.createElement('div');
  el.className = 'tip-bubble hidden';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="tip-label"></span><p class="tip-text"></p>';
  container.appendChild(el);
  let timer = null;
  function show(tip, seconds = 14) {
    if (!tip) return;
    el.dataset.kind = tip.kind;
    el.querySelector('.tip-label').textContent = tip.kind === 'live' ? "What's biting" : 'Local knowledge';
    el.querySelector('.tip-text').textContent = tip.text;
    el.classList.remove('hidden');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.add('hidden'), seconds * 1000);
  }
  return { show };
}

// On-screen buttons for the things that used to be keyboard-only. Each still
// shows its shortcut key. Buttons drop focus straight after a click, so the
// space bar (reeling a fish in) can't re-trigger them.
export function createActionBar(container, actions) {
  const bar = document.createElement('div');
  bar.className = 'action-bar';
  const buttons = {};
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn';
    btn.innerHTML = `<span class="action-label">${action.label}</span><kbd>${action.key}</kbd>`;
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.blur();
      action.onClick();
    });
    bar.appendChild(btn);
    buttons[action.id] = btn;
  }
  container.appendChild(bar);

  function setLabel(id, label) {
    const el = buttons[id]?.querySelector('.action-label');
    if (el) el.textContent = label;
  }
  function setEnabled(id, enabled) {
    if (buttons[id]) buttons[id].disabled = !enabled;
  }
  return { setLabel, setEnabled };
}
