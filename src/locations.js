// Three real South African waters, drawn from angling forum/guide reports.
// Each has a genuinely different species mix, matching what anglers
// actually report catching there -- not just a reskin.
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
  },
];

export function getLocationById(id) {
  return LOCATIONS.find((loc) => loc.id === id) || LOCATIONS[0];
}
