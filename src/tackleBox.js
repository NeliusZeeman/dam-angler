import { RODS, LINES, REELS, HOOKS, LURES, getGearById, rigCheck, TACKLE_SECTIONS, sectionsFor } from './gear.js';

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
      const lineSpec = item.breakKg ? `${{ mono: 'Mono', braid: 'Braid', fluoro: 'Fluorocarbon', fly: item.sinking ? 'Sinking fly line' : 'Floating fly line' }[item.type] || ''} · breaks at ${item.breakKg} kg` : '';
      const hookSpec = item.strengthKg ? `Holds fish to ~${item.strengthKg} kg` : '';
      const specText = [lineSpec || hookSpec, item.note].filter(Boolean).join(' · ');
      const spec = item.action ? `<small class="shop-spec">${item.action} action · ${item.power} power${item.note ? `<span class="shop-note"> · ${item.note}</span>` : ''}</small>`
        : specText ? `<small class="shop-spec shop-note">${specText}</small>` : '';
      return `<div class="shop-row">
        <span>${item.name}${spec}</span>
        <button data-kind="${kind}" data-id="${item.id}" ${disabled ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    return `<h3>${title}</h3>${rows}`;
  }

  // Two rows of tabs: the kind of fishing (General, Carp, Bass, Fly & Trout,
  // Barbel & Tiger), then the part of the rig (Bait, Rods, Reels, Line,
  // Hooks). One short list at a time, so nothing hides below the fold on a
  // phone. Opens on Bait, the thing you change most.
  const TABS = [
    { kind: 'lure', label: 'Bait', title: 'Bait & Lures', items: () => LURES, owned: () => save.ownedLureIds, equipped: () => save.equippedLureId },
    { kind: 'rod', label: 'Rods', title: 'Rods', items: () => RODS, owned: () => save.ownedRodIds, equipped: () => save.equippedRodId },
    { kind: 'reel', label: 'Reels', title: 'Reels', items: () => REELS, owned: () => save.ownedReelIds, equipped: () => save.equippedReelId },
    { kind: 'line', label: 'Line', title: 'Lines', items: () => LINES, owned: () => save.ownedLineIds, equipped: () => save.equippedLineId },
    { kind: 'hook', label: 'Hooks', title: 'Hooks & Rigs', items: () => HOOKS, owned: () => save.ownedHookIds, equipped: () => save.equippedHookId },
  ];
  let activeTab = 'lure';
  let activeSection = 'general';
  const inSection = (item) => sectionsFor(item).includes(activeSection);

  // What's rigged up right now, and whether it belongs together.
  function rigHtml() {
    const rig = rigCheck({
      rod: getGearById(RODS, save.equippedRodId), reel: getGearById(REELS, save.equippedReelId),
      line: getGearById(LINES, save.equippedLineId), lure: getGearById(LURES, save.equippedLureId),
    });
    if (rig.ok) return `<div class="rig-check ok">${rig.flyRig ? 'Fly rig ready — rod, reel, line and fly all match' : 'Rig ready'}</div>`;
    const pct = Math.round(rig.castFactor * 100);
    return `<div class="rig-check warn"><b>Rig doesn't match${pct < 100 ? ` — casts only ~${pct}% as far` : ''}</b>${rig.issues.map((i) => `<span>${i}</span>`).join('')}</div>`;
  }

  function refresh() {
    const section = TACKLE_SECTIONS.find((x) => x.id === activeSection) || TACKLE_SECTIONS[0];
    // Only the parts this kind of fishing has (flies come tied on their own
    // hooks, so Fly & Trout has no Hooks tab).
    const kinds = TABS.filter((t) => t.items().some(inSection));
    const tab = kinds.find((t) => t.kind === activeTab) || kinds[0];
    activeTab = tab.kind;
    const rigged = TABS.map((t) => getGearById(t.items(), t.equipped())?.name.split(' (')[0]).filter(Boolean).join(' · ');
    panel.innerHTML = `
      <button class="panel-close" id="shop-close">Close</button>
      <div class="tackle-credits">Credits: ${save.credits}</div>
      <div class="tackle-rigged"><b>Rigged:</b> ${rigged}</div>
      ${rigHtml()}
      <div class="tackle-tabs tackle-sections" role="tablist" aria-label="Kind of fishing">
        ${TACKLE_SECTIONS.map((x) => `<button type="button" role="tab" class="tackle-tab section-tab ${x.id === section.id ? 'on' : ''}" aria-selected="${x.id === section.id}" data-section="${x.id}">${x.label}</button>`).join('')}
      </div>
      <p class="tackle-blurb">${section.blurb}</p>
      <div class="tackle-tabs" role="tablist" aria-label="Part of the rig">
        ${kinds.map((t) => `<button type="button" role="tab" class="tackle-tab ${t.kind === tab.kind ? 'on' : ''}" aria-selected="${t.kind === tab.kind}" data-tab="${t.kind}">${t.label}</button>`).join('')}
      </div>
      ${renderSection(`${section.label} — ${tab.title}`, tab.items().filter(inSection), tab.owned(), tab.equipped(), tab.kind)}
    `;
    panel.querySelector('#shop-close').addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelectorAll('[data-section]').forEach((btn) => btn.addEventListener('click', () => {
      activeSection = btn.dataset.section;
      refresh();
      panel.scrollTop = 0;
    }));
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
