export function createPauseMenu(container, { locationName, onResume, onChangeSpot }) {
  const overlay = document.createElement('div');
  overlay.className = 'pause-menu hidden';
  overlay.innerHTML = `
    <div class="pause-menu-inner">
      <h1>Paused</h1>
      <p class="pause-location">${locationName}</p>
      <button class="pause-btn pause-btn-primary" data-action="resume" type="button">Resume Fishing</button>
      <button class="pause-btn" data-action="change-spot" type="button">Change Fishing Spot</button>
      <p class="pause-hint">Press Esc to resume</p>
    </div>
  `;
  container.appendChild(overlay);

  overlay.querySelector('[data-action="resume"]').addEventListener('click', () => onResume());
  overlay.querySelector('[data-action="change-spot"]').addEventListener('click', () => onChangeSpot());

  function show() { overlay.classList.remove('hidden'); }
  function hide() { overlay.classList.add('hidden'); }
  function isOpen() { return !overlay.classList.contains('hidden'); }

  return { show, hide, isOpen };
}
