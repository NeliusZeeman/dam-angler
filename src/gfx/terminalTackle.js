import * as THREE from '../../vendor/three.module.js';

// What's on the end of the line: the bait on its hook, a feeder, a lure or a
// fly, drawn after the real thing (models are about twice life size, and
// the whole rig is scaled up again so it reads from the bank).
// Each model's origin is where the line ties on.
//
// How each one is fished decides what you see once it's in:
//   float    bait under a float -- the float shows, the bait hangs below it
//   bottom   feeders and carp/barbel baits -- sinks out of sight
//   lure     worked just under the surface, nose toward the rod
//   surface  sits on top (topwater frog, live frog, dry fly)
//   fly      wet flies, just under the film
const RIG_BY_ID = {
  'bread-bait': 'float', worm: 'float', mielies: 'float', 'dough-bait': 'float',
  mieliebom: 'bottom', 'method-feeder': 'bottom', boilies: 'bottom', 'pop-up': 'bottom', 'chicken-liver': 'bottom', sardine: 'bottom',
  'frog-bait': 'surface', 'topwater-frog': 'surface', 'fly-dry': 'surface',
};

export function rigFor(lure) {
  if (!lure) return 'float';
  if (RIG_BY_ID[lure.id]) return RIG_BY_ID[lure.id];
  if (lure.fly) return 'fly';
  if (lure.heavy) return 'bottom';
  return lure.kind === 'lure' ? 'lure' : 'float';
}

// ─── Parts ───────────────────────────────────────────────────────────────────
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const METAL = () => mat(0xb8bcc4, { roughness: 0.2, metalness: 0.95 });
const LEAD = () => mat(0x55585e, { roughness: 0.6, metalness: 0.4 });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

function ellipsoid(sx, sy, sz, material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.SphereGeometry(1, 16, 12), material, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// A rough, lumpy ball: bread flake, groundbait, liver.
function lumpy(r, material, seed = 1, amp = 0.22) {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 97 * seed + y * 41) * Math.sin(y * 73 + z * 59 * seed) * Math.sin(z * 83 + x * 31);
    const k = 1 + amp * n;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// A thin rod between two points.
function wire(a, b, r, material) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), material);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// A single hook: eye at the origin, shank down -Y, bend curling toward +Z
// and the point back up.
function hook(L = 0.03, gap = 0.008, material = METAL(), wireR = 0.0012) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(wireR * 2.2, wireR * 0.7, 5, 10), material)); // eye
  g.add(wire(v(0, -wireR * 2, 0), v(0, -L, 0), wireR, material));
  const bend = new THREE.Mesh(new THREE.TorusGeometry(gap / 2, wireR, 5, 12, Math.PI), material);
  bend.rotation.set(0, Math.PI / 2, Math.PI);
  bend.position.set(0, -L, gap / 2);
  g.add(bend);
  g.add(wire(v(0, -L, gap), v(0, -L + L * 0.45, gap), wireR, material));
  const barb = new THREE.Mesh(new THREE.ConeGeometry(wireR * 1.6, wireR * 5, 5), material);
  barb.position.set(0, -L + L * 0.45 + wireR * 2, gap);
  g.add(barb);
  return g;
}

// Treble hook hanging from a split ring at the origin.
function treble(size = 0.018, material = METAL()) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(size * 0.2, size * 0.04, 5, 10), material));
  for (let i = 0; i < 3; i++) {
    const h = hook(size, size * 0.45, material, size * 0.045);
    h.children[0].visible = false;
    h.rotation.y = (i / 3) * Math.PI * 2;
    h.position.y = -size * 0.2;
    g.add(h);
  }
  return g;
}

// A fly hook: eye at the origin, shank running back along -Z, point below.
function flyHook(L, material = METAL()) {
  const h = hook(L, L * 0.45, material, L * 0.03);
  h.rotation.x = Math.PI / 2;
  return h;
}

// Line from the swivel down to a hook, for feeder rigs.
function hooklink(from, to) {
  return wire(from, to, 0.0006, mat(0x7a6a50, { roughness: 0.8 }));
}

// Two-tone body: `top` colour above y = split, `belly` below (for plugs).
function twoTone(geo, top, belly, split = 0) {
  const p = geo.getAttribute('position');
  const c = [];
  const a = new THREE.Color(top), b = new THREE.Color(belly);
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.smoothstep(p.getY(i), split - 0.25, split + 0.25);
    const col = b.clone().lerp(a, t);
    c.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return geo;
}

function eyes(r, x, y, z, color = 0xffd21a) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = ellipsoid(r, r, r * 0.6, mat(color, { roughness: 0.2 }), s * x, y, z);
    const pupil = ellipsoid(r * 0.5, r * 0.5, r * 0.3, mat(0x080808, { roughness: 0.2 }), s * (x + r * 0.35), y, z);
    g.add(e, pupil);
  }
  return g;
}

// ─── Baits (hang down from the hook eye) ────────────────────────────────────
function onHook(bait, L = 0.032) {
  const g = new THREE.Group();
  g.add(hook(L, L * 0.34));
  bait.position.y += -L;
  bait.position.z += L * 0.17;
  g.add(bait);
  return g;
}

const BUILDERS = {
  'bread-bait': () => onHook(lumpy(0.02, mat(0xf3ecd8, { roughness: 1 }), 1.3, 0.3)),
  'dough-bait': () => onHook(lumpy(0.018, mat(0xe9d27c, { roughness: 0.9 }), 2.1, 0.12)),
  worm: () => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(v(Math.sin(t * 7) * 0.012, 0.03 - t * 0.09, Math.cos(t * 5) * 0.01 + 0.005));
    }
    const body = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0045, 8), mat(0xa4524c, { roughness: 0.35 }));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.0016, 6, 12), mat(0xc87a6a, { roughness: 0.4 }));
    band.position.copy(pts[4]);
    const g = new THREE.Group();
    g.add(body, band);
    return onHook(g);
  },
  mielies: () => {
    const g = new THREE.Group();
    const m = mat(0xf2c02a, { roughness: 0.35 });
    for (let i = 0; i < 3; i++) {
      const k = ellipsoid(0.008, 0.0065, 0.006, m, (i - 1) * 0.004, 0.018 - i * 0.012, 0);
      k.rotation.z = (i - 1) * 0.5;
      g.add(k);
    }
    return onHook(g);
  },
  'chicken-liver': () => {
    const liver = lumpy(0.024, mat(0x5e1010, { roughness: 0.18, metalness: 0.05 }), 3.7, 0.35);
    liver.scale.set(1.2, 0.8, 1);
    return onHook(liver, 0.036);
  },
  sardine: () => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.018, 0.028, 0.05), mat(0xa9b3bd, { roughness: 0.25, metalness: 0.6 })));
    g.add(mesh(new THREE.BoxGeometry(0.0185, 0.008, 0.05), mat(0x2b4b78, { roughness: 0.3, metalness: 0.4 }), 0, 0.011, 0));
    g.add(mesh(new THREE.BoxGeometry(0.017, 0.026, 0.002), mat(0xb86060, { roughness: 0.6 }), 0, 0, 0.0255)); // cut face
    g.rotation.x = 1.2;
    return onHook(g, 0.036);
  },
  boilies: () => {
    // Hair rig: the boilies hang on a hair off the back of the hook.
    const g = new THREE.Group();
    g.add(hook(0.03, 0.011));
    const m = mat(0x8c3a1e, { roughness: 0.7 });
    g.add(hooklink(v(0, -0.03, 0.006), v(0, -0.045, 0.004)));
    g.add(ellipsoid(0.014, 0.014, 0.014, m, 0, -0.058, 0.004));
    g.add(ellipsoid(0.014, 0.014, 0.014, m, 0, -0.085, 0.004));
    return g;
  },
  'pop-up': () => {
    const g = new THREE.Group();
    g.add(hook(0.03, 0.011));
    g.add(hooklink(v(0, -0.03, 0.006), v(0, -0.018, 0.028)));
    g.add(ellipsoid(0.015, 0.015, 0.015, mat(0xffd21a, { roughness: 0.5, emissive: 0x6a5000 }), 0, -0.01, 0.034));
    return g;
  },
  mieliebom: () => {
    // Groundbait packed round a coiled-spring feeder, lead underneath,
    // short hooklink with a couple of mielies.
    const g = new THREE.Group();
    const metal = METAL();
    g.add(wire(v(0, 0, 0), v(0, -0.02, 0), 0.0012, metal));
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0012, 5, 16), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.03 - i * 0.012;
      g.add(ring);
    }
    const ball = lumpy(0.045, mat(0xd8b24a, { roughness: 1 }), 1.9, 0.14);
    ball.scale.set(1, 1.15, 1);
    ball.position.y = -0.06;
    g.add(ball);
    g.add(ellipsoid(0.012, 0.018, 0.012, LEAD(), 0, -0.118, 0));
    g.add(hooklink(v(0, -0.12, 0), v(0.03, -0.17, 0.02)));
    const h = BUILDERS.mielies();
    h.scale.setScalar(0.8);
    h.position.set(0.03, -0.17, 0.02);
    g.add(h);
    g.scale.setScalar(0.7);
    return g;
  },
  'method-feeder': () => {
    // Korda-style method feeder: green frame, lead base, pellet mix pressed
    // on, hooklink with a small pellet.
    const g = new THREE.Group();
    g.add(wire(v(0, 0, 0), v(0, -0.02, 0), 0.0012, METAL()));
    const frame = new THREE.Group();
    const green = mat(0x2f6b3a, { roughness: 0.5 });
    frame.add(mesh(new THREE.BoxGeometry(0.03, 0.004, 0.06), LEAD()));
    for (const x of [-0.011, 0, 0.011]) frame.add(mesh(new THREE.BoxGeometry(0.003, 0.018, 0.06), green, x, 0.01, 0));
    const mix = lumpy(0.024, mat(0x6a4526, { roughness: 1 }), 2.7, 0.16);
    mix.scale.set(1.1, 0.8, 1.6);
    mix.position.y = 0.014;
    frame.add(mix);
    frame.rotation.x = Math.PI / 2;
    frame.position.y = -0.05;
    g.add(frame);
    g.add(hooklink(v(0, -0.085, 0), v(0.02, -0.12, 0.01)));
    const pellet = BUILDERS['pop-up']();
    pellet.scale.setScalar(0.7);
    pellet.position.set(0.02, -0.12, 0.01);
    g.add(pellet);
    return g;
  },
  'frog-bait': () => {
    // A platanna hooked through the lips.
    const g = new THREE.Group();
    const skin = mat(0x5d6a3a, { roughness: 0.35 });
    const body = ellipsoid(0.022, 0.011, 0.03, skin, 0, 0, -0.03);
    g.add(body, ellipsoid(0.02, 0.006, 0.026, mat(0xd8d2b0, { roughness: 0.5 }), 0, -0.006, -0.03));
    for (const s of [-1, 1]) {
      g.add(wire(v(s * 0.016, 0, -0.05), v(s * 0.03, 0, -0.075), 0.0045, skin));
      g.add(wire(v(s * 0.03, 0, -0.075), v(s * 0.02, 0, -0.105), 0.0035, skin));
      g.add(wire(v(s * 0.014, 0, -0.012), v(s * 0.028, 0, 0.0), 0.003, skin));
    }
    g.add(eyes(0.004, 0.009, 0.009, -0.01, 0x9a8a40));
    const h = hook(0.028, 0.01);
    h.rotation.x = Math.PI / 2;
    h.position.set(0, 0.004, -0.004);
    g.add(h);
    return g;
  },

  // ─── Lures (nose at the origin pointing +Z, body back along -Z) ─────────
  'topwater-frog': () => {
    const g = new THREE.Group();
    const geo = twoTone(new THREE.SphereGeometry(1, 20, 14), 0x2f7a32, 0xf1efe0, -0.1);
    const body = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.4 }));
    body.scale.set(0.022, 0.013, 0.032);
    body.position.z = -0.032;
    g.add(body);
    g.add(eyes(0.005, 0.01, 0.01, -0.012));
    // Rubber-skirt legs trailing behind.
    const leg = mat(0x3f8a30, { roughness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1;
      const a = (i % 4) * 0.08;
      g.add(wire(v(s * 0.01, 0, -0.06), v(s * (0.02 + a * 0.1), -0.002, -0.11 - a * 0.1), 0.0012, leg));
    }
    // Double hook riding up over the back.
    for (const s of [-1, 1]) {
      const h = hook(0.03, 0.012, METAL(), 0.0013);
      h.children[0].visible = false;
      h.rotation.set(-Math.PI / 2, 0, Math.PI + s * 0.25);
      h.position.set(s * 0.004, 0.004, -0.02);
      g.add(h);
    }
    return g;
  },
  crankbait: () => {
    // Sensation Baby-B style: short fat body in fire tiger, clear bib.
    const g = new THREE.Group();
    const geo = twoTone(new THREE.SphereGeometry(1, 20, 14), 0x3f8a2a, 0xf28a1a, -0.2);
    const body = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.25 }));
    body.scale.set(0.017, 0.022, 0.036);
    body.position.z = -0.03;
    g.add(body);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.035, 0.004, 0.004), mat(0x121212), 0, 0.012 - i * 0.004, -0.035 + i * 0.012));
    g.add(eyes(0.0045, 0.012, 0.006, -0.008));
    const lip = mesh(new THREE.BoxGeometry(0.02, 0.0015, 0.024), mat(0xdfe8ea, { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, -0.01, 0.006);
    lip.rotation.x = 0.7;
    g.add(lip);
    const t1 = treble(0.016); t1.position.set(0, -0.022, -0.024); g.add(t1);
    const t2 = treble(0.016); t2.position.set(0, -0.004, -0.068); g.add(t2);
    return g;
  },
  'rapala-minnow': () => {
    const g = new THREE.Group();
    const geo = twoTone(new THREE.SphereGeometry(1, 20, 12), 0x16181c, 0xd8dde2, 0.15);
    const body = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.15, metalness: 0.4 }));
    body.scale.set(0.009, 0.012, 0.045);
    body.position.z = -0.045;
    g.add(body);
    g.add(mesh(new THREE.BoxGeometry(0.008, 0.006, 0.006), mat(0xc8201a), 0, -0.007, -0.012));
    g.add(eyes(0.0035, 0.006, 0.003, -0.012));
    const lip = mesh(new THREE.BoxGeometry(0.012, 0.001, 0.014), mat(0xdfe8ea, { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, -0.006, 0.003);
    lip.rotation.x = 0.35;
    g.add(lip);
    const t1 = treble(0.013); t1.position.set(0, -0.012, -0.03); g.add(t1);
    const t2 = treble(0.013); t2.position.set(0, -0.004, -0.09); g.add(t2);
    return g;
  },
  'bass-jig': () => {
    // Flipping jig: lead head, flared silicone skirt, fibre weed guard,
    // hook riding point-up.
    const g = new THREE.Group();
    g.add(ellipsoid(0.012, 0.011, 0.013, mat(0x3a2a1a, { roughness: 0.4 }), 0, 0, -0.01));
    g.add(eyes(0.003, 0.009, 0.003, -0.006, 0xd8c040));
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 18, 1, true), mat(0x6a4a24, { roughness: 0.7, side: THREE.DoubleSide }));
    skirt.rotation.x = Math.PI / 2;
    skirt.position.z = -0.048;
    g.add(skirt);
    const stripe = new THREE.Mesh(new THREE.ConeGeometry(0.0205, 0.03, 18, 1, true), mat(0xd26a1a, { roughness: 0.7, side: THREE.DoubleSide }));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.z = -0.064;
    g.add(stripe);
    const h = hook(0.06, 0.018, METAL(), 0.0016);
    h.rotation.set(-Math.PI / 2, 0, Math.PI);
    h.position.set(0, 0.004, -0.01);
    g.add(h);
    for (let i = 0; i < 5; i++) g.add(wire(v(0, 0.01, -0.012), v((i - 2) * 0.003, 0.03, -0.05), 0.0006, mat(0x2a2016)));
    return g;
  },
  spinner: () => {
    // Spinnerbait: bent "safety-pin" wire, willow blade up top, lead head
    // with a skirt and single hook down below.
    const g = new THREE.Group();
    const metal = METAL();
    g.add(wire(v(0, 0, 0), v(0, 0.035, -0.06), 0.0009, metal));
    g.add(wire(v(0, 0, 0), v(0, -0.018, -0.02), 0.0009, metal));
    const bladePivot = new THREE.Group();
    bladePivot.position.set(0, 0.035, -0.06);
    const blade = ellipsoid(0.011, 0.002, 0.028, mat(0xf0c050, { roughness: 0.25, metalness: 0.5, emissive: 0x3a2a00 }), 0.006, 0, -0.026);
    blade.rotation.z = 0.5;
    bladePivot.add(blade);
    g.add(bladePivot);
    g.add(ellipsoid(0.009, 0.01, 0.012, mat(0xf2f2f2, { roughness: 0.3 }), 0, -0.02, -0.026));
    g.add(eyes(0.0026, 0.007, -0.017, -0.02, 0xc02020));
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 16, 1, true), mat(0xd8f040, { roughness: 0.6, side: THREE.DoubleSide }));
    skirt.rotation.x = Math.PI / 2;
    skirt.position.set(0, -0.02, -0.06);
    g.add(skirt);
    const h = hook(0.055, 0.016, metal, 0.0014);
    h.rotation.set(-Math.PI / 2, 0, Math.PI);
    h.position.set(0, -0.016, -0.028);
    g.add(h);
    return { group: g, animate: (dt, moving) => { if (moving) bladePivot.rotation.z += dt * 30; } };
  },
  'soft-plastic': () => {
    // Paddle-tail shad on a jig head, in motor oil.
    const g = new THREE.Group();
    g.add(ellipsoid(0.009, 0.009, 0.01, mat(0xb01818, { roughness: 0.3 }), 0, 0, -0.008));
    g.add(eyes(0.0025, 0.007, 0.002, -0.006));
    const plastic = mat(0x7a5a24, { roughness: 0.35, transparent: true, opacity: 0.9 });
    const body = ellipsoid(0.008, 0.011, 0.034, plastic, 0, 0, -0.045);
    g.add(body);
    const tailPivot = new THREE.Group();
    tailPivot.position.z = -0.078;
    tailPivot.add(ellipsoid(0.003, 0.004, 0.01, plastic, 0, 0, -0.006));
    tailPivot.add(mesh(new THREE.BoxGeometry(0.02, 0.016, 0.0025), plastic, 0, 0, -0.016));
    g.add(tailPivot);
    const h = hook(0.045, 0.012, METAL(), 0.0012);
    h.children[0].visible = false;
    h.rotation.set(-Math.PI / 2, 0, Math.PI);
    h.position.set(0, 0.004, -0.01);
    g.add(h);
    let t = 0;
    return { group: g, animate: (dt, moving) => { t += dt * (moving ? 14 : 3); tailPivot.rotation.y = Math.sin(t) * (moving ? 0.5 : 0.1); } };
  },
  'spoon-lure': () => {
    // Casting spoon: curved gold blade with a red stripe, treble at the tail.
    const g = new THREE.Group();
    const spoon = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(0xe8b848, { roughness: 0.25, metalness: 0.5, emissive: 0x3a2800, side: THREE.DoubleSide }));
    spoon.scale.set(0.016, 0.006, 0.036);
    spoon.rotation.x = Math.PI;
    const body = new THREE.Group();
    body.position.z = -0.04;
    body.add(spoon);
    body.add(mesh(new THREE.BoxGeometry(0.005, 0.001, 0.04), mat(0xc02020, { roughness: 0.4 }), 0, 0.0005, 0));
    g.add(body);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.003, 0.0006, 5, 10), METAL()));
    const t = treble(0.016); t.position.set(0, 0, -0.078); g.add(t);
    let ph = 0;
    return { group: g, animate: (dt, moving) => { ph += dt * (moving ? 16 : 2); body.rotation.z = Math.sin(ph) * (moving ? 0.6 : 0.08); } };
  },

  // ─── Flies (nose at the origin, body back along -Z, about 3x life size) ──
  'fly-nymph': () => fly({ body: 0x8a6a44, rib: 0xd4a640, bead: 0xd4a640, tail: 0x6a5030, len: 0.034 }),
  'fly-zak': () => fly({ body: 0x2a3a2a, rib: 0x5aa060, bead: 0xd4a640, tail: 0x3a3028, len: 0.028, slim: true }),
  'fly-streamer': () => fly({ body: 0x141414, hackle: 0x2a2a2a, tail: 0x0e0e0e, marabou: true, len: 0.05 }),
  'fly-damsel': () => fly({ body: 0x6b7a38, hackle: 0x5a6a30, tail: 0x6b7a38, marabou: true, redEyes: true, len: 0.042 }),
  'fly-walkers-killer': () => fly({ body: 0x8a1c1c, wing: 0x6a4a2a, tail: 0x5a3a20, len: 0.042 }),
  'fly-dry': () => {
    // Parachute Adams: grey body, white post, hackle wound flat round it.
    const g = new THREE.Group();
    g.add(flyHook(0.03));
    g.add(ellipsoid(0.0035, 0.0035, 0.013, mat(0x8a8a88, { roughness: 1 }), 0, 0.002, -0.016));
    g.add(mesh(new THREE.CylinderGeometry(0.0022, 0.0028, 0.016, 8), mat(0xf4f4f0, { roughness: 1 }), 0, 0.011, -0.008));
    g.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.0015, 18), mat(0x8a6a4a, { roughness: 1, transparent: true, opacity: 0.8 }), 0, 0.006, -0.008));
    for (const s of [-1, 0, 1]) g.add(wire(v(0, 0.002, -0.028), v(s * 0.004, 0.004, -0.043), 0.0004, mat(0x7a6a5a)));
    return g;
  },
};

// A wet fly or streamer on its hook.
function fly({ body, rib, bead, tail, hackle, wing, marabou, redEyes, len = 0.036, slim = false }) {
  const g = new THREE.Group();
  g.add(flyHook(len));
  const w = slim ? 0.0032 : 0.0045;
  g.add(ellipsoid(w, w, len * 0.42, mat(body, { roughness: 1 }), 0, 0, -len * 0.5));
  if (rib) {
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.95, 0.0005, 4, 12), mat(rib, { metalness: 0.5, roughness: 0.3 }));
      ring.position.z = -len * (0.28 + i * 0.12);
      g.add(ring);
    }
  }
  if (bead) g.add(ellipsoid(w * 1.1, w * 1.1, w * 1.1, mat(bead, { metalness: 0.5, roughness: 0.25, emissive: 0x2a1c00 }), 0, 0, -0.002));
  if (redEyes) g.add(eyes(0.0028, 0.004, 0.001, -0.003, 0xc01818));
  if (hackle) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(w * 2.2, len * 0.8, 10, 1, true), mat(hackle, { roughness: 1, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    h.rotation.x = -Math.PI / 2;
    h.position.z = -len * 0.5;
    g.add(h);
  }
  if (wing) {
    const wg = ellipsoid(w * 1.1, 0.0012, len * 0.45, mat(wing, { roughness: 1 }), 0, w * 1.1, -len * 0.55);
    wg.rotation.x = -0.18;
    g.add(wg);
  }
  const tailLen = marabou ? len * 0.9 : len * 0.3;
  const tl = new THREE.Mesh(new THREE.ConeGeometry(marabou ? w * 1.6 : w * 0.7, tailLen, 10, 1, true), mat(tail, { roughness: 1, side: THREE.DoubleSide }));
  tl.rotation.x = Math.PI / 2;
  tl.position.z = -len * 0.92 - tailLen / 2;
  g.add(tl);
  let t = 0;
  return {
    group: g,
    animate: marabou ? (dt, moving) => { t += dt * (moving ? 9 : 2.5); tl.rotation.y = Math.sin(t) * 0.25; } : null,
  };
}

// ─── The tackle on the end of the line ───────────────────────────────────────
const HANGS_NOSE = new Set(['lure', 'surface', 'fly']);

export function createTerminalTackle() {
  const group = new THREE.Group();
  // Drawn larger than life so it reads from the bank, like the float.
  group.scale.setScalar(1.7);
  let current = null; // { id, rig, model, animate }
  const bare = hook(0.032, 0.011);
  bare.visible = false;
  group.add(bare);

  function dispose(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  function set(lure) {
    const id = lure?.id ?? 'bread-bait';
    if (current?.id === id) return current.rig;
    if (current) { group.remove(current.model); dispose(current.model); }
    const build = BUILDERS[id] || (lure?.fly ? BUILDERS['fly-nymph'] : lure?.kind === 'lure' ? BUILDERS['spoon-lure'] : BUILDERS['bread-bait']);
    const made = build();
    const model = made.isObject3D ? made : made.group;
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(model);
    current = { id, rig: rigFor(lure), model, animate: made.animate || null };
    return current.rig;
  }

  // Bait gone (off the hook): show the bare hook instead.
  function setBaitOn(on) {
    if (!current) return;
    const lureLike = HANGS_NOSE.has(current.rig);
    current.model.visible = on || lureLike;
    bare.visible = !on && !lureLike;
  }

  // pose: 'hang' (dangling off the line) or 'swim' (lying along the pull)
  function update(dt, { pose, moving }) {
    if (!current) return;
    const nose = HANGS_NOSE.has(current.rig);
    if (pose === 'hang' && nose) current.model.rotation.set(-Math.PI / 2, 0, 0);
    else current.model.rotation.set(0, 0, 0);
    if (current.animate) current.animate(dt, moving);
  }

  return { group, set, setBaitOn, update, rig: () => current?.rig ?? 'float' };
}
