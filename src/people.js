import * as THREE from '../vendor/three.module.js';
import { assetTag } from './versionCheck.js';

// The campsite people: real-looking men, women and kids (Microsoft
// Rocketbox, MIT licence, converted in Blender by
// tools/blender/build_campers.py) and the motions they share -- walking,
// sitting, drinking, braaiing, cheering. Loaded before a game on the better
// graphics settings; the camp falls back to its Blender-built figures when
// they aren't here.
//
// A person (makePerson) plays a motion for the whole body, or a lower-body
// one with another on top (sitting while drinking), holds things in the
// hand (a beer, a boerewors roll, braai tongs), and can reach for a point
// with either arm (two-bone IK) -- that's how anglers keep both hands on
// a rod.

export const PEOPLE = ['man-shorts', 'man-jacket', 'man-vest', 'man-check', 'man-denim', 'man-chinos', 'woman-jacket', 'woman-green', 'boy', 'girl'];
export const isWoman = (name) => name.startsWith('woman') || name === 'girl';
export const isKid = (name) => name === 'boy' || name === 'girl';

let loader = null;
let cloneSkinned = null;
let clips = null; // name -> AnimationClip
let walkSpeed = {};
const bases = new Map(); // name -> gltf scene

async function loadOne(name) {
  if (bases.has(name)) return;
  const gltf = await loader.loadAsync(`assets/people/${name}.glb${assetTag()}`);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Skinned bounds don't follow the motions: never cull a person by a
    // T-pose box.
    o.frustumCulled = false;
    const m = o.material;
    if (m && m.alphaTest > 0) m.side = THREE.DoubleSide;
  });
  bases.set(name, gltf.scene);
}

// Loads the motions and these people; gives up quietly after `timeoutMs`.
export async function loadPeople(names = PEOPLE, timeoutMs = 15000) {
  try {
    if (!loader) {
      const [{ GLTFLoader }, SkeletonUtils] = await Promise.all([
        import('../vendor/addons/loaders/GLTFLoader.js'),
        import('../vendor/addons/utils/SkeletonUtils.js'),
      ]);
      loader = new GLTFLoader();
      cloneSkinned = SkeletonUtils.clone;
    }
    const work = (async () => {
      if (!clips) {
        const [m, info] = await Promise.all([
          loader.loadAsync(`assets/people/motions.glb${assetTag()}`),
          fetch(`assets/people/motions.json${assetTag()}`).then((r) => r.json()).catch(() => ({})),
        ]);
        clips = Object.fromEntries(m.animations.map((c) => [c.name, c]));
        walkSpeed = info.walkSpeed || {};
      }
      await Promise.allSettled(names.map((n) => loadOne(n).catch((err) => console.warn(`Person ${n} not loaded:`, err?.message || err))));
    })();
    await Promise.race([work, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  } catch (err) {
    console.warn('Campsite people not loaded:', err?.message || err);
  }
}

export const peopleReady = () => !!clips && bases.size > 0;
export const loadedPeople = () => [...bases.keys()];

// Bones that belong to the upper body (everything from the chest up).
const UPPER = /Spine1|Spine2|Neck|Head|Clavicle|UpperArm|Forearm|ForeTwist|Hand|Finger|Eye|Ponytail|Jaw/;
const trackBone = (t) => t.name.slice(0, t.name.lastIndexOf('.'));

// Clip variants, made once: the upper or lower half, or the whole clip
// with the hips lowered for a child.
const variants = new Map();
function clipVariant(name, part, hipScale) {
  const key = `${name}|${part}|${hipScale.toFixed(2)}`;
  if (variants.has(key)) return variants.get(key);
  const src = clips[name];
  if (!src) return null;
  let tracks = src.tracks;
  if (part === 'upper') tracks = tracks.filter((t) => UPPER.test(trackBone(t)));
  if (part === 'lower') tracks = tracks.filter((t) => !UPPER.test(trackBone(t)));
  if (hipScale !== 1) {
    tracks = tracks.map((t) => {
      if (!/Pelvis\.position$/.test(t.name) && !/^Bip01\.position$/.test(t.name)) return t;
      const c = t.clone();
      for (let i = 1; i < c.values.length; i += 3) c.values[i] *= hipScale;
      return c;
    });
  }
  const clip = new THREE.AnimationClip(`${name}-${part}`, src.duration, tracks);
  variants.set(key, clip);
  return clip;
}

// Things to hold, built small and simple (they're a hand's width).
const PROP_MATS = {};
const mat = (key, opts) => (PROP_MATS[key] ||= new THREE.MeshStandardMaterial(opts));
function makeProp(kind) {
  const g = new THREE.Group();
  if (kind === 'beer') {
    // A brown quart-style bottle with a label.
    const glass = mat('glass', { color: 0x3a1c08, roughness: 0.15, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 12), glass);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 10), glass);
    neck.position.y = 0.12;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0325, 0.0325, 0.07, 12, 1, true), mat('label', { color: 0xe8dcc0, roughness: 0.7 }));
    g.add(body, neck, label);
  } else if (kind === 'can') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14), mat('can', { color: 0xc0201a, roughness: 0.3, metalness: 0.6 })));
  } else if (kind === 'roll') {
    // A boerewors roll: the bun and the coiled sausage poking out.
    const bun = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 10), mat('bun', { color: 0xd9a35f, roughness: 0.8 }));
    bun.rotation.z = Math.PI / 2;
    const wors = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.17, 4, 8), mat('wors', { color: 0x5a2414, roughness: 0.5 }));
    wors.rotation.z = Math.PI / 2;
    wors.position.y = 0.02;
    g.add(bun, wors);
    g.rotation.y = Math.PI / 2;
  } else if (kind === 'tongs') {
    const steel = mat('steel', { color: 0xb8b8bc, roughness: 0.35, metalness: 0.9 });
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.004), steel);
      arm.position.set(s * 0.012, 0.16, 0);
      arm.rotation.z = s * 0.05;
      g.add(arm);
    }
  } else if (kind === 'plate') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.015, 16), mat('plate', { color: 0xf0f0ea, roughness: 0.5 })));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Where a held thing sits in the hand bone's own frame, in metres (the
// Biped hand points down the fingers along +x, thumb toward +z; the bones
// are in centimetres, so hold() scales up to match). Upright things stand
// along the hand's z, the way fingers wrap round a bottle.
const GRIP = {
  R: { pos: new THREE.Vector3(0.055, -0.03, -0.02), rot: new THREE.Euler(Math.PI / 2, 0, 0) },
  L: { pos: new THREE.Vector3(0.055, -0.03, 0.02), rot: new THREE.Euler(-Math.PI / 2, 0, 0) },
};

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pole = new THREE.Vector3();

// Turns `bone` (in world space) so the direction `from` now points along `to`.
function swing(bone, from, to) {
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q);
  const parentQ = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(_q2));
  bone.updateMatrixWorld(true);
}

export function makePerson(name) {
  const base = bases.get(name);
  if (!base || !clips) return null;
  const model = cloneSkinned(base);
  const root = new THREE.Group();
  root.add(model);
  const bone = {};
  model.traverse((o) => { if (o.isBone) bone[o.name] = o; });
  const B = (n) => bone[`Bip01_${n}`];
  // A child's hips sit lower than the adult the motions were recorded on.
  root.updateMatrixWorld(true);
  const restHip = B('Pelvis').getWorldPosition(new THREE.Vector3()).y;
  const hipScale = isKid(name) ? Math.min(1, restHip / 0.98) : 1;
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();
  const action = (clip, part) => {
    const key = `${clip}|${part}`;
    if (!actions.has(key)) {
      const c = clipVariant(clip, part, hipScale);
      actions.set(key, c ? mixer.clipAction(c) : null);
    }
    return actions.get(key);
  };
  const female = isWoman(name);
  // The woman's version of a motion when there is one (walkF, sitF...).
  const own = (clip) => (female && clips[`${clip}F`] ? `${clip}F` : clip);

  let current = []; // the actions playing now
  let poseKey = '';
  // Plays `base` for the whole body, or `base` for the legs and hips with
  // `upper` for the chest, arms and head. Cross-fades from what was on.
  function pose(baseClip, { upper = null, fade = 0.45, timeScale = 1, once = false } = {}) {
    const key = `${baseClip}|${upper}|${timeScale}`;
    if (key === poseKey) return;
    poseKey = key;
    const next = upper
      ? [action(own(baseClip), 'lower'), action(own(upper), 'upper')]
      : [action(own(baseClip), 'full')];
    for (const a of current) if (!next.includes(a)) a.fadeOut(fade);
    for (const a of next) {
      if (!a) continue;
      a.timeScale = timeScale;
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = once;
      if (!current.includes(a)) {
        // Start loops at a random point so a crowd doesn't move in step.
        a.reset();
        if (!once) a.time = Math.random() * a.getClip().duration;
        a.setEffectiveWeight(1).fadeIn(fade).play();
      }
    }
    current = next.filter(Boolean);
  }

  // Held things.
  const held = { R: null, L: null };
  function hold(kind, side = 'R') {
    if (held[side]?.userData.kind === kind) return;
    if (held[side]) { held[side].parent?.remove(held[side]); held[side] = null; }
    if (!kind) return;
    const p = makeProp(kind);
    p.userData.kind = kind;
    const g = GRIP[side];
    const hand = B(`${side}_Hand`);
    root.updateMatrixWorld(true);
    const unit = 1 / (hand.getWorldScale(new THREE.Vector3()).x / root.getWorldScale(new THREE.Vector3()).x);
    const holder = new THREE.Group();
    holder.position.copy(g.pos).multiplyScalar(unit);
    holder.rotation.copy(g.rot);
    holder.scale.setScalar(unit);
    holder.add(p);
    holder.userData.kind = kind;
    hand.add(holder);
    held[side] = holder;
  }

  // Two-bone IK: put this hand on `target` (world), the elbow bending
  // toward `pole` (world). Call after update().
  function reach(side, target, pole) {
    const upper = B(`${side}_UpperArm`), lower = B(`${side}_Forearm`), hand = B(`${side}_Hand`);
    if (!upper || !lower || !hand) return;
    upper.getWorldPosition(_a);
    lower.getWorldPosition(_b);
    hand.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    const toT = _d.copy(target).sub(_a);
    const dist = Math.min(Math.max(toT.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
    const dir = toT.normalize();
    const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    _pole.copy(pole).sub(_a);
    _pole.addScaledVector(dir, -_pole.dot(dir)).normalize();
    const elbow = _a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(_pole, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
    swing(upper, _b.clone().sub(_a), elbow.clone().sub(_a));
    lower.getWorldPosition(_b);
    hand.getWorldPosition(_c);
    swing(lower, _c.clone().sub(_b), target.clone().sub(_b));
  }

  const bonePos = (n, out = new THREE.Vector3()) => B(n).getWorldPosition(out);

  return {
    name, root, model, mixer, pose, hold, reach, bonePos, female, kid: isKid(name),
    walkSpeed: walkSpeed[own('walk')] || 1.1,
    strollSpeed: walkSpeed[own('stroll')] || 0.8,
    update(dt) { mixer.update(dt); root.updateMatrixWorld(true); },
  };
}
