import { RODS, LINES, HOOKS, LURES } from './gear.js';

export function createTackleBox({ container, save, onSaveChanged }) {
  const panel = document.createElement('div');
  panel.className = 'shop-panel hidden';
  container.appendChild(panel);

  function renderSection(title, items, ownedIds, equippedId, kind) {
    const rows = items.map((item) => {
      const owned = ownedIds.includes(item.id);
      const equipped = equippedId === item.id;
      const label = owned ? (equipped ? 'In tackle box' : 'Use') : `Buy (${item.cost})`;
      const disabled = (!owned && save.credits < item.cost) || equipped;
      return `<div class="shop-row">
        <span>${item.name}</span>
        <button data-kind="${kind}" data-id="${item.id}" ${disabled ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    return `<h3>${title}</h3>${rows}`;
  }

  function refresh() {
    panel.innerHTML = `
      <button class="panel-close" id="shop-close">Close</button>
      <div class="tackle-credits">Credits: ${save.credits}</div>
      ${renderSection('Rods', RODS, save.ownedRodIds, save.equippedRodId, 'rod')}
      ${renderSection('Lines', LINES, save.ownedLineIds, save.equippedLineId, 'line')}
      ${renderSection('Hooks & Rigs', HOOKS, save.ownedHookIds, save.equippedHookId, 'hook')}
      ${renderSection('Bait & Lures', LURES, save.ownedLureIds, save.equippedLureId, 'lure')}
    `;
    panel.querySelector('#shop-close').addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelectorAll('button[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => handleClick(btn.dataset.kind, btn.dataset.id));
    });
  }

  function ownedListFor(kind) {
    if (kind === 'rod') return save.ownedRodIds;
    if (kind === 'line') return save.ownedLineIds;
    if (kind === 'hook') return save.ownedHookIds;
    return save.ownedLureIds;
  }

  function itemsFor(kind) {
    if (kind === 'rod') return RODS;
    if (kind === 'line') return LINES;
    if (kind === 'hook') return HOOKS;
    return LURES;
  }

  function handleClick(kind, id) {
    const owned = ownedListFor(kind);
    const item = itemsFor(kind).find((i) => i.id === id);
    if (!owned.includes(id)) {
      if (save.credits < item.cost) return;
      save.credits -= item.cost;
      owned.push(id);
    } else {
      if (kind === 'rod') save.equippedRodId = id;
      if (kind === 'line') save.equippedLineId = id;
      if (kind === 'hook') save.equippedHookId = id;
      if (kind === 'lure') save.equippedLureId = id;
    }
    onSaveChanged();
    refresh();
  }

  function toggle() {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) refresh();
  }

  function close() {
    panel.classList.add('hidden');
  }

  return { toggle, refresh, close };
}
