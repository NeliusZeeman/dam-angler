import { createWindModel } from './weather.js';

export const SEASON_ORDER = ['summer', 'autumn', 'winter', 'spring'];
export const SEASON_LENGTH_SECONDS = 1200; // 20 real minutes per season

const SEASON_BASE_TEMP_C = {
  summer: 26,
  autumn: 18,
  winter: 10,
  spring: 19,
};

// Seven stages across the day, each 45 real minutes, per the crepuscular
// feeding research: dawn/dusk are prime windows, midday is the quiet slack
// period, and barbel/tigerfish favor the dusk-into-night stretch.
export const PHASE_LENGTH_SECONDS = 45 * 60;
export const TIME_OF_DAY_PHASES = [
  'morning', 'midMorning', 'midday', 'afternoon', 'sunset', 'lateTwilight', 'night',
];
export const DAY_CYCLE_SECONDS = PHASE_LENGTH_SECONDS * TIME_OF_DAY_PHASES.length;

// `tempOffset`: how much warmer (+) or colder (-) this water runs than a
// typical Highveld dam -- a Drakensberg trout stream is ~9°C colder, a
// Lowveld dam a few degrees warmer. Trout only bite in cold water.
export function createEnvironment({ startTimeOfDay = null, tempOffset = 0 } = {}) {
  let seasonIndex = 0;
  let seasonElapsed = 0;
  const wind = createWindModel();
  const startIndex = Math.max(0, TIME_OF_DAY_PHASES.indexOf(startTimeOfDay));
  let dayElapsed = startIndex * PHASE_LENGTH_SECONDS;

  function currentSeason() {
    return SEASON_ORDER[seasonIndex];
  }

  function timeOfDayInfo() {
    const t = dayElapsed % DAY_CYCLE_SECONDS;
    const index = Math.min(TIME_OF_DAY_PHASES.length - 1, Math.floor(t / PHASE_LENGTH_SECONDS));
    const progress = (t - index * PHASE_LENGTH_SECONDS) / PHASE_LENGTH_SECONDS;
    return { name: TIME_OF_DAY_PHASES[index], progress };
  }

  function tick(deltaSeconds) {
    seasonElapsed += deltaSeconds;
    while (seasonElapsed >= SEASON_LENGTH_SECONDS) {
      seasonElapsed -= SEASON_LENGTH_SECONDS;
      seasonIndex = (seasonIndex + 1) % SEASON_ORDER.length;
    }

    dayElapsed = (dayElapsed + deltaSeconds) % DAY_CYCLE_SECONDS;

    // (Big jumps in time -- skipping ahead -- just settle the wind once.)
    wind.tick(Math.min(deltaSeconds, 5), timeOfDayInfo().name);
  }

  function getState() {
    const base = Math.max(2, SEASON_BASE_TEMP_C[currentSeason()] + tempOffset);
    const tod = timeOfDayInfo();
    return {
      season: currentSeason(),
      waterTempC: base,
      windSpeed: wind.speed,
      windDirX: wind.dirX,
      windDirZ: wind.dirZ,
      timeOfDay: tod.name,
      timeOfDayProgress: tod.progress,
    };
  }

  return { getState, tick };
}
