import assert from 'node:assert';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, HOOKS, REELS } from '../src/gear.js';
import { diagnoseLoss } from '../src/fightReport.js';

const byId = (list, id) => list.find((x) => x.id === id);
const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');
const tiger = FISH_SPECIES.find((f) => f.id === 'tigerfish');

// Fight a fish with a given drag; `strategy(state)` says whether to wind.
function fight({ species, weightKg, gear, drag, strategy, seconds = 120 }) {
  const mg = createMinigame();
  let result = null;
  let info = null;
  let maxRod = 0;
  mg.start({ species, weightKg, ...gear, drag, onSuccess: () => { result = 'landed'; }, onFailure: (r, i) => { result = r; info = i; } });
  for (let t = 0; t < seconds * 20 && mg.isActive(); t++) {
    mg.setHolding(strategy(mg.getState()));
    mg.update(0.05);
    maxRod = Math.max(maxRod, mg.getState().rodLoad);
  }
  return { result, info, maxRod };
}
const tally = (n, run) => {
  const out = {};
  for (let i = 0; i < n; i++) { const r = run().result || 'timeout'; out[r] = (out[r] || 0) + 1; }
  return out;
};

{
  // Winding flat out on a big carp: a sensible drag slips and saves the
  // line; a drag screwed down tight lets it snap.
  const gear = { rod: byId(RODS, 'rod-spinning'), line: byId(LINES, 'line-mono-12'), hook: byId(HOOKS, 'hook-carp-hair'), reel: byId(REELS, 'reel-spinning') };
  const loose = tally(40, () => fight({ species: carp, weightKg: 7, gear, drag: 0.15, strategy: () => true }));
  const tight = tally(40, () => fight({ species: carp, weightKg: 7, gear, drag: 0.8, strategy: () => true }));
  assert.ok(!loose['line-snapped'], `loose drag should slip, not snap (${JSON.stringify(loose)})`);
  assert.ok((tight['line-snapped'] || 0) > 30, `a locked-down drag snaps the line (${JSON.stringify(tight)})`);
  console.log(`PASS: drag slips before the line breaks (loose ${JSON.stringify(loose)}, tight ${JSON.stringify(tight)})`);
}

{
  // A jerky starter reel's drag sticks for a moment on a lunge -- winding
  // at a third drag, that's enough to part the line. A smooth big-pit
  // gives line cleanly.
  const base = { rod: byId(RODS, 'rod-spinning'), line: byId(LINES, 'line-mono-12'), hook: byId(HOOKS, 'hook-carp-hair') };
  const starter = tally(40, () => fight({ species: carp, weightKg: 7, gear: { ...base, reel: REELS[0] }, drag: 0.3, strategy: () => true }));
  const bigpit = tally(40, () => fight({ species: carp, weightKg: 7, gear: { ...base, reel: byId(REELS, 'reel-bigpit') }, drag: 0.3, strategy: () => true }));
  assert.ok((starter['line-snapped'] || 0) > (bigpit['line-snapped'] || 0) + 10, `smooth drag snaps less (starter ${JSON.stringify(starter)}, big pit ${JSON.stringify(bigpit)})`);
  console.log(`PASS: a smooth drag survives lunges a jerky one doesn't (starter ${JSON.stringify(starter)}, big pit ${JSON.stringify(bigpit)})`);
}

{
  // Heavy braid on a light rod: winding hard overloads the rod.
  const gear = { rod: byId(RODS, 'rod-kurper'), line: byId(LINES, 'line-braid-50'), hook: byId(HOOKS, 'hook-circle'), reel: REELS[0] };
  const { maxRod } = fight({ species: carp, weightKg: 6, gear, drag: 0.5, strategy: () => true, seconds: 5 });
  assert.ok(maxRod > 1, `a 3.5 kg rod is overloaded by a 6 kg carp on 22.7 kg braid (rod ${maxRod.toFixed(2)})`);
  console.log('PASS: the rod gauge shows an overloaded rod');
}

{
  // The loss report names the part that gave.
  const gear = { rod: RODS[0], reel: REELS[0], line: LINES[0], hook: HOOKS[0], weightKg: 4 };
  const snapTight = diagnoseLoss('line-snapped', { drag: 0.6, holding: false }, gear);
  assert.strictEqual(snapTight.parts.line.status, 'fail');
  assert.strictEqual(snapTight.parts.reel.status, 'fail', 'a tight drag is blamed');
  const snapStuck = diagnoseLoss('line-snapped', { drag: 0.33, stuckDrag: true }, gear);
  assert.strictEqual(snapStuck.parts.reel.status, 'fail', 'a sticky drag is blamed');
  const hook = diagnoseLoss('hook-straightened', { drag: 0.33, rodOverloaded: true }, gear);
  assert.strictEqual(hook.parts.hook.status, 'fail');
  assert.strictEqual(hook.parts.rod.status, 'fail', 'an overloaded rod is blamed');
  const jump = diagnoseLoss('threw-hook', { drag: 0.33 }, gear);
  assert.ok(jump.tip.includes('jumps'));
  for (const r of [snapTight, snapStuck, hook, jump]) {
    for (const p of Object.values(r.parts)) assert.ok(!/\dlb|\bft\b/.test(p.text), 'kg and metres only');
  }
  console.log('PASS: the loss report blames the right part');
}

console.log('All drag tests passed.');
