import assert from 'node:assert';

globalThis.localStorage = {
  _data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
};

const { loadSave, saveSave, DEFAULT_SAVE } = await import('../src/save.js');

{
  localStorage.removeItem('pond-fishing-save');
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, DEFAULT_SAVE.credits);
  assert.deepStrictEqual(loaded.ownedRodIds, DEFAULT_SAVE.ownedRodIds);
  console.log('PASS: loadSave returns defaults when nothing stored');
}

{
  const custom = { ...DEFAULT_SAVE, credits: 999, equippedRodId: 'rod-pro' };
  saveSave(custom);
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, 999);
  assert.strictEqual(loaded.equippedRodId, 'rod-pro');
  console.log('PASS: saveSave/loadSave round-trip preserves data');
}

{
  localStorage.setItem('pond-fishing-save', 'not valid json{{{');
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, DEFAULT_SAVE.credits);
  console.log('PASS: loadSave falls back to defaults on corrupted data');
}

{
  // An older save with no settings block still gets every default, and a
  // save with only some settings keeps them and fills in the rest.
  localStorage.setItem('pond-fishing-save', JSON.stringify({ credits: 5 }));
  assert.deepStrictEqual(loadSave().settings, DEFAULT_SAVE.settings);
  localStorage.setItem('pond-fishing-save', JSON.stringify({ credits: 5, settings: { quality: 'low' } }));
  const loaded = loadSave();
  assert.strictEqual(loaded.settings.quality, 'low');
  assert.strictEqual(loaded.settings.showHints, DEFAULT_SAVE.settings.showHints);
  console.log('PASS: settings merge over defaults for old and partial saves');
}

console.log('All save tests passed.');
