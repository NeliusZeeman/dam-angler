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
  const geometry = new THREE.PlaneGeometry(70, 70, 64, 64);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x3c8f5c) },
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

  return { waterMesh, setWaterTemperature };
}

export function updateWater(waterMesh, elapsedSeconds) {
  waterMesh.material.uniforms.uTime.value = elapsedSeconds;
}
