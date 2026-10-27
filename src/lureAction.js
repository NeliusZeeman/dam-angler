// Working a lure. Each lure has a retrieve that brings it to life -- a
// crankbait wound steady, a jig hopped and let fall, a frog walked with long
// pauses, a streamer stripped -- and the angler's winding, twitches and
// pauses are scored against it: 0 (dead, wrong) .. 1 (just right). Good
// action brings more bites and fish following the lure in.

import { ENGINE } from './tuning/engine.js';

// The retrieve each lure wants.
//   speed     [min, max] m/s while it's moving
//   moving    [min, max] share of the time it should be moving
//   twitches  [min, max] twitches in the last WINDOW seconds
//   pause     the longest stop wanted in the window (seconds), or 0
export const RETRIEVES = {
  steady: { label: 'steady wind', speed: [0.6, 2.2], moving: [0.75, 1], twitches: [0, 1], pause: 0 },
  steadyPause: { label: 'steady, with the odd pause', speed: [0.6, 2.4], moving: [0.45, 0.85], twitches: [0, 2], pause: 0.8 },
  twitchPause: { label: 'twitch-twitch-pause', speed: [0.3, 2.5], moving: [0.1, 0.6], twitches: [2, 6], pause: 1 },
  hop: { label: 'hop it, let it sink', speed: [0.2, 2.5], moving: [0, 0.45], twitches: [1, 3], pause: 1.5 },
  walk: { label: 'short twitches, long pauses', speed: [0.2, 2.5], moving: [0, 0.4], twitches: [2, 7], pause: 1 },
  strip: { label: 'strip it in short tugs', speed: [0.2, 2.5], moving: [0, 0.5], twitches: [2, 7], pause: 0.4 },
  slowStrip: { label: 'slow, small strips', speed: [0.1, 1.2], moving: [0, 0.35], twitches: [1, 4], pause: 1 },
  dead: { label: 'leave it still', speed: [0, 0.4], moving: [0, 0.15], twitches: [0, 0], pause: 3 },
};

const BY_LURE = {
  crankbait: 'steady', spinner: 'steady', 'spoon-lure': 'steadyPause', 'rapala-minnow': 'twitchPause',
  'soft-plastic': 'hop', 'bass-jig': 'hop', 'topwater-frog': 'walk',
  'fly-streamer': 'strip', 'fly-walkers-killer': 'strip', 'fly-damsel': 'strip',
  'fly-nymph': 'slowStrip', 'fly-zak': 'slowStrip', 'fly-dry': 'dead',
};

// The retrieve for a lure, or null for bait (bait is left to sit).
export function retrieveFor(lure) {
  if (!lure || (lure.kind !== 'lure' && !lure.fly)) return null;
  return RETRIEVES[BY_LURE[lure.id] || (lure.fly ? 'strip' : 'steady')];
}

const WINDOW = 5; // seconds of retrieve looked at
const STEP = 0.1;

// Keeps the last few seconds of the retrieve and scores it.
export function createActionTracker() {
  const samples = []; // { speed, twitch } every STEP seconds
  let acc = 0, twitchPending = false, speedAcc = 0, speedN = 0;
  return {
    // speed: how fast the lure is moving (m/s); twitched: a twitch this frame.
    update(dt, { speed, twitched }) {
      if (twitched) twitchPending = true;
      acc += dt; speedAcc += speed * dt; speedN += dt;
      while (acc >= STEP) {
        acc -= STEP;
        samples.push({ speed: speedN > 0 ? speedAcc / speedN : speed, twitch: twitchPending });
        twitchPending = false; speedAcc = 0; speedN = 0;
        if (samples.length > WINDOW / STEP) samples.shift();
      }
    },
    reset() { samples.length = 0; acc = 0; twitchPending = false; speedAcc = 0; speedN = 0; },
    features: () => features(samples),
  };
}

function features(samples) {
  const n = samples.length;
  if (!n) return { seconds: 0, moving: 0, speed: 0, twitches: 0, longestPause: 0 };
  let moving = 0, speedSum = 0, twitches = 0, run = 0, longestPause = 0;
  for (const s of samples) {
    const isMoving = s.speed > 0.25;
    if (isMoving) { moving++; speedSum += s.speed; run = 0; } else { run += STEP; longestPause = Math.max(longestPause, run); }
    if (s.twitch) { twitches++; run = 0; }
  }
  return { seconds: n * STEP, moving: moving / n, speed: moving ? speedSum / moving : 0, twitches, longestPause };
}

// How far x is outside [lo, hi], as a 0..1 penalty over `soft`.
const outside = (x, lo, hi, soft) => (x < lo ? Math.min(1, (lo - x) / soft) : x > hi ? Math.min(1, (x - hi) / soft) : 0);

// Scores a retrieve: { quality 0..1, hint }. Needs ~2 s of retrieve first.
export function scoreAction(retrieve, f) {
  if (!retrieve) return { quality: 1, hint: '' };
  if (f.seconds < 2) return { quality: 0.5, hint: 'Work the lure' };
  const checks = [];
  // Too fast / too slow (only judged while it's moving).
  if (f.moving > 0.1) {
    const p = outside(f.speed, retrieve.speed[0], retrieve.speed[1], 1);
    if (p) checks.push({ p, hint: f.speed > retrieve.speed[1] ? 'Too fast' : 'Too slow' });
  }
  const pm = outside(f.moving, retrieve.moving[0], retrieve.moving[1], 0.35);
  if (pm) checks.push({ p: pm, hint: f.moving > retrieve.moving[1] ? (retrieve.pause ? 'Let it pause' : 'Too much winding') : retrieve.twitches[1] === 0 ? 'Leave it still' : 'Keep it moving' });
  const pt = outside(f.twitches, retrieve.twitches[0], retrieve.twitches[1], 2);
  if (pt) checks.push({ p: pt, hint: f.twitches < retrieve.twitches[0] ? 'Twitch it' : 'Fewer twitches' });
  if (retrieve.pause && f.longestPause < retrieve.pause) checks.push({ p: Math.min(1, (retrieve.pause - f.longestPause) / retrieve.pause) * 0.8, hint: 'Let it pause' });
  const worst = checks.sort((a, b) => b.p - a.p)[0];
  const penalty = checks.reduce((s, c) => s + c.p, 0);
  const quality = Math.max(0, Math.min(1, 1 - penalty * 0.55));
  return { quality, hint: worst ? worst.hint : 'Good action' };
}

// Bites while working a lure: a dead or wrong retrieve gets a third of the
// bites, a perfect one two and a half times as many (tunable).
export function actionBiteMultiplier(quality) {
  const L = ENGINE.lures;
  return L.badBites + (L.bestBites - L.badBites) * Math.pow(Math.max(0, Math.min(1, quality)), 1.5);
}
