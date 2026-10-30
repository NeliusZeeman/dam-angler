import { STARTER_ITEMS } from './gear.js';

const SAVE_KEY = 'pond-fishing-save';

export const DEFAULT_SAVE = {
  locationId: null,
  startTimeOfDay: null,
  credits: 0,
  // The free starter kits (gear.js STARTER_KITS): general, bass, carp, fly
  // and barbel & tiger.
  ownedRodIds: [...STARTER_ITEMS.rod],
  ownedLineIds: [...STARTER_ITEMS.line],
  ownedReelIds: [...STARTER_ITEMS.reel],
  ownedHookIds: [...STARTER_ITEMS.hook],
  ownedLureIds: [...STARTER_ITEMS.lure],
  ownedGadgetIds: [], // fish finders: owning one is using it
  equippedRodId: 'rod-starter',
  equippedLineId: 'line-starter',
  equippedReelId: 'reel-starter',
  equippedHookId: 'hook-small',
  equippedLureId: 'bread-bait',
  drag: 0.33, // reel drag, share of the line's breaking strain (a third is the rule of thumb)
  catchLog: {},
  settings: {
    quality: 'auto', // 'auto' (low on phones/small tablets) | 'ultraplus' (WebGPU) | 'ultra' | 'high' | 'medium' | 'low'
    showHints: true, // the controls reminder along the top bar
    turnSpeed: 1, // multiplier on Q/E, edge-of-screen and right-drag turning
    volume: 0.7, // 0 = sound off .. 1 = loud
    floatDepth: 1.5, // metres from the float down to the bait
  },
};

const OWNED_FIELDS = { rod: 'ownedRodIds', line: 'ownedLineIds', reel: 'ownedReelIds', hook: 'ownedHookIds', lure: 'ownedLureIds' };

// Settings are merged key by key so saves from before a setting existed
// still get its default, and saves from before the starter kits get them.
export function normalizeSave(raw = {}) {
  const save = { ...DEFAULT_SAVE, ...raw, settings: { ...DEFAULT_SAVE.settings, ...(raw.settings || {}) } };
  for (const [kind, field] of Object.entries(OWNED_FIELDS)) {
    const owned = Array.isArray(save[field]) ? save[field] : [];
    save[field] = [...owned, ...STARTER_ITEMS[kind].filter((id) => !owned.includes(id))];
  }
  return save;
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
