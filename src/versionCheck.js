// Keeps an open game on the latest version. index.html loaded a version
// (window.__BUILD__); this re-reads version.json every couple of minutes and
// whenever the tab comes back into view (a phone unlocked, an app switched
// back to) and calls onNewVersion when a newer one has been published.

const CHECK_EVERY_MS = 2 * 60 * 1000;

export function currentBuild() {
  return window.__BUILD__ || { version: 'dev' };
}

// "?v=<version>" for asset URLs (fish pictures), so a replaced picture
// shows fresh everywhere too; empty in development.
export function assetTag() {
  const v = currentBuild().version;
  return v && v !== 'dev' ? `?v=${v}` : '';
}

// A short label for the title screen: "v8f0211e · 27 Sep 2026".
export function buildLabel() {
  const b = currentBuild();
  if (b.version === 'dev') return 'development build';
  const when = b.built ? new Date(b.built).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `v${b.version.slice(0, 7)}${when ? ` · ${when}` : ''}`;
}

export function startVersionWatch(onNewVersion) {
  const loaded = currentBuild().version;
  if (loaded === 'dev') return () => {};
  let notified = false;
  let lastCheck = 0;

  async function check() {
    if (notified) return;
    lastCheck = Date.now();
    try {
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = await res.json();
      if (latest.version && latest.version !== loaded) {
        notified = true;
        onNewVersion(latest);
      }
    } catch { /* offline for a moment -- try again later */ }
  }

  const timer = setInterval(check, CHECK_EVERY_MS);
  // Coming back to the game (tab shown again, window focused): check now.
  const onVisible = (e) => {
    const back = e.type === 'focus' || document.visibilityState === 'visible';
    if (back && Date.now() - lastCheck > 10000) check();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  setTimeout(check, 5000);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}

// Reload onto the new version.
export function reloadToLatest() {
  window.location.reload();
}
