const SAVE_KEY = 'pond-fishing-save';

export const DEFAULT_SAVE = {
  locationId: null,
  startTimeOfDay: null,
  credits: 0,
  ownedRodIds: ['rod-starter'],
  ownedLineIds: ['line-starter'],
  ownedReelIds: ['reel-starter'],
  ownedHookIds: ['hook-small'],
  ownedLureIds: ['bread-bait'],
  equippedRodId: 'rod-starter',
  equippedLineId: 'line-starter',
  equippedReelId: 'reel-starter',
  equippedHookId: 'hook-small',
  equippedLureId: 'bread-bait',
  drag: 0.33, // reel drag, share of the line's breaking strain (a third is the rule of thumb)
  catchLog: {},
  settings: {
    quality: 'auto', // 'auto' (low on phones/small tablets) | 'high' | 'low'
    showHints: true, // the controls reminder along the top bar
    turnSpeed: 1, // multiplier on Q/E, edge-of-screen and right-drag turning
    volume: 0.7, // 0 = sound off .. 1 = loud
  },
};

// Settings are merged key by key so saves from before a setting existed
// still get its default.
export function normalizeSave(raw = {}) {
  return { ...DEFAULT_SAVE, ...raw, settings: { ...DEFAULT_SAVE.settings, ...(raw.settings || {}) } };
}

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return normalizeSave();
  try {
    return normalizeSave(JSON.parse(raw));
  } catch {
    return normalizeSave();
  }
}

// Anything that wants to know about every save (the online sync does).
const saveListeners = new Set();
export function onSave(fn) {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

// `quiet` saves only on this device (used when the save came from the server).
export function saveSave(saveObject, { quiet = false } = {}) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveObject));
  if (!quiet) saveListeners.forEach((fn) => fn(saveObject));
}

// Swaps the contents of the live save object (everything holds a reference
// to it) for another save, e.g. the one from your account.
export function replaceSave(target, next) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, normalizeSave(JSON.parse(JSON.stringify(next || {}))));
  saveSave(target, { quiet: true });
  return target;
}
