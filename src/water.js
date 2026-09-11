import * as THREE from '../vendor/three.module.js';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 1.5 + uTime * 1.2) * 0.06 + cos(pos.y * 1.3 + uTime * 0.9) * 0.06;
    pos.z += wave;
    vec3 tangentX = normalize(vec3(1.0, 0.0, cos(pos.x * 1.5 + uTime * 1.2) * 1.5 * -0.06));
    vec3 tangentY = normalize(vec3(0.0, 1.0, sin(pos.y * 1.3 + uTime * 0.9) * 1.3 * -0.06));
    vec3 objectNormal = normalize(cross(tangentX, tangentY));
    vWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform float uTime;
  void main() {
    float ripple = sin((vUv.x + vUv.y) * 24.0 + uTime * 2.0) * 0.04;
    vec3 baseColor = uColor + ripple;

    vec3 worldNormal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(worldNormal, viewDir), 0.0, 1.0), 3.0);

    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(worldNormal, halfDir), 0.0), 60.0);
    vec3 glint = vec3(1.0, 0.98, 0.85) * spec * 1.5;

    vec3 skyTint = vec3(0.75, 0.9, 1.0) * fresnel * 0.5;
    vec3 color = baseColor + skyTint + glint;
    gl_FragColor = vec4(color, 0.9);
  }
`;

export function createWater(scene) {
  const geometry = new THREE.PlaneGeometry(70, 70, 96, 96);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x2f8ea3) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
    uCameraPos: { value: new THREE.Vector3() },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, transparent: true,
  });
  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, 0, -22);
  scene.add(waterMesh);

  const coldColor = new THREE.Color(0x1c4d73);
  const warmColor = new THREE.Color(0x2f8ea3);

  function setWaterTemperature(celsius) {
    const t = Math.min(1, Math.max(0, (celsius - 5) / 25));
    uniforms.uColor.value.copy(coldColor).lerp(warmColor, t);
  }

  return { waterMesh, setWaterTemperature, uniforms };
}

export function updateWater(waterMesh, elapsedSeconds, camera) {
  waterMesh.material.uniforms.uTime.value = elapsedSeconds;
  waterMesh.material.uniforms.uCameraPos.value.copy(camera.position);
}
