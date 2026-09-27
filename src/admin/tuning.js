// The admin area's Tuning tab: every fish, tackle item, spot and game
// setting, with its hint, built-in value and limits. Changes save to the
// draft as you make them; Publish sends the draft to every player.
import { TUNABLES, GROUPS } from '../tuning/registry.js';

const fmt = (v) => (Array.isArray(v) ? v.join(' · ') : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Items per group, in the order the registry lists them.
const ITEMS = new Map();
for (const t of TUNABLES) {
  if (!ITEMS.has(t.group)) ITEMS.set(t.group, new Map());
  const items = ITEMS.get(t.group);
  if (!items.has(t.item)) items.set(t.item, { id: t.item, label: t.itemLabel, keys: [] });
  items.get(t.item).keys.push(t);
}

let state = null; // { draft, published, publishedVersion, versions }

export async function tuningScreen(params, { h, api, show, toast }) {
  state = await api('GET', '/tuning');
  const group = GROUPS.includes(params.get('group')) ? params.get('group') : 'Fish';
  const items = [...ITEMS.get(group).values()];
  const q = (params.get('q') || '').trim().toLowerCase();
  const itemId = params.get('item') || items[0]?.id;
  const go = (changes) => {
    const p = new URLSearchParams({ group, item: itemId, q: params.get('q') || '', ...changes });
    location.hash = `#/tuning?${p}`;
  };

  const draftKeys = Object.keys(state.draft);
  const unpublished = new Set([...draftKeys, ...Object.keys(state.published)].filter((k) => !same(state.draft[k], state.published[k])));
  const itemChanged = (item) => item.keys.some((t) => t.key in state.draft);
  const itemUnpublished = (item) => item.keys.some((t) => unpublished.has(t.key));

  // ── Toolbar ──
  const note = h('input', { name: 'note', maxlength: '300', placeholder: 'What changed? (e.g. "Carp pay more, cheaper worms")' });
  const importInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden-file', onchange: async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const r = await api('POST', '/tuning/import', data);
      toast(`Imported ${r.imported} values into the draft${r.skipped.length ? ` — ${r.skipped.length} skipped` : ''}.`, r.skipped.length > 0);
      if (r.skipped.length) console.warn('Skipped:', r.skipped);
      render();
    } catch (err) { toast(err.message || 'That file isn\'t a tuning export.', true); }
  } });
  const download = async (which) => {
    const data = await api('GET', `/tuning/export?which=${which}`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: `dam-angler-tuning-${which}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const toolbar = h('section', { class: 'card tuning-bar' },
    h('div', { class: 'tuning-status' },
      h('strong', {}, `${draftKeys.length} value${draftKeys.length === 1 ? '' : 's'} changed from built-in`),
      h('span', { class: unpublished.size ? 'pill warn' : 'pill' }, unpublished.size ? `${unpublished.size} not live yet` : 'draft = live'),
      h('span', { class: 'muted' }, state.publishedVersion ? `Live: version ${state.publishedVersion}` : 'Live: built-in game')),
    h('form', { class: 'publish', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const r = await api('POST', '/tuning/publish', { note: note.value });
        toast(`Published version ${r.version} — players get it next time they open the game.`);
        render();
      } catch (err) { toast(err.message, true); }
    } }, note, h('button', { type: 'submit', disabled: unpublished.size === 0 }, 'Publish')),
    h('div', { class: 'tuning-actions' },
      h('a', { class: 'button ghost', href: '/?tuning=draft', target: '_blank', rel: 'noopener' }, 'Play with draft'),
      h('button', { type: 'button', class: 'ghost', disabled: unpublished.size === 0, onclick: async () => {
        if (!confirm('Throw away the draft changes that aren\'t live yet?')) return;
        await api('DELETE', '/tuning/draft'); toast('Draft discarded.'); render();
      } }, 'Discard draft'),
      h('button', { type: 'button', class: 'ghost', onclick: () => download('published') }, 'Export live'),
      h('button', { type: 'button', class: 'ghost', onclick: () => download('draft') }, 'Export draft'),
      h('button', { type: 'button', class: 'ghost', onclick: () => importInput.click() }, 'Import…'), importInput));

  // ── Left: groups, search, items ──
  const search = h('input', { type: 'search', value: params.get('q') || '', placeholder: 'Find a fish, item or setting', 'aria-label': 'Find' });
  const matches = (item) => !q || item.label.toLowerCase().includes(q) || item.keys.some((t) => t.label.toLowerCase().includes(q));
  const nav = h('aside', { class: 'tuning-nav' },
    h('div', { class: 'group-tabs' }, GROUPS.map((g) => h('button', { type: 'button', class: g === group ? 'on' : '', onclick: () => go({ group: g, item: [...ITEMS.get(g).values()][0].id }) }, g))),
    h('form', { onsubmit: (e) => { e.preventDefault(); go({ q: search.value }); } }, search),
    h('ul', { class: 'item-list' }, items.filter(matches).map((item) => h('li', {},
      h('button', { type: 'button', class: item.id === itemId ? 'on' : '', onclick: () => go({ item: item.id }) },
        item.label,
        itemUnpublished(item) ? h('span', { class: 'dot warn', title: 'draft changes not live yet' }) : itemChanged(item) ? h('span', { class: 'dot', title: 'tuned' }) : null)))));

  // ── Right: the chosen item's values ──
  const item = ITEMS.get(group).get(itemId) || items[0];
  const rows = item.keys.filter((t) => !q || item.label.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)).map((t) => valueRow(t, { h, api, toast, render, draftHas: t.key in state.draft, unpublished: unpublished.has(t.key) }));
  const panel = h('section', { class: 'tuning-panel' }, h('h2', {}, item.label), rows.length ? rows : h('p', { class: 'muted' }, 'Nothing here matches the search.'));

  // ── History ──
  const history = h('section', {}, h('h2', {}, 'Published versions'),
    state.versions.length ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Version', 'When', 'By', 'Note', 'Values', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, state.versions.map((v) => h('tr', {},
        h('td', {}, v.id, String(state.publishedVersion) === v.id ? h('span', { class: 'pill on' }, 'live') : null),
        h('td', {}, new Date(v.at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })),
        h('td', {}, v.by), h('td', { class: 'wrap' }, v.note || ''), h('td', { class: 'num' }, v.count),
        h('td', {}, String(state.publishedVersion) === v.id ? '' : h('button', { type: 'button', class: 'ghost', onclick: async () => {
          if (!confirm(`Make version ${v.id} live again for all players?`)) return;
          try { const r = await api('POST', '/tuning/rollback', { versionId: v.id }); toast(`Rolled back — live is now version ${r.version}.`); render(); } catch (err) { toast(err.message, true); }
        } }, 'Roll back to this'))))))) : h('p', { class: 'muted' }, 'Nothing published yet — players have the built-in game.'));

  show(h('h1', {}, 'Tuning'), toolbar, h('div', { class: 'tuning-layout' }, nav, panel), history);

  function render() { tuningScreen(params, { h, api, show, toast }); }
}

function valueRow(t, { h, api, toast, render, draftHas, unpublished }) {
  const current = draftHas ? state.draft[t.key] : t.defaultValue;
  const err = h('div', { class: 'row-error', role: 'alert' });
  const save = async (value) => {
    err.textContent = '';
    try {
      await api('PUT', '/tuning/draft', { key: t.key, value });
      render();
    } catch (e) { err.textContent = e.message; }
  };
  const num = (v, attrs = {}) => h('input', {
    type: 'number', value: String(v), min: String(t.min), max: String(t.max), step: String(t.step), inputmode: 'decimal', ...attrs,
  });
  let input;
  if (t.type === 'boolean') {
    input = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: current ? true : null, onchange: (e) => save(e.target.checked) }), current ? ' on' : ' off');
  } else if (t.type === 'array7') {
    const labels = ['Morn', 'Mid-m', 'Midday', 'Aftn', 'Sunset', 'Dusk', 'Night'];
    const boxes = current.map((v, i) => num(v, { 'aria-label': labels[i] }));
    input = h('form', { class: 'seven', onsubmit: (e) => { e.preventDefault(); save(boxes.map((b) => Number(b.value))); } },
      boxes.map((b, i) => h('label', {}, h('small', {}, labels[i]), b)), h('button', { type: 'submit', class: 'ghost small' }, 'Save'));
  } else {
    const box = num(current);
    input = h('form', { class: 'one', onsubmit: (e) => { e.preventDefault(); box.blur(); } },
      box, t.unit ? h('span', { class: 'unit' }, t.unit) : null);
    box.addEventListener('change', () => { if (box.value !== '' && Number(box.value) !== current) save(Number(box.value)); });
  }
  return h('div', { class: `trow${draftHas ? ' changed' : ''}` },
    h('div', { class: 'tlabel' },
      h('div', { class: 'tname' }, h('strong', {}, t.label),
        draftHas ? h('span', { class: 'pill on' }, 'tuned') : null,
        unpublished ? h('span', { class: 'pill warn' }, 'not live yet') : null),
      h('small', { class: 'hint' }, t.hint),
      h('small', { class: 'muted' }, `Built-in: ${fmt(t.defaultValue)}${t.unit ? ` ${t.unit}` : ''} · range ${t.type === 'boolean' ? 'on/off' : `${t.min}–${t.max}`}`)),
    h('div', { class: 'tinput' }, input, draftHas ? h('button', { type: 'button', class: 'ghost small', onclick: () => save(null), title: 'Back to the built-in value' }, 'Reset') : null, err));
}
