import assert from 'node:assert';
import { createEnvironment, SEASON_ORDER, SEASON_LENGTH_SECONDS, DAY_CYCLE_SECONDS, TIME_OF_DAY_PHASES } from '../src/environment.js';

{
  const env = createEnvironment();
  assert.strictEqual(env.getState().season, 'summer');
  env.tick(SEASON_LENGTH_SECONDS + 1);
  assert.strictEqual(env.getState().season, 'autumn');
  console.log('PASS: season advances after season length elapses');
}

{
  const env = createEnvironment();
  for (let i = 0; i < SEASON_ORDER.length; i++) {
    env.tick(SEASON_LENGTH_SECONDS + 1);
  }
  assert.strictEqual(env.getState().season, 'summer');
  console.log('PASS: season cycles back to summer');
}

{
  const envSummer = createEnvironment();
  const summerTemp = envSummer.getState().waterTempC;
  const envWinter = createEnvironment();
  envWinter.tick(SEASON_LENGTH_SECONDS * 2 + 1);
  const winterTemp = envWinter.getState().waterTempC;
  assert.ok(summerTemp > winterTemp, `expected summer (${summerTemp}) > winter (${winterTemp})`);
  console.log('PASS: summer water is warmer than winter water');
}

{
  const env = createEnvironment();
  for (let i = 0; i < 100; i++) {
    env.tick(1);
    const { windSpeed } = env.getState();
    assert.ok(windSpeed >= 0 && windSpeed <= 12, `windSpeed out of bounds: ${windSpeed}`);
  }
  console.log('PASS: wind speed stays within bounds across many ticks');
}

{
  const env = createEnvironment();
  assert.strictEqual(env.getState().timeOfDay, 'day');
  console.log('PASS: time of day starts at day');
}

{
  const env = createEnvironment();
  let cursor = 0;
  const seen = [];
  for (const phase of TIME_OF_DAY_PHASES) {
    const length = phase.fraction * DAY_CYCLE_SECONDS;
    env.tick(length * 0.5);
    seen.push(env.getState().timeOfDay);
    env.tick(length * 0.5);
    cursor += length;
  }
  assert.deepStrictEqual(seen, ['day', 'sunset', 'twilight', 'night'], `expected all four phases in order, got ${seen}`);
  console.log('PASS: time of day cycles through day, sunset, twilight, night in order');
}

{
  const env = createEnvironment();
  env.tick(DAY_CYCLE_SECONDS + 1);
  assert.strictEqual(env.getState().timeOfDay, 'day', 'expected time of day to wrap back to day after a full cycle');
  console.log('PASS: time of day wraps back to day after a full cycle');
}

{
  const env = createEnvironment();
  env.tick(10);
  const { timeOfDayProgress } = env.getState();
  assert.ok(timeOfDayProgress >= 0 && timeOfDayProgress <= 1, `timeOfDayProgress out of bounds: ${timeOfDayProgress}`);
  console.log('PASS: timeOfDayProgress stays within 0..1');
}

console.log('All environment tests passed.');
