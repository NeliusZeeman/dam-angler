import * as THREE from '../../vendor/three.module.js';
import { NOISE_GLSL } from './noise.js';
import { TIME_OF_DAY_PHASES } from '../environment.js';

// One look per phase, taken as the look at the *middle* of that phase; the
// frame-by-frame state blends between neighbours, so the sun really moves
// and dusk really falls instead of the sky snapping every 45 minutes.
//
// Sun path is southern-hemisphere: it rises in the east (+x), arcs through
// the NORTH (+z, straight ahead from the jetty) and sets in the north-west.
const KEYS = {
  morning: {
    elev: 8, az: 52, sun: 0xffbe86, sunI: 2.4, top: 0x5b87c8, horizon: 0xffc49a, fog: 0xe6c3a6,
    hemiSky: 0xaec6ea, hemiGround: 0x5b5237, hemiI: 0.7, cloud: 0.42, cloudLit: 0xffd9b8, cloudShade: 0x8a86a6,
    stars: 0, exposure: 1.0, grade: 0xfff0e0, bloom: 0.6, mist: 0.8, fogNear: 25, fogFar: 170, day: 0.85,
  },
  midMorning: {
    elev: 34, az: 66, sun: 0xfff0dc, sunI: 3.0, top: 0x3a79cc, horizon: 0xcde2f4, fog: 0xc6dbec,
    hemiSky: 0xbcd6f5, hemiGround: 0x4f5534, hemiI: 0.8, cloud: 0.38, cloudLit: 0xffffff, cloudShade: 0x99a4bb,
    stars: 0, exposure: 0.9, grade: 0xffffff, bloom: 0.35, mist: 0.2, fogNear: 40, fogFar: 230, day: 1,
  },
  midday: {
    elev: 66, az: 90, sun: 0xfff6ea, sunI: 3.3, top: 0x2c6cc6, horizon: 0xbfdaf2, fog: 0xbad2e8,
    hemiSky: 0xc2dbf8, hemiGround: 0x4f5534, hemiI: 0.85, cloud: 0.34, cloudLit: 0xffffff, cloudShade: 0xa6b1c4,
    stars: 0, exposure: 0.85, grade: 0xf6fbff, bloom: 0.3, mist: 0, fogNear: 45, fogFar: 240, day: 1,
  },
  afternoon: {
    elev: 32, az: 112, sun: 0xffe2b4, sunI: 3.0, top: 0x3673c2, horizon: 0xecdcc4, fog: 0xd8d0c0,
    hemiSky: 0xbcd0ec, hemiGround: 0x55522f, hemiI: 0.8, cloud: 0.55, cloudLit: 0xfff4e4, cloudShade: 0x8d93a8,
    stars: 0, exposure: 0.88, grade: 0xfff4e6, bloom: 0.4, mist: 0, fogNear: 40, fogFar: 220, day: 1,
  },
  sunset: {
    elev: 2.5, az: 128, sun: 0xff8a45, sunI: 2.3, top: 0x2a2552, horizon: 0xff9a52, fog: 0xc88a68,
    hemiSky: 0x8e76a4, hemiGround: 0x3e3026, hemiI: 0.65, cloud: 0.5, cloudLit: 0xffa866, cloudShade: 0x5c3d5c,
    stars: 0.05, exposure: 1.05, grade: 0xffe6cc, bloom: 0.85, mist: 0.25, fogNear: 30, fogFar: 190, day: 0.6,
  },
  lateTwilight: {
    elev: -5, az: 136, sun: 0xff7a60, sunI: 0.6, top: 0x131a3c, horizon: 0xcf6f5a, fog: 0x5a4a62,
    hemiSky: 0x4c4e80, hemiGround: 0x1e1a20, hemiI: 0.6, cloud: 0.45, cloudLit: 0xff8e70, cloudShade: 0x2a2442,
    stars: 0.4, exposure: 1.4, grade: 0xf2e6f4, bloom: 0.95, mist: 0.45, fogNear: 25, fogFar: 170, day: 0.25,
  },
  night: {
    elev: -32, az: 200, sun: 0x9bb0ff, sunI: 0.55, top: 0x03050d, horizon: 0x131a33, fog: 0x0f1428,
    hemiSky: 0x2c3866, hemiGround: 0x0a0c14, hemiI: 0.5, cloud: 0.3, cloudLit: 0x5d6d9e, cloudShade: 0x0f131f,
    stars: 1, exposure: 2.0, grade: 0xdde8ff, bloom: 1.0, mist: 0.35, fogNear: 20, fogFar: 150, day: 0.12,
  },
};

const COLOR_FIELDS = ['sun', 'top', 'horizon', 'fog', 'hemiSky', 'hemiGround', 'cloudLit', 'cloudShade', 'grade'];
const NUMBER_FIELDS = ['sunI', 'hemiI', 'cloud', 'stars', 'exposure', 'bloom', 'mist', 'fogNear', 'fogFar', 'day'];

const LINEAR_KEYS = {};
for (const [name, key] of Object.entries(KEYS)) {
  const k = { ...key };
  for (const f of COLOR_FIELDS) k[f] = new THREE.Color(key[f]);
  LINEAR_KEYS[name] = k;
}

const DEG = Math.PI / 180;
const MOON_DIR = dirFromElevAz(38, 96);

function dirFromElevAz(elevDeg, azDeg, out = new THREE.Vector3()) {
  const e = elevDeg * DEG, a = azDeg * DEG;
  return out.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
}

export function createAtmosphereState() {
  const state = {
    sunDir: new THREE.Vector3(), moonDir: MOON_DIR.clone(), lightDir: new THREE.Vector3(),
    sunElev: 0, sunVis: 1, nightness: 0,
  };
  for (const f of COLOR_FIELDS) state[f] = new THREE.Color();
  for (const f of NUMBER_FIELDS) state[f] = 0;
  return state;
}

export function sampleAtmosphere(state, timeOfDay, progress) {
  const n = TIME_OF_DAY_PHASES.length;
  const idx = Math.max(0, TIME_OF_DAY_PHASES.indexOf(timeOfDay));
  let t = idx + (progress ?? 0.5) - 0.5;
  t = ((t % n) + n) % n;
  const i0 = Math.floor(t);
  const f = t - i0;
  const s = f * f * (3 - 2 * f);
  const A = LINEAR_KEYS[TIME_OF_DAY_PHASES[i0]];
  const B = LINEAR_KEYS[TIME_OF_DAY_PHASES[(i0 + 1) % n]];
  for (const field of COLOR_FIELDS) state[field].copy(A[field]).lerp(B[field], s);
  for (const field of NUMBER_FIELDS) state[field] = A[field] + (B[field] - A[field]) * s;

  let azB = B.az;
  if (azB < A.az) azB += 360;
  // Elevation moves linearly (a steady arc); colour/intensity ease between keys.
  state.sunElev = A.elev + (B.elev - A.elev) * f;
  dirFromElevAz(state.sunElev, A.az + (azB - A.az) * f, state.sunDir);
  state.sunVis = THREE.MathUtils.smoothstep(state.sunElev, -4, 1.5);
  state.nightness = THREE.MathUtils.smoothstep(-state.sunElev, -3, 7);
  state.lightDir.copy(state.sunDir).lerp(state.moonDir, state.nightness).normalize();
  if (state.lightDir.y < 0.08) {
    state.lightDir.y = 0.08;
    state.lightDir.normalize();
  }
  return state;
}

// ─── Sky ────────────────────────────────────────────────────────────────────

const skyVertex = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */`
uniform vec3 uTop, uHorizon, uSunDir, uSunColor, uMoonDir, uCloudLit, uCloudShade;
uniform float uTime, uCloudCover, uStars, uSunVis, uMoonVis;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.8, h), 0.65));
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, h));

  float sd = dot(d, uSunDir);
  float sdp = max(sd, 0.0);
  vec2 dh = normalize(d.xz + 1e-5);
  vec2 sh = normalize(uSunDir.xz + 1e-5);
  float towardSun = max(dot(dh, sh), 0.0);
  float band = exp(-abs(h) * 7.0);
  // Warm horizon glow on the sun's side, and a Mie halo around the disc.
  col += uSunColor * pow(towardSun, 5.0) * band * 0.55 * smoothstep(-0.2, 0.3, uSunDir.y + 0.15);
  col += uSunColor * (pow(sdp, 10.0) * 0.28 + pow(sdp, 220.0) * 1.6) * uSunVis;

  float cov = 0.0;
  if (h > -0.02) {
    vec2 cuv = d.xz / (max(h, 0.0) + 0.16) * 1.25 + vec2(uTime * 0.006, uTime * 0.0022);
    float n = fbm6(cuv * 1.3);
    n = n * 0.75 + fbm4(cuv * 4.1 - uTime * 0.012) * 0.25;
    cov = smoothstep(0.62 - uCloudCover * 0.35, 0.8 - uCloudCover * 0.3, n);
    cov *= smoothstep(-0.02, 0.14, h);
    float thick = smoothstep(0.45, 0.95, n);
    vec3 cc = mix(uCloudLit, uCloudShade, thick * 0.85);
    cc += uSunColor * pow(sdp, 4.0) * (1.0 - thick) * 1.4 * uSunVis;
    cc = mix(cc, uHorizon, (1.0 - smoothstep(0.0, 0.35, h)) * 0.55);
    col = mix(col, cc, cov * 0.95);
  }

  if (uStars > 0.001) {
    vec3 sp = d * 170.0;
    vec3 cell = floor(sp);
    float r = hash13(cell);
    if (r > 0.991) {
      vec3 jitter = vec3(hash13(cell + 1.3), hash13(cell + 2.1), hash13(cell + 3.7)) - 0.5;
      float s = smoothstep(0.32, 0.0, length(fract(sp) - 0.5 - jitter * 0.5));
      float tw = 0.55 + 0.45 * sin(uTime * (1.0 + r * 6.0) + r * 60.0);
      vec3 tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash13(cell + 9.1));
      col += tint * s * tw * (r - 0.991) * 420.0 * uStars * smoothstep(0.0, 0.2, h) * (1.0 - cov);
    }
    vec3 mwNormal = normalize(vec3(0.35, 0.55, 0.76));
    float mwDist = dot(d, mwNormal);
    float mw = exp(-mwDist * mwDist * 22.0) * smoothstep(0.35, 0.8, fbm6(d.xz * 5.0 + d.y * 3.0));
    col += vec3(0.55, 0.6, 0.85) * mw * 0.22 * uStars * smoothstep(0.0, 0.25, h) * (1.0 - cov);
  }

  float md = dot(d, uMoonDir);
  float moonDisc = smoothstep(0.99955, 0.99965, md);
  vec3 mLocal = d - uMoonDir * md;
  float craters = vnoise(mLocal.xy * 900.0 + 3.0) * 0.6 + vnoise(mLocal.zy * 2400.0) * 0.4;
  vec3 moonCol = vec3(1.0, 0.97, 0.9) * (0.7 + 0.3 * craters) * 4.0;
  col = mix(col, moonCol, moonDisc * uMoonVis * (1.0 - cov * 0.85));
  col += vec3(0.45, 0.55, 0.9) * (pow(max(md, 0.0), 400.0) * 0.5 + pow(max(md, 0.0), 30.0) * 0.06) * uMoonVis;

  float disc = smoothstep(0.99975, 0.99988, sd);
  col += uSunColor * disc * 40.0 * uSunVis * (1.0 - cov * 0.92);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uMoonDir: { value: MOON_DIR.clone() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uTime: { value: 0 },
    uCloudCover: { value: 0.4 },
    uStars: { value: 0 },
    uSunVis: { value: 1 },
    uMoonVis: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  return { sky, uniforms };
}

// ─── Mist ───────────────────────────────────────────────────────────────────
// Three thin drifting layers hugging the water -- thick at dawn, gone by
// midday, creeping back in at dusk.

const mistVertex = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const mistFragment = /* glsl */`
uniform float uTime, uMist, uLayer, uRadius;
uniform vec3 uColor, uCenter;
uniform vec2 uWindDir;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec2 p = vWorld.xz * 0.07 + uWindDir * uTime * 0.012 + uLayer * 7.3;
  float n = fbm4(p) * 0.7 + fbm4(p * 2.7 - uTime * 0.02) * 0.3;
  float a = smoothstep(0.42, 0.85, n);
  float r = length(vWorld.xz - uCenter.xz) / uRadius;
  a *= 1.0 - smoothstep(0.85, 1.15, r);
  float camDist = length(vWorld - cameraPosition);
  a *= smoothstep(1.5, 7.0, camDist);
  gl_FragColor = vec4(uColor, a * uMist * (0.5 - uLayer * 0.12));
}
`;

export function createMist(scene, dam) {
  const uniforms = {
    uTime: { value: 0 }, uMist: { value: 0 }, uColor: { value: new THREE.Color() },
    // A bank of mist lying on the water out in front of the angler.
    uCenter: { value: new THREE.Vector3(dam.spawn.x, 0, dam.shoreZ(dam.spawn.x) + 70) }, uRadius: { value: 140 },
    uWindDir: { value: new THREE.Vector2(1, 0) },
  };
  const layers = [];
  const geo = new THREE.PlaneGeometry(400, 320);
  geo.rotateX(-Math.PI / 2);
  [0.1, 0.38, 0.75].forEach((height, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uLayer: { value: i } },
      vertexShader: mistVertex, fragmentShader: mistFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(dam.spawn.x, height, dam.shoreZ(dam.spawn.x) + 150);
    mesh.renderOrder = 5;
    mesh.layers.set(1);
    scene.add(mesh);
    layers.push(mesh);
  });
  return { layers, uniforms };
}

// ─── Apply ──────────────────────────────────────────────────────────────────

const focus = new THREE.Vector3();
const forward = new THREE.Vector3();

export function applyAtmosphere({ skyUniforms, sunLight, hemiLight, scene, mist, camera, windDir }, atmos, elapsed) {
  skyUniforms.uTop.value.copy(atmos.top);
  skyUniforms.uHorizon.value.copy(atmos.horizon);
  skyUniforms.uSunDir.value.copy(atmos.sunDir);
  skyUniforms.uSunColor.value.copy(atmos.sun);
  skyUniforms.uCloudLit.value.copy(atmos.cloudLit);
  skyUniforms.uCloudShade.value.copy(atmos.cloudShade);
  skyUniforms.uCloudCover.value = atmos.cloud;
  skyUniforms.uStars.value = atmos.stars;
  skyUniforms.uSunVis.value = atmos.sunVis;
  skyUniforms.uMoonVis.value = atmos.nightness;
  skyUniforms.uTime.value = elapsed;

  sunLight.color.copy(atmos.sun);
  sunLight.intensity = atmos.sunI * (0.25 + 0.75 * Math.max(atmos.sunVis, atmos.nightness));
  // The shadow camera follows the player, so shadows stay crisp wherever
  // they walk around the dam.
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  focus.copy(camera.position).addScaledVector(forward, 10);
  focus.y = 0;
  sunLight.target.position.copy(focus);
  sunLight.position.copy(focus).addScaledVector(atmos.lightDir, 90);

  hemiLight.color.copy(atmos.hemiSky);
  hemiLight.groundColor.copy(atmos.hemiGround);
  hemiLight.intensity = atmos.hemiI;

  scene.fog.color.copy(atmos.fog);
  scene.fog.near = atmos.fogNear;
  scene.fog.far = atmos.fogFar;

  if (mist) {
    mist.uniforms.uTime.value = elapsed;
    mist.uniforms.uMist.value = atmos.mist;
    mist.uniforms.uColor.value.copy(atmos.fog).lerp(atmos.sun, 0.25).multiplyScalar(0.6 + atmos.day * 0.6);
    if (windDir) mist.uniforms.uWindDir.value.copy(windDir);
  }
}
