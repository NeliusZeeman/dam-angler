import * as THREE from '../vendor/three.module.js';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function createGrassTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#3c5c2e';
  ctx.fillRect(0, 0, size, size);

  const blades = ['#4a7038', '#345226', '#557a3f', '#2e4a22'];
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 4;
    ctx.strokeStyle = blades[i % blades.length];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWoodTexture() {
  const width = 256;
  const height = 256;
  const canvas = makeCanvas(width);
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6b4a2c';
  ctx.fillRect(0, 0, width, height);

  const plankHeight = height / 5;
  for (let p = 0; p < 5; p++) {
    const y0 = p * plankHeight;
    ctx.fillStyle = p % 2 === 0 ? '#6f4d2e' : '#664628';
    ctx.fillRect(0, y0, width, plankHeight);

    for (let g = 0; g < 6; g++) {
      const gy = y0 + Math.random() * plankHeight;
      ctx.strokeStyle = 'rgba(40, 24, 10, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= width; x += 16) {
        ctx.lineTo(x, gy + (Math.random() - 0.5) * 3);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(20, 12, 5, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(width, y0);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSkyDome(scene) {
  const skyGeo = new THREE.SphereGeometry(200, 24, 16);
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x4a90d9) },
    bottomColor: { value: new THREE.Color(0xcfeeff) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        // Keep the horizon band in the bottom color and fade to the top
        // color by ~35 degrees up, so sunsets read as a gold band under a
        // darker sky rather than one flat wall of colour.
        float t = clamp(h * 1.6 + 0.08, 0.0, 1.0);
        t = t * t * (3.0 - 2.0 * t);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  return { sky, skyUniforms };
}

export function createSunGlow() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,250,230,1)');
  gradient.addColorStop(0.25, 'rgba(255,244,200,0.6)');
  gradient.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(40, 40, 1);
  return sprite;
}

// Seven stages across the day. "sunset" and "lateTwilight" are lifted
// straight from the two art-direction prototypes ("Sunset Angler" warm
// plum-to-gold, "Twilight Waters" indigo-to-rose); the rest interpolate
// a believable dawn-to-night arc around them.
export const TIME_OF_DAY_SKY = {
  morning: { top: 0x6f9fd8, bottom: 0xffd9b0 },
  midMorning: { top: 0x4a97dd, bottom: 0xdff0ff },
  midday: { top: 0x3f8fdc, bottom: 0xdcf3ff },
  afternoon: { top: 0x4a8ecf, bottom: 0xffe3b8 },
  sunset: { top: 0x241536, bottom: 0xffcf7a },
  lateTwilight: { top: 0x1b2140, bottom: 0xff9d72 },
  night: { top: 0x0a0e1c, bottom: 0x1b2140 },
};

export function setSkyColors(skyUniforms, timeOfDay) {
  const palette = TIME_OF_DAY_SKY[timeOfDay] || TIME_OF_DAY_SKY.midday;
  skyUniforms.topColor.value.set(palette.top);
  skyUniforms.bottomColor.value.set(palette.bottom);
}
