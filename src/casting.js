import * as THREE from '../vendor/three.module.js';
import { waterSurfaceY } from './water.js';
import { simulateCast, launchSpeed, DRAG } from './castPhysics.js';

const TWITCH_COOLDOWN = 0.35;
const TWITCH_KICK_UP = 0.14;
const TWITCH_KICK_SIDE = 0.08;
const TWITCH_DECAY_PER_SEC = 7;
const REEL_HOLD_THRESHOLD = 0.18; // press-and-hold longer than this starts reeling in
const REEL_SPEED = 3.2; // units/sec the lure closes toward the rod tip while reeling
const REEL_ARRIVE_DISTANCE = 0.35;
const WAKE_INTERVAL = 0.18; // seconds between wake ripples while reeling
const LINE_SEGMENTS = 28;
const POWER_CHARGE_SECONDS = 1.3; // hold this long for a full-power cast

// Mouse-motion control. Speeds are in screen-widths per second.
const MOTION_REEL_THRESHOLD = 0.12; // sweep faster than this to work a lure
const MOTION_REEL_GAIN = 7; // lure retrieve speed per unit of mouse speed
const MOTION_REEL_MAX = 5.5; // units/sec cap on motion retrieve
const MOTION_SWAY_GAIN = 3.0; // sideways mouse sweep -> lure swings across
const MOTION_SWAY_DECAY = 5;
const BAIT_WIGGLE_GAIN = 0.35; // bait only wiggles under mouse motion
const FLICK_POWER_GAIN = 0.28; // upward flick on release adds cast power
const FLICK_POWER_MAX = 0.35;

// Float physics: a buoyancy spring toward the water surface, lightly damped
// so it bobs a few times after landing or being twitched.
const FLOAT_REST = 0.005; // black band sits right on the waterline
const FLOAT_K = 110;
const FLOAT_DAMP = 5;

export function createCasting({ scene, camera, domElement, getRod, rodTip, waterMesh, dam, onSplash, onWake, getLureKind = () => 'bait', getCastMultiplier = () => 1, isLookLocked = () => false,
  getCastDrag = () => null, onLanded = null }) {
  const bobber = createFloatMesh();
  bobber.visible = false;
  scene.add(bobber);

  // The line is drawn as a curve (not a straight segment) so it visibly
  // bends/sags between casts and pulls taut while being reeled in. It's a
  // thin camera-facing ribbon rather than a 1px GL line, kept about two
  // pixels wide at any distance so it stays readable where it lies across
  // the water. It draws after the water surface, and the stretch a fish has
  // dragged under shows faintly through it (per-vertex alpha).
  const LINE_POINTS = LINE_SEGMENTS + 1;
  const linePts = Array.from({ length: LINE_POINTS }, () => new THREE.Vector3());
  const lineUnder = new Float32Array(LINE_POINTS);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 2 * 3), 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 2 * 4), 4));
  const lineIdx = [];
  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const a = i * 2;
    lineIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  lineGeo.setIndex(lineIdx);
  const lineMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
  });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.frustumCulled = false;
  line.renderOrder = 20; // after the (transparent) water surface
  line.visible = false;
  scene.add(line);
  const ribbonTangent = new THREE.Vector3();
  const ribbonView = new THREE.Vector3();
  const ribbonSide = new THREE.Vector3();

  function buildLineRibbon() {
    const pos = lineGeo.getAttribute('position');
    const col = lineGeo.getAttribute('color');
    for (let i = 0; i < LINE_POINTS; i++) {
      const p = linePts[i];
      ribbonTangent.subVectors(linePts[Math.min(LINE_POINTS - 1, i + 1)], linePts[Math.max(0, i - 1)]);
      ribbonView.subVectors(camera.position, p);
      const dist = ribbonView.length();
      ribbonSide.crossVectors(ribbonTangent, ribbonView);
      if (ribbonSide.lengthSq() < 1e-12) ribbonSide.set(1, 0, 0);
      // ~2px wide wherever it is: world width grows with distance.
      const half = Math.max(0.0008, dist * 0.0011);
      ribbonSide.normalize().multiplyScalar(half);
      pos.setXYZ(i * 2, p.x - ribbonSide.x, p.y - ribbonSide.y, p.z - ribbonSide.z);
      pos.setXYZ(i * 2 + 1, p.x + ribbonSide.x, p.y + ribbonSide.y, p.z + ribbonSide.z);
      const under = lineUnder[i];
      const alpha = under ? 0.3 : 0.9;
      const shade = under ? 0.7 : 0.95;
      for (let k = 0; k < 2; k++) col.setXYZW(i * 2 + k, shade, shade, shade * 0.95, alpha);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  const rodTipWorld = new THREE.Vector3();
  const target = new THREE.Vector3();
  const restPosition = new THREE.Vector3();
  const twitchOffset = new THREE.Vector3();
  const aimPoint = new THREE.Vector3(0, 0, -10);
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const fightOffset = new THREE.Vector3();
  const curvePointA = new THREE.Vector3();
  const curvePointB = new THREE.Vector3();
  const curvePointC = new THREE.Vector3();
  const curveOut = new THREE.Vector3();

  let phase = 'idle';
  let airTime = 0;
  let airDuration = 1.2;
  let flightPath = [];
  const launchTarget = new THREE.Vector3();
  const launchFrom = new THREE.Vector3();
  let floatY = 0;
  let floatVy = 0;
  let rippleTimer = 0;
  let thrashTimer = 1;
  let lastWind = { windSpeed: 0, windDirX: 1, windDirZ: 0 };
  let biteCallback = null;
  let twitchCallback = null;
  let twitchCooldown = 0;
  let fightProfile = null;
  let fightTimer = 0;
  // How long the bobber has been fishable (waiting/reeling, actually in the
  // water) since the current cast landed -- drives the guaranteed-bite timer.
  let waitTimer = 0;

  let pressing = false;
  let pressTimer = 0;
  let wakeTimer = 0;
  let castArmed = false;
  let power = 0;
  const hangOffset = new THREE.Vector3(0, -0.15, 0.05);

  // Mouse motion state: where the cursor is (NDC) and how fast it's moving.
  const mouseNDC = new THREE.Vector2(0, 0);
  let moveDxAcc = 0; // accumulated since last update, in screen widths
  let moveDyAcc = 0;
  let motionSpeed = 0; // smoothed, screen-widths/sec
  let flickUp = 0; // recent upward speed, for the cast flick bonus
  let lureSway = 0; // sideways offset of a worked lure
  const swayPerp = new THREE.Vector3();
  const motionToTip = new THREE.Vector3();

  // Open water only -- the dry bank is land, whatever the water mesh under
  // it says.
  function isPointInWater(point) {
    return dam.isWater(point.x, point.z);
  }

  // What the lure would come down onto at (x, z): the water surface, or the
  // ground (or a stand's deck) on land.
  const surfaceHeight = (x, z) => (dam.isWater(x, z) ? 0 : dam.floorHeight(x, z));

  // Height a lure sits/travels at for a given xz: on the water surface in
  // the open; on land it lies on the ground, lifting through the air toward
  // the rod tip as the last few metres of line come in.
  function lureHeightAt(point) {
    if (isPointInWater(point)) return 0.02;
    const restY = dam.floorHeight(point.x, point.z) + 0.05;
    const toTip = Math.hypot(point.x - rodTipWorld.x, point.z - rodTipWorld.z);
    const f = 1 - Math.min(1, toTip / 6);
    return restY + f * f * Math.max(0, rodTipWorld.y - restY);
  }

  // What habitat a point in the water is: which zone (open water vs lily
  // pads / timber / reeds) and how deep it is (0 at the bank, 1 out in the
  // deepest water). Feeds the position-based bite bonuses in fish.js.
  function habitatAt(point) {
    return { zone: dam.zoneAt(point.x, point.z).type, depthFactor: dam.depthFactorAt(point.x, point.z) };
  }

  // ─── Cast flight ──────────────────────────────────────────────────────────
  // The cursor picks the direction; how far it goes is physics: the rod's
  // launch speed x the power you built up (reel and line add a little), then
  // gravity, air drag on the rig and the wind decide where it comes down.
  const castDir = new THREE.Vector3();
  function flightFor(castPower, yawJitter = 0) {
    castDir.subVectors(aimPoint, camera.position);
    castDir.y = 0;
    if (castDir.lengthSq() < 1e-6) {
      camera.getWorldDirection(castDir);
      castDir.y = 0;
    }
    castDir.normalize();
    if (yawJitter) {
      const c = Math.cos(yawJitter), sn = Math.sin(yawJitter);
      castDir.set(castDir.x * c - castDir.z * sn, 0, castDir.x * sn + castDir.z * c);
    }
    const kind = getLureKind();
    return simulateCast({
      from: rodTipWorld,
      dirX: castDir.x, dirZ: castDir.z,
      speed: launchSpeed(getRod(), castPower, getCastMultiplier()),
      // A heavy rig (mieliebom feeder) has its own, lower drag.
      drag: getCastDrag() ?? DRAG[kind] ?? DRAG.bait,
      wind: { x: lastWind.windDirX * lastWind.windSpeed * 0.35, z: lastWind.windDirZ * lastWind.windSpeed * 0.35 },
      surfaceAt: surfaceHeight,
    });
  }

  // Where a cast at this power would come down (no scatter) -- the aim ring.
  function computeLanding(aim, castPower, out) {
    const { landing } = flightFor(castPower);
    return out.set(landing.x, landing.y, landing.z);
  }

  // Aim ring on the water: shows exactly where the cast will land.
  // Drawn on top of everything (no depth test, late render order) so the
  // dock lip or reeds can never hide where you're aiming.
  const reticle = new THREE.Group();
  const reticleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  reticleRing.rotation.x = -Math.PI / 2;
  reticleRing.renderOrder = 999;
  reticle.add(reticleRing);
  const reticleDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  reticleDot.rotation.x = -Math.PI / 2;
  reticleDot.renderOrder = 999;
  reticle.add(reticleDot);
  reticle.position.y = 0.06;
  reticle.visible = false;
  scene.add(reticle);

  function releaseCastAt(aim) {
    if (phase !== 'aiming') return;
    // Real casts scatter a little: more with a soft fibreglass rod, least
    // with the pinpoint bass rod; and no two releases are quite the same.
    const spread = ((getRod().spread ?? 2) * Math.PI) / 180;
    const flight = flightFor(power * (0.97 + Math.random() * 0.06), (Math.random() + Math.random() - 1) * spread);
    flightPath = flight.path;
    airDuration = Math.max(0.2, flight.time);
    launchFrom.copy(rodTipWorld);
    launchTarget.set(flight.landing.x, flight.landing.y, flight.landing.z);
    phase = 'inAir';
    airTime = 0;
    power = 0;
    bobber.visible = true;
    line.visible = true;
  }

  function triggerBite(bite) {
    if (phase !== 'waiting' && phase !== 'reeling') return;
    phase = 'biting';
    fightProfile = bite || { speed: 'medium', style: 'steady' };
    fightTimer = 0;
    thrashTimer = 0.3;
    restPosition.copy(bobber.position);
    waitTimer = 0;
    if (biteCallback) biteCallback();
  }

  function onBite(callback) {
    biteCallback = callback;
  }

  function onTwitch(callback) {
    twitchCallback = callback;
  }

  function tapRod() {
    if (phase !== 'waiting' || twitchCooldown > 0) return false;
    twitchCooldown = TWITCH_COOLDOWN;
    twitchOffset.set((Math.random() - 0.5) * TWITCH_KICK_SIDE, TWITCH_KICK_UP, (Math.random() - 0.5) * TWITCH_KICK_SIDE);
    if (twitchCallback) twitchCallback();
    return true;
  }

  function resetToIdle() {
    phase = 'idle';
    bobber.rotation.set(0, 0, 0);
    floatVy = 0;
    bobber.visible = false;
    line.visible = false;
    twitchOffset.set(0, 0, 0);
    fightOffset.set(0, 0, 0);
    fightProfile = null;
    pressing = false;
    pressTimer = 0;
    power = 0;
    waitTimer = 0;
  }

  function surfaceAt(p, now) {
    return waterSurfaceY(p.x, p.z, now, dam.waterDist(p.x, p.z));
  }

  // The line hangs from the rod tip to the float in a sagging curve, bowed
  // sideways by the wind. Wherever that curve would dip below the water it
  // lies on the surface instead -- slack line floats, it doesn't sink
  // through the dam. (The very end still follows the float if a fish has
  // pulled it under.)
  function updateLineCurve(sagAmount) {
    const now = performance.now() / 1000;
    curvePointA.copy(rodTipWorld);
    curvePointB.copy(bobber.position);
    curvePointC.lerpVectors(curvePointA, curvePointB, 0.5);
    curvePointC.y -= sagAmount;
    const bow = sagAmount * lastWind.windSpeed * 0.05;
    curvePointC.x += lastWind.windDirX * bow;
    curvePointC.z += lastWind.windDirZ * bow;

    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      const inv = 1 - t;
      curveOut.set(
        inv * inv * curvePointA.x + 2 * inv * t * curvePointC.x + t * t * curvePointB.x,
        inv * inv * curvePointA.y + 2 * inv * t * curvePointC.y + t * t * curvePointB.y,
        inv * inv * curvePointA.z + 2 * inv * t * curvePointC.z + t * t * curvePointB.z,
      );
      lineUnder[i] = 0;
      if (isPointInWater(curveOut)) {
        // Lies *on* the surface, just clear of the swell's crests so the
        // water can't swallow it -- except the end a fish has pulled under.
        const surf = surfaceAt(curveOut, now);
        const floor = surf + 0.014;
        if (i < LINE_SEGMENTS - 1 && curveOut.y < floor) curveOut.y = floor;
        else if (curveOut.y < surf) lineUnder[i] = 1;
      }
      linePts[i].copy(curveOut);
    }
    buildLineRibbon();
  }

  // Buoyancy: spring the float toward the local water surface (plus `sink`,
  // negative when something is pulling it under), let it rock on the swell
  // and lean toward a tight line, and ring the water when it bobs hard.
  const leanDir = new THREE.Vector3();
  function floatOnWater(dt, sink, lean) {
    const now = performance.now() / 1000;
    const target = surfaceAt(bobber.position, now) + FLOAT_REST + sink;
    const steps = Math.ceil(dt / 0.01);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      floatVy += ((target - floatY) * FLOAT_K - floatVy * FLOAT_DAMP) * h;
      floatY += floatVy * h;
    }
    bobber.position.y = floatY;
    leanDir.subVectors(rodTipWorld, bobber.position);
    leanDir.y = 0;
    if (leanDir.lengthSq() > 1e-6) leanDir.normalize();
    const rockX = Math.sin(now * 1.7 + bobber.position.x) * 0.06;
    const rockZ = Math.sin(now * 1.3 + bobber.position.z) * 0.06;
    bobber.rotation.set(leanDir.z * lean + rockX, 0, -leanDir.x * lean + rockZ);
    rippleTimer -= dt;
    if (Math.abs(floatVy) > 0.18 && rippleTimer <= 0 && onWake) {
      onWake(bobber.position, 0.5);
      rippleTimer = 0.35;
    }
  }

  function update(deltaSeconds, windState) {
    rodTip.getWorldPosition(rodTipWorld);
    if (windState) lastWind = windState;

    // Clock only runs while there's actually a fishable line in the water --
    // pauses if the lure's up on the sand or the rod's just hanging.
    if ((phase === 'waiting' || phase === 'reeling') && isBobberInWater()) {
      waitTimer += deltaSeconds;
    }

    // Turn this frame's mouse travel into a smoothed speed, then reset.
    const dt = Math.max(deltaSeconds, 1e-3);
    const rawSpeed = Math.hypot(moveDxAcc, moveDyAcc) / dt;
    motionSpeed += (rawSpeed - motionSpeed) * Math.min(1, dt * 12);
    const upSpeed = Math.max(0, -moveDyAcc) / dt;
    flickUp = Math.max(flickUp * Math.max(0, 1 - dt * 6), upSpeed);
    const frameDx = moveDxAcc;
    moveDxAcc = 0;
    moveDyAcc = 0;

    if (twitchCooldown > 0) {
      twitchCooldown = Math.max(0, twitchCooldown - deltaSeconds);
    }

    if (pressing && phase === 'waiting') {
      pressTimer += deltaSeconds;
      if (pressTimer > REEL_HOLD_THRESHOLD) {
        phase = 'reeling';
        wakeTimer = 0;
      }
    }

    if (phase === 'aiming' && pressing) {
      power = Math.min(1, power + deltaSeconds / POWER_CHARGE_SECONDS);
    }

    // Aim ring: visible whenever a cast is possible, sitting where it would
    // land. While charging it pulses and creeps out toward the cursor.
    const canCast = phase === 'idle' || phase === 'hanging' || phase === 'aiming';
    reticle.visible = canCast;
    if (canCast) {
      // Walking and turning move the view without any pointer event, so
      // re-aim through the screen centre every frame.
      if (isLookLocked()) updateAimFromPointer(0, 0);
      computeLanding(aimPoint, phase === 'aiming' ? power : 0, reticle.position);
      reticle.position.y = 0.06;
      // Grow with distance so the ring reads the same size near or far.
      const distFromCamera = reticle.position.distanceTo(camera.position);
      const sizeForDistance = 0.9 + distFromCamera * 0.06;
      const pulse = phase === 'aiming' ? 1 + Math.sin(performance.now() * 0.012) * 0.12 + power * 0.4 : 1;
      reticle.scale.setScalar(sizeForDistance * pulse);
      reticleRing.material.opacity = phase === 'aiming' ? 0.95 : 0.75;
    }

    if (phase === 'inAir') {
      // Ballistic arc: shoots out fast and slows under air drag, rising to
      // its apex and dropping onto the water, drifting with the wind.
      airTime += deltaSeconds;
      const t = Math.min(1, airTime / airDuration);
      // Follow the simulated flight path (sampled at 60Hz): a hard cast
      // covers it fast, a soft lob hangs in the air.
      const fi = Math.min(flightPath.length - 1, airTime * 60);
      const i0 = Math.floor(fi), i1 = Math.min(flightPath.length - 1, i0 + 1), fr = fi - i0;
      const p0 = flightPath[i0], p1 = flightPath[i1];
      target.set(p0.x + (p1.x - p0.x) * fr, p0.y + (p1.y - p0.y) * fr, p0.z + (p1.z - p0.z) * fr);
      bobber.position.copy(target);
      bobber.rotation.set(t * 7, 0, t * 2);
      updateLineCurve(0.1 * t);
      if (t >= 1) {
        phase = 'waiting';
        bobber.position.y = 0;
        restPosition.copy(bobber.position);
        twitchOffset.set(0, 0, 0);
        waitTimer = 0;
        const landedInWater = isPointInWater(bobber.position);
        if (landedInWater) {
          // Plops in: dives under, then bobs back up and settles.
          floatY = 0;
          floatVy = -1.0 - Math.min(0.8, launchFrom.distanceTo(launchTarget) * 0.02);
          if (onSplash) onSplash(bobber.position, 0.65);
        }
        if (onLanded) onLanded(bobber.position.clone(), landedInWater);
      }
    }

    if (phase === 'waiting') {
      const lureKind = getLureKind();
      const working = lureKind === 'lure' && motionSpeed > MOTION_REEL_THRESHOLD;

      if (working) {
        // Working a lure: mouse sweeps retrieve it, sideways sweeps swing it.
        motionToTip.subVectors(rodTipWorld, restPosition);
        motionToTip.y = 0;
        const dist = motionToTip.length();
        if (dist <= REEL_ARRIVE_DISTANCE) {
          phase = 'hanging';
          twitchOffset.set(0, 0, 0);
          fightOffset.set(0, 0, 0);
          lureSway = 0;
          castArmed = false;
          return;
        }
        motionToTip.normalize();
        const retrieve = Math.min(MOTION_REEL_MAX, motionSpeed * MOTION_REEL_GAIN);
        restPosition.addScaledVector(motionToTip, retrieve * deltaSeconds);
        lureSway += frameDx * MOTION_SWAY_GAIN;

        wakeTimer += deltaSeconds;
        if (wakeTimer >= WAKE_INTERVAL) {
          wakeTimer = 0;
          if (onWake && isPointInWater(restPosition)) onWake(restPosition);
        }
      } else if (lureKind === 'bait' && motionSpeed > MOTION_REEL_THRESHOLD) {
        // Bait just wiggles a little when you move the rod -- it's meant to sit.
        twitchOffset.x += (Math.random() - 0.5) * BAIT_WIGGLE_GAIN * deltaSeconds;
        twitchOffset.z += (Math.random() - 0.5) * BAIT_WIGGLE_GAIN * deltaSeconds;
      }

      lureSway *= Math.max(0, 1 - MOTION_SWAY_DECAY * deltaSeconds);
      motionToTip.subVectors(rodTipWorld, restPosition);
      motionToTip.y = 0;
      motionToTip.normalize();
      swayPerp.set(-motionToTip.z, 0, motionToTip.x);

      const decay = Math.max(0, 1 - TWITCH_DECAY_PER_SEC * deltaSeconds);
      twitchOffset.multiplyScalar(decay);
      bobber.position.copy(restPosition).add(twitchOffset).addScaledVector(swayPerp, lureSway);
      if (isPointInWater(bobber.position)) {
        // A twitch jerks the float toward the rod and ducks it under.
        const duck = -twitchOffset.y * 0.8;
        floatOnWater(deltaSeconds, duck, working ? 0.35 : 0.1);
        updateLineCurve(working ? 0.08 : 0.6);
      } else {
        // On the sand (after a reel-in was stopped short) it lies on its
        // side on top of the bank, not under it.
        bobber.position.y = lureHeightAt(bobber.position);
        bobber.rotation.set(0, 0, 1.35);
        floatY = bobber.position.y;
        floatVy = 0;
        updateLineCurve(0.05);
      }
    }

    if (phase === 'reeling' && !pressing) {
      phase = 'waiting';
      restPosition.copy(bobber.position);
    }

    if (phase === 'reeling') {
      const toTip = new THREE.Vector3().subVectors(rodTipWorld, bobber.position);
      toTip.y = 0;
      const dist = toTip.length();
      if (dist <= REEL_ARRIVE_DISTANCE) {
        // Settle into a dangling-at-the-rod-tip state rather than hiding the
        // line outright -- and crucially, don't let the mouse press that's
        // still held from reeling arm a new cast on its eventual release.
        phase = 'hanging';
        twitchOffset.set(0, 0, 0);
        fightOffset.set(0, 0, 0);
        castArmed = false;
        return;
      }
      toTip.normalize();
      bobber.position.addScaledVector(toTip, REEL_SPEED * deltaSeconds);
      if (isPointInWater(bobber.position)) {
        // Skims the surface, dragged low and leaning into the pull.
        floatOnWater(deltaSeconds, -0.015, 0.55);
      } else {
        // Dragged onto the sand it lifts through the air to the rod tip
        // instead of tunnelling under it.
        bobber.position.y = lureHeightAt(bobber.position);
        bobber.rotation.set(0, 0, 0);
        floatY = bobber.position.y;
        floatVy = 0;
      }

      wakeTimer += deltaSeconds;
      if (wakeTimer >= WAKE_INTERVAL) {
        wakeTimer = 0;
        if (onWake && isPointInWater(bobber.position)) onWake(bobber.position, 0.7);
      }

      restPosition.copy(bobber.position);
      updateLineCurve(0.05); // taut while actively reeled
    }

    if (phase === 'hanging') {
      bobber.position.copy(rodTipWorld).add(hangOffset);
      bobber.rotation.set(0, 0, 0);
      updateLineCurve(0.02);
    }

    if (phase === 'biting') {
      fightTimer += deltaSeconds;
      const speedFreq = { fast: 7, medium: 4, slow: 2 }[fightProfile.speed] || 4;
      const styleAmp = { aggressive: 0.4, heavy: 0.22, steady: 0.14, nibble: 0.08 }[fightProfile.style] || 0.16;
      const jitter = fightProfile.style === 'aggressive' ? 0.5 : fightProfile.style === 'nibble' ? 0.3 : 0.08;

      fightOffset.x = Math.sin(fightTimer * speedFreq) * styleAmp + (Math.random() - 0.5) * jitter * 0.15;
      fightOffset.z = Math.cos(fightTimer * speedFreq * 0.75) * styleAmp * 0.7;
      fightOffset.y = 0;
      bobber.position.copy(restPosition).add(fightOffset);

      // The float goes under the way each fish bites: nibbles dip it in
      // little stabs, a steady fish slides it under, a heavy one holds it
      // down, and an aggressive strike buries it and keeps yanking.
      const style = fightProfile.style;
      let sink;
      if (style === 'nibble') sink = -0.02 - 0.07 * Math.max(0, Math.sin(fightTimer * 8)) ** 2;
      else if (style === 'steady') sink = -0.1 - 0.04 * Math.sin(fightTimer * 2);
      else if (style === 'heavy') sink = -0.17;
      else sink = -0.2 + 0.06 * Math.sin(fightTimer * 6);
      floatOnWater(deltaSeconds, sink, 0.6);

      // Fighters thrash at the surface now and then.
      thrashTimer -= deltaSeconds;
      if (thrashTimer <= 0) {
        const violent = style === 'aggressive';
        thrashTimer = violent ? 0.6 + Math.random() * 1.4 : 1.8 + Math.random() * 2.5;
        if (style !== 'nibble' && onSplash) onSplash(bobber.position, violent ? 0.9 : 0.55);
        else if (onWake) onWake(bobber.position, 0.8);
      }
      updateLineCurve(0.03); // taut -- there's a fish pulling
    }
  }

  function updateAimFromPointer(clientX, clientY) {
    if (!waterMesh) return;
    if (isLookLocked()) {
      // Mouse-look: you aim with your head, at the centre of the screen.
      pointerNDC.set(0, 0);
    } else {
      const rect = domElement.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(waterMesh)[0];
    if (hit) {
      aimPoint.copy(hit.point);
      return;
    }
    // Cursor is off the water. Pointing down at the bank aims at that spot
    // on the ground (the cast then clamps to the water's edge); pointing at
    // the far bank or the horizon means "as far as I can in that direction".
    const dir = raycaster.ray.direction;
    if (dir.y < -1e-4) {
      const t = -camera.position.y / dir.y;
      aimPoint.copy(camera.position).addScaledVector(dir, t);
      aimPoint.y = 0;
      return;
    }
    const flatLen = Math.hypot(dir.x, dir.z);
    if (flatLen < 1e-6) return;
    aimPoint.set(camera.position.x + (dir.x / flatLen) * 200, 0, camera.position.z + (dir.z / flatLen) * 200);
  }

  let fightHoldCallback = null;
  let fightHolding = false;

  // Hold-click reels a hooked fish too -- same gesture as reeling in the line.
  function onFightHold(callback) {
    fightHoldCallback = callback;
  }

  // The one "rod button": the left mouse button on desktop, the Cast/Reel
  // button on touch screens. Press = start charging a cast / start reeling /
  // hold a fighting fish; release = cast / twitch / ease off.
  function pressStart(clientX = 0, clientY = 0) {
    if (phase === 'idle' || phase === 'hanging') {
      updateAimFromPointer(clientX, clientY);
      phase = 'aiming';
      power = 0;
      pressing = true;
      castArmed = true;
    } else if (phase === 'waiting') {
      pressing = true;
      pressTimer = 0;
      castArmed = false;
    } else if (phase === 'biting') {
      fightHolding = true;
      castArmed = false;
      if (fightHoldCallback) fightHoldCallback(true);
    } else {
      castArmed = false;
    }
  }

  // Rod/lure motion from a mouse move or a finger drag, in pixels.
  function addMotion(dx, dy) {
    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    moveDxAcc += dx / rect.width;
    moveDyAcc += dy / rect.width;
  }

  domElement.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // right button looks around, never casts
    pressStart(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // With the mouse captured the rod rides with the view, centred.
      if (isLookLocked()) mouseNDC.set(0, 0);
      else {
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }
      addMotion(e.movementX, e.movementY);
    }
    // The cursor is the aim: keep the landing point tracking it whenever a
    // cast is possible, not only once the button is down.
    if (phase === 'aiming' || phase === 'idle' || phase === 'hanging') updateAimFromPointer(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    pressEnd();
  });

  function pressEnd() {
    if (phase === 'aiming' && castArmed) {
      // The longer this was held, the further it casts (power meter), and
      // a sharp upward flick on release adds a bit on top.
      // Only a press that actually started idle/hanging arms a cast -- a
      // press that was mid-reel never does, even if it's still held down
      // when the reel-in finishes and drops into 'hanging'.
      power = Math.min(1, power + Math.min(FLICK_POWER_MAX, flickUp * FLICK_POWER_GAIN));
      releaseCastAt(aimPoint);
    } else if (phase === 'waiting' && pressing && pressTimer <= REEL_HOLD_THRESHOLD) {
      tapRod();
    }
    if (fightHolding) {
      fightHolding = false;
      if (fightHoldCallback) fightHoldCallback(false);
    }
    castArmed = false;
    pressing = false;
  }

  function isBobberInWater() {
    return bobber.visible && isPointInWater(bobber.position);
  }

  function getState() {
    return {
      phase, power, motionSpeed, waitElapsed: waitTimer,
      working: phase === 'waiting' && getLureKind() === 'lure' && motionSpeed > MOTION_REEL_THRESHOLD,
    };
  }

  // Cursor position (NDC, -1..1) so the rod in hand can follow the mouse.
  function getMouseOffset() {
    return { x: mouseNDC.x, y: mouseNDC.y };
  }

  return {
    update, getState, onBite, triggerBite,
    resetToIdle, onTwitch, tapRod, bobberPosition: bobber.position,
    updateAimFromPointer, aimPoint, onFightHold, isBobberInWater, getMouseOffset,
    getPredictedLanding: (out) => computeLanding(aimPoint, phase === 'aiming' ? power : 0, out || new THREE.Vector3()),
    getBobberHabitat: () => habitatAt(bobber.position),
    isPointInWater,
    pressStart, pressEnd, addMotion,
  };
}

// A classic painted float: white keel under the water, red cap above a black
// band, and a fluorescent antenna tip that still shows up after dark.
function createFloatMesh() {
  const profile = [
    [0.0, -0.075], [0.022, -0.062], [0.04, -0.035], [0.046, -0.005], [0.044, 0.02],
    [0.032, 0.048], [0.014, 0.066], [0.006, 0.07], [0.005, 0.15], [0.0, 0.152],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 16);
  const pos = geo.getAttribute('position');
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.004) colors.push(0.9, 0.9, 0.88);
    else if (y < 0.008) colors.push(0.05, 0.05, 0.05);
    else if (y < 0.069) colors.push(0.85, 0.06, 0.04);
    else colors.push(1.0, 0.45, 0.05);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const float = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff6010, emissiveIntensity: 2.5 }),
  );
  tip.position.y = 0.15;
  float.add(tip);
  float.castShadow = true;
  return float;
}
