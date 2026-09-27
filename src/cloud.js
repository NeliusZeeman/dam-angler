// Online accounts and saves. The game keeps saving to the browser exactly as
// before; when you're logged in, every save and every catch is also sent to
// the server so your phone, tablet and PC share one game.
//
// Nothing is lost offline: what hasn't reached the server waits in a queue in
// the browser and goes the moment the connection is back. Catches carry
// their own id, so resending one never counts it twice.

const QUEUE_KEY = 'da-cloud-queue'; // { save, catches: [] } waiting to be sent
const USER_KEY = 'da-cloud-user'; // { username, version } of whoever is logged in here
const GUEST_CATCHES_KEY = 'da-guest-catches'; // catches made as a guest, carried into a new account
const SAVE_DELAY_MS = 2000; // batch saves: at most one call every 2 s
const RETRY_MS = 30000;
const MAX_GUEST_CATCHES = 500;

const GEAR_LISTS = ['ownedRodIds', 'ownedLineIds', 'ownedReelIds', 'ownedHookIds', 'ownedLureIds'];

// Another device saved first: take its save, but keep any gear either side
// owns (a purchase is never undone).
export function mergeOnConflict(local, server) {
  const merged = { ...server, settings: { ...(server.settings || {}) } };
  for (const f of GEAR_LISTS) merged[f] = [...new Set([...(server[f] || []), ...(local?.[f] || [])])];
  return merged;
}

const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export function createCloud({
  fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, base = '/api',
  onSaveReplaced = () => {}, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t),
} = {}) {
  const read = (key, fallback) => { try { const v = storage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { value == null ? storage.removeItem(key) : storage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };

  let user = read(USER_KEY, null); // { username, version }
  let queue = read(QUEUE_KEY, { save: null, catches: [] });
  let serverUp = null; // null = not checked yet
  let status = user ? 'synced' : 'guest';
  let timer = null;
  let flushing = null;
  let damCache = null;
  const listeners = new Set();

  const setStatus = (s) => { if (s !== status) { status = s; listeners.forEach((fn) => fn(s)); } };
  const setUser = (u) => { user = u; write(USER_KEY, u); };
  const saveQueue = () => write(QUEUE_KEY, queue);
  const pending = () => !!queue.save || queue.catches.length > 0;

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

  // Sends whatever is waiting: catches first, then the latest save.
  function flush() {
    if (!user || flushing) return flushing || Promise.resolve();
    flushing = (async () => {
      try {
        if (!pending()) { setStatus('synced'); return; }
        setStatus('saving');
        while (queue.catches.length) {
          const r = await call('POST', '/me/catches', queue.catches[0]);
          if (r.status === 401) { setStatus('loggedOut'); return; }
          if (r.status >= 500) throw new Error('server');
          queue.catches.shift(); // stored, or refused as invalid: either way it's done
          saveQueue();
        }
        let tries = 0;
        while (queue.save && tries++ < 3) {
          const sent = queue.save;
          const r = await call('PUT', '/me/save', { save: sent, baseVersion: user.version });
          if (r.status === 401) { setStatus('loggedOut'); return; }
          if (r.status === 409) {
            // Another device saved first: merge, show the merged save, send it.
            const merged = mergeOnConflict(sent, r.data.save);
            setUser({ ...user, version: r.data.version });
            queue.save = merged;
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
    queue = { save: null, catches: [] };
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
      queue = { save: null, catches: [] };
      saveQueue();
      setStatus('guest');
    },

    async deleteAccount(password) {
      const r = await call('DELETE', '/me', { password });
      if (r.status !== 200) throw fail(r);
      setUser(null);
      queue = { save: null, catches: [] };
      saveQueue();
      setStatus('guest');
    },

    // Called after every local save.
    queueSave(save) {
      if (!user) return;
      const { catchLog, ...rest } = save; // the server builds the catch log from catches
      queue.save = JSON.parse(JSON.stringify(rest));
      saveQueue();
      if (status !== 'offline') setStatus('saving');
      schedule();
    },

    // Called for every fish landed. Returns the catch with its id.
    queueCatch(c) {
      const entry = { id: uuid(), caughtAt: new Date().toISOString(), ...c };
      if (user) {
        queue.catches.push(entry);
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
