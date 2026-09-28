import assert from 'node:assert';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES, TROPHY_CHANCE, trophyWeightFor } from '../src/fish.js';
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
  // A big carp hauled hard in the red on strong line (so the line isn't the
  // weak link): the fine-wire size 10 opens up, a size-6 hair rig never does.
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  const haul = (hookId) => {
    let opened = 0;
    for (let n = 0; n < 200; n++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: carp, weightKg: 7.6, rod: RODS[0], line: byId(LINES, 'line-jbraid-30'), hook: byId(HOOKS, hookId), onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
      mg.setHolding(true);
      for (let t = 0; t < 6 && !result; t += 0.05) mg.update(0.05);
      if (result === 'hook-straightened') opened++;
    }
    return opened;
  };
  assert.ok(haul('hook-small') > 50, 'a size-10 fine-wire hook often opens on a big carp hauled in the red (~45%)');
  assert.strictEqual(haul('hook-carp-hair'), 0, 'a size-6 hair rig never opens on it');
  console.log(`PASS: strong line and hooks hold (barbel flat-out: starter ${JSON.stringify(weak)}, J-Braid ${JSON.stringify(strong)})`);
}

{
  // The big one: a 1-in-300 trophy snaps even 30lb braid if you haul on it,
  // but played carefully -- reel between its runs, let it run against the
  // drag -- it can be landed. And bigger fish fight longer on any gear.
  const carp = FISH_SPECIES.find((s) => s.id === 'common-carp');
  assert.ok(Math.abs(TROPHY_CHANCE - 1 / 300) < 1e-9, 'a trophy is about 1 bite in 300');
  const trophyKg = trophyWeightFor(carp, () => 0.5);
  assert.ok(trophyKg > carp.maxWeightKg * 1.5, `a trophy is far over the usual maximum (${trophyKg.toFixed(1)} kg)`);
  const top = { rod: RODS.find((r) => r.id === 'rod-carp'), line: LINES.find((l) => l.id === 'line-jbraid-30'), hook: HOOKS.find((h) => h.id === 'hook-carp-hair') };
  const fight = (weightKg, careful) => {
    const counts = {};
    let total = 0;
    for (let n = 0; n < 100; n++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: carp, weightKg, ...top, stamina: fightStamina('common-carp', weightKg), onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
      let t = 0, run = 0, runOn = false;
      for (; t < 600 && !result; t += 0.05) {
        run -= 0.05;
        if (run <= 0) { runOn = !runOn; run = runOn ? 1 + Math.random() * 2 : 1.5 + Math.random() * 3; }
        const hold = careful ? (!runOn && mg.getState().tension < 0.68) : true;
        mg.setFishPulling(runOn && !hold);
        mg.setHolding(hold);
        mg.update(0.05);
      }
      total += t;
      counts[result] = (counts[result] || 0) + 1;
    }
    return { counts, avg: total / 100 };
  };
  const hauled = fight(trophyKg, false), played = fight(trophyKg, true);
  assert.ok((hauled.counts.landed || 0) === 0, `hauling a trophy breaks even top gear (${JSON.stringify(hauled.counts)})`);
  assert.ok((played.counts.landed || 0) >= 90, `playing it carefully lands it (${JSON.stringify(played.counts)})`);
  const small = fight(1.2, true).avg, full = fight(7.8, true).avg;
  assert.ok(full > small * 1.8 && played.avg > full * 1.5, `bigger fish fight longer (small ${small.toFixed(0)}s, full-size ${full.toFixed(0)}s, trophy ${played.avg.toFixed(0)}s)`);
  console.log(`PASS: trophy carp breaks top gear when hauled, lands when played (${played.avg.toFixed(0)}s); small ${small.toFixed(0)}s vs full-size ${full.toFixed(0)}s`);
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

{
  // A bass jumps while you keep winding: with the rod tip dropped it throws
  // the hook far less often than with the rod held high.
  const bass = FISH_SPECIES.find((f) => f.id === 'largemouth-bass');
  const thrown = (lift) => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const mg = createMinigame();
      let result = null;
      mg.start({ species: bass, weightKg: 1.5, ...starter, onSuccess: () => {}, onFailure: (r) => { result = r; } });
      mg.setRodLift(lift);
      mg.setHolding(true);
      mg.jump(1.2);
      for (let t = 0; t < 30 && mg.isActive(); t++) mg.update(0.05);
      if (result === 'threw-hook') n++;
    }
    return n;
  };
  const high = thrown(1), low = thrown(-1);
  assert.ok(low < high * 0.6, `rod low should throw fewer (low ${low}, high ${high})`);
  console.log(`PASS: dropping the rod tip in a jump keeps more fish on (thrown: high ${high}/400, low ${low}/400)`);
}

console.log('All minigame tests passed.');
