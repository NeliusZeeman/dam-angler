import * as THREE from '../../vendor/three.module.js';
import { makeRng, seedFromString } from './noise.js';
import { woodTexture, glowTexture } from './pixelTextures.js';
import { DECK_Y } from '../dam.js';


// Collects boxes and cylinders in one jetty-local frame and bakes them into a
// single world-space geometry with per-piece colour and grain offset.
class PieceBuilder {
  constructor() { this.geos = []; }
  add(geo, matrix, color, uvShift = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    const count = g.getAttribute('position').count;
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { cols[i * 3] = color.r; cols[i * 3 + 1] = color.g; cols[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (uvShift) {
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + uvShift);
    }
    this.geos.push(g);
  }
  build() {
    const names = ['position', 'normal', 'uv', 'color'];
    const merged = new THREE.BufferGeometry();
    for (const name of names) {
      const size = this.geos[0].getAttribute(name).itemSize;
      const total = this.geos.reduce((s, g) => s + g.getAttribute(name).array.length, 0);
      const arr = new Float32Array(total);
      let o = 0;
      for (const g of this.geos) { arr.set(g.getAttribute(name).array, o); o += g.getAttribute(name).array.length; }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return merged;
  }
}

// Frame for a stand built straight out from the bank at (originX, originZ)
// over the water (+z): `off` metres out along the stand (negative = back up
// the bank), `lat` metres sideways, `y` up.
function jettyFrame(originX, originZ) {
  const rh = new THREE.Vector3(0, 0, 1);
  const th = new THREE.Vector3(-1, 0, 0);
  const basis = new THREE.Matrix4().makeBasis(th, new THREE.Vector3(0, 1, 0), rh.clone().negate());
  return {
    point(off, lat, y) {
      return new THREE.Vector3(originX, y, originZ).addScaledVector(rh, off).addScaledVector(th, lat);
    },
    matrix(off, lat, y, yaw = 0, roll = 0) {
      const m = new THREE.Matrix4().multiplyMatrices(basis, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(roll, yaw, 0)));
      m.setPosition(this.point(off, lat, y));
      return m;
    },
    rh, th,
  };
}

function buildJetty(builder, frame, rng, { fromOff, toOff, width, deckY, postBottom }) {
  const plank = new THREE.BoxGeometry(width, 0.045, 0.2);
  const tone = new THREE.Color();
  for (let off = toOff; off > fromOff; off -= 0.23) {
    tone.setHSL(0.08 + rng() * 0.02, 0.25 + rng() * 0.15, 0.62 + rng() * 0.22);
    builder.add(plank.clone(), frame.matrix(off, (rng() - 0.5) * 0.04, deckY + (rng() - 0.5) * 0.01, (rng() - 0.5) * 0.02, (rng() - 0.5) * 0.02), tone, rng());
  }
  const len = toOff - fromOff;
  const stringer = new THREE.BoxGeometry(0.1, 0.12, len);
  for (const lat of [-width * 0.4, 0, width * 0.4]) {
    builder.add(stringer.clone(), frame.matrix(fromOff + len / 2, lat, deckY - 0.08), tone.setRGB(0.45, 0.38, 0.3), rng());
  }
  const posts = [];
  for (let off = fromOff + 0.2; off <= toOff; off += Math.max(1.4, len / 4)) posts.push(off);
  posts.push(toOff - 0.1);
  for (const off of posts) {
    for (const lat of [-width / 2 - 0.02, width / 2 + 0.02]) {
      // Posts run down to the actual bank / lake bed under each one.
      const bottom = typeof postBottom === 'function' ? postBottom(frame.point(off, lat, 0)) - 0.3 : postBottom;
      const h = deckY + 0.14 - bottom;
      const post = new THREE.CylinderGeometry(0.07, 0.08, h, 8);
      builder.add(post, frame.matrix(off, lat, bottom + h / 2), tone.setRGB(0.4, 0.33, 0.26), rng());
    }
  }
}

export function createProps(scene, { dam, terrain, location }) {
  const rng = makeRng(seedFromString(location.id) + 626);
  const woodMap = woodTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: woodMap, vertexColors: true, roughness: 0.88 });
  const jetty = new PieceBuilder();
  const bedAt = (p) => terrain.heightAt(p.x, p.z);

  // Every angling stand along this stretch of bank, from the dam spec.
  const frames = dam.stands.map((st) => {
    const frame = jettyFrame(st.x, dam.shoreZ(st.x));
    buildJetty(jetty, frame, rng, { fromOff: -3, toOff: st.length, width: st.width, deckY: st.deckY, postBottom: bedAt });
    return frame;
  });
  // No stand (a river bank, a mountain stream): the kit sits on the ground
  // at the water's edge where the angler starts.
  const onBank = frames.length === 0;
  const main = onBank ? jettyFrame(dam.spawn.x, dam.shoreZ(dam.spawn.x)) : frames[0];
  const mainLen = onBank ? 0 : dam.stands[0].length;
  const mainHalfW = onBank ? 1.3 : dam.stands[0].width / 2;
  if (!onBank) {
    const jettyMesh = new THREE.Mesh(jetty.build(), woodMat);
    jettyMesh.castShadow = true;
    jettyMesh.receiveShadow = true;
    scene.add(jettyMesh);
  }
  // Height to set kit on: the deck, or the ground under that spot.
  const baseY = (off, lat) => (onBank ? terrain.heightAt(main.point(off, lat, 0).x, main.point(off, lat, 0).z) : DECK_Y);

  // ─── Kit on the jetty ─────────────────────────────────────────────────────
  const kit = new THREE.Group();
  scene.add(kit);
  const place = (mesh, off, lat, y, yaw = 0) => {
    mesh.applyMatrix4(main.matrix(off, lat, y, yaw));
    mesh.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    kit.add(mesh);
    return mesh;
  };
  const plastic = (color, rough = 0.45) => new THREE.MeshStandardMaterial({ color, roughness: rough });

  // Cooler box: blue body, white lid, handle.
  const cooler = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.36), plastic(0x2468a8));
  body.position.y = 0.17;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.38), plastic(0xeeeeea));
  lid.position.y = 0.37;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), plastic(0x222222));
  handle.position.y = 0.4;
  cooler.add(body, lid, handle);
  place(cooler, mainLen - 2.6, mainHalfW - 0.4, baseY(mainLen - 2.6, mainHalfW - 0.4) + 0.022, 0.25);

  // Bait bucket, with a dark layer of soil and worms showing inside.
  const bucket = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xe6e1d2, roughness: 0.5, side: THREE.DoubleSide }));
  shell.position.y = 0.14;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18), plastic(0x3a2a1c, 1));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.22;
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 5, 20, Math.PI), plastic(0x999999, 0.3));
  bail.position.y = 0.28;
  bail.rotation.y = 0.6;
  bucket.add(shell, soil, bail);
  place(bucket, mainLen - 3.4, -(mainHalfW - 0.35), baseY(mainLen - 3.4, -(mainHalfW - 0.35)) + 0.022);

  // Tackle box.
  const tackle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.22), plastic(0x3d6b3c));
  place(tackle, mainLen - 3.2, mainHalfW - 0.45, baseY(mainLen - 3.2, mainHalfW - 0.45) + 0.11, -0.4);

  // ─── Lantern ──────────────────────────────────────────────────────────────
  const lanternGroup = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.35), plastic(0x2a2a2a, 0.4));
  arm.position.set(0, 0.25, -0.14);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.9 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), glassMat);
  glass.position.set(0, 0.1, -0.3);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.07, 10), plastic(0x2a2a2a, 0.4));
  cap.position.set(0, 0.215, -0.3);
  lanternGroup.add(arm, glass, cap);
  const lanternOff = onBank ? -1.2 : mainLen - 0.15;
  place(lanternGroup, lanternOff, mainHalfW + 0.02, baseY(lanternOff, mainHalfW + 0.02) + 0.12);
  const lanternLight = new THREE.PointLight(0xffa850, 0, 16, 2);
  lanternLight.position.copy(main.point(lanternOff, mainHalfW + 0.02, baseY(lanternOff, mainHalfW + 0.02) + 0.22)).addScaledVector(main.rh, -0.3);
  scene.add(lanternLight);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa850, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.copy(lanternLight.position);
  halo.scale.setScalar(0.9);
  scene.add(halo);

  // Grass and flowers keep off the stands.
  const exclude = (x, z) => !!dam.standAt(x, z);

  function update(atmos, elapsed) {
    const glow = atmos.nightness;
    const flicker = 0.9 + Math.sin(elapsed * 13) * 0.04 + Math.sin(elapsed * 7.3) * 0.05;
    glassMat.emissiveIntensity = glow * 6 * flicker;
    lanternLight.intensity = glow * 22 * flicker;
    halo.material.opacity = glow * 0.9;
    halo.visible = glow > 0.02;
  }

  return { exclude, update, deckY: DECK_Y, terrain };
}
