import * as THREE from '../../vendor/three.module.js';

// HDR pipeline: the scene renders linear light into a half-float target;
// bright pixels are pulled out and blurred down a mip chain for bloom; the
// final pass adds bloom and lens ghosts, tone-maps (ACES), grades, and adds
// vignette and grain.

const fullscreenVertex = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const brightFragment = /* glsl */`
uniform sampler2D tInput;
uniform float uThreshold, uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * contrib, vec3(60.0)), 1.0);
}
`;

const blurFragment = /* glsl */`
uniform sampler2D tInput;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
  c += texture2D(tInput, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(tInput, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(tInput, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture2D(tInput, vUv - uDir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const compositeFragment = /* glsl */`
uniform sampler2D tScene, tB0, tB1, tB2, tB3;
uniform float uExposure, uBloom, uFlare, uVignette, uGrain, uTime, uSaturation;
uniform vec3 uGrade;
uniform vec2 uRes;
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = ACESInputMat * (color / 0.6);
  color = RRTAndODTFit(color);
  return clamp(ACESOutputMat * color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 hdr = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tB0, vUv).rgb * 0.45 + texture2D(tB1, vUv).rgb * 0.6
             + texture2D(tB2, vUv).rgb * 0.8 + texture2D(tB3, vUv).rgb * 1.0;

  // Lens ghosts: bright spots reflected through the screen centre, taken
  // straight from the bloom buffer so they vanish when the sun is hidden.
  vec2 fuv = vec2(1.0) - vUv;
  vec2 ghostVec = (vec2(0.5) - fuv) * 0.42;
  vec3 flare = vec3(0.0);
  for (int i = 1; i < 5; i++) {
    vec2 o = fuv + ghostVec * float(i);
    float w = pow(max(0.0, 1.0 - length(vec2(0.5) - o) / 0.7071), 6.0);
    vec3 tint = vec3(0.7 + 0.1 * float(i), 0.75, 1.0 - 0.12 * float(i));
    flare += texture2D(tB3, o).rgb * w * tint;
  }

  hdr = (hdr + bloom * uBloom + flare * uFlare) * uGrade;
  vec3 c = acesFilmic(hdr * uExposure);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, uSaturation);
  c = toSRGB(c);

  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= 1.0 - smoothstep(0.35, 1.25, length(q)) * uVignette;
  c += (grainHash(vUv * uRes + fract(uTime) * 1000.0) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createPostPipeline(renderer) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
  const levels = [0, 1, 2, 3].map(() => ({ a: new THREE.WebGLRenderTarget(1, 1, rtOpts), b: new THREE.WebGLRenderTarget(1, 1, rtOpts) }));

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tInput: { value: null }, uThreshold: { value: 1.1 }, uKnee: { value: 0.5 } },
    vertexShader: fullscreenVertex, fragmentShader: brightFragment, depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tInput: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: fullscreenVertex, fragmentShader: blurFragment, depthTest: false, depthWrite: false,
  });
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneRT.texture },
      tB0: { value: levels[0].a.texture }, tB1: { value: levels[1].a.texture },
      tB2: { value: levels[2].a.texture }, tB3: { value: levels[3].a.texture },
      uExposure: { value: 1 }, uBloom: { value: 0.5 }, uFlare: { value: 0.35 },
      uVignette: { value: 0.55 }, uGrain: { value: 0.025 }, uTime: { value: 0 },
      uSaturation: { value: 1.08 }, uGrade: { value: new THREE.Color(1, 1, 1) },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: fullscreenVertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false,
  });

  const size = new THREE.Vector2();
  function setSize() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x), h = Math.max(1, size.y);
    sceneRT.setSize(w, h);
    levels.forEach((lvl, i) => {
      const lw = Math.max(1, Math.floor(w / 2 ** (i + 1))), lh = Math.max(1, Math.floor(h / 2 ** (i + 1)));
      lvl.a.setSize(lw, lh);
      lvl.b.setSize(lw, lh);
    });
    compositeMat.uniforms.uRes.value.set(w, h);
  }
  setSize();

  function pass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, camera);
  }

  function blur(source, sourceSize, target, scratch) {
    blurMat.uniforms.tInput.value = source;
    blurMat.uniforms.uDir.value.set(1 / sourceSize.x, 0);
    pass(blurMat, scratch);
    blurMat.uniforms.tInput.value = scratch.texture;
    blurMat.uniforms.uDir.value.set(0, 1 / scratch.height);
    pass(blurMat, target);
  }

  const srcSize = new THREE.Vector2();
  function render(scene, camera3d) {
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera3d);

    brightMat.uniforms.tInput.value = sceneRT.texture;
    pass(brightMat, levels[0].a);
    blur(levels[0].a.texture, srcSize.set(levels[0].a.width, levels[0].a.height), levels[0].a, levels[0].b);
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1].a;
      blurMat.uniforms.tInput.value = prev.texture;
      blurMat.uniforms.uDir.value.set(1 / prev.width, 0);
      pass(blurMat, levels[i].b);
      blurMat.uniforms.tInput.value = levels[i].b.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / levels[i].b.height);
      pass(blurMat, levels[i].a);
    }

    pass(compositeMat, null);
  }

  function setLook(atmos, elapsed, warmth = 1) {
    const u = compositeMat.uniforms;
    u.uExposure.value = atmos.exposure * warmth;
    u.uBloom.value = atmos.bloom * 0.6;
    u.uFlare.value = 0.25 + atmos.sunVis * 0.25;
    u.uGrade.value.setRGB(1, 1, 1).lerp(atmos.grade, 0.6);
    u.uVignette.value = 0.45 + atmos.nightness * 0.3;
    u.uTime.value = elapsed;
  }

  return { render, setSize, setLook };
}
