import * as THREE from '../../vendor/three.module.js';
import { fbm, hash2i, makeRng, smoothstep, lerp, valueNoise } from './noise.js';

// Every surface in the scene is generated here, pixel by pixel -- no image
// files. Opaque textures come from a per-pixel function; cut-out textures
// (leaves, lily pads) are drawn and then converted to a DataTexture so the
// colour under transparent pixels can be filled in, which keeps mipmapped
// edges from going dark at a distance.

function pixelCanvas(width, height, fn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const d = img.data;
  const out = [0, 0, 0, 255];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[3] = 255;
      fn(x, y, out);
      const i = (y * width + x) * 4;
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toTexture(canvas, { repeat = true, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 8;
  return tex;
}

// RGBA bytes (top row first) -> DataTexture, flipped to match UV v=0 at the
// bottom, with transparent texels recoloured to the average opaque colour.
function rgbaToAlphaTexture(data, width, height) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; }
  }
  const avg = n ? [sr / n, sg / n, sb / n] : [100, 120, 80];
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((height - 1 - y) * width + x) * 4;
      const a = data[src + 3];
      const t = a / 255;
      out[dst] = lerp(avg[0], data[src], t);
      out[dst + 1] = lerp(avg[1], data[src + 1], t);
      out[dst + 2] = lerp(avg[2], data[src + 2], t);
      out[dst + 3] = a;
    }
  }
  const tex = new THREE.DataTexture(out, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function canvasToAlphaTexture(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return rgbaToAlphaTexture(img.data, canvas.width, canvas.height);
}

function pixelAlphaTexture(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4);
  const out = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[3] = 0;
      fn(x, y, out);
      const i = (y * width + x) * 4;
      data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2]; data[i + 3] = out[3];
    }
  }
  return rgbaToAlphaTexture(data, width, height);
}

function blankCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// ─── Ground ─────────────────────────────────────────────────────────────────

// Highveld grass: green with drier straw patches, bare-soil specks and the
// odd tiny yellow flower, then a layer of individual blade strokes.
export function grassGroundTexture() {
  const S = 512;
  const canvas = pixelCanvas(S, S, (x, y, out) => {
    const u = x / S, v = y / S;
    const n = fbm(u * 8, v * 8, { octaves: 5, period: 8, seed: 11 });
    const dry = smoothstep(0.52, 0.74, fbm(u * 4, v * 4, { octaves: 3, period: 4, seed: 23 }));
    const k = 0.86 + hash2i(x, y, 5) * 0.28;
    let r = lerp(44, 96, n), g = lerp(70, 128, n), b = lerp(28, 52, n);
    r = lerp(r, 150, dry * 0.55); g = lerp(g, 132, dry * 0.55); b = lerp(b, 70, dry * 0.55);
    r *= k; g *= k; b *= k;
    const speck = hash2i(x, y, 91);
    if (speck > 0.993) { r = 84; g = 66; b = 44; }
    else if (speck < 0.002) { r = 232; g = 214; b = 96; }
    out[0] = r; out[1] = g; out[2] = b;
  });
  const ctx = canvas.getContext('2d');
  const rng = makeRng(7);
  ctx.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = rng() * S, y = rng() * S, len = 3 + rng() * 7, lean = (rng() - 0.5) * 3;
    const l = rng();
    ctx.strokeStyle = `rgba(${Math.round(58 + l * 90)},${Math.round(92 + l * 80)},${Math.round(34 + l * 30)},0.55)`;
    // Draw wrapped copies near the border so the texture still tiles.
    for (const ox of [0, -S, S]) {
      for (const oy of [0, -S, S]) {
        if ((ox && x > 12 && x < S - 12) || (oy && y > 12 && y < S - 12)) continue;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + ox + lean, y + oy - len);
        ctx.stroke();
      }
    }
  }
  return toTexture(canvas);
}

// Dam-edge sand: fine grain, wind ripples, and scattered shaded pebbles.
export function sandTexture() {
  const S = 512, CELL = 16, NC = S / CELL;
  const canvas = pixelCanvas(S, S, (x, y, out) => {
    const u = x / S, v = y / S;
    const n = fbm(u * 16, v * 16, { octaves: 4, period: 16, seed: 3 });
    const warp = fbm(u * 6, v * 6, { octaves: 2, period: 6, seed: 8 });
    const ripple = Math.sin(v * Math.PI * 2 * 24 + warp * 9) * 0.5 + 0.5;
    const k = (0.82 + hash2i(x, y, 17) * 0.34) * (0.95 + ripple * 0.08);
    // Earthy Highveld dam sand -- browner and duller than beach sand.
    let r = lerp(136, 180, n) * k, g = lerp(112, 150, n) * k, b = lerp(82, 114, n) * k;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const gx = ((cx + ox) % NC + NC) % NC, gy = ((cy + oy) % NC + NC) % NC;
        if (hash2i(gx, gy, 41) < 0.55) continue;
        const px = (cx + ox) * CELL + hash2i(gx, gy, 42) * CELL;
        const py = (cy + oy) * CELL + hash2i(gx, gy, 43) * CELL;
        const rad = 1.5 + hash2i(gx, gy, 44) * 4.5;
        const dx = x - px, dy = y - py;
        const d = Math.hypot(dx, dy * 1.3);
        if (d < rad) {
          const shade = 1.05 - (dx + dy) / (rad * 3);
          const tone = hash2i(gx, gy, 45);
          const base = tone < 0.5 ? [124, 112, 98] : tone < 0.8 ? [152, 128, 100] : [88, 82, 78];
          r = base[0] * shade; g = base[1] * shade; b = base[2] * shade;
        } else if (d < rad + 1.3) {
          r *= 0.8; g *= 0.8; b *= 0.8;
        }
      }
    }
    out[0] = r; out[1] = g; out[2] = b;
  });
  return toTexture(canvas);
}

// Rod-handle cork: tan granules with dark pits and filler.
export function corkTexture() {
  const W = 128, H = 256;
  const canvas = pixelCanvas(W, H, (x, y, out) => {
    const n = fbm(x / 10, y / 10, { octaves: 3, period: [W / 10, H / 10], seed: 88 });
    const grain = hash2i(x >> 1, y >> 1, 89);
    let r = lerp(168, 214, n), g = lerp(122, 164, n), b = lerp(78, 110, n);
    const k = 0.85 + grain * 0.3;
    r *= k; g *= k; b *= k;
    if (hash2i(x, y, 90) > 0.985 || (n < 0.3 && grain > 0.7)) { r *= 0.45; g *= 0.42; b *= 0.4; }
    out[0] = r; out[1] = g; out[2] = b;
  });
  return toTexture(canvas);
}

// ─── Wood & bark ────────────────────────────────────────────────────────────

// Sun-bleached jetty planks: grain running along u, grey weathering, knots.
export function woodTexture() {
  const W = 512, H = 512;
  const canvas = pixelCanvas(W, H, (x, y, out) => {
    const u = x / W, v = y / H;
    const warp = fbm(u * 3, v * 6, { octaves: 3, period: [3, 6], seed: 2 });
    const rings = Math.sin((v * 34 + warp * 5) * Math.PI * 2) * 0.5 + 0.5;
    const streak = valueNoise(u * 6, v * 200, 5, [6, 200]);
    const weather = smoothstep(0.45, 0.8, fbm(u * 5, v * 5, { octaves: 4, period: 5, seed: 31 }));
    const t = rings * 0.55 + streak * 0.45;
    let r = lerp(92, 150, t), g = lerp(66, 114, t), b = lerp(44, 80, t);
    r = lerp(r, 142, weather * 0.6); g = lerp(g, 132, weather * 0.6); b = lerp(b, 118, weather * 0.6);
    const kx = Math.floor(u * 4), ky = Math.floor(v * 3);
    if (hash2i(kx, ky, 71) > 0.55) {
      const cx = (kx + 0.25 + hash2i(kx, ky, 72) * 0.5) * W / 4;
      const cy = (ky + 0.25 + hash2i(kx, ky, 73) * 0.5) * H / 3;
      const d = Math.hypot((x - cx) / 2.4, y - cy);
      if (d < 10) {
        const ring = 0.55 + 0.25 * Math.sin(d * 1.6);
        r *= ring; g *= ring; b *= ring;
      }
    }
    const k = 0.9 + hash2i(x, y, 9) * 0.2;
    out[0] = r * k; out[1] = g * k; out[2] = b * k;
  });
  return toTexture(canvas);
}

// 'dark' = fissured willow/acacia bark; 'gum' = pale, peeling eucalyptus.
export function barkTexture(kind = 'dark') {
  const W = 256, H = 512;
  const canvas = pixelCanvas(W, H, (x, y, out) => {
    const u = x / W, v = y / H;
    const k = 0.88 + hash2i(x, y, 13) * 0.24;
    if (kind === 'gum') {
      const patch = fbm(u * 4, v * 3, { octaves: 4, period: [4, 3], seed: 61 });
      const streak = valueNoise(u * 24, v * 3, 62, [24, 3]);
      let r = lerp(196, 224, streak), g = lerp(190, 214, streak), b = lerp(176, 198, streak);
      const peel = smoothstep(0.55, 0.62, patch);
      r = lerp(r, 176, peel); g = lerp(g, 138, peel); b = lerp(b, 98, peel);
      const edge = smoothstep(0.53, 0.55, patch) - smoothstep(0.55, 0.57, patch);
      r -= edge * 60; g -= edge * 60; b -= edge * 60;
      out[0] = r * k; out[1] = g * k; out[2] = b * k;
      return;
    }
    const warp = fbm(u * 4, v * 2, { octaves: 3, period: [4, 2], seed: 19 });
    const ridge = 1 - Math.abs(fbm(u * 10 + warp * 2, v * 2.5, { octaves: 4, period: [10, 2.5], seed: 20 }) * 2 - 1);
    const fissure = smoothstep(0.45, 0.85, ridge);
    let r = lerp(40, 112, fissure), g = lerp(32, 92, fissure), b = lerp(26, 72, fissure);
    const lichen = smoothstep(0.66, 0.78, fbm(u * 6, v * 6, { octaves: 3, period: 6, seed: 29 }));
    r = lerp(r, 130, lichen * 0.45); g = lerp(g, 138, lichen * 0.45); b = lerp(b, 96, lichen * 0.45);
    out[0] = r * k; out[1] = g * k; out[2] = b * k;
  });
  return toTexture(canvas);
}

// ─── Foliage (cut-outs) ─────────────────────────────────────────────────────
// Leaves are drawn in light, neutral greens; the material colour tints them
// per season, so one texture serves summer green through autumn gold.

function leafColor(rng, hueMin, hueMax, sat, light) {
  const h = hueMin + rng() * (hueMax - hueMin);
  const s = sat[0] + rng() * (sat[1] - sat[0]);
  const l = light[0] + rng() * (light[1] - light[0]);
  return `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;
}

// A hanging weeping-willow strand: thin stems draped with narrow leaves.
export function willowStrandTexture() {
  const W = 64, H = 512;
  const canvas = blankCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rng = makeRng(101);
  for (let s = 0; s < 3; s++) {
    const x0 = 16 + s * 16 + (rng() - 0.5) * 6;
    const start = rng() * 40;
    const pts = [];
    for (let y = start; y < H - 8; y += 8) pts.push([x0 + Math.sin(y * 0.02 + s) * 4, y]);
    ctx.strokeStyle = 'rgba(96,104,56,1)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const growth = Math.min(1, (py - start) / 120);
      for (const side of [-1, 1]) {
        if (rng() > 0.9) continue;
        ctx.fillStyle = leafColor(rng, 72, 96, [38, 58], [52, 72]);
        ctx.beginPath();
        ctx.ellipse(px + side * 4 * growth, py + 5, 1.7, 7 + growth * 5, side * (0.35 + rng() * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvasToAlphaTexture(canvas);
}

// Umbrella-thorn acacia: fern-like pinnate fronds of tiny leaflets.
export function acaciaLeafTexture() {
  const S = 256;
  const canvas = blankCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const rng = makeRng(202);
  for (let f = 0; f < 34; f++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 78;
    const cx = S / 2 + Math.cos(a) * r, cy = S / 2 + Math.sin(a) * r;
    const dir = rng() * Math.PI * 2;
    const len = 34 + rng() * 34;
    const dx = Math.cos(dir), dy = Math.sin(dir);
    ctx.strokeStyle = 'rgba(92,86,58,1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * len, cy + dy * len);
    ctx.stroke();
    for (let t = 3; t < len; t += 3.2) {
      const px = cx + dx * t, py = cy + dy * t;
      const size = 1 - t / len * 0.5;
      for (const side of [-1, 1]) {
        ctx.fillStyle = leafColor(rng, 78, 100, [30, 48], [44, 64]);
        ctx.beginPath();
        ctx.ellipse(px - dy * side * 3.2 * size, py + dx * side * 3.2 * size, 1.3, 3.6 * size, dir + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvasToAlphaTexture(canvas);
}

// Bluegum: sickle-shaped, grey-blue leaves hanging from thin twigs.
export function gumLeafTexture() {
  const S = 256;
  const canvas = blankCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const rng = makeRng(303);
  for (let t = 0; t < 7; t++) {
    const x0 = 20 + rng() * (S - 40);
    let x = x0, y = rng() * 30;
    ctx.strokeStyle = 'rgba(120,96,70,1)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const nodes = [];
    for (let i = 0; i < 9; i++) {
      x += (rng() - 0.5) * 22;
      y += 18 + rng() * 8;
      ctx.lineTo(x, y);
      nodes.push([x, y]);
    }
    ctx.stroke();
    for (const [nx, ny] of nodes) {
      for (let k = 0; k < 2; k++) {
        const ang = (rng() - 0.5) * 0.9;
        const len = 18 + rng() * 14;
        ctx.fillStyle = leafColor(rng, 140, 175, [12, 26], [48, 66]);
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(7, len * 0.5, 2, len);
        ctx.quadraticCurveTo(-4, len * 0.45, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  return canvasToAlphaTexture(canvas);
}

// Water lily pad: notched disc, radiating veins, a reddish rim and the odd
// sun-yellowed blotch.
export function lilyPadTexture() {
  const S = 256, C = S / 2, R = 120;
  return pixelAlphaTexture(S, S, (x, y, out) => {
    const dx = x - C, dy = y - C;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (d > R + 1) return;
    if (Math.abs(ang) < 0.2 && d > 5) return;
    const n = fbm(x / 40, y / 40, { octaves: 3, seed: 55 });
    let r = lerp(38, 80, n), g = lerp(90, 134, n), b = lerp(36, 56, n);
    const vein = Math.pow(Math.abs(Math.cos(ang * 11)), 70) * smoothstep(8, 30, d);
    r += vein * 22; g += vein * 30; b += vein * 14;
    const blotch = smoothstep(0.68, 0.8, fbm(x / 22, y / 22, { octaves: 3, seed: 56 }));
    r = lerp(r, 168, blotch * 0.7); g = lerp(g, 150, blotch * 0.7); b = lerp(b, 64, blotch * 0.7);
    const rim = smoothstep(R - 8, R - 1, d);
    r = lerp(r, 118, rim * 0.6); g = lerp(g, 64, rim * 0.6); b = lerp(b, 48, rim * 0.6);
    const shine = 1 + (1 - d / R) * 0.12;
    out[0] = Math.min(255, r * shine); out[1] = Math.min(255, g * shine); out[2] = Math.min(255, b * shine);
    out[3] = Math.min(255, Math.max(0, (R - d) * 255));
  });
}

// Soft round glow for fireflies, the lantern and the sun sprite.
export function glowTexture() {
  const S = 128;
  const canvas = blankCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(canvas, { repeat: false });
}

// ─── Fish skins ─────────────────────────────────────────────────────────────
// Mapped onto a lathe body: u runs around the fish (0.75 = back, 0.25 =
// belly, 0/0.5 = flanks), v runs tail (0) to head (1).

// A fin membrane: bony rays running root (v=0) to tip (v=1), thin skin
// between them that pales toward the edge, and a ragged cut-out margin.
// Greyscale so each species tints it with its own fin colour.
export function finRayTexture() {
  const W = 128, H = 64;
  const canvas = pixelCanvas(W, H, (x, y, out) => {
    const u = x / W;
    const v = 1 - y / H;
    const ray = Math.pow(Math.abs(Math.cos(u * Math.PI * 14 + v * 0.8)), 10);
    const skin = 0.78 + v * 0.18 + (valueNoise(u * 30, v * 8, 91) - 0.5) * 0.08;
    const g = Math.min(255, 255 * (skin - ray * 0.32 * (1 - v * 0.5)));
    out[0] = g; out[1] = g; out[2] = g;
    const edge = 0.86 + ray * 0.1 + (valueNoise(u * 22, 0, 77) - 0.5) * 0.08;
    out[3] = v < edge ? 255 : 0;
  });
  return toTexture(canvas, { repeat: false });
}

export function fishSkinTexture(p) {
  const W = 256, H = 128;
  const canvas = pixelCanvas(W, H, (x, y, out) => {
    const u = x / W;
    const v = 1 - y / H;
    const top = -Math.sin(u * Math.PI * 2);
    const backness = smoothstep(-0.55, 0.85, top);
    let r = lerp(p.belly[0], p.back[0], backness);
    let g = lerp(p.belly[1], p.back[1], backness);
    let b = lerp(p.belly[2], p.back[2], backness);
    const mottle = fbm(u * 8, v * 6, { octaves: 3, period: [8, 6], seed: p.seed });

    if (p.scales) {
      const sx = v * p.scales;
      const row = Math.floor(sx);
      const sy = u * p.scales * 2.2 + (row % 2) * 0.5;
      const fx = sx - row, fy = sy - Math.floor(sy);
      const edge = Math.hypot(fx - 0.15, (fy - 0.5) * 0.9);
      const outline = smoothstep(0.42, 0.52, edge) * (1 - smoothstep(0.52, 0.62, edge));
      const k = 1 - outline * p.scaleContrast;
      r *= k; g *= k; b *= k;
    }
    if (p.mirror) {
      const cx = Math.floor(v * 7), cy = Math.floor(u * 6);
      if (hash2i(cx, cy, p.seed) > 0.62 && Math.abs(top) < 0.85) {
        const fx = v * 7 - cx - 0.5, fy = u * 6 - cy - 0.5;
        const d = Math.hypot(fx, fy);
        if (d < 0.42) { r *= 1.35; g *= 1.3; b *= 1.15; }
        else if (d < 0.47) { r *= 0.6; g *= 0.6; b *= 0.6; }
      }
    }
    if (p.bars) {
      const bar = smoothstep(0.35, 0.75, Math.sin(v * Math.PI * p.bars.count + mottle * 2) * 0.5 + 0.5);
      const reach = smoothstep(-0.4, 0.4, top);
      const k = 1 - bar * reach * p.bars.strength;
      r *= k; g *= k; b *= k;
    }
    if (p.lateral) {
      const band = 1 - smoothstep(0.0, p.lateral.width, Math.abs(top - p.lateral.at + (mottle - 0.5) * 0.25));
      const k = 1 - band * p.lateral.strength * smoothstep(0.1, 0.35, v) * (1 - smoothstep(0.85, 0.95, v));
      r *= k; g *= k; b *= k;
    }
    if (p.stripes) {
      const s = Math.abs(Math.sin((top * p.stripes.count + mottle * 0.4) * Math.PI));
      const line = 1 - smoothstep(0.0, p.stripes.width, s);
      const k = 1 - line * p.stripes.strength * smoothstep(-0.7, -0.2, top) * smoothstep(0.08, 0.22, v);
      r *= k; g *= k; b *= k;
    }
    if (p.spots) {
      const spot = smoothstep(0.62, 0.7, fbm(u * 18, v * 10, { octaves: 3, period: [18, 10], seed: p.seed + 3 }));
      const k = 1 - spot * p.spots * smoothstep(-0.3, 0.4, top);
      r *= k; g *= k; b *= k;
    }
    const k = (0.9 + mottle * 0.2) * (0.94 + hash2i(x, y, p.seed) * 0.12);
    out[0] = Math.min(255, r * k);
    out[1] = Math.min(255, g * k);
    out[2] = Math.min(255, b * k);
  });
  return toTexture(canvas, { repeat: false });
}
