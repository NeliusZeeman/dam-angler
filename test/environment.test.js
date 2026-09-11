import assert from 'node:assert';
import { createEnvironment, SEASON_ORDER, SEASON_LENGTH_SECONDS } from '../src/environment.js';

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

console.log('All environment tests passed.');
