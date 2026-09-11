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

console.log('All save tests passed.');
