// Installing the game as an app: the home-screen icon (manifest.json) and
// the copy of the game kept on the device (sw.js).
//
// Chrome, Edge and Android offer an install prompt the title screen's
// "Install as app" button can open. iPhone and iPad have no such prompt --
// Safari only installs from Share > Add to Home Screen -- so there the
// button shows those steps instead. Once installed the button is gone.

import { currentBuild } from './versionCheck.js';

let prompt = null; // the browser's install prompt, kept until asked for
let onChange = () => {};

// Listening from the moment the game's code loads: the browser makes its
// offer early, sometimes before the title screen is up.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  prompt = e;
  onChange();
});
window.addEventListener('appinstalled', () => {
  prompt = null;
  onChange();
});

export function keepOffline() {
  // Keep the game on the device (not for the untagged development build,
  // whose files never change address).
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local) && currentBuild().version !== 'dev') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline copy not set up:', err?.message || err));
  }
}

// Running as the installed app (from the home screen icon).
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches
  || window.matchMedia?.('(display-mode: fullscreen)').matches
  || navigator.standalone === true;

const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad asking for the desktop site

// 'prompt' (the browser can install it), 'ios' (show the Share steps), or
// null (installed already, or this browser can't).
export function installMode() {
  if (isInstalled()) return null;
  if (prompt) return 'prompt';
  if (isApple()) return 'ios';
  return null;
}

export async function promptInstall() {
  if (!prompt) return false;
  const p = prompt;
  prompt = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  onChange();
  return outcome === 'accepted';
}

export function onInstallChange(fn) { onChange = fn; }
