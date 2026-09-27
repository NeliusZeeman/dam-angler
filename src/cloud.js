// Online accounts and saves. The game keeps saving to the browser exactly as
// before; when you're logged in, every save, catch, purchase and handful of
// breadcrumbs is also sent to the server so your phone, tablet and PC share
// one game. The server keeps the books: the credits it reports back are the
// real balance.
//
// Nothing is lost offline: what hasn't reached the server waits in a queue in
// the browser, in order, and goes the moment the connection is back. Catches
// carry their own id, so resending one never counts it twice.

const QUEUE_KEY = 'da-cloud-queue'; // { save, events: [] } waiting to be sent
const USER_KEY = 'da-cloud-user'; // { username, version } of whoever is logged in here
const GUEST_CATCHES_KEY = 'da-guest-catches'; // catches made as a guest, carried into a new account
const SAVE_DELAY_MS = 2000; // batch saves: at most one call every 2 s
const RETRY_MS = 30000;
const MAX_GUEST_CATCHES = 500;


// Another device saved first: credits and gear are the server's (it keeps
// the books); what's rigged, the drag, the spot and the settings are this
// device's, and get sent again.
const LOCAL_FIELDS = ['equippedRodId', 'equippedLineId', 'equippedReelId', 'equippedHookId', 'equippedLureId', 'drag', 'locationId', 'startTimeOfDay', 'settings'];
export function mergeOnConflict(local, server) {
  const merged = { ...server };
  for (const f of LOCAL_FIELDS) if (local && local[f] !== undefined) merged[f] = local[f];
  // Only rig what the server says you own.
  const kinds = { equippedRodId: 'ownedRodIds', equippedLineId: 'ownedLineIds', equippedReelId: 'ownedReelIds', equippedHookId: 'ownedHookIds', equippedLureId: 'ownedLureIds' };
  for (const [eq, owned] of Object.entries(kinds)) if (!(server[owned] || []).includes(merged[eq])) merged[eq] = server[eq];
  return merged;
}

export const newCatchId = () => uuid();

// What a save sends: never credits, gear or the catch log -- the server keeps
// those itself.
function saveForServer(save) {
  // eslint-disable-next-line no-unused-vars
  const { catchLog, credits, ownedRodIds, ownedLineIds, ownedReelIds, ownedHookIds, ownedLureIds, ...rest } = save || {};
  return JSON.parse(JSON.stringify(rest));
}

// What each queued event sends.
const EVENT_CALLS = {
  catch: (e) => ['/me/catches', e.data],
  buy: (e) => ['/me/buy', { kind: e.kind, itemId: e.itemId }],
  spend: (e) => ['/me/spend', { what: e.what }],
};

const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export function createCloud({
  fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, base = '/api',
  onSaveReplaced = () => {}, onCredits = () => {},
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t),
} = {}) {
  const read = (key, fallback) => { try { const v = storage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { value == null ? storage.removeItem(key) : storage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };

  let user = read(USER_KEY, null); // { username, version }
  let queue = read(QUEUE_KEY, { save: null, events: [] });
  // A queue saved by the older version (catches only).
  if (!Array.isArray(queue.events)) queue = { save: queue.save || null, events: (queue.catches || []).map((data) => ({ type: 'catch', data })) };
  let serverUp = null; // null = not checked yet
  let status = user ? 'synced' : 'guest';
  let timer = null;
  let flushing = null;
  let damCache = null;
  const listeners = new Set();

  const setStatus = (s) => { if (s !== status) { status = s; listeners.forEach((fn) => fn(s)); } };
  const setUser = (u) => { user = u; write(USER_KEY, u); };
  const saveQueue = () => write(QUEUE_KEY, queue);
  const pending = () => !!queue.save || queue.events.length > 0;

  async function call(method, path, body) {
    const res = await fetchImpl(base + path, {
      method, credentials: 'same-origin', signal: globalThis.AbortSignal?.timeout?.(10000),
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
  }
  const fail = (r) => { const e = new Error(r.data?.error || 'Something went wrong. Please try again.'); e.status = r.status; return e; };

  function schedule(ms = SAVE_DELAY_MS) {
    if (timer) return;
    timer = setTimer(() => { timer = null; flush(); }, ms);
  }

  // Sends whatever is waiting: catches, purchases and breadcrumbs in the
  // order they happened, then the latest save. Then the game shows the
  // server's balance -- and if the server refused a purchase (not enough
  // credits there), the server's gear and credits replace this device's.
  function flush() {
    if (!user || flushing) return flushing || Promise.resolve();
    flushing = (async () => {
      try {
        if (!pending()) { setStatus('synced'); return; }
        setStatus('saving');
        let credits = null;
        let refused = false;
        while (queue.events.length) {
          const ev = queue.events[0];
          const [path, payload] = (EVENT_CALLS[ev.type] || EVENT_CALLS.catch)(ev);
          const r = await call('POST', path, payload);
          if (r.status === 401) { setStatus('loggedOut'); return; }
          if (r.status === 429 || r.status >= 500) throw new Error('server');
          if (r.status >= 400 && ev.type !== 'catch') refused = true;
          if (Number.isFinite(r.data?.credits)) credits = r.data.credits;
          queue.events.shift(); // done, or refused: either way it's handled
          saveQueue();
        }
        if (refused) {
          const me = await call('GET', '/me');
          if (me.status === 200) {
            const local = queue.save || {};
            setUser({ ...user, version: me.data.version });
            const merged = mergeOnConflict(local, me.data.save);
            if (queue.save) queue.save = saveForServer(merged); // still send this device's rig
            saveQueue();
            onSaveReplaced(merged);
            credits = null;
          }
        }
        if (credits !== null) onCredits(credits);
        let tries = 0;
        while (queue.save && tries++ < 3) {
          const sent = queue.save;
          const r = await call('PUT', '/me/save', { save: sent, baseVersion: user.version });
          if (r.status === 401) { setStatus('loggedOut'); return; }
          if (r.status === 409) {
            // Another device saved first: merge, show the merged save, send it.
            const merged = mergeOnConflict(sent, r.data.save);
            setUser({ ...user, version: r.data.version });
            queue.save = saveForServer(merged);
            saveQueue();
            onSaveReplaced(merged);
            continue;
          }
          if (r.status >= 500) throw new Error('server');
          if (r.status === 200) setUser({ ...user, version: r.data.version });
          if (queue.save === sent) queue.save = null;
          saveQueue();
        }
        setStatus(pending() ? 'offline' : 'synced');
      } catch {
        // Offline or the server is down: keep everything and try again later.
        setStatus('offline');
        schedule(RETRY_MS);
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  if (typeof window !== 'undefined') window.addEventListener?.('online', () => flush());

  function loggedIn(data) {
    setUser({ username: data.user.username, version: data.version });
    queue = { save: null, events: [] };
    saveQueue();
    setStatus('synced');
    return data;
  }

  return {
    // Is there a Dam Angler server behind this page? (Not when the game is
    // opened as plain files, or on a host without the API.)
    async available() {
      if (serverUp !== null) return serverUp;
      try { serverUp = (await call('GET', '/health')).status === 200; } catch { serverUp = false; }
      return serverUp;
    },
    user: () => user,
    status: () => status,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // On start: the logged-in player's save from the server, or null (guest,
    // logged out, or offline -- then the save on this device is used).
    async init() {
      if (!user) return null;
      try {
        const r = await call('GET', '/me');
        if (r.status === 401) { setUser(null); setStatus('guest'); return { loggedOut: true }; }
        if (r.status !== 200) throw new Error('server');
        // Something from this device never reached the server? Send it
        // first, then take the server's (now complete) save.
        if (pending()) {
          setUser({ ...user, version: r.data.version });
          await flush();
          if (!pending()) {
            const again = await call('GET', '/me');
            if (again.status === 200) { setUser({ username: again.data.user.username, version: again.data.version }); return again.data; }
          }
          return null;
        }
        setUser({ username: r.data.user.username, version: r.data.version });
        setStatus('synced');
        return r.data;
      } catch {
        setStatus('offline');
        schedule(RETRY_MS);
        return null;
      }
    },

    async signup({ email, username, password, agree }, guestSave) {
      const r = await call('POST', '/auth/signup', { email, username, password, agree, guestSave, guestCatches: read(GUEST_CATCHES_KEY, []) });
      if (r.status !== 201) throw fail(r);
      write(GUEST_CATCHES_KEY, null);
      return loggedIn(r.data);
    },

    async login(login, password) {
      const r = await call('POST', '/auth/login', { login, password });
      if (r.status !== 200) throw fail(r);
      return loggedIn(r.data);
    },

    async logout() {
      await flush();
      try { await call('POST', '/auth/logout'); } catch { /* offline: the cookie still gets dropped below */ }
      setUser(null);
      queue = { save: null, events: [] };
      saveQueue();
      setStatus('guest');
    },

    async deleteAccount(password) {
      const r = await call('DELETE', '/me', { password });
      if (r.status !== 200) throw fail(r);
      setUser(null);
      queue = { save: null, events: [] };
      saveQueue();
      setStatus('guest');
    },

    // Called after every local save.
    queueSave(save) {
      if (!user) return;
      queue.save = saveForServer(save);
      saveQueue();
      if (status !== 'offline') setStatus('saving');
      schedule();
    },

    // A purchase from the tackle box, and breadcrumbs thrown.
    queueBuy(kind, itemId) {
      if (!user) return;
      queue.events.push({ type: 'buy', kind, itemId });
      saveQueue();
      schedule(0);
    },
    queueSpend(what) {
      if (!user) return;
      queue.events.push({ type: 'spend', what });
      saveQueue();
      schedule(0);
    },

    // Called for every fish landed. Returns the catch with its id.
    queueCatch(c) {
      const entry = { id: uuid(), caughtAt: new Date().toISOString(), ...c };
      if (user) {
        queue.events.push({ type: 'catch', data: entry });
        saveQueue();
        schedule(0);
      } else {
        const list = read(GUEST_CATCHES_KEY, []);
        list.push(entry);
        write(GUEST_CATCHES_KEY, list.slice(-MAX_GUEST_CATCHES));
      }
      if (damCache?.data?.dams) {
        // Keep the local copy of the dam's stats up to date straight away.
        const d = damCache.data.dams[c.locationId] || (damCache.data.dams[c.locationId] = { total: 0, record: null });
        d.total += 1;
        if (user && (!d.record || c.weightKg > d.record.weightKg)) {
          d.record = { speciesId: c.speciesId, weightKg: c.weightKg, username: user.username, caughtAt: entry.caughtAt };
        }
      }
      return entry;
    },

    flush,

    // Public stats for every dam, fetched at most once a minute.
    async damStats() {
      if (damCache && Date.now() - damCache.at < 60000) return damCache.data;
      try {
        const r = await call('GET', '/dams/stats');
        if (r.status === 200) damCache = { at: Date.now(), data: r.data };
      } catch { /* offline: keep what we had */ }
      return damCache?.data || null;
    },
    cachedDamStats: () => damCache?.data || null,
  };
}
