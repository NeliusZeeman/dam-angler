import { getLocationById } from './locations.js';
import { FISH_SPECIES } from './fish.js';
import { saveSave } from './save.js';
import { createTackleBox } from './tackleBox.js';
import { renderCatchLog } from './ui.js';

const TIME_LABELS = {
  morning: 'Morning', midMorning: 'Mid-Morning', midday: 'Midday', afternoon: 'Afternoon',
  sunset: 'Sunset', lateTwilight: 'Late Twilight', night: 'Night',
};

const SETTINGS = [
  {
    key: 'quality', label: 'Graphics',
    hint: 'Auto picks Low on phones and small tablets. Low is smoother on older graphics.',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'high', label: 'High' }, { value: 'low', label: 'Low' }],
  },
  {
    key: 'showHints', label: 'Control hints',
    hint: 'The controls reminder along the top of the screen.',
    options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }],
  },
  {
    key: 'turnSpeed', label: 'Mouse sensitivity',
    hint: 'How fast the view turns when you move the mouse (and Q/E).',
    options: [{ value: 0.6, label: 'Slow' }, { value: 1, label: 'Normal' }, { value: 1.5, label: 'Fast' }],
  },
];

// The title screen shown every time the game opens. Continue picks up the
// last dam and time; New Game goes to the dam/time picker; the tackle box,
// catch log and settings all work from here without starting a session.
export function showMainMenu(container, { save, onContinue, onNewGame }) {
  const overlay = document.createElement('div');
  overlay.className = 'main-menu';
  container.appendChild(overlay);
  let view = 'home';

  const tackleBox = createTackleBox({ container: overlay, save, onSaveChanged: () => {
    saveSave(save);
    if (view === 'home') render(); // credits on the title card
  } });
  const logPanel = document.createElement('div');
  logPanel.className = 'shop-panel hidden';
  overlay.appendChild(logPanel);

  const close = () => overlay.remove();

  function totalCaught() {
    return Object.values(save.catchLog || {}).reduce((n, e) => n + (e.count || 0), 0);
  }

  function homeHtml() {
    const hasGame = !!save.locationId;
    const loc = hasGame ? getLocationById(save.locationId) : null;
    const where = loc ? `${loc.name} · ${TIME_LABELS[save.startTimeOfDay] || 'Morning'}` : '';
    return `
      <div class="mm-card">
        <p class="mm-kicker">South African freshwater angling</p>
        <h1 class="mm-title">Dam Angler</h1>
        <p class="mm-stats"><span>${save.credits} credits</span><span>${totalCaught()} fish landed</span></p>
        <nav class="mm-buttons">
          ${hasGame ? `<button class="mm-btn mm-primary" data-go="continue" type="button">Continue<small>${where}</small></button>` : ''}
          <button class="mm-btn ${hasGame ? '' : 'mm-primary'}" data-go="new" type="button">New Game<small>Choose a dam and a time of day</small></button>
          <button class="mm-btn" data-go="tackle" type="button">Tackle Box<small>Rods, reels, line, rigs and bait</small></button>
          <button class="mm-btn" data-go="log" type="button">Catch Log<small>Every species you've landed</small></button>
          <button class="mm-btn" data-go="settings" type="button">Settings<small>Graphics and controls</small></button>
        </nav>
      </div>`;
  }

  function settingsHtml() {
    const rows = SETTINGS.map((s) => `
      <div class="mm-setting">
        <div class="mm-setting-text"><strong>${s.label}</strong><small>${s.hint}</small></div>
        <div class="mm-seg" role="group" aria-label="${s.label}">
          ${s.options.map((o, i) => `<button type="button" class="mm-seg-btn ${save.settings[s.key] === o.value ? 'on' : ''}" data-key="${s.key}" data-opt="${i}">${o.label}</button>`).join('')}
        </div>
      </div>`).join('');
    return `
      <div class="mm-card">
        <h2 class="mm-heading">Settings</h2>
        ${rows}
        <p class="mm-note">Settings apply the next time you start fishing.</p>
        <button class="mm-btn mm-back" data-go="home" type="button">Back</button>
      </div>`;
  }

  function render() {
    overlay.querySelector('.mm-card')?.remove();
    overlay.insertAdjacentHTML('afterbegin', view === 'settings' ? settingsHtml() : homeHtml());
    overlay.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.go)));
    overlay.querySelectorAll('.mm-seg-btn').forEach((btn) => btn.addEventListener('click', () => {
      const setting = SETTINGS.find((s) => s.key === btn.dataset.key);
      save.settings[setting.key] = setting.options[Number(btn.dataset.opt)].value;
      saveSave(save);
      render();
    }));
  }

  function go(target) {
    if (target === 'continue') { close(); onContinue(); return; }
    if (target === 'new') { close(); onNewGame(); return; }
    if (target === 'tackle') { logPanel.classList.add('hidden'); tackleBox.toggle(); return; }
    if (target === 'log') {
      tackleBox.close();
      logPanel.classList.toggle('hidden');
      if (!logPanel.classList.contains('hidden')) {
        renderCatchLog(logPanel, save.catchLog, { species: FISH_SPECIES });
        logPanel.querySelector('[data-close]')?.addEventListener('click', () => logPanel.classList.add('hidden'));
      }
      return;
    }
    view = target;
    render();
  }

  render();
}
