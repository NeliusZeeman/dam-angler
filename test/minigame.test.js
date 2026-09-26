import assert from 'node:assert';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, HOOKS } from '../src/gear.js';
import { fightStamina } from '../src/fightMotion.js';

const starter = { rod: RODS[0], line: LINES[0], hook: HOOKS[0] };

function runFight({ species, weightKg, gear = starter, strategy, maxTicks = 600 }) {
  const mg = createMinigame();
  let result = null;
  mg.start({
    species, weightKg, ...gear,
    onSuccess: () => { result = 'success'; },
    onFailure: (reason) => { result = reason; },
  });
  let ticks = 0;
  while (mg.isActive() && ticks < maxTicks) {
    mg.setHolding(strategy(mg.getState()));
    mg.update(0.05);
    ticks++;
  }
  return { result, ticks };
}

const tilapia = FISH_SPECIES.find((f) => f.id === 'mozambique-tilapia');
const tigerfish = FISH_SPECIES.find((f) => f.id === 'tigerfish');
const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');

{
  // The intuitive thing -- reel, ease off when the bar runs high -- lands
  // an easy fish on starter gear.
  const { result } = runFight({
    species: tilapia, weightKg: 0.8,
    strategy: (s) => s.tension < 0.7,
  });
  assert.strictEqual(result, 'success', `expected sensible reeling to land a tilapia, got ${result}`);
  console.log('PASS: reel-and-ease-off lands a common fish on starter gear');
}

{
  // Holding the whole way on a big aggressive fish with starter line snaps it.
  const { result } = runFight({
    species: tigerfish, weightKg: 6,
    strategy: () => true,
  });
  // Starter gear fails: the 10lb line snaps or the size-10 hook opens up.
  assert.ok(['line-snapped', 'hook-straightened'].includes(result), `expected a held-down tigerfish to break the starter gear, got ${result}`);
  console.log('PASS: never easing off on a big aggressive fish snaps the line');
}

{
  // Never reeling at all: the fish throws the hook.
  const { result } = runFight({
    species: carp, weightKg: 3,
    strategy: () => false,
  });
  assert.strictEqual(result, 'fish-escaped', `expected a never-reeled fish to escape, got ${result}`);
  console.log('PASS: never reeling lets the fish escape');
}

{
  // Same big tigerfish, but with the heavy rod, 30lb leader and wire trace:
  // the ease-off strategy now lands it.
  const { result } = runFight({
    species: tigerfish, weightKg: 6,
    gear: { rod: RODS.find((r) => r.id === 'rod-heavy'), line: LINES[2], hook: HOOKS.find((h) => h.isWireTrace) },
    strategy: (s) => s.tension < 0.7,
  });
  assert.strictEqual(result, 'success', `expected top gear to land a big tigerfish, got ${result}`);
  console.log('PASS: top-tier gear makes a big tigerfish landable');
}

{
  // Jumps: reel through them and the fish often throws the hook; ease off
  // (drop the rod tip) and it's safe -- and the pause isn't counted as slack.
  const tiger = FISH_SPECIES.find((s) => s.id === 'tigerfish');
  const gear = { rod: RODS.find((r) => r.id === 'rod-heavy'), line: LINES[2], hook: HOOKS.find((h) => h.isWireTrace) };
  // Keep reeling for the first `heldFor` seconds of a 1 s jump, then ease off.
  const outcome = (heldFor) => {
    const counts = {};
    for (let n = 0; n < 300; n++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: tiger, weightKg: 2, ...gear, onSuccess: () => { result = 'ok'; }, onFailure: (r) => { result = r; } });
      mg.jump(1.0);
      for (let t = 0; t < 1.1 && !result; t += 0.05) {
        mg.setHolding(t < heldFor);
        mg.update(0.05);
      }
      counts[result || 'on'] = (counts[result || 'on'] || 0) + 1;
    }
    return counts;
  };
  const halfJump = outcome(0.5), easedOff = outcome(0);
  const thrown = (halfJump['threw-hook'] || 0) / 300;
  assert.ok(thrown > 0.2, `reeling through half a jump often throws the hook (${thrown})`);
  assert.strictEqual(easedOff.on, 300, 'easing off during a jump keeps the fish on every time');
  console.log(`PASS: reel through a jump and the fish throws the hook ${Math.round(thrown * 100)}% of the time; ease off and it stays on`);
}

{
  // A fish running off against the drag keeps the line tight: not reeling
  // while it runs doesn't lose it. Slack only counts when it isn't pulling.
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  const run = (pulling) => {
    const mg = createMinigame();
    let result = null;
    mg.start({ species: carp, weightKg: 2, ...starter, onSuccess: () => { result = 'ok'; }, onFailure: (r) => { result = r; } });
    mg.setFishPulling(pulling);
    for (let t = 0; t < 8 && !result; t += 0.05) mg.update(0.05);
    return result;
  };
  assert.strictEqual(run(true), null, 'a running fish stays on while you let it take line');
  assert.strictEqual(run(false), 'fish-escaped', 'a slack line with nothing pulling still loses the fish');
  console.log('PASS: letting a fish run is safe; a truly slack line still loses it');
}

{
  // Stamina: a big carp takes much longer to tire than a kurper.
  const timeToTire = (id, weightKg) => {
    const species = FISH_SPECIES.find((s) => s.id === id);
    const mg = createMinigame();
    let done = false;
    mg.start({ species, weightKg, ...starter, stamina: fightStamina(id, weightKg), onSuccess: () => { done = true; }, onFailure: () => { done = true; } });
    let t = 0;
    for (; t < 300 && !done; t += 0.05) { mg.setHolding(mg.getState().tension < 0.45); mg.update(0.05); }
    return t;
  };
  const kurper = timeToTire('mozambique-tilapia', 0.8), carp = timeToTire('common-carp', 5);
  assert.ok(carp > kurper * 2, `a 5kg carp should fight far longer than a kurper (${carp.toFixed(0)}s vs ${kurper.toFixed(0)}s)`);
  console.log(`PASS: carp fight longer (5kg carp ${carp.toFixed(0)}s, kurper ${kurper.toFixed(0)}s of reeling)`);
}

{
  // Better line and hooks don't break under load. A 9kg barbel reeled
  // flat-out: starter gear fails, 30lb J-Braid on a circle hook holds.
  const barbel = FISH_SPECIES.find((s) => s.id === 'catfish');
  const byId = (list, id) => list.find((g) => g.id === id);
  const flatOut = (gear) => {
    const counts = {};
    for (let n = 0; n < 100; n++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: barbel, weightKg: 9, ...gear, stamina: fightStamina('catfish', 9), onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
      mg.setHolding(true);
      for (let t = 0; t < 120 && !result; t += 0.05) mg.update(0.05);
      counts[result] = (counts[result] || 0) + 1;
    }
    return counts;
  };
  const weak = flatOut({ rod: RODS[0], line: byId(LINES, 'line-starter'), hook: byId(HOOKS, 'hook-baitholder') });
  const strong = flatOut({ rod: RODS.find((r) => r.id === 'rod-carp'), line: byId(LINES, 'line-jbraid-30'), hook: byId(HOOKS, 'hook-circle') });
  assert.ok((weak.landed || 0) === 0, `starter gear can't take a barbel flat-out (${JSON.stringify(weak)})`);
  assert.ok((strong.landed || 0) >= 95, `30lb J-Braid and a circle hook can (${JSON.stringify(strong)})`);
  // A 6kg carp hauled hard on light line: the fine-wire size 10 opens up,
  // a size-6 hair rig never does.
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  const haul = (hookId) => {
    let opened = 0;
    for (let n = 0; n < 200; n++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: carp, weightKg: 6, rod: RODS[0], line: byId(LINES, 'line-starter'), hook: byId(HOOKS, hookId), onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
      mg.setHolding(true);
      for (let t = 0; t < 6 && !result; t += 0.05) mg.update(0.05);
      if (result === 'hook-straightened') opened++;
    }
    return opened;
  };
  assert.ok(haul('hook-small') > 0, 'a size-10 fine-wire hook can open up on a 6kg carp');
  assert.strictEqual(haul('hook-carp-hair'), 0, 'a size-6 hair rig never opens on a 6kg carp');
  console.log(`PASS: strong line and hooks hold (barbel flat-out: starter ${JSON.stringify(weak)}, J-Braid ${JSON.stringify(strong)})`);
}

{
  // Winning all the line isn't a catch: the fish must be at your feet.
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  let atFeet = false, result = null;
  const mg = createMinigame();
  mg.start({ species: carp, weightKg: 1.5, ...starter, canLand: () => atFeet, onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
  // Reel in pulses until all the line is in.
  for (let t = 0; t < 60 && mg.getState().progress < 1 && !result; t += 0.05) {
    mg.setHolding(mg.getState().tension < 0.5);
    mg.update(0.05);
  }
  mg.setHolding(false);
  mg.update(0.05);
  assert.strictEqual(result, null, 'fish still out in the water -- not caught yet');
  assert.ok(mg.getState().landingBlocked, 'the game knows it is waiting on you to get to the fish');
  atFeet = true;
  mg.setHolding(true);
  mg.update(0.05);
  assert.strictEqual(result, 'landed', 'once it is at your feet, it is landed');
  console.log('PASS: a fish is only landed once it is brought in to you');
}

console.log('All minigame tests passed.');
