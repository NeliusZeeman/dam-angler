import * as THREE from '../vendor/three.module.js';
import { NOISE_GLSL } from './gfx/noise.js';
import { GPU } from './gfx/gpu.js';

const MAX_RIPPLES = 16;

// Wind waves: three trains running with the wind (and a little either
// side), longer and higher as it blows harder. Deep-water waves: speed
// follows wavelength (w = sqrt(g k)). Shared by both shaders and by
// waterSurfaceY below, so the float rides exactly the waves you see.
const SWELL_GLSL = /* glsl */`
uniform float uSwell, uSwellK;
uniform vec2 uSwellDir;
float swellAt(vec2 p, float t, out vec2 grad) {
  vec2 d1 = uSwellDir;
  vec2 d2 = vec2(d1.x * 0.9 - d1.y * 0.43, d1.x * 0.43 + d1.y * 0.9);
  vec2 d3 = vec2(d1.x * 0.83 + d1.y * 0.56, -d1.x * 0.56 + d1.y * 0.83);
  float k1 = uSwellK, k2 = uSwellK * 1.7, k3 = uSwellK * 2.6;
  float a1 = 0.55 * uSwell, a2 = 0.3 * uSwell / 1.7, a3 = 0.15 * uSwell / 2.6;
  float f1 = k1 * dot(p, d1) - sqrt(9.81 * k1) * t;
  float f2 = k2 * dot(p, d2) - sqrt(9.81 * k2) * t + 1.7;
  float f3 = k3 * dot(p, d3) - sqrt(9.81 * k3) * t + 4.1;
  grad = d1 * (a1 * k1 * cos(f1)) + d2 * (a2 * k2 * cos(f2)) + d3 * (a3 * k3 * cos(f3));
  return a1 * sin(f1) + a2 * sin(f2) + a3 * sin(f3);
}
`;
const swell = { amp: 0, k: 2, dirX: 1, dirZ: 0 };
function swellAt(x, z, t) {
  const { amp, k: k1, dirX: dx, dirZ: dz } = swell;
  if (amp <= 0) return 0;
  const d2x = dx * 0.9 - dz * 0.43, d2z = dx * 0.43 + dz * 0.9;
  const d3x = dx * 0.83 + dz * 0.56, d3z = -dx * 0.56 + dz * 0.83;
  const k2 = k1 * 1.7, k3 = k1 * 2.6;
  return 0.55 * amp * Math.sin(k1 * (x * dx + z * dz) - Math.sqrt(9.81 * k1) * t)
    + 0.3 * amp / 1.7 * Math.sin(k2 * (x * d2x + z * d2z) - Math.sqrt(9.81 * k2) * t + 1.7)
    + 0.15 * amp / 2.6 * Math.sin(k3 * (x * d3x + z * d3z) - Math.sqrt(9.81 * k3) * t + 4.1);
}

// The dam surface: a real planar reflection (the scene re-rendered from a
// mirrored camera), per-pixel ripples from layered scrolling noise that
// roughen with the wind, colour that deepens away from the bank, caustics
// on the shallow sand, foam where the water laps the shore, and a sun (or
// moon) glitter path.

const vertexShader = /* glsl */`
uniform float uTime;
uniform sampler2D uShoreMap;
uniform sampler2D uFarMap;
uniform float uShoreRange;
uniform float uShoreSamples;
uniform mat4 uTextureMatrix;
${SWELL_GLSL}
varying vec3 vWorldPos;
varying vec4 vReflCoord;
varying float vEdgeDist;
varying float vEdgeRadius;
// The shoreline maps are read texel by texel and blended here, not by the
// GPU: smoothing 32-bit float textures isn't supported on every device
// (some iPads return nothing, and the whole dam then looks like the shore).
float shoreAt(sampler2D map, float u) {
  float x = clamp(u, 0.0, 1.0) * (uShoreSamples - 1.0);
  float i = floor(x);
  float a = texture2D(map, vec2((i + 0.5) / uShoreSamples, 0.5)).r;
  float b = texture2D(map, vec2((min(i + 1.0, uShoreSamples - 1.0) + 0.5) / uShoreSamples, 0.5)).r;
  return mix(a, b, x - i);
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // Distance out from the nearer bank: the shorelines are stored as z for
  // each x (near bank, and the far bank across the dam).
  float u = wp.x / (2.0 * uShoreRange) + 0.5;
  float nearZ = shoreAt(uShoreMap, u);
  float farZ = shoreAt(uFarMap, u);
  float edgeDist = min(wp.z - nearZ, farZ - wp.z);
  float edge = 0.0;
  // Swell is damped to nothing at the bank so the waterline stays put.
  float damp = smoothstep(0.0, 3.0, edgeDist);
  wp.y += (sin(wp.x * 0.9 + uTime * 1.1) + sin(wp.z * 1.1 - uTime * 0.9 + wp.x * 0.3)) * 0.006 * damp;
  vec2 sg;
  wp.y += swellAt(wp.xz, uTime, sg) * smoothstep(0.0, 6.0, edgeDist);
  vWorldPos = wp.xyz;
  vEdgeDist = edgeDist;
  vEdgeRadius = edge;
  vReflCoord = uTextureMatrix * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */`
uniform float uTime, uRough, uSunVis, uDay, uFogNear, uFogFar, uClarity, uAlgae, uDepthScale;
uniform vec3 uSunDir, uSunColor, uDeep, uShallow, uFoamColor, uFogColor, uHorizon;
uniform vec2 uWindDir;
uniform float uFlow;
uniform sampler2D uReflection;
${SWELL_GLSL}
// Rings spreading on the surface: (x, z, start time, strength).
uniform vec4 uRipples[${MAX_RIPPLES}];
// A hooked fish thrashing on top: (x, z, radius, amount).
uniform vec4 uBoil;
varying vec3 vWorldPos;
varying vec4 vReflCoord;
varying float vEdgeDist;
varying float vEdgeRadius;
${NOISE_GLSL}

// Wind roughness here and now: gusts ("cat's paws") drift across the dam
// with the wind, leaving glassy slicks between them.
float gRough;

// Every ring from a float, a splash or a rising fish: a short train of waves
// running outward, stretching and fading as it spreads. Returns the surface
// slope (xz) and white water at the heart of a fresh splash (z).
vec3 ripples(vec2 p) {
  vec2 grad = vec2(0.0);
  float foam = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.0) continue;
    vec2 d = p - r.xy;
    float dist = length(d);
    float front = 0.05 + age * (0.3 + 0.14 * r.w);
    float x = dist - front;
    float w = 0.1 + 0.2 * age;
    float env = exp(-(x * x) / (w * w));
    float k = 26.0 / (1.0 + age * 0.7);
    float amp = r.w * exp(-age * 1.05) / (1.0 + dist * 1.5);
    grad += d / max(dist, 1e-3) * amp * env * cos(x * k) * k * 0.026;
    foam += r.w * smoothstep(0.45, 0.0, age) * smoothstep(0.08 + 0.22 * sqrt(r.w), 0.0, dist);
  }
  if (uBoil.w > 0.0) {
    float b = uBoil.w * smoothstep(uBoil.z, uBoil.z * 0.15, length(p - uBoil.xy));
    if (b > 0.0) {
      grad += (vec2(vnoise(p * 7.0 + uTime * 3.1), vnoise(p * 7.0 + vec2(5.2, 1.3) - uTime * 2.7)) - 0.5) * b * 0.9;
      foam += b * 1.3 * smoothstep(0.38, 0.66, vnoise(p * 11.0 + uTime * 4.0) * 0.6 + vnoise(p * 4.0 - uTime * 2.0) * 0.4);
    }
  }
  return vec3(grad, foam);
}

float camDist0() { return length(cameraPosition - vWorldPos); }

float heightField(vec2 p) {
  vec2 w = uWindDir;
  vec2 side = vec2(-w.y, w.x);
  // River current: the whole surface pattern slides downstream (+x), with
  // a fine, fast "riffle" layer on top where the water's moving.
  p -= vec2(uFlow, 0.0) * uTime;
  float h = vnoise(p * 0.32 - w * uTime * 0.16) * 0.55;
  h += vnoise(vec2(p.x * 1.6, p.y * 4.0) + vec2(uTime * uFlow * 2.5, 0.0)) * 0.12 * min(1.0, uFlow * 2.5);
  h += vnoise(p * 1.05 - side * uTime * 0.28 + 3.1) * 0.28;
  h += vnoise(p * 3.1 - w * uTime * 0.75 + 7.7) * 0.12 * (0.2 + gRough * 1.2);
  h += vnoise(p * 7.7 + w * uTime * 1.2) * 0.05 * (0.1 + gRough * 1.4);
  return h;
}

void main() {
  vec2 p = vWorldPos.xz;
  float gust = vnoise(p * 0.035 - uWindDir * uTime * 0.55) * 0.65 + vnoise(p * 0.09 - uWindDir * uTime * 0.85 + 11.0) * 0.35;
  gRough = clamp(uRough * mix(0.3, 1.75, smoothstep(0.32, 0.68, gust)), 0.0, 1.0);
  const float e = 0.07;
  float hC = heightField(p);
  float hX = heightField(p + vec2(e, 0.0));
  float hZ = heightField(p + vec2(0.0, e));
  float bump = mix(0.1, 0.55, gRough);
  vec3 N = normalize(vec3(-(hX - hC) / e * bump, 1.0, -(hZ - hC) / e * bump));
  vec3 rip = ripples(p);
  vec2 sg;
  swellAt(p, uTime, sg);
  sg *= smoothstep(0.0, 6.0, vEdgeDist) * (1.0 - smoothstep(60.0, 160.0, camDist0()));
  N = normalize(N + vec3(-rip.x - sg.x, 0.0, -rip.y - sg.y));

  vec3 toCam = cameraPosition - vWorldPos;
  float camDist = length(toCam);
  vec3 V = toCam / camDist;
  // Far away, ripples blur out into a calmer, mirror-like sheen.
  N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(25.0, 90.0, camDist) * 0.7));
  float NdV = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

  vec2 ruv = vReflCoord.xy / vReflCoord.w + N.xz * 0.045;
  vec3 refl = texture2D(uReflection, clamp(ruv, vec2(0.002), vec2(0.998))).rgb;

  float depthF = clamp(vEdgeDist / uDepthScale, 0.0, 1.0);
  float deep = smoothstep(0.0, 0.4, depthF);
  vec3 body = mix(uShallow, uDeep, deep) * (0.25 + 0.75 * uDay);

  float ca = vnoise(p * 2.1 + uTime * 0.33) + vnoise(p * 2.8 - uTime * 0.27 + 4.0);
  float caustic = pow(1.0 - abs(ca - 1.0), 7.0) * (1.0 - deep) * uDay;
  body += uSunColor * caustic * 0.35 * uSunVis * uClarity;

  // Silt-laden water scatters light straight back out, so it looks brown
  // even at a low angle and mirrors the sky more weakly (and tinted).
  float murk = 1.0 - uClarity;
  refl = mix(refl, refl * normalize(uShallow + 0.02) * 1.3, murk * 0.45);
  vec3 col = mix(body, refl, fresnel * (1.0 - murk * 0.45));

  vec3 R = reflect(-V, N);
  float sd = max(dot(R, uSunDir), 0.0);
  vec3 spec = uSunColor * (pow(sd, 900.0) * 55.0 + pow(sd, 90.0) * 0.8) * uSunVis;

  float lap = sin(uTime * 1.4 + vWorldPos.x * 0.7) * 0.08;
  float foamBand = 1.0 - smoothstep(-0.12, 0.55 + lap, vEdgeDist);
  float fn = vnoise(p * 4.5 + uTime * 0.5) * vnoise(p * 9.0 - uTime * 0.35 + 2.0);
  float foam = foamBand * smoothstep(0.16, 0.36, fn + foamBand * 0.22);
  float splashFoam = clamp(rip.z, 0.0, 1.0) * smoothstep(0.05, 0.4, fn + 0.3);
  // Ring crests tilt towards you and catch the bright sky; troughs go dark.
  col *= 1.0 + clamp(dot(rip.xy, normalize(toCam.xz + 1e-4)), -0.5, 0.5) * 1.4;
  col = mix(col, uFoamColor * (0.25 + 0.5 * uDay), max(foam * 0.55, splashFoam * 0.85));
  foam = max(foam, splashFoam);

  // Clear water shows the sandy shallows; silty water (the Vaal) hides the
  // bottom even a metre out.
  float alpha = mix(mix(0.82, 0.22, uClarity), 0.86 + (1.0 - uClarity) * 0.12, smoothstep(0.0, 0.28, depthF));
  alpha = max(alpha, fresnel);
  alpha = max(alpha, foam * 0.85);

  // Blue-green algae scum drifting in slicks and blotches (Hartbeespoort).
  if (uAlgae > 0.0) {
    vec2 drift = p * 0.09 + uWindDir * uTime * 0.004;
    float patchN = fbm4(drift) * 0.75 + fbm4(p * 0.6 + 3.0) * 0.25;
    float scum = smoothstep(0.62 - uAlgae * 0.22, 0.74 - uAlgae * 0.18, patchN) * min(1.0, uAlgae * 1.6);
    vec3 algaeCol = mix(vec3(0.05, 0.16, 0.02), vec3(0.16, 0.34, 0.04), fbm4(p * 2.3)) * (0.3 + 0.7 * uDay);
    col = mix(col, algaeCol, scum * 0.9);
    spec *= 1.0 - scum * 0.8;
    alpha = max(alpha, scum * 0.95);
  }
  col += spec / max(alpha, 0.25);

  float fog = smoothstep(uFogNear, uFogFar, camDist);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, alpha);
}
`;

export const SHORE_RANGE = 2500;

// A shoreline (z for each x over +-SHORE_RANGE) as a 1D float texture the
// water shader reads to know how far out from the bank each pixel is.
function buildShoreMap(zAt, samples = 4096) {
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1) - 0.5) * 2 * SHORE_RANGE;
    const z = zAt(x);
    data[i] = Number.isFinite(z) ? z : 1e5;
  }
  const texture = new THREE.DataTexture(data, samples, 1, THREE.RedFormat, THREE.FloatType);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  // Nearest: plain float textures can always be read this way (the shader
  // blends neighbouring texels itself -- see shoreAt).
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function gridAxis(from, to, stepAt) {
  const out = [from];
  let v = from;
  while (v < to) {
    v = Math.min(to, v + stepAt(Math.abs(v)));
    out.push(v);
  }
  return out;
}

// A flat sheet over the whole dam, finely meshed near the angler (it
// carries a little swell) and coarse out toward the horizon.
function buildWaterGeometry(dam) {
  const step = (d) => (d < 40 ? 0.75 : d < 70 ? 1.5 : d < 200 ? 6 : d < 700 ? 30 : 120);
  const xs = gridAxis(-SHORE_RANGE, SHORE_RANGE, step);
  let minShore = Infinity;
  for (let x = -SHORE_RANGE; x <= SHORE_RANGE; x += 25) minShore = Math.min(minShore, dam.shoreZ(x));
  const far = dam.spec.farShore;
  const zs = gridAxis(minShore - 6, far ? far * 1.4 + 60 : SHORE_RANGE, step);
  const pos = [], idx = [];
  for (const z of zs) for (const x of xs) pos.push(x, 0, z);
  const NX = xs.length;
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b2 = a + 1, c = a + NX, d = c + 1;
      idx.push(a, c, b2, b2, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createWater(scene, dam, {
  coldColor: coldHex = 0x1c4d73, warmColor: warmHex = 0x2f8ea3, clarity = 0.6, algae = 0,
} = {}) {
  const geometry = buildWaterGeometry(dam);
  const reflectionRT = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 2 });
  const uniforms = {
    uTime: { value: 0 },
    uReflection: { value: reflectionRT.texture },
    uTextureMatrix: { value: new THREE.Matrix4() },
    uShoreMap: { value: buildShoreMap(dam.shoreZ) },
    uFarMap: { value: buildShoreMap(dam.farShoreZ) },
    uShoreRange: { value: SHORE_RANGE },
    uShoreSamples: { value: 4096 },
    uDepthScale: { value: dam.spec.depthSlope * 1.5 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uSunVis: { value: 1 },
    uDay: { value: 1 },
    uRough: { value: 0.3 },
    uWindDir: { value: new THREE.Vector2(1, 0) },
    uFlow: { value: dam.spec.flow || 0 },
    uDeep: { value: new THREE.Color() },
    uShallow: { value: new THREE.Color() },
    uFoamColor: { value: new THREE.Color(0.9, 0.92, 0.88) },
    uFogColor: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uFogNear: { value: 40 },
    uFogFar: { value: 200 },
    uClarity: { value: clarity },
    uAlgae: { value: algae },
    uSwell: { value: 0 }, uSwellK: { value: 2 }, uSwellDir: { value: new THREE.Vector2(1, 0) },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uBoil: { value: new THREE.Vector4(0, 0, 1, 0) },
  };
  let nextRipple = 0;
  // A ring starts spreading from (x, z); strength ~0.3 a float's nod, 1 a
  // lure landing, 2+ a big fish crashing back in.
  function addRipple(x, z, strength = 1) {
    uniforms.uRipples.value[nextRipple].set(x, z, uniforms.uTime.value, strength);
    nextRipple = (nextRipple + 1) % MAX_RIPPLES;
  }
  // White water around a fish thrashing on top (amount 0 = calm).
  function setBoil(x, z, radius, amount) {
    uniforms.uBoil.value.set(x, z, Math.max(0.05, radius), Math.max(0, amount));
  }
  // No depth write: the fishing line (drawn after) must still show where a
  // fish has dragged it just under the surface.
  // On WebGPU the node version also handles its own mirror pass (a
  // reflector) and sees through the surface (refraction and true depth).
  let material, reflection = null;
  if (GPU.on) {
    ({ material, reflection } = GPU.nodes.waterMaterial(uniforms, { maxRipples: MAX_RIPPLES, shoreRange: SHORE_RANGE }));
    scene.add(reflection.target);
  } else {
    material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false });
  }
  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.frustumCulled = false;
  waterMesh.userData.uniforms = uniforms;
  scene.add(waterMesh);

  const coldColor = new THREE.Color(coldHex);
  const warmColor = new THREE.Color(warmHex);
  const base = new THREE.Color();
  const silt = new THREE.Color(0x8a8a5a);

  function setWaterTemperature(celsius) {
    const t = Math.min(1, Math.max(0, (celsius - 5) / 25));
    base.copy(coldColor).lerp(warmColor, t);
    // Clear water goes dark with depth; muddy water stays a lit, opaque brown.
    uniforms.uDeep.value.copy(base).multiplyScalar(THREE.MathUtils.lerp(0.75, 0.22, clarity));
    uniforms.uShallow.value.copy(base).lerp(silt, 0.35).multiplyScalar(0.75);
  }
  setWaterTemperature(20);

  // ─── Reflection pass ──────────────────────────────────────────────────────
  const mirrorCam = new THREE.PerspectiveCamera();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02);
  const camPos = new THREE.Vector3(), lookDir = new THREE.Vector3(), upDir = new THREE.Vector3(), target = new THREE.Vector3();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const bufferSize = new THREE.Vector2();
  let resolutionScale = 0.5;

  function renderReflection(renderer, sceneToRender, camera, hidden = []) {
    if (reflection) return; // the reflector node draws it during the frame
    renderer.getDrawingBufferSize(bufferSize);
    const w = Math.max(64, Math.floor(bufferSize.x * resolutionScale));
    const h = Math.max(64, Math.floor(bufferSize.y * resolutionScale));
    if (reflectionRT.width !== w || reflectionRT.height !== h) reflectionRT.setSize(w, h);

    camera.updateMatrixWorld();
    camPos.setFromMatrixPosition(camera.matrixWorld);
    lookDir.set(0, 0, -1).transformDirection(camera.matrixWorld);
    upDir.set(0, 1, 0).transformDirection(camera.matrixWorld);
    mirrorCam.position.set(camPos.x, -camPos.y, camPos.z);
    target.copy(camPos).add(lookDir);
    target.y = -target.y;
    mirrorCam.up.set(upDir.x, -upDir.y, upDir.z);
    mirrorCam.lookAt(target);
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    mirrorCam.layers.set(0);
    mirrorCam.updateMatrixWorld();
    uniforms.uTextureMatrix.value.copy(bias).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);

    waterMesh.visible = false;
    const wasVisible = hidden.map((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const prevClip = renderer.clippingPlanes;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.clippingPlanes = [clipPlane];
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(reflectionRT);
    renderer.clear();
    renderer.render(sceneToRender, mirrorCam);
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = prevClip;
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    hidden.forEach((o, i) => { o.visible = wasVisible[i]; });
    waterMesh.visible = true;
  }

  function setAtmosphere(atmos, windSpeed, windDir) {
    uniforms.uSunDir.value.copy(atmos.lightDir);
    uniforms.uSunColor.value.copy(atmos.sun);
    uniforms.uSunVis.value = Math.max(atmos.sunVis, atmos.nightness * 0.5);
    uniforms.uDay.value = atmos.day;
    uniforms.uFogColor.value.copy(atmos.fog);
    uniforms.uHorizon.value.copy(atmos.horizon);
    uniforms.uFogNear.value = atmos.fogNear;
    uniforms.uFogFar.value = atmos.fogFar;
    uniforms.uRough.value = Math.min(1, 0.15 + windSpeed / 10);
    if (windDir) uniforms.uWindDir.value.copy(windDir);
    // Wind waves (windSpeed in km/h): flat calm to a short, steep chop on a
    // blowy day -- a dam's fetch keeps them small (~10 cm at 30 km/h).
    swell.amp = Math.min(0.11, 0.0012 * windSpeed + 0.0001 * windSpeed * windSpeed);
    swell.k = (Math.PI * 2) / (1.6 + windSpeed * 0.13);
    if (windDir) { swell.dirX = windDir.x; swell.dirZ = windDir.y; }
    uniforms.uSwell.value = swell.amp;
    uniforms.uSwellK.value = swell.k;
    uniforms.uSwellDir.value.set(swell.dirX, swell.dirZ);
  }

  return {
    waterMesh, setWaterTemperature, uniforms, renderReflection, setAtmosphere, addRipple, setBoil,
    setReflectionScale: (s) => {
      resolutionScale = s;
      if (reflection) reflection.reflector.resolutionScale = s;
    },
    reflection,
  };
}

// Height of the water surface at (x, z) -- the same swell the vertex shader
// applies, so floating things ride the waves you actually see. `edgeDist` is
// how far inside the shoreline the point is (swell dies away at the bank).
export function waterSurfaceY(x, z, elapsedSeconds, edgeDist = 10) {
  const t = Math.min(1, Math.max(0, edgeDist / 3));
  const damp = t * t * (3 - 2 * t);
  const t2 = Math.min(1, Math.max(0, edgeDist / 6));
  return (Math.sin(x * 0.9 + elapsedSeconds * 1.1) + Math.sin(z * 1.1 - elapsedSeconds * 0.9 + x * 0.3)) * 0.006 * damp
    + swellAt(x, z, elapsedSeconds) * t2 * t2 * (3 - 2 * t2);
}

export function updateWater(waterMesh, elapsedSeconds) {
  waterMesh.userData.uniforms.uTime.value = elapsedSeconds;
}

// Splash: rings spreading in the water itself (bending the reflections, as
// real ones do) plus flung droplets, spawned where the lure hits the water.
// Without a water surface to draw on, falls back to a flat white ring.
const dropletGeometry = new THREE.SphereGeometry(1, 6, 5);
export function createSplashEffect(scene, water = null) {
  const active = [];

  function spawn(point, strength = 1) {
    if (water) {
      water.addRipple(point.x, point.z, strength * 1.4);
      spawnDroplets(point, strength);
      return;
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(point);
    ring.position.y = 0.02;
    ring.userData.age = 0;
    ring.userData.kind = 'ring';
    ring.userData.strength = strength;
    scene.add(ring);
    active.push(ring);
    spawnDroplets(point, strength);
  }

  // A crown of spray: big drops thrown out and up, a fine mist of small ones.
  function spawnDroplets(point, strength, fromY = 0.03) {
    const drops = Math.round(14 * strength);
    for (let i = 0; i < drops; i++) {
      const size = (0.006 + Math.random() * Math.random() * 0.02) * Math.min(1.6, 0.7 + strength * 0.4);
      const droplet = new THREE.Mesh(
        dropletGeometry,
        new THREE.MeshBasicMaterial({ color: 0xdfeef0, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      droplet.scale.setScalar(size);
      const angle = Math.random() * Math.PI * 2;
      const out = (0.3 + Math.random() * 0.7) * strength;
      droplet.position.set(point.x, fromY, point.z);
      droplet.userData.age = 0;
      droplet.userData.kind = 'droplet';
      droplet.userData.vx = Math.cos(angle) * out;
      droplet.userData.vz = Math.sin(angle) * out;
      droplet.userData.vy = (0.9 + Math.random() * 1.4) * Math.sqrt(strength);
      scene.add(droplet);
      active.push(droplet);
    }
  }

  // A ring on its own -- no droplets -- for a bobbing float, a wake, or a
  // fish nosing at the surface.
  function ripple(point, size = 1) {
    if (water) { water.addRipple(point.x, point.z, 0.55 * size); return; }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, 0.015, point.z);
    ring.userData.age = 0;
    ring.userData.kind = 'ring';
    ring.userData.strength = 0.45 * size;
    scene.add(ring);
    active.push(ring);
  }

  function update(deltaSeconds) {
    for (let i = active.length - 1; i >= 0; i--) {
      const obj = active[i];
      obj.userData.age += deltaSeconds;
      if (obj.userData.kind === 'droplet') {
        obj.userData.vy -= deltaSeconds * 9.8;
        obj.position.x += obj.userData.vx * deltaSeconds;
        obj.position.z += obj.userData.vz * deltaSeconds;
        obj.position.y += obj.userData.vy * deltaSeconds;
        obj.material.opacity = Math.max(0, 0.85 - obj.userData.age * 1.2);
        if (obj.position.y < 0 || obj.userData.age > 1.2) {
          // Each drop that falls back makes its own tiny ring.
          if (water && obj.position.y < 0 && Math.random() < 0.35) water.addRipple(obj.position.x, obj.position.z, 0.12);
          scene.remove(obj);
          obj.material.dispose();
          active.splice(i, 1);
        }
      } else {
        const t = obj.userData.age / 1.2;
        const r = 0.1 + t * 1.3 * obj.userData.strength;
        obj.scale.setScalar(r / 0.1);
        obj.material.opacity = Math.max(0, 0.55 * (1 - t));
        if (t >= 1) {
          scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
          active.splice(i, 1);
        }
      }
    }
  }

  // Water streaming off something in the air (a leaping fish): drops only,
  // starting where it is; they ring the surface where they land.
  function spray(point, strength = 0.4) {
    spawnDroplets(point, strength, Math.max(0.03, point.y));
  }

  return { spawn, ripple, spray, update };
}
