import * as THREE from '../vendor/three.module.js';
import { createScene, createPlayerRod } from './scene.js';
import { createWater, updateWater, createSplashEffect, waterSurfaceY } from './water.js';
import { createPostPipeline } from './gfx/post.js';
import { windUniforms } from './gfx/wind.js';
import { GPU, loadGpu, webgpuAvailable } from './gfx/gpu.js';
import { loadFishModels } from './fishModels.js';
import { loadScenery } from './sceneryAssets.js';
import { loadPeople, PEOPLE, setPeopleLight } from './people.js';
import { createEnvironment, TIME_OF_DAY_PHASES } from './environment.js';
import { FISH_SPECIES, rollDamBite, randomWeightFor, pickGuaranteedBite, estimateLengthCm, rollTrophy, trophyWeightFor, suitability } from './fish.js';
import { rigFor } from './gfx/terminalTackle.js';
import { RODS, LINES, REELS, HOOKS, LURES, GADGETS, getGearById, rigCheck } from './gear.js';
import { diagnoseLoss } from './fightReport.js';
import { castLossChance, soakLossChance } from './baitLoss.js';
import { catchPayout } from './economy.js';
import { loadSave, saveSave, onSave, replaceSave } from './save.js';
import { createCloud, createDisabledCloud, newCatchId } from './cloud.js';
import { loadGameTuning } from './tuning/client.js';
import { createCasting } from './casting.js';
import { createMinigame } from './minigame.js';
import { planTake, judgeStrike, takeExpired, takeLook } from './strike.js';
import { retrieveFor, createActionTracker, scoreAction, actionBiteMultiplier } from './lureAction.js';
import { readSpot, baitDepth, waterMultiplier, describeSpot, zoneName } from './waterReading.js';
import { challengesFor, progressOf } from './goals.js';
import { createHUD, renderCatchLog, createActionBar, showCatchCard, createTipBubble, showLossReport } from './ui.js';
import { randomTip } from './tips.js';
import { fightStamina, fightStrength } from './fightMotion.js';
import { createTouchControls, isTouchDevice, isSmallOrMobileScreen } from './touchControls.js';
import { createTackleBox } from './tackleBox.js';
import { createLandingNet } from './gfx/landingNet.js';
import { createBoats, createPlayerBoat } from './gfx/boats.js';
import { loadBoatModels } from './gfx/boatModels.js';
import { createBoatDrive, boatKindFor, mooringFor } from './boatDrive.js';
import { withPeg, spotsFor } from './pegs.js';
import { boatRodsFor, boatBonus, BOAT_ROD_BONUS } from './boatRods.js';
import { pointsFromLog, pointsForCatch, boatPoints, levelInfo, sizeSkew, sizeCap, rollBoss, bossWeightFor } from './levels.js';
import { createFishSwarm, updateFishSwarm, createCatchReveal, createFishMesh, setFishSwim } from './fish3d.js';
import { createPlayerController } from './player.js';
import { getLocationById } from './locations.js';
import { showStartMenu } from './startMenu.js';
import { showMainMenu } from './mainMenu.js';
import { createDam } from './dam.js';
import { seedFromString } from './gfx/noise.js';
import { createChumSystem } from './chum.js';
import { ENGINE } from './tuning/engine.js';
import { createPauseMenu } from './pauseMenu.js';
import { startVersionWatch, reloadToLatest, assetTag } from './versionCheck.js';
import { createAudio } from './audio.js';

const appEl = document.getElementById('app');
const save = loadSave();

// Online: logged-in players keep one save on the server for every device.
// Every local save is mirrored there; a newer save from another device
// replaces this one (keeping any gear either side bought).
// Game tuning from the admin area (published values; an admin can preview
// the draft with ?tuning=draft). Applied before anything else runs.
const tuning = await loadGameTuning({ wantPreview: new URLSearchParams(location.search).get('tuning') === 'draft' });
if (tuning.preview) {
  const banner = document.createElement('div');
  banner.className = 'preview-banner';
  banner.textContent = 'Preview — draft tuning. Nothing is saved online while previewing.';
  document.body.appendChild(banner);
}

const cloud = tuning.preview ? createDisabledCloud() : createCloud({
  onSaveReplaced: (serverSave) => replaceSave(save, serverSave),
  // The server keeps the books: its balance is the real one.
  onCredits: (credits) => { save.credits = credits; saveSave(save, { quiet: true }); },
});
onSave((s) => cloud.queueSave(s));
const fromServer = await cloud.init();
if (fromServer?.save) replaceSave(save, fromServer.save);

const touchMode = isTouchDevice();
document.body.classList.toggle('touch', touchMode);

// Every launch opens on the title screen.
openMainMenu();

// A newer version published while the game's open: on the menus, just
// reload onto it; mid-session, offer it without interrupting a fight.
let gameRunning = false;
startVersionWatch(() => {
  if (!gameRunning) { reloadToLatest(); return; }
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'update-banner';
  bar.textContent = 'New version available — tap to update';
  bar.addEventListener('click', (e) => { e.stopPropagation(); reloadToLatest(); });
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.addEventListener('mousedown', (e) => e.stopPropagation());
  appEl.appendChild(bar);
});

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

// Sound: all generated live (audio.js). Browsers only allow it after a tap,
// click or key, so every gesture makes sure it's unlocked (phones can also
// suspend it when the screen locks).
const audio = createAudio({ volume: save.settings.volume ?? 0.7 });
['pointerdown', 'touchend', 'keydown'].forEach((type) => document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true }));

function openMainMenu() {
  showMainMenu(appEl, {
    onSettingsChanged: () => audio.setVolume(save.settings.volume ?? 0.7),
    save,
    cloud,
    sessionEnded: fromServer?.loggedOut,
    onContinue: () => { enterImmersive(); startGame(save.locationId, save.startTimeOfDay || 'morning', save.settings?.peg); },
    onNewGame: () => showStartMenu(appEl, ({ locationId, timeOfDay, pegId }) => {
      enterImmersive();
      save.locationId = locationId;
      save.startTimeOfDay = timeOfDay;
      save.settings = { ...(save.settings || {}), peg: pegId || '' };
      saveSave(save);
      startGame(locationId, timeOfDay, pegId);
    }, { onBack: openMainMenu, initialLocationId: save.locationId, initialPegId: save.settings?.peg, damStats: () => cloud.damStats() }),
  });
}

// Settings "auto" = light graphics on phones and small tablets, full on
// everything else. ?quality=low|medium|high|ultra|ultraplus in the URL
// overrides.
const QUALITIES = ['low', 'medium', 'high', 'ultra', 'ultraplus'];
function resolveQuality() {
  const urlQuality = new URLSearchParams(window.location.search).get('quality');
  const setting = urlQuality || save.settings.quality || 'auto';
  if (setting === 'auto') return isSmallOrMobileScreen() ? 'low' : 'high';
  return QUALITIES.includes(setting) ? setting : 'high';
}
// What each graphics setting draws. Ultra loads slowest and wants a good
// graphics card; Low suits phones.
// maxPixels: the most pixels it draws each frame, whatever the screen --
// a 4K monitor or an iPad draws about a 1080p picture, stretched smoothly
// to fill it, instead of 2-4x the work.
const GRAPHICS = {
  low: { pixelRatio: 1, reflection: 0.33, rays: 0, softShadows: false, samples: 2, maxPixels: Infinity },
  medium: { pixelRatio: 1.25, reflection: 0.4, rays: 1, softShadows: true, samples: 4, maxPixels: 1.2e6 },
  high: { pixelRatio: 1.5, reflection: 0.5, rays: 1, softShadows: true, samples: 4, maxPixels: 1.6e6 },
  ultra: { pixelRatio: 2, reflection: 0.75, rays: 1, softShadows: true, samples: 8, maxPixels: 2.1e6 },
  // WebGPU: everything Ultra has, plus refraction and true depth in the
  // water, ambient occlusion and edge smoothing (see gfx/gpu/).
  ultraplus: { pixelRatio: 2, reflection: 0.6, rays: 1, softShadows: true, samples: 0, webgpu: true, maxPixels: 2.1e6 },
};
// The sharpness that keeps this window inside the setting's pixel budget.
function sharpnessFor(gfx) {
  const area = Math.max(1, (window.innerWidth || 1) * (window.innerHeight || 1));
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, gfx.pixelRatio, Math.sqrt(gfx.maxPixels / area)));
}
// Phones and tablets: a phone's screen is small and its pixels tiny, so it
// looks just as sharp drawn at 1.5x instead of 2-3x, with 4x edge smoothing
// rather than 8x and a lighter water reflection -- several times less work
// for the graphics chip (scene.js trims the grass and shadows to match).
const handheld = isSmallOrMobileScreen();
const PHONE_CAPS = { pixelRatio: 1.5, reflection: 0.45, samples: 4, maxPixels: 1e6 };
function graphicsFor(quality) {
  const g = GRAPHICS[quality];
  if (!handheld || quality === 'low') return g;
  return {
    ...g,
    pixelRatio: Math.min(g.pixelRatio, PHONE_CAPS.pixelRatio),
    reflection: Math.min(g.reflection, PHONE_CAPS.reflection),
    samples: Math.min(g.samples, PHONE_CAPS.samples),
    maxPixels: Math.min(g.maxPixels, PHONE_CAPS.maxPixels),
  };
}

// Warm the browser cache with this dam's fish pictures so the catch card
// shows its photo instantly. Small WebP first; PNG only if there's no WebP.
function preloadFishImages(speciesList) {
  const load = () => speciesList.forEach((s) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/fish/${s.id}.webp${assetTag()}`;
  });
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 5000 });
  else setTimeout(load, 3000);
}

// Ultra+ needs WebGPU: fetch its build and start its renderer first, and
// fall back to Ultra (WebGL) if this browser or graphics card can't.
async function startGame(locationId, startTimeOfDay, pegId = null) {
  gameRunning = true;
  let quality = resolveQuality();
  let gpuRenderer = null;
  if (GRAPHICS[quality].webgpu) {
    if (await webgpuAvailable() && await loadGpu()) {
      try {
        gpuRenderer = new GPU.W.WebGPURenderer({ antialias: false });
        await gpuRenderer.init();
        if (!gpuRenderer.backend?.isWebGPUBackend) throw new Error('no WebGPU backend');
      } catch (err) {
        console.warn('WebGPU renderer failed, using WebGL:', err);
        gpuRenderer?.dispose?.();
        gpuRenderer = null;
      }
    }
    if (!gpuRenderer) quality = 'ultra';
  }
  GPU.on = !!gpuRenderer;
  // The Blender-made fish for this water (Low keeps the light built-in ones).
  // and the photo-scanned scenery (sceneryAssets.js).
  if (quality !== 'low') {
    const loc = getLocationById(locationId);
    // The campsite people, where the dam has camps (Medium brings fewer).
    // Phones bring fewer of them, with smaller pictures (graphics memory).
    const fewer = quality === 'medium' || handheld;
    const people = spotsFor(locationId)
      ? loadPeople(fewer ? ['man-shorts', 'man-vest', 'woman-green', 'man-check', 'boy'] : PEOPLE, 15000, { maxTexture: handheld ? 1024 : 0 })
      : null;
    // The Blender boats on this water, and your own.
    const kinds = spotsFor(locationId)?.boats || [];
    const boatKinds = kinds.length ? [...kinds, boatKindFor(kinds)] : [];
    await Promise.all([loadFishModels(loc.speciesIds), loadScenery(loc), people, loadBoatModels(boatKinds)]);
  }
  const fellBack = GRAPHICS[resolveQuality()].webgpu && !GPU.on;
  startGameNow(locationId, startTimeOfDay, pegId, quality, gpuRenderer, fellBack);
}

function startGameNow(locationId, startTimeOfDay, pegId, quality, gpuRenderer, gpuFellBack = false) {
  // The dam as it is at the chosen fishing spot (pegs.js).
  const location = withPeg(getLocationById(locationId), pegId);
  cloud.damStats(); // this spot's record, for "New dam record!"
  const localSpecies = FISH_SPECIES.filter((s) => location.speciesIds.includes(s.id));
  // We fish the open dam itself, from its bank and angling stands.
  // Each spot is its own stretch of bank (the dam's first spot keeps the
  // original layout).
  const firstPeg = !location.peg || location.peg === spotsFor(location.id)?.pegs[0];
  const dam = createDam(location.dam, seedFromString(firstPeg ? location.id : `${location.id}:${location.pegId}`));

  preloadFishImages(localSpecies);
  const world = createScene({ location, dam, quality, handheld });
  const { scene, camera } = world;
  const waterLook = location.scenery?.water || {};
  const water = createWater(scene, dam, {
    coldColor: location.waterTint.cold,
    warmColor: location.waterTint.warm,
    clarity: waterLook.clarity ?? 0.6,
    algae: waterLook.algae ?? 0,
  });
  const { waterMesh, setWaterTemperature } = water;
  // Each water has its own climate: mountain trout streams run cold,
  // Lowveld and Karoo water warm.
  const environment = createEnvironment({ startTimeOfDay, tempOffset: location.tempOffset ?? 0 });

  const renderer = gpuRenderer || new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const gfx = graphicsFor(quality);
  let pixelRatio = sharpnessFor(gfx);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Tone mapping and sRGB output happen in the post pipeline's final pass.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  // Filtered shadows; how soft the edges are is the sun's shadow.radius
  // (scene.js), kept small on phone GPUs.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  appEl.appendChild(renderer.domElement);
  const post = GPU.on
    ? GPU.post.createGpuPost(renderer, scene, camera)
    : createPostPipeline(renderer, { samples: gfx.samples });
  post.setRaysScale(gfx.rays);
  water.setReflectionScale(gfx.reflection);

  let waterClock = 0; // the frame's elapsed seconds, for the boat riding the waves
  const playerController = createPlayerController({
    camera, domElement: renderer.domElement, dam, turnSpeed: save.settings.turnSpeed,
    waterY: (x, z) => waterSurfaceY(x, z, waterClock),
  });

  const splashEffect = createSplashEffect(scene, water);
  // The anglers at the camp and on the boats splash and ripple the water,
  // and you hear about what they land when you're nearby.
  const lifeHooks = {
    ripple: (x, z, strength) => water.addRipple(x, z, strength),
    // Splashes out of sight would only use up the splash pool.
    splash: (point, strength) => { if (point.distanceTo(camera.position) < 150) splashEffect.spawn(point, strength); },
    onCatch: ({ species, weightKg, x, z, boat = false }) => {
      const me = playerController.getPosition();
      if (Math.hypot(me.x - x, me.z - z) < 90) hud.showToast(`An angler ${boat ? 'on a boat nearby' : 'at the camp'} has landed a ${weightKg.toFixed(1)} kg ${species.name.toLowerCase()} — and slipped it back.`);
    },
  };
  // Boats on dams that allow them, a slipway and moored boats at spots with one.
  const boats = location.boats ? createBoats(scene, {
    dam, kinds: location.boats, moored: location.moored, slipway: location.slipway, water,
    spawn: dam.spawn, seed: seedFromString(location.id + (location.pegId || '')), terrain: world.terrain,
    speciesIds: location.speciesIds,
  }) : null;
  world.camp?.life?.setHooks(lifeHooks);
  boats?.setHooks(lifeHooks);
  // Your own boat, where boats are allowed: tied up off the slipway or
  // beside your spot. G (or the Boat button) gets in and out.
  const myBoatKind = boatKindFor(location.boats);
  const myBoat = myBoatKind ? createBoatDrive({
    dam, kind: myBoatKind,
    ...mooringFor(dam, { slipwayX: location.slipway ? dam.spawn.x + location.slipway.x : null }),
  }) : null;
  const myBoatMesh = myBoat ? createPlayerBoat(scene, myBoatKind, water) : null;
  // The boat buttons: in and out (G), helm or deck (H), the rod rack (R).
  const boatBar = document.createElement('div');
  boatBar.className = 'boat-bar';
  appEl.appendChild(boatBar);
  const boatButton = (onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'boat-btn hidden';
    b.addEventListener('click', onClick);
    boatBar.appendChild(b);
    return b;
  };
  const rackBtn = boatButton(() => toggleRack());
  const deckBtn = boatButton(() => toggleDeck());
  const boatBtn = boatButton(() => toggleBoat());
  const showBoatButton = (b, label) => {
    if (b.textContent !== label) b.textContent = label;
    b.classList.toggle('hidden', !label);
  };
  function toggleBoat() {
    if (!myBoat) return;
    const phase = casting.getState().phase;
    if (playerController.inBoat()) {
      const spot = myBoat.landingSpot();
      if (!spot) { hud.showToast('Too far out — pull in close to the bank or a stand to step ashore.'); return; }
      if (Math.abs(myBoat.state.speed) > 0.5) { hud.showToast('Slow down first.'); return; }
      if (phase !== 'idle') { hud.showToast('Reel in first.'); return; }
      playerController.leaveBoat(spot);
      rackPanel.hide();
      // The boat rods stay on the boat.
      if (boatRod) {
        boatRod = null;
        applyGear();
        hud.showToast(`Ashore. The boat rod stays in the rack — back on your own ${activeRod.name.split(' (')[0]}.`);
      } else hud.showToast('Ashore. The boat stays tied up here.');
      return;
    }
    if (phase !== 'idle') { hud.showToast('Reel in first.'); return; }
    const me = playerController.getPosition();
    if (!myBoat.canBoardFrom(me.x, me.z)) return;
    playerController.enterBoat(myBoat);
    hud.showToast(touchMode
      ? `In the ${myBoat.spec.label}: the stick drives. ${myBoat.spec.deck ? '"Walk the deck" drops anchor — the boat\'s own rods are in the rack at the stern.' : 'The kayak\'s own rods are behind your seat ("Boat rods").'}`
      : myBoat.spec.deck
        ? `In the ${myBoat.spec.label}: W/S throttle, A/D steer, Shift full speed. H drops anchor and lets you walk the deck — the boat's own rods are in the rack at the stern (R). G to step ashore near the bank.`
        : `In the ${myBoat.spec.label}: W/S paddle, A/D steer. The kayak's own rods are behind your seat (R). Cast anywhere — the anchor drops while your line is out. G to step ashore near the bank.`);
  }
  // Leave the helm and walk the deck (anchor down), or take the helm again.
  function toggleDeck() {
    if (!myBoat?.spec.deck || !playerController.inBoat()) return;
    if (playerController.onDeck()) {
      playerController.setOnDeck(false);
      rackPanel.hide();
      hud.showToast('At the helm. W/S throttle, A/D steer.');
      return;
    }
    if (Math.abs(myBoat.state.speed) > 0.8) { hud.showToast('Slow down first.'); return; }
    playerController.setOnDeck(true);
    hud.showToast(touchMode
      ? 'Anchor down. Walk the deck with the stick — the rod rack is at the stern.'
      : 'Anchor down. Walk the deck with W/A/S/D — the rod rack is at the stern (R). H to take the helm.');
  }
  // Within reach of the boat's rods: on deck by the rack, or in a kayak.
  const atRack = () => {
    if (!myBoat || !playerController.inBoat()) return false;
    const d = playerController.onDeck();
    return myBoat.spec.deck ? !!d && myBoat.atRack(d.x, d.z) : true;
  };
  function toggleRack() {
    if (rackPanel.isOpen()) { rackPanel.hide(); return; }
    if (!atRack()) return;
    playerController.releasePointer();
    rackPanel.show();
  }
  // The boat buttons show when you're beside the boat or in it.
  function updateBoat(delta, elapsed) {
    if (!myBoat) return;
    const onDeck = !!playerController.onDeck();
    playerController.setBoatHeld(casting.getState().phase !== 'idle');
    myBoatMesh.update(myBoat, elapsed, delta);
    const me = playerController.getPosition();
    const inBoat = !!playerController.inBoat();
    const near = !inBoat && myBoat.canBoardFrom(me.x, me.z);
    showBoatButton(boatBtn, inBoat ? (myBoat.landingSpot() ? 'Step ashore (G)' : '') : near ? 'Get in the boat (G)' : '');
    showBoatButton(deckBtn, inBoat && myBoat.spec.deck ? (onDeck ? 'Take the helm (H)' : 'Walk the deck (H)') : '');
    const reach = atRack();
    showBoatButton(rackBtn, reach ? 'Boat rods (R)' : '');
    if (!reach && rackPanel.isOpen()) rackPanel.hide();
  }
  // The rack of boat rods, each rigged for one kind of fish (boatRods.js).
  const rackPanel = createRackPanel();
  function createRackPanel() {
    const el = document.createElement('div');
    el.className = 'rack-panel hidden';
    appEl.appendChild(el);
    const speciesName = (id) => FISH_SPECIES.find((f) => f.id === id)?.name || id;
    const bonusPct = Math.round((BOAT_ROD_BONUS - 1) * 100);
    function render() {
      const own = getGearById(RODS, save.equippedRodId) || RODS[0];
      const short = (item) => item.name.split(' (')[0];
      const cards = boatRodsFor(myBoatKind).map((b) => {
        const using = boatRod?.id === b.id;
        // The rod in your hands: pick which of its baits goes on.
        const baits = using
          ? `<div class="rack-baits">${b.baits.map((l) => `<button type="button" class="rack-bait${l.id === boatBait.id ? ' on' : ''}" data-bait="${l.id}">${short(l)}</button>`).join('')}</div>`
          : `<div class="rack-gear">Baits: ${b.baits.map(short).join(', ')}</div>`;
        return `<div class="rack-card${using ? ' using' : ''}">
          <div class="rack-name">${b.name.replace('Boat Rod: ', '')}</div>
          <div class="rack-for">For ${b.targets.map(speciesName).join(', ')}: +${bonusPct}% credits and XP</div>
          <div class="rack-blurb">${b.blurb}</div>
          <div class="rack-gear">${short(b.reel)} · ${short(b.line)} · ${short(b.hook)} · up to ${b.rod.maxKg} kg</div>
          ${baits}
          <button type="button" data-rod="${b.id}" ${using ? 'disabled' : ''}>${using ? 'In your hands' : 'Take this rod'}</button>
        </div>`;
      }).join('');
      el.innerHTML = `<div class="rack-head"><h3>The ${myBoat.spec.label}'s rods</h3><button type="button" class="rack-close" aria-label="Close">×</button></div>
        <p class="rack-note">Each comes fully rigged — reel, line, hook and its own baits. They stay on the boat: step ashore and you're back on your own rod and rig.</p>
        <div class="rack-list">${cards}
          <div class="rack-card${boatRod ? '' : ' using'}">
            <div class="rack-name">Your own rod</div>
            <div class="rack-blurb">${own.name}</div>
            <button type="button" data-rod="" ${boatRod ? '' : 'disabled'}>${boatRod ? 'Use my own rod' : 'In your hands'}</button>
          </div>
        </div>`;
    }
    el.addEventListener('click', (e) => {
      if (e.target.closest('.rack-close')) { hide(); return; }
      const baitBtn = e.target.closest('button[data-bait]');
      const btn = e.target.closest('button[data-rod]');
      if (!btn && !baitBtn) return;
      if (casting.getState().phase !== 'idle') { hud.showToast('Reel in first.'); return; }
      if (baitBtn) {
        boatBait = boatRod.baits.find((l) => l.id === baitBtn.dataset.bait) || boatBait;
        applyGear();
        render();
        return;
      }
      const id = btn.dataset.rod;
      boatRod = id ? boatRodsFor(myBoatKind).find((b) => b.id === id) : null;
      boatBait = boatRod?.baits[0] || null;
      applyGear();
      hud.showToast(boatRod
        ? `${boatRod.name.replace('Boat Rod: ', '')} in hand, ${boatBait.name.split(' (')[0]} on — ${boatRod.targets.map(speciesName).join(', ')} pay +${bonusPct}%.`
        : `Back on your own ${activeRod.name.split(' (')[0]}.`);
      hide();
    });
    const hide = () => el.classList.add('hidden');
    return {
      show: () => { render(); el.classList.remove('hidden'); },
      hide,
      isOpen: () => !el.classList.contains('hidden'),
    };
  }
  const fishSwarm = createFishSwarm(scene, localSpecies.map((s) => s.id), 24, dam);
  const catchReveal = createCatchReveal(scene, (point, strength) => splashEffect.spawn(point, strength));
  const chumSystem = createChumSystem(scene);
  const playerRod = createPlayerRod(camera);

  window.addEventListener('resize', () => {
    // A hidden or minimised window can report 0 x 0: keep the last shape
    // rather than a 0/0 camera that aims every cast at nowhere.
    if (!window.innerWidth || !window.innerHeight) return;
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
  // One of the boat's own rods in your hands (boatRods.js), or null, and the
  // bait on it. Its whole rig stands in for yours; your save never changes.
  let boatRod = null;
  let boatBait = null;
  function currentLure() { return getGearById(LURES, activeLureId) || LURES[0]; }
  // Whether the rod, reel, line and bait belong together (see gear.js).
  let rig = null;
  function refreshRig() {
    rig = rigCheck({ rod: activeRod, reel: activeReel, line: activeLine, lure: currentLure() });
  }
  refreshRig();

  const casting = createCasting({
    scene, camera, domElement: renderer.domElement,
    getRod: () => activeRod,
    rodTip: playerRod.tip,
    waterMesh,
    dam,
    onSplash: (point, strength = 1) => {
      splashEffect.spawn(point, strength);
      // 0.65 is the rig landing -- that gets its own plop (onLanded).
      if (strength !== 0.65) audio.splash(strength * hearingFalloff(point));
    },
    onWake: (point, size = 1) => splashEffect.ripple(point, size),
    getLureKind: () => (getGearById(LURES, activeLureId) || LURES[0]).kind,
    // Reel and line add launch speed on top of what the rod itself can throw.
    // A heavy feeder on a light rod can't be thrown at full speed -- the
    // blank folds under the weight instead of flicking it out.
    getCastMultiplier: () => (activeReel.castMultiplier || 1) * (activeLine.castMultiplier || 1)
      * (currentLure().heavy && activeRod.power === 'light' ? 0.72 : 1) * rig.castFactor,
    getCastDrag: () => currentLure().castDrag ?? null,
    // Weed, reeds, pads and timber a hooked fish can bolt into.
    getFightCover: (speciesId) => ({
      seeksCover: !!FISH_SPECIES.find((f) => f.id === speciesId)?.habitat?.structure || ['common-carp', 'mirror-carp', 'catfish'].includes(speciesId),
      coverAt: (x, z) => { const zn = dam.zoneAt(x, z); return zn.type === 'structure' ? zoneName(zn.kind) : null; },
    }),
    getLure: () => currentLure(),
    isBareHook: () => bareHook,
    // A full fly rig casts the fly-fishing way: false casts that whip the
    // line back and forth overhead before it unrolls onto the water.
    isFlyCast: () => rig.flyRig,
    getLineLook: () => (activeLine.type === 'fly'
      ? { color: activeLine.sinking ? [0.45, 0.55, 0.36] : [0.8, 1.0, 0.25], width: 3.2 }
      : null),
    onFlyStroke: (forward, strength) => audio.cast(0.35 + strength * 0.4 * (forward ? 1 : 0.7)),
    // A mieliebom breaks down where it lands: a feeding spot round the hook.
    onLanded: (point, inWater) => {
      // A soft bait like chicken liver can fly off on the cast.
      if (Math.random() < castLossChance(currentLure(), soundPower)) loseBait('flew off the hook on the cast');
      // What you can tell about the spot once the rig settles: the depth
      // (the lead touching down, or where the float cocks), the cover.
      else if (inWater) setTimeout(() => {
        const phase = casting.getState().phase;
        if (phase !== 'waiting' && phase !== 'reeling') return;
        hud.showToast(landingReport(point));
      }, 700);
      if (inWater) audio.plop((currentLure().heavy ? 1.4 : 0.8) * hearingFalloff(point, 120));
      if (inWater && currentLure().groundbait) chumSystem.spawn(point, 'groundbait');
      // The distance counter shows how far that cast went for a moment.
      const me = playerController.getPosition();
      castResult = { meters: Math.hypot(point.x - me.x, point.z - me.z), showFor: 2.5 };
    },
    // Touch screens always aim through the screen centre, like mouse-look.
    isLookLocked: () => touchMode || playerController.isLocked(),
    getFightInput: () => minigame.getState(),
    onFishJump: (point, duration) => {
      minigame.jump(duration);
      hud.showToast('It jumps! Drop the rod tip and stop reeling till it\'s back in!');
    },
  });
  const touchControls = touchMode
    ? createTouchControls({ container: appEl, domElement: renderer.domElement, player: playerController, casting })
    : null;
  const minigame = createMinigame();
  // Drag: a share of the line's breaking strain, kept in the save. One step
  // is 5%. The rule of thumb is about a third.
  if (typeof save.drag !== 'number') save.drag = 0.33;
  function changeDrag(step) {
    save.drag = Math.round(Math.max(0.05, Math.min(0.9, save.drag + step * 0.05)) * 100) / 100;
    minigame.setDrag(save.drag);
    hud.setDrag(save.drag, activeLine.breakKg);
    saveSave(save);
  }
  const hud = createHUD(appEl, { showHints: save.settings.showHints, touch: touchMode, onDrag: changeDrag });
  if (gpuFellBack) hud.showToast("This browser can't do WebGPU, so you're on Ultra graphics.");
  hud.setDrag(save.drag, activeLine.breakKg);
  minigame.setDrag(save.drag);

  function onSaveChanged() {
    saveSave(save);
    applyGear();
  }
  // What's in your hands: your rigged gear from the save, or a boat rod's
  // whole rig -- rod, reel, line, hook and bait -- while you hold one.
  function applyGear() {
    activeRod = boatRod?.rod || getGearById(RODS, save.equippedRodId) || RODS[0];
    activeLine = boatRod?.line || getGearById(LINES, save.equippedLineId) || LINES[0];
    activeReel = boatRod?.reel || getGearById(REELS, save.equippedReelId) || REELS[0];
    activeHook = boatRod?.hook || getGearById(HOOKS, save.equippedHookId) || HOOKS[0];
    activeLureId = boatRod ? boatBait.id : save.equippedLureId || LURES[0].id;
    refreshRig();
    playerRod.setRod(activeRod, activeReel);
    if (typeof save.drag === 'number') {
      minigame.setDrag(save.drag);
      hud.setDrag(save.drag, activeLine.breakKg);
    }
  }
  playerRod.setRod(activeRod, activeReel);

  const rawTackleBox = createTackleBox({ container: appEl, save, onSaveChanged, onBuy: (kind, id) => cloud.queueBuy(kind, id), getLevel: () => myLevel().level });

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

  // Sounds further off are quieter: 1 at your feet, fading out by `range` m.
  function hearingFalloff(point, range = 70) {
    const me = playerController.getPosition();
    return Math.max(0, 1 - Math.hypot(point.x - me.x, point.z - me.z) / range);
  }
  // The cast whoosh fires the moment a wound-up cast is released.
  let soundPhase = 'idle', soundPower = 0;
  function updateSound(delta) {
    const cs = casting.getState();
    if (cs.phase === 'aiming') soundPower = cs.power;
    if (soundPhase === 'aiming' && cs.phase === 'inAir' && !cs.flyStroke) audio.cast(soundPower);
    soundPhase = cs.phase;
    const mg = minigame.getState();
    const fish = casting.getFightFish();
    const env = environment.getState();
    audio.update(delta, {
      active: !paused,
      windSpeed: env.windSpeed,
      timeOfDay: env.timeOfDay,
      // Winding: reeling line in, fighting a fish you're gaining on, or
      // working a lure back.
      reelRate: cs.phase === 'reeling' ? 1
        : mg.active && mg.holding && !fish?.takingLine ? 1
          : cs.working ? 0.5 : 0,
      // The drag screams while a fish strips line.
      dragRate: mg.active && fish?.takingLine ? 1
        // A carp running off with the bait: the baitrunner screams.
        : take?.real && take.plan.baitrunner && (take.plan.type === 'run' || take.plan.type === 'pull') ? 0.9 : 0,
      tension: mg.active ? mg.tension : 0,
    });
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
    if (save.credits < ENGINE.money.chumCost) {
      hud.showToast(`Not enough credits for breadcrumbs (${ENGINE.money.chumCost})`);
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
    save.credits -= ENGINE.money.chumCost;
    saveSave(save);
    cloud.queueSpend('chum');
    chumSystem.spawn(target);
    audio.splash(0.35 * hearingFalloff(target));
    hud.showToast('Breadcrumbs thrown — fish will find it in a few seconds and stay while it lasts');
  }

  // Everything that used to be keyboard-only, as buttons on screen too.
  const actionBar = createActionBar(appEl, [
    { id: 'tackle', label: 'Tackle box', key: 'B', onClick: () => { if (!paused) tackleBox.toggle(); } },
    { id: 'log', label: 'Catch log', key: 'C', onClick: () => { if (!paused) toggleCatchLog(); } },
    { id: 'chum', label: `Breadcrumbs · ${ENGINE.money.chumCost} cr`, key: 'F', onClick: () => { if (!paused) throwChum(); } },
    { id: 'tip', label: "What's biting?", key: 'T', onClick: () => { if (!paused) showTip(); } },
    { id: 'menu', label: 'Menu', key: 'Esc', onClick: () => setPaused(!paused) },
  ]);

  // Phones: short labels so the buttons fit one row under the top bar.
  if (touchMode) {
    [['tackle', 'Tackle'], ['log', 'Log'], ['chum', `Chum ${ENGINE.money.chumCost}cr`], ['tip', 'Tips'], ['menu', 'Menu']]
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
    if (e.code === 'KeyG') { toggleBoat(); }
    if (e.code === 'KeyH') { toggleDeck(); }
    if (e.code === 'KeyR') { toggleRack(); }
    if (e.code === 'BracketLeft' || e.code === 'Minus' || e.code === 'NumpadSubtract') changeDrag(-1);
    if (e.code === 'BracketRight' || e.code === 'Equal' || e.code === 'NumpadAdd') changeDrag(1);
    if (e.code === 'KeyM') {
      // Quick mute: M toggles sound off and back to the last volume.
      const on = (save.settings.volume ?? 0.7) > 0;
      if (on) save.settings.lastVolume = save.settings.volume;
      save.settings.volume = on ? 0 : (save.settings.lastVolume || 0.7);
      saveSave(save);
      audio.setVolume(save.settings.volume);
      hud.showToast(on ? 'Sound off (M)' : 'Sound on (M)');
    }
    if (e.code === 'Space') {
      if (casting.getState().phase === 'take' && !e.repeat) casting.pressStart();
      else if (minigame.getState().netReady && !e.repeat) tryNet();
      else minigame.setHolding(true);
      e.preventDefault();
    }
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
    twitchedThisFrame = true;
  });
  casting.onFightHold((holding) => {
    if (holding && minigame.getState().netReady) { tryNet(); return; }
    minigame.setHolding(holding);
  });
  // The net: a calm fish (not running, not jumping) goes in; a lively one bolts.
  function tryNet() {
    const f = casting.getFightFish();
    const inNet = fightFishMesh && createFishMesh(fightFishMesh.userData.speciesId);
    if (inNet) inNet.scale.copy(fightFishMesh.scale);
    const result = minigame.tryNet(!!f && !f.running && !f.jumping);
    if (result === 'netted') landingNet.scoop(inNet);
    if (result === 'bolted') {
      audio.splash(0.8);
      hud.showToast('It saw the net and bolted! Let it settle, then net it when it\u2019s calm.');
    }
  }

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

    // About 1 bite in 300 is the big one: a trophy far over the usual size.
    const trophy = forceTrophy || rollTrophy();
    forceTrophy = false;
    // Your level sets how big they run: beginners hook the small, easy ones.
    // Now and then a BOSS -- the top of your range or past it.
    const lvl = myLevel().level;
    const boss = !trophy && (forceBoss || rollBoss());
    forceBoss = false;
    const weightKg = trophy ? trophyWeightFor(species)
      : boss ? bossWeightFor(species, lvl)
        : randomWeightFor(species, sizeSkew(lvl), Math.random, sizeCap(lvl));
    if (trophy) hud.showToast('Something BIG is on! Don\'t horse it — ease off in the red and let it run.');
    else if (boss) hud.showToast(`BOSS FISH! A real test for level ${lvl} — keep the drag soft, don't wind while it runs.`);
    // Bigger fish run harder and give up line more slowly -- on any gear.
    casting.setFightStrength(fightStrength(species.id, weightKg));
    showFightFish(species, weightKg);
    minigame.start({
      species, weightKg, rod: activeRod, line: activeLine, hook: activeHook, reel: activeReel,
      stamina: fightStamina(species.id, weightKg), // big fish (and trophies) fight long
      drag: save.drag,
      // Big enough for the landing net; small ones are swung straight in.
      needsNet: weightKg >= ENGINE.landing.netMinKg,
      // It's only a catch once it's at your feet: at the bank, or beside
      // the stand -- never while it's still out in open water.
      canLand: () => {
        const f = casting.getFightFish();
        const me = playerController.getPosition();
        return !!f && !f.jumping && Math.hypot(f.position.x - me.x, f.position.z - me.z) <= ENGINE.fight.landReach;
      },
      onSuccess: () => {
        audio.landed();
        // A trophy pays triple. The catch's id fixes the price wobble, so the
        // server (which pays out when you're online) comes to the same sum.
        const catchId = newCatchId();
        // A boat rod on the fish it's rigged for pays extra, credits and XP.
        const bonus = boatBonus(boatRod, species.id);
        const payArgs = { species, weightKg: Math.round(weightKg * 100) / 100, rod: activeRod, line: activeLine, hook: activeHook, trophy, catchId, bonus };
        const payout = catchPayout(payArgs);
        const keepPayout = catchPayout({ ...payArgs, kept: true });
        const entry = save.catchLog[species.id] || { count: 0, bestWeightKg: 0 };
        const previousBestKg = entry.bestWeightKg;
        const levelBefore = myLevel().level;
        const boatPts = boatPoints({ weightKg: payArgs.weightKg, trophy, boss }, bonus);
        const earned = pointsForCatch({ weightKg, trophy, boss, kept: true }, entry.count ? { ...entry } : null) + boatPts;
        if (boatPts) entry.boatPts = (entry.boatPts || 0) + boatPts;
        // Running totals for level points: weight landed, personal bests.
        entry.totalKg = Math.round(((Number.isFinite(entry.totalKg) ? entry.totalKg : entry.count * (entry.bestWeightKg || 0) * 0.5) + weightKg) * 100) / 100;
        if (entry.count > 0 && weightKg > (entry.bestWeightKg || 0)) entry.pbs = (entry.pbs || 0) + 1;
        entry.count += 1;
        if (trophy) entry.trophies = (entry.trophies || 0) + 1;
        if (boss) entry.bosses = (entry.bosses || 0) + 1;
        entry.bestWeightKg = Math.max(entry.bestWeightKg, weightKg);
        save.catchLog[species.id] = entry;
        saveSave(save);
        const levelNow = myLevel();
        if (levelNow.level > levelBefore) {
          audio.landed();
          hud.showToast(`LEVEL ${levelNow.level}! New gear in the tackle box, and bigger fish are coming on.`);
        } else {
          hud.showToast(`${boss ? 'BOSS landed! ' : ''}+${earned} XP${boatPts ? ` (boat rod bonus +${boatPts})` : ''}`);
        }
        const phase = environment.getState().timeOfDay;
        // Online: every catch goes to the server (the dam's stats and your
        // catch log on every device). Beat the spot's record and it says so.
        const lengthCm = estimateLengthCm(species, weightKg);
        const damRecordBefore = cloud.cachedDamStats()?.dams?.[location.id]?.record;
        const damRecord = !!cloud.user() && !!cloud.cachedDamStats() && (!damRecordBefore || weightKg > damRecordBefore.weightKg);
        // Paid and sent once you choose: keep it or put it back.
        const decide = (kept) => {
          kept = kept && !species.protected;
          save.credits += kept ? keepPayout : payout;
          if (!kept) entry.released = (entry.released || 0) + 1;
          if (kept) keptHere[species.id] = (keptHere[species.id] || 0) + 1;
          else releasedHere += 1;
          entry.bestByDam = { ...(entry.bestByDam || {}), [location.id]: Math.max(entry.bestByDam?.[location.id] || 0, weightKg) };
          const before = challengeSnapshot();
          saveSave(save);
          cloud.queueCatch({
            id: catchId, speciesId: species.id, locationId: location.id, weightKg: Math.round(weightKg * 100) / 100,
            lengthCm, trophy, boss, timeOfDay: phase, kept, gear: { rodId: activeRod.id, lineId: activeLine.id, hookId: activeHook.id, ...(boatRod ? { boatRodId: boatRod.id } : {}) },
          });
          sessionCatches.push({ speciesId: species.id, weightKg, kept, locationId: location.id, timeOfDay: phase, trophy, caughtAt: new Date().toISOString() });
          const finished = challengeSnapshot().filter((c) => c.progress >= c.need && !before.find((b) => b.id === c.id && b.progress >= b.need));
          hud.showToast(finished.length
            ? `Challenge done: ${finished[0].text}! Claim ${finished[0].reward} credits in Challenges`
            : kept ? `Kept — +${keepPayout} credits` : `Released — it swims off strong. +${payout} credits`);
        };
        playerController.releasePointer();
        showCatchCard(appEl, {
          species, weightKg, payout, previousBestKg,
          lengthCm,
          damRecord,
          count: entry.count,
          locationName: location.name,
          timeLabel: phase.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
          trophy,
          boss,
          keepPayout,
          onChoice: decide,
          lockMs: 1500, // time to read the card before the buttons work
          onClose: () => touchControls?.setRodEnabled(true),
        });
        // The thumb is usually still on the rod button when the fish comes
        // in: switch it off so it can't cast or dismiss the card by accident.
        // (After the card opens, so replacing an old card can't re-enable it.)
        touchControls?.setRodEnabled(false);
        hideFightFish();
        catchReveal.spawn(species.id, casting.bobberPosition);
        casting.resetToIdle();
        bitingSpecies = null;
      },
      onFailure: (reason, info) => {
        saveSave(save);
        hideFightFish();
        if (reason === 'line-snapped' || reason === 'hook-straightened') audio.snap();
        // What gave -- rod, reel, line or hook -- and what to change.
        showLossReport(appEl, diagnoseLoss(reason, info, { rod: activeRod, reel: activeReel, line: activeLine, hook: activeHook, weightKg }));
        casting.resetToIdle();
        bitingSpecies = null;
      },
    });
  });

  // The distance counter: metres from where you stand (flat, like a
  // rangefinder) to wherever the action is right now.
  let castResult = null;
  const aimLanding = new THREE.Vector3();
  function updateDistanceCounter(delta) {
    const me = playerController.getPosition();
    const flat = (p) => Math.hypot(p.x - me.x, p.z - me.z);
    const phase = casting.getState().phase;
    if (castResult) castResult.showFor -= delta;
    if (phase === 'biting') {
      const f = casting.getFightFish();
      if (f) {
        const trend = f.takingLine ? 'out' : minigame.getState().holding ? 'in' : '';
        hud.setDistance('Fish', flat(f.position), { trend });
        return;
      }
    }
    if (castResult && castResult.showFor > 0 && (phase === 'waiting' || phase === 'reeling')) {
      hud.setDistance('Cast', castResult.meters, { highlight: true });
      return;
    }
    if (phase === 'inAir' || phase === 'waiting' || phase === 'reeling') {
      hud.setDistance(phase === 'inAir' ? 'Cast' : 'Line', flat(casting.bobberPosition));
      return;
    }
    if (phase === 'idle' || phase === 'hanging' || phase === 'aiming') {
      // Where the aim ring sits: this cast's distance at the power so far.
      casting.getPredictedLanding(aimLanding);
      hud.setDistance('Aim', flat(aimLanding), { extra: finderText(aimLanding) });
      return;
    }
    hud.setDistance(null);
  }

  // How close (metres, flat) the fish must come to you to be landed.

  let landHintTimer = 0;
  function tickLandingHint(delta) {
    landHintTimer -= delta;
    const s = minigame.getState();
    if (s.active && s.slack && !s.airborne && landHintTimer <= 0) {
      hud.showToast('Slack line — it\'s swimming toward you. Reel in or it throws the hook!');
      landHintTimer = 2.5;
      return;
    }
    if (s.active && s.landingBlocked && landHintTimer <= 0) {
      hud.showToast("It's at the edge but you're too far back — walk to the water to land it");
      landHintTimer = 4;
    }
  }

  let forceTrophy = false; // dev hook: the next bite is a trophy
  let forceBoss = false; // dev hook: the next bite is a boss
  // A fish takes the bait -- not hooked yet. See strike.js.
  let take = null; // { plan, species, t, warned, real }
  let comeBackTimer = 0; // after a strike too early, the fish may come back
  function startBite(species) {
    const plan = planTake({ species, lure: currentLure(), hook: activeHook, reel: activeReel });
    if (!casting.triggerTake()) return;
    take = { plan, species, t: 0, warned: false, real: false };
  }
  // Hooked: the fight starts.
  function hookFish(species) {
    take = null;
    audio.bite();
    bitingSpecies = species;
    hud.showToast('Fish on!');
    casting.triggerBite(species.bite, species.id);
  }
  function endTake(message) {
    take = null;
    casting.cancelTake();
    if (message) hud.showToast(message);
  }
  function tickTake(delta) {
    if (!take) return;
    if (casting.getState().phase !== 'take') { take = null; return; }
    take.t += delta;
    const look = takeLook(take.plan, take.t);
    casting.setTakeLook(look);
    if (look.cue === 'false' && !take.warned) {
      take.warned = true;
      hud.showToast(take.plan.type === 'run' || take.plan.type === 'pull' ? 'The rod tip knocks… something’s at the bait' : 'Something’s at the bait…');
    }
    if (look.cue === 'real' && !take.real) {
      take.real = true;
      audio.bite();
      hud.showToast(`${take.species.bite?.label || 'A take'}! Strike!`);
    }
    if (take.t > take.plan.end) {
      const species = take.species;
      if (takeExpired(take.plan) === 'selfHooked') { hookFish(species); return; }
      const lure = currentLure();
      endTake(`It dropped the bait.${take?.plan.type === 'hit' ? '' : ' Strike sooner!'}`);
      // Soft baits get stripped off the hook by a fish that drops them.
      const softBait = lure.soft || ['bread-bait', 'worm', 'dough-bait', 'sardine', 'mielies'].includes(lure.id);
      if (softBait && Math.random() < 0.5) loseBait('was stripped off the hook');
    }
  }
  casting.onStrike(() => {
    if (!take) return;
    const result = judgeStrike(take.plan, take.t, { species: take.species, hook: activeHook, lure: currentLure() });
    if (result === 'hooked') hookFish(take.species);
    else if (result === 'early') {
      comeBackTimer = ENGINE.strike.comeBackSeconds;
      endTake('Too early — you pulled the bait away. It might come back…');
    } else if (result === 'missed') endTake(activeHook.id === 'hook-circle' ? 'Missed — with a circle hook, don’t strike: just start winding.' : 'Missed — the hook didn’t stick.');
    else endTake('Too late — it dropped the bait.');
  });

  // The hooked fish itself: hidden in the murk while it's deep, seen as it
  // comes up near the top, and in full view when it jumps.
  let fightFishMesh = null;
  let fishRingTimer = 0, fishSprayTimer = 0, lastFightElapsed = 0;
  function showFightFish(species, weightKg) {
    hideFightFish();
    fightFishMesh = createFishMesh(species.id);
    // Sized to the real fish: the model is ~0.62 m long at scale 1.
    fightFishMesh.scale.setScalar((estimateLengthCm(species, weightKg) / 100) / 0.62);
    fightFishMesh.userData.speciesId = species.id;
    fightFishMesh.visible = false;
    scene.add(fightFishMesh);
  }
  function hideFightFish() {
    if (fightFishMesh) scene.remove(fightFishMesh);
    fightFishMesh = null;
  }
  function updateFightFish(elapsed) {
    const f = casting.getFightFish();
    const dt = Math.min(0.1, Math.max(0, elapsed - lastFightElapsed));
    lastFightElapsed = elapsed;
    // A fish fighting on top churns the water white; one just under bulges
    // and sends out rings.
    const nearTop = f && !f.jumping ? Math.max(0, 1 - f.depth / 0.6) : 0;
    const churn = nearTop * (f?.takingLine || f?.running ? 1 : 0.55);
    if (f && fightFishMesh) {
      const len = fightFishMesh.scale.x * 0.62;
      water.setBoil(f.position.x, f.position.z, 0.35 + len * 1.1, churn);
      fishRingTimer -= dt;
      if (churn > 0.2 && fishRingTimer <= 0) {
        water.addRipple(f.position.x + (Math.random() - 0.5) * len, f.position.z + (Math.random() - 0.5) * len, 0.4 + churn * len * 1.5);
        fishRingTimer = 0.18 + Math.random() * 0.3;
      }
    } else {
      water.setBoil(0, 0, 1, 0);
    }
    if (!fightFishMesh || !f) { if (fightFishMesh) fightFishMesh.visible = false; return; }
    fightFishMesh.visible = f.jumping || f.depth < 0.45;
    fightFishMesh.position.copy(f.position);
    // Thrashing on top: the back and tail break the surface.
    if (churn > 0.5) fightFishMesh.position.y = Math.max(fightFishMesh.position.y, -0.05 * fightFishMesh.scale.x);
    // The model faces +x; turn it to its heading, nose up/down in a leap. On
    // top it rolls onto its flank and shakes its head.
    const roll = churn * (Math.sin(elapsed * 6.1) * 0.55 + Math.sin(elapsed * 13.7) * 0.2);
    const shake = churn * Math.sin(elapsed * 17) * 0.12;
    fightFishMesh.rotation.set(roll, -f.heading + shake, f.pitch, 'YXZ');
    setFishSwim(fightFishMesh, elapsed * (f.jumping ? 20 : 12 + churn * 8), f.jumping ? 2.2 : 1.4 + churn * 1.2);
    // Water streams off a leaping fish.
    if (f.jumping) {
      fishSprayTimer -= dt;
      if (fishSprayTimer <= 0) { splashEffect.spray(f.position, 0.25 + fightFishMesh.scale.x * 0.12); fishSprayTimer = 0.05; }
    }
  }

  // A cast that's sat this long is guaranteed a bite -- the exact moment
  // stays random (the escalating urgency below front-loads the odds, this
  // is just the backstop for a run of bad luck).


  // Bait off the hook: nothing bites a bare hook. Reeling in re-baits.
  let bareHook = false;
  function loseBait(how) {
    if (bareHook) return;
    bareHook = true;
    hud.showToast(`Your ${currentLure().name.toLowerCase()} ${how} — reel in and re-bait.`);
  }

  // ── Reading the water (waterReading.js) ──
  const floatDepth = () => save.settings?.floatDepth ?? 1.5;
  const finderLevel = () => Math.max(0, ...(save.ownedGadgetIds || []).map((id) => getGearById(GADGETS, id)?.level || 0));
  const spotAt = (p) => readSpot(dam, p.x, p.z, environment.getState());
  function landingReport(point) {
    const spot = spotAt(point);
    const bait = baitDepth({ lure: currentLure(), floatDepthM: floatDepth(), waterDepthM: spot.depthM });
    const d = `${spot.depthM.toFixed(1)} m`;
    const rest = [zoneName(spot.zone), spot.dropOff ? 'on a drop-off' : null, spot.windward ? 'wind blowing in' : null].filter(Boolean).join(' · ');
    let head;
    if (rigFor(currentLure()) === 'float') head = bait.onBottom ? `Float lying flat — bait on the bottom in ${d}` : `Float at ${floatDepth().toFixed(1)} m in ${d} of water`;
    else if (bait.onBottom) head = `Touched bottom: ${d}`;
    else head = `${d} of water`;
    return rest ? `${head} — ${rest}` : head;
  }
  // A fish finder: depth and cover where you aim (and fish showing, on the
  // better one). Worked out again only when the aim moves.
  let finderCache = { x: 1e9, z: 1e9, text: '' };
  function finderText(p) {
    const level = finderLevel();
    if (!level) return '';
    if (Math.hypot(p.x - finderCache.x, p.z - finderCache.z) < 0.7) return finderCache.text;
    let text = '';
    if (dam.isWater(p.x, p.z)) {
      const spot = spotAt(p);
      text = describeSpot(spot);
      if (level >= 2) {
        const env = environment.getState();
        const habitat = { zone: dam.zoneAt(p.x, p.z).type, depthFactor: dam.depthFactorAt(p.x, p.z) };
        let activity = 0;
        for (const sp of localSpecies) {
          const share = location.catchShare?.[sp.id] ?? 100 / localSpecies.length;
          const best = { depth: 0, onBottom: true }; // as the fish would like it
          activity += share * suitability(sp, { waterTempC: env.waterTempC, equippedLureId: sp.preferredLureIds[0], timeOfDay: env.timeOfDay, habitat, lureKind: 'bait' })
            * waterMultiplier(sp.id, spot, best) / ENGINE.water.rightDepth;
        }
        const bars = activity >= 60 ? 3 : activity >= 35 ? 2 : activity >= 15 ? 1 : 0;
        text += ` · fish ${'▮'.repeat(bars)}${'▯'.repeat(3 - bars)}`;
      }
    }
    finderCache = { x: p.x, z: p.z, text };
    return text;
  }

  // Challenge progress after a catch (online: this session's catches;
  // guests: every catch kept on this device).
  const sessionCatches = [];
  function challengeSnapshot() {
    const catches = cloud.user() ? sessionCatches : cloud.guestCatches();
    return challengesFor().map((c) => ({ id: c.id, text: c.text, reward: c.reward, need: c.need, progress: progressOf(c, catches) }));
  }

  // ── Levels (levels.js): points from the catch log and competition places ──
  function myLevel() {
    return levelInfo(pointsFromLog(save.catchLog, save.compPlaces));
  }

  // ── Landing the fish: snags, the net, keep or release ──
  let releasedHere = 0;
  const keptHere = {};
  function damHealth(speciesId) {
    const L = ENGINE.landing;
    return (1 + Math.min(L.releaseBoostMax, releasedHere * L.releaseBoost))
      * Math.max(1 - L.keepPenaltyMax, 1 - (keptHere[speciesId] || 0) * L.keepPenalty);
  }
  let lastCover = null, lastSnag = null, lastNetReady = false;
  let debugNetAt = null; // dev hook: a pretend fish to show the net on
  const landingNet = createLandingNet(scene, { onSplash: (point, strength) => splashEffect.spawn(point, strength) });
  function tickLanding(delta, elapsed) {
    const f = casting.getFightFish();
    const mg = minigame.getState();
    minigame.setSnagged(!!f?.snagged);
    if (f?.headingForCover && f.headingForCover !== lastCover) hud.showToast(`It's heading for the ${f.headingForCover}! Rod up — turn its head!`);
    if (f?.snagged && f.snagged !== lastSnag) hud.showToast(`Snagged in the ${f.snagged} — stop winding and let it swim out`);
    if (f?.freed) hud.showToast('It swam out of the snag — keep it coming!');
    if (mg.active && mg.netReady && !lastNetReady) hud.showToast(`Net it! ${touchMode ? 'Tap' : 'Click'} when it's calm at the surface`);
    lastCover = f?.headingForCover || null;
    lastSnag = f?.snagged || null;
    lastNetReady = mg.active && mg.netReady;
    // The landing net: slides in by the fish while it's ready to net, lifts
    // it out on a good scoop.
    const me = playerController.getPosition();
    const wu = water.uniforms;
    landingNet.setWater({ seeDepthM: 0.15 + wu.uClarity.value * 1.2, tint: wu.uShallow.value });
    landingNet.update(delta, elapsed, {
      show: !!(f && mg.active && mg.netReady) || !!debugNetAt,
      fishPos: f?.position || debugNetAt,
      playerPos: { x: me.x, y: camera.position.y - 1.6, z: me.z },
    });
  }

  // What the fish see right now: the water, the bait or lure, the rig.
  function biteConditions() {
    const state = environment.getState();
    const spot = readSpot(dam, casting.bobberPosition.x, casting.bobberPosition.z, state);
    const bait = baitDepth({ lure: currentLure(), floatDepthM: floatDepth(), waterDepthM: spot.depthM });
    return {
      waterTempC: state.waterTempC, equippedLureId: activeLureId, timeOfDay: state.timeOfDay,
      habitat: casting.getBobberHabitat(), lureKind: currentLure().kind, chumBoost: chumSystem.boostAt(casting.bobberPosition),
      // The right hook and line for the fish get more bites.
      gearBite: (s) => (activeHook.biteBonus?.[s.id] ?? 1) * (activeLine.biteBonus?.[s.id] ?? 1)
        * (activeRod.biteBonus?.[s.id] ?? 1) * rig.biteFactor
        // A baitrunner only helps with bait: the fish runs off with it freely.
        * (currentLure().kind === 'bait' ? (activeReel.biteBonus?.[s.id] ?? 1) : 1)
        // The right depth, a drop-off, the windward bank.
        * waterMultiplier(s.id, spot, bait)
        // Released fish keep the dam healthy; kept ones fish it out.
        * damHealth(s.id),
    };
  }

  // ── Working a lure (lureAction.js): the action meter, and fish that
  // follow a well-worked lure in and hit it -- or turn away. ──
  const actionTracker = createActionTracker();
  let lureAction = null; // { quality, hint, label } while a lure is being worked
  let twitchedThisFrame = false;
  let follow = null; // { species, t, dur, mesh }
  const lureMeter = document.createElement('div');
  lureMeter.className = 'lure-meter hidden';
  lureMeter.innerHTML = '<span class="lm-label"></span><div class="lm-bar"><i></i></div><span class="lm-hint"></span>';
  appEl.appendChild(lureMeter);
  const followAway = new THREE.Vector3();
  function endFollow(message) {
    if (!follow) return;
    scene.remove(follow.mesh);
    follow = null;
    if (message) hud.showToast(message);
  }
  function tickLureAction(delta, elapsed) {
    const phase = casting.getState().phase;
    const retrieve = retrieveFor(currentLure());
    const fishing = retrieve && (phase === 'waiting' || phase === 'reeling') && casting.isBobberInWater() && !bareHook;
    if (fishing) {
      actionTracker.update(delta, { speed: casting.getLureSpeed(), twitched: twitchedThisFrame });
      const scored = scoreAction(retrieve, actionTracker.features());
      lureAction = { ...scored, label: retrieve.label };
    } else {
      actionTracker.reset();
      lureAction = null;
    }
    twitchedThisFrame = false;
    // The meter.
    lureMeter.classList.toggle('hidden', !lureAction);
    if (lureAction) {
      const q = lureAction.quality;
      lureMeter.querySelector('.lm-label').textContent = `Action: ${lureAction.label}`;
      const bar = lureMeter.querySelector('.lm-bar i');
      bar.style.width = `${Math.round(q * 100)}%`;
      bar.style.background = q > 0.7 ? '#7fd18a' : q > 0.4 ? '#ffcf7a' : '#ff8a70';
      lureMeter.querySelector('.lm-hint').textContent = lureAction.hint;
    }
    // A fish following the lure in.
    if (!fishing) {
      if (follow && phase === 'hanging') endFollow('It followed it right to your feet, then swam off.');
      else endFollow(null);
      return;
    }
    const lurePos = casting.bobberPosition;
    const me = playerController.getPosition();
    const near = Math.hypot(lurePos.x - me.x, lurePos.z - me.z) < 30;
    if (!follow && near && lureAction.quality >= 0.6 && Math.random() < ENGINE.lures.followChance * lureAction.quality * delta) {
      const species = pickGuaranteedBite(localSpecies, biteConditions(), location.catchShare);
      if (species) {
        const mesh = createFishMesh(species.id);
        mesh.scale.setScalar((estimateLengthCm(species, randomWeightFor(species)) / 100) / 0.62);
        scene.add(mesh);
        follow = { species, t: 0, dur: 2.5 + Math.random() * 3, mesh };
      }
    }
    if (!follow) return;
    follow.t += delta;
    // Just behind the lure, closing on it.
    const tip = casting.getRodTipWorld();
    followAway.set(lurePos.x - tip.x, 0, lurePos.z - tip.z).normalize();
    const gap = 1.4 - Math.min(1, follow.t / follow.dur) * 0.9;
    follow.mesh.position.set(lurePos.x + followAway.x * gap, lurePos.y - 0.28, lurePos.z + followAway.z * gap);
    follow.mesh.rotation.set(0, Math.atan2(followAway.z, -followAway.x), 0);
    setFishSwim(follow.mesh, elapsed * 9, 1.2);
    if (lureAction.quality < 0.35) { endFollow(`It turned away — ${lureAction.hint.toLowerCase()}.`); return; }
    if (follow.t >= follow.dur) {
      const species = follow.species;
      endFollow(null);
      startBite(species);
    }
  }

  function rollBitesIfWaiting(delta) {
    const castState = casting.getState();
    const phase = castState.phase;
    if (phase === 'idle' || phase === 'hanging' || phase === 'aiming') bareHook = false;
    if (phase !== 'waiting' && phase !== 'reeling') return;
    if (!casting.isBobberInWater()) return; // nothing bites a lure on the bank
    if (bareHook) return;
    // Soft baits wash off or get picked off as they soak.
    if (Math.random() < soakLossChance(currentLure(), delta, phase === 'reeling' || castState.working)) {
      loseBait('came off the hook');
      return;
    }
    const conditions = biteConditions();
    const waitElapsed = castState.waitElapsed || 0;
    // Ramps from 1x up to a steep 41x as the wait nears the guarantee, so a
    // bite becomes very likely well before the deadline without landing at a
    // predictable moment every time.
    const urgency = 1 + Math.pow(Math.min(1, waitElapsed / ENGINE.bites.guaranteeSeconds), 4) * 40;
    // Bait: a twitch draws a look. Lures: how well you're working it.
    const actionMult = lureAction ? actionBiteMultiplier(lureAction.quality) : (twitchBoostTimer > 0 ? 1.8 : 1);
    const biteChanceMultiplier = actionMult * (comeBackTimer > 0 ? 3 : 1) * urgency;
    const bite = rollDamBite(localSpecies, location.catchShare, { ...conditions, deltaSeconds: delta, biteChanceMultiplier });
    if (bite) {
      startBite(bite);
      return;
    }

    if (waitElapsed >= ENGINE.bites.guaranteeSeconds) {
      const forced = pickGuaranteedBite(localSpecies, conditions, location.catchShare);
      if (forced) startBite(forced);
    }
  }

  let lastTime = performance.now();
  let lastSeason = null;
  let lastCastPhase = 'idle';
  let castSnap = 0;
  let rigToastCooldown = 0;
  let lastCanChum = null;
  const rodAimScratch = new THREE.Vector3();
  const rodFishScratch = new THREE.Vector3();
  let timeOverride = null;
  let seasonOverride = null;

  // Dynamic resolution: the picture's sharpness follows the frame rate all
  // the time, not just at the start. Below ~55 frames a second it draws
  // fewer pixels (down to half); with steady headroom it creeps back up to
  // the setting's full sharpness. Watched over 1.5 s windows so a single
  // hitch (a splash, a new spot coming into view) doesn't trigger it.
  let fullRatio = pixelRatio;
  let minRatio = Math.max(0.5, fullRatio * 0.5);
  // A bigger or smaller window (or turning a phone) moves the pixel budget's
  // sharpness: keep the picture inside it.
  window.addEventListener('resize', () => {
    if (!window.innerWidth || !window.innerHeight) return;
    const was = fullRatio;
    fullRatio = sharpnessFor(gfx);
    minRatio = Math.min(fullRatio, Math.max(0.5, fullRatio * 0.5));
    if (fullRatio !== was) setRatio(pixelRatio * (fullRatio / was));
  });
  let perfWindow = 0, perfFrames = 0, perfSkip = 60, calmWindows = 0, slowWindows = 0;
  let lastFrameMs = 16.7;
  function setRatio(r) {
    pixelRatio = Math.min(fullRatio, Math.max(minRatio, r));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize();
  }
  function adaptQuality(delta) {
    lastFrameMs = lastFrameMs * 0.9 + delta * 1000 * 0.1;
    if (quality === 'low') return;
    if (perfSkip > 0) { perfSkip--; return; } // startup and right after a change
    perfWindow += delta;
    perfFrames++;
    if (perfWindow < 1.5) return;
    const avgMs = (perfWindow / perfFrames) * 1000;
    perfWindow = 0;
    perfFrames = 0;
    if (avgMs > 18.5) {
      slowWindows++;
      calmWindows = 0;
      if (slowWindows >= 1 && pixelRatio > minRatio) {
        setRatio(pixelRatio * (avgMs > 30 ? 0.75 : 0.88));
        perfSkip = 30;
        slowWindows = 0;
      }
    } else {
      slowWindows = 0;
      calmWindows++;
      // Several smooth windows in a row: try a little sharper.
      if (calmWindows >= 4 && pixelRatio < fullRatio) {
        setRatio(pixelRatio * 1.08);
        perfSkip = 30;
        calmWindows = 0;
      }
    }
  }

  // F3 shows how the game is running: frames a second, the frame time, how
  // sharp it's drawing, and which graphics chip and renderer it's on.
  const perfBox = document.createElement('div');
  perfBox.className = 'perf-overlay';
  perfBox.hidden = true;
  appEl.appendChild(perfBox);
  let gpuName = GPU.on ? 'WebGPU' : 'WebGL';
  if (GPU.on) {
    navigator.gpu.requestAdapter().then((a) => {
      const info = a?.info || {};
      gpuName = `WebGPU · ${[info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'unknown card'}`;
    }).catch(() => {});
  } else {
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpuName = `WebGL · ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown card'}`;
    } catch { /* no details */ }
  }
  let perfShownAt = 0;
  function updatePerfBox(now) {
    if (perfBox.hidden || now - perfShownAt < 0.5) return;
    perfShownAt = now;
    perfBox.textContent = `${Math.round(1000 / lastFrameMs)} fps · ${lastFrameMs.toFixed(1)} ms · sharpness ${Math.round((pixelRatio / fullRatio) * 100)}% · ${Math.round(window.innerWidth * pixelRatio)}×${Math.round(window.innerHeight * pixelRatio)} · ${quality}\n${gpuName}`;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      perfBox.hidden = !perfBox.hidden;
      perfShownAt = 0;
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    adaptQuality(delta);
    updatePerfBox(now / 1000);
    frame(delta, now / 1000);
  }

  let lastRiseSound = -99;
  function frame(delta, elapsed) {
    if (!paused) {
      environment.tick(delta);
      const envState = environment.getState();
      setWaterTemperature(envState.waterTempC);
      waterClock = elapsed;
      playerController.update(delta);
      updateBoat(delta, elapsed);
      const atmos = world.update({ delta, elapsed, envState, timeOverride });
      boats?.update(elapsed, delta, { camera, windSpeed: envState.windSpeed, light: world.hemiLight.intensity });
      setPeopleLight(world.hemiLight.intensity);
      water.setAtmosphere(atmos, envState.windSpeed, windUniforms.uWindDir.value);
      updateWater(waterMesh, elapsed);
      post.setLook(atmos, elapsed, location.skyWarmth);
      updateFishSwarm(fishSwarm, elapsed, (point, landing) => {
        splashEffect.spawn(point, 0.8);
        // A fish rising: one soft bloop as it drops back in, and not every
        // time -- two dozen fish splashing on cue sounded like knocking.
        if (landing && elapsed - lastRiseSound > 4 + Math.random() * 4) {
          const heard = hearingFalloff(point);
          if (heard > 0.03) { audio.rise(heard); lastRiseSound = elapsed; }
        }
      }, chumSystem.attractors(), delta);
      catchReveal.update(delta);
      splashEffect.update(delta);
      chumSystem.update(delta, elapsed);
      const season = seasonOverride || envState.season;
      if (season !== lastSeason) {
        world.setSeason(season);
        lastSeason = season;
      }

      casting.update(delta, envState);
      // Playing a fish: the view follows it, and up/down moves the rod.
      const fighting = casting.getState().phase === 'biting';
      playerController.setFightTarget(fighting ? casting.bobberPosition : null);
      minigame.setRodLift(fighting ? playerController.getRodLift() : 0);
      // A fish running away keeps the line tight against the drag.
      minigame.setFishPulling(!!casting.getFightFish()?.takingLine);
      tickLanding(delta, elapsed);
      rollBitesIfWaiting(delta);
      tickTake(delta);
      tickLureAction(delta, elapsed);
      comeBackTimer = Math.max(0, comeBackTimer - delta);
      tickTips(delta);
      touchControls?.update();
      updateFightFish(elapsed);
      tickLandingHint(delta);
      updateSound(delta);
      updateDistanceCounter(delta);
      minigame.update(delta);

      const mgState = minigame.getState();
      const castState = casting.getState();

      // Rod feel. These are *targets* -- the rod springs toward them, so it
      // never jumps: swept back over the shoulder while charging a cast,
      // punched forward toward the water on release, flicked up on a twitch,
      // held high against a fighting fish. The blank's flex is simulated in
      // rod.js from the swing and from how hard the line is pulling.
      if (lastCastPhase === 'aiming' && castState.phase === 'inAir') {
        if (!castState.flyStroke) castSnap = 1;
        // A rig that doesn't belong together says why the cast fell short.
        if (!rig.ok && rigToastCooldown <= 0) {
          hud.showToast(`${rig.issues[0]} (Tackle Box)`);
          rigToastCooldown = 25;
        }
      }
      rigToastCooldown = Math.max(0, rigToastCooldown - delta);
      lastCastPhase = castState.phase;
      castSnap = Math.max(0, castSnap - delta * 2.2);
      twitchBoostTimer = Math.max(0, twitchBoostTimer - delta);
      rodRecoil = Math.max(0, rodRecoil - delta * 2.5);
      const mouse = casting.getMouseOffset();
      // Positive pitch lifts the tip. Mouse up raises the rod a touch, a
      // twitch flicks it up, and the release punches it forward and down.
      let rodPitch = playerRod.restTilt + mouse.y * 0.1 + rodRecoil - castSnap * 0.8;
      let rodYaw = -mouse.x * 0.12;
      const lineOut = castState.phase === 'inAir' || castState.phase === 'waiting' || castState.phase === 'reeling' || castState.phase === 'biting' || castState.phase === 'take';
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
        // Up/down moves the rod: tip right down at the water, up to held
        // high for pumping the fish in.
        const lift = playerController.getRodLift();
        rodPitch += 0.35 + lift * (lift < 0 ? 0.9 : 0.6) + (mgState.holding ? 0.08 : 0);
        // A hooked fish loads the blank hard -- harder the more line tension.
        linePull = 0.15 + (mgState.tension || 0) * 0.4 + (mgState.holding ? 0.06 : 0);
        // Swing the rod a little toward wherever the fish is running.
        camera.getWorldDirection(rodAimScratch);
        const toFish = rodFishScratch.subVectors(casting.bobberPosition, camera.position);
        const side = rodAimScratch.x * toFish.z - rodAimScratch.z * toFish.x;
        rodYaw += THREE.MathUtils.clamp(side / Math.max(1, toFish.length()), -0.4, 0.4) * 0.5;
      } else if (castState.flyStroke) {
        // Fly casting: the rod stops high behind on the back cast (about one
        // o'clock) and punches forward to ten o'clock, the line loading the
        // blank toward wherever the loop is pulling it.
        const fs = castState.flyStroke;
        rodPitch = playerRod.restTilt + (fs.forward ? (fs.delivery ? -0.35 : -0.15) : 1.05);
        pullTarget = fs.pull;
        linePull = 0.05 + 0.12 * Math.sin(Math.PI * Math.min(1, fs.s * 1.6));
      } else if (castState.phase === 'take') {
        // The take: knocks on the rod tip, and the line loading on a run.
        linePull = 0.02 + (take ? takeLook(take.plan, take.t).pull : 0);
      } else if (castState.phase === 'reeling') linePull = 0.06;
      else if (castState.phase === 'waiting') linePull = castState.working ? 0.07 : 0.015;
      else if (castState.phase === 'inAir') linePull = 0.02;
      // How much line is lying in the water, holding the tip back.
      let lineDrag = 0;
      if (casting.isBobberInWater()) {
        if (castState.phase === 'biting') lineDrag = 1;
        else if (castState.phase === 'reeling' || castState.working) lineDrag = 0.8;
        else if (castState.phase === 'waiting' || castState.phase === 'take') lineDrag = 0.6;
      }
      playerRod.update(delta, { pitch: rodPitch, yaw: rodYaw, pullTarget, pull: linePull, lineDrag });
      if (castState.phase === 'reeling' || castState.working || (mgState.active && mgState.holding)) {
        playerRod.spinReel(delta * 14);
      }
      const canChum = save.credits >= ENGINE.money.chumCost;
      if (canChum !== lastCanChum) { actionBar.setEnabled('chum', canChum); lastCanChum = canChum; }
      hud.setFight(mgState.active ? mgState : null);
      hud.update({
        credits: save.credits,
        level: myLevel(),
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
        bareHook,
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
  // The fishing line is too thin to show a reflection; drawn in it, it looks
  // like a second line running straight down into the water.
  const hiddenInReflection = [playerRod.rodGroup, casting.lineMesh, ...fishSwarm];
  if (GPU.on && water.reflection) {
    // WebGPU's reflector draws the mirror view itself, from a camera that
    // sees only layer 0: the rod and line move to layer 2 (the fish are
    // under the mirror plane, so it clips them anyway).
    for (const obj of [playerRod.rodGroup, casting.lineMesh]) obj.traverse((o) => o.layers.set(2));
    camera.layers.enable(2);
    const mirrorCam = new THREE.PerspectiveCamera();
    mirrorCam.copy(camera, false);
    mirrorCam.layers.set(0);
    water.reflection.reflector.virtualCameras.set(camera, mirrorCam);
  }
  // Work that needn't be redone every frame: the water's mirror image is
  // redrawn every other frame (the ripples hide the difference), and the
  // sun's shadows only when you move or every other frame otherwise.
  let frameNo = 0;
  const sunShadow = world.sunLight.shadow;
  sunShadow.autoUpdate = false;
  const lastShadowAt = new THREE.Vector3(Infinity, 0, 0);
  if (GPU.on && water.reflection) {
    const reflector = water.reflection.reflector;
    const drawMirror = reflector.updateBefore.bind(reflector);
    reflector.updateBefore = (f) => (frameNo % 2 === 0 ? drawMirror(f) : undefined);
  }
  function renderFrame() {
    frameNo++;
    if (frameNo % 2 === 0 || camera.position.distanceToSquared(lastShadowAt) > 0.0004) {
      sunShadow.needsUpdate = true;
      lastShadowAt.copy(camera.position);
    }
    if (!GPU.on && frameNo % 2 === 0) water.renderReflection(renderer, scene, camera, hiddenInReflection);
    post.render(scene, camera);
  }
  // Build every material's graphics program before the first frame, so the
  // game doesn't hitch the first time each thing comes into view.
  const warmUp = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve();
  warmUp.then(() => animate());

  window.__game = {
    environment, casting, minigame, save, scene, camera, catchReveal, fishSwarm,
    playerController, location, localSpecies, dam, chumSystem, world, renderer, water, post, playerRod, audio,
    // Dev hook: GPU-synchronised cost of one full frame, in ms.
    timeFrame: (frames = 10) => {
      if (GPU.on) {
        const t0 = performance.now();
        for (let i = 0; i < frames; i++) renderFrame();
        return (performance.now() - t0) / frames;
      }
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
    // Dev hooks: your boat (null where boats aren't allowed), and G.
    myBoat,
    toggleBoat,
    camp: world.camp,
    boats,
    standAt: (x, z, yaw, pitch) => playerController.setPosition(x, z, yaw, pitch),
    // Dev hook: run the game loop by hand (steps of dt seconds), then render.
    advance: (steps = 1, dt = 1 / 60) => {
      for (let i = 0; i < steps; i++) {
        lastTime = performance.now();
        frame(dt, lastTime / 1000);
      }
    },
    // Dev hook: force a bite from a given local species (line must be out).
    // Dev hook: a fish takes the bait (not hooked) -- strike to test timing.
    debugForceTake: (speciesId) => {
      const species = localSpecies.find((s) => s.id === speciesId) || localSpecies[0];
      startBite(species);
      return take?.plan;
    },
    // Dev hook: show the landing net on a pretend fish `metres` out in front;
    // scoop it with a species id; null puts the net away.
    debugNet: (metres = 2.5, scoopSpecies = null) => {
      if (metres == null) { debugNetAt = null; return; }
      const me = playerController.getPosition();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      debugNetAt = new THREE.Vector3(me.x + dir.x * metres, -0.1, me.z + dir.z * metres);
      if (scoopSpecies) {
        const mesh = createFishMesh(scoopSpecies);
        mesh.scale.setScalar(0.6 / 0.62);
        debugNetAt = null;
        landingNet.scoop(mesh);
      }
    },
    debugForceBite: (speciesId, { trophy = false, boss = false } = {}) => {
      forceBoss = boss;
      const species = localSpecies.find((s) => s.id === speciesId) || localSpecies[0];
      forceTrophy = trophy;
      hookFish(species);
    },
  };
}
