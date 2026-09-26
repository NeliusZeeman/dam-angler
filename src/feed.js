// How loose feed in the water draws fish in -- pure numbers, no graphics,
// so it can be tested. Used by chum.js (the spots you see) and the bite roll.
//
// Real groundbaiting: fish take a little while to find the feed, then hold
// on it while there's food left, and drift off again as it runs out. The
// pull is strongest over the middle of the spot and fades past its edge.

export const FEED_TYPES = {
  // Handful of breadcrumbs thrown by hand.
  bread: { radius: 3.2, duration: 150, peak: 3.0, findSeconds: 10 },
  // A mieliebom breaking down around the hook -- tighter, lasts longer.
  groundbait: { radius: 2.6, duration: 180, peak: 3.5, findSeconds: 12 },
};

const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

// 0..1: how strongly fish are holding on a spot of this age.
export function feedIntensity(age, { duration, findSeconds }) {
  if (age < 0 || age >= duration) return 0;
  const arrive = smooth(age / findSeconds); // fish find the feed
  const fadeStart = duration * 0.55;
  const leave = 1 - smooth((age - fadeStart) / (duration - fadeStart)); // food runs out
  return arrive * leave;
}

// 0..1 by distance from the middle: full over the feed, fading to nothing
// at 1.6x the radius (fish mill around the edges too).
export function feedFalloff(dist, radius) {
  if (dist <= radius * 0.6) return 1;
  return 1 - smooth((dist - radius * 0.6) / (radius * 1.0));
}

// Extra bite pull at a point from a set of spots: 0 = none, e.g. 2.0 = up
// to 3x for a fish that loves the feed (see each species' chumAffinity).
export function feedBoostAt(spots, x, z) {
  let boost = 0;
  for (const s of spots) {
    const type = FEED_TYPES[s.type] || FEED_TYPES.bread;
    const strength = feedIntensity(s.age, type) * feedFalloff(Math.hypot(x - s.x, z - s.z), type.radius);
    boost = Math.max(boost, (type.peak - 1) * strength);
  }
  return boost;
}
