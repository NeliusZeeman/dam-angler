import assert from 'node:assert';
import { ENGINE, ENGINE_DEFAULTS, resetEngine } from '../src/tuning/engine.js';
import { createMinigame } from '../src/minigame.js';
import { FISH_SPECIES, rollTrophy } from '../src/fish.js';
import { RODS, LINES, HOOKS } from '../src/gear.js';
import { simulateCast } from '../src/castPhysics.js';

const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');

// Hauls flat out on a big carp; returns what happened.
function haul() {
  const mg = createMinigame();
  let result = null;
  mg.start({ species: carp, weightKg: 7, rod: RODS[0], line: LINES[0], hook: HOOKS[0], onSuccess: () => { result = 'landed'; }, onFailure: (r) => { result = r; } });
  for (let i = 0; i < 1200 && mg.isActive(); i++) { mg.setHolding(true); mg.update(0.05); }
  return result;
}

{
  assert.deepEqual(JSON.parse(JSON.stringify(ENGINE)), JSON.parse(JSON.stringify(ENGINE_DEFAULTS)));
  assert.throws(() => { ENGINE_DEFAULTS.fight.snapAt = 2; }, 'the built-in values can\'t be changed by accident');
  console.log('PASS: the engine starts on its built-in values');
}

{
  // The snap point is read live: raise it out of reach and hauling can't snap the line.
  // Fights are random (a hook can also pull out first), so give it a few goes.
  const breaks = Array.from({ length: 8 }, haul).some((r) => r === 'line-snapped' || r === 'hook-straightened');
  assert.equal(breaks, true, 'built-in: hauling a 7 kg carp on starter gear breaks something');
  ENGINE.fight.snapAt = 5;
  ENGINE.fight.haulOver = 0.35;
  const r = haul();
  assert.notEqual(r, 'line-snapped');
  resetEngine();
  assert.equal(ENGINE.fight.snapAt, 0.9);
  console.log('PASS: fight settings take effect live and reset back');
}

{
  ENGINE.bites.trophyChance = 1;
  assert.equal(rollTrophy(() => 0.99), true);
  ENGINE.bites.trophyChance = 0;
  assert.equal(rollTrophy(() => 0), false);
  resetEngine();
  const far = (g) => { ENGINE.cast.gravity = g; const d = simulateCast({ from: { x: 0, y: 2, z: 0 }, dirX: 1, dirZ: 0, speed: 20 }).distance; resetEngine(); return d; };
  assert.ok(far(4) > far(9.81) * 1.5, 'less gravity, longer cast');
  console.log('PASS: trophy chance and casting settings take effect live');
}
