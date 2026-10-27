// The take and the strike. A bite no longer hooks the fish on its own: the
// fish takes the bait, shows it the way that fish and rig really do -- a
// kurper's nibbles before the float goes under, the rod tip knocking before
// a carp's run, a bass slamming a lure -- and the angler strikes. Too early
// pulls the bait away, too late and the fish drops it; hair rigs and circle
// hooks hook it themselves.

import { ENGINE } from './tuning/engine.js';
import { rigFor } from './gfx/terminalTackle.js';

// Hooks that set themselves, and how often, if the angler waits.
const SELF_HOOK = { 'hook-carp-hair': 'selfHookHair', 'hook-chod': 'selfHookHair', 'hook-circle': 'selfHookCircle' };

// Plans a take. `rand` (0..1) is injectable for tests.
export function planTake({ species, lure, hook, reel }, rand = Math.random) {
  const S = ENGINE.strike;
  const style = species.bite?.style || 'steady';
  const rig = rigFor(lure);
  const isLure = lure?.kind === 'lure';
  let type, falseCues = [], window;
  if (isLure || lure?.fly) {
    type = 'hit';
    window = lure?.fly ? S.flyWindow : S.lureWindow;
  } else if (rig === 'bottom') {
    if (style === 'heavy' && species.id !== 'mirror-carp' && species.id !== 'common-carp') {
      type = 'pull';
      falseCues = [0.5];
      window = S.pullWindow;
    } else {
      type = 'run';
      falseCues = rand() < 0.5 ? [0.4] : [0.4, 1.0];
      window = S.runWindow * (reel?.baitrunner ? 1.3 : 1);
    }
  } else if (style === 'nibble') {
    type = 'dips';
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) falseCues.push(0.35 + i * (0.45 + rand() * 0.3));
    window = S.nibbleWindow;
  } else if (style === 'aggressive') {
    type = 'under';
    window = S.floatWindow;
  } else {
    type = 'slide';
    falseCues = [0.45];
    window = S.slideWindow;
  }
  const realAt = (falseCues.length ? falseCues[falseCues.length - 1] : 0) + 0.45 + rand() * 0.5;
  return {
    type, falseCues, realAt, window, end: realAt + window,
    speciesId: species.id,
    selfHook: selfHookChance({ hook, lure, species }),
    baitrunner: !!reel?.baitrunner,
  };
}

function selfHookChance({ hook, lure }) {
  const S = ENGINE.strike;
  if (SELF_HOOK[hook?.id]) return S[SELF_HOOK[hook.id]];
  if (lure?.kind === 'lure' && !lure.fly) return S.selfHookTreble;
  return 0;
}

// The chance a well-timed strike sets the hook.
export function hookupChance({ species, hook, lure }) {
  const S = ENGINE.strike;
  if (hook?.id === 'hook-circle') return S.circleStrikeHookup; // striking pulls a circle hook out
  if (species.id === 'tigerfish') return Math.min(1, S.tigerHookup + (lure?.kind === 'lure' && !lure.fly ? 0.1 : 0));
  return S.hookup;
}

// The angler struck `t` seconds into the take: 'early', 'hooked' or 'missed'.
export function judgeStrike(take, t, ctx, rand = Math.random) {
  if (t < take.realAt) return 'early';
  if (t > take.end) return 'late';
  return rand() < hookupChance(ctx) ? 'hooked' : 'missed';
}

// Nobody struck and the window has passed: 'selfHooked' or 'dropped'.
export function takeExpired(take, rand = Math.random) {
  return rand() < take.selfHook ? 'selfHooked' : 'dropped';
}

// What the take looks like at time t, for the float, rod tip and line:
//   sink    metres the float is pulled down (negative)
//   drift   metres the float slides away from the rod
//   pull    how hard the line loads the rod tip (0..~0.3)
//   cue     'false' during a false bite, 'real' once it's on, null between
export function takeLook(take, t) {
  let sink = 0, drift = 0, pull = 0, cue = null;
  for (const c of take.falseCues) {
    const d = t - c;
    if (d >= 0 && d < 0.35) {
      const k = Math.sin((d / 0.35) * Math.PI);
      sink -= 0.05 * k;
      pull += 0.08 * k;
      cue = 'false';
    }
  }
  if (t >= take.realAt) {
    cue = 'real';
    const d = t - take.realAt;
    const k = Math.min(1, d / 0.2);
    if (take.type === 'dips' || take.type === 'under' || take.type === 'hit') { sink = -0.22 * k; pull = 0.22 * k; }
    else if (take.type === 'slide') { sink = -0.06 * k; drift = d * 0.6; pull = 0.15 * k; }
    else if (take.type === 'run') { pull = 0.28 * k; drift = d * 1.2; }
    else if (take.type === 'pull') { pull = 0.22 * k; drift = d * 0.4; }
  }
  return { sink, drift, pull, cue };
}
