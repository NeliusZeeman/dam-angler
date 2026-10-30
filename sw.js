// The installed app's own copy of the game (a service worker). Game files
// are kept on the device so it starts fast and the dams load without the
// internet; only the online parts -- saves, catches, the shop, records --
// go to the server (/api/, never kept).
//
//   - the page, version.json and anything without a version tag (icons):
//     fresh from the internet when there is one, the kept copy when there
//     isn't;
//   - everything else (code, pictures, models): the kept copy first. Each
//     release asks for new addresses (?v=<version>, see index.html), so a
//     kept copy is never out of date; the old one is dropped when the new
//     one comes in.
//
// On install it keeps the code and the title screen's files straight away;
// each dam's pictures and models are kept the first time you fish there.

const CACHE = 'dam-angler';
const SHELL = ['./', 'manifest.json', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((u) => cache.add(u)));
    // The game code for the current release.
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      const build = await res.clone().json();
      await cache.put('version.json', res);
      const tag = build.version && build.version !== 'dev' ? `?v=${build.version}` : '';
      const files = [...(build.modules || []), 'src/style.css'].map((m) => m + tag);
      // A few at a time: a phone on mobile data shouldn't open 90 at once.
      for (let i = 0; i < files.length; i += 8) {
        await Promise.allSettled(files.slice(i, i + 8).map((u) => cache.add(u)));
      }
    } catch { /* offline: kept as they're used */ }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (path.startsWith('api/') || path.startsWith('admin')) return;
  if (req.mode === 'navigate' || path === '' || path === 'index.html') {
    event.respondWith(fresh(req, './'));
  } else if (path === 'version.json') {
    event.respondWith(fresh(req, 'version.json'));
  } else if (!url.search) {
    // No version tag (the icons, this list): it could change in place.
    event.respondWith(fresh(req, req));
  } else {
    event.respondWith(kept(req, url));
  }
});

// The internet's copy (and keep it), or the kept one when offline.
async function fresh(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

// The kept copy, or fetch and keep it -- dropping the older release's copy
// of the same file.
async function kept(req, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    await cache.put(req, res.clone());
    for (const old of await cache.keys(url.pathname, { ignoreSearch: true })) {
      if (old.url !== req.url) await cache.delete(old);
    }
  }
  return res;
}
