// The Esc menu. `items` adds extra buttons ({ label, onClick }) between
// "Resume" and "Change Fishing Spot" -- the tackle box, catch log and so on.
export function createPauseMenu(container, { locationName, onResume, onChangeSpot, onMainMenu = null, items = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'pause-menu hidden';
  overlay.innerHTML = `
    <div class="pause-menu-inner">
      <h1>Paused</h1>
      <p class="pause-location">${locationName}</p>
      <button class="pause-btn pause-btn-primary" data-action="resume" type="button">Resume Fishing</button>
      ${items.map((item, i) => `<button class="pause-btn" data-item="${i}" type="button">${item.label}</button>`).join('')}
      <button class="pause-btn" data-action="change-spot" type="button">Change Fishing Spot</button>
      ${onMainMenu ? '<button class="pause-btn" data-action="main-menu" type="button">Main Menu</button>' : ''}
      <p class="pause-hint">Press Esc to resume</p>
    </div>
  `;
  container.appendChild(overlay);

  overlay.querySelector('[data-action="resume"]').addEventListener('click', () => onResume());
  overlay.querySelector('[data-action="change-spot"]').addEventListener('click', () => onChangeSpot());
  overlay.querySelector('[data-action="main-menu"]')?.addEventListener('click', () => onMainMenu());
  overlay.querySelectorAll('[data-item]').forEach((btn) => {
    btn.addEventListener('click', () => items[Number(btn.dataset.item)].onClick());
  });

  function show() { overlay.classList.remove('hidden'); }
  function hide() { overlay.classList.add('hidden'); }
  function isOpen() { return !overlay.classList.contains('hidden'); }

  return { show, hide, isOpen };
}
