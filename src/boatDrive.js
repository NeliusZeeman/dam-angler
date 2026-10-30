// Your own boat, on dams that allow boats: walk up to it and get in (B),
// drive with W/S (throttle) and A/D (steer), Shift opens it up, and stop
// anywhere to fish. With a line out the motor is off and the anchor down.
// Pull in close to the bank and press B again to step ashore.
//
// Pure math (no Three.js) so it can be unit-tested. Heading h points the
// bow along (sin h, cos h), like the boats in gfx/boats.js.

// What each boat does. eye = how high your eyes are over the water
// (standing on a bass boat's casting deck, sitting low in a kayak); seat =
// where you are along the boat (metres toward the bow).
// deck = where you can walk with the anchor down, in the boat's own metres
// (x across, z toward the bow; tools/blender/build_boats.py): inside the
// gunwales, round anything in the way, and the rod rack you take the boat
// rods from (boatRods.js). A kayak has no deck -- the rods are in reach.
export const BOAT_SPECS = {
  // A 17-18ft bass boat on a 90-150 hp outboard does 70+ km/h; kept to a
  // manageable 45 km/h flat out here, a trolling-motor crawl when slow.
  bass: {
    label: 'bass boat', cruise: 6, max: 12.5, reverse: 1.8, accel: 3, turn: 0.75, eye: 1.95, seat: 1.5, hull: 2.2,
    // The two consoles either side of the walk-through windscreen; the
    // rods stand in holders at the stern.
    deck: { halfW: 0.72, aft: -2.35, fore: 2.45, blocks: [[0.28, 0.9, -0.2, 0.45], [-0.9, -0.28, -0.2, 0.45]], rack: { x: 0, z: -1.75 } },
  },
  // A small aluminium tiger boat with a 25-40 hp outboard.
  tiger: {
    label: 'tiger boat', cruise: 5, max: 9, reverse: 1.5, accel: 2.5, turn: 0.85, eye: 1.85, seat: 1.1, hull: 1.9,
    // Low thwart seats you step over; rod holders along both sides aft.
    deck: { halfW: 0.62, aft: -1.95, fore: 1.95, blocks: [], rack: { x: 0, z: -1.05 } },
  },
  // Paddling: a fit paddler holds about 1.5 m/s (5-6 km/h).
  kayak: { label: 'kayak', cruise: 1.3, max: 2, reverse: 0.6, accel: 0.7, turn: 0.9, eye: 0.95, seat: 0, hull: 1.2, deck: null },
};

// How close to the rack you have to stand to reach the rods.
export const RACK_REACH = 1.1;

// The boat you get on a dam: a bass boat where they run, a tiger boat on
// tigerfish water, a kayak where only paddling is allowed. Dams with only
// ski boats or yachts still let you launch a bass boat.
export function boatKindFor(kinds = []) {
  if (!kinds || !kinds.length) return null;
  if (kinds.includes('bass')) return 'bass';
  if (kinds.includes('tiger')) return 'tiger';
  if (kinds.includes('ski') || kinds.includes('pontoon') || kinds.includes('houseboat')) return 'bass';
  return 'kayak';
}

// Where the boat waits when you arrive: off the slipway if there is one,
// else beside the spot you start at -- afloat, clear of the stands.
export function mooringFor(dam, { slipwayX = null } = {}) {
  const base = slipwayX ?? dam.spawn.x;
  const offsets = slipwayX != null ? [0, 4, -4, 8, -8, 12] : [8, -8, 12, -12, 16, -16, 22, -22, 30, -30];
  for (const dx of offsets) {
    const x = base + dx;
    for (const out of [4, 5.5, 7, 9]) {
      const z = dam.shoreZ(x) + out;
      if (dam.waterDist(x, z) > 2.5 && !dam.standAt(x, z) && !dam.standAt(x, z - 3)) return { x, z, heading: Math.PI / 2 };
    }
  }
  return { x: base, z: dam.shoreZ(base) + 8, heading: Math.PI / 2 };
}

export function createBoatDrive({ dam, kind = 'bass', x, z, heading = 0 }) {
  const spec = BOAT_SPECS[kind] || BOAT_SPECS.bass;
  const s = { x, z, heading, speed: 0, bumped: 0 };

  // Afloat with room for the hull, and not driving into a stand.
  const clear = (px, pz) => dam.waterDist(px, pz) > spec.hull && !dam.standAt(px, pz);

  // throttle and steer are -1..1; `open` is full speed (Shift).
  function step(dt, throttle = 0, steer = 0, open = false) {
    const top = throttle >= 0 ? (open ? spec.max : spec.cruise) : spec.reverse;
    const want = throttle * top;
    if (throttle !== 0) s.speed += Math.max(-spec.accel * dt, Math.min(spec.accel * dt, want - s.speed));
    // Off the throttle the water slows the hull.
    else s.speed *= Math.exp(-dt * (Math.abs(s.speed) > 3 ? 0.5 : 0.9));
    if (Math.abs(s.speed) < 0.02 && throttle === 0) s.speed = 0;
    // Steering bites harder with way on; the trolling motor (or a paddle)
    // still turns you slowly at a standstill.
    const bite = Math.min(1, 0.35 + Math.abs(s.speed) / 4) * (s.speed < 0 ? -1 : 1);
    s.heading -= steer * spec.turn * bite * dt;
    const nx = s.x + Math.sin(s.heading) * s.speed * dt;
    const nz = s.z + Math.cos(s.heading) * s.speed * dt;
    s.bumped = Math.max(0, s.bumped - dt);
    // Tight against the bank, moving back out to deeper water is allowed.
    const outward = dam.isWater(nx, nz) && !dam.standAt(nx, nz) && dam.waterDist(nx, nz) > dam.waterDist(s.x, s.z);
    if (clear(nx, nz) || outward) { s.x = nx; s.z = nz; }
    else {
      // Bump off the bank (or a stand) rather than climbing it.
      if (Math.abs(s.speed) > 1.5) s.bumped = 0.6;
      s.speed *= -0.2;
    }
  }

  // Close enough to climb in from where you stand.
  const canBoardFrom = (px, pz) => Math.hypot(px - s.x, pz - s.z) <= 5;

  // Somewhere to step ashore: the nearest dry ground or stand deck within a
  // few metres of the boat, or null when you're out in open water.
  function landingSpot() {
    let best = null;
    for (let r = 1.5; r <= 7; r += 0.5) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const px = s.x + Math.sin(ang) * r, pz = s.z + Math.cos(ang) * r;
        if (dam.isWalkable(px, pz) && dam.isWalkable(px + Math.sin(ang) * 0.6, pz + Math.cos(ang) * 0.6)) {
          best = { x: px + Math.sin(ang) * 0.6, z: pz + Math.cos(ang) * 0.6 };
          return best;
        }
      }
    }
    return best;
  }

  // Where your eyes are in the boat.
  const seat = () => ({ x: s.x + Math.sin(s.heading) * spec.seat, z: s.z + Math.cos(s.heading) * spec.seat });

  // The boat's own metres (x across, z toward the bow) to the world's, and
  // a world-sized move into the boat's.
  const toWorld = (lx, lz) => {
    const c = Math.cos(s.heading), n = Math.sin(s.heading);
    return { x: s.x + lx * c + lz * n, z: s.z - lx * n + lz * c };
  };
  const moveToBoat = (dx, dz) => {
    const c = Math.cos(s.heading), n = Math.sin(s.heading);
    return { x: dx * c - dz * n, z: dx * n + dz * c };
  };

  // Walking the deck: from (lx, lz) toward (nx, nz), kept inside the
  // gunwales and sliding round the consoles. Returns where you end up.
  function walkDeck(lx, lz, nx, nz) {
    const d = spec.deck;
    if (!d) return { x: lx, z: lz };
    const inside = (px, pz) => Math.abs(px) <= d.halfW && pz >= d.aft && pz <= d.fore
      && !d.blocks.some(([x0, x1, z0, z1]) => px > x0 && px < x1 && pz > z0 && pz < z1);
    // The bow narrows: keep off the gunwale where the deck tapers in.
    const taper = (pz) => (pz > d.fore - 1 ? d.halfW * Math.max(0.35, d.fore - pz) : d.halfW);
    const fit = (px, pz) => inside(px, pz) && Math.abs(px) <= taper(pz);
    if (fit(nx, nz)) return { x: nx, z: nz };
    if (fit(nx, lz)) return { x: nx, z: lz };
    if (fit(lx, nz)) return { x: lx, z: nz };
    return { x: lx, z: lz };
  }

  // Close enough to take a rod from the rack (a kayak's are always in reach).
  const atRack = (lx, lz) => !spec.deck || Math.hypot(lx - spec.deck.rack.x, lz - spec.deck.rack.z) <= RACK_REACH;

  return { state: s, spec, kind, step, canBoardFrom, landingSpot, seat, clear, toWorld, moveToBoat, walkDeck, atRack };
}
