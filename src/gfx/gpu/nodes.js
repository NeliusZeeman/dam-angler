import {
  MeshBasicNodeMaterial, BackSide, DoubleSide,
} from '../../../vendor/three.webgpu.js';
import {
  Fn, If, Loop, float, vec2, vec3, vec4, int, ivec2, reference, uniformArray, attribute,
  positionLocal, positionWorld, positionGeometry, positionView, cameraPosition, cameraNear, cameraFar,
  modelWorldMatrix, normalViewGeometry, normalWorldGeometry, uv, texture, textureLoad, vertexColor,
  varyingProperty, mix, smoothstep, clamp, max, min, abs, sin, exp, pow, fract, floor, dot, length,
  normalize, reflect, screenUV, viewportSharedTexture, viewportDepthTexture, perspectiveDepthToViewZ,
  dFdx, dFdy, log2, output, materialOpacity, reflector, textureSize,
} from '../../../vendor/three.tsl.js';

// Node-material (WebGPU) versions of the game's GLSL shaders. Each one reads
// the very same uniform objects ({ value }) the WebGL shaders use, so all the
// code that drives them -- time of day, wind, ripples, the fight -- is shared.

const U = (u, type) => reference('value', type, u);

// ─── Noise (mirrors NOISE_GLSL in noise.js) ─────────────────────────────────

export const hash12 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}).setLayout({ name: 'hash12', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

export const hash13 = Fn(([p]) => {
  const p3 = fract(p.mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.zyx.add(31.32)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}).setLayout({ name: 'hash13', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });

export const vnoise = Fn(([p]) => {
  const i = floor(p).toVar();
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3)).toVar();
  return mix(
    mix(hash12(i), hash12(i.add(vec2(1, 0))), u.x),
    mix(hash12(i.add(vec2(0, 1))), hash12(i.add(vec2(1, 1))), u.x),
    u.y,
  );
}).setLayout({ name: 'vnoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

function fbm(octaves, name) {
  let norm = 0;
  for (let i = 0, a = 0.5; i < octaves; i++, a *= 0.5) norm += a;
  return Fn(([p0]) => {
    const p = vec2(p0).toVar();
    const v = float(0).toVar();
    for (let i = 0, a = 0.5; i < octaves; i++, a *= 0.5) {
      v.addAssign(vnoise(p).mul(a));
      p.assign(vec2(p.x.mul(1.6).sub(p.y.mul(1.2)), p.x.mul(1.2).add(p.y.mul(1.6))));
    }
    return v.div(norm);
  }).setLayout({ name, type: 'float', inputs: [{ name: 'p0', type: 'vec2' }] });
}
export const fbm4 = fbm(4, 'fbm4');
export const fbm6 = fbm(6, 'fbm6');

// ─── Sky ────────────────────────────────────────────────────────────────────

export function skyMaterial(u) {
  const top = U(u.uTop, 'color'), hor = U(u.uHorizon, 'color');
  const sunDir = U(u.uSunDir, 'vec3'), sunCol = U(u.uSunColor, 'color'), moonDir = U(u.uMoonDir, 'vec3');
  const cLit = U(u.uCloudLit, 'color'), cShade = U(u.uCloudShade, 'color');
  const time = U(u.uTime, 'float'), cover = U(u.uCloudCover, 'float'), stars = U(u.uStars, 'float');
  const sunVis = U(u.uSunVis, 'float'), moonVis = U(u.uMoonVis, 'float');

  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
  material.colorNode = Fn(() => {
    const d = normalize(positionLocal).toVar();
    const h = d.y;
    const col = mix(hor, top, pow(smoothstep(-0.02, 0.8, h), 0.65)).toVar();
    col.assign(mix(col, hor.mul(0.55), smoothstep(0.0, -0.25, h)));

    const sd = dot(d, sunDir).toVar();
    const sdp = max(sd, 0.0).toVar();
    const towardSun = max(dot(normalize(d.xz.add(1e-5)), normalize(sunDir.xz.add(1e-5))), 0.0);
    const band = exp(abs(h).mul(-7.0));
    // Warm horizon glow on the sun's side, and a Mie halo round the disc.
    col.addAssign(sunCol.mul(pow(towardSun, 5.0)).mul(band).mul(0.55).mul(smoothstep(-0.2, 0.3, sunDir.y.add(0.15))));
    col.addAssign(sunCol.mul(pow(sdp, 10.0).mul(0.28).add(pow(sdp, 220.0).mul(1.6))).mul(sunVis));

    const cov = float(0).toVar();
    If(h.greaterThan(-0.02), () => {
      const cuv = d.xz.div(max(h, 0.0).add(0.16)).mul(1.25).add(vec2(time.mul(0.006), time.mul(0.0022))).toVar();
      const n = fbm6(cuv.mul(1.3)).mul(0.75).add(fbm4(cuv.mul(4.1).sub(time.mul(0.012))).mul(0.25)).toVar();
      cov.assign(smoothstep(cover.mul(-0.35).add(0.62), cover.mul(-0.3).add(0.8), n).mul(smoothstep(-0.02, 0.14, h)));
      const thick = smoothstep(0.45, 0.95, n);
      const cc = mix(cLit, cShade, thick.mul(0.85)).toVar();
      cc.addAssign(sunCol.mul(pow(sdp, 4.0)).mul(thick.oneMinus()).mul(1.4).mul(sunVis));
      cc.assign(mix(cc, hor, smoothstep(0.0, 0.35, h).oneMinus().mul(0.55)));
      col.assign(mix(col, cc, cov.mul(0.95)));
    });

    If(stars.greaterThan(0.001), () => {
      const sp = d.mul(170.0).toVar();
      const cell = floor(sp).toVar();
      const r = hash13(cell).toVar();
      If(r.greaterThan(0.991), () => {
        const jitter = vec3(hash13(cell.add(1.3)), hash13(cell.add(2.1)), hash13(cell.add(3.7))).sub(0.5);
        const s = smoothstep(0.32, 0.0, length(fract(sp).sub(0.5).sub(jitter.mul(0.5))));
        const tw = sin(time.mul(r.mul(6.0).add(1.0)).add(r.mul(60.0))).mul(0.45).add(0.55);
        const tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), hash13(cell.add(9.1)));
        col.addAssign(tint.mul(s).mul(tw).mul(r.sub(0.991)).mul(420.0).mul(stars).mul(smoothstep(0.0, 0.2, h)).mul(cov.oneMinus()));
      });
      const mwDist = dot(d, normalize(vec3(0.35, 0.55, 0.76)));
      const mw = exp(mwDist.mul(mwDist).mul(-22.0)).mul(smoothstep(0.35, 0.8, fbm6(d.xz.mul(5.0).add(d.y.mul(3.0)))));
      col.addAssign(vec3(0.55, 0.6, 0.85).mul(mw).mul(0.22).mul(stars).mul(smoothstep(0.0, 0.25, h)).mul(cov.oneMinus()));
    });

    const md = dot(d, moonDir).toVar();
    const moonDisc = smoothstep(0.99955, 0.99965, md);
    const mLocal = d.sub(moonDir.mul(md));
    const craters = vnoise(mLocal.xy.mul(900.0).add(3.0)).mul(0.6).add(vnoise(mLocal.zy.mul(2400.0)).mul(0.4));
    const moonCol = vec3(1.0, 0.97, 0.9).mul(craters.mul(0.3).add(0.7)).mul(4.0);
    col.assign(mix(col, moonCol, moonDisc.mul(moonVis).mul(cov.mul(-0.85).add(1.0))));
    const mdp = max(md, 0.0);
    col.addAssign(vec3(0.45, 0.55, 0.9).mul(pow(mdp, 400.0).mul(0.5).add(pow(mdp, 30.0).mul(0.06))).mul(moonVis));

    const disc = smoothstep(0.99975, 0.99988, sd);
    col.addAssign(sunCol.mul(disc).mul(40.0).mul(sunVis).mul(cov.mul(-0.92).add(1.0)));
    return col;
  })();
  return material;
}

// ─── Mist ───────────────────────────────────────────────────────────────────

export function mistMaterial(u, layer) {
  const time = U(u.uTime, 'float'), mist = U(u.uMist, 'float'), radius = U(u.uRadius, 'float');
  const wind = U(u.uWind, 'float'), color = U(u.uColor, 'color'), center = U(u.uCenter, 'vec3');
  const windDir = U(u.uWindDir, 'vec2'), drift = U(u.uDrift, 'vec2');
  const L = float(layer);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, fog: false });
  material.colorNode = color;
  material.opacityNode = Fn(() => {
    const wp = positionWorld;
    const w = wp.xz.sub(drift.mul(L.mul(0.175).add(0.65))).toVar();
    const side = vec2(windDir.y.negate(), windDir.x);
    const stretch = min(wind, 20.0).div(12.0).add(1.0);
    const p = vec2(dot(w, windDir).div(stretch), dot(w, side)).mul(0.07).add(L.mul(7.3)).toVar();
    const warp = vec2(vnoise(p.mul(0.9).add(time.mul(0.035))), vnoise(p.mul(0.9).sub(time.mul(0.03)).add(5.2))).sub(0.5).toVar();
    p.addAssign(warp.mul(1.6));
    const n = fbm4(p).mul(0.7).add(fbm4(p.mul(2.7).add(warp.mul(2.0)).sub(time.mul(0.015))).mul(0.3));
    const a = smoothstep(0.42, 0.85, n).toVar();
    const r = length(wp.xz.sub(center.xz)).div(radius);
    a.mulAssign(smoothstep(0.85, 1.15, r).oneMinus());
    a.mulAssign(smoothstep(1.5, 7.0, length(wp.sub(cameraPosition))));
    return a.mul(mist).mul(L.mul(-0.12).add(0.5));
  })();
  return material;
}

// ─── Far hills ──────────────────────────────────────────────────────────────

export function mountainMaterial(u) {
  const horizon = U(u.uHorizon, 'color'), lightDir = U(u.uLightDir, 'vec3'), lightCol = U(u.uLightColor, 'color');
  const base = U(u.uBase, 'color'), haze = U(u.uHaze, 'float');
  const material = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  material.colorNode = Fn(() => {
    const lit = max(dot(normalWorldGeometry, lightDir), 0.0);
    const col = base.mul(lightCol.mul(lit).mul(0.9).add(0.35));
    const hz = clamp(haze.add(uv().y.oneMinus().mul(0.25)), 0.0, 1.0);
    return mix(col, horizon, hz);
  })();
  return material;
}

// ─── Ground (grass, sand, wet margin) ───────────────────────────────────────

export function groundNodes(material, { grassMap, sandMap, grassTint, sandTint, tile }) {
  const gTint = U(grassTint, 'color'), sTint = U(sandTint, 'color'), uTile = U(tile, 'float');
  const sand = attribute('aSand', 'float');
  const wet = float(0).toVar('groundWet');
  material.colorNode = Fn(() => {
    const wuv = positionWorld.xz.toVar();
    const grassA = texture(grassMap, wuv.mul(uTile.mul(0.21))).rgb;
    const grassB = texture(grassMap, wuv.mul(uTile.mul(0.047)).add(0.31)).rgb;
    const grassCol = mix(grassA, grassB, 0.35).mul(gTint).mul(fbm4(wuv.mul(0.045)).mul(0.45).add(0.78));
    const sandCol = texture(sandMap, wuv.mul(uTile.mul(0.33))).rgb.mul(sTint).toVar();
    const edgeNoise = fbm4(wuv.mul(0.7)).sub(0.5);
    const sandAmt = smoothstep(0.35, 0.65, sand.add(edgeNoise.mul(0.6)));
    const groundWet = smoothstep(-0.03, 0.09, positionWorld.y).oneMinus();
    sandCol.mulAssign(mix(1.0, 0.5, groundWet));
    sandCol.assign(mix(sandCol, sandCol.mul(vec3(0.5, 0.6, 0.5)), smoothstep(-0.02, -0.25, positionWorld.y)));
    wet.assign(groundWet.mul(sandAmt));
    return vec4(vertexColor().rgb.mul(mix(grassCol, sandCol, sandAmt)), 1.0);
  })();
  material.roughnessNode = mix(float(0.95), float(0.28), wet);
}

// ─── Wind sway (mirrors WIND_GLSL in wind.js) ───────────────────────────────

const windOffset = (wu, wp, h) => {
  const time = U(wu.uTime, 'float'), wind = U(wu.uWind, 'float'), dir = U(wu.uWindDir, 'vec2');
  const along = dot(wp.xz, dir);
  const roll = sin(time.mul(1.3).sub(along.mul(0.35))).mul(0.5).add(0.5);
  const gust = sin(time.mul(0.37).sub(along.mul(0.08))).mul(0.5).add(0.5);
  const flutter = sin(time.mul(6.1).add(wp.x.mul(2.3)).add(wp.z.mul(1.7)))
    .add(sin(time.mul(4.3).sub(wp.x.mul(1.1)).add(wp.z.mul(2.9))).mul(0.6));
  const push = wind.mul(0.03).add(0.05).mul(roll.mul(0.65).add(0.35)).mul(gust.mul(0.8).add(0.6));
  const tremble = flutter.mul(wind.mul(0.004).add(0.012));
  const side = vec2(dir.y.negate(), dir.x);
  return dir.mul(push).add(side.mul(tremble)).mul(h).mul(h);
};

export function windNodes(material, windUniforms, amountUniform, { instanced = false, cutout = false } = {}) {
  const amount = U(amountUniform, 'float');
  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    if (instanced) {
      // Each instance's root and height (prepareWindInstances in wind.js).
      const root = attribute('aRoot', 'vec4');
      const rootWorld = modelWorldMatrix.mul(vec4(root.xyz, 1.0)).xyz;
      const off = windOffset(windUniforms, rootWorld, clamp(positionGeometry.y, 0.0, 1.0)).mul(root.w).mul(amount);
      p.x.addAssign(off.x);
      p.z.addAssign(off.y);
    } else {
      const off = windOffset(windUniforms, p, attribute('aSway', 'float')).mul(amount);
      p.x.addAssign(off.x);
      p.z.addAssign(off.y);
    }
    return p;
  })();
  // Thin foliage is lit the same from both faces.
  material.normalNode = normalViewGeometry;
  if (cutout && material.map) {
    // Keep far-off leaves from going bald as mipmaps average the alpha away.
    material.opacityNode = Fn(() => {
      const texel = uv().mul(vec2(textureSize(texture(material.map), 0)));
      const ddx = dFdx(texel), ddy = dFdy(texel);
      const mip = max(0.0, log2(max(dot(ddx, ddx), dot(ddy, ddy))).mul(0.5));
      return materialOpacity.mul(mip.mul(0.35).add(1.0));
    })();
  }
}

// ─── Fish swimming (mirrors applySwim in fish3d.js) ─────────────────────────

export function swimNodes(material, swim) {
  const phase = U(swim.uSwimPhase, 'float'), amp = U(swim.uSwimAmp, 'float');
  const head = U(swim.uSwimHead, 'float'), span = U(swim.uSwimSpan, 'float'), k = U(swim.uSwimK, 'float');
  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const tail = clamp(head.sub(p.x).div(span), 0.0, 1.0);
    p.z.addAssign(sin(phase.add(p.x.mul(k))).mul(amp).mul(tail).mul(tail));
    return p;
  })();
}

// ─── Landing net under water (mirrors landingNet.js) ────────────────────────

export function netNodes(material, underwater) {
  const tint = U(underwater.uWaterTint, 'color'), seeDepth = U(underwater.uSeeDepth, 'float');
  material.outputNode = Fn(() => {
    const sunk = clamp(positionWorld.y.negate().div(seeDepth), 0.0, 1.0);
    return vec4(mix(output.rgb, tint, sunk.mul(0.85)), output.a.mul(sunk.mul(sunk).oneMinus()));
  })();
}

// ─── Water ──────────────────────────────────────────────────────────────────
// Same surface as the WebGL shader in water.js -- wind ripples, gusts,
// rings, swell, caustics, foam, algae, sun glitter -- plus what WebGPU can
// afford: real refraction (the bank, weed and your float seen through the
// surface, bent by the ripples) and true depth, so the water clears to the
// bottom in the shallows and darkens as the bottom drops away.

export function waterMaterial(u, { maxRipples, shoreRange, reflectionScale = 0.5 }) {
  const time = U(u.uTime, 'float'), rough = U(u.uRough, 'float'), sunVis = U(u.uSunVis, 'float');
  const day = U(u.uDay, 'float'), fogNear = U(u.uFogNear, 'float'), fogFar = U(u.uFogFar, 'float');
  const clarity = U(u.uClarity, 'float'), algae = U(u.uAlgae, 'float'), depthScale = U(u.uDepthScale, 'float');
  const sunDir = U(u.uSunDir, 'vec3'), sunCol = U(u.uSunColor, 'color'), deepCol = U(u.uDeep, 'color');
  const shallow = U(u.uShallow, 'color'), foamCol = U(u.uFoamColor, 'color'), fogCol = U(u.uFogColor, 'color');
  const windDir = U(u.uWindDir, 'vec2'), flow = U(u.uFlow, 'float');
  const swellAmp = U(u.uSwell, 'float'), swellK = U(u.uSwellK, 'float'), swellDir = U(u.uSwellDir, 'vec2');
  const samples = U(u.uShoreSamples, 'float');
  const boil = U(u.uBoil, 'vec4');
  const rippleArr = uniformArray(u.uRipples.value, 'vec4');

  // Height and slope of the wind waves: vec3(height, d/dx, d/dz).
  const swell = Fn(([p, t]) => {
    const d1 = swellDir;
    const d2 = vec2(d1.x.mul(0.9).sub(d1.y.mul(0.43)), d1.x.mul(0.43).add(d1.y.mul(0.9)));
    const d3 = vec2(d1.x.mul(0.83).add(d1.y.mul(0.56)), d1.x.mul(-0.56).add(d1.y.mul(0.83)));
    const k1 = swellK, k2 = swellK.mul(1.7), k3 = swellK.mul(2.6);
    const a1 = swellAmp.mul(0.55), a2 = swellAmp.mul(0.3 / 1.7), a3 = swellAmp.mul(0.15 / 2.6);
    const f1 = k1.mul(dot(p, d1)).sub(k1.mul(9.81).sqrt().mul(t));
    const f2 = k2.mul(dot(p, d2)).sub(k2.mul(9.81).sqrt().mul(t)).add(1.7);
    const f3 = k3.mul(dot(p, d3)).sub(k3.mul(9.81).sqrt().mul(t)).add(4.1);
    const g = d1.mul(a1.mul(k1).mul(f1.cos())).add(d2.mul(a2.mul(k2).mul(f2.cos()))).add(d3.mul(a3.mul(k3).mul(f3.cos())));
    return vec3(a1.mul(f1.sin()).add(a2.mul(f2.sin())).add(a3.mul(f3.sin())), g.x, g.y);
  });

  const shoreAt = (tex, uu) => {
    const x = clamp(uu, 0.0, 1.0).mul(samples.sub(1.0)).toVar();
    const i = floor(x);
    const a = textureLoad(tex, ivec2(int(i), 0)).r;
    const b = textureLoad(tex, ivec2(int(min(i.add(1.0), samples.sub(1.0))), 0)).r;
    return mix(a, b, x.sub(i));
  };

  const vEdge = varyingProperty('float', 'vEdgeDist');
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const uu = p.x.div(2.0 * shoreRange).add(0.5);
    const edge = min(p.z.sub(shoreAt(u.uShoreMap.value, uu)), shoreAt(u.uFarMap.value, uu).sub(p.z)).toVar();
    const damp = smoothstep(0.0, 3.0, edge);
    p.y.addAssign(sin(p.x.mul(0.9).add(time.mul(1.1))).add(sin(p.z.mul(1.1).sub(time.mul(0.9)).add(p.x.mul(0.3)))).mul(0.006).mul(damp));
    p.y.addAssign(swell(p.xz, time).x.mul(smoothstep(0.0, 6.0, edge)));
    vEdge.assign(edge);
    return p;
  })();

  // The planar reflection: the scene drawn from under the mirror.
  const reflection = reflector({ resolutionScale: reflectionScale, bounces: false });
  reflection.target.rotateX(-Math.PI / 2);

  const heightField = Fn(([p0, gRough]) => {
    const w = windDir;
    const side = vec2(w.y.negate(), w.x);
    const p = p0.sub(vec2(flow, 0.0).mul(time)).toVar();
    const h = vnoise(p.mul(0.32).sub(w.mul(time).mul(0.16))).mul(0.55).toVar();
    h.addAssign(vnoise(vec2(p.x.mul(1.6), p.y.mul(4.0)).add(vec2(time.mul(flow).mul(2.5), 0.0))).mul(0.12).mul(min(1.0, flow.mul(2.5))));
    h.addAssign(vnoise(p.mul(1.05).sub(side.mul(time).mul(0.28)).add(3.1)).mul(0.28));
    h.addAssign(vnoise(p.mul(3.1).sub(w.mul(time).mul(0.75)).add(7.7)).mul(0.12).mul(gRough.mul(1.2).add(0.2)));
    h.addAssign(vnoise(p.mul(7.7).add(w.mul(time).mul(1.2))).mul(0.05).mul(gRough.mul(1.4).add(0.1)));
    return h;
  });

  material.colorNode = Fn(() => {
    const wp = positionWorld.toVar();
    const p = wp.xz.toVar();
    const edgeDist = vEdge;
    const gust = vnoise(p.mul(0.035).sub(windDir.mul(time).mul(0.55))).mul(0.65)
      .add(vnoise(p.mul(0.09).sub(windDir.mul(time).mul(0.85)).add(11.0)).mul(0.35));
    const gRough = clamp(rough.mul(mix(0.3, 1.75, smoothstep(0.32, 0.68, gust))), 0.0, 1.0).toVar();
    const e = 0.07;
    const hC = heightField(p, gRough), hX = heightField(p.add(vec2(e, 0.0)), gRough), hZ = heightField(p.add(vec2(0.0, e)), gRough);
    const bump = mix(0.1, 0.55, gRough);
    const N = normalize(vec3(hX.sub(hC).div(e).mul(bump).negate(), 1.0, hZ.sub(hC).div(e).mul(bump).negate())).toVar();

    // Rings from floats, splashes and rising fish, and a hooked fish's boil.
    const ripGrad = vec2(0.0).toVar();
    const ripFoam = float(0.0).toVar();
    Loop(maxRipples, ({ i }) => {
      const r = rippleArr.element(i);
      const age = time.sub(r.z);
      If(r.w.greaterThan(0.0).and(age.greaterThanEqual(0.0)).and(age.lessThanEqual(4.0)), () => {
        const d = p.sub(r.xy);
        const dist = length(d);
        const front = age.mul(r.w.mul(0.14).add(0.3)).add(0.05);
        const x = dist.sub(front);
        const w = age.mul(0.2).add(0.1);
        const env = exp(x.mul(x).div(w.mul(w)).negate());
        const k = float(26.0).div(age.mul(0.7).add(1.0));
        const amp = r.w.mul(exp(age.mul(-1.05))).div(dist.mul(1.5).add(1.0));
        ripGrad.addAssign(d.div(max(dist, 1e-3)).mul(amp).mul(env).mul(x.mul(k).cos()).mul(k).mul(0.026));
        ripFoam.addAssign(r.w.mul(smoothstep(0.45, 0.0, age)).mul(smoothstep(r.w.sqrt().mul(0.22).add(0.08), 0.0, dist)));
      });
    });
    If(boil.w.greaterThan(0.0), () => {
      const b = boil.w.mul(smoothstep(boil.z, boil.z.mul(0.15), length(p.sub(boil.xy)))).toVar();
      ripGrad.addAssign(vec2(vnoise(p.mul(7.0).add(time.mul(3.1))), vnoise(p.mul(7.0).add(vec2(5.2, 1.3)).sub(time.mul(2.7)))).sub(0.5).mul(b).mul(0.9));
      ripFoam.addAssign(b.mul(1.3).mul(smoothstep(0.38, 0.66, vnoise(p.mul(11.0).add(time.mul(4.0))).mul(0.6).add(vnoise(p.mul(4.0).sub(time.mul(2.0))).mul(0.4)))));
    });

    const toCam = cameraPosition.sub(wp).toVar();
    const camDist = length(toCam).toVar();
    const sg = swell(p, time).yz.mul(smoothstep(0.0, 6.0, edgeDist)).mul(smoothstep(60.0, 160.0, camDist).oneMinus());
    N.assign(normalize(N.add(vec3(ripGrad.x.add(sg.x).negate(), 0.0, ripGrad.y.add(sg.y).negate()))));
    const V = toCam.div(camDist);
    N.assign(normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(25.0, 90.0, camDist).mul(0.7))));
    const NdV = max(dot(N, V), 0.0);
    const fresnel = pow(NdV.oneMinus(), 5.0).mul(0.98).add(0.02).toVar();

    const refl = reflection.sample(reflection.uvNode.add(N.xz.mul(0.045))).rgb.toVar();

    const depthF = clamp(edgeDist.div(depthScale), 0.0, 1.0);
    const deep = smoothstep(0.0, 0.4, depthF);
    const body = mix(shallow, deepCol, deep).mul(day.mul(0.75).add(0.25)).toVar();
    const ca = vnoise(p.mul(2.1).add(time.mul(0.33))).add(vnoise(p.mul(2.8).sub(time.mul(0.27)).add(4.0)));
    const caustic = pow(abs(ca.sub(1.0)).oneMinus(), 7.0).mul(deep.oneMinus()).mul(day);
    const murk = clarity.oneMinus();

    // What lies under the surface, bent by the ripples. Where the bent ray
    // would land on something above the water (the rod, a reed in front),
    // look straight through instead.
    const bend = N.xz.mul(0.03).div(max(camDist.mul(0.08), 1.0));
    const sceneZ = (uvx) => perspectiveDepthToViewZ(viewportDepthTexture(uvx).r, cameraNear, cameraFar);
    const bentUV = screenUV.add(bend).toVar();
    const thick = positionView.z.sub(sceneZ(bentUV)).toVar();
    If(thick.lessThan(0.0), () => {
      bentUV.assign(screenUV);
      thick.assign(max(positionView.z.sub(sceneZ(screenUV)), 0.0));
    });
    const under = viewportSharedTexture(bentUV).rgb.toVar();
    // Light is soaked up on the way down and back: a metre of clear water
    // still shows the bottom, murky dam water hides it in a hand's depth.
    const absorb = mix(2.2, 0.35, clarity);
    const seen = exp(thick.mul(absorb).negate()).toVar();
    under.assign(mix(body, under.mul(mix(vec3(1.0), shallow.mul(2.2), 0.55)), seen));
    under.addAssign(sunCol.mul(caustic).mul(0.35).mul(sunVis).mul(clarity).mul(seen));

    refl.assign(mix(refl, refl.mul(normalize(shallow.add(0.02))).mul(1.3), murk.mul(0.45)));
    const col = mix(under, refl, fresnel.mul(murk.mul(-0.45).add(1.0))).toVar();

    const R = reflect(V.negate(), N);
    const sd = max(dot(R, sunDir), 0.0);
    const spec = sunCol.mul(pow(sd, 900.0).mul(55.0).add(pow(sd, 90.0).mul(0.8))).mul(sunVis).toVar();

    const lap = sin(time.mul(1.4).add(wp.x.mul(0.7))).mul(0.08);
    const foamBand = smoothstep(-0.12, lap.add(0.55), edgeDist).oneMinus();
    const fn = vnoise(p.mul(4.5).add(time.mul(0.5))).mul(vnoise(p.mul(9.0).sub(time.mul(0.35)).add(2.0)));
    const foam = foamBand.mul(smoothstep(0.16, 0.36, fn.add(foamBand.mul(0.22)))).toVar();
    const splashFoam = clamp(ripFoam, 0.0, 1.0).mul(smoothstep(0.05, 0.4, fn.add(0.3)));
    col.mulAssign(clamp(dot(ripGrad, normalize(toCam.xz.add(1e-4))), -0.5, 0.5).mul(1.4).add(1.0));
    col.assign(mix(col, foamCol.mul(day.mul(0.5).add(0.25)), max(foam.mul(0.55), splashFoam.mul(0.85))));
    foam.assign(max(foam, splashFoam));

    // Right at the waterline the surface fades out into the wet sand.
    const alpha = smoothstep(-0.05, 0.25, edgeDist).toVar();
    alpha.assign(max(alpha, foam.mul(0.85)));

    If(algae.greaterThan(0.0), () => {
      const drift = p.mul(0.09).add(windDir.mul(time).mul(0.004));
      const patchN = fbm4(drift).mul(0.75).add(fbm4(p.mul(0.6).add(3.0)).mul(0.25));
      const scum = smoothstep(algae.mul(-0.22).add(0.62), algae.mul(-0.18).add(0.74), patchN).mul(min(1.0, algae.mul(1.6)));
      const algaeCol = mix(vec3(0.05, 0.16, 0.02), vec3(0.16, 0.34, 0.04), fbm4(p.mul(2.3))).mul(day.mul(0.7).add(0.3));
      col.assign(mix(col, algaeCol, scum.mul(0.9)));
      spec.mulAssign(scum.mul(-0.8).add(1.0));
    });
    col.addAssign(spec);

    const fog = smoothstep(fogNear, fogFar, camDist);
    col.assign(mix(col, fogCol, fog));
    return vec4(col, alpha);
  })();

  return { material, reflection };
}
