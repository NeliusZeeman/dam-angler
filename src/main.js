import * as THREE from '../vendor/three.module.js';
import { createScene, setupCameraControls, updateSway, updateSun, createPlayerRod } from './scene.js';
import { createWater, updateWater } from './water.js';
import { createEnvironment } from './environment.js';
import { FISH_SPECIES, rollForBite, randomWeightFor } from './fish.js';
import { RODS, LINES, LURES, getGearById } from './gear.js';
import { calculatePayout } from './economy.js';
import { loadSave, saveSave } from './save.js';
import { createCasting } from './casting.js';
import { createMinigame } from './minigame.js';
import { createHUD, renderCatchLog } from './ui.js';
import { createShop } from './shop.js';
import { createFishSwarm, updateFishSwarm, createCatchReveal } from './fish3d.js';

const appEl = document.getElementById('app');

const { scene, camera, sunLight, ambientLight, hemiLight, swayGroup, skyUniforms } = createScene();
const { waterMesh, setWaterTemperature } = createWater(scene);
const environment = createEnvironment();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
appEl.appendChild(renderer.domElement);
setupCameraControls(camera, renderer.domElement);

const fishSwarm = createFishSwarm(scene, FISH_SPECIES.map((s) => s.id), 12);
const catchReveal = createCatchReveal(scene);
const playerRod = createPlayerRod(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const save = loadSave();
let activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
let activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
let activeLureId = save.equippedLureId || LURES[0].id;

const casting = createCasting({
  scene, camera, domElement: renderer.domElement,
  getRod: () => activeRod,
  rodTip: playerRod.tip,
});
const minigame = createMinigame();
const hud = createHUD(appEl);

function onSaveChanged() {
  saveSave(save);
  activeRod = getGearById(RODS, save.equippedRodId) || RODS[0];
  activeLine = getGearById(LINES, save.equippedLineId) || LINES[0];
  activeLureId = save.equippedLureId || LURES[0].id;
  playerRod.setTier(activeRod.tier);
}
playerRod.setTier(activeRod.tier);

const shop = createShop({ container: appEl, save, onSaveChanged });

const catchLogPanel = document.createElement('div');
catchLogPanel.className = 'shop-panel hidden';
appEl.appendChild(catchLogPanel);
function toggleCatchLog() {
  catchLogPanel.classList.toggle('hidden');
  if (!catchLogPanel.classList.contains('hidden')) {
    renderCatchLog(catchLogPanel, save.catchLog);
    catchLogPanel.querySelector('[data-close]')?.addEventListener('click', () => catchLogPanel.classList.add('hidden'));
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') { shop.toggle(); }
  if (e.code === 'KeyC') { toggleCatchLog(); }
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

casting.onBite(() => {
  const species = bitingSpecies;
  if (!species) { casting.resetToIdle(); return; }
  const weightKg = randomWeightFor(species);
  minigame.start({
    species, weightKg, rod: activeRod, line: activeLine,
    onSuccess: () => {
      const payout = calculatePayout({ species, weightKg, rod: activeRod, line: activeLine });
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

function rollBitesIfWaiting(delta) {
  if (casting.getState().phase !== 'waiting') return;
  const state = environment.getState();
  const biteChanceMultiplier = twitchBoostTimer > 0 ? 1.8 : 1;
  for (const species of FISH_SPECIES) {
    if (rollForBite({ species, waterTempC: state.waterTempC, equippedLureId: activeLureId, deltaSeconds: delta, biteChanceMultiplier })) {
      bitingSpecies = species;
      casting.triggerBite();
      break;
    }
  }
}

let lastTime = performance.now();
let lastSeason = null;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  environment.tick(delta);
  const envState = environment.getState();
  setWaterTemperature(envState.waterTempC);
  updateWater(waterMesh, now / 1000, camera);
  updateSway(swayGroup, now / 1000, envState.windSpeed);
  updateFishSwarm(fishSwarm, now / 1000);
  catchReveal.update(delta);
  if (envState.season !== lastSeason) {
    updateSun(sunLight, ambientLight, hemiLight, skyUniforms, envState.season);
    lastSeason = envState.season;
  }

  casting.update(delta, envState);
  rollBitesIfWaiting(delta);
  minigame.update(delta);

  twitchBoostTimer = Math.max(0, twitchBoostTimer - delta);
  rodRecoil *= Math.max(0, 1 - delta * 10);
  playerRod.rodGroup.rotation.x = -rodRecoil;

  const mgState = minigame.getState();
  hud.update({
    credits: save.credits,
    season: envState.season,
    waterTempC: envState.waterTempC,
    windSpeed: envState.windSpeed,
    rodName: activeRod.name,
    lineName: activeLine.name,
    lureName: getGearById(LURES, activeLureId)?.name || 'None',
    castingPhase: casting.getState().phase,
    tension: mgState.active ? mgState.tension : null,
  });

  renderer.render(scene, camera);
}
animate();

window.__game = { environment, casting, minigame, save, scene, camera, catchReveal, fishSwarm };
