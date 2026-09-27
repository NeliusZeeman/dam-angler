import * as THREE from '../vendor/three.module.js';
import { NOISE_GLSL } from './gfx/noise.js';

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
uniform mat4 uTextureMatrix;
varying vec3 vWorldPos;
varying vec4 vReflCoord;
varying float vEdgeDist;
varying float vEdgeRadius;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // Distance out from the nearer bank: the shorelines are stored as z for
  // each x (near bank, and the far bank across the dam).
  float u = wp.x / (2.0 * uShoreRange) + 0.5;
  float nearZ = texture2D(uShoreMap, vec2(u, 0.5)).r;
  float farZ = texture2D(uFarMap, vec2(u, 0.5)).r;
  float edgeDist = min(wp.z - nearZ, farZ - wp.z);
  float edge = 0.0;
  // Swell is damped to nothing at the bank so the waterline stays put.
  float damp = smoothstep(0.0, 3.0, edgeDist);
  wp.y += (sin(wp.x * 0.9 + uTime * 1.1) + sin(wp.z * 1.1 - uTime * 0.9 + wp.x * 0.3)) * 0.006 * damp;
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
varying vec3 vWorldPos;
varying vec4 vReflCoord;
varying float vEdgeDist;
varying float vEdgeRadius;
${NOISE_GLSL}

float heightField(vec2 p) {
  vec2 w = uWindDir;
  vec2 side = vec2(-w.y, w.x);
  // River current: the whole surface pattern slides downstream (+x), with
  // a fine, fast "riffle" layer on top where the water's moving.
  p -= vec2(uFlow, 0.0) * uTime;
  float h = vnoise(p * 0.32 - w * uTime * 0.16) * 0.55;
  h += vnoise(vec2(p.x * 1.6, p.y * 4.0) + vec2(uTime * uFlow * 2.5, 0.0)) * 0.12 * min(1.0, uFlow * 2.5);
  h += vnoise(p * 1.05 - side * uTime * 0.28 + 3.1) * 0.28;
  h += vnoise(p * 3.1 - w * uTime * 0.75 + 7.7) * 0.12 * (0.4 + uRough);
  h += vnoise(p * 7.7 + w * uTime * 1.2) * 0.05 * (0.3 + uRough);
  return h;
}

void main() {
  vec2 p = vWorldPos.xz;
  const float e = 0.07;
  float hC = heightField(p);
  float hX = heightField(p + vec2(e, 0.0));
  float hZ = heightField(p + vec2(0.0, e));
  float bump = mix(0.12, 0.5, uRough);
  vec3 N = normalize(vec3(-(hX - hC) / e * bump, 1.0, -(hZ - hC) / e * bump));

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
  col = mix(col, uFoamColor * (0.25 + 0.5 * uDay), foam * 0.55);

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
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
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
  const step = (d) => (d < 60 ? 1.5 : d < 200 ? 6 : d < 700 ? 30 : 120);
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
  };
  // No depth write: the fishing line (drawn after) must still show where a
  // fish has dragged it just under the surface.
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false });
  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.frustumCulled = false;
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
  }

  return {
    waterMesh, setWaterTemperature, uniforms, renderReflection, setAtmosphere,
    setReflectionScale: (s) => { resolutionScale = s; },
  };
}

// Height of the water surface at (x, z) -- the same swell the vertex shader
// applies, so floating things ride the waves you actually see. `edgeDist` is
// how far inside the shoreline the point is (swell dies away at the bank).
export function waterSurfaceY(x, z, elapsedSeconds, edgeDist = 10) {
  const t = Math.min(1, Math.max(0, edgeDist / 3));
  const damp = t * t * (3 - 2 * t);
  return (Math.sin(x * 0.9 + elapsedSeconds * 1.1) + Math.sin(z * 1.1 - elapsedSeconds * 0.9 + x * 0.3)) * 0.006 * damp;
}

export function updateWater(waterMesh, elapsedSeconds) {
  waterMesh.material.uniforms.uTime.value = elapsedSeconds;
}

// Splash: an expanding, fading ripple ring plus a handful of flung droplets,
// spawned where the cast lure hits the water.
export function createSplashEffect(scene) {
  const active = [];

  function spawn(point, strength = 1) {
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

    const drops = Math.round(8 * strength);
    for (let i = 0; i < drops; i++) {
      const droplet = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.9 }),
      );
      const angle = (i / drops) * Math.PI * 2;
      droplet.position.copy(point);
      droplet.position.y = 0.04;
      droplet.userData.age = 0;
      droplet.userData.kind = 'droplet';
      droplet.userData.vx = Math.cos(angle) * (0.5 + Math.random() * 0.4) * strength;
      droplet.userData.vz = Math.sin(angle) * (0.5 + Math.random() * 0.4) * strength;
      droplet.userData.vy = (1.0 + Math.random() * 0.5) * Math.sqrt(strength);
      scene.add(droplet);
      active.push(droplet);
    }
  }

  // A ring on its own -- no droplets -- for a bobbing float, a wake, or a
  // fish nosing at the surface.
  function ripple(point, size = 1) {
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
        obj.userData.vy -= deltaSeconds * 3;
        obj.position.x += obj.userData.vx * deltaSeconds;
        obj.position.z += obj.userData.vz * deltaSeconds;
        obj.position.y += obj.userData.vy * deltaSeconds;
        obj.material.opacity = Math.max(0, 0.9 - obj.userData.age * 1.8);
        if (obj.position.y < 0 || obj.userData.age > 0.8) {
          scene.remove(obj);
          obj.geometry.dispose();
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

  return { spawn, ripple, update };
}
