import * as THREE from '../vendor/three.module.js';
import { createSky, createMist, createAtmosphereState, sampleAtmosphere, applyAtmosphere } from './gfx/atmosphere.js';
import { createTerrain } from './gfx/terrain.js';
import { createGrass } from './gfx/grass.js';
import { createTrees } from './gfx/trees.js';
import { createShoreline } from './gfx/shoreline.js';
import { createProps } from './gfx/props.js';
import { createWildlife } from './gfx/life.js';
import { windUniforms, updateWind } from './gfx/wind.js';
import { createCamp } from './gfx/camp.js';
import { createDressing } from './gfx/dressing.js';
import { seedFromString } from './gfx/noise.js';

// Ground colour shifts with the season on top of each dam's own grass tint:
// green summers, gold autumns, and the Highveld's straw-brown winters.
const GROUND_SEASON = {
  summer: 0xffffff,
  autumn: 0xf2dca0,
  winter: 0xffc878,
  spring: 0xeefcd8,
};

export function createScene({ location, dam, quality = 'high' }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfeeff, 40, 220);

  const { sky, uniforms: skyUniforms } = createSky(scene);

  const camera = new THREE.PerspectiveCamera(60, (window.innerWidth / window.innerHeight) || 16 / 9, 0.1, 9000);
  camera.layers.enable(1); // layer 1 = grass & mist, skipped by the water's reflection pass
  camera.position.set(dam.spawn.x, dam.floorHeight(dam.spawn.x, dam.spawn.z) + 1.6, dam.spawn.z);
  camera.rotation.set(-0.1, dam.spawn.yaw, 0, 'YXZ');
  scene.add(camera);

  // A far bank 700m away has to show through the haze, so each dam's fog
  // reaches out in proportion to how big the view across the water is.
  const far = dam.spec.farShore;
  // (Daytime fog runs out to ~220m; stretch it so the far bank sits well
  // inside it, only lightly hazed.)
  const fogScale = far ? Math.min(8, Math.max(2.5, (far * 2.6) / 220)) : 6;

  const hemiLight = new THREE.HemisphereLight(0xbfe0ff, 0x4a4a30, 0.7);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 3);
  sunLight.castShadow = true;
  const shadowSize = { low: 1024, medium: 2048, high: 2048, ultra: 4096, ultraplus: 4096 }[quality] ?? 2048;
  sunLight.shadow.mapSize.set(shadowSize, shadowSize);
  const S = quality === 'ultra' || quality === 'ultraplus' ? 48 : 34;
  Object.assign(sunLight.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 240 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  // Soft shadow edges: PCF filtering spread over this many texels.
  sunLight.shadow.radius = { low: 1, medium: 2, high: 2.5, ultra: 3, ultraplus: 3 }[quality] ?? 2.5;
  scene.add(sunLight, sunLight.target);

  const terrain = createTerrain(scene, { dam, location });
  const props = createProps(scene, { dam, terrain, location });
  // A camp on the bank at spots that have one (pegs.js).
  const camp = location.camp ? createCamp(scene, {
    dam, terrain, spec: { ...location.camp, x: dam.spawn.x + location.camp.x }, seed: seedFromString(location.id + (location.pegId || '')),
    location, maxPeople: { medium: 4, high: 6, ultra: 8, ultraplus: 8 }[quality] ?? 6,
  }) : null;
  const keepClear = camp ? (x, z) => props.exclude(x, z) || camp.exclude(x, z) : props.exclude;
  // Real shrubs, weeds, stumps and logs (photo-scanned) on the bank.
  createDressing(scene, { dam, terrain, location, exclude: keepClear, density: { medium: 0.5, high: 0.7, ultra: 1, ultraplus: 1.2 }[quality] ?? 0.7 });
  const grass = createGrass(scene, {
    dam, terrain, location, exclude: keepClear, bladeCount: { low: 30000, medium: 60000, high: 95000, ultra: 160000, ultraplus: 200000 }[quality] ?? 95000,
  });
  const trees = createTrees(scene, { dam, terrain, location, avoid: camp?.area, leafDensity: { low: 0.6, medium: 0.85, high: 1, ultra: 1.35, ultraplus: 1.35 }[quality] ?? 1 });
  createShoreline(scene, { dam, location });
  const wildlife = createWildlife(scene, { dam, location });
  const mist = createMist(scene, dam);
  const atmos = createAtmosphereState();

  const baseGrassTint = new THREE.Color(location.grassTint ?? 0xffffff);
  function setSeason(season) {
    grass.setSeason(season);
    trees.setSeason(season);
    terrain.grassTint.value.copy(baseGrassTint).multiply(new THREE.Color(GROUND_SEASON[season] || 0xffffff));
  }

  function update({ delta, elapsed, envState, timeOverride = null }) {
    grass.update(camera);
    const tod = timeOverride || { timeOfDay: envState.timeOfDay, progress: envState.timeOfDayProgress };
    sampleAtmosphere(atmos, tod.timeOfDay, tod.progress);
    atmos.fogNear *= fogScale;
    atmos.fogFar *= fogScale;
    updateWind(elapsed, delta, envState.windSpeed, envState.windDirX, envState.windDirZ);
    applyAtmosphere({ skyUniforms, sunLight, hemiLight, scene, mist, camera, windDir: windUniforms.uWindDir.value, windSpeed: windUniforms.uWind.value }, atmos, elapsed);
    sky.position.copy(camera.position);
    terrain.mountains.update(atmos);
    props.update(atmos, elapsed);
    wildlife.update(delta, elapsed, atmos);
    camp?.update(atmos, elapsed, delta, windUniforms.uWindDir.value, camera);
    return atmos;
  }

  return { scene, camera, sunLight, hemiLight, skyUniforms, atmos, update, setSeason, terrain, grass, camp };
}

export { createPlayerRod } from './gfx/rod.js';
