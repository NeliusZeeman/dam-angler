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
    <span class="hud-hint">A/D or ←→ to walk · click to cast · click to twitch · hold click to reel in · Space to fight a bite · B tackle box · C log</span>
  `;
  container.appendChild(bar);

  const tensionWrap = document.createElement('div');
  tensionWrap.className = 'hud-tension-wrap';
  tensionWrap.innerHTML = `<div id="hud-tension-bar" class="hud-tension-bar"></div>`;
  container.appendChild(tensionWrap);

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

  function update({ credits, season, timeOfDay, waterTempC, windSpeed, rodName, lineName, hookName, lureName, castingPhase, tension }) {
    document.getElementById('hud-credits').textContent = `Credits: ${credits}`;
    document.getElementById('hud-season').textContent = `${season} — ${waterTempC.toFixed(1)}°C`;
    const timeEl = document.getElementById('hud-time');
    timeEl.textContent = TIME_LABELS[timeOfDay] || timeOfDay;
    timeEl.dataset.time = timeOfDay;
    document.getElementById('hud-wind').textContent = `Wind: ${windSpeed.toFixed(1)}`;
    document.getElementById('hud-gear').textContent = `${rodName} | ${lineName} | ${hookName} | ${lureName}`;
    document.getElementById('hud-status').textContent = castingPhase;
    tensionWrap.style.display = (castingPhase === 'biting') ? 'block' : 'none';
    if (tension != null) {
      document.getElementById('hud-tension-bar').style.width = `${Math.min(100, tension * 100)}%`;
    }
  }

  return { update, showToast };
}

export function renderCatchLog(container, catchLog) {
  const rows = FISH_SPECIES.map((species) => {
    const entry = catchLog[species.id] || { count: 0, bestWeightKg: 0 };
    return `<div class="shop-row"><span>${species.name}</span><span>${entry.count} caught, best ${entry.bestWeightKg.toFixed(2)}kg</span></div>`;
  }).join('');
  container.innerHTML = `<button class="panel-close" data-close="log">Close</button><h3>Catch Log</h3>${rows}`;
}
