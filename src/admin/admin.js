// The admin area (admin.html): dashboard, players, one player, admin log.
// Talks to /api/admin/* (server/admin.js). Every piece of text goes in via
// textContent -- player names and reasons can never turn into code.
import { FISH_SPECIES } from '../fish.js';
import { LOCATIONS } from '../locations.js';
import { RODS, LINES, REELS, HOOKS, LURES } from '../gear.js';
import { tuningScreen } from './tuning.js';

const main = document.getElementById('main');
const whoEl = document.getElementById('who');
const toastEl = document.getElementById('toast');

const SPECIES = new Map(FISH_SPECIES.map((s) => [s.id, s.name]));
const PLACES = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const GEAR = { rod: RODS, line: LINES, reel: REELS, hook: HOOKS, lure: LURES };
const gearName = (kind, id) => GEAR[kind]?.find((g) => g.id === id)?.name || id;
const fish = (id) => SPECIES.get(id) || id;
const place = (id) => PLACES.get(id) || id || '—';
const kg = (v) => `${Number(v).toFixed(2)} kg`;
const n = (v) => Number(v || 0).toLocaleString('en-ZA');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const ago = (iso) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

// Builds an element: h('p', { class: 'x' }, 'text', child, ...). Strings
// always become text, never HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

function toast(text, bad = false) {
  toastEl.textContent = text;
  toastEl.className = `toast show${bad ? ' bad' : ''}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.className = 'toast'; }, 4000);
}

async function api(method, path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Something went wrong (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function show(...nodes) {
  main.replaceChildren(...nodes);
  main.focus({ preventScroll: true });
}

function table(headers, rows, { empty = 'Nothing yet.' } = {}) {
  if (!rows.length) return h('p', { class: 'muted' }, empty);
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, headers.map((x) => (x instanceof Node ? h('th', {}, x) : h('th', {}, x))))),
    h('tbody', {}, rows)));
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
async function dashboard() {
  const o = await api('GET', '/overview');
  const tile = (label, value, sub) => h('div', { class: 'tile' }, h('span', { class: 'tile-label' }, label), h('strong', {}, value), sub ? h('small', {}, sub) : null);
  show(
    h('h1', {}, 'Dashboard'),
    h('section', { class: 'tiles' },
      tile('Players', n(o.players.total), `${n(o.players.newThisWeek)} new this week`),
      tile('Active today', n(o.players.activeToday), `${n(o.players.activeThisWeek)} this week`),
      tile('Fish landed', n(o.catches.total), `${n(o.catches.today)} today`),
      tile('Credits held', n(o.creditsHeld), 'by all players')),
    h('section', { class: 'cols' },
      h('div', {}, h('h2', {}, 'Biggest fish'),
        table(['Fish', 'Weight', 'Player', 'Where', 'When'], o.topCatches.map((c) => h('tr', {},
          h('td', {}, fish(c.speciesId), c.trophy ? h('span', { class: 'pill gold' }, 'trophy') : null),
          h('td', { class: 'num' }, kg(c.weightKg)),
          h('td', {}, h('a', { href: `#/player/${c.userId}` }, c.username)),
          h('td', {}, place(c.locationId)),
          h('td', {}, when(c.caughtAt)))), { empty: 'No fish landed yet.' })),
      h('div', {}, h('h2', {}, 'Catches per spot'),
        table(['Spot', 'Fish', 'Record'], o.dams.map((d) => h('tr', {},
          h('td', {}, place(d.locationId)), h('td', { class: 'num' }, n(d.total)), h('td', { class: 'num' }, kg(d.bestKg)))), { empty: 'No fish landed yet.' }))),
  );
}

// ─── Players ────────────────────────────────────────────────────────────────
const SORT_COLS = [['username', 'Player'], ['joined', 'Joined'], ['lastSeen', 'Last seen'], ['credits', 'Credits'], ['catches', 'Fish'], ['best', 'Best fish']];
async function players(params) {
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'joined';
  const dir = params.get('dir') || 'desc';
  const page = Number(params.get('page')) || 1;
  const data = await api('GET', `/players?${new URLSearchParams({ q, sort, dir, page })}`);
  const go = (changes) => { location.hash = `#/players?${new URLSearchParams({ q, sort, dir, page, ...changes })}`; };
  const search = h('input', { type: 'search', name: 'q', value: q, placeholder: 'Search username or email', 'aria-label': 'Search players' });
  const form = h('form', { class: 'search', onsubmit: (e) => { e.preventDefault(); go({ q: search.value, page: 1 }); } },
    search, h('button', { type: 'submit' }, 'Search'), q ? h('button', { type: 'button', class: 'ghost', onclick: () => go({ q: '', page: 1 }) }, 'Clear') : null);
  const head = SORT_COLS.map(([key, label]) => h('button', {
    type: 'button', class: `sort${sort === key ? ` on ${dir}` : ''}`,
    onclick: () => go({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc', page: 1 }),
  }, label));
  head.splice(1, 0, 'Email');
  const rows = data.players.map((p) => h('tr', { class: 'click', onclick: () => { location.hash = `#/player/${p.id}`; } },
    h('td', {}, h('a', { href: `#/player/${p.id}` }, p.username), p.role === 'admin' ? h('span', { class: 'pill' }, 'admin') : null),
    h('td', { class: 'email' }, p.email),
    h('td', {}, when(p.joined)),
    h('td', {}, ago(p.lastSeen)),
    h('td', { class: 'num' }, n(p.credits)),
    h('td', { class: 'num' }, n(p.catches)),
    h('td', {}, p.best ? `${fish(p.best.speciesId)} ${kg(p.best.weightKg)}` : '—')));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  show(
    h('h1', {}, 'Players ', h('span', { class: 'count' }, n(data.total))),
    form,
    table(head, rows, { empty: q ? `No players match "${q}".` : 'No players yet.' }),
    pages > 1 ? h('nav', { class: 'pager' },
      h('button', { type: 'button', disabled: data.page <= 1, onclick: () => go({ page: data.page - 1 }) }, '‹ Previous'),
      h('span', {}, `Page ${data.page} of ${pages}`),
      h('button', { type: 'button', disabled: data.page >= pages, onclick: () => go({ page: data.page + 1 }) }, 'Next ›')) : null,
  );
}

// ─── One player ─────────────────────────────────────────────────────────────
async function player(id) {
  const d = await api('GET', `/players/${encodeURIComponent(id)}`);
  const p = d.player;
  const s = d.save || {};
  const facts = h('dl', { class: 'facts' },
    ...[['Email', p.email], ['Joined', when(p.joined)], ['Last login', when(p.lastLogin)], ['Last seen', ago(p.lastSeen)],
      ['Credits', n(p.credits)], ['Fish landed', n(p.totalCatches)], ['Last spot', place(s.locationId)],
      ['Drag', s.drag ? `${Math.round(s.drag * 100)}%` : '—']].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]).flat());
  const rig = h('ul', { class: 'rig' }, ['rod', 'reel', 'line', 'hook', 'lure'].map((kind) => {
    const f = { rod: 'Rod', reel: 'Reel', line: 'Line', hook: 'Hook', lure: 'Lure' }[kind];
    const owned = s[`owned${f}Ids`] || [];
    const on = s[`equipped${f}Id`];
    return h('li', {}, h('b', {}, kind === 'lure' ? 'Bait' : f), ' ', owned.map((g) => h('span', { class: `pill${g === on ? ' on' : ''}`, title: g === on ? 'rigged' : 'owned' }, gearName(kind, g))));
  }));

  // Give / take credits.
  const amount = h('input', { type: 'number', name: 'amount', step: '1', required: true, placeholder: 'e.g. 500 or -200' });
  const reason = h('input', { name: 'reason', required: true, minlength: '3', maxlength: '200', placeholder: 'Reason (shown in their credit history)' });
  const pw = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', placeholder: 'Your password (over 10,000)' });
  const creditForm = h('form', { class: 'card form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      const r = await api('POST', `/players/${p.id}/credits`, { amount: Number(amount.value), reason: reason.value, password: pw.value || undefined });
      toast(`${p.username} now has ${n(r.credits)} credits.`);
      route();
    } catch (err) { toast(err.message, true); }
  } }, h('h2', {}, 'Give or take credits'), h('p', { class: 'muted' }, 'A minus amount takes credits away. Their balance can\'t go below 0.'),
  h('div', { class: 'row' }, amount, reason), pw, h('button', { type: 'submit' }, 'Apply'));

  // Delete (admins can't be deleted here).
  const confirmName = h('input', { name: 'confirm', autocomplete: 'off', placeholder: `Type ${p.username}` });
  const delPw = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', placeholder: 'Your password' });
  const deleteBox = p.role === 'admin' ? h('p', { class: 'muted' }, 'Admin accounts can\'t be deleted here.')
    : h('details', { class: 'card danger' }, h('summary', {}, 'Delete this player'),
      h('p', {}, `Removes ${p.username}'s account, save, gear, all ${n(p.totalCatches)} catches and credit history for good. It's recorded in the admin log.`),
      h('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        try {
          await api('DELETE', `/players/${p.id}`, { confirmUsername: confirmName.value, password: delPw.value });
          toast(`${p.username} was deleted.`);
          location.hash = '#/players';
        } catch (err) { toast(err.message, true); }
      } }, confirmName, delPw, h('button', { type: 'submit', class: 'danger-btn' }, 'Delete for good')));

  show(
    h('p', {}, h('a', { href: '#/players', class: 'back' }, '← Players')),
    h('h1', {}, p.username, p.role === 'admin' ? h('span', { class: 'pill' }, 'admin') : null),
    h('section', { class: 'cols' }, h('div', { class: 'card' }, facts), h('div', { class: 'card' }, h('h2', {}, 'Tackle'), rig)),
    h('section', { class: 'cols' }, creditForm, deleteBox),
    h('h2', {}, 'Catches'),
    table(['Fish', 'Weight', 'Length', 'Where', 'Time', 'Paid', 'When'], d.catches.map((c) => h('tr', {},
      h('td', {}, fish(c.speciesId), c.trophy ? h('span', { class: 'pill gold' }, 'trophy') : null),
      h('td', { class: 'num' }, kg(c.weightKg)), h('td', { class: 'num' }, c.lengthCm ? `${c.lengthCm} cm` : '—'),
      h('td', {}, place(c.locationId)), h('td', {}, c.timeOfDay || '—'), h('td', { class: 'num' }, n(c.payout)),
      h('td', {}, when(c.caughtAt)))), { empty: 'No fish landed yet.' }),
    h('h2', {}, 'Credit history'),
    table(['When', 'Change', 'Why', 'Details'], d.creditHistory.map((c) => h('tr', {},
      h('td', {}, when(c.at)), h('td', { class: `num ${c.amount < 0 ? 'neg' : 'pos'}` }, `${c.amount > 0 ? '+' : ''}${n(c.amount)}`),
      h('td', {}, { catch: 'Catch', buy: 'Bought', chum: 'Breadcrumbs', 'guest-import': 'Guest progress', admin: 'Admin' }[c.reason] || c.reason),
      h('td', {}, c.reason === 'buy' && c.ref ? gearName(...c.ref.split(':')) : c.reason === 'catch' ? '' : (c.ref || '')))), { empty: 'No credit changes yet.' }),
  );
}

// ─── Admin log ──────────────────────────────────────────────────────────────
async function log(params) {
  const page = Number(params.get('page')) || 1;
  const data = await api('GET', `/log?page=${page}`);
  const what = (e) => (e.action === 'credits'
    ? `${e.details.amount > 0 ? 'Gave' : 'Took'} ${n(Math.abs(e.details.amount))} credits — "${e.details.reason}"`
    : `Deleted the account (${n(e.details.catches)} catches, ${n(e.details.credits)} credits)`);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  show(
    h('h1', {}, 'Admin log'),
    table(['When', 'Admin', 'Player', 'What'], data.entries.map((e) => h('tr', {},
      h('td', {}, when(e.at)), h('td', {}, e.admin),
      h('td', {}, e.action === 'delete-player' || !e.targetId ? e.target : h('a', { href: `#/player/${e.targetId}` }, e.target)),
      h('td', {}, what(e)))), { empty: 'No admin actions yet.' }),
    pages > 1 ? h('nav', { class: 'pager' },
      h('button', { type: 'button', disabled: page <= 1, onclick: () => { location.hash = `#/log?page=${page - 1}`; } }, '‹ Newer'),
      h('span', {}, `Page ${page} of ${pages}`),
      h('button', { type: 'button', disabled: page >= pages, onclick: () => { location.hash = `#/log?page=${page + 1}`; } }, 'Older ›')) : null,
  );
}

// ─── Routing ────────────────────────────────────────────────────────────────
async function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const [section, id] = path.split('/');
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === (section === 'player' ? 'players' : section || 'dashboard')));
  try {
    if (section === 'players') await players(params);
    else if (section === 'player' && id) await player(id);
    else if (section === 'log') await log(params);
    else if (section === 'tuning') await tuningScreen(params, { h, api, show, toast });
    else await dashboard();
  } catch (err) {
    if (err.status === 401 || err.status === 403) return locked(err.status);
    show(h('p', { class: 'error' }, err.message));
  }
}

function locked(status) {
  whoEl.textContent = '';
  show(h('div', { class: 'card locked' },
    h('h1', {}, status === 401 ? 'Please log in' : 'Admins only'),
    h('p', {}, status === 401
      ? 'Log in to the game with your admin account, then come back to this page.'
      : 'This account isn\'t an admin.'),
    h('a', { href: '/', class: 'button' }, 'Go to the game')));
}

async function start() {
  try {
    const me = await api('GET', '/me');
    whoEl.replaceChildren('Signed in as ', h('b', {}, me.username), ' · ', h('a', { href: '/' }, 'Game'));
  } catch (err) {
    return locked(err.status === 403 ? 403 : 401);
  }
  window.addEventListener('hashchange', route);
  route();
}

start();
