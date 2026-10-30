// A small local server for tools/gear-export.html: serves the game's files
// and saves the 3D models the page sends back into art-source/gear/, for
// Blender to render (tools/build-gear-pictures.mjs runs all of it).
//
//   node tools/gear-export-server.mjs   (then open http://localhost:5191/tools/gear-export.html)

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'art-source', 'gear');
const PORT = Number(process.env.PORT || 5191);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && url.pathname.startsWith('/save/')) {
      const name = url.pathname.slice(6);
      if (!/^[a-z0-9-]+\.glb$/.test(name)) { res.writeHead(400).end('bad name'); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await mkdir(out, { recursive: true });
      await writeFile(join(out, name), Buffer.concat(chunks));
      res.writeHead(200).end('ok');
      return;
    }
    if (req.method === 'POST' && url.pathname === '/done') {
      res.writeHead(200).end('ok');
      console.log('EXPORT DONE');
      return;
    }
    const path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`gear export server on http://localhost:${PORT}/tools/gear-export.html`));
