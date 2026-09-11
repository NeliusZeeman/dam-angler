export const SEASON_ORDER = ['summer', 'autumn', 'winter', 'spring'];
export const SEASON_LENGTH_SECONDS = 1200; // 20 real minutes per season

const SEASON_BASE_TEMP_C = {
  summer: 26,
  autumn: 18,
  winter: 10,
  spring: 19,
};

export function createEnvironment() {
  let seasonIndex = 0;
  let seasonElapsed = 0;
  let windSpeed = 0;
  let windAngle = 0;
  let windTimer = 0;
  let nextGustAt = 5 + Math.random() * 15;

  function currentSeason() {
    return SEASON_ORDER[seasonIndex];
  }

  function tick(deltaSeconds) {
    seasonElapsed += deltaSeconds;
    while (seasonElapsed >= SEASON_LENGTH_SECONDS) {
      seasonElapsed -= SEASON_LENGTH_SECONDS;
      seasonIndex = (seasonIndex + 1) % SEASON_ORDER.length;
    }

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
    return {
      season: currentSeason(),
      waterTempC: base,
      windSpeed,
      windDirX: Math.cos(windAngle),
      windDirZ: Math.sin(windAngle),
    };
  }

  return { getState, tick };
}
