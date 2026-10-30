import * as W from '../../../vendor/three.webgpu.js';
import {
  Fn, Loop, float, vec2, vec3, vec4, uniform, pass, uv, mix, smoothstep, clamp, max, min, pow, length,
  dot, fract, step, mrt, output, normalView,
} from '../../../vendor/three.tsl.js';
import { bloom } from '../../../vendor/addons/tsl/display/BloomNode.js';
import { fxaa } from '../../../vendor/addons/tsl/display/FXAANode.js';
import { ao } from '../../../vendor/addons/tsl/display/GTAONode.js';

// The WebGPU picture pipeline: the same look as post.js (HDR scene, bloom,
// lens ghosts, sun rays, ACES tone mapping, grade, vignette, grain), built
// from three.js render-pipeline nodes, plus ambient occlusion -- soft
// contact shadow where things meet: under rocks and the jetty, in the reeds,
// round the bottom of tree trunks -- and edge smoothing at the end.

const acesFilmic = Fn(([color]) => {
  // Same fit as post.js (Stephen Hill's ACES approximation).
  const c0 = vec3(
    dot(color, vec3(0.59719, 0.35458, 0.04823)),
    dot(color, vec3(0.07600, 0.90834, 0.01566)),
    dot(color, vec3(0.02840, 0.13383, 0.83777)),
  ).div(0.6).toVar();
  const a = c0.mul(c0.add(0.0245786)).sub(0.000090537);
  const b = c0.mul(c0.mul(0.983729).add(0.4329510)).add(0.238081);
  const v = a.div(b).toVar();
  return clamp(vec3(
    dot(v, vec3(1.60475, -0.53108, -0.07367)),
    dot(v, vec3(-0.10208, 1.10813, -0.00605)),
    dot(v, vec3(-0.00327, -0.07276, 1.07602)),
  ), 0.0, 1.0);
});

const toSRGB = (c) => mix(c.mul(12.92), pow(c, vec3(1.0 / 2.4)).mul(1.055).sub(0.055), step(vec3(0.0031308), c));

const grainHash = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
});

export function createGpuPost(renderer, scene, camera, { occlusion = true, smoothing = true } = {}) {
  const pipeline = new (W.RenderPipeline || W.PostProcessing)(renderer);
  // Tone mapping and sRGB happen in our own final pass, as in post.js.
  pipeline.outputColorTransform = false;

  const scenePass = pass(scene, camera);
  if (occlusion) scenePass.setMRT(mrt({ output, normal: normalView }));
  const sceneColor = scenePass.getTextureNode('output');

  let aoPass = null;
  if (occlusion) {
    aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = 0.6;
    aoPass.thickness.value = 0.8;
    aoPass.distanceFallOff.value = 0.5;
  }

  const u = {
    exposure: uniform(1), bloom: uniform(0.5), flare: uniform(0.35), vignette: uniform(0.55),
    grain: uniform(0.025), time: uniform(0), saturation: uniform(1.08), grade: uniform(new W.Color(1, 1, 1)),
    res: uniform(new W.Vector2(1, 1)), sunUV: uniform(new W.Vector2(0.5, 0.5)), rays: uniform(0),
    aoStrength: uniform(0.75),
  };

  // Glints off the water run to hundreds of times white: capped (as post.js
  // does) so a few of them don't smear glare over the whole picture.
  const bloomPass = bloom(min(sceneColor, vec4(8.0)), 1.0, 0.45, 1.1);
  bloomPass.smoothWidth.value = 0.5;
  const bloomTex = bloomPass.getTextureNode();

  const composite = Fn(() => {
    const vUv = uv();
    const hdr = sceneColor.rgb.toVar();
    if (aoPass) {
      // Occlusion darkens the light bouncing round, not the sun's glare.
      const occ = aoPass.getTextureNode().r;
      hdr.mulAssign(mix(1.0, occ, u.aoStrength));
    }
    const bl = bloomTex.sample(vUv).rgb;

    // Lens ghosts: bright spots mirrored through the screen centre.
    const fuv = vec2(1.0).sub(vUv).toVar();
    const ghostVec = vec2(0.5).sub(fuv).mul(0.42);
    const flare = vec3(0.0).toVar();
    for (let i = 1; i < 5; i++) {
      const o = fuv.add(ghostVec.mul(i));
      const w = pow(max(0.0, length(vec2(0.5).sub(o)).div(0.7071).oneMinus()), 6.0);
      flare.addAssign(bloomTex.sample(o).rgb.mul(w).mul(vec3(0.7 + 0.1 * i, 0.75, 1.0 - 0.12 * i)));
    }

    // Sun rays streaming round trees and hills, marched toward the sun.
    const rays = vec3(0.0).toVar();
    const stepUV = u.sunUV.sub(vUv).div(24.0);
    const c = vUv.toVar();
    const decay = float(1.0).toVar();
    const aspect = u.res.x.div(u.res.y);
    Loop(24, () => {
      c.addAssign(stepUV);
      const near = smoothstep(0.0, 0.5, length(c.sub(u.sunUV).mul(vec2(aspect, 1.0)))).oneMinus();
      rays.addAssign(min(bloomTex.sample(clamp(c, 0.0, 1.0)).rgb, vec3(6.0)).mul(near).mul(decay));
      decay.mulAssign(0.955);
    });
    rays.mulAssign(u.rays.mul(0.35 / 24.0));

    const graded = hdr.add(bl.mul(u.bloom)).add(flare.mul(u.flare)).add(rays).mul(u.grade);
    const col = acesFilmic(graded.mul(u.exposure)).toVar();
    const lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col.assign(mix(vec3(lum), col, u.saturation));
    col.assign(toSRGB(col));

    const q = vUv.sub(0.5).mul(vec2(u.res.x.div(u.res.y), 1.0));
    col.mulAssign(smoothstep(0.35, 1.25, length(q)).mul(u.vignette).oneMinus());
    col.addAssign(grainHash(vUv.mul(u.res).add(fract(u.time).mul(1000.0))).sub(0.5).mul(u.grain));
    return vec4(col, 1.0);
  })();

  pipeline.outputNode = smoothing ? fxaa(composite) : composite;

  const size = new W.Vector2();
  function setSize() {
    renderer.getDrawingBufferSize(size);
    u.res.value.set(Math.max(1, size.x), Math.max(1, size.y));
  }
  setSize();

  const sunPos = new W.Vector3(), camFwd = new W.Vector3(), sunDir = new W.Vector3(0, 1, 0);
  let raysWanted = 0, raysScale = 1;
  function aimRays(camera3d) {
    camera3d.getWorldDirection(camFwd);
    const facing = camFwd.dot(sunDir);
    if (raysWanted <= 0 || facing <= 0.05) { u.rays.value = 0; return; }
    sunPos.copy(camera3d.position).addScaledVector(sunDir, 1000).project(camera3d);
    const sx = sunPos.x * 0.5 + 0.5, sy = 0.5 - sunPos.y * 0.5; // WebGPU textures run top-down
    u.sunUV.value.set(sx, sy);
    const off = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) - 0.5;
    u.rays.value = raysWanted * raysScale * Math.max(0, 1 - off / 0.35) * Math.min(1, facing * 3);
  }

  function render(_scene, camera3d) {
    aimRays(camera3d);
    pipeline.render();
  }

  function setLook(atmos, elapsed, warmth = 1) {
    u.exposure.value = atmos.exposure * warmth;
    u.bloom.value = atmos.bloom * 0.6;
    u.flare.value = 0.25 + atmos.sunVis * 0.25;
    u.grade.value.setRGB(1, 1, 1).lerp(atmos.grade, 0.6);
    u.vignette.value = 0.45 + atmos.nightness * 0.3;
    u.time.value = elapsed;
    // Less occlusion at night, when there's little light to block anyway.
    u.aoStrength.value = 0.75 - atmos.nightness * 0.35;
    sunDir.copy(atmos.sunDir);
    raysWanted = atmos.sunVis * (0.25 + 0.55 * (1 - Math.min(1, Math.max(0, sunDir.y) * 2.2)));
  }

  return { render, setSize, setLook, setRaysScale: (k) => { raysScale = k; }, pipeline };
}
