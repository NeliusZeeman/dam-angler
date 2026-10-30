import assert from 'node:assert';
import { pointsFromLog, pointsForCatch, pointsForLevel, levelFor, levelInfo, gearLevel, sizeCap, sizeSkew, bossWeightFor } from '../src/levels.js';
import { FISH_SPECIES, randomWeightFor } from '../src/fish.js';
import { RODS } from '../src/gear.js';

{
  // A new angler starts at level 1 with nothing; each level needs more
  // points than the one before.
  assert.strictEqual(levelFor(0), 1);
  assert.strictEqual(pointsFromLog({}), 0);
  let lastGap = 0;
  for (let l = 2; l <= 30; l++) {
    const gap = pointsForLevel(l) - pointsForLevel(l - 1);
    assert.ok(gap > lastGap, `level ${l} needs a bigger step than level ${l - 1}`);
    lastGap = gap;
  }
  const info = levelInfo(pointsForLevel(5) + 1);
  assert.strictEqual(info.level, 5);
  assert.ok(info.share > 0 && info.share < 0.1);
  console.log('PASS: levels start at 1 and each one needs more points');
}

{
  // Points: weight landed, a first of a species, personal bests, trophies,
  // bosses and released fish -- the same from the log as catch by catch.
  const first = pointsForCatch({ weightKg: 2 });
  const pb = pointsForCatch({ weightKg: 3 }, { count: 1, bestWeightKg: 2 });
  const smaller = pointsForCatch({ weightKg: 1 }, { count: 2, bestWeightKg: 3 });
  assert.ok(first > pb && pb > smaller, 'a first beats a personal best beats an ordinary fish');
  assert.ok(pointsForCatch({ weightKg: 2, boss: true }, { count: 3, bestWeightKg: 9 }) > pointsForCatch({ weightKg: 2 }, { count: 3, bestWeightKg: 9 }) + 50, 'a boss pays a big bonus');
  const log = { 'common-carp': { count: 3, totalKg: 6, bestWeightKg: 3, pbs: 1 } };
  assert.strictEqual(pointsFromLog(log), first + pb + smaller);
  assert.ok(pointsFromLog(log, [1]) > pointsFromLog(log) + 100, 'winning a competition counts');
  console.log('PASS: points for weight, firsts, personal bests, bosses and competitions');
}

{
  // Gear: cheap kit for everyone, dearer kit at higher levels.
  assert.strictEqual(gearLevel(RODS[0]), 1);
  const spinning = RODS.find((r) => r.id === 'rod-spinning');
  assert.ok(gearLevel(spinning) > 1);
  assert.ok(gearLevel({ cost: 2000 }) > gearLevel({ cost: 400 }));
  console.log(`PASS: gear unlocks by level (spinning rod at level ${gearLevel(spinning)}, a R2000 reel at ${gearLevel({ cost: 2000 })})`);
}

{
  // Fish follow the level: a beginner's are small; the range opens up; a
  // boss is at the top of your range or past it, never past the species.
  const carp = FISH_SPECIES.find((f) => f.id === 'common-carp');
  const range = carp.maxWeightKg - carp.minWeightKg;
  const avg = (level) => {
    let sum = 0;
    for (let i = 0; i < 4000; i++) sum += randomWeightFor(carp, sizeSkew(level), Math.random, sizeCap(level));
    return sum / 4000;
  };
  const beginner = avg(1), mid = avg(10), top = avg(25);
  assert.ok(beginner < mid && mid < top, `bigger fish as you climb (${beginner.toFixed(1)} / ${mid.toFixed(1)} / ${top.toFixed(1)} kg)`);
  for (let i = 0; i < 2000; i++) {
    const w = randomWeightFor(carp, sizeSkew(1), Math.random, sizeCap(1));
    assert.ok(w <= carp.minWeightKg + range * sizeCap(1) + 1e-9, 'a beginner never hooks past their cap');
    const b = bossWeightFor(carp, 1);
    assert.ok(b >= carp.minWeightKg + range * sizeCap(1) * 0.9 - 1e-9 && b <= carp.maxWeightKg + 1e-9, 'a boss is a lump for your level');
  }
  console.log(`PASS: fish grow with your level (carp average ${beginner.toFixed(1)} kg at level 1, ${mid.toFixed(1)} at 10, ${top.toFixed(1)} at 25)`);
}

console.log('All level tests passed.');
