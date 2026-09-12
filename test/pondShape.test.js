import assert from 'node:assert';
import { createPondShape } from '../src/pondShape.js';

{
  const round = createPondShape({ seedStr: 'a', baseRadius: 20, coves: [], wobble: 0 });
  for (const theta of [0, 1, 2, 3, 4, 5, 6]) {
    assert.ok(Math.abs(round.radiusAt(theta) - 20) < 1e-6, 'zero wobble/no coves should be a perfect circle');
  }
  console.log('PASS: zero wobble and no coves gives a perfect circle');
}

{
  const shape = createPondShape({ seedStr: 'wobbly', baseRadius: 20, coves: [], wobble: 1.5 });
  const radii = [0, 1, 2, 3, 4, 5].map((t) => shape.radiusAt(t));
  const varied = radii.some((r) => Math.abs(r - radii[0]) > 0.05);
  assert.ok(varied, 'expected the ambient wobble to vary the radius by angle');
  console.log('PASS: ambient wobble produces an irregular (non-circular) shoreline');
}

{
  // Same seed -> same shape, every time (needed so reloads don't reshuffle
  // the dam under the player).
  const a = createPondShape({ seedStr: 'jozini', baseRadius: 22, coves: [{ angle: 1, width: 1, pull: 3 }] });
  const b = createPondShape({ seedStr: 'jozini', baseRadius: 22, coves: [{ angle: 1, width: 1, pull: 3 }] });
  for (const theta of [0, 0.5, 1, 2, 4]) {
    assert.strictEqual(a.radiusAt(theta), b.radiusAt(theta));
  }
  console.log('PASS: the same seed always produces the same shape');
}

{
  const cove = { angle: Math.PI, width: 0.6, pull: 4, density: 1 };
  const shape = createPondShape({ seedStr: 's', baseRadius: 20, coves: [cove], wobble: 0 });
  assert.ok(shape.radiusAt(Math.PI) < 20 - 3.9, 'expected the cove centre to pull the radius in sharply');
  assert.ok(Math.abs(shape.radiusAt(0) - 20) < 0.05, 'expected the far side (outside the cove) to be untouched');
  console.log('PASS: a cove pulls the water radius in near its centre, and leaves the rest alone');
}

{
  const cove = { angle: 0, width: 0.8, pull: 3, density: 1 };
  const shape = createPondShape({ seedStr: 's2', baseRadius: 20, coves: [cove], wobble: 0 });
  assert.strictEqual(shape.zoneAt(0).type, 'structure');
  assert.ok(shape.zoneAt(0).density > 0.9, 'expected full density at the cove centre');
  assert.strictEqual(shape.zoneAt(Math.PI).type, 'open');
  assert.strictEqual(shape.zoneAt(Math.PI).density, 0);
  console.log('PASS: zoneAt reports structure inside a cove and open water elsewhere');
}

{
  const shape = createPondShape({ seedStr: 's3', baseRadius: 20, coves: [], wobble: 0 });
  const centre = shape.depthFactorAt(0, 0);
  const edge = shape.depthFactorAt(0, 20);
  const mid = shape.depthFactorAt(0, 10);
  assert.ok(centre > edge, 'expected depth factor to be higher at the centre than the edge');
  assert.ok(Math.abs(centre - 1) < 1e-6);
  assert.ok(Math.abs(edge - 0) < 1e-6);
  assert.ok(mid > 0.4 && mid < 0.6);
  console.log('PASS: depthFactorAt runs from 0 at the edge to 1 at the centre');
}

console.log('All pondShape tests passed.');
