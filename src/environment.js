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

export function createEnvironment() {
  let seasonIndex = 0;
  let seasonElapsed = 0;
  let windSpeed = 0;
  let windAngle = 0;
  let windTimer = 0;
  let nextGustAt = 5 + Math.random() * 15;
  let dayElapsed = 0;

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

    windTimer += deltaSeconds;
    if (windTimer >= nextGustAt) {
      windTimer = 0;
      nextGustAt = 5 + Math.random() * 15;
      windSpeed = Math.random() * 12;
      windAngle = Math.random() * Math.PI * 2;
    } else {
      windSpeed = Math.max(0, windSpeed - deltaSeconds * 0.5);
    }
  }

  function getState() {
    const base = SEASON_BASE_TEMP_C[currentSeason()];
    const tod = timeOfDayInfo();
    return {
      season: currentSeason(),
      waterTempC: base,
      windSpeed,
      windDirX: Math.cos(windAngle),
      windDirZ: Math.sin(windAngle),
      timeOfDay: tod.name,
      timeOfDayProgress: tod.progress,
    };
  }

  return { getState, tick };
}
