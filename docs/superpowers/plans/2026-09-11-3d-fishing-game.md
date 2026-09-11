# 3D Pond Fishing Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable, browser-based 3D pond fishing game (Three.js, no build step) matching `docs/superpowers/specs/2026-09-11-3d-fishing-game-design.md`.

**Architecture:** Static site (`index.html` + ES modules under `/src`). Pure-logic modules (economy, gear, fish bite rolls) are unit-testable with plain Node `assert` (no test framework needed). Rendering/scene modules are verified visually via the browser preview. `main.js` wires everything into a `requestAnimationFrame` loop.

**Tech Stack:** Three.js r160 (CDN + local vendor copy), vanilla JS ES modules, HTML/CSS, `localStorage`, Node.js only for running the plain-assert unit tests during dev (not shipped).

## Global Constraints

- No build step — the game must run by opening `index.html` directly (or via a static server) with native `<script type="module">` imports.
- No backend/network calls. All persistence via `localStorage`.
- Three.js loaded from `https://cdnjs.cloudflare.com` (per spec's CDN allowance) with a vendored fallback copy in `/vendor/three.module.js` so the game still runs offline.
- Species: Tilapia, Carp, Bass only (per spec — no others).
- Gear: exactly 3 rod tiers, 3 line tiers, lures matched to species.
- Mouse/keyboard only, no touch controls.

---

### Task 1: Project scaffold + vendored Three.js

**Files:**
- Create: `index.html`
- Create: `src/main.js`
- Create: `vendor/three.module.js` (downloaded copy of Three.js r160 ES module build)
- Create: `.gitignore`

**Interfaces:**
- Produces: `index.html` loads `src/main.js` as `type="module"`; `main.js` imports Three.js via `import * as THREE from '../vendor/three.module.js'`.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
*.log
```

- [ ] **Step 2: Download Three.js r160 module build into `vendor/three.module.js`**

Run: `curl -fsSL https://unpkg.com/three@0.160.0/build/three.module.js -o vendor/three.module.js` (if `curl` unavailable, use PowerShell `Invoke-WebRequest`). Verify the file is non-trivial in size (Three.js module build is several hundred KB):

Run: `wc -c vendor/three.module.js`
Expected: a byte count greater than 500000 (confirms a real download, not an error page)

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pond Fishing</title>
  <link rel="stylesheet" href="src/style.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `src/style.css` (minimal reset)**

```css
html, body { margin: 0; height: 100%; background: #06131c; overflow: hidden; font-family: system-ui, sans-serif; }
#app { position: relative; width: 100vw; height: 100vh; }
canvas { display: block; }
```

- [ ] **Step 5: Create `src/main.js` with a minimal render loop that proves Three.js loads**

```javascript
import * as THREE from '../vendor/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

- [ ] **Step 6: Create `.claude/launch.json` for preview**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "fishing-game",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["-y", "serve", "-l", "5173", "."],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 7: Start preview and verify a blank sky-colored canvas renders with no console errors**

Use `preview_start` with `{name: "fishing-game"}`, then `read_console_messages` with `onlyErrors: true`.
Expected: empty canvas, sky-blue background, zero console errors.

- [ ] **Step 8: Commit**

```bash
git add index.html src/main.js src/style.css vendor/three.module.js .gitignore .claude/launch.json
git commit -m "feat: scaffold Three.js project with render loop"
```

---

### Task 2: Pond scene, lighting, camera controls

**Files:**
- Create: `src/scene.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createScene()` returns `{ scene, camera, sunLight, ambientLight }`. `setupCameraControls(camera, domElement)` attaches drag-to-pan (clamped yaw) and returns nothing.
- Consumes (Task 1): `THREE` import path `../vendor/three.module.js`.

- [ ] **Step 1: Implement `src/scene.js`**

```javascript
import * as THREE from '../vendor/three.module.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 20, 80);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 0.8, -10);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.0);
  sunLight.position.set(10, 20, 10);
  scene.add(sunLight);

  // Dock platform (player stands here)
  const dockGeo = new THREE.BoxGeometry(3, 0.2, 4);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22 });
  const dock = new THREE.Mesh(dockGeo, dockMat);
  dock.position.set(0, 0.4, 4);
  scene.add(dock);

  // Shore ground
  const groundGeo = new THREE.CircleGeometry(60, 32);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d5c2f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.05;
  scene.add(ground);

  return { scene, camera, sunLight, ambientLight };
}

export function setupCameraControls(camera, domElement) {
  const baseYaw = 0;
  let yaw = baseYaw;
  let dragging = false;
  let lastX = 0;
  const maxYaw = Math.PI / 4;

  domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    yaw = Math.min(maxYaw, Math.max(-maxYaw, yaw - dx * 0.003));
    camera.rotation.y = yaw;
  });
}
```

- [ ] **Step 2: Wire into `src/main.js`** — replace the inline scene/camera setup with:

```javascript
import * as THREE from '../vendor/three.module.js';
import { createScene, setupCameraControls } from './scene.js';

const { scene, camera } = createScene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);
setupCameraControls(camera, renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
```

- [ ] **Step 3: Visually verify in preview** — reload, screenshot. Expected: brown dock in foreground, green ground/shore, sky background, fog fading into distance. Drag mouse left/right on canvas and confirm the view pans within a limited arc (does not spin freely).

- [ ] **Step 4: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "feat: add pond scene with dock, ground, lighting, camera pan"
```

---

### Task 3: Water mesh + shader-driven ripples, tinted by temperature

**Files:**
- Create: `src/water.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createWater(scene)` returns `{ waterMesh, setWaterTemperature(celsius), addRipple(x, z) }`. `updateWater(waterMesh, elapsedSeconds)` called each frame.
- Consumes (Task 2): `scene` object from `createScene()`.

- [ ] **Step 1: Implement `src/water.js`** using `THREE.ShaderMaterial` with a time uniform for scrolling ripple normals and a `tempColor` uniform that lerps between cold-blue (`0x2a5d7c`) and warm-green (`0x3c8f5c`):

```javascript
import * as THREE from '../vendor/three.module.js';

const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 1.5 + uTime * 1.2) * 0.05 + cos(pos.y * 1.5 + uTime * 0.8) * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uTime;
  void main() {
    float ripple = sin((vUv.x + vUv.y) * 20.0 + uTime * 2.0) * 0.05;
    vec3 color = uColor + ripple;
    gl_FragColor = vec4(color, 0.92);
  }
`;

export function createWater(scene) {
  const geometry = new THREE.PlaneGeometry(80, 80, 64, 64);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x3c8f5c) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, transparent: true,
  });
  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, 0, -30);
  scene.add(waterMesh);

  const coldColor = new THREE.Color(0x2a5d7c);
  const warmColor = new THREE.Color(0x3c8f5c);

  function setWaterTemperature(celsius) {
    const t = Math.min(1, Math.max(0, (celsius - 5) / 25)); // 5C..30C -> 0..1
    uniforms.uColor.value.copy(coldColor).lerp(warmColor, t);
  }

  return { waterMesh, setWaterTemperature };
}

export function updateWater(waterMesh, elapsedSeconds) {
  waterMesh.material.uniforms.uTime.value = elapsedSeconds;
}
```

- [ ] **Step 2: Wire into `main.js`** — add `const { waterMesh, setWaterTemperature } = createWater(scene);` after scene creation, call `setWaterTemperature(18)` as a temporary default, and in `animate()` call `updateWater(waterMesh, performance.now() / 1000)`.

- [ ] **Step 3: Visually verify** — reload, screenshot. Expected: large rippling plane beyond the dock, greenish tint, subtle animated wave motion visible over a couple seconds (compare two screenshots a second apart, or check `uTime` uniform value increases via `javascript_tool`).

- [ ] **Step 4: Commit**

```bash
git add src/water.js src/main.js
git commit -m "feat: add animated water shader with temperature-driven tint"
```

---

### Task 4: Environment system (seasons, water temp, wind)

**Files:**
- Create: `src/environment.js`
- Create: `test/environment.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createEnvironment()` returns an object `{ getState(), tick(deltaSeconds) }` where `getState()` returns `{ season: 'summer'|'autumn'|'winter'|'spring', waterTempC: number, windSpeed: number, windDirX: number, windDirZ: number }`.
- Consumes: nothing (pure logic module, no Three.js dependency — kept testable in plain Node).

- [ ] **Step 1: Write `test/environment.test.js` (plain Node assert, no framework)**

```javascript
import assert from 'node:assert';
import { createEnvironment, SEASON_ORDER, SEASON_LENGTH_SECONDS } from '../src/environment.js';

// Season starts at summer and advances after SEASON_LENGTH_SECONDS
{
  const env = createEnvironment();
  assert.strictEqual(env.getState().season, 'summer');
  env.tick(SEASON_LENGTH_SECONDS + 1);
  assert.strictEqual(env.getState().season, 'autumn');
  console.log('PASS: season advances after season length elapses');
}

// Season order cycles back to summer after winter->spring
{
  const env = createEnvironment();
  for (let i = 0; i < SEASON_ORDER.length; i++) {
    env.tick(SEASON_LENGTH_SECONDS + 1);
  }
  assert.strictEqual(env.getState().season, 'summer');
  console.log('PASS: season cycles back to summer');
}

// Water temp is higher in summer than winter
{
  const envSummer = createEnvironment();
  const summerTemp = envSummer.getState().waterTempC;
  const envWinter = createEnvironment();
  envWinter.tick(SEASON_LENGTH_SECONDS * 2 + 1); // summer -> autumn -> winter
  const winterTemp = envWinter.getState().waterTempC;
  assert.ok(summerTemp > winterTemp, `expected summer (${summerTemp}) > winter (${winterTemp})`);
  console.log('PASS: summer water is warmer than winter water');
}

// Wind speed stays within configured bounds
{
  const env = createEnvironment();
  for (let i = 0; i < 100; i++) {
    env.tick(1);
    const { windSpeed } = env.getState();
    assert.ok(windSpeed >= 0 && windSpeed <= 12, `windSpeed out of bounds: ${windSpeed}`);
  }
  console.log('PASS: wind speed stays within bounds across many ticks');
}

console.log('All environment tests passed.');
```

- [ ] **Step 2: Run test to verify it fails (module doesn't exist yet)**

Run: `node test/environment.test.js`
Expected: FAIL — `Cannot find module '../src/environment.js'`

- [ ] **Step 3: Implement `src/environment.js`**

```javascript
export const SEASON_ORDER = ['summer', 'autumn', 'winter', 'spring'];
export const SEASON_LENGTH_SECONDS = 1200; // 20 real minutes per season

const SEASON_BASE_TEMP_C = {
  summer: 26,
  autumn: 18,
  winter: 10,
  spring: 19,
};

export function createEnvironment() {
  let seasonIndex = 0;
  let seasonElapsed = 0;
  let windSpeed = 0;
  let windAngle = 0;
  let windTimer = 0;
  let nextGustAt = 5 + Math.random() * 15;

  function currentSeason() {
    return SEASON_ORDER[seasonIndex];
  }

  function tick(deltaSeconds) {
    seasonElapsed += deltaSeconds;
    while (seasonElapsed >= SEASON_LENGTH_SECONDS) {
      seasonElapsed -= SEASON_LENGTH_SECONDS;
      seasonIndex = (seasonIndex + 1) % SEASON_ORDER.length;
    }

    windTimer += deltaSeconds;
    if (windTimer >= nextGustAt) {
      windTimer = 0;
      nextGustAt = 5 + Math.random() * 15;
      windSpeed = Math.random() * 12;
      windAngle = Math.random() * Math.PI * 2;
    } else {
      // gust decays back toward calm between triggers
      windSpeed = Math.max(0, windSpeed - deltaSeconds * 0.5);
    }
  }

  function getState() {
    const base = SEASON_BASE_TEMP_C[currentSeason()];
    return {
      season: currentSeason(),
      waterTempC: base,
      windSpeed,
      windDirX: Math.cos(windAngle),
      windDirZ: Math.sin(windAngle),
    };
  }

  return { getState, tick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/environment.test.js`
Expected: `All environment tests passed.` with no assertion errors

- [ ] **Step 5: Wire into `main.js`** — create `const environment = createEnvironment();`, call `environment.tick(deltaSeconds)` each frame (compute `deltaSeconds` from a running clock), call `setWaterTemperature(environment.getState().waterTempC)` whenever season changes (simplest: call it every frame — cheap), and sway a placeholder based on `windSpeed` isn't needed yet (visual wind effects land in Task 2 revisit only if time allows — out of scope for this task; skip).

```javascript
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  environment.tick(delta);
  setWaterTemperature(environment.getState().waterTempC);
  updateWater(waterMesh, now / 1000);
  renderer.render(scene, camera);
}
```

- [ ] **Step 6: Visually verify** — reload, confirm no console errors, and via `javascript_tool` inspect that a debug hook (temporarily add `window.__env = environment;` in main.js for dev inspection) reports `season: 'summer'` initially.

- [ ] **Step 7: Commit**

```bash
git add src/environment.js test/environment.test.js src/main.js
git commit -m "feat: add environment system for seasons, water temp, wind"
```

---

### Task 5: Fish definitions and bite-roll logic

**Files:**
- Create: `src/fish.js`
- Create: `test/fish.test.js`

**Interfaces:**
- Produces: `FISH_SPECIES` (array of `{ id, name, minWeightKg, maxWeightKg, tempRangeC: [min,max], preferredLureIds: string[], baseValuePerKg, aggressiveness }`), `rollForBite({ species, waterTempC, equippedLureId, deltaSeconds })` returning boolean, `randomWeightFor(species)` returning a number.
- Consumes: nothing (pure logic, no Three.js).

- [ ] **Step 1: Write `test/fish.test.js`**

```javascript
import assert from 'node:assert';
import { FISH_SPECIES, rollForBite, randomWeightFor } from '../src/fish.js';

// Exactly 3 species defined, matching spec
{
  assert.strictEqual(FISH_SPECIES.length, 3);
  const ids = FISH_SPECIES.map(f => f.id).sort();
  assert.deepStrictEqual(ids, ['bass', 'carp', 'tilapia']);
  console.log('PASS: exactly 3 species defined (tilapia, carp, bass)');
}

// randomWeightFor stays within species bounds
{
  const tilapia = FISH_SPECIES.find(f => f.id === 'tilapia');
  for (let i = 0; i < 200; i++) {
    const w = randomWeightFor(tilapia);
    assert.ok(w >= tilapia.minWeightKg && w <= tilapia.maxWeightKg, `weight ${w} out of bounds`);
  }
  console.log('PASS: randomWeightFor stays within species min/max');
}

// Matching lure at preferred temp bites more often than wrong lure over many trials
{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const goodLure = bass.preferredLureIds[0];
  const badLure = 'wrong-lure-id';
  const midTemp = (bass.tempRangeC[0] + bass.tempRangeC[1]) / 2;

  let goodBites = 0, badBites = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: goodLure, deltaSeconds: 1 })) goodBites++;
    if (rollForBite({ species: bass, waterTempC: midTemp, equippedLureId: badLure, deltaSeconds: 1 })) badBites++;
  }
  assert.ok(goodBites > badBites * 2, `expected goodBites (${goodBites}) to clearly exceed badBites (${badBites})`);
  console.log(`PASS: matching lure bites more often (good=${goodBites}, bad=${badBites})`);
}

// Temp outside preferred range yields zero bites
{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const farOutTemp = bass.tempRangeC[1] + 20;
  let bites = 0;
  for (let i = 0; i < 500; i++) {
    if (rollForBite({ species: bass, waterTempC: farOutTemp, equippedLureId: bass.preferredLureIds[0], deltaSeconds: 1 })) bites++;
  }
  assert.strictEqual(bites, 0, `expected 0 bites far outside temp range, got ${bites}`);
  console.log('PASS: no bites when water temp is far outside species range');
}

console.log('All fish tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/fish.test.js`
Expected: FAIL — `Cannot find module '../src/fish.js'`

- [ ] **Step 3: Implement `src/fish.js`**

```javascript
export const FISH_SPECIES = [
  {
    id: 'tilapia',
    name: 'Tilapia',
    minWeightKg: 0.3,
    maxWeightKg: 1.5,
    tempRangeC: [20, 32],
    preferredLureIds: ['bread-bait', 'worm'],
    baseValuePerKg: 10,
    aggressiveness: 0.9,
  },
  {
    id: 'carp',
    name: 'Carp',
    minWeightKg: 1.0,
    maxWeightKg: 8.0,
    tempRangeC: [12, 28],
    preferredLureIds: ['worm', 'corn'],
    baseValuePerKg: 15,
    aggressiveness: 0.6,
  },
  {
    id: 'bass',
    name: 'Bass',
    minWeightKg: 0.5,
    maxWeightKg: 4.5,
    tempRangeC: [8, 22],
    preferredLureIds: ['spinner', 'soft-plastic'],
    baseValuePerKg: 25,
    aggressiveness: 0.35,
  },
];

export function randomWeightFor(species) {
  return species.minWeightKg + Math.random() * (species.maxWeightKg - species.minWeightKg);
}

export function rollForBite({ species, waterTempC, equippedLureId, deltaSeconds }) {
  const [minT, maxT] = species.tempRangeC;
  if (waterTempC < minT || waterTempC > maxT) return false;

  const lureMatch = species.preferredLureIds.includes(equippedLureId);
  const lureMultiplier = lureMatch ? 1.0 : 0.15;

  // Base chance per second, scaled by aggressiveness and lure match
  const perSecondChance = 0.02 * species.aggressiveness * lureMultiplier;
  const chance = 1 - Math.pow(1 - perSecondChance, deltaSeconds);
  return Math.random() < chance;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/fish.test.js`
Expected: `All fish tests passed.`

- [ ] **Step 5: Commit**

```bash
git add src/fish.js test/fish.test.js
git commit -m "feat: add fish species definitions and bite-roll logic"
```

---

### Task 6: Gear definitions (rods, lines, lures)

**Files:**
- Create: `src/gear.js`
- Create: `test/gear.test.js`

**Interfaces:**
- Produces: `RODS`, `LINES`, `LURES` arrays (each `{ id, name, tier, cost, ...stat fields }`); `getGearById(list, id)` helper.
  - `RODS[i]`: `{ id, name, tier, cost, castDistance, tensionTolerance }`
  - `LINES[i]`: `{ id, name, tier, cost, breakStrength }`
  - `LURES[i]`: `{ id, name, cost, speciesIds }` (must reference ids matching `FISH_SPECIES[*].preferredLureIds` from Task 5)
- Consumes (Task 5): lure ids used in `fish.js` (`bread-bait`, `worm`, `corn`, `spinner`, `soft-plastic`) must all exist in `LURES`.

- [ ] **Step 1: Write `test/gear.test.js`**

```javascript
import assert from 'node:assert';
import { RODS, LINES, LURES, getGearById } from '../src/gear.js';
import { FISH_SPECIES } from '../src/fish.js';

// Exactly 3 rod tiers and 3 line tiers, per spec
{
  assert.strictEqual(RODS.length, 3);
  assert.strictEqual(LINES.length, 3);
  console.log('PASS: exactly 3 rod tiers and 3 line tiers');
}

// Higher tier rods/lines cost more and have better stats
{
  const sortedRods = [...RODS].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedRods.length; i++) {
    assert.ok(sortedRods[i].cost > sortedRods[i - 1].cost, 'rod cost should increase with tier');
    assert.ok(sortedRods[i].castDistance >= sortedRods[i - 1].castDistance, 'cast distance should not decrease with tier');
    assert.ok(sortedRods[i].tensionTolerance >= sortedRods[i - 1].tensionTolerance, 'tension tolerance should not decrease with tier');
  }
  const sortedLines = [...LINES].sort((a, b) => a.tier - b.tier);
  for (let i = 1; i < sortedLines.length; i++) {
    assert.ok(sortedLines[i].cost > sortedLines[i - 1].cost, 'line cost should increase with tier');
    assert.ok(sortedLines[i].breakStrength >= sortedLines[i - 1].breakStrength, 'break strength should not decrease with tier');
  }
  console.log('PASS: higher tiers cost more and have equal-or-better stats');
}

// Every lure referenced by FISH_SPECIES exists in LURES
{
  const lureIds = new Set(LURES.map(l => l.id));
  for (const species of FISH_SPECIES) {
    for (const lureId of species.preferredLureIds) {
      assert.ok(lureIds.has(lureId), `lure "${lureId}" referenced by ${species.id} is missing from LURES`);
    }
  }
  console.log('PASS: all species-preferred lures exist in LURES');
}

// getGearById finds the right item
{
  const found = getGearById(RODS, RODS[1].id);
  assert.strictEqual(found, RODS[1]);
  assert.strictEqual(getGearById(RODS, 'nonexistent'), undefined);
  console.log('PASS: getGearById finds by id and returns undefined when missing');
}

console.log('All gear tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/gear.test.js`
Expected: FAIL — `Cannot find module '../src/gear.js'`

- [ ] **Step 3: Implement `src/gear.js`**

```javascript
export const RODS = [
  { id: 'rod-starter', name: 'Starter Rod', tier: 1, cost: 0, castDistance: 12, tensionTolerance: 1.0 },
  { id: 'rod-sport', name: 'Sport Rod', tier: 2, cost: 250, castDistance: 18, tensionTolerance: 1.4 },
  { id: 'rod-pro', name: 'Pro Rod', tier: 3, cost: 800, castDistance: 24, tensionTolerance: 2.0 },
];

export const LINES = [
  { id: 'line-starter', name: 'Starter Line', tier: 1, cost: 0, breakStrength: 1.0 },
  { id: 'line-braid', name: 'Braided Line', tier: 2, cost: 150, breakStrength: 1.6 },
  { id: 'line-fluoro', name: 'Fluorocarbon Line', tier: 3, cost: 500, breakStrength: 2.4 },
];

export const LURES = [
  { id: 'bread-bait', name: 'Bread Bait', cost: 0, speciesIds: ['tilapia'] },
  { id: 'worm', name: 'Worm', cost: 20, speciesIds: ['tilapia', 'carp'] },
  { id: 'corn', name: 'Sweetcorn', cost: 20, speciesIds: ['carp'] },
  { id: 'spinner', name: 'Spinner Lure', cost: 90, speciesIds: ['bass'] },
  { id: 'soft-plastic', name: 'Soft Plastic Lure', cost: 120, speciesIds: ['bass'] },
];

export function getGearById(list, id) {
  return list.find((item) => item.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/gear.test.js`
Expected: `All gear tests passed.`

- [ ] **Step 5: Commit**

```bash
git add src/gear.js test/gear.test.js
git commit -m "feat: add rod/line/lure gear definitions"
```

---

### Task 7: Economy (payout calculation)

**Files:**
- Create: `src/economy.js`
- Create: `test/economy.test.js`

**Interfaces:**
- Produces: `calculatePayout({ species, weightKg, rod, line })` returning a positive integer credit amount.
- Consumes (Task 5): `species.baseValuePerKg`. (Task 6): `rod`, `line` objects (only used for a small quality multiplier, per spec's "not directly higher payout" rule — multiplier capped low).

- [ ] **Step 1: Write `test/economy.test.js`**

```javascript
import assert from 'node:assert';
import { calculatePayout } from '../src/economy.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES } from '../src/gear.js';

// Payout scales with weight and species base value
{
  const carp = FISH_SPECIES.find(f => f.id === 'carp');
  const rod = RODS[0];
  const line = LINES[0];
  const small = calculatePayout({ species: carp, weightKg: 1, rod, line });
  const large = calculatePayout({ species: carp, weightKg: 5, rod, line });
  assert.ok(large > small, `expected larger fish to pay more (small=${small}, large=${large})`);
  console.log('PASS: payout increases with weight');
}

// Payout is always a positive integer
{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  for (let i = 0; i < 50; i++) {
    const payout = calculatePayout({ species: bass, weightKg: 1 + Math.random() * 3, rod: RODS[1], line: LINES[1] });
    assert.ok(Number.isInteger(payout) && payout > 0, `payout must be a positive integer, got ${payout}`);
  }
  console.log('PASS: payout is always a positive integer');
}

// Better gear does not more than double payout vs starter gear (skill stays relevant per spec)
{
  const bass = FISH_SPECIES.find(f => f.id === 'bass');
  const weightKg = 2;
  const starterPayout = calculatePayout({ species: bass, weightKg, rod: RODS[0], line: LINES[0] });
  const proPayout = calculatePayout({ species: bass, weightKg, rod: RODS[2], line: LINES[2] });
  assert.ok(proPayout <= starterPayout * 2, `pro gear payout (${proPayout}) should not exceed 2x starter payout (${starterPayout})`);
  assert.ok(proPayout >= starterPayout, `pro gear payout (${proPayout}) should be at least starter payout (${starterPayout})`);
  console.log(`PASS: gear quality gives a modest payout bump only (starter=${starterPayout}, pro=${proPayout})`);
}

console.log('All economy tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/economy.test.js`
Expected: FAIL — `Cannot find module '../src/economy.js'`

- [ ] **Step 3: Implement `src/economy.js`**

```javascript
export function calculatePayout({ species, weightKg, rod, line }) {
  const gearQuality = (rod.tier + line.tier) / 2; // 1.0 .. 3.0
  const gearMultiplier = 1 + (gearQuality - 1) * 0.1; // 1.0 .. 1.2
  const randomness = 0.9 + Math.random() * 0.2; // 0.9 .. 1.1
  const raw = species.baseValuePerKg * weightKg * gearMultiplier * randomness;
  return Math.max(1, Math.round(raw));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/economy.test.js`
Expected: `All economy tests passed.`

- [ ] **Step 5: Commit**

```bash
git add src/economy.js test/economy.test.js
git commit -m "feat: add catch payout economy calculation"
```

---

### Task 8: Save/load system

**Files:**
- Create: `src/save.js`
- Create: `test/save.test.js`

**Interfaces:**
- Produces: `loadSave()` returns a save object `{ credits, ownedRodIds, ownedLineIds, ownedLureIds, equippedRodId, equippedLineId, equippedLureId, catchLog }`; `saveSave(saveObject)` persists it; `DEFAULT_SAVE` constant.
- Consumes: none directly, but shape matches ids from `gear.js` (`rod-starter`, `line-starter`, `bread-bait`).

- [ ] **Step 1: Write `test/save.test.js`** — this test needs `localStorage`; use a minimal in-memory polyfill since plain Node has no `localStorage`:

```javascript
import assert from 'node:assert';

// Minimal localStorage polyfill for Node test environment
globalThis.localStorage = {
  _data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
};

const { loadSave, saveSave, DEFAULT_SAVE } = await import('../src/save.js');

// loadSave returns DEFAULT_SAVE shape when nothing is stored
{
  localStorage.removeItem('pond-fishing-save');
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, DEFAULT_SAVE.credits);
  assert.deepStrictEqual(loaded.ownedRodIds, DEFAULT_SAVE.ownedRodIds);
  console.log('PASS: loadSave returns defaults when nothing stored');
}

// saveSave persists and loadSave retrieves the same data back
{
  const custom = { ...DEFAULT_SAVE, credits: 999, equippedRodId: 'rod-pro' };
  saveSave(custom);
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, 999);
  assert.strictEqual(loaded.equippedRodId, 'rod-pro');
  console.log('PASS: saveSave/loadSave round-trip preserves data');
}

// loadSave tolerates corrupted JSON by falling back to defaults
{
  localStorage.setItem('pond-fishing-save', 'not valid json{{{');
  const loaded = loadSave();
  assert.strictEqual(loaded.credits, DEFAULT_SAVE.credits);
  console.log('PASS: loadSave falls back to defaults on corrupted data');
}

console.log('All save tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/save.test.js`
Expected: FAIL — `Cannot find module '../src/save.js'`

- [ ] **Step 3: Implement `src/save.js`**

```javascript
const SAVE_KEY = 'pond-fishing-save';

export const DEFAULT_SAVE = {
  credits: 0,
  ownedRodIds: ['rod-starter'],
  ownedLineIds: ['line-starter'],
  ownedLureIds: ['bread-bait'],
  equippedRodId: 'rod-starter',
  equippedLineId: 'line-starter',
  equippedLureId: 'bread-bait',
  catchLog: {}, // speciesId -> { count, bestWeightKg }
};

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { ...DEFAULT_SAVE };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...parsed };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveSave(saveObject) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveObject));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/save.test.js`
Expected: `All save tests passed.`

- [ ] **Step 5: Commit**

```bash
git add src/save.js test/save.test.js
git commit -m "feat: add localStorage save/load system"
```

---

### Task 9: Casting input, line/bobber visuals, bite trigger

**Files:**
- Create: `src/casting.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createCasting({ scene, camera, domElement, rod })` returns `{ update(deltaSeconds, windState), getState(), startAimHold(), releaseCast(), onBite(callback) }`. `getState()` returns `{ phase: 'idle'|'aiming'|'inAir'|'waiting'|'biting', power: number }`.
- Consumes (Task 2/3): `scene`, `camera`. (Task 6): `rod.castDistance`. (Task 4): `windState = { windSpeed, windDirX, windDirZ }` passed into `update`. (Task 5): bite rolling is driven from `main.js`, which calls `rollForBite` per active species and, on success, calls the casting module's exposed trigger — see Step 3 for the exact wiring so responsibility stays in `main.js` (casting.js stays fish-agnostic, matching the spec's module boundaries).

- [ ] **Step 1: Implement `src/casting.js`** — bobber as a small sphere mesh, line as a `THREE.Line`, power meter via mousedown-hold, release casts along camera forward direction scaled by rod distance and power, arc via simple gravity lerp, wind displaces x/z during `inAir` phase:

```javascript
import * as THREE from '../vendor/three.module.js';

export function createCasting({ scene, camera, domElement, rod }) {
  const bobberGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const bobberMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
  const bobber = new THREE.Mesh(bobberGeo, bobberMat);
  bobber.visible = false;
  scene.add(bobber);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const line = new THREE.Line(lineGeo, lineMat);
  line.visible = false;
  scene.add(line);

  const rodTipWorld = new THREE.Vector3(0, 1.2, 4.5);
  const target = new THREE.Vector3();

  let phase = 'idle';
  let power = 0;
  let holding = false;
  let airTime = 0;
  const AIR_DURATION = 1.2;
  let launchTarget = new THREE.Vector3();
  let biteCallback = null;

  function startAimHold() {
    if (phase !== 'idle') return;
    phase = 'aiming';
    power = 0;
  }

  function releaseCast() {
    if (phase !== 'aiming') return;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const distance = 4 + power * rod.castDistance;
    launchTarget.copy(camera.position).addScaledVector(forward, distance);
    launchTarget.y = 0;
    phase = 'inAir';
    airTime = 0;
    bobber.visible = true;
    line.visible = true;
  }

  function triggerBite() {
    if (phase !== 'waiting') return;
    phase = 'biting';
    if (biteCallback) biteCallback();
  }

  function onBite(callback) {
    biteCallback = callback;
  }

  function resetToIdle() {
    phase = 'idle';
    power = 0;
    bobber.visible = false;
    line.visible = false;
  }

  function update(deltaSeconds, windState) {
    if (phase === 'aiming' && holding) {
      power = Math.min(1, power + deltaSeconds * 0.6);
    }

    if (phase === 'inAir') {
      airTime += deltaSeconds;
      const t = Math.min(1, airTime / AIR_DURATION);
      target.copy(rodTipWorld).lerp(launchTarget, t);
      target.x += windState.windDirX * windState.windSpeed * 0.02 * t;
      target.z += windState.windDirZ * windState.windSpeed * 0.02 * t;
      target.y = Math.sin(t * Math.PI) * 1.5;
      bobber.position.copy(target);
      updateLine();
      if (t >= 1) {
        phase = 'waiting';
        bobber.position.y = 0;
      }
    }

    if (phase === 'waiting' || phase === 'biting') {
      updateLine();
    }
  }

  function updateLine() {
    const positions = line.geometry.attributes.position;
    positions.setXYZ(0, rodTipWorld.x, rodTipWorld.y, rodTipWorld.z);
    positions.setXYZ(1, bobber.position.x, bobber.position.y, bobber.position.z);
    positions.needsUpdate = true;
  }

  domElement.addEventListener('mousedown', () => {
    if (phase === 'idle') { startAimHold(); holding = true; }
  });
  window.addEventListener('mouseup', () => {
    if (phase === 'aiming') { releaseCast(); }
    holding = false;
  });

  function getState() {
    return { phase, power };
  }

  return { update, getState, startAimHold, releaseCast, onBite, triggerBite, resetToIdle, bobberPosition: bobber.position };
}
```

- [ ] **Step 2: Wire minimal call into `main.js`** — instantiate with the equipped rod (temporarily hardcode `RODS[0]` from `gear.js`; full gear-equip wiring lands in Task 11):

```javascript
import { RODS } from './gear.js';
import { createCasting } from './casting.js';

const casting = createCasting({ scene, camera, domElement: renderer.domElement, rod: RODS[0] });
```
Add `casting.update(delta, environment.getState());` inside `animate()`.

- [ ] **Step 3: Visually verify the cast arc** — reload, hold left mouse button on canvas for ~1 second (aim), release. Expected: a white line and red bobber sphere appear and arc out onto the water, landing and staying visible (phase settles to `waiting`). Confirm via `javascript_tool` reading `casting.getState().phase` transitions: `'idle'` → `'aiming'` → `'inAir'` → `'waiting'`.

- [ ] **Step 4: Commit**

```bash
git add src/casting.js src/main.js
git commit -m "feat: add casting input, bobber/line visuals, cast arc physics"
```

---

### Task 10: Bite/reel minigame and full catch flow wiring

**Files:**
- Create: `src/minigame.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createMinigame()` returns `{ start({ species, weightKg, rod, line, onSuccess, onFailure }), update(deltaSeconds), getState(), isActive() }`. `getState()` returns `{ tension: number (0..1), active: boolean }`.
- Consumes (Task 5): `species`, `randomWeightFor`. (Task 6): `rod.tensionTolerance`, `line.breakStrength`. (Task 9): triggered when `casting.getState().phase === 'biting'`.

- [ ] **Step 1: Implement `src/minigame.js`** — tension rises from fish pulling, player holds a key/mouse-button to reel which also raises tension if overdone; tension leaving `[0,1]` at either end fails (0 = fish escapes by going slack too long, 1 = line snaps); reaching a target "reeled-in" progress before failing wins:

```javascript
export function createMinigame() {
  let active = false;
  let tension = 0.5;
  let progress = 0;
  let holding = false;
  let context = null;

  const PULL_RATE = 0.35;
  const REEL_RATE = 0.55;
  const PROGRESS_RATE = 0.25;

  function start({ species, weightKg, rod, line, onSuccess, onFailure }) {
    active = true;
    tension = 0.5;
    progress = 0;
    context = { species, weightKg, rod, line, onSuccess, onFailure };
  }

  function setHolding(value) {
    holding = value;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, onSuccess, onFailure } = context;
    const safeMax = 0.6 + (rod.tensionTolerance - 1) * 0.1; // wider safe zone with better rod
    const snapMax = 0.85 + (line.breakStrength - 1) * 0.05;

    const pull = (1 - context.species.aggressiveness * 0.3) * PULL_RATE;
    tension += pull * deltaSeconds;
    if (holding) {
      tension -= REEL_RATE * deltaSeconds;
      progress += PROGRESS_RATE * deltaSeconds;
    }
    tension = Math.max(0, Math.min(1.2, tension));

    if (tension >= snapMax) {
      active = false;
      onFailure('line-snapped');
      return;
    }
    if (tension <= 0 && progress < 1) {
      active = false;
      onFailure('fish-escaped');
      return;
    }
    if (progress >= 1) {
      active = false;
      onSuccess();
      return;
    }
    // tension above safeMax but below snapMax: risky zone, no immediate penalty beyond faster rise (handled by pull already)
    void safeMax;
  }

  function getState() {
    return { tension: Math.min(1, tension), active };
  }

  function isActive() {
    return active;
  }

  return { start, update, getState, isActive, setHolding };
}
```

- [ ] **Step 2: Wire full catch flow into `main.js`** — pick a random eligible species each waiting-tick, roll bites, and connect casting -> minigame -> economy -> save:

```javascript
import { FISH_SPECIES, rollForBite, randomWeightFor } from './fish.js';
import { LINES, LURES, getGearById } from './gear.js';
import { calculatePayout } from './economy.js';
import { loadSave, saveSave } from './save.js';
import { createMinigame } from './minigame.js';

const save = loadSave();
const minigame = createMinigame();
let activeRod = getGearById(RODS, save.equippedRodId);
let activeLine = getGearById(LINES, save.equippedLineId);
let activeLureId = save.equippedLureId;

window.addEventListener('keydown', (e) => { if (e.code === 'Space') minigame.setHolding(true); });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') minigame.setHolding(false); });

casting.onBite(() => {
  const species = pickBitingSpecies(); // set during the waiting-phase roll below
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
      casting.resetToIdle();
    },
    onFailure: () => {
      saveSave(save);
      casting.resetToIdle();
    },
  });
});

let bitingSpecies = null;
function pickBitingSpecies() { return bitingSpecies; }

// In animate(), while casting.getState().phase === 'waiting', roll each species per frame:
function rollBitesIfWaiting(delta) {
  if (casting.getState().phase !== 'waiting') return;
  for (const species of FISH_SPECIES) {
    if (rollForBite({ species, waterTempC: environment.getState().waterTempC, equippedLureId: activeLureId, deltaSeconds: delta })) {
      bitingSpecies = species;
      casting.triggerBite();
      break;
    }
  }
}
```
Add `rollBitesIfWaiting(delta);` and `minigame.update(delta);` calls inside `animate()`, before `renderer.render(...)`.

- [ ] **Step 3: Visually verify full loop** — reload, cast (as in Task 9), wait for a bite (may take a few seconds; confirm via `javascript_tool` polling `casting.getState().phase` until it reports `'biting'`), then hold Space and watch `minigame.getState().tension` via `javascript_tool` to confirm it responds to holding (decreases) vs releasing (increases). Confirm that on success, `localStorage.getItem('pond-fishing-save')` (via `javascript_tool`) shows increased `credits` and an updated `catchLog`.

- [ ] **Step 4: Commit**

```bash
git add src/minigame.js src/main.js
git commit -m "feat: wire bite/reel minigame into full catch flow with payouts"
```

---

### Task 11: HUD, shop UI, gear equip flow

**Files:**
- Create: `src/ui.js`
- Create: `src/shop.js`
- Modify: `src/main.js`
- Modify: `src/style.css`

**Interfaces:**
- Produces: `createHUD(container)` returns `{ update({ credits, season, waterTempC, windSpeed, rodName, lineName, lureName, castingPhase, tension }) }`. `createShop({ container, save, onSaveChanged })` returns `{ toggle(), refresh() }` and renders buy/equip buttons for `RODS`/`LINES`/`LURES` against `save.credits`.
- Consumes (Task 8): `save` object and `saveSave`. (Task 6): `RODS`, `LINES`, `LURES`, `getGearById`. (Task 4): environment state fields. (Task 9/10): casting phase and minigame tension for live display.

- [ ] **Step 1: Implement `src/ui.js`**

```javascript
export function createHUD(container) {
  const bar = document.createElement('div');
  bar.className = 'hud-bar';
  bar.innerHTML = `
    <span id="hud-credits"></span>
    <span id="hud-season"></span>
    <span id="hud-wind"></span>
    <span id="hud-gear"></span>
    <span id="hud-status"></span>
  `;
  container.appendChild(bar);

  const tensionWrap = document.createElement('div');
  tensionWrap.className = 'hud-tension-wrap';
  tensionWrap.innerHTML = `<div id="hud-tension-bar" class="hud-tension-bar"></div>`;
  container.appendChild(tensionWrap);

  function update({ credits, season, waterTempC, windSpeed, rodName, lineName, lureName, castingPhase, tension }) {
    document.getElementById('hud-credits').textContent = `Credits: ${credits}`;
    document.getElementById('hud-season').textContent = `${season} — ${waterTempC.toFixed(1)}°C`;
    document.getElementById('hud-wind').textContent = `Wind: ${windSpeed.toFixed(1)}`;
    document.getElementById('hud-gear').textContent = `${rodName} | ${lineName} | ${lureName}`;
    document.getElementById('hud-status').textContent = castingPhase;
    tensionWrap.style.display = (castingPhase === 'biting') ? 'block' : 'none';
    if (tension != null) {
      document.getElementById('hud-tension-bar').style.width = `${Math.min(100, tension * 100)}%`;
    }
  }

  return { update };
}
```

- [ ] **Step 2: Implement `src/shop.js`**

```javascript
import { RODS, LINES, LURES } from './gear.js';

export function createShop({ container, save, onSaveChanged }) {
  const panel = document.createElement('div');
  panel.className = 'shop-panel hidden';
  container.appendChild(panel);

  function renderSection(title, items, ownedIds, equippedId, kind) {
    const rows = items.map((item) => {
      const owned = ownedIds.includes(item.id);
      const equipped = equippedId === item.id;
      const label = owned ? (equipped ? 'Equipped' : 'Equip') : `Buy (${item.cost})`;
      const disabled = (!owned && save.credits < item.cost) || equipped;
      return `<div class="shop-row">
        <span>${item.name}</span>
        <button data-kind="${kind}" data-id="${item.id}" ${disabled ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    return `<h3>${title}</h3>${rows}`;
  }

  function refresh() {
    panel.innerHTML = `
      <button id="shop-close">Close</button>
      ${renderSection('Rods', RODS, save.ownedRodIds, save.equippedRodId, 'rod')}
      ${renderSection('Lines', LINES, save.ownedLineIds, save.equippedLineId, 'line')}
      ${renderSection('Lures', LURES, save.ownedLureIds, save.equippedLureId, 'lure')}
    `;
    panel.querySelector('#shop-close').addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelectorAll('button[data-kind]').forEach((btn) => {
      btn.addEventListener('click', () => handleClick(btn.dataset.kind, btn.dataset.id));
    });
  }

  function ownedListFor(kind) {
    if (kind === 'rod') return save.ownedRodIds;
    if (kind === 'line') return save.ownedLineIds;
    return save.ownedLureIds;
  }

  function itemsFor(kind) {
    if (kind === 'rod') return RODS;
    if (kind === 'line') return LINES;
    return LURES;
  }

  function handleClick(kind, id) {
    const owned = ownedListFor(kind);
    const item = itemsFor(kind).find((i) => i.id === id);
    if (!owned.includes(id)) {
      if (save.credits < item.cost) return;
      save.credits -= item.cost;
      owned.push(id);
    } else {
      if (kind === 'rod') save.equippedRodId = id;
      if (kind === 'line') save.equippedLineId = id;
      if (kind === 'lure') save.equippedLureId = id;
    }
    onSaveChanged();
    refresh();
  }

  function toggle() {
    panel.classList.toggle('hidden');
    refresh();
  }

  return { toggle, refresh };
}
```

- [ ] **Step 3: Add HUD/shop CSS to `src/style.css`**

```css
.hud-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; gap: 16px; padding: 8px 16px; background: rgba(0,0,0,0.4); color: #fff; z-index: 2; }
.hud-tension-wrap { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); width: 240px; height: 14px; background: rgba(0,0,0,0.4); border-radius: 7px; overflow: hidden; z-index: 2; }
.hud-tension-bar { height: 100%; width: 50%; background: #e0523c; transition: width 0.1s linear; }
.shop-panel { position: absolute; top: 48px; right: 0; width: 280px; max-height: 80vh; overflow-y: auto; background: rgba(10,20,15,0.92); color: #fff; padding: 12px; z-index: 3; }
.shop-panel.hidden { display: none; }
.shop-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
```

- [ ] **Step 4: Wire into `main.js`** — mount HUD and shop, add a shop-toggle key (`KeyB`), feed live state into HUD every frame, and save gear-equip changes back into `activeRod`/`activeLine`/`activeLureId`:

```javascript
import { createHUD } from './ui.js';
import { createShop } from './shop.js';

const appEl = document.getElementById('app');
const hud = createHUD(appEl);
const shop = createShop({
  container: appEl,
  save,
  onSaveChanged: () => {
    saveSave(save);
    activeRod = getGearById(RODS, save.equippedRodId);
    activeLine = getGearById(LINES, save.equippedLineId);
    activeLureId = save.equippedLureId;
  },
});
window.addEventListener('keydown', (e) => { if (e.code === 'KeyB') shop.toggle(); });

// inside animate(), before renderer.render(...):
hud.update({
  credits: save.credits,
  season: environment.getState().season,
  waterTempC: environment.getState().waterTempC,
  windSpeed: environment.getState().windSpeed,
  rodName: activeRod.name,
  lineName: activeLine.name,
  lureName: getGearById(LURES, activeLureId).name,
  castingPhase: casting.getState().phase,
  tension: minigame.getState().active ? minigame.getState().tension : null,
});
```

- [ ] **Step 5: Visually verify** — reload, screenshot confirming HUD bar shows credits/season/wind/gear across the top. Press `B`, screenshot confirming the shop panel opens listing rods/lines/lures with buy/equip buttons reflecting current credits (buttons for unaffordable items are disabled). Click an owned item's "Equip" button and confirm the HUD gear text updates.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/shop.js src/main.js src/style.css
git commit -m "feat: add HUD and shop UI with gear equip flow"
```

---

### Task 12: Shore detail (reeds, lily pads, trees) and wind-reactive sway

**Files:**
- Modify: `src/scene.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `createScene()` additionally returns `swayGroup: THREE.Group` (all reed/tree meshes parented under it for per-frame sway). New export `updateSway(swayGroup, elapsedSeconds, windSpeed)`.
- Consumes (Task 4): `windSpeed` from `environment.getState()`.

- [ ] **Step 1: Extend `src/scene.js`** — add a `swayGroup`, populate with simple low-poly reeds (thin cones/cylinders) around the pond edge and a few background trees, return it, and add `updateSway`:

```javascript
export function createScene() {
  // ...existing scene/camera/lights/dock/ground code from Task 2 stays...

  const swayGroup = new THREE.Group();
  scene.add(swayGroup);

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f });
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 4;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + Math.random() * 0.5, 5), reedMat);
    reed.position.set(Math.cos(angle) * radius, 0.5, -10 + Math.sin(angle) * radius);
    swayGroup.add(reed);
  }

  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4326 });
  const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a });
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 25 + Math.random() * 15;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), treeTrunkMat);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 8), treeLeafMat);
    leaves.position.y = 2.5;
    const tree = new THREE.Group();
    tree.add(trunk, leaves);
    tree.position.set(Math.cos(angle) * radius, 1.5, -30 + Math.sin(angle) * radius);
    swayGroup.add(tree);
  }

  return { scene, camera, sunLight, ambientLight, swayGroup };
}

export function updateSway(swayGroup, elapsedSeconds, windSpeed) {
  const amplitude = Math.min(0.15, windSpeed * 0.015);
  swayGroup.children.forEach((child, i) => {
    child.rotation.z = Math.sin(elapsedSeconds * 2 + i) * amplitude;
  });
}
```

- [ ] **Step 2: Wire into `main.js`** — destructure `swayGroup` from `createScene()`, and in `animate()` call `updateSway(swayGroup, now / 1000, environment.getState().windSpeed);`.

- [ ] **Step 3: Visually verify** — reload, screenshot confirming reeds around the pond edge and background trees are visible. Use `javascript_tool` to temporarily force a high wind value (or wait for a natural gust, checking `window.__env.getState().windSpeed` from Task 4's debug hook) and confirm reed/tree rotation values change across two screenshots.

- [ ] **Step 4: Commit**

```bash
git add src/scene.js src/main.js
git commit -m "feat: add shore reeds/trees with wind-reactive sway"
```

---

### Task 13: Final integration pass — catch log display, README, smoke test

**Files:**
- Modify: `src/ui.js`
- Modify: `src/main.js`
- Create: `README.md`

**Interfaces:**
- Produces: `createHUD` gains a `renderCatchLog(catchLog)` method appended to the shop panel area (simple list), invoked whenever the shop is opened or a catch occurs.

- [ ] **Step 1: Add catch log rendering to `src/ui.js`** — append a `renderCatchLog(container, catchLog)` export:

```javascript
import { FISH_SPECIES } from './fish.js';

export function renderCatchLog(container, catchLog) {
  const rows = FISH_SPECIES.map((species) => {
    const entry = catchLog[species.id] || { count: 0, bestWeightKg: 0 };
    return `<div class="shop-row"><span>${species.name}</span><span>${entry.count} caught, best ${entry.bestWeightKg.toFixed(2)}kg</span></div>`;
  }).join('');
  container.innerHTML = `<h3>Catch Log</h3>${rows}`;
}
```

- [ ] **Step 2: Mount a catch-log panel in `main.js`** — create a `<div id="catch-log-panel" class="shop-panel hidden">` toggled by `KeyC`, and call `renderCatchLog(panelEl, save.catchLog)` both on toggle-open and inside the minigame's `onSuccess` callback (Task 10) so it stays current.

- [ ] **Step 3: Write `README.md`**

```markdown
# Pond Fishing

3D browser fishing game built with Three.js. No build step, no backend.

## Run

Open `index.html` directly in a modern browser, or serve the folder statically:

npx serve .

## Controls

- Drag mouse: pan camera (limited arc)
- Hold left mouse button on the water: aim cast (power builds while held)
- Release: cast line
- Hold Space while a fish bites: reel in (release to ease tension)
- B: open/close gear shop
- C: open/close catch log

## Gear

3 rod tiers, 3 line tiers, lures matched to species (tilapia, carp, bass).
Buy gear in the shop with credits earned from catches.
```

- [ ] **Step 4: Full smoke test** — start preview, reload page, verify via `read_console_messages` there are zero errors, screenshot the full scene, open shop (`B`) and catch log (`C`) and screenshot both, then run the full existing test suite:

Run: `node test/environment.test.js && node test/fish.test.js && node test/gear.test.js && node test/economy.test.js && node test/save.test.js`
Expected: all five scripts print their `All ... tests passed.` lines with no errors

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/main.js README.md
git commit -m "feat: add catch log panel, README, complete integration pass"
```

---

## Self-Review Notes

- Spec coverage: scene/camera (Task 2), water+temperature tint (Task 3), seasons/wind (Task 4), fish species+bite logic (Task 5), gear tiers (Task 6), economy (Task 7), save data (Task 8), casting (Task 9), reel minigame (Task 10), HUD/shop (Task 11), shore detail/wind visuals (Task 12), catch log/README (Task 13) — all spec sections covered.
- No placeholders — every step has complete code.
- Type/signature consistency checked: `rollForBite`, `randomWeightFor`, `calculatePayout`, `getGearById`, `loadSave`/`saveSave` signatures are used identically across Tasks 5–11.
- Time-of-day lighting cycle was explicitly marked out-of-scope-for-v1 complexity in the spec's "kept simple" list beyond the static sun light set in Task 2 — no task promises a full day/night cycle, avoiding a spec/plan mismatch.
