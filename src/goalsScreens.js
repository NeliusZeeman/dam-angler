// The Species Book, Challenges and Competitions screens (things to chase).
import { FISH_SPECIES } from './fish.js';
import { LOCATIONS } from './locations.js';
import { challengesFor, progressOf, compPrizes } from './goals.js';
import { assetTag } from './versionCheck.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const kg = (v) => `${Number(v).toFixed(2)} kg`;

// ── Species Book ──
export function renderSpeciesBook(container, catchLog, { species = FISH_SPECIES, locationName = null } = {}) {
  const caught = species.filter((sp) => (catchLog[sp.id]?.count || 0) > 0).length;
  const cards = species.map((sp) => {
    const e = catchLog[sp.id] || { count: 0, bestWeightKg: 0 };
    const seen = e.count > 0;
    const homes = LOCATIONS.filter((l) => l.speciesIds.includes(sp.id)).map((l) => l.name);
    const dams = Object.entries(e.bestByDam || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, w]) => `${esc(LOC_NAME.get(id) || id)} ${kg(w)}`).join('<br>');
    const stats = seen
      ? `${e.count} caught · best ${kg(e.bestWeightKg)}${e.released ? ` · ${e.released} released` : ''}${e.trophies ? ` · ${e.trophies} ${e.trophies > 1 ? 'trophies' : 'trophy'}` : ''}`
      : 'Not caught yet';
    return `<div class="shop-card book-card${seen ? ' owned' : ' unseen'}">
      <div class="card-img"><img alt="" loading="lazy" src="assets/fish/${sp.id}.webp${assetTag()}"></div>
      <div class="card-name">${esc(sp.name)}${sp.protected ? ' <span class="book-tag">protected</span>' : ''}</div>
      <small class="card-spec">${stats}${dams ? `<br><b>Personal bests:</b><br>${dams}` : ''}<br><b>Lives in:</b> ${esc(homes.slice(0, 4).join(', '))}${homes.length > 4 ? ` +${homes.length - 4} more` : ''}</small>
    </div>`;
  }).join('');
  const title = locationName ? `Species Book — ${esc(locationName)}` : 'Species Book';
  container.innerHTML = `<button class="panel-close" data-close="log">Close</button>
    <h3>${title} <span class="book-count">${caught} / ${species.length} species</span></h3>
    <div class="shop-grid">${cards}</div>`;
  // No picture yet for a fish: just leave the backdrop.
  container.querySelectorAll('.book-card img').forEach((img) => img.addEventListener('error', () => { img.style.display = 'none'; }));
}

// ── Challenges ──
const CLAIMS_KEY = 'dam-angler-claims';
const readClaims = () => { try { return JSON.parse(localStorage.getItem(CLAIMS_KEY) || '[]'); } catch { return []; } };
const writeClaims = (list) => { try { localStorage.setItem(CLAIMS_KEY, JSON.stringify(list.slice(-60))); } catch { /* private mode */ } };

// Guests: worked out on this device from the catches kept here.
export function localChallenges(cloud) {
  const catches = cloud?.guestCatches?.() || [];
  const claims = new Set(readClaims());
  return challengesFor().map((c) => ({ ...c, progress: progressOf(c, catches), claimed: claims.has(c.id) }));
}

function timeLeft(kind) {
  const now = new Date(Date.now() + 2 * 3600 * 1000); // SA time
  const endOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const end = kind === 'weekly' ? endOfDay + ((7 - ((now.getUTCDay() + 6) % 7) - 1) * 86_400_000) : endOfDay;
  const h = Math.max(0, Math.round((end - now.getTime()) / 3_600_000));
  return h >= 48 ? `${Math.round(h / 24)} days left` : `${h} h left`;
}

export async function renderChallenges(container, { save, cloud, onCredits = () => {}, saveSave = () => {} }) {
  container.innerHTML = '<button class="panel-close" data-close="log">Close</button><h3>Challenges</h3><p class="muted-note">Loading…</p>';
  let list;
  const online = !!cloud?.user?.();
  try {
    list = online ? await cloud.challenges() : localChallenges(cloud);
  } catch (err) {
    list = localChallenges(cloud);
    container.querySelector('.muted-note').textContent = `Couldn't reach the server (${err.message}) — showing this device's progress.`;
  }
  const card = (c) => {
    const done = c.progress >= c.need;
    const pct = Math.round((c.progress / c.need) * 100);
    return `<div class="shop-card challenge-card${c.claimed ? ' owned' : done ? ' equipped' : ''}">
      <div class="card-name">${c.kind === 'weekly' ? '<span class="book-tag">weekly</span> ' : ''}${esc(c.text)}</div>
      <div class="ch-bar"><i style="width:${pct}%"></i></div>
      <small class="card-spec">${c.progress} / ${c.need} · ${timeLeft(c.kind)}</small>
      <div class="card-foot"><span class="card-price">${c.reward} credits</span>
        <button data-claim="${esc(c.id)}" ${!done || c.claimed ? 'disabled' : ''}>${c.claimed ? 'Claimed' : done ? 'Claim' : 'In progress'}</button></div>
    </div>`;
  };
  container.innerHTML = `<button class="panel-close" data-close="log">Close</button>
    <h3>Challenges</h3>
    <p class="tackle-blurb">New every day at midnight, and a bigger one every Monday — the same for every angler.${online ? '' : ' Playing as a guest: progress is kept on this device.'}</p>
    <div class="shop-grid">${list.map(card).join('')}</div>`;
  container.querySelectorAll('[data-claim]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    const c = list.find((x) => x.id === btn.dataset.claim);
    try {
      if (online) {
        const r = await cloud.claimChallenge(c.id);
        save.credits = r.credits;
      } else {
        save.credits += c.reward;
        writeClaims([...readClaims(), c.id]);
      }
      saveSave(save);
      onCredits();
      renderChallenges(container, { save, cloud, onCredits, saveSave });
    } catch (err) {
      btn.textContent = err.message;
    }
  }));
}

// ── Competitions ──
export async function renderCompetitions(container, { cloud }) {
  const head = '<button class="panel-close" data-close="log">Close</button><h3>Monthly competitions</h3>';
  const prizes = compPrizes();
  if (!cloud?.user?.()) {
    container.innerHTML = `${head}<p class="tackle-blurb">Every month, two competitions for the heaviest fish — 1st ${prizes[0]}, 2nd ${prizes[1]}, 3rd ${prizes[2]} credits and a trophy by your name.<br><br>Log in or sign up (free, under Account) to enter.</p>`;
    return;
  }
  container.innerHTML = `${head}<p class="muted-note">Loading…</p>`;
  let s;
  try { s = await cloud.competitions(); } catch (err) {
    container.innerHTML = `${head}<p class="tackle-blurb">Couldn't load the competitions: ${esc(err.message)}</p>`;
    return;
  }
  const name = (r) => `${esc(r.username)}${r.wins ? ` <span class="trophy" title="${r.wins} competition win${r.wins > 1 ? 's' : ''}">🏆${r.wins > 1 ? `×${r.wins}` : ''}</span>` : ''}`;
  const board = (c) => `<section class="comp">
      <h4>${esc(c.title)}</h4>
      <p class="muted-note">${c.entrants} angler${c.entrants === 1 ? '' : 's'} · prizes ${s.prizes.join(' / ')} credits${c.me ? ` · <b>you're ${ordinal(c.me.rank)} with ${kg(c.me.weightKg)}</b>` : ' · you haven’t entered yet — just catch one'}</p>
      ${c.top.length ? `<div class="table-wrap"><table class="comp-table"><thead><tr><th>#</th><th>Angler</th><th>Fish</th></tr></thead><tbody>
        ${c.top.map((r) => `<tr${c.me && r.rank === c.me.rank ? ' class="me"' : ''}><td>${r.rank}</td><td>${name(r)}</td><td>${kg(r.weightKg)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted-note">Nobody yet — the first fish leads.</p>'}
    </section>`;
  const winners = s.last.filter((c) => c.winners.length).map((c) => `<p class="muted-note"><b>${esc(c.title.replace('this month', 'last month'))}:</b> ${c.winners.map((w) => `${['🥇', '🥈', '🥉'][w.rank - 1]} ${esc(w.username)} ${kg(w.weightKg)}`).join(' · ')}</p>`).join('');
  container.innerHTML = `${head}
    <p class="tackle-blurb">The heaviest fish of the month wins. Prizes are paid when the month ends (South African time).</p>
    ${s.current.map(board).join('')}
    ${winners ? `<h4>Last month's winners</h4>${winners}` : ''}`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
