import * as THREE from '../vendor/three.module.js';
import { createScene, updateSway, updateSun, updateSeasonFoliage, createPlayerRod } from './scene.js';
import { createWater, updateWater, setWaterSunDirection, createSplashEffect } from './water.js';
import { createEnvironment } from './environment.js';
import { FISH_SPECIES, rollForBite, randomWeightFor } from './fish.js';
import { RODS, LINES, HOOKS, LURES, getGearById } from './gear.js';
import { calculatePayout } from './economy.js';
import { loadSave, saveSave } from './save.js';
import { createCasting } from './casting.js';
import { createMinigame } from './minigame.js';
import { createHUD, renderCatchLog } from './ui.js';
import { createTackleBox } from './tackleBox.js';
import { createFishSwarm, updateFishSwarm, createCatchReveal } from './fish3d.js';
import { createPlayerController } from './player.js';
import { getLocationById } from './locations.js';
import { showStartMenu } from './startMenu.js';

const appEl = document.getElementById('app');
const save = loadSave();

if (save.locationId) {
  startGame(save.locationId, save.startTimeOfDay || 'morning');
} else {
  showStartMenu(appEl, ({ locationId, timeOfDay }) => {
    save.locationId = locationId;
    save.startTimeOfDay = timeOfDay;
    saveSave(save);
    startGame(locationId, timeOfDay);
  });
}

function startGame(locationId, startTimeOfDay) {
  const location = getLocationById(locationId);
  const localSpecies = FISH_SPECIES.filter((s) => location.speciesIds.includes(s.id));

  const { scene, camera, sunLight, ambientLight, hemiLight, swayGroup, skyUniforms, sunGlow, treeLeafMats } = createScene({ grassTint: location.grassTint });
  const { waterMesh, setWaterTemperature } = createWater(scene, {
    coldColor: location.waterTint.cold,
    warmColor: location.waterTint.warm,
  });
  const environment = createEnvironment({ startTimeOfDay });

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05 * location.skyWarmth;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  appEl.appendChild(renderer.domElement);

  const playerController = createPlayerController({ camera, domElement: renderer.domElement });

  const fishSwarm = createFishSwarm(scene, localSpecies.map((s) => s.id), 24);
  const catchReveal = createCatchReveal(scene);
  const splashEffect = createSplashEffect(scene);
  const playerRod = createPlayerRod(camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
  let activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
  let activeHook = getGearById(HOOKS, save.equippedHookId) || HOOKS[0];
  let activeLureId = save.equippedLureId || LURES[0].id;

  const casting = createCasting({
    scene, camera, domElement: renderer.domElement,
    getRod: () => activeRod,
    rodTip: playerRod.tip,
    waterMesh,
    onSplash: (point) => splashEffect.spawn(point),
    onWake: (point) => splashEffect.spawn(point),
  });
  const minigame = createMinigame();
  const hud = createHUD(appEl);

  function onSaveChanged() {
    saveSave(save);
    activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
    activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
    activeHook = getGearById(HOOKS, save.equippedHookId) || HOOKS[0];
    activeLureId = save.equippedLureId || LURES[0].id;
    playerRod.setTier(activeRod.tier);
  }
  playerRod.setTier(activeRod.tier);

  const tackleBox = createTackleBox({ container: appEl, save, onSaveChanged });

  const catchLogPanel = document.createElement('div');
  catchLogPanel.className = 'shop-panel hidden';
  appEl.appendChild(catchLogPanel);
  function toggleCatchLog() {
    catchLogPanel.classList.toggle('hidden');
    if (!catchLogPanel.classList.contains('hidden')) {
      renderCatchLog(catchLogPanel, save.catchLog, { species: localSpecies, locationName: location.name });
      catchLogPanel.querySelector('[data-close]')?.addEventListener('click', () => catchLogPanel.classList.add('hidden'));
    }
  }

  function changeFishingSpot() {
    // Clear the remembered spot so the start menu shows again on reload;
    // credits, gear and the catch log all persist.
    save.locationId = null;
    save.startTimeOfDay = null;
    saveSave(save);
    window.location.reload();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB') { tackleBox.toggle(); }
    if (e.code === 'KeyC') { toggleCatchLog(); }
    if (e.code === 'KeyL') { changeFishingSpot(); }
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
    rodRecoil = 0.35;
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
      species, weightKg, rod: activeRod, line: activeLine, hook: activeHook,
      onSuccess: () => {
        const payout = calculatePayout({ species, weightKg, rod: activeRod, line: activeLine, hook: activeHook });
        save.credits += payout;
        const entry = save.catchLog[species.id] || { count: 0, bestWeightKg: 0 };
        entry.count += 1;
        entry.bestWeightKg = Math.max(entry.bestWeightKg, weightKg);
        save.catchLog[species.id] = entry;
        saveSave(save);
        hud.showToast(`Caught a ${species.name} (${weightKg.toFixed(2)}kg) — +${payout} credits`);
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

  function rollBitesIfWaiting(delta) {
    const phase = casting.getState().phase;
    if (phase !== 'waiting' && phase !== 'reeling') return;
    if (!casting.isBobberInWater()) return; // nothing bites a lure on the bank
    const state = environment.getState();
    const biteChanceMultiplier = twitchBoostTimer > 0 ? 1.8 : 1;
    for (const species of localSpecies) {
      if (rollForBite({ species, waterTempC: state.waterTempC, equippedLureId: activeLureId, deltaSeconds: delta, biteChanceMultiplier, timeOfDay: state.timeOfDay })) {
        startBite(species);
        break;
      }
    }
  }

  let lastTime = performance.now();
  let lastTimeOfDay = null;
  let lastSeason = null;
  let lastCastPhase = 'idle';
  let castSnap = 0;

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    environment.tick(delta);
    const envState = environment.getState();
    setWaterTemperature(envState.waterTempC);
    playerController.update(delta);
    updateWater(waterMesh, now / 1000, camera);
    updateSway(swayGroup, now / 1000, envState.windSpeed);
    updateFishSwarm(fishSwarm, now / 1000);
    catchReveal.update(delta);
    splashEffect.update(delta);
    if (envState.timeOfDay !== lastTimeOfDay) {
      const sunDir = updateSun({ sunLight, ambientLight, hemiLight, skyUniforms, sunGlow, scene }, envState.timeOfDay);
      setWaterSunDirection(waterMesh, sunDir);
      lastTimeOfDay = envState.timeOfDay;
    }
    if (envState.season !== lastSeason) {
      updateSeasonFoliage(treeLeafMats, envState.season);
      lastSeason = envState.season;
    }

    casting.update(delta, envState);
    rollBitesIfWaiting(delta);
    minigame.update(delta);

    const mgState = minigame.getState();
    const castState = casting.getState();

    // Rod feel: tips back while winding up (scaled by the power meter),
    // snaps forward the instant the cast releases, flicks up on a twitch.
    if (lastCastPhase === 'aiming' && castState.phase === 'inAir') castSnap = 0.55;
    lastCastPhase = castState.phase;
    castSnap *= Math.max(0, 1 - delta * 9);
    twitchBoostTimer = Math.max(0, twitchBoostTimer - delta);
    rodRecoil *= Math.max(0, 1 - delta * 10);
    const windup = castState.phase === 'aiming' ? castState.power * 0.6 : 0;
    playerRod.rodGroup.rotation.x = -(rodRecoil + windup) + castSnap;
    hud.update({
      credits: save.credits,
      season: envState.season,
      timeOfDay: envState.timeOfDay,
      waterTempC: envState.waterTempC,
      windSpeed: envState.windSpeed,
      rodName: activeRod.name,
      lineName: activeLine.name,
      hookName: activeHook.name,
      lureName: getGearById(LURES, activeLureId)?.name || 'None',
      castingPhase: castState.phase,
      tension: mgState.active ? mgState.tension : null,
      power: castState.power,
    });

    renderer.render(scene, camera);
  }
  animate();

  window.__game = {
    environment, casting, minigame, save, scene, camera, catchReveal, fishSwarm,
    playerController, location, localSpecies,
    // Dev hook: force a bite from a given local species (line must be out).
    debugForceBite: (speciesId) => {
      const species = localSpecies.find((s) => s.id === speciesId) || localSpecies[0];
      startBite(species);
    },
  };
}
