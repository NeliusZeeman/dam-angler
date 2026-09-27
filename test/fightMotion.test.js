import assert from 'node:assert';
import { createFightMotion, fightStyleFor, FIGHT_STYLES } from '../src/fightMotion.js';
import { FISH_SPECIES } from '../src/fish.js';
import { makeRng } from '../src/gfx/noise.js';

const rod = { x: 0, z: 0 };
const water = (x, z) => z > 3; // bank along z = 3, water beyond

function fight(speciesId, { seconds = 30, holding = () => true, progressRate = 0.02, seed = 1 } = {}) {
  const m = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor(speciesId), isWater: water, rng: makeRng(seed) });
  let progress = 0, jumps = 0, path = 0, lastX = 0, lastZ = 30, minZ = Infinity, maxSide = 0;
  for (let t = 0; t < seconds; t += 0.05) {
    const h = holding(t);
    if (h) progress = Math.min(1, progress + progressRate * 0.05);
    const s = m.update(0.05, { progress, holding: h });
    if (s.jumpStarted) jumps++;
    path += Math.hypot(s.x - lastX, s.z - lastZ);
    lastX = s.x; lastZ = s.z;
    minZ = Math.min(minZ, s.z);
    maxSide = Math.max(maxSide, Math.abs(s.x));
  }
  return { state: m.state, jumps, path, minZ, maxSide };
}

{
  for (const s of FISH_SPECIES) assert.ok(FIGHT_STYLES[s.id], `${s.id} needs a fight style`);
  console.log('PASS: every species has its own fight style');
}

{
  // The line really moves: the fish swims about, off to the sides, instead
  // of sitting where it bit.
  const r = fight('common-carp', { seconds: 20 });
  assert.ok(r.path > 15, `hooked carp should cover real distance (swam ${r.path.toFixed(1)} m)`);
  assert.ok(r.maxSide > 2, `and run off to the side (${r.maxSide.toFixed(1)} m)`);
  assert.ok(r.minZ > 3, 'but never onto the bank');
  console.log(`PASS: a hooked fish swims and runs (${r.path.toFixed(0)} m in 20 s, ${r.maxSide.toFixed(1)} m to the side)`);
}

{
  // Reeling brings it in (against its runs).
  const reeled = fight('common-carp', { seconds: 40, progressRate: 0.03 });
  assert.ok(reeled.state.distance < 12, `reeled carp comes in (${reeled.state.distance.toFixed(1)} m)`);
  // Left alone it's free: it wanders in any direction -- often swimming
  // further away and taking line, sometimes coming back toward you.
  let further = 0, closer = 0, sawTakingLine = false;
  for (let seed = 1; seed <= 30; seed++) {
    const m = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor('common-carp'), isWater: water, rng: makeRng(seed) });
    for (let t = 0; t < 25; t += 0.05) { if (m.update(0.05, { progress: 0, holding: false }).takingLine) sawTakingLine = true; }
    if (m.state.distance > 33) further++;
    if (m.state.distance < 27) closer++;
  }
  assert.ok(further >= 5, `a free carp often swims away taking line (${further}/30)`);
  assert.ok(closer >= 2, `and sometimes wanders back toward you (${closer}/30)`);
  assert.ok(sawTakingLine, 'the game can tell when it is taking line');
  // A strong run strips line even while you reel.
  let stripped = false;
  const tiger = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor('tigerfish'), isWater: water, rng: makeRng(3) });
  for (let t = 0; t < 10 && !stripped; t += 0.05) stripped = tiger.update(0.05, { progress: 0, holding: true }).takingLine;
  assert.ok(stripped, 'a tigerfish run takes line against the drag');
  console.log(`PASS: reeling brings it in; left alone it swims anywhere (${further}/30 ran further out, ${closer}/30 came closer)`);
}

{
  // Jumpers: tigerfish jump a lot (first one within seconds); bass jump;
  // barbel and carp never do.
  const jumps = (id) => { let n = 0; for (let seed = 1; seed <= 20; seed++) n += fight(id, { seconds: 20, seed, holding: () => false }).jumps; return n / 20; };
  const tiger = jumps('tigerfish'), bass = jumps('largemouth-bass'), barbel = jumps('catfish'), carp = jumps('common-carp');
  assert.ok(tiger >= 2, `tigerfish jump often (${tiger} per 20 s)`);
  assert.ok(bass > 0.5 && bass < tiger, `bass jump, less than tigers (${bass})`);
  assert.strictEqual(barbel, 0, 'barbel never jump');
  assert.strictEqual(carp, 0, 'carp stay down');
  const first = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor('tigerfish'), isWater: water, rng: makeRng(4) });
  let t = 0; while (!first.update(0.05, {}).jumpStarted && t < 10) t += 0.05;
  assert.ok(t <= 3.6, `a tiger's first jump comes within seconds (${t.toFixed(1)} s)`);
  console.log(`PASS: jumpers jump (tiger ${tiger}, bass ${bass} per 20 s), barbel and carp stay down`);
}

{
  // In the air the fish is above the water; otherwise below it.
  const m = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor('tigerfish'), isWater: water, rng: makeRng(9) });
  let sawAir = false;
  for (let i = 0; i < 400; i++) {
    const s = m.update(0.05, {});
    if (s.jumping) { sawAir = sawAir || s.y > 0.2; } else assert.ok(s.y <= 0, 'fish is under water between jumps');
  }
  assert.ok(sawAir, 'a jump lifts the fish clear of the water');
  console.log('PASS: jumps clear the water, the rest of the time the fish is under');
}

{
  // Fully reeled, the fish comes right in to the angler -- as close as the
  // water allows (here the bank is at z = 3, the rod tip at z = 0).
  const m = createFightMotion({ start: { x: 4, z: 25 }, rod, style: fightStyleFor('common-carp'), isWater: water, rng: makeRng(2) });
  for (let t = 0; t < 30; t += 0.05) m.update(0.05, { progress: 1, holding: true });
  assert.ok(m.state.z < 5 && Math.abs(m.state.x) < 3, `reeled-in fish is at the bank by your feet (${m.state.x.toFixed(1)}, ${m.state.z.toFixed(1)})`);
  console.log(`PASS: a fully reeled fish is brought to your feet (${m.state.distance.toFixed(1)} m from the rod tip)`);
}

console.log('All fight motion tests passed.');

{
  // Drag decides how far a strong fish runs: set loose, a big barbel strips
  // line and ends up much further out; screwed down, it's stopped short.
  const far = (drag, holding = false, slipping = false) => {
    let total = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const m = createFightMotion({ start: { x: 0, z: 30 }, rod, style: fightStyleFor('catfish'), isWater: water, rng: makeRng(seed) });
      m.setStrength?.(1.6);
      for (let t = 0; t < 20; t += 0.05) m.update(0.05, { progress: 0.1, holding, drag, slipping });
      total += m.state.distance;
    }
    return total / 20;
  };
  const loose = far(0.1), usual = far(0.33), tight = far(0.7);
  assert.ok(loose > usual * 1.08 && usual > tight * 1.1, `loose ${loose.toFixed(1)} m > usual ${usual.toFixed(1)} m > tight ${tight.toFixed(1)} m`);
  // Winding against a slipping drag gains far less line than a holding one.
  const slip = far(0.1, true, true), grip = far(0.33, true, false);
  assert.ok(slip > grip + 3, `winding on a slipping drag: ${slip.toFixed(1)} m vs ${grip.toFixed(1)} m`);
  console.log(`PASS: a loose drag lets a strong fish take line (after 20 s: loose ${loose.toFixed(0)} m, usual ${usual.toFixed(0)} m, tight ${tight.toFixed(0)} m)`);
}
