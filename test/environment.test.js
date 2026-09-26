import assert from 'node:assert';
import { createWindModel, windFromLabel, MAX_WIND } from '../src/weather.js';
import { makeRng } from '../src/gfx/noise.js';
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
  const env = createEnvironment({ startTimeOfDay: 'sunset' });
  assert.strictEqual(env.getState().timeOfDay, 'sunset');
  console.log('PASS: createEnvironment honors a requested starting time of day');
}

{
  const env = createEnvironment({ startTimeOfDay: 'not-a-real-phase' });
  assert.strictEqual(env.getState().timeOfDay, 'morning', 'unknown startTimeOfDay should fall back to morning');
  console.log('PASS: an invalid startTimeOfDay falls back to morning');
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

{
  // Natural wind: it never teleports from calm to a gale -- changes build
  // and ease over time -- yet over a few minutes it visits a real spread of
  // speeds and the direction wanders rather than flipping.
  const model = createWindModel(makeRng(42));
  let prev = null, maxStep = 0, maxTurn = 0, lo = Infinity, hi = -Infinity, prevAng = null;
  for (let i = 0; i < 6000; i++) {
    model.tick(0.1, 'afternoon');
    const s = model.speed;
    const ang = Math.atan2(model.dirZ, model.dirX);
    if (prev !== null) maxStep = Math.max(maxStep, Math.abs(s - prev));
    if (prevAng !== null) {
      let d = Math.abs(ang - prevAng);
      if (d > Math.PI) d = Math.PI * 2 - d;
      maxTurn = Math.max(maxTurn, d);
    }
    prev = s; prevAng = ang;
    if (i > 100) { lo = Math.min(lo, s); hi = Math.max(hi, s); }
    assert.ok(s >= 0 && s <= MAX_WIND, `wind out of range: ${s}`);
  }
  assert.ok(maxStep < 0.6, `wind should change smoothly (biggest 0.1s jump was ${maxStep.toFixed(2)})`);
  assert.ok(hi - lo > 3, `wind should vary over time (range ${lo.toFixed(1)}..${hi.toFixed(1)})`);
  assert.ok(maxTurn < 0.1, `direction should drift, not flip (biggest 0.1s turn ${maxTurn.toFixed(3)} rad)`);
  console.log('PASS: wind varies naturally -- smooth gusts, a spread of speeds, drifting direction');
}

{
  assert.strictEqual(windFromLabel(-1, 0), 'E', 'wind blowing west comes from the east');
  assert.strictEqual(windFromLabel(0, -1), 'N', 'wind blowing south comes from the north');
  console.log('PASS: wind direction labels');
}

console.log('All environment tests passed.');
