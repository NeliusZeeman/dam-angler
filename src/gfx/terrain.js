import * as THREE from '../../vendor/three.module.js';
import { fbm, makeRng, seedFromString, smoothstep, NOISE_GLSL } from './noise.js';
import { grassGroundTexture, sandTexture } from './pixelTextures.js';

const DEG = Math.PI / 180;

// Grid lines along one axis: tight near `centre`, opening out with distance,
// so the ground is detailed where the angler walks and cheap on the hills.
function axisSamples(centre, before, after, stepAt) {
  const out = new Set([centre]);
  for (const [sign, extent] of [[-1, before], [1, after]]) {
    let d = 0;
    while (d < extent) {
      d = Math.min(extent, d + stepAt(d));
      out.add(centre + sign * d);
    }
  }
  return [...out].sort((a, b) => a - b);
}
const nearStep = (d) => (d < 40 ? 0.8 : d < 100 ? 2 : d < 250 ? 6 : d < 700 ? 20 : 60);

export function createTerrain(scene, { dam, location }) {
  const seed = seedFromString(location.id);
  const scenery = location.scenery || {};
  const groundLook = scenery.ground || {};
  const beach = dam.spec.beachWidth;

  const heightAt = (x, z) => dam.groundHeight(x, z);
  // Sand along both banks (and on the lake bed), grass above the beach.
  const sandAt = (landDist) => 1 - smoothstep(beach - 0.5, beach + 0.6, landDist);

  // ─── Ground mesh ──────────────────────────────────────────────────────────
  const far = dam.spec.farShore;
  const xs = axisSamples(0, 1400, 1400, nearStep);
  const zNear = axisSamples(0, 1100, far ? far * 0.5 : 300, nearStep);
  let zs = zNear;
  if (far) {
    // Also detail the far bank, seen across the water.
    const farStep = (d) => (d < 60 ? 4 : d < 200 ? 10 : 40);
    const zFar = axisSamples(far, far * 0.5, 900, farStep);
    zs = [...new Set([...zNear, ...zFar])].sort((a, b) => a - b);
  }
  const NX = xs.length, NZ = zs.length;
  const positions = new Float32Array(NX * NZ * 3);
  const sand = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = xs[i], z = zs[j];
      const k = j * NX + i;
      positions[k * 3] = x;
      positions[k * 3 + 1] = heightAt(x, z);
      positions[k * 3 + 2] = z;
      const wd = dam.waterDist(x, z);
      sand[k] = wd > 0 ? 1 : sandAt(-wd);
    }
  }
  const indices = [];
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  groundGeo.setAttribute('aSand', new THREE.BufferAttribute(sand, 1));
  groundGeo.setIndex(indices);
  groundGeo.computeVertexNormals();

  // Steep ground goes rocky, high ground goes to dry Highveld straw.
  const normals = groundGeo.getAttribute('normal');
  const colors = new Float32Array(NX * NZ * 3);
  const rock = new THREE.Color(groundLook.rock ?? 0x8a8272), straw = new THREE.Color(groundLook.straw ?? 0xd6c58f), tmp = new THREE.Color();
  const hills = dam.spec.hills;
  for (let v = 0; v < normals.count; v++) {
    const ny = normals.getY(v);
    const y = positions[v * 3 + 1];
    tmp.setRGB(1, 1, 1);
    tmp.lerp(straw, smoothstep(1.5, hills * 1.4 + 2, y) * 0.55);
    tmp.lerp(rock, smoothstep(0.9, 0.7, ny) * 0.85);
    colors[v * 3] = tmp.r; colors[v * 3 + 1] = tmp.g; colors[v * 3 + 2] = tmp.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const grassMap = grassGroundTexture();
  const sandMap = sandTexture();
  const grassTint = { value: new THREE.Color(location.grassTint ?? 0xffffff) };
  // Each dam's own bank colour (pale Vaal silt, red Loskop sandstone...),
  // relative to the generic sand the texture is painted in.
  const sandRef = new THREE.Color(0xa89878);
  const sandLook = new THREE.Color(groundLook.sand ?? 0xa89878);
  const sandTint = { value: new THREE.Color(sandLook.r / sandRef.r, sandLook.g / sandRef.g, sandLook.b / sandRef.b) };
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true });
  groundMat.customProgramCacheKey = () => 'ground';
  groundMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uGrassMap: { value: grassMap }, uSandMap: { value: sandMap }, uGrassTint: grassTint, uSandTint: sandTint });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSand;\nvarying float vSand;\nvarying vec3 vGroundPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSand = aSand;\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uGrassMap;
        uniform sampler2D uSandMap;
        uniform vec3 uGrassTint;
        uniform vec3 uSandTint;
        varying float vSand;
        varying vec3 vGroundPos;
        ${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `
        vec2 wuv = vGroundPos.xz;
        vec3 grassA = texture2D(uGrassMap, wuv * 0.21).rgb;
        vec3 grassB = texture2D(uGrassMap, wuv * 0.047 + 0.31).rgb;
        vec3 grassCol = mix(grassA, grassB, 0.35) * uGrassTint;
        grassCol *= 0.78 + fbm4(wuv * 0.045) * 0.45;
        vec3 sandCol = texture2D(uSandMap, wuv * 0.33).rgb * uSandTint;
        float edgeNoise = fbm4(wuv * 0.7) - 0.5;
        float sandAmt = smoothstep(0.35, 0.65, vSand + edgeNoise * 0.6);
        float groundWet = 1.0 - smoothstep(-0.03, 0.09, vGroundPos.y);
        sandCol *= mix(1.0, 0.5, groundWet);
        sandCol = mix(sandCol, sandCol * vec3(0.5, 0.6, 0.5), smoothstep(-0.02, -0.25, vGroundPos.y));
        diffuseColor.rgb *= mix(grassCol, sandCol, sandAmt);
        groundWet *= sandAmt;
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, groundWet);');
  };
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.frustumCulled = false;
  scene.add(ground);

  // ─── Boulders & shore rocks ───────────────────────────────────────────────
  const rng = makeRng(seed + 77);
  const rockGeos = [];
  const rockColA = new THREE.Color(groundLook.rock ?? 0x8b857a).multiplyScalar(1.08);
  const rockColB = new THREE.Color(groundLook.rock ?? 0x8b857a).multiplyScalar(0.72);
  const lichen = new THREE.Color(0xa7a46a);
  function addBoulder(x, z, size, flatness = 0.62, sink = 0.15) {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.getAttribute('position');
    const cols = [];
    const rs = rng() * 100;
    for (let v = 0; v < p.count; v++) {
      const vx = p.getX(v), vy = p.getY(v), vz = p.getZ(v);
      const n = fbm(vx * 1.7 + rs, vz * 1.7 + vy * 1.3, { octaves: 3, seed: seed + 5 });
      const k = 0.75 + n * 0.5;
      p.setXYZ(v, vx * k * size * (1 + rng() * 0.05), vy * k * size * flatness, vz * k * size);
      tmp.copy(rockColA).lerp(rockColB, n);
      if (vy > 0.3 && n > 0.55) tmp.lerp(lichen, 0.5);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.rotateY(rng() * Math.PI * 2);
    g.translate(x, heightAt(x, z) + size * sink, z);
    rockGeos.push(g.index ? g.toNonIndexed() : g);
  }
  // Out on the land.
  for (let i = 0; i < 90; i++) {
    const x = (rng() - 0.5) * 700;
    const land = beach + 6 + Math.pow(rng(), 1.4) * 300;
    const z = dam.shoreZ(x) - land;
    const cluster = rng() < 0.25 ? 3 : 1;
    for (let k = 0; k < cluster; k++) {
      addBoulder(x + (rng() - 0.5) * 3, z + (rng() - 0.5) * 3, 0.4 + rng() * (land > 40 ? 2.4 : 1.1));
    }
  }
  // Flat slabs and outcrops lying along the water's edge, half in and half
  // out of the water -- kept clear of the stands.
  const nearStand = (x) => dam.stands.some((s) => Math.abs(x - s.x) < s.width + 2);
  for (let i = 0; i < (scenery.shoreRocks ?? 0) * 2; i++) {
    const x = (rng() - 0.5) * 320;
    if (nearStand(x)) continue;
    const z = dam.shoreZ(x) + 0.7 - rng() * 2.6;
    addBoulder(x, z, 0.35 + rng() * 0.9, 0.22 + rng() * 0.2, 0.02);
  }
  if (rockGeos.length) {
    const merged = mergeGeometries(rockGeos);
    merged.computeVertexNormals();
    const rocks = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    scene.add(rocks);
  }

  const mountains = createMountains(scene, scenery.horizon || { base: 8, rough: 2 }, seed, far);

  return { heightAt, sandAt, ground, groundMaterial: groundMat, grassTint, mountains };
}

// ─── Distant mountains ──────────────────────────────────────────────────────
// Two hazy silhouette rings built from the location's horizon description
// (base height, named ridges by compass bearing, gorges cut through them),
// standing beyond the far bank.

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function horizonHeight(az, h, seed) {
  const cx = Math.cos(az), sz = Math.sin(az);
  let y = h.base * (0.45 + 1.0 * fbm(cx * 2.5 + 5, sz * 2.5 + 5, { octaves: 5, seed }));
  for (const r of h.ridges || []) {
    const d = angleDiff(az, r.az * DEG);
    y += r.height * Math.exp(-(d * d) / (2 * r.width * r.width)) * (0.75 + 0.5 * fbm(cx * 9, sz * 9, { octaves: 3, seed: seed + 3 }));
  }
  y += (h.rough || 0) * (fbm(cx * 16, sz * 16, { octaves: 4, seed: seed + 7 }) - 0.5) * 2.2;
  if (h.notch) {
    const d = angleDiff(az, h.notch.az * DEG);
    y -= h.notch.depth * Math.exp(-(d * d) / (2 * h.notch.width * h.notch.width));
  }
  return Math.max(0.5, y);
}

const mountainVertex = /* glsl */`
varying float vHeight;
varying vec3 vNormalW;
void main() {
  vHeight = uv.y;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const mountainFragment = /* glsl */`
uniform vec3 uHorizon, uLightDir, uLightColor, uBase;
uniform float uHaze, uDay;
varying float vHeight;
varying vec3 vNormalW;
void main() {
  float lit = max(dot(normalize(vNormalW), uLightDir), 0.0);
  vec3 col = uBase * (0.35 + lit * 0.9 * uLightColor);
  float haze = clamp(uHaze + (1.0 - vHeight) * 0.25, 0.0, 1.0);
  gl_FragColor = vec4(mix(col, uHorizon, haze), 1.0);
}
`;

function createMountains(scene, horizon, seed, farShore) {
  const layers = [];
  // Heights are authored as they'd look from 330m away; scaling them by
  // radius keeps the same angular size however far back the ring stands.
  const nearR = farShore ? Math.max(700, farShore + 400) : 1600;
  const specs = [
    { radius: nearR + 1200, scale: 1.0, haze: 0.62, base: 0x3d4a52, seedOff: 0 },
    { radius: nearR, scale: 0.5, haze: 0.4, base: 0x3f4a38, seedOff: 11 },
  ];
  for (const spec of specs) {
    const SEG = 400;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const az = (i / SEG) * Math.PI * 2;
      const top = horizonHeight(az, horizon, seed + spec.seedOff) * spec.scale * (spec.radius / 330);
      const x = Math.cos(az) * spec.radius, z = Math.sin(az) * spec.radius;
      pos.push(x, -30, z, x, top * 0.45, z, x * 0.985, top, z * 0.985);
      uv.push(0, 0, 0, 0.45, 0, 1);
    }
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < 2; j++) {
        const a = i * 3 + j, b = a + 1, c = (i + 1) * 3 + j, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const uniforms = {
      uHorizon: { value: new THREE.Color() }, uLightDir: { value: new THREE.Vector3(0, 1, 0) },
      uLightColor: { value: new THREE.Color(1, 1, 1) }, uBase: { value: new THREE.Color(spec.base) },
      uHaze: { value: spec.haze }, uDay: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: mountainVertex, fragmentShader: mountainFragment, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    scene.add(mesh);
    layers.push({ mesh, uniforms, base: spec.base });
  }

  function update(atmos) {
    for (const layer of layers) {
      layer.uniforms.uHorizon.value.copy(atmos.fog).lerp(atmos.horizon, 0.5);
      layer.uniforms.uLightDir.value.copy(atmos.lightDir);
      layer.uniforms.uLightColor.value.copy(atmos.sun).multiplyScalar(atmos.sunI * 0.35);
      layer.uniforms.uBase.value.set(layer.base).multiplyScalar(0.25 + atmos.day * 0.75);
    }
  }
  return { layers, update };
}

// Minimal merge for non-indexed geometries sharing the same attributes.
export function mergeGeometries(geos) {
  const names = Object.keys(geos[0].attributes);
  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const itemSize = geos[0].getAttribute(name).itemSize;
    let total = 0;
    for (const g of geos) total += g.getAttribute(name).array.length;
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of geos) {
      arr.set(g.getAttribute(name).array, o);
      o += g.getAttribute(name).array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  return merged;
}
