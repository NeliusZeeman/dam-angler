// Six real South African waters, drawn from angling forum/guide reports.
// Each has a genuinely different species mix and its own stretch of dam
// shoreline (see dam.js): bays and points, structure zones (lily pads,
// reeds, drowned timber, hyacinth) in metres along the bank, how the depth
// shelves off, how far the far bank is, and the angling stands built out
// over the water. Bass-heavy dams get more and denser structure, per the
// forum reports of jetties, timber and lily pads being where the bass are.
export const LOCATIONS = [
  {
    id: 'hartbeespoort',
    name: 'Hartbeespoort Dam',
    region: 'North West',
    blurb: 'A big, well-stocked Highveld dam below the Magaliesberg. The all-rounder: carp, kurper and barbel patrol the margins, with bass in the structure. Forum wisdom: early morning or late evening, worms for kurper, dough or mielies for carp.',
    // No tigerfish (too far south/cold) and no smallmouth bass (that's a
    // Vaal River fish) -- everything else is fair game here.
    speciesIds: [
      'mozambique-tilapia', 'banded-tilapia', 'common-carp', 'mirror-carp',
      'largemouth-bass', 'catfish',
    ],
    // Share of anglers' catches (%). Carp SA / foranglers: "a great carp
    // destination", mostly commons with the odd mirror; barbel and bass
    // plentiful; kurper numerous but mostly small.
    catchShare: {
      'common-carp': 38, 'catfish': 18, 'largemouth-bass': 14, 'mozambique-tilapia': 14,
      'mirror-carp': 8, 'banded-tilapia': 8,
    },
    waterTint: { cold: 0x2c4a2e, warm: 0x3e7a34 },
    grassTint: 0xdfe8d2,
    skyWarmth: 1.0,
    // Magaliesberg ridge along the north, with the poort (gap) the dam wall sits in.
    scenery: {
      horizon: { base: 10, rough: 3, ridges: [{ az: 90, width: 0.9, height: 34 }, { az: 58, width: 0.45, height: 16 }], notch: { az: 104, width: 0.06, depth: 24 } },
      hills: 5, trees: { willow: 0.5, acacia: 0.25, gum: 0.25 }, features: [],
      // Hypertrophic: vivid green algae scum and drifting water-hyacinth
      // mats, the main dam opening north toward the Magaliesberg.
      water: { clarity: 0.25, algae: 0.3, hyacinth: 900 },
      ground: { sand: 0x8a7a60, rock: 0x7a7468, straw: 0xd0c090 },
      shoreRocks: 10, treeDensity: 1.0, bushes: 20,
    },
    // Fishing the main dam straight off the bank: a hyacinth-choked bay to
    // the east, a reedy point to the west, the Magaliesberg 700m across.
    dam: {
      shore: { wobble: 3, features: [{ x: 42, width: 26, amount: 12 }, { x: -48, width: 20, amount: -8 }] },
      structure: [
        { x: 34, width: 20, reach: 24, density: 0.95, kind: 'hyacinth' },
        { x: -62, width: 26, reach: 16, density: 0.8, kind: 'reeds' },
        { x: 78, width: 16, reach: 20, density: 0.7, kind: 'pads' },
      ],
      farShore: 700, maxDepth: 18, depthSlope: 35, bankSteepness: 1.2, beachWidth: 2, hills: 6,
      stands: [{ x: 0, length: 7 }, { x: -26, length: 5 }, { x: 58, length: 6 }],
    },
  },
  {
    id: 'vaal',
    name: 'Vaal Dam',
    region: 'Free State / Gauteng border',
    blurb: 'Big open Highveld water with drowned forest structure and a strong catch-and-release culture. Shoals of hard-fighting smallmouth yellowfish and carp are the bread and butter, mudfish graze the margins, barbel patrol the depths, and a smallmouth bass hiding in the submerged trees is the local unicorn everyone talks about but few land.',
    speciesIds: [
      'common-carp', 'mirror-carp', 'catfish', 'smallmouth-bass', 'banded-tilapia',
      'smallmouth-yellowfish', 'mudfish',
    ],
    // The "carp nursery": a reported feeder session of 90 fish was 43
    // smallmouth yellowfish, 24 common carp, 11 mudfish and 10 mirrors;
    // barbel common, bass mostly in the tributaries, few kurper.
    catchShare: {
      'smallmouth-yellowfish': 30, 'common-carp': 28, 'catfish': 14, 'mudfish': 11,
      'mirror-carp': 8, 'banded-tilapia': 5, 'smallmouth-bass': 4,
    },
    waterTint: { cold: 0x5c5444, warm: 0x6e5e40 },
    grassTint: 0xe8dfb8,
    skyWarmth: 0.9,
    // Flat, open Highveld grassland to every horizon; drowned trees in the bays.
    scenery: {
      horizon: { base: 5, rough: 1.2, ridges: [] },
      hills: 2.5, trees: { willow: 0.55, acacia: 0.05, gum: 0.4 }, features: ['drownedTimber'],
      // Silt-laden grey-brown water (the "Vaal" is literally the grey-brown
      // river), a huge open expanse to the horizon, pale sandbars and flat
      // sandstone outcrops, near-treeless grassland.
      water: { clarity: 0.05, algae: 0, hyacinth: 0 },
      ground: { sand: 0xc8b89a, rock: 0x9a8a70, straw: 0xe0cf98 },
      shoreRocks: 45, treeDensity: 0.45, bushes: 0,
    },
    // Huge open water straight to the horizon, a sandbar point, drowned
    // timber in the eastern bay, and long gently-shelving silty shallows.
    dam: {
      shore: { wobble: 5, features: [{ x: -36, width: 16, amount: -10 }, { x: 52, width: 30, amount: 14 }] },
      structure: [
        { x: 48, width: 26, reach: 38, density: 0.9, kind: 'timber' },
        { x: -85, width: 30, reach: 12, density: 0.6, kind: 'reeds' },
      ],
      farShore: null, maxDepth: 20, depthSlope: 60, bankSteepness: 0.5, beachWidth: 7, hills: 2,
      stands: [{ x: 0, length: 5 }, { x: 28, length: 4 }],
    },
  },
  {
    id: 'jozini',
    name: 'Lake Jozini (Pongolapoort)',
    region: 'KwaZulu-Natal',
    blurb: "South Africa's southernmost tigerfish water -- warm, subtropical, and famous for explosive strikes off the bank and the dropoffs near the cliffs. Mozambique tilapia, catfish and the odd largemouth bass (washed in from farm dams upstream) round out the lake.",
    speciesIds: [
      'tigerfish', 'largemouth-bass', 'mozambique-tilapia', 'catfish', 'common-carp',
      'largescale-yellowfish',
    ],
    // "Most prevalent: tigerfish, kurper, barbel, yellowfish and carp";
    // everyday catches are small tigers and blue/redbreast kurper.
    catchShare: {
      'tigerfish': 30, 'mozambique-tilapia': 30, 'catfish': 16, 'largescale-yellowfish': 10,
      'common-carp': 8, 'largemouth-bass': 6,
    },
    waterTint: { cold: 0x1f5b6b, warm: 0x2a8590 },
    grassTint: 0xc9d99a,
    skyWarmth: 1.15,
    // The Lebombo mountains to the east, split by the Pongolapoort gorge.
    scenery: {
      horizon: { base: 14, rough: 6, ridges: [{ az: 12, width: 0.7, height: 46 }, { az: -32, width: 0.6, height: 40 }], notch: { az: -8, width: 0.09, depth: 42 } },
      hills: 7, trees: { willow: 0.05, acacia: 0.75, gum: 0.2 }, features: [],
      // Deep, clear blue-green water opening east into the gorge, red-brown
      // rocky banks and thick subtropical bushveld.
      water: { clarity: 0.85, algae: 0, hyacinth: 0 },
      ground: { sand: 0xb08060, rock: 0x8a6a58, straw: 0xc8b070 },
      shoreRocks: 35, treeDensity: 1.3, bushes: 70,
    },
    // Deep water dropping off fast below rocky red banks, timber on the
    // drop-offs, and the Lebombo mountains rising straight out of the lake
    // 550m across.
    dam: {
      shore: { wobble: 4, features: [{ x: -42, width: 18, amount: 10 }, { x: 36, width: 14, amount: -12 }] },
      structure: [
        { x: 32, width: 16, reach: 22, density: 0.85, kind: 'timber' },
        { x: -52, width: 20, reach: 12, density: 0.6, kind: 'reeds' },
      ],
      farShore: 550, maxDepth: 30, depthSlope: 22, bankSteepness: 2.2, beachWidth: 2, hills: 10,
      stands: [{ x: 0, length: 6 }],
    },
  },
  {
    id: 'bronkhorstspruit',
    name: 'Bronkhorstspruit Dam',
    region: 'Gauteng',
    blurb: 'A bass factory that produces year-round. Nearly 3km of jetties and bridges line the northern shore, and the lily pads and floating structure in between are exactly where the quality largemouth hide. Flip a spinner or soft plastic right into the pads.',
    speciesIds: [
      'largemouth-bass', 'common-carp', 'mozambique-tilapia', 'catfish', 'largescale-yellowfish',
    ],
    // "Carp is the most popular species at Bronkies" (lots of small ones),
    // the jetty-lined north shore is known bass water, and the dam is a
    // breeding ground for (Olifants-system largescale) yellowfish.
    catchShare: {
      'common-carp': 36, 'largemouth-bass': 26, 'mozambique-tilapia': 15, 'catfish': 13,
      'largescale-yellowfish': 10,
    },
    waterTint: { cold: 0x5a5a40, warm: 0x7a6a44 },
    grassTint: 0xd8e2c8,
    skyWarmth: 1.0,
    // Rolling hills and a shoreline lined with little angling jetties.
    scenery: {
      horizon: { base: 9, rough: 2, ridges: [{ az: 200, width: 1.2, height: 10 }] },
      hills: 4, trees: { willow: 0.45, acacia: 0.2, gum: 0.35 }, features: ['jetties'],
      // Light-brown water thick with water-grass, open treeless grassland
      // right up to the banks.
      water: { clarity: 0.2, algae: 0, hyacinth: 0 },
      ground: { sand: 0xa89878, rock: 0x8a8272, straw: 0xd8c890 },
      shoreRocks: 6, treeDensity: 0.35, bushes: 5,
    },
    // Grassy banks lined with angling jetties, two big lily-pad bays and
    // water-grass along the whole margin.
    dam: {
      shore: { wobble: 2, features: [{ x: 46, width: 30, amount: 10 }, { x: -52, width: 26, amount: 8 }] },
      structure: [
        { x: 42, width: 30, reach: 28, density: 1.0, kind: 'pads' },
        { x: -48, width: 28, reach: 25, density: 0.95, kind: 'pads' },
        { x: 0, width: 70, reach: 8, density: 0.7, kind: 'reeds' },
      ],
      farShore: 450, maxDepth: 12, depthSlope: 40, bankSteepness: 0.7, beachWidth: 1.5, hills: 4,
      stands: [
        { x: 0, length: 8 }, { x: -62, length: 7 }, { x: -34, length: 9 }, { x: 22, length: 6 },
        { x: 48, length: 9 }, { x: 74, length: 7 },
      ],
    },
  },
  {
    id: 'loskop',
    name: 'Loskop Dam',
    region: 'Mpumalanga',
    blurb: '"The dam of a thousand casts" -- and home of the South African record largemouth bass at 7.19kg. Steep, timbered banks fold into sheltered pad-choked bays that hold serious fish, with big, wary mirror carp and barbel in the deeper open water between them.',
    speciesIds: [
      'largemouth-bass', 'catfish', 'mirror-carp', 'mozambique-tilapia', 'common-carp', 'mudfish',
      'largescale-yellowfish',
    ],
    // Record Florida bass water, "known for carp, barbel and kurper for
    // generations"; lots of 0.5-2kg carp along the banks, mudfish around
    // the inlets, and native largescale yellowfish (fly and artlure water).
    catchShare: {
      'largemouth-bass': 26, 'mozambique-tilapia': 18, 'common-carp': 18, 'catfish': 14,
      'largescale-yellowfish': 10, 'mudfish': 7, 'mirror-carp': 7,
    },
    waterTint: { cold: 0x1e4a48, warm: 0x2e6e58 },
    grassTint: 0xc7d6ad,
    skyWarmth: 0.95,
    // Rugged Mpumalanga mountains all round, timber standing in the bays.
    scenery: {
      horizon: { base: 18, rough: 7, ridges: [{ az: 70, width: 0.8, height: 30 }, { az: 250, width: 1.0, height: 26 }] },
      hills: 9, trees: { willow: 0.2, acacia: 0.55, gum: 0.25 }, features: ['drownedTimber'],
      // Clear green water in a steep valley of red Waterberg sandstone
      // cliffs, rocky grassland running into bushveld.
      water: { clarity: 0.75, algae: 0, hyacinth: 0 },
      ground: { sand: 0xa87858, rock: 0x9a6450, straw: 0xc8b478 },
      shoreRocks: 40, treeDensity: 1.2, bushes: 60,
    },
    // A steep valley: rock and sandstone falling straight into deep water,
    // pad-choked bays either side, timber off the point, the far wall only
    // 280m away.
    dam: {
      shore: { wobble: 4, features: [{ x: -36, width: 22, amount: 14 }, { x: 42, width: 18, amount: -10 }] },
      structure: [
        { x: -36, width: 22, reach: 26, density: 1.0, kind: 'pads' },
        { x: 46, width: 20, reach: 25, density: 0.9, kind: 'timber' },
        { x: 82, width: 16, reach: 22, density: 0.9, kind: 'pads' },
      ],
      farShore: 280, maxDepth: 25, depthSlope: 25, bankSteepness: 2.5, beachWidth: 1.5, hills: 12,
      stands: [{ x: 0, length: 6 }, { x: -62, length: 5 }],
    },
  },
  {
    id: 'roodeplaat',
    name: 'Roodeplaat Dam',
    region: 'Gauteng',
    blurb: "A Pretoria local favourite -- the northern arm is where anglers go for bass, carp and kurper, with barbel in the deeper water. A friendlier, more open dam than Bronkhorstspruit or Loskop, with just a couple of sheltered bays worth working.",
    speciesIds: [
      'largemouth-bass', 'mozambique-tilapia', 'banded-tilapia', 'common-carp', 'catfish',
    ],
    // Local reports: 10-12kg carp and a "prolific" barbel population,
    // with bass and kurper along the northern shore.
    catchShare: {
      'common-carp': 36, 'catfish': 24, 'largemouth-bass': 15, 'mozambique-tilapia': 15, 'banded-tilapia': 10,
    },
    waterTint: { cold: 0x44503a, warm: 0x566840 },
    grassTint: 0xe0e6c8,
    skyWarmth: 1.02,
    // Bushveld koppies dotted around a gentle, open dam.
    scenery: {
      horizon: { base: 8, rough: 2.5, ridges: [{ az: 120, width: 0.3, height: 16 }, { az: 30, width: 0.25, height: 12 }] },
      hills: 4, trees: { willow: 0.4, acacia: 0.4, gum: 0.2 }, features: [],
      // Brown-green water with a few hyacinth rafts, thorn-tree bushveld and
      // koppies all round.
      water: { clarity: 0.3, algae: 0.08, hyacinth: 150 },
      ground: { sand: 0x9c8a6c, rock: 0x8a7e6c, straw: 0xd0c090 },
      shoreRocks: 15, treeDensity: 1.0, bushes: 45,
    },
    // An easy-going bushveld bank: one lily-pad bay, a hyacinth raft, reeds
    // along the margin, the far bank 380m off.
    dam: {
      shore: { wobble: 3, features: [{ x: 40, width: 20, amount: 9 }] },
      structure: [
        { x: 40, width: 18, reach: 20, density: 0.75, kind: 'pads' },
        { x: -46, width: 15, reach: 15, density: 0.5, kind: 'hyacinth' },
        { x: -10, width: 40, reach: 10, density: 0.6, kind: 'reeds' },
      ],
      farShore: 380, maxDepth: 14, depthSlope: 35, bankSteepness: 1.1, beachWidth: 2.5, hills: 5,
      stands: [{ x: 0, length: 6 }, { x: 30, length: 5 }],
    },
  },
];

export function getLocationById(id) {
  return LOCATIONS.find((loc) => loc.id === id) || LOCATIONS[0];
}
