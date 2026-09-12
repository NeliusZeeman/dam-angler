import assert from 'node:assert';
import { calculatePayout } from '../src/economy.js';
import { FISH_SPECIES } from '../src/fish.js';
import { RODS, LINES, HOOKS } from '../src/gear.js';

{
  const carp = FISH_SPECIES.find(f => f.id === 'common-carp');
  const rod = RODS[0];
  const line = LINES[0];
  const small = calculatePayout({ species: carp, weightKg: 1, rod, line });
  const large = calculatePayout({ species: carp, weightKg: 5, rod, line });
  assert.ok(large > small, `expected larger fish to pay more (small=${small}, large=${large})`);
  console.log('PASS: payout increases with weight');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  for (let i = 0; i < 50; i++) {
    const payout = calculatePayout({ species: bass, weightKg: 1 + Math.random() * 3, rod: RODS[1], line: LINES[1] });
    assert.ok(Number.isInteger(payout) && payout > 0, `payout must be a positive integer, got ${payout}`);
  }
  console.log('PASS: payout is always a positive integer');
}

{
  const bass = FISH_SPECIES.find(f => f.id === 'largemouth-bass');
  const weightKg = 2;
  const starterPayout = calculatePayout({ species: bass, weightKg, rod: RODS[0], line: LINES[0] });
  const proPayout = calculatePayout({ species: bass, weightKg, rod: RODS[2], line: LINES[2] });
  assert.ok(proPayout <= starterPayout * 2, `pro gear payout (${proPayout}) should not exceed 2x starter payout (${starterPayout})`);
  assert.ok(proPayout >= starterPayout, `pro gear payout (${proPayout}) should be at least starter payout (${starterPayout})`);
  console.log(`PASS: gear quality gives a modest payout bump only (starter=${starterPayout}, pro=${proPayout})`);
}

{
  const carp = FISH_SPECIES.find(f => f.id === 'common-carp');
  const doubleJ = HOOKS.find(h => h.id === 'hook-double-j');
  const starterHook = HOOKS.find(h => h.cost === 0);
  let withoutTotal = 0, withTotal = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    withoutTotal += calculatePayout({ species: carp, weightKg: 3, rod: RODS[0], line: LINES[0], hook: starterHook });
    withTotal += calculatePayout({ species: carp, weightKg: 3, rod: RODS[0], line: LINES[0], hook: doubleJ });
  }
  assert.ok(withTotal > withoutTotal, `expected double-J rig average payout (${withTotal / trials}) to exceed starter hook average (${withoutTotal / trials}) for carp`);
  console.log(`PASS: a hook's speciesBonus nudges payout up for its matching species (starter avg=${(withoutTotal / trials).toFixed(1)}, double-j avg=${(withTotal / trials).toFixed(1)})`);
}

console.log('All economy tests passed.');
