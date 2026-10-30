// Fishing spots ("pegs") on the six big dams, from SA angling forums,
// resort and nature-reserve pages (Oct 2026): the named banks anglers talk
// about, where the campsites and slipways are, and what boats are allowed.
// Each spot is its own scene: its own bank shape, weed, reeds, timber and
// depth, a camp or slipway where there really is one, and a nudge to what's
// caught there. The map is a sketch (not to scale) to pick a spot from.
//
// Sources: gauteng.net, sa-venues.com, 4x4community.co.za fishing threads,
// Wikipedia (Pongolapoort, Loskop, Vaal), lekkeslaap/plek resort listings,
// Pongola Game Reserve / Nkonkoni camp, Forever Resort Loskop.

// Boat kinds (gfx/boats.js): bass (bass boat, angler casting), ski (ski boat,
// fast), yacht (sail), houseboat, kayak, tiger (small aluminium boat, two
// anglers), pontoon (party pontoon).
export const DAM_SPOTS = {
  hartbeespoort: {
    boats: ['yacht', 'ski', 'bass', 'pontoon'],
    boatNote: 'Boating allowed — yacht and boating clubs, ski boats and bass boats.',
    // The dam: wall in the poort to the north, Crocodile River in the south-west,
    // Magalies River in the south-east.
    map: [[50, 6], [58, 10], [70, 12], [84, 20], [92, 34], [86, 48], [74, 54], [66, 64], [58, 58], [48, 66], [36, 60], [24, 64], [12, 56], [8, 42], [16, 30], [28, 22], [40, 12]],
    mapLabels: [{ x: 50, y: 3, text: 'Wall · Magaliesberg' }, { x: 14, y: 68, text: 'Crocodile R.' }, { x: 70, y: 70, text: 'Magalies R.' }],
    pegs: [
      {
        id: 'schoemansville', name: 'Schoemansville bank', map: [42, 14],
        blurb: 'North shore by the town, near the wall: deep water close in off a rocky bank. Carp and barbel feed along the drop-off; bass sit on the rocks.',
        dam: { maxDepth: 24, depthSlope: 22, bankSteepness: 1.6, structure: [{ x: 30, width: 18, reach: 14, density: 0.6, kind: 'pads' }] },
        scenery: { shoreRocks: 26 },
        catchShare: { 'catfish': 1.3, 'largemouth-bass': 1.3 },
      },
      {
        id: 'kommandonek', name: 'Kommandonek resort', map: [14, 40],
        blurb: 'The western resort: campsites on the water\'s edge, reeds and a gentle grassy bank. A classic carp and kurper spot — throw a mieliebom along the reed line.',
        camp: { x: 26, back: 9, tents: 4, people: 5, bakkie: true, rods: true },
        dam: { structure: [{ x: -40, width: 30, reach: 18, density: 0.9, kind: 'reeds' }, { x: 60, width: 18, reach: 14, density: 0.7, kind: 'reeds' }], bankSteepness: 0.8, beachWidth: 4 },
        catchShare: { 'common-carp': 1.25, 'mozambique-tilapia': 1.3, 'banded-tilapia': 1.3 },
      },
      {
        id: 'ifafi', name: 'Ifafi & Meerhof', map: [80, 26],
        blurb: 'The eastern shore by the yacht and boating clubs: moored boats, a slipway and hyacinth mats. Bass hunt under the weed; the carp are wary of the boat traffic.',
        slipway: { x: -22 },
        dam: { structure: [{ x: 24, width: 26, reach: 26, density: 1, kind: 'hyacinth' }, { x: 64, width: 14, reach: 18, density: 0.8, kind: 'pads' }] },
        moored: 3,
        catchShare: { 'largemouth-bass': 1.6, 'common-carp': 0.85 },
      },
      {
        id: 'crocodile-inlet', name: 'Crocodile River inlet', map: [18, 58],
        blurb: 'Where the Crocodile River comes in: shallow, muddy and green with algae, reed beds all along. Barbel and big carp root about in the silt.',
        dam: { maxDepth: 6, depthSlope: 60, structure: [{ x: -20, width: 40, reach: 22, density: 1, kind: 'reeds' }, { x: 40, width: 30, reach: 18, density: 0.9, kind: 'reeds' }] },
        scenery: { water: { clarity: 0.15, algae: 0.55, hyacinth: 600 } },
        catchShare: { 'catfish': 1.6, 'common-carp': 1.2, 'largemouth-bass': 0.6 },
      },
    ],
  },
  vaal: {
    boats: ['yacht', 'ski', 'bass'],
    boatNote: 'Boating allowed — yacht clubs, marinas and slipways at Deneysville and Vaal Marina.',
    map: [[10, 30], [22, 22], [36, 24], [48, 16], [62, 18], [74, 10], [90, 14], [94, 26], [82, 34], [70, 32], [60, 42], [50, 50], [56, 62], [44, 66], [34, 56], [26, 48], [14, 46]],
    mapLabels: [{ x: 8, y: 26, text: 'Wall' }, { x: 88, y: 8, text: 'Vaal R.' }, { x: 50, y: 72, text: 'Wilge R.' }],
    pegs: [
      {
        id: 'deneysville', name: 'Deneysville', map: [18, 30],
        blurb: 'The western basin near the wall: yacht clubs, a concrete slipway and deep open water. Smallmouth yellowfish shoal off the points; carp on the flats.',
        slipway: { x: 24 },
        moored: 2,
        dam: { maxDepth: 22, depthSlope: 28 },
        catchShare: { 'smallmouth-yellowfish': 1.3 },
      },
      {
        id: 'oranjeville', name: 'Oranjeville camp', map: [48, 58],
        blurb: 'The municipal camp on the Wilge arm: tents on the grass right at the water, a launching spot, and carp and mudfish grazing the shallows. Cleaner water this side.',
        camp: { x: -24, back: 8, tents: 5, people: 6, bakkie: true, caravan: true, rods: true },
        dam: { structure: [{ x: 40, width: 22, reach: 14, density: 0.8, kind: 'reeds' }], beachWidth: 5 },
        scenery: { water: { clarity: 0.45 } },
        catchShare: { 'common-carp': 1.3, 'mudfish': 1.4, 'smallmouth-yellowfish': 0.8 },
      },
      {
        id: 'vaal-marina', name: 'Vaal Marina timber', map: [80, 24],
        blurb: 'The north-east arm off Vaal Marina, full of drowned trees. The smallmouth bass everybody talks about hide in the timber — and so do snags.',
        dam: { structure: [{ x: 10, width: 40, reach: 30, density: 1, kind: 'timber' }, { x: -40, width: 20, reach: 20, density: 0.8, kind: 'timber' }] },
        scenery: { features: ['drownedTimber'] },
        catchShare: { 'smallmouth-bass': 3, 'catfish': 1.2 },
      },
    ],
  },
  jozini: {
    boats: ['tiger', 'houseboat'],
    boatNote: 'Boats allowed — tigerfishing boats with skippers and houseboats on the lake.',
    map: [[6, 40], [16, 30], [30, 34], [42, 26], [56, 30], [66, 20], [78, 16], [88, 22], [84, 32], [70, 38], [60, 48], [46, 46], [34, 54], [20, 52]],
    mapLabels: [{ x: 90, y: 14, text: 'Wall · Lebombo gorge' }, { x: 6, y: 52, text: 'Pongola R.' }],
    pegs: [
      {
        id: 'nkonkoni', name: 'Nkonkoni fishing camp', map: [40, 50],
        blurb: 'The southern shore inside Pongola Game Reserve: a tigerfish camp right on the water. Anglers fish from the bank between boat trips; acacia bush all around.',
        camp: { x: 22, back: 10, tents: 3, people: 4, bakkie: true, rods: true },
        catchShare: { 'tigerfish': 1.2 },
      },
      {
        id: 'gorge', name: 'Lebombo gorge', map: [80, 22],
        blurb: 'Up against the mountains near the wall: steep rocky banks dropping straight into deep, clear water. Big tigers hunt the edge.',
        dam: { maxDepth: 40, depthSlope: 14, bankSteepness: 2.4, beachWidth: 1 },
        scenery: { shoreRocks: 40, water: { clarity: 0.7 } },
        catchShare: { 'tigerfish': 1.5, 'catfish': 0.7 },
      },
      {
        id: 'pongola-inlet', name: 'Pongola River inlet', map: [12, 44],
        blurb: 'Where the Pongola River comes in: reed beds, shallow channels and warm water. Barbel and kurper in numbers, tigers ambushing at the river mouth.',
        dam: { maxDepth: 8, depthSlope: 40, structure: [{ x: -30, width: 36, reach: 22, density: 1, kind: 'reeds' }, { x: 36, width: 24, reach: 16, density: 0.8, kind: 'reeds' }] },
        catchShare: { 'catfish': 1.6, 'mozambique-tilapia': 1.4 },
      },
    ],
  },
  bronkhorstspruit: {
    boats: ['bass', 'ski'],
    boatNote: 'Boats allowed — bass boats launch from the estates; ski boats on weekends.',
    map: [[12, 24], [26, 16], [42, 20], [58, 14], [74, 18], [88, 28], [82, 42], [66, 46], [52, 56], [38, 50], [24, 52], [12, 40]],
    mapLabels: [{ x: 50, y: 8, text: 'Northern jetties' }, { x: 86, y: 52, text: 'Wall' }],
    pegs: [
      {
        id: 'jetties', name: 'Northern jetties', map: [44, 22],
        blurb: 'The famous stretch: jetties and bridges along the northern shore with lily pads in between. The bass sit right in the pads.',
      },
      {
        id: 'estate-slipway', name: 'Estate slipway', map: [72, 24],
        blurb: 'A private estate\'s free boat launch and demarcated fishing bank. Bass boats come and go; the shallows off the ramp hold bass and kurper.',
        slipway: { x: 20 },
        moored: 2,
        catchShare: { 'largemouth-bass': 1.2 },
      },
      {
        id: 'carp-bay', name: 'Camping bay', map: [28, 48],
        blurb: 'A quiet southern bay with a private campsite on the grass. Carp anglers set up rod pods for the weekend; barbel come in after dark.',
        camp: { x: -22, back: 9, tents: 4, people: 4, bakkie: true, rods: true },
        dam: { structure: [{ x: 30, width: 24, reach: 14, density: 0.7, kind: 'reeds' }] },
        catchShare: { 'common-carp': 1.5, 'catfish': 1.3, 'largemouth-bass': 0.7 },
      },
    ],
  },
  loskop: {
    boats: ['bass', 'ski'],
    boatNote: 'Boats allowed — the resort has a launch, and the yearly Light Tackle Boat competition draws 1500 anglers.',
    map: [[20, 10], [32, 16], [44, 12], [58, 20], [64, 34], [76, 42], [84, 56], [70, 62], [58, 52], [46, 44], [36, 50], [24, 42], [16, 28]],
    mapLabels: [{ x: 18, y: 6, text: 'Wall' }, { x: 84, y: 66, text: 'Olifants R.' }],
    pegs: [
      {
        id: 'forever-resort', name: 'Forever Resort', map: [30, 20],
        blurb: 'The resort shore: a big campsite, a boat launch and designated fishing banks. Carp, kurper and barbel; busy on weekends.',
        camp: { x: -26, back: 10, tents: 5, people: 6, bakkie: true, caravan: true, rods: true },
        slipway: { x: 28 },
        moored: 2,
      },
      {
        id: 'olifants-inlet', name: 'Olifants River inlet', map: [78, 54],
        blurb: 'Where the Olifants comes in over rock and gravel: yellowfish country. Flowing water, boulders and cleaner water.',
        dam: { maxDepth: 10, depthSlope: 30 },
        scenery: { shoreRocks: 34, water: { clarity: 0.6 } },
        catchShare: { 'largescale-yellowfish': 2, 'smallmouth-yellowfish': 2 },
      },
      {
        id: 'wall-rocks', name: 'Wall rocks', map: [22, 14],
        blurb: 'The rocky banks by the wall: deep water a cast out. Big carp and barbel patrol the depth.',
        dam: { maxDepth: 30, depthSlope: 18, bankSteepness: 2 },
        scenery: { shoreRocks: 30 },
        catchShare: { 'common-carp': 1.3, 'catfish': 1.4 },
      },
    ],
  },
  roodeplaat: {
    boats: ['kayak', 'yacht'],
    boatNote: 'Non-motorised boats only — kayaks, canoes and sailing.',
    map: [[14, 30], [28, 20], [44, 22], [60, 16], [76, 22], [88, 34], [78, 46], [62, 44], [50, 54], [36, 48], [22, 46]],
    mapLabels: [{ x: 50, y: 10, text: 'North shore' }, { x: 92, y: 30, text: 'Wall' }, { x: 40, y: 62, text: 'Game reserve (south)' }],
    pegs: [
      {
        id: 'north-camp', name: 'North shore campsite', map: [46, 24],
        blurb: 'Basic campsites on the water\'s edge with braai spots. The main angling shore: bass, kurper and carp.',
        camp: { x: 24, back: 8, tents: 4, people: 5, bakkie: true, rods: true },
      },
      {
        id: 'reed-bay', name: 'Reed bay', map: [20, 38],
        blurb: 'A sheltered western bay ringed with reeds: carp and kurper country, kayakers paddling past.',
        dam: { structure: [{ x: -10, width: 46, reach: 20, density: 1, kind: 'reeds' }, { x: 50, width: 20, reach: 14, density: 0.8, kind: 'pads' }] },
        catchShare: { 'common-carp': 1.4, 'mozambique-tilapia': 1.3, 'largemouth-bass': 0.8 },
      },
      {
        id: 'roodeplaat-wall', name: 'The wall', map: [84, 36],
        blurb: 'Deep water off the rocks at the wall: barbel and the bigger carp hold out in the depth.',
        dam: { maxDepth: 26, depthSlope: 18, bankSteepness: 1.8 },
        scenery: { shoreRocks: 28 },
        catchShare: { 'catfish': 1.5, 'common-carp': 1.2 },
      },
    ],
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out;
}

export const spotsFor = (locationId) => DAM_SPOTS[locationId] || null;

// The location as it is at one spot: its bank, weed, depth, camp, slipway
// and boats, and the catch nudged toward what's caught there. Unknown or no
// spot: the dam's first spot (or the dam as it is, for waters without spots).
export function withPeg(location, pegId) {
  const spots = spotsFor(location.id);
  if (!spots) return location;
  const peg = spots.pegs.find((p) => p.id === pegId) || spots.pegs[0];
  const out = { ...location, peg, pegId: peg.id, boats: spots.boats, boatNote: spots.boatNote };
  if (peg.dam) out.dam = merge(location.dam, peg.dam);
  if (peg.scenery) out.scenery = merge(location.scenery, peg.scenery);
  if (peg.catchShare) {
    out.catchShare = { ...location.catchShare };
    for (const [id, f] of Object.entries(peg.catchShare)) if (out.catchShare[id] != null) out.catchShare[id] *= f;
  }
  out.camp = peg.camp || null;
  out.slipway = peg.slipway || null;
  out.moored = peg.moored || 0;
  return out;
}
