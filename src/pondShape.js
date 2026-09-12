// A dam is not a perfect circle. Each location gets an irregular shoreline:
// a mild organic wobble everywhere, plus a handful of hand-placed coves --
// pulled-in stretches of bank that become sheltered, lily-pad "structure"
// zones (the water anglers actually work with a spinner), leaving the rest
// as open water. Everything else (geometry, casting, fish placement, the
// player's walking path) reads angle -> radius/zone from here so the shape
// only needs to be described once per location.

function makeRng(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  if (seed === 0) seed = 1;
  return function rng() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Shortest signed distance from `theta` to `center`, in (-PI, PI].
function angleDelta(theta, center) {
  let d = (theta - center) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * @param {object} opts
 * @param {string} opts.seedStr - deterministic seed (e.g. the location id)
 * @param {number} opts.baseRadius - the water's average radius
 * @param {Array<{angle:number, width:number, pull:number, density?:number}>} opts.coves -
 *   hand-placed structure zones. `pull` shrinks the water radius toward the
 *   centre at that angle (a point of bank reaching into the water, with
 *   sheltered, lily-padded water flanking it); `density` (0..1, default 1)
 *   scales how thick the lily pads/reeds are placed there.
 * @param {number} [opts.wobble] - amplitude of the ambient organic wobble
 */
export function createPondShape({ seedStr, baseRadius, coves = [], wobble = 0.8 }) {
  const rng = makeRng(seedStr);
  const harmonics = [2, 3, 5].map((freq) => ({
    freq: freq + Math.floor(rng() * 2),
    amp: wobble * (0.4 + rng() * 0.6),
    phase: rng() * Math.PI * 2,
  }));

  function radiusAt(theta) {
    let r = baseRadius;
    for (const h of harmonics) r += h.amp * Math.sin(h.freq * theta + h.phase);
    for (const cove of coves) {
      const half = cove.width / 2;
      const d = Math.abs(angleDelta(theta, cove.angle));
      if (d < half) r -= cove.pull * smoothstep(1 - d / half);
    }
    return Math.max(baseRadius * 0.35, r);
  }

  // Structure (lily pad cove) or open water at this angle, plus how dense
  // the cove's lily pads/reeds should be here (0 outside any cove).
  function zoneAt(theta) {
    for (const cove of coves) {
      const half = cove.width / 2;
      const d = Math.abs(angleDelta(theta, cove.angle));
      if (d < half) {
        return { type: 'structure', density: (cove.density ?? 1) * smoothstep(1 - d / half) };
      }
    }
    return { type: 'open', density: 0 };
  }

  // 0 at the water's edge, 1 at the deepest (centre) point reachable at
  // this angle -- used for the shallow-loving-vs-deep-loving bite bonus.
  function depthFactorAt(theta, distFromCenter) {
    const edge = radiusAt(theta);
    if (edge <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - distFromCenter / edge));
  }

  function sampleOutline(segments) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push({ theta, radius: radiusAt(theta) });
    }
    return points;
  }

  return { radiusAt, zoneAt, depthFactorAt, sampleOutline, coves, baseRadius };
}

export function pointAngleAndDistance(pond, point) {
  const dx = point.x - pond.x;
  const dz = point.z - pond.z;
  return { theta: Math.atan2(dz, dx), dist: Math.hypot(dx, dz) };
}
