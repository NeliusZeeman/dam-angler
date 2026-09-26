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
  catchLog: {},
  settings: {
    quality: 'auto', // 'auto' (low on phones/small tablets) | 'high' | 'low'
    showHints: true, // the controls reminder along the top bar
    turnSpeed: 1, // multiplier on Q/E, edge-of-screen and right-drag turning
  },
};

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings } };
  try {
    const parsed = JSON.parse(raw);
    // Settings are merged key by key so saves from before a setting existed
    // still get its default.
    return { ...DEFAULT_SAVE, ...parsed, settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) } };
  } catch {
    return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings } };
  }
}

export function saveSave(saveObject) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveObject));
}
