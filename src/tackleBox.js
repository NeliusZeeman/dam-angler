import { RODS, LINES, REELS, HOOKS, LURES } from './gear.js';

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
      // Rods: action and power. Lines: type and breaking strain. Hooks: how
      // big a fish they'll hold. Plus each item's own short note.
      const lineSpec = item.breakKg ? `${{ mono: 'Mono', braid: 'Braid', fluoro: 'Fluorocarbon' }[item.type] || ''} · breaks at ${item.breakKg} kg` : '';
      const hookSpec = item.strengthKg ? `Holds fish to ~${item.strengthKg} kg` : '';
      const specText = [lineSpec || hookSpec, item.note].filter(Boolean).join(' · ');
      const spec = item.action ? `<small class="shop-spec">${item.action} action · ${item.power} power</small>`
        : specText ? `<small class="shop-spec shop-note">${specText}</small>` : '';
      return `<div class="shop-row">
        <span>${item.name}${spec}</span>
        <button data-kind="${kind}" data-id="${item.id}" ${disabled ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    return `<h3>${title}</h3>${rows}`;
  }

  // One section at a time, picked from tabs along the top -- the full list
  // is taller than most screens and the bait section used to sit out of
  // sight below the fold. Opens on Bait, the thing you change most.
  const TABS = [
    { kind: 'lure', label: 'Bait', title: 'Bait & Lures', items: () => LURES, owned: () => save.ownedLureIds, equipped: () => save.equippedLureId },
    { kind: 'rod', label: 'Rods', title: 'Rods', items: () => RODS, owned: () => save.ownedRodIds, equipped: () => save.equippedRodId },
    { kind: 'reel', label: 'Reels', title: 'Reels', items: () => REELS, owned: () => save.ownedReelIds, equipped: () => save.equippedReelId },
    { kind: 'line', label: 'Line', title: 'Lines', items: () => LINES, owned: () => save.ownedLineIds, equipped: () => save.equippedLineId },
    { kind: 'hook', label: 'Hooks', title: 'Hooks & Rigs', items: () => HOOKS, owned: () => save.ownedHookIds, equipped: () => save.equippedHookId },
  ];
  let activeTab = 'lure';

  function refresh() {
    const tab = TABS.find((t) => t.kind === activeTab) || TABS[0];
    panel.innerHTML = `
      <button class="panel-close" id="shop-close">Close</button>
      <div class="tackle-credits">Credits: ${save.credits}</div>
      <div class="tackle-tabs" role="tablist">
        ${TABS.map((t) => `<button type="button" role="tab" class="tackle-tab ${t.kind === tab.kind ? 'on' : ''}" aria-selected="${t.kind === tab.kind}" data-tab="${t.kind}">${t.label}</button>`).join('')}
      </div>
      ${renderSection(tab.title, tab.items(), tab.owned(), tab.equipped(), tab.kind)}
    `;
    panel.querySelector('#shop-close').addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      refresh();
      panel.scrollTop = 0;
    }));
    panel.querySelectorAll('button[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => handleClick(btn.dataset.kind, btn.dataset.id));
    });
  }

  function ownedListFor(kind) {
    if (kind === 'rod') return save.ownedRodIds;
    if (kind === 'line') return save.ownedLineIds;
    if (kind === 'reel') return save.ownedReelIds;
    if (kind === 'hook') return save.ownedHookIds;
    return save.ownedLureIds;
  }

  function itemsFor(kind) {
    if (kind === 'rod') return RODS;
    if (kind === 'line') return LINES;
    if (kind === 'reel') return REELS;
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
      if (kind === 'reel') save.equippedReelId = id;
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
