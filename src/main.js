import * as THREE from '../vendor/three.module.js';
import { createScene, createPlayerRod } from './scene.js';
import { createWater, updateWater, createSplashEffect } from './water.js';
import { createPostPipeline } from './gfx/post.js';
import { windUniforms } from './gfx/wind.js';
import { createEnvironment, TIME_OF_DAY_PHASES } from './environment.js';
import { FISH_SPECIES, rollDamBite, randomWeightFor, pickGuaranteedBite, estimateLengthCm } from './fish.js';
import { RODS, LINES, REELS, HOOKS, LURES, getGearById } from './gear.js';
import { calculatePayout } from './economy.js';
import { loadSave, saveSave } from './save.js';
import { createCasting } from './casting.js';
import { createMinigame } from './minigame.js';
import { createHUD, renderCatchLog, createActionBar, showCatchCard, createTipBubble } from './ui.js';
import { randomTip } from './tips.js';
import { createTouchControls, isTouchDevice, isSmallOrMobileScreen } from './touchControls.js';
import { createTackleBox } from './tackleBox.js';
import { createFishSwarm, updateFishSwarm, createCatchReveal } from './fish3d.js';
import { createPlayerController } from './player.js';
import { getLocationById } from './locations.js';
import { showStartMenu } from './startMenu.js';
import { showMainMenu } from './mainMenu.js';
import { createDam } from './dam.js';
import { seedFromString } from './gfx/noise.js';
import { createChumSystem, CHUM_COST } from './chum.js';
import { createPauseMenu } from './pauseMenu.js';

const appEl = document.getElementById('app');
const save = loadSave();

const touchMode = isTouchDevice();
document.body.classList.toggle('touch', touchMode);

// Every launch opens on the title screen.
openMainMenu();

// Phones and tablets: go fullscreen and landscape when fishing starts. Both
// need the tap that started the game, so this runs before the heavy setup.
function enterImmersive() {
  if (!touchMode) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen?.({ navigationUI: 'hide' });
    p?.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch { /* not supported (iPhone Safari) -- plays fine in the browser */ }
}

function openMainMenu() {
  showMainMenu(appEl, {
    save,
    onContinue: () => { enterImmersive(); startGame(save.locationId, save.startTimeOfDay || 'morning'); },
    onNewGame: () => showStartMenu(appEl, ({ locationId, timeOfDay }) => {
      enterImmersive();
      save.locationId = locationId;
      save.startTimeOfDay = timeOfDay;
      saveSave(save);
      startGame(locationId, timeOfDay);
    }, { onBack: openMainMenu }),
  });
}

// Settings "auto" = light graphics on phones and small tablets, full on
// everything else. ?quality=low|high in the URL overrides.
function resolveQuality() {
  const urlQuality = new URLSearchParams(window.location.search).get('quality');
  const setting = urlQuality || save.settings.quality || 'auto';
  if (setting === 'auto') return isSmallOrMobileScreen() ? 'low' : 'high';
  return setting === 'low' ? 'low' : 'high';
}

// Warm the browser cache with this dam's fish pictures so the catch card
// shows its photo instantly. Small WebP first; PNG only if there's no WebP.
function preloadFishImages(speciesList) {
  const load = () => speciesList.forEach((s) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/fish/${s.id}.webp`;
  });
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 5000 });
  else setTimeout(load, 3000);
}

function startGame(locationId, startTimeOfDay) {
  const location = getLocationById(locationId);
  const localSpecies = FISH_SPECIES.filter((s) => location.speciesIds.includes(s.id));
  // We fish the open dam itself, from its bank and angling stands.
  const dam = createDam(location.dam, seedFromString(location.id));

  const quality = resolveQuality();
  preloadFishImages(localSpecies);
  const world = createScene({ location, dam, quality });
  const { scene, camera } = world;
  const waterLook = location.scenery?.water || {};
  const water = createWater(scene, dam, {
    coldColor: location.waterTint.cold,
    warmColor: location.waterTint.warm,
    clarity: waterLook.clarity ?? 0.6,
    algae: waterLook.algae ?? 0,
  });
  const { waterMesh, setWaterTemperature } = water;
  const environment = createEnvironment({ startTimeOfDay });

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Tone mapping and sRGB output happen in the post pipeline's final pass.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  // Soft shadows cost a lot of fill-rate on phone GPUs.
  renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  appEl.appendChild(renderer.domElement);
  const post = createPostPipeline(renderer);
  if (quality === 'low') water.setReflectionScale(0.33);

  const playerController = createPlayerController({ camera, domElement: renderer.domElement, dam, turnSpeed: save.settings.turnSpeed });

  const splashEffect = createSplashEffect(scene);
  const fishSwarm = createFishSwarm(scene, localSpecies.map((s) => s.id), 24, dam);
  const catchReveal = createCatchReveal(scene, (point, strength) => splashEffect.spawn(point, strength));
  const chumSystem = createChumSystem(scene);
  const playerRod = createPlayerRod(camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize();
  });

  let activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
  let activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
  let activeReel = getGearById(REELS, save.equippedReelId) || REELS[0];
  let activeHook = getGearById(HOOKS, save.equippedHookId) || HOOKS[0];
  let activeLureId = save.equippedLureId || LURES[0].id;

  const casting = createCasting({
    scene, camera, domElement: renderer.domElement,
    getRod: () => activeRod,
    rodTip: playerRod.tip,
    waterMesh,
    dam,
    onSplash: (point, strength = 1) => splashEffect.spawn(point, strength),
    onWake: (point, size = 1) => splashEffect.ripple(point, size),
    getLureKind: () => (getGearById(LURES, activeLureId) || LURES[0]).kind,
    // Reel and line add launch speed on top of what the rod itself can throw.
    getCastMultiplier: () => (activeReel.castMultiplier || 1) * (activeLine.castMultiplier || 1),
    // Touch screens always aim through the screen centre, like mouse-look.
    isLookLocked: () => touchMode || playerController.isLocked(),
  });
  const touchControls = touchMode
    ? createTouchControls({ container: appEl, domElement: renderer.domElement, player: playerController, casting })
    : null;
  const minigame = createMinigame();
  const hud = createHUD(appEl, { showHints: save.settings.showHints, touch: touchMode });

  function onSaveChanged() {
    saveSave(save);
    activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
    activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
    activeReel = getGearById(REELS, save.equippedReelId) || REELS[0];
    activeHook = getGearById(HOOKS, save.equippedHookId) || HOOKS[0];
    activeLureId = save.equippedLureId || LURES[0].id;
    playerRod.setRod(activeRod);
  }
  playerRod.setRod(activeRod);

  const rawTackleBox = createTackleBox({ container: appEl, save, onSaveChanged });

  // Menus need the mouse pointer: hand it back whenever a panel opens.
  function freeMouseIfPanelOpen() {
    if (appEl.querySelector('.shop-panel:not(.hidden)')) playerController.releasePointer();
  }
  const tackleBox = { ...rawTackleBox, toggle: () => { rawTackleBox.toggle(); freeMouseIfPanelOpen(); } };

  // Crosshair while the mouse is captured; a "click to look" prompt when not.
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair hidden';
  const lookPrompt = document.createElement('div');
  lookPrompt.className = 'look-prompt';
  lookPrompt.textContent = 'Click to look around with the mouse · Esc for menu';
  appEl.append(crosshair, lookPrompt);
  if (touchMode) {
    // No mouse to capture: the aim dot is always on, and no click prompt.
    crosshair.classList.remove('hidden');
    lookPrompt.classList.add('hidden');
    const rotateHint = document.createElement('div');
    rotateHint.className = 'rotate-hint';
    rotateHint.textContent = 'Turn your phone sideways for the best view';
    appEl.appendChild(rotateHint);
  }
  playerController.onLockChange((locked) => {
    crosshair.classList.toggle('hidden', !locked);
    lookPrompt.classList.toggle('hidden', locked);
  });
  // Esc while looking around: the browser frees the mouse; open the menu.
  let lockLostAt = -Infinity;
  playerController.onLockLost(() => {
    lockLostAt = performance.now();
    if (!paused) setPaused(true);
  });

  const catchLogPanel = document.createElement('div');
  catchLogPanel.className = 'shop-panel hidden';
  appEl.appendChild(catchLogPanel);
  function toggleCatchLog() {
    catchLogPanel.classList.toggle('hidden');
    freeMouseIfPanelOpen();
    if (!catchLogPanel.classList.contains('hidden')) {
      renderCatchLog(catchLogPanel, save.catchLog, { species: localSpecies, locationName: location.name });
      catchLogPanel.querySelector('[data-close]')?.addEventListener('click', () => catchLogPanel.classList.add('hidden'));
    }
  }

  function changeFishingSpot() {
    // Clear the remembered spot so the title screen offers New Game rather
    // than Continue; credits, gear and the catch log all persist.
    save.locationId = null;
    save.startTimeOfDay = null;
    saveSave(save);
    window.location.reload();
  }

  let paused = false;
  function setPaused(value) {
    paused = value;
    if (paused) {
      playerController.releasePointer();
      pauseMenu.show();
    } else {
      pauseMenu.hide();
    }
  }
  // Opened from the Esc menu: close the menu and show the panel.
  const fromMenu = (open) => () => { setPaused(false); open(); };
  const pauseMenu = createPauseMenu(appEl, {
    locationName: location.name,
    // The Resume click is a user gesture, so the mouse can be captured again.
    onResume: () => { setPaused(false); playerController.lockPointer(); },
    onChangeSpot: () => changeFishingSpot(),
    items: [
      { label: 'Tackle Box &amp; Shop', onClick: fromMenu(() => tackleBox.toggle()) },
      { label: 'Catch Log', onClick: fromMenu(() => toggleCatchLog()) },
    ],
    // The session lives in this page, so going back to the title reloads it.
    onMainMenu: () => window.location.reload(),
  });

  function throwChum() {
    const phase = casting.getState().phase;
    if (phase === 'inAir' || phase === 'biting' || phase === 'reeling') return;
    if (save.credits < CHUM_COST) {
      hud.showToast(`Not enough credits for breadcrumbs (${CHUM_COST})`);
      return;
    }
    // Breadcrumbs go where the line is, or get flung by hand ~9m toward the
    // cursor.
    let target;
    if (phase === 'waiting') {
      target = casting.bobberPosition.clone();
    } else {
      const dir = casting.aimPoint.clone().sub(camera.position).setY(0);
      if (dir.lengthSq() < 1e-6) camera.getWorldDirection(dir).setY(0);
      target = camera.position.clone().addScaledVector(dir.normalize(), 9).setY(0);
    }
    if (!casting.isPointInWater(target)) {
      hud.showToast("Can't chum dry land — aim at the water first");
      return;
    }
    save.credits -= CHUM_COST;
    saveSave(save);
    chumSystem.spawn(target);
    hud.showToast('Breadcrumbs thrown — fish will gather here');
  }

  // Everything that used to be keyboard-only, as buttons on screen too.
  const actionBar = createActionBar(appEl, [
    { id: 'tackle', label: 'Tackle box', key: 'B', onClick: () => { if (!paused) tackleBox.toggle(); } },
    { id: 'log', label: 'Catch log', key: 'C', onClick: () => { if (!paused) toggleCatchLog(); } },
    { id: 'chum', label: `Breadcrumbs · ${CHUM_COST} cr`, key: 'F', onClick: () => { if (!paused) throwChum(); } },
    { id: 'tip', label: "What's biting?", key: 'T', onClick: () => { if (!paused) showTip(); } },
    { id: 'menu', label: 'Menu', key: 'Esc', onClick: () => setPaused(!paused) },
  ]);

  // Phones: short labels so the buttons fit one row under the top bar.
  if (touchMode) {
    [['tackle', 'Tackle'], ['log', 'Log'], ['chum', `Chum ${CHUM_COST}cr`], ['tip', 'Tips'], ['menu', 'Menu']]
      .forEach(([id, label]) => actionBar.setLabel(id, label));
  }

  // "What's biting" hints: one soon after you arrive, then every 1.5-3
  // minutes at random while you fish, or on demand with T.
  const tipBubble = createTipBubble(appEl);
  let nextTipIn = 6;
  function showTip() {
    const { waterTempC, timeOfDay } = environment.getState();
    tipBubble.show(randomTip(location, { waterTempC, timeOfDay }, { ownedLureIds: save.ownedLureIds }));
    nextTipIn = 90 + Math.random() * 90;
  }
  function tickTips(delta) {
    nextTipIn -= delta;
    if (nextTipIn <= 0) showTip();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      // Some browsers also deliver the Esc that just freed the mouse (and
      // already opened the menu) -- don't let it close the menu again.
      if (performance.now() - lockLostAt < 400) return;
      setPaused(!paused);
      return;
    }
    if (paused) return;
    if (e.code === 'KeyB') { tackleBox.toggle(); }
    if (e.code === 'KeyC') { toggleCatchLog(); }
    if (e.code === 'KeyL') { changeFishingSpot(); }
    if (e.code === 'KeyF') { throwChum(); }
    if (e.code === 'KeyT') { showTip(); }
    if (e.code === 'Space') { minigame.setHolding(true); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') minigame.setHolding(false);
  });

  let bitingSpecies = null;
  let twitchBoostTimer = 0;
  let rodRecoil = 0;

  casting.onTwitch(() => {
    twitchBoostTimer = 2.0;
    rodRecoil = 0.28;
  });
  casting.onFightHold((holding) => minigame.setHolding(holding));

  casting.onBite(() => {
    const species = bitingSpecies;
    if (!species) { casting.resetToIdle(); return; }

    // Tigerfish teeth bite straight through anything but a proper wire trace
    // rig -- no amount of reeling skill saves you without one.
    if (species.requiresWireTrace && !activeHook.isWireTrace) {
      hud.showToast(`${species.name} bit clean through your line! You need a Wire Trace Rig.`);
      casting.resetToIdle();
      bitingSpecies = null;
      return;
    }

    const weightKg = randomWeightFor(species);
    minigame.start({
      species, weightKg, rod: activeRod, line: activeLine, hook: activeHook, reel: activeReel,
      onSuccess: () => {
        const payout = calculatePayout({ species, weightKg, rod: activeRod, line: activeLine, hook: activeHook });
        save.credits += payout;
        const entry = save.catchLog[species.id] || { count: 0, bestWeightKg: 0 };
        const previousBestKg = entry.bestWeightKg;
        entry.count += 1;
        entry.bestWeightKg = Math.max(entry.bestWeightKg, weightKg);
        save.catchLog[species.id] = entry;
        saveSave(save);
        const phase = environment.getState().timeOfDay;
        playerController.releasePointer();
        showCatchCard(appEl, {
          species, weightKg, payout, previousBestKg,
          lengthCm: estimateLengthCm(species, weightKg),
          count: entry.count,
          locationName: location.name,
          timeLabel: phase.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        });
        catchReveal.spawn(species.id, casting.bobberPosition);
        casting.resetToIdle();
        bitingSpecies = null;
      },
      onFailure: (reason) => {
        saveSave(save);
        hud.showToast(reason === 'line-snapped' ? 'Line snapped!' : 'The fish got away.');
        casting.resetToIdle();
        bitingSpecies = null;
      },
    });
  });

  function startBite(species) {
    bitingSpecies = species;
    casting.triggerBite(species.bite);
    if (species.bite) hud.showToast(species.bite.label + '!');
  }

  // A cast that's sat this long is guaranteed a bite -- the exact moment
  // stays random (the escalating urgency below front-loads the odds, this
  // is just the backstop for a run of bad luck).
  const BITE_GUARANTEE_SECONDS = 90;

  function rollBitesIfWaiting(delta) {
    const castState = casting.getState();
    const phase = castState.phase;
    if (phase !== 'waiting' && phase !== 'reeling') return;
    if (!casting.isBobberInWater()) return; // nothing bites a lure on the bank
    const state = environment.getState();
    const habitat = casting.getBobberHabitat();
    const lureKind = (getGearById(LURES, activeLureId) || LURES[0]).kind;
    const chumMultiplier = chumSystem.multiplierAt(casting.bobberPosition);
    const waitElapsed = castState.waitElapsed || 0;
    // Ramps from 1x up to a steep 41x as the wait nears the guarantee, so a
    // bite becomes very likely well before the deadline without landing at a
    // predictable moment every time.
    const urgency = 1 + Math.pow(Math.min(1, waitElapsed / BITE_GUARANTEE_SECONDS), 4) * 40;
    const biteChanceMultiplier = (twitchBoostTimer > 0 ? 1.8 : 1) * chumMultiplier * urgency;
    const conditions = { waterTempC: state.waterTempC, equippedLureId: activeLureId, timeOfDay: state.timeOfDay, habitat, lureKind };
    const bite = rollDamBite(localSpecies, location.catchShare, { ...conditions, deltaSeconds: delta, biteChanceMultiplier });
    if (bite) {
      startBite(bite);
      return;
    }

    if (waitElapsed >= BITE_GUARANTEE_SECONDS) {
      const forced = pickGuaranteedBite(localSpecies, conditions, location.catchShare);
      if (forced) startBite(forced);
    }
  }

  let lastTime = performance.now();
  let lastSeason = null;
  let lastCastPhase = 'idle';
  let castSnap = 0;
  let lastCanChum = null;
  const rodAimScratch = new THREE.Vector3();
  const rodFishScratch = new THREE.Vector3();
  let timeOverride = null;
  let seasonOverride = null;

  // Adaptive quality: if the first few seconds run slow, drop the render
  // resolution and the reflection resolution once rather than stutter.
  let perfFrames = 0, perfTime = 0, perfDone = quality === 'low';
  function adaptQuality(delta) {
    if (perfDone) return;
    perfFrames++;
    if (perfFrames < 30) return; // skip shader-compile hitches at startup
    perfTime += delta;
    if (perfFrames < 150) return;
    perfDone = true;
    const avgMs = (perfTime / 120) * 1000;
    if (avgMs > 28) {
      pixelRatio = Math.max(0.75, pixelRatio * (avgMs > 45 ? 0.6 : 0.8));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      post.setSize();
      water.setReflectionScale(0.35);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    adaptQuality(delta);
    frame(delta, now / 1000);
  }

  function frame(delta, elapsed) {
    if (!paused) {
      environment.tick(delta);
      const envState = environment.getState();
      setWaterTemperature(envState.waterTempC);
      playerController.update(delta);
      const atmos = world.update({ delta, elapsed, envState, timeOverride });
      water.setAtmosphere(atmos, envState.windSpeed, windUniforms.uWindDir.value);
      updateWater(waterMesh, elapsed);
      post.setLook(atmos, elapsed, location.skyWarmth);
      updateFishSwarm(fishSwarm, elapsed, (point) => splashEffect.spawn(point, 0.8));
      catchReveal.update(delta);
      splashEffect.update(delta);
      chumSystem.update(delta, elapsed);
      const season = seasonOverride || envState.season;
      if (season !== lastSeason) {
        world.setSeason(season);
        lastSeason = season;
      }

      casting.update(delta, envState);
      rollBitesIfWaiting(delta);
      tickTips(delta);
      touchControls?.update();
      minigame.update(delta);

      const mgState = minigame.getState();
      const castState = casting.getState();

      // Rod feel. These are *targets* -- the rod springs toward them, so it
      // never jumps: swept back over the shoulder while charging a cast,
      // punched forward toward the water on release, flicked up on a twitch,
      // held high against a fighting fish. The blank's flex is simulated in
      // rod.js from the swing and from how hard the line is pulling.
      if (lastCastPhase === 'aiming' && castState.phase === 'inAir') castSnap = 1;
      lastCastPhase = castState.phase;
      castSnap = Math.max(0, castSnap - delta * 2.2);
      twitchBoostTimer = Math.max(0, twitchBoostTimer - delta);
      rodRecoil = Math.max(0, rodRecoil - delta * 2.5);
      const mouse = casting.getMouseOffset();
      // Positive pitch lifts the tip. Mouse up raises the rod a touch, a
      // twitch flicks it up, and the release punches it forward and down.
      let rodPitch = playerRod.restTilt + mouse.y * 0.1 + rodRecoil - castSnap * 0.8;
      let rodYaw = -mouse.x * 0.12;
      const lineOut = castState.phase === 'inAir' || castState.phase === 'waiting' || castState.phase === 'reeling' || castState.phase === 'biting';
      let linePull = 0;
      let pullTarget = lineOut ? casting.bobberPosition : null;
      if (castState.phase === 'aiming') {
        // Loading the cast: the rod sweeps back and the blank bows backward
        // under the lure's weight, ready to spring forward on release.
        // Up and back, almost over the shoulder at full power.
        rodPitch += 0.45 + castState.power * 0.95;
        playerRod.tip.getWorldPosition(rodFishScratch);
        camera.getWorldDirection(rodAimScratch);
        pullTarget = rodFishScratch.addScaledVector(rodAimScratch, -4).setY(rodFishScratch.y - 2.5);
        linePull = 0.04 + castState.power * 0.2;
      } else if (castState.phase === 'biting') {
        // Rod held high against the fish, higher still while pumping it in.
        rodPitch += 0.55 + (mgState.holding ? 0.15 : 0);
        // A hooked fish loads the blank hard -- harder the more line tension.
        linePull = 0.15 + (mgState.tension || 0) * 0.4 + (mgState.holding ? 0.06 : 0);
        // Swing the rod a little toward wherever the fish is running.
        camera.getWorldDirection(rodAimScratch);
        const toFish = rodFishScratch.subVectors(casting.bobberPosition, camera.position);
        const side = rodAimScratch.x * toFish.z - rodAimScratch.z * toFish.x;
        rodYaw += THREE.MathUtils.clamp(side / Math.max(1, toFish.length()), -0.4, 0.4) * 0.5;
      } else if (castState.phase === 'reeling') linePull = 0.06;
      else if (castState.phase === 'waiting') linePull = castState.working ? 0.07 : 0.015;
      else if (castState.phase === 'inAir') linePull = 0.02;
      // How much line is lying in the water, holding the tip back.
      let lineDrag = 0;
      if (casting.isBobberInWater()) {
        if (castState.phase === 'biting') lineDrag = 1;
        else if (castState.phase === 'reeling' || castState.working) lineDrag = 0.8;
        else if (castState.phase === 'waiting') lineDrag = 0.6;
      }
      playerRod.update(delta, { pitch: rodPitch, yaw: rodYaw, pullTarget, pull: linePull, lineDrag });
      if (castState.phase === 'reeling' || castState.working || (mgState.active && mgState.holding)) {
        playerRod.spinReel(delta * 14);
      }
      const canChum = save.credits >= CHUM_COST;
      if (canChum !== lastCanChum) { actionBar.setEnabled('chum', canChum); lastCanChum = canChum; }
      hud.update({
        credits: save.credits,
        season: envState.season,
        timeOfDay: envState.timeOfDay,
        waterTempC: envState.waterTempC,
        windSpeed: envState.windSpeed,
        windDirX: envState.windDirX,
        windDirZ: envState.windDirZ,
        rodName: activeRod.name,
        lineName: activeLine.name,
        reelName: activeReel.name,
        hookName: activeHook.name,
        lureInWater: casting.isBobberInWater(),
        lureName: getGearById(LURES, activeLureId)?.name || 'None',
        castingPhase: castState.phase,
        tension: mgState.active ? mgState.tension : null,
        power: castState.power,
        working: castState.working,
      });
    }

    renderFrame();
  }

  // Fish are all below the mirror plane, so skip them in the reflection pass.
  const hiddenInReflection = [playerRod.rodGroup, ...fishSwarm];
  function renderFrame() {
    water.renderReflection(renderer, scene, camera, hiddenInReflection);
    post.render(scene, camera);
  }
  animate();

  window.__game = {
    environment, casting, minigame, save, scene, camera, catchReveal, fishSwarm,
    playerController, location, localSpecies, dam, chumSystem, world, renderer, water, post, playerRod,
    // Dev hook: GPU-synchronised cost of one full frame, in ms.
    timeFrame: (frames = 10) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) renderFrame();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return (performance.now() - t0) / frames;
    },
    // Dev hooks for previewing looks: pin the sky to a phase/progress, or a season.
    setTimeOverride: (timeOfDay, progress = 0.5) => {
      timeOverride = TIME_OF_DAY_PHASES.includes(timeOfDay) ? { timeOfDay, progress } : null;
    },
    setSeasonOverride: (season) => { seasonOverride = season || null; },
    // Dev hook: run the game loop by hand (steps of dt seconds), then render.
    advance: (steps = 1, dt = 1 / 60) => {
      for (let i = 0; i < steps; i++) {
        lastTime = performance.now();
        frame(dt, lastTime / 1000);
      }
    },
    // Dev hook: force a bite from a given local species (line must be out).
    debugForceBite: (speciesId) => {
      const species = localSpecies.find((s) => s.id === speciesId) || localSpecies[0];
      startBite(species);
    },
  };
}
