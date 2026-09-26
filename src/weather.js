// Wind that behaves like wind. Three layers on top of each other:
//
//   base breeze -- wanders slowly between calm, light, fresh and (rarely)
//                  strong, easing from one to the next over tens of seconds
//   gusts       -- random, overlapping puffs that build over a second or
//                  three, hold, and die away, veering the direction a little
//   flutter     -- a constant small unsteadiness, stronger in a stronger wind
//
// The direction drifts too rather than flipping. Speeds run 0..12 (the
// game's wind scale); the HUD shows them as km/h (x3).

export const MAX_WIND = 12;

// Highveld days: calm mornings, the wind picks up through the day and is
// usually strongest mid-to-late afternoon, then settles after dark.
const TIME_OF_DAY_WIND = {
  morning: 0.55, midMorning: 0.8, midday: 1.0, afternoon: 1.25, sunset: 0.9, lateTwilight: 0.65, night: 0.45,
};

const smooth = (t) => t * t * (3 - 2 * t);

export function createWindModel(rng = Math.random) {
  function pickBase() {
    const r = rng();
    if (r < 0.25) return rng() * 1.5; // calm
    if (r < 0.75) return 1.5 + rng() * 3.5; // light to moderate
    if (r < 0.95) return 5 + rng() * 3; // fresh
    return 8 + rng() * 2; // strong
  }

  let time = 0;
  let base = pickBase();
  let baseTarget = base;
  let baseTimer = 0;
  let nextBaseChange = 15 + rng() * 45;
  let angle = rng() * Math.PI * 2;
  let angleTarget = angle;
  let angleTimer = 0;
  let nextAngleChange = 25 + rng() * 60;
  let gustTimer = 0;
  let nextGust = 2 + rng() * 6;
  const gusts = [];
  const phases = [rng() * 10, rng() * 10, rng() * 10, rng() * 10];

  let speed = base;
  let dirAngle = angle;

  function spawnGust() {
    gusts.push({
      age: 0,
      attack: 0.8 + rng() * 2.4,
      hold: rng() * 2.2,
      decay: 2 + rng() * 5,
      // A gust adds roughly 20-70% of the breeze, plus a little on its own
      // so even a still day gets the odd cat's-paw.
      peak: base * (0.2 + rng() * 0.5) + rng() * 0.9,
      veer: (rng() - 0.5) * 0.6,
    });
  }

  function envelope(g) {
    if (g.age < g.attack) return smooth(g.age / g.attack);
    const afterHold = g.age - g.attack - g.hold;
    if (afterHold < 0) return 1;
    return 1 - smooth(Math.min(1, afterHold / g.decay));
  }

  function tick(dt, timeOfDay = 'midday') {
    time += dt;

    baseTimer += dt;
    if (baseTimer >= nextBaseChange) {
      baseTimer = 0;
      nextBaseChange = 20 + rng() * 60;
      baseTarget = pickBase();
    }
    base += (baseTarget - base) * (1 - Math.exp(-dt / 18));

    angleTimer += dt;
    if (angleTimer >= nextAngleChange) {
      angleTimer = 0;
      nextAngleChange = 30 + rng() * 70;
      angleTarget = angle + (rng() - 0.5) * 1.6;
    }
    angle += (angleTarget - angle) * (1 - Math.exp(-dt / 25));

    // Gusts come more often when there's more wind about.
    gustTimer += dt;
    if (gustTimer >= nextGust) {
      gustTimer = 0;
      const mean = 12 - Math.min(8, base);
      nextGust = 1 + -Math.log(1 - rng() * 0.999) * mean * 0.6;
      if (base > 0.4 || rng() < 0.3) spawnGust();
    }
    let gustSum = 0, veer = 0;
    for (let i = gusts.length - 1; i >= 0; i--) {
      const g = gusts[i];
      g.age += dt;
      if (g.age > g.attack + g.hold + g.decay) { gusts.splice(i, 1); continue; }
      const e = envelope(g);
      gustSum += g.peak * e;
      veer += g.veer * e;
    }

    const flutter = (Math.sin(time * 1.7 + phases[0]) * 0.35 + Math.sin(time * 3.1 + phases[1]) * 0.25
      + Math.sin(time * 5.3 + phases[2]) * 0.15) * (0.12 + base * 0.07);

    const todFactor = TIME_OF_DAY_WIND[timeOfDay] ?? 1;
    speed = Math.min(MAX_WIND, Math.max(0, base * todFactor + gustSum + flutter));
    dirAngle = angle + veer + Math.sin(time * 0.4 + phases[3]) * 0.05;
  }

  return {
    tick,
    get speed() { return speed; },
    get dirX() { return Math.cos(dirAngle); },
    get dirZ() { return Math.sin(dirAngle); },
  };
}

// Compass bearing the wind blows FROM ("a north-westerly"), for the HUD.
// +x is east, +z is north; (dirX, dirZ) is the way the wind is blowing to.
export function windFromLabel(dirX, dirZ) {
  const names = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const from = Math.atan2(-dirZ, -dirX);
  const idx = Math.round(((from / (Math.PI * 2)) * 8 + 8)) % 8;
  return names[idx];
}
