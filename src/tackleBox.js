import { RODS, LINES, REELS, HOOKS, LURES, COMBOS, getGearById, rigCheck, TACKLE_SECTIONS, sectionsFor } from './gear.js';
import { gearPicture } from './gfx/gearThumbs.js';

// `onBuy(kind, id)`: a purchase was made (the online server checks it).
export function createTackleBox({ container, save, onSaveChanged, onBuy = () => {} }) {
  const panel = document.createElement('div');
  panel.className = 'shop-panel hidden';
  container.appendChild(panel);

  function renderSection(title, items, ownedIds, equippedId, kind) {
    if (kind === 'combo') return renderCombos(title, items);
    // Items taken out of the shop (admin tuning) only show for those who own
    // them, and a combo's own rod or reel only once you have it. Cheapest
    // first.
    const shown = items.filter((item) => (item.inShop !== false && !item.comboOnly) || ownedIds.includes(item.id));
    const rows = shown.sort((a, b) => a.cost - b.cost).map((item) => {
      const owned = ownedIds.includes(item.id);
      const equipped = equippedId === item.id;
      const label = owned ? (equipped ? 'In use' : 'Use') : 'Buy';
      const disabled = (!owned && save.credits < item.cost) || equipped;
      // Rods: action and power. Lines: type and breaking strain. Hooks: how
      // big a fish they'll hold. Plus each item's own short note.
      const lineSpec = item.breakKg ? `${{ mono: 'Mono', braid: 'Braid', fluoro: 'Fluorocarbon', fly: item.sinking ? 'Sinking fly line' : 'Floating fly line' }[item.type] || ''} · breaks at ${item.breakKg} kg` : '';
      const hookSpec = item.strengthKg ? `Holds fish to ~${item.strengthKg} kg` : '';
      const specText = [lineSpec || hookSpec, item.note].filter(Boolean).join(' · ');
      // Shop rods and reels (gearCatalog.js) carry their real specs in the note.
      const spec = item.priceR ? item.note
        : item.action ? `${item.action} action · ${item.power} power${item.note ? ` · ${item.note}` : ''}`
        : specText;
      return card({ kind, id: item.id, name: item.name, spec, cost: item.cost, owned, equipped, label, disabled });
    }).join('');
    return `<h3>${title}</h3><div class="shop-grid">${rows}</div>`;
  }

  // One item as a card: name, specs, then its price (or owned / rigged) and
  // the button.
  function card({ kind, id, name, spec, cost, owned, equipped, label, disabled }) {
    const status = equipped ? '<span class="card-tag rigged">Rigged</span>'
      : owned ? '<span class="card-tag">Owned</span>'
        : `<span class="card-price">${cost ? `${cost} credits` : 'Free'}</span>`;
    return `<div class="shop-card${owned ? ' owned' : ''}${equipped ? ' equipped' : ''}">
      <div class="card-img"><img alt="" data-pic="${kind}|${id}" hidden></div>
      <div class="card-name">${name}</div>
      ${spec ? `<small class="card-spec">${spec}</small>` : ''}
      <div class="card-foot">${status}<button data-kind="${kind}" data-id="${id}" ${disabled ? 'disabled' : ''}>${label}</button></div>
    </div>`;
  }

  // Combos: one price for a rod and reel sold together. "Use" rigs both.
  const hasCombo = (c) => save.ownedRodIds.includes(c.rodId) && save.ownedReelIds.includes(c.reelId);
  function renderCombos(title, items) {
    const rows = items.filter((c) => c.inShop !== false || hasCombo(c)).sort((a, b) => a.cost - b.cost).map((c) => {
      const owned = hasCombo(c);
      const rigged = save.equippedRodId === c.rodId && save.equippedReelId === c.reelId;
      const label = owned ? (rigged ? 'In use' : 'Use') : 'Buy';
      const disabled = (!owned && save.credits < c.cost) || rigged;
      const rod = getGearById(RODS, c.rodId), reel = getGearById(REELS, c.reelId);
      const spec = `${c.note}<br><b>Rod:</b> ${rod.note}<br><b>Reel:</b> ${reel.note}`;
      return card({ kind: 'combo', id: c.id, name: c.name, spec, cost: c.cost, owned, equipped: rigged, label, disabled });
    }).join('');
    return `<h3>${title}</h3><div class="shop-grid">${rows}</div>`;
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
    { kind: 'combo', label: 'Combos', title: 'Rod & Reel Combos', items: () => COMBOS, owned: () => [], equipped: () => null },
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

  // The reel's drag, as a share of the line's breaking strain.
  function dragHtml() {
    const drag = typeof save.drag === 'number' ? save.drag : 0.33;
    const lineKg = getGearById(LINES, save.equippedLineId)?.breakKg ?? 4.5;
    const verdict = drag >= 0.5 ? 'Tight — a lunge can snap the line'
      : drag <= 0.15 ? 'Loose — safe, but fish take line at will and tire slowly'
      : 'About right';
    return `<div class="tackle-drag">
      <label for="drag-slider"><b>Drag</b> <span id="drag-read">${Math.round(drag * 100)}% · ${(drag * lineKg).toFixed(1)} kg</span></label>
      <input id="drag-slider" type="range" min="5" max="90" step="5" value="${Math.round(drag * 100)}">
      <small id="drag-verdict">${verdict}. Rule of thumb: about a third of the line's strength. In the game: [ and ] keys, or − / +.</small>
    </div>`;
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
      <div class="tackle-head">
        <div>
          <div class="tackle-credits">Credits: ${save.credits}</div>
          <div class="tackle-rigged"><b>Rigged:</b> ${rigged}</div>
          ${rigHtml()}
        </div>
        ${dragHtml()}
      </div>
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
    fillPictures();
    const slider = panel.querySelector('#drag-slider');
    slider.addEventListener('input', () => {
      save.drag = Number(slider.value) / 100;
      const lineKg = getGearById(LINES, save.equippedLineId)?.breakKg ?? 4.5;
      panel.querySelector('#drag-read').textContent = `${slider.value}% · ${(save.drag * lineKg).toFixed(1)} kg`;
    });
    slider.addEventListener('change', () => { onSaveChanged(); refresh(); });
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

  // Each card's picture: a snapshot of the item's own 3D model.
  const LISTS = { rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES, combo: COMBOS };
  function fillPictures() {
    panel.querySelectorAll('img[data-pic]').forEach((img) => {
      const [kind, id] = img.dataset.pic.split('|');
      const item = getGearById(LISTS[kind] || [], id);
      if (!item) return;
      gearPicture(kind, item, (url) => {
        if (!url) return;
        img.src = url;
        img.hidden = false;
      });
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
    if (kind === 'combo') {
      const c = COMBOS.find((x) => x.id === id);
      if (!hasCombo(c)) {
        if (save.credits < c.cost) return;
        save.credits -= c.cost;
        if (!save.ownedRodIds.includes(c.rodId)) save.ownedRodIds.push(c.rodId);
        if (!save.ownedReelIds.includes(c.reelId)) save.ownedReelIds.push(c.reelId);
        onBuy('combo', id);
      }
      save.equippedRodId = c.rodId;
      save.equippedReelId = c.reelId;
      onSaveChanged();
      refresh();
      return;
    }
    const owned = ownedListFor(kind);
    const item = itemsFor(kind).find((i) => i.id === id);
    if (!owned.includes(id)) {
      if (save.credits < item.cost) return;
      save.credits -= item.cost;
      owned.push(id);
      onBuy(kind, id);
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
