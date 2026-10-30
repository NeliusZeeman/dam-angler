import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

// Installing as an app: the manifest's icons are there, the page links the
// manifest and the iPhone icon, and the offline copy never keeps /api/.
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
assert.strictEqual(manifest.name, 'Dam Angler');
for (const icon of manifest.icons) assert.ok(existsSync(icon.src), icon.src);
assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'maskable icon');
const page = readFileSync('index.html', 'utf8');
assert.ok(page.includes('rel="manifest"') && page.includes('apple-touch-icon'), 'page links manifest and iPhone icon');
assert.ok(existsSync('assets/icons/apple-touch-icon.png'), 'iPhone icon');
const sw = readFileSync('sw.js', 'utf8');
assert.ok(/startsWith\('api\/'\)/.test(sw), 'sw.js leaves the server calls alone');

console.log('install ok');
