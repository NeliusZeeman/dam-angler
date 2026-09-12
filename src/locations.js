// Six real South African waters, drawn from angling forum/guide reports.
// Each has a genuinely different species mix and a different dam shape --
// `coves` are hand-placed lily-pad/structure zones (angle in radians,
// angular width, how far they pull the shoreline in, and how dense the
// lily pads/reeds are there). Bass-heavy dams get more and denser coves,
// per the forum reports of jetties, timber and lily pads being where the
// bass actually are.
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
    waterTint: { cold: 0x1e5270, warm: 0x2f8a5c },
    grassTint: 0xdfe8d2,
    skyWarmth: 1.0,
    shape: {
      baseRadius: 20.4,
      wobble: 0.9,
      coves: [
        { angle: 0.6, width: 1.1, pull: 3.2, density: 0.8 },
        { angle: 3.6, width: 1.3, pull: 3.6, density: 0.9 },
      ],
    },
  },
  {
    id: 'vaal',
    name: 'Vaal Dam',
    region: 'Free State / Gauteng border',
    blurb: 'Big open Highveld water with drowned forest structure and a strong catch-and-release culture. Carp are the bread and butter, barbel patrol the depths, and a smallmouth bass hiding in the submerged trees is the local unicorn everyone talks about but few land.',
    speciesIds: [
      'common-carp', 'mirror-carp', 'catfish', 'smallmouth-bass', 'banded-tilapia',
    ],
    waterTint: { cold: 0x274a52, warm: 0x3d6b52 },
    grassTint: 0xe8dfb8,
    skyWarmth: 0.9,
    shape: {
      baseRadius: 20.4,
      wobble: 1.1,
      coves: [
        { angle: 1.4, width: 1.0, pull: 3.0, density: 0.7 }, // the drowned forest
        { angle: 4.3, width: 0.9, pull: 2.6, density: 0.6 },
      ],
    },
  },
  {
    id: 'jozini',
    name: 'Lake Jozini (Pongolapoort)',
    region: 'KwaZulu-Natal',
    blurb: "South Africa's southernmost tigerfish water -- warm, subtropical, and famous for explosive strikes off the bank and the dropoffs near the cliffs. Mozambique tilapia, catfish and the odd largemouth bass (washed in from farm dams upstream) round out the lake.",
    speciesIds: [
      'tigerfish', 'largemouth-bass', 'mozambique-tilapia', 'catfish', 'common-carp',
    ],
    waterTint: { cold: 0x1c5a63, warm: 0x2a9a7a },
    grassTint: 0xc9d99a,
    skyWarmth: 1.15,
    shape: {
      baseRadius: 20.4,
      wobble: 1.3, // rugged cliff-and-dropoff coastline
      coves: [
        { angle: 0.9, width: 1.0, pull: 3.4, density: 0.7 },
        { angle: 2.8, width: 0.8, pull: 2.8, density: 0.6 },
        { angle: 5.0, width: 1.0, pull: 3.2, density: 0.7 },
      ],
    },
  },
  {
    id: 'bronkhorstspruit',
    name: 'Bronkhorstspruit Dam',
    region: 'Gauteng',
    blurb: 'A bass factory that produces year-round. Nearly 3km of jetties and bridges line the northern shore, and the lily pads and floating structure in between are exactly where the quality largemouth hide. Flip a spinner or soft plastic right into the pads.',
    speciesIds: [
      'largemouth-bass', 'common-carp', 'mozambique-tilapia', 'catfish',
    ],
    waterTint: { cold: 0x1e4a5c, warm: 0x347a52 },
    grassTint: 0xd8e2c8,
    skyWarmth: 1.0,
    shape: {
      baseRadius: 20.4,
      wobble: 0.8,
      // Bass water: more, wider, denser lily-pad coves than anywhere else.
      coves: [
        { angle: 0.4, width: 1.4, pull: 3.8, density: 1.0 },
        { angle: 1.9, width: 1.2, pull: 3.4, density: 0.95 },
        { angle: 3.5, width: 1.5, pull: 4.0, density: 1.0 },
        { angle: 5.1, width: 1.1, pull: 3.2, density: 0.9 },
      ],
    },
  },
  {
    id: 'loskop',
    name: 'Loskop Dam',
    region: 'Mpumalanga',
    blurb: '"The dam of a thousand casts" -- and home of the South African record largemouth bass at 7.19kg. Steep, timbered banks fold into sheltered pad-choked bays that hold serious fish, with big, wary mirror carp and barbel in the deeper open water between them.',
    speciesIds: [
      'largemouth-bass', 'catfish', 'mirror-carp', 'mozambique-tilapia',
    ],
    waterTint: { cold: 0x1a4550, warm: 0x2e6b48 },
    grassTint: 0xc7d6ad,
    skyWarmth: 0.95,
    shape: {
      baseRadius: 20.4,
      wobble: 1.2, // steep, folded banks
      coves: [
        { angle: 0.2, width: 1.2, pull: 3.6, density: 0.95 },
        { angle: 2.1, width: 1.3, pull: 4.2, density: 1.0 },
        { angle: 3.9, width: 1.1, pull: 3.4, density: 0.9 },
        { angle: 5.5, width: 1.3, pull: 3.8, density: 0.95 },
      ],
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
    waterTint: { cold: 0x224e56, warm: 0x3a7d5a },
    grassTint: 0xe0e6c8,
    skyWarmth: 1.02,
    shape: {
      baseRadius: 20.4,
      wobble: 0.7, // the calmest, most open shoreline of the six
      coves: [
        { angle: 1.1, width: 0.9, pull: 2.6, density: 0.65 },
        { angle: 4.6, width: 0.8, pull: 2.4, density: 0.6 },
      ],
    },
  },
];

export function getLocationById(id) {
  return LOCATIONS.find((loc) => loc.id === id) || LOCATIONS[0];
}
