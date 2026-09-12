import * as THREE from '../vendor/three.module.js';

// Three.js geometry builders driven by a pond shape's radiusAt(theta), kept
// separate from pondShape.js so that file stays pure math (Node-testable,
// no Three.js dependency).

// A filled disc whose edge follows radiusAt(theta) -- used for the water
// surface and the pond bed.
export function buildShapedDiscGeometry(radiusAt, segments = 96) {
  const positions = [0, 0, 0];
  const uvs = [0.5, 0.5];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = radiusAt(theta);
    positions.push(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
  }
  const indices = [];
  for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A ring between two radius profiles (e.g. radiusAt(theta)+innerOffset and
// radiusAt(theta)+outerOffset) -- used for the bank, waterline, shore and
// tree bands so they all follow the same irregular shoreline.
export function buildShapedRingGeometry(radiusAt, innerOffset, outerOffset, segments = 96) {
  const positions = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const base = radiusAt(theta);
    const rInner = base + innerOffset;
    const rOuter = base + outerOffset;
    positions.push(Math.cos(theta) * rInner, 0, Math.sin(theta) * rInner);
    positions.push(Math.cos(theta) * rOuter, 0, Math.sin(theta) * rOuter);
    const v = i / segments;
    uvs.push(0, v, 1, v);
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
