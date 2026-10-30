import * as THREE from '../../vendor/three.module.js';
import { makePerson, loadedPeople, isKid } from '../people.js';
import { createFishMesh } from '../fish3d.js';
import { FISH_SPECIES, randomWeightFor, estimateLengthCm } from '../fish.js';

// The camp, alive: the people at a campsite (people.js) going about a
// weekend at the dam, and the carp anglers at its rod pods really fishing.
//
//   braai master  turns the meat with tongs, has a beer, chats, fetches
//                 another from the cooler box
//   chair crowd   sits round the braai, drinks, eats boerewors rolls, laughs
//   wanderer      walks between the cooler, the braai and the water's edge
//   kids          run about, look at the water, cheer when a fish comes out
//   anglers       wait in their chairs behind the pods; on a run they're up
//                 and on the rod, play the fish in (rod bending, line
//                 cutting the water, splashes as it comes close), land it,
//                 hold it up for a photo while the camp cheers, slip it
//                 back, cast out again and sit down
//
// layout (from camp.js): braai {x, z, y}, chairs [{x, z, turn}], cooler,
// table, rodSpots [{x, z, chair}], centre, shoreAt(x).

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
const angleTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A carp rod: a tapered blank in segments that bend toward the tip, a
// reel, and the line out to the water.
const ROD_LEN = 3.6, SEGS = 6;
const blankMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.35, metalness: 0.2 });
const reelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.7 });
const lineMat = new THREE.LineBasicMaterial({ color: 0xd8d8c8, transparent: true, opacity: 0.55 });
const leadMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
const LINE_PTS = 16;

function makeRod(size = 1) {
  const root = new THREE.Group();
  const segs = [];
  let parent = root;
  for (let i = 0; i < SEGS; i++) {
    const len = ROD_LEN / SEGS;
    const r0 = 0.012 - (0.009 * i) / SEGS, r1 = 0.012 - (0.009 * (i + 1)) / SEGS;
    const g = new THREE.Group();
    if (i > 0) g.position.y = len;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), blankMat);
    m.position.y = len / 2;
    m.castShadow = true;
    g.add(m);
    parent.add(g);
    segs.push(g);
    parent = g;
  }
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), reelMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0, 0.42, -0.05);
  root.add(reel);
  const tip = new THREE.Object3D();
  tip.position.y = ROD_LEN / SEGS;
  segs[SEGS - 1].add(tip);
  return { root, segs, tip, size };
}

// Points the rod: butt at `butt`, blank along `dir`, bent by `bend`
// (radians over the whole blank) toward `toward` (a world direction).
function aimRod(rod, butt, dir, bend = 0, toward = null) {
  const y = dir.clone().normalize();
  const side = new THREE.Vector3().crossVectors(y, toward ? toward.clone().normalize() : new THREE.Vector3(0, -1, 0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const z = new THREE.Vector3().crossVectors(side, y).normalize();
  const k = rod.size || 1;
  rod.root.matrix.makeBasis(side.multiplyScalar(k), y.multiplyScalar(k), z.multiplyScalar(k)).setPosition(butt);
  rod.root.matrix.decompose(rod.root.position, rod.root.quaternion, rod.root.scale);
  // Bend more toward the tip (a carp rod's through action still loads the tip most).
  for (let i = 1; i < SEGS; i++) rod.segs[i].rotation.x = -bend * Math.pow(i / SEGS, 1.4) * (2.2 / SEGS);
  rod.root.updateMatrixWorld(true);
}
const rodPoint = (rod, along, out = new THREE.Vector3()) => {
  // A point `along` metres up the blank (straight-blank estimate is fine
  // for the hands, which sit in the stiff butt section).
  out.set(0, along / (rod.size || 1), 0);
  return rod.root.localToWorld(out);
};

function makeLine(scene) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(geo, lineMat);
  line.frustumCulled = false;
  scene.add(line);
  return line;
}
// A line from a to b sagging `sag` metres in the middle.
function setLine(line, a, b, sag = 0.3) {
  const p = line.geometry.attributes.position;
  for (let i = 0; i < LINE_PTS; i++) {
    const t = i / (LINE_PTS - 1);
    p.setXYZ(i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (b.z - a.z) * t);
  }
  p.needsUpdate = true;
}

export function createCampLife(scene, { layout, ground, location, rng = Math.random, maxPeople = 8 }) {
  const names = loadedPeople();
  if (!names.length) return null;
  const adults = names.filter((n) => !isKid(n));
  const kids = names.filter((n) => isKid(n));
  const hooks = { ripple: () => {}, splash: () => {}, onCatch: () => {} };
  const agents = [];
  const pick = (list, prefer) => {
    const i = prefer && list.includes(prefer) ? list.indexOf(prefer) : Math.floor(rng() * list.length);
    return list.splice(i, 1)[0];
  };
  const pool = [...adults];
  const spawn = (name) => {
    const p = makePerson(name);
    if (!p) return null;
    scene.add(p.root);
    return p;
  };
  const place = (p, x, z, heading) => {
    p.root.position.set(x, ground(x, z), z);
    p.root.rotation.y = heading;
  };
  // Where the hips sit in the "sit" motion, relative to the person's feet
  // (to put them square in a chair).
  const sitOffset = (p) => {
    p.root.position.set(0, 0, 0);
    p.root.rotation.y = 0;
    p.pose('sit', { fade: 0 });
    p.update(0);
    return p.bonePos('Pelvis', new THREE.Vector3());
  };
  const sitIn = (p, chair) => {
    const off = p.sitOff || (p.sitOff = sitOffset(p));
    const c = Math.cos(chair.turn), s = Math.sin(chair.turn);
    // The seat's centre is a touch back from the chair's middle.
    const sx = chair.x - Math.sin(chair.turn) * 0.04, sz = chair.z - Math.cos(chair.turn) * 0.04;
    const x = sx - (off.x * c + off.z * s), z = sz - (-off.x * s + off.z * c);
    p.root.position.set(x, ground(chair.x, chair.z), z);
    p.root.rotation.y = chair.turn;
  };

  // Walking: turn toward the target and go; true on arrival.
  function walkTo(a, tx, tz, dt, { stroll = false, run = false } = {}) {
    const r = a.p.root.position;
    const dx = tx - r.x, dz = tz - r.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const want = Math.atan2(dx, dz);
    a.p.root.rotation.y += wrap(want - a.p.root.rotation.y) * Math.min(1, dt * 5);
    const speed = (stroll ? a.p.strollSpeed : a.p.walkSpeed) * (run ? 1.5 : 1);
    a.p.pose(stroll ? 'stroll' : 'walk', { timeScale: run ? 1.5 : 1, fade: 0.3 });
    const step = Math.min(d, speed * dt);
    r.x += (dx / d) * step;
    r.z += (dz / d) * step;
    r.y = ground(r.x, r.z);
    return false;
  }
  const face = (a, tx, tz, dt) => {
    const want = angleTo(a.p.root.position.x, a.p.root.position.z, tx, tz);
    a.p.root.rotation.y += wrap(want - a.p.root.rotation.y) * Math.min(1, dt * 4);
  };

  const { braai, chairs = [], cooler, centre, rodSpots = [], shoreAt } = layout;
  // Something to cheer: set when an angler lands a fish.
  let celebrate = null; // { x, z, until }
  let clock = 0;

  // --- The braai master ----------------------------------------------------
  const standAtBraai = { x: braai.x, z: braai.z - 0.8 };
  if (pool.length) {
    const p = spawn(pick(pool, 'man-shorts'));
    if (p) {
      place(p, standAtBraai.x, standAtBraai.z, angleTo(standAtBraai.x, standAtBraai.z, braai.x, braai.z));
      agents.push({
        p, role: 'braai', step: 'grill', t: 6 + rng() * 6,
        update(dt) {
          this.t -= dt;
          if (this.step === 'grill') {
            face(this, braai.x, braai.z, dt);
            this.p.pose('work');
            this.p.hold('tongs');
            if (this.t <= 0) { this.step = rng() < 0.3 ? 'toCooler' : 'chat'; this.t = 6 + rng() * 6; this.sub = rng() < 0.35 ? 'laugh' : 'talk'; }
          } else if (this.step === 'chat') {
            face(this, centre.x, centre.z, dt);
            this.p.hold('beer');
            this.p.pose(celebrate ? 'cheer' : this.t > 4 ? 'drink' : this.sub);
            if (this.t <= 0) { this.step = 'grill'; this.t = 8 + rng() * 8; }
          } else if (this.step === 'toCooler') {
            this.p.hold(null);
            if (walkTo(this, cooler.x - 0.5, cooler.z - 0.3, dt)) { this.step = 'cooler'; this.t = 2.2; }
          } else if (this.step === 'cooler') {
            face(this, cooler.x, cooler.z, dt);
            this.p.pose('crouch');
            if (this.t <= 0) { this.p.hold('beer'); this.step = 'back'; }
          } else if (this.step === 'back') {
            if (walkTo(this, standAtBraai.x, standAtBraai.z, dt)) { this.step = 'grill'; this.t = 8 + rng() * 6; }
          }
        },
      });
    }
  }

  // --- The chair crowd -------------------------------------------------------
  const campers = Math.max(0, Math.min(maxPeople, layout.people || 4) - 1);
  const seatedCount = Math.min(chairs.length, Math.ceil(campers * 0.6));
  for (let i = 0; i < seatedCount && pool.length; i++) {
    const p = spawn(pick(pool));
    if (!p) continue;
    const chair = chairs[i];
    sitIn(p, chair);
    const snack = rng() < 0.5 ? 'can' : 'beer';
    agents.push({
      p, role: 'sit', t: rng() * 8, doing: 'sit',
      update(dt) {
        this.t -= dt;
        if (celebrate && clock < celebrate.until) { this.p.pose('sit', { upper: 'clap' }); this.p.hold(null); return; }
        if (this.t <= 0) {
          const r = rng();
          this.doing = r < 0.25 ? 'drink' : r < 0.42 ? 'eat' : r < 0.52 ? 'laugh' : r < 0.62 ? 'talk' : 'sit';
          this.variant = ['sit', 'sitRelaxed', 'sitLook', 'sitBreathe'][Math.floor(rng() * 4)];
          this.t = this.doing === 'sit' ? 8 + rng() * 10 : 5 + rng() * 5;
        }
        if (this.doing === 'drink') { this.p.hold(snack); this.p.pose('sit', { upper: 'drink' }); }
        else if (this.doing === 'eat') { this.p.hold('roll'); this.p.pose('sit', { upper: 'drink', timeScale: 1.2 }); }
        else if (this.doing === 'laugh' || this.doing === 'talk') { this.p.hold(null); this.p.pose('sit', { upper: this.doing }); }
        else { this.p.hold(null); this.p.pose(this.variant || 'sit'); }
      },
    });
  }

  // --- Somebody walking about -------------------------------------------------
  const spots = () => [
    { x: cooler.x - 0.5, z: cooler.z - 0.4, then: 'crouch' },
    { x: standAtBraai.x + 1.1, z: standAtBraai.z + 0.4, then: 'talk' },
    { x: centre.x + (rng() - 0.5) * 6, z: shoreAt(centre.x) - 1.6, then: 'lookAround' },
    { x: centre.x + (rng() - 0.5) * 6, z: centre.z + (rng() - 0.5) * 3, then: 'stretch' },
  ];
  const walkers = Math.max(0, campers - seatedCount - 0);
  for (let i = 0; i < Math.min(1, walkers) && pool.length; i++) {
    const p = spawn(pick(pool));
    if (!p) continue;
    place(p, centre.x + 1, centre.z + 1, rng() * 6);
    agents.push({
      p, role: 'walk', goal: null, t: 2,
      update(dt) {
        this.t -= dt;
        if (celebrate && clock < celebrate.until) {
          // Off to take the photo, from the camp side of the angler.
          const d = Math.max(0.1, Math.hypot(centre.x - celebrate.x, centre.z - celebrate.z));
          const tx = celebrate.x + ((centre.x - celebrate.x) / d) * 2.4, tz = celebrate.z + ((centre.z - celebrate.z) / d) * 2.4;
          if (walkTo(this, tx, tz, dt, { run: true })) { face(this, celebrate.x, celebrate.z, dt); this.p.pose('photo'); }
          this.p.hold(null);
          return;
        }
        if (!this.goal) {
          if (this.t > 0) return;
          const list = spots();
          this.goal = list[Math.floor(rng() * list.length)];
          this.arrived = false;
          this.stroll = rng() < 0.5;
        }
        if (!this.arrived) {
          if (walkTo(this, this.goal.x, this.goal.z, dt, { stroll: this.stroll })) { this.arrived = true; this.t = 3 + rng() * 5; }
          return;
        }
        if (this.goal.then === 'crouch') {
          this.p.pose('crouch');
          if (this.t < 1) { this.p.hold('can'); this.hasCan = true; }
        } else if (this.goal.then === 'talk') {
          face(this, braai.x, braai.z, dt);
          this.p.pose(this.hasCan ? 'drinkIdle' : 'talk');
        } else this.p.pose(this.goal.then);
        if (this.t <= 0) { this.goal = null; this.t = 1 + rng() * 3; }
      },
    });
  }

  // --- Kids ---------------------------------------------------------------
  const kidCount = (layout.people || 0) >= 4 ? Math.min(kids.length, (layout.people || 0) >= 6 ? 2 : 1) : 0;
  for (let i = 0; i < kidCount; i++) {
    const p = spawn(kids[i]);
    if (!p) continue;
    place(p, centre.x - 2 + i * 2, centre.z + 2, rng() * 6);
    agents.push({
      p, role: 'kid', goal: null, t: rng() * 3,
      update(dt) {
        this.t -= dt;
        if (celebrate && clock < celebrate.until) {
          if (walkTo(this, celebrate.x + (i ? 1.5 : -1.5), celebrate.z - 1.8, dt, { run: true })) { face(this, celebrate.x, celebrate.z, dt); this.p.pose('cheer'); }
          return;
        }
        if (!this.goal) {
          if (this.t > 0) { this.p.pose('idle'); return; }
          const x = centre.x + (rng() - 0.5) * 16;
          this.goal = { x, z: Math.min(centre.z + (rng() - 0.3) * 8, shoreAt(x) - 1.5), run: rng() < 0.5 };
        }
        if (walkTo(this, this.goal.x, this.goal.z, dt, { run: this.goal.run })) {
          this.goal = null;
          this.t = 2 + rng() * 6;
          this.p.pose(rng() < 0.3 ? 'lookAround' : 'idle');
        }
      },
    });
  }

  // --- Anglers at the rod pods ------------------------------------------------
  const species = (location.speciesIds || []).map((id) => FISH_SPECIES.find((s) => s.id === id)).filter(Boolean);
  const BAIT_FISH = ['common-carp', 'mirror-carp', 'mozambique-tilapia', 'banded-tilapia', 'catfish', 'smallmouth-yellowfish', 'largescale-yellowfish', 'mudfish'];
  const podFish = species.filter((s) => BAIT_FISH.includes(s.id));
  const share = location.catchShare || {};
  function rollFish() {
    const list = podFish.length ? podFish : species;
    if (!list.length) return null;
    const w = list.map((s) => share[s.id] ?? 1);
    let r = rng() * w.reduce((a, b) => a + b, 0);
    let s = list[0];
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) { s = list[i]; break; } }
    return { species: s, weightKg: Math.round(randomWeightFor(s, 1.8, rng) * 100) / 100 };
  }

  for (const spot of rodSpots) {
    if (!pool.length) break;
    const p = spawn(pick(pool, rng() < 0.5 ? 'man-vest' : 'man-check'));
    if (!p) continue;
    const rod = makeRod();
    scene.add(rod.root);
    rod.root.matrixAutoUpdate = false;
    const line = makeLine(scene);
    const lead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), leadMat);
    scene.add(lead);
    const podButt = new THREE.Vector3(spot.x + 0.3, ground(spot.x, spot.z) + 0.38, spot.z - 1.2);
    const podDir = new THREE.Vector3(0, Math.sin(0.2), Math.cos(0.2));
    const standAt = { x: spot.x + 0.3, z: spot.z - 1.6 };
    const castAt = () => {
      const out = 28 + rng() * 32;
      const x = spot.x + (rng() - 0.5) * 18;
      return new THREE.Vector3(x, 0, shoreAt(x) + out);
    };
    let target = castAt();
    sitIn(p, spot.chair);
    agents.push({
      p, role: 'angler', rod, line, lead, step: 'wait', t: 20 + rng() * 80, fish: null, fishPos: new THREE.Vector3(),
      rodAngle: 0.6, bend: 0, castT: 0, held: null,
      update(dt, near) {
        this.t -= dt;
        const pr = this.p.root.position;
        const tip = () => rod.tip.getWorldPosition(tmp3);
        switch (this.step) {
          case 'wait': {
            // In the chair; the rod on the pod, line out to the lead.
            this.p.pose(this.t % 30 < 6 ? 'sit' : 'sitRelaxed', this.t % 40 < 5 ? { upper: 'drink' } : {});
            this.p.hold(this.t % 40 < 5 ? 'can' : null);
            aimRod(rod, podButt, podDir, 0.05, UP.clone().negate());
            lead.position.set(target.x, -0.05, target.z);
            setLine(line, tip(), lead.position, 0.4);
            if (this.t <= 0) {
              this.fish = rollFish();
              if (!this.fish) { this.t = 60; break; }
              this.step = 'run';
              this.p.hold(null);
            }
            break;
          }
          case 'run': {
            // A take: the tip pulls round and the angler's up and at it.
            const twitch = Math.sin(clock * 30) * 0.15;
            aimRod(rod, podButt, podDir, 0.35 + twitch, tmp.copy(target).sub(podButt));
            setLine(line, tip(), lead.position, 0.05);
            if (walkTo(this, standAt.x, standAt.z, dt, { run: true })) {
              this.step = 'fight';
              this.fishPos.copy(target);
              const kg = this.fish.weightKg;
              this.t = Math.min(90, 15 + kg * 7 + rng() * 15);
              this.fightLen = this.t;
            }
            break;
          }
          case 'fight': {
            // Playing it in: the fish swims toward the bank, side to side,
            // the rod pumping and bending under it.
            const prog = 1 - Math.max(0, this.t) / this.fightLen;
            const bankZ = shoreAt(this.fishPos.x) + 1.5;
            const goalZ = target.z + (bankZ - target.z) * prog;
            this.fishPos.z += (goalZ - this.fishPos.z) * Math.min(1, dt * 0.8);
            this.fishPos.x += Math.sin(clock * 0.35 + this.fightLen) * dt * 1.6;
            this.fishPos.y = -0.3;
            face(this, this.fishPos.x, this.fishPos.z, dt);
            this.p.pose('idle');
            const pump = Math.sin(clock * 1.3);
            this.rodAngle = 0.95 + pump * 0.25;
            this.bend = 0.9 + Math.max(0, -pump) * 0.4 + (1 - prog) * 0.2;
            this.holdRod(this.rodAngle, this.bend);
            setLine(line, tip(), this.fishPos, 0.02);
            lead.visible = false;
            if (near && rng() < dt * (prog > 0.7 ? 0.9 : 0.15)) hooks.splash(this.fishPos.clone().setY(0), prog > 0.7 ? 1 : 0.5);
            if (rng() < dt * 0.6) hooks.ripple(this.fishPos.x, this.fishPos.z, 0.6);
            if (this.t <= 0) { this.step = 'land'; this.t = 2.6; }
            break;
          }
          case 'land': {
            // Down to the water's edge to lift it out.
            this.p.pose('crouch');
            this.holdRod(0.4, 0.2, true);
            setLine(line, tip(), this.fishPos, 0.02);
            if (this.t <= 0) {
              this.step = 'show';
              this.t = 6;
              const f = createFishMesh(this.fish.species.id);
              const len = estimateLengthCm(this.fish.species, this.fish.weightKg) / 100;
              f.scale.setScalar(len / 0.62);
              f.userData.len = len;
              scene.add(f);
              this.held = f;
              hooks.splash(this.fishPos.clone().setY(0), 1);
              celebrate = { x: pr.x, z: pr.z, heading: this.p.root.rotation.y, until: clock + 6 };
              hooks.onCatch({ species: this.fish.species, weightKg: this.fish.weightKg, x: pr.x, z: pr.z });
              line.visible = false;
              // Rod laid down on the bank beside him.
              aimRod(rod, tmp.set(pr.x - 0.8, ground(pr.x - 0.8, pr.z) + 0.05, pr.z - 0.3), new THREE.Vector3(0.1, 0.02, 1), 0);
            }
            break;
          }
          case 'show': {
            // Held up across the chest for the photo.
            face(this, centre.x, centre.z, dt);
            this.p.pose('idle');
            this.p.root.updateMatrixWorld(true);
            const f = this.held;
            const fwd = tmp.set(Math.sin(this.p.root.rotation.y), 0, Math.cos(this.p.root.rotation.y));
            const right = tmp2.crossVectors(fwd, UP).normalize();
            const chest = this.p.bonePos('Spine2', new THREE.Vector3()).addScaledVector(fwd, 0.3).add(new THREE.Vector3(0, 0.02, 0));
            f.position.copy(chest);
            f.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right.clone().negate());
            const half = f.userData.len * 0.36;
            this.p.reach('R', chest.clone().addScaledVector(right, half), chest.clone().addScaledVector(right, 0.6).add(new THREE.Vector3(0, -0.5, 0)));
            this.p.reach('L', chest.clone().addScaledVector(right, -half), chest.clone().addScaledVector(right, -0.6).add(new THREE.Vector3(0, -0.5, 0)));
            if (this.t <= 0) { this.step = 'release'; this.t = 2.2; }
            break;
          }
          case 'release': {
            if (walkTo(this, standAt.x, shoreAt(standAt.x) - 0.6, dt)) {
              this.p.pose('crouch');
              if (this.held) {
                this.held.position.y -= dt * 0.4;
                if (this.t <= 0) {
                  hooks.splash(this.held.position.clone().setY(0), 0.8);
                  scene.remove(this.held);
                  this.held = null;
                  this.step = 'toRod';
                }
              }
            } else this.t = 2.2;
            break;
          }
          case 'toRod':
            if (walkTo(this, standAt.x, standAt.z, dt)) { this.step = 'cast'; this.castT = 0; target = castAt(); line.visible = true; }
            break;
          case 'cast': {
            // Overhead cast: rod back over the shoulder, then punched
            // forward; the lead arcs out and plops in.
            this.castT += dt;
            face(this, target.x, target.z, dt);
            this.p.pose('idle');
            const c = this.castT;
            const angle = c < 1.2 ? 0.7 + (c / 1.2) * 1.9 : c < 1.45 ? 2.6 - ((c - 1.2) / 0.25) * 2.1 : 0.5;
            this.holdRod(angle, c > 1.2 && c < 1.45 ? 0.6 : 0.05, false, true);
            const fly = Math.min(1, Math.max(0, (c - 1.4) / 1.8));
            const t0 = tip();
            if (c < 1.4) lead.position.copy(t0).add(new THREE.Vector3(0, -0.6, 0));
            else {
              lead.position.lerpVectors(t0, target, fly);
              lead.position.y = t0.y * (1 - fly) + Math.sin(fly * Math.PI) * 9;
            }
            lead.visible = true;
            setLine(line, t0, lead.position, 0.1 + fly * 0.3);
            if (fly >= 1) {
              hooks.ripple(target.x, target.z, 0.8);
              lead.position.y = -0.05;
              this.step = 'back';
            }
            break;
          }
          case 'back':
            // Rod back on the pod, and back to the chair.
            aimRod(rod, podButt, podDir, 0.05);
            setLine(line, tip(), lead.position, 0.4);
            if (walkTo(this, spot.chair.x - 0.6, spot.chair.z - 0.6, dt)) { sitIn(this.p, spot.chair); this.step = 'wait'; this.t = 45 + rng() * 150; }
            break;
          default:
        }
      },
      // Rod in both hands, butt at the hip: angle up from level toward
      // the fish (or back over the head casting).
      holdRod(angle, bend, low = false, casting = false) {
        const r = this.p.root;
        r.updateMatrixWorld(true);
        const fwd = new THREE.Vector3(Math.sin(r.rotation.y), 0, Math.cos(r.rotation.y));
        const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
        const hip = this.p.bonePos('Pelvis', new THREE.Vector3());
        const butt = casting
          ? hip.clone().add(new THREE.Vector3(0, 0.55, 0)).addScaledVector(right, 0.12).addScaledVector(fwd, 0.1)
          : hip.clone().add(new THREE.Vector3(0, low ? -0.15 : 0.05, 0)).addScaledVector(fwd, 0.18).addScaledVector(right, 0.1);
        const dir = fwd.clone().multiplyScalar(Math.cos(angle)).add(new THREE.Vector3(0, Math.sin(angle), 0));
        aimRod(rod, butt, dir, bend, casting ? null : tmp.copy(this.fishPos).sub(butt));
        const rh = rodPoint(rod, 0.45, new THREE.Vector3());
        const lh = rodPoint(rod, casting ? 0.05 : 0.85, new THREE.Vector3());
        this.p.reach('R', rh, hip.clone().addScaledVector(right, 0.7).add(new THREE.Vector3(0, -0.2, 0)));
        this.p.reach('L', lh, hip.clone().addScaledVector(right, -0.7).add(new THREE.Vector3(0, -0.2, 0)));
      },
    });
  }

  // Each frame: everyone does their thing. Far off (or behind the hills),
  // the motions are only stepped now and then.
  let farTick = 0;
  function update(dt, camera) {
    clock += dt;
    if (celebrate && clock > celebrate.until + 1) celebrate = null;
    const cx = centre.x, cz = centre.z;
    const dist = camera ? Math.hypot(camera.position.x - cx, camera.position.z - cz) : 0;
    const near = dist < 140;
    farTick += dt;
    const animate = near || farTick > 0.25;
    // Motions first, then the behaviour (which puts anglers' hands back
    // on the rod after the motion moved them).
    for (const a of agents) {
      if (animate) a.p.update(near ? dt : farTick);
      a.update(dt, near);
    }
    if (animate) farTick = 0;
  }

  return {
    update,
    agents,
    // Splashes, ripples and the "somebody caught one" news from the game.
    setHooks(h) { Object.assign(hooks, h); },
  };
}

// An angler working a lure from a boat (gfx/boats.js): casts out ahead,
// works it back with twitches of the rod, and every so often hooks one --
// rod hooped over, a fish splashing at the boat, held up, slipped back.
// `p` is a person already standing in the boat.
export function createLureAngler(scene, p, { rng = Math.random, species = [], hooks = {} } = {}) {
  // A 2.1 m spinning rod: the carp blank, shorter.
  const rod = makeRod(0.6);
  rod.root.matrixAutoUpdate = false;
  scene.add(rod.root);
  const line = makeLine(scene);
  const lure = new THREE.Vector3();
  let step = 'cast', t = 0, held = null, fish = null;
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), hip = new THREE.Vector3();
  const tip = () => rod.tip.getWorldPosition(tmp3);
  function frame() {
    p.root.updateMatrixWorld(true);
    const e = p.root.matrixWorld.elements;
    fwd.set(e[8], 0, e[10]).normalize();
    right.crossVectors(fwd, UP).normalize();
    p.bonePos('Pelvis', hip);
  }
  function holdRod(angle, bend, casting = false, toward = null) {
    const butt = casting
      ? hip.clone().add(new THREE.Vector3(0, 0.55, 0)).addScaledVector(right, 0.12)
      : hip.clone().add(new THREE.Vector3(0, 0.08, 0)).addScaledVector(fwd, 0.2).addScaledVector(right, 0.08);
    // Spinning rods are shorter than the carp rod: the blank is scaled down.
    const dir = fwd.clone().multiplyScalar(Math.cos(angle)).add(new THREE.Vector3(0, Math.sin(angle), 0));
    aimRod(rod, butt, dir, bend, toward);
    p.reach('R', rodPoint(rod, 0.3, new THREE.Vector3()), hip.clone().addScaledVector(right, 0.7).add(new THREE.Vector3(0, -0.2, 0)));
    p.reach('L', rodPoint(rod, casting ? 0.04 : 0.6, new THREE.Vector3()), hip.clone().addScaledVector(right, -0.7).add(new THREE.Vector3(0, -0.2, 0)));
  }
  return {
    p,
    update(dt) {
      t += dt;
      frame();
      p.pose('idle');
      if (step === 'cast') {
        const angle = t < 0.8 ? 0.6 + (t / 0.8) * 1.8 : t < 1.0 ? 2.4 - ((t - 0.8) / 0.2) * 2 : 0.4;
        holdRod(angle, 0, true);
        if (t > 1.0) {
          const out = 14 + rng() * 14;
          lure.copy(p.root.getWorldPosition(new THREE.Vector3())).addScaledVector(fwd, out).addScaledVector(right, (rng() - 0.5) * out * 0.6).setY(0);
          hooks.ripple?.(lure.x, lure.z, 0.4);
          step = 'work'; t = 0;
        }
        setLine(line, tip(), t > 0.95 ? lure : tip(), 0.1);
      } else if (step === 'work') {
        // Twitch, wind, twitch: the lure comes back toward the boat.
        const twitch = Math.max(0, Math.sin(t * 5)) * 0.25;
        holdRod(0.35 + twitch, 0.05, false);
        const me = p.root.getWorldPosition(tmp2);
        lure.lerp(tmp.copy(me).setY(0), dt * 0.08);
        setLine(line, tip(), lure, 0.15);
        if (rng() < dt * 0.02 && species.length) {
          const s = species[Math.floor(rng() * species.length)];
          fish = { species: s, weightKg: Math.round(randomWeightFor(s, 1.8, rng) * 100) / 100 };
          step = 'fight'; t = 0;
        } else if (t > 9 + rng() * 6 || lure.distanceTo(tmp.copy(me).setY(0)) < 4) { step = 'cast'; t = 0; }
      } else if (step === 'fight') {
        const pump = Math.sin(t * 1.6);
        holdRod(1.0 + pump * 0.2, 1.0 + Math.max(0, -pump) * 0.3, false, tmp.copy(lure).sub(hip));
        const me = p.root.getWorldPosition(tmp2);
        lure.lerp(tmp.copy(me).setY(0), dt * 0.12);
        lure.x += Math.sin(t * 0.7) * dt;
        setLine(line, tip(), lure, 0.01);
        if (rng() < dt * 0.4) hooks.splash?.(lure.clone(), 0.6);
        if (t > 10 + fish.weightKg * 4) { step = 'show'; t = 0; }
      } else if (step === 'show') {
        line.visible = false;
        if (!held) {
          held = createFishMesh(fish.species.id);
          const len = estimateLengthCm(fish.species, fish.weightKg) / 100;
          held.scale.setScalar(len / 0.62);
          held.userData.len = len;
          scene.add(held);
          hooks.onCatch?.({ ...fish, x: lure.x, z: lure.z, boat: true });
        }
        const chest = p.bonePos('Spine2', new THREE.Vector3()).addScaledVector(fwd, 0.3);
        held.position.copy(chest);
        held.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right.clone().negate());
        const half = held.userData.len * 0.36;
        aimRod(rod, hip.clone().addScaledVector(right, 0.4), new THREE.Vector3(0, 1, 0).addScaledVector(fwd, 0.3), 0);
        p.reach('R', chest.clone().addScaledVector(right, half), chest.clone().addScaledVector(right, 0.6).add(new THREE.Vector3(0, -0.5, 0)));
        p.reach('L', chest.clone().addScaledVector(right, -half), chest.clone().addScaledVector(right, -0.6).add(new THREE.Vector3(0, -0.5, 0)));
        if (t > 4) {
          hooks.splash?.(held.position.clone().setY(0), 0.6);
          scene.remove(held);
          held = null;
          line.visible = true;
          step = 'cast'; t = 0;
        }
      }
    },
    dispose() { scene.remove(rod.root, line); if (held) scene.remove(held); },
  };
}
