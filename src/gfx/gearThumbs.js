import * as THREE from '../../vendor/three.module.js';
import { createPlayerRod } from './rod.js';
import { createTerminalTackle, hook } from './terminalTackle.js';
import { RODS, REELS, getGearById } from '../gear.js';

// Pictures for the Tackle Box cards, taken of the game's own 3D models: the
// same rod, reel, bait or lure you fish with, photographed on a clear
// background. Made on demand, a few per frame, and kept for the session.

const SIZE = 256;
const cache = new Map(); // key -> data URL
const waiting = new Map(); // key -> [callbacks]
const queue = [];
let studio = null;

function makeStudio() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x3a4438, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.2);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
  // One rod, re-dressed for each rod or reel picture. It hangs off a stand-in
  // for the camera it normally rides on.
  const holder = new THREE.Group();
  scene.add(holder);
  const rod = createPlayerRod(holder);
  rod.rodGroup.visible = false;
  const tackle = createTerminalTackle();
  tackle.group.visible = false;
  scene.add(tackle.group);
  return { renderer, scene, cam, rod, tackle, key };
}

const v = () => new THREE.Vector3();
const tmp = { c: v(), d: v(), e: v() };

// Aim the square picture at `center`, looking along -`view`, with `up` as
// up, wide enough for `half` metres either side.
function shoot(center, view, up, half) {
  const { cam, renderer, scene } = studio;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.updateProjectionMatrix();
  cam.position.copy(center).addScaledVector(view, 10);
  cam.up.copy(up);
  cam.lookAt(center);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

// A rod: the handle, reel seat and the start of the blank, running corner
// to corner, seen from the side so the grip, seat and guides show.
function rodPicture(rodItem, reelItem) {
  const { rod } = studio;
  rod.rodGroup.visible = true;
  rod.setRod(rodItem, reelItem || null);
  const { frame, reel, line, handleStart } = rod.parts3d();
  if (reel) reel.visible = !!reelItem;
  if (line) line.visible = !!reelItem;
  rod.rodGroup.updateMatrixWorld(true);
  const { total } = rod.parts3d();
  // From the butt to a hand's width above the grip: handle, seat, the first
  // guide. The reel (on a combo) sits in the middle of it.
  const tipTop = frame.localToWorld(tmp.c.set(0, -(handleStart - 0.35), 0));
  const bottom = frame.localToWorld(tmp.d.set(0, -total, 0));
  const axis = tmp.e.subVectors(tipTop, bottom);
  const len = axis.length();
  axis.normalize();
  const center = new THREE.Vector3().addVectors(tipTop, bottom).multiplyScalar(0.5);
  const side = new THREE.Vector3(1, 0, 0).transformDirection(frame.matrixWorld);
  const across = new THREE.Vector3().crossVectors(side, axis).normalize();
  // Up is half way between "along the rod" and "across it", so the rod runs
  // from bottom-left to top-right.
  const up = new THREE.Vector3().addVectors(axis, across).normalize();
  const url = shoot(center, side, up, len * 0.4);
  if (reel) reel.visible = true;
  if (line) line.visible = true;
  rod.rodGroup.visible = false;
  return url;
}

// A reel: close up, mounted on a plain rod of the right kind, seen from the
// handle side.
const REEL_ROD = { baitcaster: 'rod-baitcast', fly: 'rod-fly', bigpit: 'rod-carp', spinning: 'rod-spinning' };
function reelPicture(reelItem) {
  const { rod } = studio;
  const style = reelItem.model?.style || (reelItem.fly ? 'fly' : reelItem.id === 'reel-baitcaster' ? 'baitcaster' : reelItem.id === 'reel-bigpit' ? 'bigpit' : 'spinning');
  rod.rodGroup.visible = true;
  rod.setRod(getGearById(RODS, REEL_ROD[style] || 'rod-spinning'), reelItem);
  rod.rodGroup.updateMatrixWorld(true);
  const { frame, reel } = rod.parts3d();
  const box = new THREE.Box3().setFromObject(reel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const side = new THREE.Vector3(1, 0, 0).transformDirection(frame.matrixWorld);
  const up = new THREE.Vector3(0, 0, 1).transformDirection(frame.matrixWorld);
  // A little from the front, so the spool face shows.
  const view = side.clone().addScaledVector(new THREE.Vector3(0, 1, 0).transformDirection(frame.matrixWorld), -0.45).normalize();
  const url = shoot(center, view, up, size * 0.5);
  rod.rodGroup.visible = false;
  return url;
}

// A bait, lure or fly, side on (lures swimming, baits on their hook).
function lurePicture(lure) {
  const { tackle } = studio;
  tackle.group.visible = true;
  tackle.set(lure);
  tackle.setBaitOn(true);
  tackle.group.position.set(0, 0, 0);
  tackle.group.rotation.set(0, 0, 0);
  tackle.update(0, { pose: lure.kind === 'lure' || lure.fly ? 'swim' : 'hang', moving: false });
  tackle.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tackle.group);
  const center = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const view = new THREE.Vector3(1, 0.25, 0.35).normalize();
  const url = shoot(center, view, new THREE.Vector3(0, 1, 0), Math.max(s.y, s.z, s.x) * 0.62);
  tackle.group.visible = false;
  return url;
}

// A spool of line in its colour.
const LINE_COLOR = { mono: 0xd9e6df, fluoro: 0xf1cbd9, braid: 0x3f8f3f, fly: 0xc9d24a };
function linePicture(line) {
  const g = new THREE.Group();
  const flange = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.4, metalness: 0.2 });
  const col = line.type === 'fly' && line.sinking ? 0x55683a : line.id === 'line-braid-50' ? 0xc0302a : LINE_COLOR[line.type] ?? 0xdddddd;
  const wound = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, transparent: line.type === 'mono' || line.type === 'fluoro', opacity: 0.85 });
  for (const y of [-0.21, 0.21]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 40), flange);
    f.position.y = y;
    g.add(f);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.38, 40), wound));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.46, 20), flange));
  g.rotation.set(0.5, 0, 0.35);
  studio.scene.add(g);
  const url = shoot(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), 0.62);
  studio.scene.remove(g);
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return url;
}

// A hook, sized to what it holds; a wire trace gets its wire.
function hookPicture(h) {
  const g = new THREE.Group();
  const L = 0.03 + Math.min(0.03, (h.strengthKg || 5) * 0.0012);
  g.add(hook(L, L * 0.38));
  if (h.id === 'hook-wire-trace') {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 }));
    wire.position.y = 0.025;
    g.add(wire);
  }
  studio.scene.add(g);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const s = box.getSize(new THREE.Vector3());
  const url = shoot(box.getCenter(new THREE.Vector3()), new THREE.Vector3(1, 0, 0.25).normalize(), new THREE.Vector3(0, 1, 0), Math.max(s.x, s.y, s.z) * 0.62);
  studio.scene.remove(g);
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return url;
}

function render(kind, item) {
  if (kind === 'rod') return rodPicture(item, null);
  if (kind === 'reel') return reelPicture(item);
  if (kind === 'combo') return rodPicture(getGearById(RODS, item.rodId), getGearById(REELS, item.reelId));
  if (kind === 'lure') return lurePicture(item);
  if (kind === 'line') return linePicture(item);
  if (kind === 'hook') return hookPicture(item);
  return null;
}

function pump() {
  const start = performance.now();
  while (queue.length && performance.now() - start < 12) {
    const { key, kind, item } = queue.shift();
    let url = null;
    try { url = render(kind, item); } catch (err) { console.warn('Tackle picture failed', key, err); }
    cache.set(key, url);
    for (const cb of waiting.get(key) || []) cb(url);
    waiting.delete(key);
  }
  if (queue.length) setTimeout(pump, 0);
}

// Calls back with a picture (data URL) of the item, or null if it can't be
// made. Pictures follow the item's look, so a tuned or new item gets its own.
export function gearPicture(kind, item, callback) {
  const key = `${kind}:${item.id}`;
  if (cache.has(key)) { callback(cache.get(key)); return; }
  if (waiting.has(key)) { waiting.get(key).push(callback); return; }
  waiting.set(key, [callback]);
  try {
    if (!studio) studio = makeStudio();
  } catch {
    // No WebGL for pictures: cards simply go without.
    cache.set(key, null);
    callback(null);
    waiting.delete(key);
    return;
  }
  queue.push({ key, kind, item });
  if (queue.length === 1) setTimeout(pump, 0);
}

