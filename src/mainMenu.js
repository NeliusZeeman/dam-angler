import { renderChallenges, renderCompetitions } from './goalsScreens.js';
import { getLocationById } from './locations.js';
import { FISH_SPECIES } from './fish.js';
import { saveSave } from './save.js';
import { createTackleBox } from './tackleBox.js';
import { levelInfo, pointsFromLog } from './levels.js';
import { renderCatchLog } from './ui.js';
import { buildLabel } from './versionCheck.js';
import { showAccountPanel } from './accountPanel.js';
import { installMode, promptInstall, onInstallChange } from './install.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SYNC_LABELS = { synced: 'Saved online', saving: 'Saving…', offline: 'Saved on this device — will sync', loggedOut: 'Please log in again' };

const TIME_LABELS = {
  morning: 'Morning', midMorning: 'Mid-Morning', midday: 'Midday', afternoon: 'Afternoon',
  sunset: 'Sunset', lateTwilight: 'Late Twilight', night: 'Night',
};

const SETTINGS = [
  {
    key: 'quality', label: 'Graphics detail',
    hint: 'How much is drawn: grass, trees, shadows, people, reflections. Auto picks Low on phones and small tablets. Takes effect on the next dam you load.',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'ultra', label: 'Ultra' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }],
  },
  {
    key: 'engine', label: 'Graphics engine',
    hint: 'WebGPU (Chrome, Edge, newer Safari) is the newer engine: with Ultra it adds water you can see into, softer contact shadows and smoother edges. If the browser can\'t do it, the game uses Standard. Takes effect on the next dam you load.',
    options: [{ value: 'webgl', label: 'Standard' }, { value: 'webgpu', label: 'WebGPU' }],
  },
  {
    key: 'resolution', label: 'Resolution',
    hint: 'How sharp the picture is drawn. Auto keeps it smooth: about 1080p on big screens, and it softens a little when the game slows. High is the screen\'s full sharpness (slowest), Medium three quarters, Low half (fastest). Takes effect on the next dam you load.',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }],
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
  {
    key: 'volume', label: 'Sound',
    hint: 'Wind, water, birds, the reel and the splash. Press M in the game to mute.',
    options: [{ value: 0, label: 'Off' }, { value: 0.35, label: 'Low' }, { value: 0.7, label: 'Medium' }, { value: 1, label: 'High' }],
  },
];

// The title screen shown every time the game opens. Continue picks up the
// last dam and time; New Game goes to the dam/time picker; the tackle box,
// catch log and settings all work from here without starting a session.
export function showMainMenu(container, { save, onContinue, onNewGame, onSettingsChanged = () => {}, cloud = null, sessionEnded = false }) {
  const overlay = document.createElement('div');
  overlay.className = 'main-menu';
  container.appendChild(overlay);
  let view = 'home';

  const tackleBox = createTackleBox({ container: overlay, save, onSaveChanged: () => {
    saveSave(save);
    if (view === 'home') render(); // credits on the title card
  }, onBuy: (kind, id) => cloud?.queueBuy(kind, id), getLevel: () => myLevel().level });
  const myLevel = () => levelInfo(pointsFromLog(save.catchLog, save.compPlaces));
  const logPanel = document.createElement('div');
  logPanel.className = 'shop-panel hidden';
  overlay.appendChild(logPanel);

  let stopStatus = null;
  const close = () => { stopStatus?.(); overlay.remove(); };

  // Online accounts: only shown when there's a Dam Angler server behind the page.
  let online = false;
  if (cloud) {
    cloud.available().then((up) => { online = up; if (view === 'home') render(); });
    stopStatus = cloud.onStatus(() => { if (view === 'home') render(); });
  }
  function accountHtml() {
    if (!cloud || !online) return '';
    const u = cloud.user();
    if (!u) {
      return `
        <div class="mm-account">
          ${sessionEnded ? '<p class="mm-note">You were logged out — log in again to keep saving online.</p>' : ''}
          <button class="mm-btn mm-account-btn" data-go="account" type="button">Log in or sign up<small>Save online · play on phone, tablet and PC</small></button>
        </div>`;
    }
    const status = cloud.status();
    return `
      <div class="mm-account signed-in">
        <span>Signed in as <b>${esc(u.username)}</b></span>
        <span class="mm-sync" data-status="${status}">${SYNC_LABELS[status] || ''}</span>
        <button class="mm-link" data-go="account" type="button">Account</button>
      </div>`;
  }

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
        <p class="mm-stats"><span>Level ${myLevel().level} · ${myLevel().points} XP</span><span>${save.credits} credits</span><span>${totalCaught()} fish landed</span></p>
        <p class="mm-version">${buildLabel()}</p>
        ${accountHtml()}
        <nav class="mm-buttons">
          ${hasGame ? `<button class="mm-btn mm-primary" data-go="continue" type="button">Continue<small>${where}</small></button>` : ''}
          <button class="mm-btn ${hasGame ? '' : 'mm-primary'}" data-go="new" type="button">New Game<small>Choose a dam and a time of day</small></button>
          <button class="mm-btn" data-go="tackle" type="button">Tackle Box<small>Rods, reels, line, rigs and bait</small></button>
          <button class="mm-btn" data-go="log" type="button">Species Book<small>Every SA species — caught, bests, where they live</small></button>
          <button class="mm-btn" data-go="challenges" type="button">Challenges<small>Daily and weekly — earn credits</small></button>
          <button class="mm-btn" data-go="comps" type="button">Competitions<small>Heaviest fish of the month, online</small></button>
          <button class="mm-btn" data-go="settings" type="button">Settings<small>Graphics and controls</small></button>
          ${installMode() ? '<button class="mm-btn mm-install" data-go="install" type="button">Install as app<small>Home screen icon, full screen, starts fast</small></button>' : ''}
        </nav>
      </div>`;
  }

  // iPhone and iPad: Safari installs from the Share menu only.
  function installHtml() {
    return `
      <div class="mm-card">
        <h2 class="mm-heading">Install on iPhone or iPad</h2>
        <ol class="mm-steps">
          <li>Open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button <span class="mm-share" aria-hidden="true">⬆︎</span> — the square with an arrow, at the bottom of the screen (top right on iPad).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>. Dam Angler is now on your home screen.</li>
        </ol>
        <p class="mm-note">Open it from that icon: it runs full screen, and keeps the game on your phone so it starts fast and each dam loads from the phone after your first visit. Saves, catches and the shop still go online.</p>
        <button class="mm-btn mm-back" data-go="home" type="button">Back</button>
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
        <p class="mm-note">Sound changes straight away; the rest apply the next time you start fishing.</p>
        <button class="mm-btn mm-back" data-go="home" type="button">Back</button>
      </div>`;
  }

  function render() {
    overlay.querySelector('.mm-card')?.remove();
    overlay.insertAdjacentHTML('afterbegin', view === 'settings' ? settingsHtml() : view === 'install' ? installHtml() : homeHtml());
    overlay.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.go)));
    overlay.querySelectorAll('.mm-seg-btn').forEach((btn) => btn.addEventListener('click', () => {
      const setting = SETTINGS.find((s) => s.key === btn.dataset.key);
      save.settings[setting.key] = setting.options[Number(btn.dataset.opt)].value;
      saveSave(save);
      onSettingsChanged(setting.key);
      render();
    }));
  }

  function go(target) {
    if (target === 'continue') { close(); onContinue(); return; }
    if (target === 'install' && installMode() === 'prompt') { promptInstall().then(() => render()); return; }
    if (target === 'new') { close(); onNewGame(); return; }
    if (target === 'tackle') { logPanel.classList.add('hidden'); tackleBox.toggle(); return; }
    if (target === 'account') {
      tackleBox.close();
      logPanel.classList.add('hidden');
      showAccountPanel(overlay, { cloud, save, onChanged: () => { sessionEnded = false; onSettingsChanged('volume'); render(); } });
      return;
    }
    if (target === 'challenges' || target === 'comps') {
      tackleBox.close();
      logPanel.classList.remove('hidden');
      const wireClose = () => logPanel.querySelector('[data-close]')?.addEventListener('click', () => logPanel.classList.add('hidden'));
      const done = target === 'challenges'
        ? renderChallenges(logPanel, { save, cloud, saveSave, onCredits: () => render() })
        : renderCompetitions(logPanel, { cloud });
      wireClose();
      done.then(wireClose);
      return;
    }
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

  // The browser's install offer can arrive after the menu is up.
  onInstallChange(() => { if (view === 'home' && overlay.isConnected) render(); });
  render();
}
