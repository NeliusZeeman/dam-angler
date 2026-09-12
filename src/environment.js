export const SEASON_ORDER = ['summer', 'autumn', 'winter', 'spring'];
export const SEASON_LENGTH_SECONDS = 1200; // 20 real minutes per season

const SEASON_BASE_TEMP_C = {
  summer: 26,
  autumn: 18,
  winter: 10,
  spring: 19,
};

// A full day cycle, dominated by the two crepuscular "golden hour" windows
// (sunset, twilight) where most freshwater fish feed most actively.
export const DAY_CYCLE_SECONDS = 480; // 8 real minutes per full day
export const TIME_OF_DAY_PHASES = [
  { name: 'day', fraction: 0.42 },
  { name: 'sunset', fraction: 0.13 },
  { name: 'twilight', fraction: 0.13 },
  { name: 'night', fraction: 0.32 },
];

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
    let t = dayElapsed % DAY_CYCLE_SECONDS;
    for (const phase of TIME_OF_DAY_PHASES) {
      const phaseLength = phase.fraction * DAY_CYCLE_SECONDS;
      if (t < phaseLength) {
        return { name: phase.name, progress: t / phaseLength };
      }
      t -= phaseLength;
    }
    const last = TIME_OF_DAY_PHASES[TIME_OF_DAY_PHASES.length - 1];
    return { name: last.name, progress: 0 };
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
