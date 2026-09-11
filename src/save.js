const SAVE_KEY = 'pond-fishing-save';

export const DEFAULT_SAVE = {
  credits: 0,
  ownedRodIds: ['rod-starter'],
  ownedLineIds: ['line-starter'],
  ownedLureIds: ['bread-bait'],
  equippedRodId: 'rod-starter',
  equippedLineId: 'line-starter',
  equippedLureId: 'bread-bait',
  catchLog: {},
};

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...parsed };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveSave(saveObject) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveObject));
}
