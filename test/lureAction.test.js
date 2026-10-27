import assert from 'node:assert';
import { retrieveFor, createActionTracker, scoreAction, actionBiteMultiplier } from '../src/lureAction.js';
import { LURES, getGearById } from '../src/gear.js';

const lure = (id) => getGearById(LURES, id);

// Plays a retrieve pattern for `seconds`: pattern(t) -> { speed, twitch }.
function play(pattern, seconds = 6) {
  const tr = createActionTracker();
  const dt = 1 / 60;
  let lastTwitch = -1;
  for (let t = 0; t < seconds; t += dt) {
    const p = pattern(t);
    const twitched = !!p.twitch && Math.floor(t / p.twitch) !== lastTwitch && (lastTwitch = Math.floor(t / p.twitch), true);
    tr.update(dt, { speed: p.speed, twitched });
  }
  return tr.features();
}

const steadyWind = () => ({ speed: 1.3 });
const reelFlatOut = () => ({ speed: 3.2 });
const sitStill = () => ({ speed: 0 });
// Lift and let it fall: a hop every 3 s, moving for half a second.
const hopAndDrop = (t) => ({ speed: t % 3 < 0.5 ? 1.2 : 0, twitch: 3 });
// Twitch-twitch-pause: two quick twitches, then 1.5 s still.
const twitchTwitchPause = (t) => ({ speed: t % 2.2 < 0.7 ? 0.9 : 0, twitch: (t % 2.2) < 0.7 ? 0.35 : 0 });

{
  assert.strictEqual(retrieveFor(lure('bread-bait')), null, 'bait just sits');
  assert.ok(retrieveFor(lure('crankbait')) && retrieveFor(lure('fly-dry')), 'lures and flies have a retrieve');
  console.log('PASS: lures and flies are worked, bait sits');
}

{
  const crank = retrieveFor(lure('crankbait'));
  const good = scoreAction(crank, play(steadyWind));
  const fast = scoreAction(crank, play(reelFlatOut));
  const dead = scoreAction(crank, play(sitStill));
  assert.ok(good.quality > 0.8, `steady wind works a crankbait (${good.quality})`);
  assert.ok(fast.quality < good.quality && fast.hint === 'Too fast', `reeling flat out is too fast (${fast.hint})`);
  assert.ok(dead.quality < 0.5, 'a crankbait left still is dead');
  console.log(`PASS: crankbait — steady ${good.quality.toFixed(2)}, flat out ${fast.quality.toFixed(2)} (${fast.hint}), still ${dead.quality.toFixed(2)}`);
}

{
  const jig = retrieveFor(lure('bass-jig'));
  const hop = scoreAction(jig, play(hopAndDrop, 7));
  const wound = scoreAction(jig, play(steadyWind));
  assert.ok(hop.quality > 0.75, `a jig hopped and let fall works (${hop.quality})`);
  assert.ok(wound.quality < hop.quality - 0.3, 'winding a jig in steadily is wrong');
  const minnow = retrieveFor(lure('rapala-minnow'));
  assert.ok(scoreAction(minnow, play(twitchTwitchPause, 7)).quality > 0.7, 'twitch-twitch-pause works a Rapala');
  const dry = retrieveFor(lure('fly-dry'));
  assert.ok(scoreAction(dry, play(sitStill)).quality > 0.9, 'a dry fly left still on a dead drift');
  assert.ok(scoreAction(dry, play(steadyWind)).quality < 0.4, 'a dry fly dragged across the top is wrong');
  console.log('PASS: jig hopped, Rapala twitched, dry fly dead-drifted');
}

{
  assert.ok(actionBiteMultiplier(0) < 0.5 && actionBiteMultiplier(1) > 2, 'bad action: few bites, good action: many');
  assert.ok(actionBiteMultiplier(0.5) > actionBiteMultiplier(0.2));
  console.log('PASS: better action, more bites');
}

console.log('All lure action tests passed.');
