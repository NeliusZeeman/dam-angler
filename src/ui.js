import { FISH_SPECIES } from './fish.js';

export function createHUD(container) {
  const bar = document.createElement('div');
  bar.className = 'hud-bar';
  bar.innerHTML = `
    <span id="hud-credits"></span>
    <span id="hud-season"></span>
    <span id="hud-time"></span>
    <span id="hud-wind"></span>
    <span id="hud-gear"></span>
    <span id="hud-status"></span>
    <span class="hud-hint">A/D walk · hold click & flick up: cast · spinner: sweep the mouse to work it in · click: twitch · hold click: reel in / fight (ease off when red) · B tackle box · C log · L change spot</span>
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
    reeling: 'Reeling in',
    hanging: 'Line hanging — click to cast',
    biting: 'FISH ON! Hold click to reel',
  };

  function update({ credits, season, timeOfDay, waterTempC, windSpeed, rodName, lineName, hookName, lureName, castingPhase, tension, power, working = false }) {
    if (working && castingPhase === 'waiting') castingPhase = 'working';
    document.getElementById('hud-credits').textContent = `Credits: ${credits}`;
    document.getElementById('hud-season').textContent = `${season} — ${waterTempC.toFixed(1)}°C`;
    const timeEl = document.getElementById('hud-time');
    timeEl.textContent = TIME_LABELS[timeOfDay] || timeOfDay;
    timeEl.dataset.time = timeOfDay;
    document.getElementById('hud-wind').textContent = `Wind: ${windSpeed.toFixed(1)}`;
    document.getElementById('hud-gear').textContent = `${rodName} | ${lineName} | ${hookName} | ${lureName}`;
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

  return { update, showToast };
}

export function renderCatchLog(container, catchLog, { species = FISH_SPECIES, locationName = null } = {}) {
  const rows = species.map((sp) => {
    const entry = catchLog[sp.id] || { count: 0, bestWeightKg: 0 };
    return `<div class="shop-row"><span>${sp.name}</span><span>${entry.count} caught, best ${entry.bestWeightKg.toFixed(2)}kg</span></div>`;
  }).join('');
  const title = locationName ? `Catch Log — ${locationName}` : 'Catch Log';
  container.innerHTML = `<button class="panel-close" data-close="log">Close</button><h3>${title}</h3>${rows}`;
}
