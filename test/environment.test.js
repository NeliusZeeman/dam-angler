import assert from 'node:assert';
import { createEnvironment, SEASON_ORDER, SEASON_LENGTH_SECONDS, DAY_CYCLE_SECONDS, TIME_OF_DAY_PHASES, PHASE_LENGTH_SECONDS } from '../src/environment.js';

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
  assert.strictEqual(TIME_OF_DAY_PHASES.length, 7);
  assert.deepStrictEqual(TIME_OF_DAY_PHASES, ['morning', 'midMorning', 'midday', 'afternoon', 'sunset', 'lateTwilight', 'night']);
  assert.strictEqual(PHASE_LENGTH_SECONDS, 45 * 60);
  assert.strictEqual(DAY_CYCLE_SECONDS, 7 * 45 * 60);
  console.log('PASS: seven time-of-day phases at 45 minutes each');
}

{
  const env = createEnvironment();
  assert.strictEqual(env.getState().timeOfDay, 'morning');
  console.log('PASS: time of day starts at morning');
}

{
  const env = createEnvironment();
  const seen = [];
  for (const phase of TIME_OF_DAY_PHASES) {
    env.tick(PHASE_LENGTH_SECONDS * 0.5);
    seen.push(env.getState().timeOfDay);
    env.tick(PHASE_LENGTH_SECONDS * 0.5);
  }
  assert.deepStrictEqual(seen, TIME_OF_DAY_PHASES, `expected all seven phases in order, got ${seen}`);
  console.log('PASS: time of day cycles through all seven phases in order');
}

{
  const env = createEnvironment();
  env.tick(DAY_CYCLE_SECONDS + 1);
  assert.strictEqual(env.getState().timeOfDay, 'morning', 'expected time of day to wrap back to morning after a full cycle');
  console.log('PASS: time of day wraps back to morning after a full cycle');
}

{
  const env = createEnvironment();
  env.tick(10);
  const { timeOfDayProgress } = env.getState();
  assert.ok(timeOfDayProgress >= 0 && timeOfDayProgress <= 1, `timeOfDayProgress out of bounds: ${timeOfDayProgress}`);
  console.log('PASS: timeOfDayProgress stays within 0..1');
}

console.log('All environment tests passed.');
