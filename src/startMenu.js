import { LOCATIONS } from './locations.js';
import { FISH_SPECIES, activityAt } from './fish.js';
import { TIME_OF_DAY_PHASES } from './environment.js';
import { PROVINCES, spotTags } from './regions.js';

const TIME_LABELS = {
  morning: 'Morning', midMorning: 'Mid-Morning', midday: 'Midday', afternoon: 'Afternoon',
  sunset: 'Sunset', lateTwilight: 'Late Twilight', night: 'Night',
};
const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'dam', label: 'Dams', test: (l) => l.kind === 'dam' || l.kind === 'stillwater' },
  { id: 'river', label: 'Rivers & streams', test: (l) => l.kind === 'river' || l.kind === 'stream' },
  { id: 'fly', label: 'Fly fishing', test: (l) => l.fly },
];

const plural = (n, word) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
const speciesName = (id) => FISH_SPECIES.find((s) => s.id === id)?.name || id;

// The two times of day this water fishes best: each fish's feeding curve
// weighted by how much of the catch it makes up.
function bestTimes(loc) {
  const score = TIME_OF_DAY_PHASES.map((phase) => ({
    phase,
    v: loc.speciesIds.reduce((sum, id) => {
      const sp = FISH_SPECIES.find((s) => s.id === id);
      return sum + (loc.catchShare?.[id] ?? 1) * (sp ? activityAt(sp, phase) : 0);
    }, 0),
  }));
  return score.sort((a, b) => b.v - a.v).slice(0, 2).map((s) => TIME_LABELS[s.phase]);
}

function waterFeel(loc) {
  const t = loc.tempOffset ?? 0;
  if (t <= -6) return 'Cold mountain water';
  if (t <= -2) return 'Cool water';
  if (t >= 2) return 'Warm water';
  return 'Temperate water';
}

// New Game: province -> fishing spot -> time of day.
export function showStartMenu(container, onConfirm, { onBack = null, initialLocationId = null } = {}) {
  const initial = LOCATIONS.find((l) => l.id === initialLocationId);
  let provinceId = initial?.province || null;
  let selectedLocationId = initial?.id || null;
  let selectedTime = 'morning';
  let filter = 'all';

  const overlay = document.createElement('div');
  overlay.className = 'start-menu';

  function provinceHtml() {
    const cards = PROVINCES.map((p) => {
      const spots = LOCATIONS.filter((l) => l.province === p.id);
      const count = (f) => spots.filter(FILTERS.find((x) => x.id === f).test).length;
      return `
        <button class="start-loc-card province-card" data-province="${p.id}" type="button">
          <h3>${p.name}</h3>
          <div class="start-loc-region">${[plural(spots.length, 'spot'), plural(count('dam'), 'dam'), plural(count('river'), 'river'), count('fly') ? `${count('fly')} fly-fishing` : ''].filter(Boolean).join(' · ')}</div>
          <p>${p.blurb}</p>
          <div class="start-loc-species">${p.offers.join(' · ')}</div>
        </button>`;
    }).join('');
    return `
      ${onBack ? '<button class="start-back" data-back="menu" type="button">&larr; Main Menu</button>' : ''}
      <h1>Where in South Africa?</h1>
      <p class="start-sub">Nine provinces, ${LOCATIONS.length} real dams, rivers and fly-fishing waters — each with its own fish.</p>
      <div class="start-locations">${cards}</div>`;
  }

  function spotsHtml() {
    const province = PROVINCES.find((p) => p.id === provinceId);
    const spots = LOCATIONS.filter((l) => l.province === provinceId && FILTERS.find((f) => f.id === filter).test(l));
    const chips = FILTERS.map((f) => `<button type="button" class="start-time-btn filter-btn ${f.id === filter ? 'selected' : ''}" data-filter="${f.id}">${f.label}</button>`).join('');
    const cards = spots.map((loc) => {
      const fish = Object.entries(loc.catchShare || {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([id, pct]) => `${speciesName(id)} ${pct}%`).join(' · ');
      const tags = spotTags(loc).map((t) => `<span class="spot-tag${t === 'Fly fishing' ? ' fly' : ''}">${t}</span>`).join('');
      return `
        <button class="start-loc-card ${loc.id === selectedLocationId ? 'selected' : ''}" data-loc="${loc.id}" type="button">
          <div class="spot-tags">${tags}</div>
          <h3>${loc.name}</h3>
          <div class="start-loc-region">${loc.region}</div>
          <p>${loc.blurb}</p>
          <div class="spot-facts">Best: ${bestTimes(loc).join(' & ')} · ${waterFeel(loc)}</div>
          <div class="start-loc-species">${fish}</div>
        </button>`;
    }).join('') || '<p class="start-sub">No waters of that kind here — try another filter.</p>';
    const timeButtons = TIME_OF_DAY_PHASES.map((phase) => `
      <button class="start-time-btn ${phase === selectedTime ? 'selected' : ''}" data-time="${phase}" type="button">${TIME_LABELS[phase]}</button>`).join('');
    const chosen = LOCATIONS.find((l) => l.id === selectedLocationId && l.province === provinceId);
    return `
      <button class="start-back" data-back="provinces" type="button">&larr; All provinces</button>
      <h1>${province.name}</h1>
      <p class="start-sub">${province.blurb}</p>
      <div class="start-times start-filters">${chips}</div>
      <div class="start-locations">${cards}</div>
      <div class="start-footer">
        <h2>${chosen ? `${chosen.name} — what time is it?` : 'Pick a spot, then the time of day'}</h2>
        <div class="start-times">${timeButtons}</div>
        <button class="start-go" type="button" ${chosen ? '' : 'disabled'}>Start Fishing</button>
      </div>`;
  }

  function render() {
    overlay.innerHTML = `<div class="start-menu-inner">${provinceId ? spotsHtml() : provinceHtml()}</div>`;
    overlay.querySelectorAll('[data-province]').forEach((card) => card.addEventListener('click', () => {
      provinceId = card.dataset.province;
      filter = 'all';
      render();
      overlay.scrollTop = 0;
    }));
    overlay.querySelectorAll('[data-back]').forEach((btn) => btn.addEventListener('click', () => {
      if (btn.dataset.back === 'menu') { overlay.remove(); onBack(); return; }
      provinceId = null;
      render();
      overlay.scrollTop = 0;
    }));
    overlay.querySelectorAll('[data-filter]').forEach((btn) => btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      render();
    }));
    overlay.querySelectorAll('[data-loc]').forEach((card) => card.addEventListener('click', () => {
      selectedLocationId = card.dataset.loc;
      render();
    }));
    overlay.querySelectorAll('[data-time]').forEach((btn) => btn.addEventListener('click', () => {
      selectedTime = btn.dataset.time;
      render();
    }));
    overlay.querySelector('.start-go')?.addEventListener('click', () => {
      if (!selectedLocationId) return;
      overlay.remove();
      onConfirm({ locationId: selectedLocationId, timeOfDay: selectedTime });
    });
  }

  render();
  container.appendChild(overlay);
}
