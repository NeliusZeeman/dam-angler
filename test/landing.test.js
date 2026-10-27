import assert from 'node:assert';
import { createFightMotion, fightStyleFor } from '../src/fightMotion.js';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, HOOKS } from '../src/gear.js';
import { catchPayout } from '../src/economy.js';

const sp = (id) => FISH_SPECIES.find((s) => s.id === id);
// Reeds from 16 m out; the angler at the origin, the fish hooked at 12 m.
const coverAt = (x) => (x > 16 ? 'reeds' : null);

// holding: 'no' | 'pump' (wind half the time) | 'always'
function fight({ holding, rodLift, seconds = 20, seed = 1 }) {
  let s = seed;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const m = createFightMotion({ start: { x: 12, z: 0 }, rod: { x: 0, z: 0 }, style: fightStyleFor('largemouth-bass'), coverAt, seeksCover: true, rng });
  let snaggedAt = null;
  for (let t = 0; t < seconds; t += 0.05) {
    const h = holding === 'always' || (holding === 'pump' && (t * 10) % 10 < 5);
    const st = m.update(0.05, { progress: 0.3, holding: h, rodLift });
    if (st.snagged && snaggedAt === null) snaggedAt = t;
  }
  return { snaggedAt, motion: m };
}

{
  // Pumping it in with the rod low, a bass bolts for the reeds and gets
  // snagged; the same with the rod held up steers its head away.
  let low = 0, high = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (fight({ holding: 'pump', rodLift: 0, seed }).snaggedAt !== null) low++;
    if (fight({ holding: 'pump', rodLift: 1, seed }).snaggedAt !== null) high++;
  }
  assert.ok(low >= 20, `rod low, a bass finds the reeds (${low}/40)`);
  assert.ok(high < low * 0.4, `rod up steers it off (${high} vs ${low})`);
  console.log(`PASS: bass bolts for the reeds — snagged ${low}/40 with the rod low, ${high}/40 with it up`);
}

{
  // Snagged: hauling keeps it stuck, easing off lets it swim out.
  const { motion } = fight({ holding: 'no', rodLift: 0, seed: 3, seconds: 30 });
  let st = motion.state;
  if (!st.snagged) { for (let i = 0; i < 400 && !st.snagged; i++) st = motion.update(0.05, { progress: 0.3, holding: false }); }
  assert.ok(st.snagged, 'it got into the reeds');
  for (let i = 0; i < 100; i++) st = motion.update(0.05, { progress: 0.3, holding: true, rodLift: 1 });
  assert.ok(st.snagged, 'hauling on a snag gets nowhere');
  let freed = false;
  for (let i = 0; i < 600 && !freed; i++) { st = motion.update(0.05, { progress: 0.3, holding: false }); freed = st.freed; }
  assert.ok(freed, 'easing off, it swims out');
  console.log('PASS: snagged — hauling keeps it stuck, easing off frees it');
}

{
  // The net: a big fish waits at your feet until it's netted; a lively one bolts.
  const mg = createMinigame();
  let landed = false, failed = null;
  mg.start({ species: sp('common-carp'), weightKg: 3, rod: RODS[0], line: LINES[0], hook: HOOKS[0], needsNet: true, onSuccess: () => { landed = true; }, onFailure: (r) => { failed = r; } });
  for (let i = 0; i < 4000 && !mg.getState().netReady && mg.isActive(); i++) { mg.setHolding(i % 3 !== 0); mg.update(0.05); }
  assert.ok(mg.getState().netReady && !landed && !failed, 'beaten fish waits for the net');
  assert.strictEqual(mg.tryNet(false), 'bolted', 'a lively fish sees the net and bolts');
  assert.ok(!mg.getState().netReady && mg.isActive());
  for (let i = 0; i < 4000 && !mg.getState().netReady && mg.isActive(); i++) { mg.setHolding(i % 3 !== 0); mg.update(0.05); }
  assert.strictEqual(mg.tryNet(true), 'netted');
  assert.ok(landed, 'a calm fish goes in the net');
  console.log('PASS: the net — wait for it, net it calm, a lively one bolts');
}

{
  // Keep or release: keeping pays more, but never for a protected fish.
  const args = { weightKg: 3, rod: RODS[0], line: LINES[0], hook: HOOKS[0], catchId: '7a0c9c56-1b65-4a42-9a1f-6f6c1f3e2b11' };
  assert.ok(catchPayout({ ...args, species: sp('common-carp'), kept: true }) > catchPayout({ ...args, species: sp('common-carp') }));
  assert.strictEqual(catchPayout({ ...args, species: sp('largemouth-yellowfish'), kept: true }), catchPayout({ ...args, species: sp('largemouth-yellowfish') }));
  console.log('PASS: keep pays more; protected yellowfish can only be released');
}

console.log('All landing tests passed.');
