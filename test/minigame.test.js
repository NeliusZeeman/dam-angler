import assert from 'node:assert';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, HOOKS } from '../src/gear.js';

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
  assert.strictEqual(result, 'line-snapped', `expected a held-down tigerfish on 10lb line to snap, got ${result}`);
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

console.log('All minigame tests passed.');
