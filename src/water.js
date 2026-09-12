import * as THREE from '../vendor/three.module.js';
import { POND_CENTER, WATER_RADIUS, WATER_EDGE_RADIUS } from './pond.js';

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
  uniform float uRadius;
  uniform vec3 uCenter;
  void main() {
    float ripple = sin((vUv.x + vUv.y) * 24.0 + uTime * 2.0) * 0.04;
    vec3 baseColor = uColor + ripple;

    // Shallows: the last few metres before the bank go lighter and sandier,
    // so the water's edge reads clearly against the grass.
    float distFromCenter = length(vWorldPos.xz - uCenter.xz);
    float shallow = smoothstep(uRadius - 4.5, uRadius - 0.3, distFromCenter);
    baseColor = mix(baseColor, vec3(0.62, 0.72, 0.62), shallow * 0.55);

    vec3 worldNormal = normalize(vWorldNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(worldNormal, viewDir), 0.0, 1.0), 3.0);

    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(worldNormal, halfDir), 0.0), 60.0);
    vec3 glint = vec3(1.0, 0.98, 0.85) * spec * 1.5;

    vec3 skyTint = vec3(0.75, 0.9, 1.0) * fresnel * 0.5;
    vec3 color = baseColor + skyTint + glint;
    // Translucent enough to see fish moving just under the surface, and
    // thinner still in the shallows.
    gl_FragColor = vec4(color, 0.74 + fresnel * 0.2 - shallow * 0.18);
  }
`;

export function createWater(scene, { coldColor: coldHex = 0x1c4d73, warmColor: warmHex = 0x2f8ea3 } = {}) {
  const geometry = new THREE.CircleGeometry(WATER_RADIUS, 96, 0, Math.PI * 2);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(warmHex) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
    uCameraPos: { value: new THREE.Vector3() },
    uRadius: { value: WATER_EDGE_RADIUS }, // shallows fade toward the real (sand) edge
    uCenter: { value: POND_CENTER.clone() },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, transparent: true,
  });
  const waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.copy(POND_CENTER);
  scene.add(waterMesh);

  const coldColor = new THREE.Color(coldHex);
  const warmColor = new THREE.Color(warmHex);

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

export function setWaterSunDirection(waterMesh, direction) {
  waterMesh.material.uniforms.uSunDir.value.copy(direction).normalize();
}

// Splash: an expanding, fading ripple ring plus a handful of flung droplets,
// spawned where the cast lure hits the water.
export function createSplashEffect(scene) {
  const active = [];

  function spawn(point) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.12, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9c2, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(point);
    ring.position.y = 0.02;
    ring.userData.age = 0;
    ring.userData.kind = 'ring';
    scene.add(ring);
    active.push(ring);

    for (let i = 0; i < 8; i++) {
      const droplet = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
      );
      const angle = (i / 8) * Math.PI * 2;
      droplet.position.copy(point);
      droplet.position.y = 0.04;
      droplet.userData.age = 0;
      droplet.userData.kind = 'droplet';
      droplet.userData.vx = Math.cos(angle) * (0.5 + Math.random() * 0.4);
      droplet.userData.vz = Math.sin(angle) * (0.5 + Math.random() * 0.4);
      droplet.userData.vy = 1.0 + Math.random() * 0.5;
      scene.add(droplet);
      active.push(droplet);
    }
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
        const t = obj.userData.age / 1.0;
        const r = 0.1 + t * 1.2;
        obj.geometry.dispose();
        obj.geometry = new THREE.RingGeometry(r, r + 0.04, 32);
        obj.material.opacity = Math.max(0, 0.6 * (1 - t));
        if (t >= 1) {
          scene.remove(obj);
          obj.geometry.dispose();
          obj.material.dispose();
          active.splice(i, 1);
        }
      }
    }
  }

  return { spawn, update };
}
