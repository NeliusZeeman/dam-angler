import * as THREE from '../../vendor/three.module.js';

// One wind field shared by every swaying thing (grass, reeds, willow strands,
// leaves), so a gust visibly rolls across the whole dam at once.
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
};

export const WIND_GLSL = /* glsl */`
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
// World-space xz offset for a point at world position wp, where h is how far
// up the swaying part it is (0 = rooted, 1 = free tip).
vec2 windOffset(vec3 wp, float h) {
  float along = dot(wp.xz, uWindDir);
  float roll = sin(uTime * 1.3 - along * 0.35) * 0.5 + 0.5;
  float gust = sin(uTime * 0.37 - along * 0.08) * 0.5 + 0.5;
  float flutter = sin(uTime * 6.1 + wp.x * 2.3 + wp.z * 1.7) + sin(uTime * 4.3 - wp.x * 1.1 + wp.z * 2.9) * 0.6;
  float push = (0.05 + uWind * 0.03) * (0.35 + roll * 0.65) * (0.6 + gust * 0.8);
  float tremble = flutter * (0.012 + uWind * 0.004);
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  return (uWindDir * push + side * tremble) * h * h;
}
`;

let smoothWind = 0;
const targetDir = new THREE.Vector2(1, 0);

export function updateWind(elapsedSeconds, deltaSeconds, windSpeed, dirX, dirZ) {
  smoothWind += (windSpeed - smoothWind) * Math.min(1, deltaSeconds * 0.8);
  targetDir.set(dirX, dirZ);
  if (targetDir.lengthSq() > 0) targetDir.normalize();
  windUniforms.uWindDir.value.lerp(targetDir, Math.min(1, deltaSeconds * 0.4)).normalize();
  windUniforms.uWind.value = smoothWind;
  windUniforms.uTime.value = elapsedSeconds;
}

// Adds the wind field to a built-in material. For instanced meshes the sway is
// applied in world space after the instance transform, scaled by each
// instance's height; for merged world-space meshes `aSway` (0 root .. 1 tip)
// drives it directly.
export function addWindToMaterial(material, { instanced = false, amount = 1, cutout = false } = {}) {
  const amountUniform = { value: amount };
  material.userData.windAmount = amountUniform;
  // Same onBeforeCompile source for every variant, so the cache key must
  // tell them apart or three.js would reuse the wrong compiled program.
  material.customProgramCacheKey = () => `wind-${instanced ? 'inst' : 'merged'}-${cutout ? 'cut' : 'solid'}`;
  material.onBeforeCompile = (shader) => {
    // Thin foliage is lit the same from both faces; three.js would otherwise
    // flip the normal on back faces and paint half of every blade black.
    shader.fragmentShader = shader.fragmentShader.replace(
      'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;',
    );
    if (cutout) {
      // Mipmapping averages a leaf texture's alpha away at a distance, so
      // far-off trees would go bald under alpha testing. Boost alpha by mip
      // level to keep their coverage.
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
        #ifdef USE_MAP
          vec2 texel = vMapUv * vec2(textureSize(map, 0));
          vec2 ddx = dFdx(texel), ddy = dFdy(texel);
          float mipLevel = max(0.0, 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy))));
          diffuseColor.a *= 1.0 + mipLevel * 0.35;
        #endif
        #include <alphatest_fragment>
      `);
    }
    Object.assign(shader.uniforms, windUniforms, { uSwayAmount: amountUniform });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nuniform float uSwayAmount;\n${instanced ? '' : 'attribute float aSway;'}`);
    if (instanced) {
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float bladeHeight = length(instanceMatrix[1].xyz);
        #else
          vec3 rootWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float bladeHeight = 1.0;
        #endif
        mvPosition.xz += windOffset(rootWorld, clamp(position.y, 0.0, 1.0)) * bladeHeight * uSwayAmount;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
    } else {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        transformed.xz += windOffset(transformed, aSway) * uSwayAmount;
      `);
    }
  };
  return material;
}
