import assert from 'node:assert';
import { planTake, judgeStrike, takeExpired, takeLook, hookupChance } from '../src/strike.js';
import { FISH_SPECIES } from '../src/fish.js';
import { LURES, HOOKS, REELS, getGearById } from '../src/gear.js';

const sp = (id) => FISH_SPECIES.find((s) => s.id === id);
const lure = (id) => getGearById(LURES, id);
const hook = (id) => getGearById(HOOKS, id);
const reel = (id) => getGearById(REELS, id);
const always = (v) => () => v;

{
  // Each fish and rig shows its take its own way.
  const kurper = planTake({ species: sp('mozambique-tilapia'), lure: lure('bread-bait'), hook: hook('hook-small') }, always(0.5));
  assert.strictEqual(kurper.type, 'dips');
  assert.ok(kurper.falseCues.length >= 1, 'kurper nibble before the float goes under');
  const carpBottom = planTake({ species: sp('common-carp'), lure: lure('boilies'), hook: hook('hook-carp-hair'), reel: reel('reel-starter') }, always(0.5));
  assert.strictEqual(carpBottom.type, 'run');
  const carpRunner = planTake({ species: sp('common-carp'), lure: lure('boilies'), hook: hook('hook-carp-hair'), reel: reel('reel-okuma-longbow-xr') }, always(0.5));
  assert.ok(carpRunner.window > carpBottom.window, 'a baitrunner gives more time on a run');
  const bass = planTake({ species: sp('largemouth-bass'), lure: lure('crankbait'), hook: hook('hook-small') }, always(0.5));
  assert.strictEqual(bass.type, 'hit');
  assert.strictEqual(bass.falseCues.length, 0);
  assert.ok(bass.window < carpBottom.window, 'a lure hit is quick, a carp run is generous');
  const barbel = planTake({ species: sp('catfish'), lure: lure('chicken-liver'), hook: hook('hook-circle') }, always(0.5));
  assert.strictEqual(barbel.type, 'pull');
  console.log('PASS: kurper nibble, carp run, bass hit, barbel pull — each its own take');
}

{
  // Timing decides it.
  const take = planTake({ species: sp('mozambique-tilapia'), lure: lure('bread-bait'), hook: hook('hook-small') }, always(0.5));
  const ctx = { species: sp('mozambique-tilapia'), hook: hook('hook-small'), lure: lure('bread-bait') };
  assert.strictEqual(judgeStrike(take, take.falseCues[0], ctx, always(0)), 'early', 'striking on a false nibble is too early');
  assert.strictEqual(judgeStrike(take, take.realAt + 0.1, ctx, always(0)), 'hooked');
  assert.strictEqual(judgeStrike(take, take.realAt + 0.1, ctx, always(0.99)), 'missed', 'even a good strike sometimes misses');
  assert.strictEqual(judgeStrike(take, take.end + 0.1, ctx, always(0)), 'late');
  assert.strictEqual(takeExpired(take, always(0.01)), 'dropped', 'a plain hook does not hook itself');
  console.log('PASS: too early, in time and too late');
}

{
  // Self-hooking rigs, circle hooks and tigers.
  const hair = planTake({ species: sp('common-carp'), lure: lure('boilies'), hook: hook('hook-carp-hair') }, always(0.5));
  assert.strictEqual(takeExpired(hair, always(0.5)), 'selfHooked', 'a hair rig hooks the carp if you wait');
  const circleCtx = { species: sp('catfish'), hook: hook('hook-circle'), lure: lure('chicken-liver') };
  assert.ok(hookupChance(circleCtx) < hookupChance({ ...circleCtx, hook: hook('hook-baitholder') }), 'striking a circle hook is worse than a J-hook');
  const circleTake = planTake(circleCtx, always(0.5));
  assert.ok(circleTake.selfHook > hookupChance(circleCtx), 'with a circle hook, just wind');
  const tiger = hookupChance({ species: sp('tigerfish'), hook: hook('hook-wire-trace'), lure: lure('chicken-liver') });
  const tigerLure = hookupChance({ species: sp('tigerfish'), hook: hook('hook-wire-trace'), lure: lure('spinner') });
  assert.ok(tiger < 0.6 && tigerLure > tiger, 'tigers are hard to hook; trebles help');
  console.log('PASS: hair rigs and circle hooks hook themselves; tigers are hard to hook');
}

{
  // What the float and rod tip do.
  const take = planTake({ species: sp('mozambique-tilapia'), lure: lure('bread-bait'), hook: hook('hook-small') }, always(0.5));
  const dip = takeLook(take, take.falseCues[0] + 0.17);
  assert.strictEqual(dip.cue, 'false');
  assert.ok(dip.sink < 0 && dip.sink > -0.08, 'a nibble just dips the float');
  const under = takeLook(take, take.realAt + 0.3);
  assert.strictEqual(under.cue, 'real');
  assert.ok(under.sink < -0.15, 'then it goes under');
  console.log('PASS: the float dips on a nibble and goes under on the take');
}

console.log('All strike tests passed.');
