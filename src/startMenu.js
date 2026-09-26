import { LOCATIONS } from './locations.js';
import { FISH_SPECIES } from './fish.js';
import { TIME_OF_DAY_PHASES } from './environment.js';

const TIME_LABELS = {
  morning: 'Morning', midMorning: 'Mid-Morning', midday: 'Midday', afternoon: 'Afternoon',
  sunset: 'Sunset', lateTwilight: 'Late Twilight', night: 'Night',
};

export function showStartMenu(container, onConfirm, { onBack = null } = {}) {
  let selectedLocationId = LOCATIONS[0].id;
  let selectedTime = 'morning';

  const overlay = document.createElement('div');
  overlay.className = 'start-menu';

  function speciesNamesFor(loc) {
    return loc.speciesIds
      .map((id) => FISH_SPECIES.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  function render() {
    const locationCards = LOCATIONS.map((loc) => `
      <button class="start-loc-card ${loc.id === selectedLocationId ? 'selected' : ''}" data-loc="${loc.id}" type="button">
        <h3>${loc.name}</h3>
        <div class="start-loc-region">${loc.region}</div>
        <p>${loc.blurb}</p>
        <div class="start-loc-species">${speciesNamesFor(loc)}</div>
      </button>
    `).join('');

    const timeButtons = TIME_OF_DAY_PHASES.map((phase) => `
      <button class="start-time-btn ${phase === selectedTime ? 'selected' : ''}" data-time="${phase}" type="button">
        ${TIME_LABELS[phase]}
      </button>
    `).join('');

    overlay.innerHTML = `
      <div class="start-menu-inner">
        ${onBack ? '<button class="start-back" type="button">&larr; Main Menu</button>' : ''}
        <h1>Where do you want to fish?</h1>
        <p class="start-sub">Six real South African dams, each with a different mix of fish.</p>
        <div class="start-locations">${locationCards}</div>
        <h2>What time is it?</h2>
        <div class="start-times">${timeButtons}</div>
        <button class="start-go" type="button">Start Fishing</button>
      </div>
    `;

    overlay.querySelectorAll('.start-loc-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedLocationId = card.dataset.loc;
        render();
      });
    });
    overlay.querySelectorAll('.start-time-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTime = btn.dataset.time;
        render();
      });
    });
    overlay.querySelector('.start-back')?.addEventListener('click', () => {
      overlay.remove();
      onBack();
    });
    overlay.querySelector('.start-go').addEventListener('click', () => {
      overlay.remove();
      onConfirm({ locationId: selectedLocationId, timeOfDay: selectedTime });
    });
  }

  render();
  container.appendChild(overlay);
}
