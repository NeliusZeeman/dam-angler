// The game fetching its tuning on start: the published values for everyone,
// or -- for a logged-in admin opening the game with ?tuning=draft -- the
// draft, to try it before publishing. No server (plain files, offline) means
// the built-in values, as always.
import { applyTuning } from './apply.js';

async function fetchValues(url) {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: globalThis.AbortSignal?.timeout?.(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data.values === 'object' ? data : null;
  } catch {
    return null;
  }
}

export async function loadGameTuning({ wantPreview = false } = {}) {
  if (wantPreview) {
    const draft = await fetchValues('/api/admin/tuning/draft');
    if (draft) {
      applyTuning(draft.values);
      return { preview: true, version: 'draft' };
    }
  }
  const published = await fetchValues('/api/tuning');
  if (published) applyTuning(published.values);
  return { preview: false, version: published?.version ?? 0 };
}
