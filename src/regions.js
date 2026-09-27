// South Africa's nine provinces and their fishing waters -- dams, rivers,
// mountain streams and fly-fishing stillwaters -- from angling forum, venue
// and guide reports (sealine.co.za, fishthesea.co.za, anglinks, carpfishing
// SA, CapeNature, the Cape Piscatorial Society, FOSAF, Wild Trout
// Association, Mission Fly Mag and others; see docs/fishing-spots.md).
//
// Each spot is written compactly (`def`) and expanded by buildSpot() into
// the full location the game uses: its fish and how often each is caught,
// the water (dam or river, colour, clarity, current), the bank cover, the
// landscape it sits in, how warm the water runs, and local tips.

import { seedFromString } from './gfx/noise.js';

export const PROVINCES = [
  { id: 'gauteng', name: 'Gauteng', blurb: 'Big carp and bass dams on the doorstep of Joburg and Pretoria, plus the Vaal Barrage.', offers: ['Carp', 'Bass', 'Barbel', 'Kurper'] },
  { id: 'free-state', name: 'Free State', blurb: 'The Vaal at Parys — SA\'s yellowfish fly-fishing heartland — crystal-clear Sterkfontein, and mountain trout at Clarens.', offers: ['Yellowfish on fly', 'Carp', 'Trout'] },
  { id: 'north-west', name: 'North West', blurb: 'Bushveld dams below the Magaliesberg and the huge Bloemhof on the Vaal.', offers: ['Carp', 'Barbel', 'Bass', 'Yellowfish'] },
  { id: 'mpumalanga', name: 'Mpumalanga', blurb: 'Dullstroom — the flyfishing mecca — record-bass Loskop and Heyshope, and Lowveld rivers with tigerfish.', offers: ['Trout on fly', 'Bass', 'Tigerfish', 'Yellowfish'] },
  { id: 'limpopo', name: 'Limpopo', blurb: 'Hot bushveld bass dams, big barbel, and misty Magoebaskloof trout water.', offers: ['Bass', 'Barbel', 'Trout', 'Kurper'] },
  { id: 'kwazulu-natal', name: 'KwaZulu-Natal', blurb: 'Tigerfish at Jozini, world-class bass at Albert Falls, and wild brown trout in the Midlands and Drakensberg.', offers: ['Tigerfish', 'Bass', 'Brown trout', 'Carp'] },
  { id: 'eastern-cape', name: 'Eastern Cape', blurb: 'Rhodes and the Highlands for trout and yellowfish on fly, Karoo dams and the Fish rivers.', offers: ['Trout on fly', 'Yellowfish', 'Carp', 'Barbel'] },
  { id: 'western-cape', name: 'Western Cape', blurb: 'Wild rainbows in Cape mountain streams, endangered Clanwilliam yellowfish, bass and bluegill dams.', offers: ['Trout on fly', 'Smallmouth bass', 'Clanwilliam yellowfish', 'Bluegill'] },
  { id: 'northern-cape', name: 'Northern Cape', blurb: 'The mighty Orange: largemouth yellowfish at Vanderkloof and Upington, and the lower Vaal.', offers: ['Largemouth yellowfish', 'Carp', 'Barbel', 'Mudfish'] },
];

// What the country around the water looks like. Colours are the ground
// (sand at the edge, rock, dry grass), the grass tint and how warm the sky
// reads; `tempOffset` is how much warmer/colder the water runs than a
// typical Highveld dam (trout need the cold ones).
export const LANDSCAPES = {
  highveld: {
    horizon: { base: 5, rough: 1.5, ridges: [] }, hills: 2.5, trees: { willow: 0.5, acacia: 0.05, gum: 0.45 },
    ground: { sand: 0xc2b08c, rock: 0x978870, straw: 0xdccb96 }, grassTint: 0xe2dcb8, skyWarmth: 0.95,
    treeDensity: 0.55, bushes: 0, shoreRocks: 25, tempOffset: 0,
  },
  bushveld: {
    horizon: { base: 9, rough: 3, ridges: [{ az: 60, width: 0.4, height: 14 }, { az: 200, width: 0.35, height: 10 }] }, hills: 5,
    trees: { willow: 0.2, acacia: 0.7, gum: 0.1 },
    ground: { sand: 0xb08a64, rock: 0x8a6a52, straw: 0xd2b67e }, grassTint: 0xd8d6a8, skyWarmth: 1.05,
    treeDensity: 1.1, bushes: 45, shoreRocks: 35, tempOffset: 2,
  },
  lowveld: {
    horizon: { base: 16, rough: 6, ridges: [{ az: 20, width: 0.8, height: 40 }, { az: 290, width: 0.7, height: 30 }] }, hills: 8,
    trees: { willow: 0.3, acacia: 0.5, gum: 0.2 },
    ground: { sand: 0xa8845e, rock: 0x7a6250, straw: 0xc6c48a }, grassTint: 0xc4d69a, skyWarmth: 1.12,
    treeDensity: 1.4, bushes: 55, shoreRocks: 40, tempOffset: 3,
  },
  escarpment: {
    horizon: { base: 13, rough: 4, ridges: [{ az: 90, width: 1.0, height: 22 }, { az: 250, width: 0.8, height: 18 }] }, hills: 7,
    trees: { willow: 0.45, acacia: 0.0, gum: 0.55 },
    ground: { sand: 0x7a6a54, rock: 0x6a6660, straw: 0xc8bc8a }, grassTint: 0xcfd9a8, skyWarmth: 0.88,
    treeDensity: 0.8, bushes: 5, shoreRocks: 45, tempOffset: -8,
  },
  drakensberg: {
    horizon: { base: 24, rough: 9, ridges: [{ az: 270, width: 1.2, height: 70 }, { az: 200, width: 0.6, height: 45 }, { az: 330, width: 0.5, height: 40 }] }, hills: 11,
    trees: { willow: 0.8, acacia: 0.0, gum: 0.2 },
    ground: { sand: 0x8a7a60, rock: 0x7a7066, straw: 0xd8c690 }, grassTint: 0xd6d4a0, skyWarmth: 0.85,
    treeDensity: 0.35, bushes: 0, shoreRocks: 70, tempOffset: -10,
  },
  midlands: {
    horizon: { base: 11, rough: 3.5, ridges: [{ az: 280, width: 1.0, height: 26 }] }, hills: 7,
    trees: { willow: 0.45, acacia: 0.05, gum: 0.5 },
    ground: { sand: 0x7e6a50, rock: 0x6e6860, straw: 0xc4c890 }, grassTint: 0xc2d690, skyWarmth: 0.92,
    treeDensity: 0.95, bushes: 5, shoreRocks: 30, tempOffset: -3,
  },
  karoo: {
    horizon: { base: 12, rough: 3, ridges: [{ az: 40, width: 0.5, height: 18 }, { az: 160, width: 0.45, height: 16 }, { az: 300, width: 0.4, height: 14 }] }, hills: 6,
    trees: { willow: 0.45, acacia: 0.45, gum: 0.1 },
    ground: { sand: 0xb89a74, rock: 0x8e6e56, straw: 0xc8b088 }, grassTint: 0xd6c9a0, skyWarmth: 1.08,
    treeDensity: 0.4, bushes: 40, shoreRocks: 55, tempOffset: 1,
  },
  orange: {
    horizon: { base: 4, rough: 2, ridges: [{ az: 120, width: 0.3, height: 8 }] }, hills: 2,
    trees: { willow: 0.6, acacia: 0.4, gum: 0.0 },
    ground: { sand: 0xc88a5a, rock: 0x8a5a44, straw: 0xd6b27a }, grassTint: 0xcfd49c, skyWarmth: 1.15,
    treeDensity: 1.2, bushes: 30, shoreRocks: 40, tempOffset: 2,
  },
  fynbos: {
    horizon: { base: 24, rough: 10, ridges: [{ az: 0, width: 0.9, height: 60 }, { az: 180, width: 0.8, height: 55 }, { az: 90, width: 0.5, height: 40 }] }, hills: 12,
    trees: { willow: 0.3, acacia: 0.1, gum: 0.6 },
    ground: { sand: 0x9a8a78, rock: 0x7c7870, straw: 0xa8a47a }, grassTint: 0xb4c49a, skyWarmth: 0.95,
    treeDensity: 0.3, bushes: 60, shoreRocks: 80, tempOffset: -6,
  },
  winelands: {
    horizon: { base: 18, rough: 7, ridges: [{ az: 30, width: 0.9, height: 45 }, { az: 210, width: 0.9, height: 40 }] }, hills: 8,
    trees: { willow: 0.35, acacia: 0.05, gum: 0.6 },
    ground: { sand: 0xb09a80, rock: 0x8a8076, straw: 0xc6b88a }, grassTint: 0xc8d0a0, skyWarmth: 1.0,
    treeDensity: 0.7, bushes: 25, shoreRocks: 40, tempOffset: -2,
  },
  cederberg: {
    horizon: { base: 22, rough: 9, ridges: [{ az: 60, width: 0.8, height: 50 }, { az: 240, width: 0.9, height: 48 }] }, hills: 10,
    trees: { willow: 0.2, acacia: 0.2, gum: 0.6 },
    ground: { sand: 0xc89a6a, rock: 0xa0603e, straw: 0xbcae80 }, grassTint: 0xbcc49a, skyWarmth: 1.1,
    treeDensity: 0.3, bushes: 55, shoreRocks: 85, tempOffset: 0,
  },
};

// Water colour by type: brown silty Highveld/Orange water, green algal
// dams, clear mountain water, tea-brown Cape fynbos rivers (tannins), blue
// deep clear dams.
const TINTS = {
  brown: { cold: 0x5c5444, warm: 0x6e5e40 },
  muddy: { cold: 0x6a5238, warm: 0x7e603c },
  green: { cold: 0x2c4a2e, warm: 0x3e7a34 },
  olive: { cold: 0x3c4a32, warm: 0x52683c },
  clear: { cold: 0x1f4a52, warm: 0x2a6a68 },
  blue: { cold: 0x1f5b6b, warm: 0x2a8590 },
  tea: { cold: 0x3a2a18, warm: 0x5a3e22 },
};

const STRUCTURE_X = [-55, 40, 95, -115, 150];
const STRUCTURE_SIZE = { reeds: [30, 12], timber: [24, 30], pads: [22, 24], hyacinth: [30, 30] };

// Shares must add to exactly 100.
function normaliseShares(fish) {
  const total = Object.values(fish).reduce((a, b) => a + b, 0);
  const out = {};
  let running = 0;
  const entries = Object.entries(fish);
  entries.forEach(([id, v], i) => {
    const share = i === entries.length - 1 ? 100 - running : Math.round((v / total) * 100);
    out[id] = share;
    running += share;
  });
  return out;
}

export function buildSpot(def) {
  const land = LANDSCAPES[def.land] || LANDSCAPES.highveld;
  const flowing = def.kind === 'river' || def.kind === 'stream';
  const rng = seedFromString(def.id);
  const pick = (i) => ((rng * (i + 3) * 9301 + 49297) % 233280) / 233280;
  const structure = (def.structure || []).map((kind, i) => {
    const [width, reach] = STRUCTURE_SIZE[kind] || [24, 20];
    return { x: STRUCTURE_X[i % STRUCTURE_X.length], width: flowing ? width * 0.8 : width, reach: flowing ? Math.min(reach, 8) : reach, density: 0.85 + pick(i) * 0.15, kind };
  });
  const far = def.far ?? (def.kind === 'stream' ? 16 : def.kind === 'river' ? 45 : null);
  const water = {
    shore: {
      wobble: flowing ? 2 : 4,
      features: flowing ? [] : [{ x: -40 + pick(1) * 20, width: 18 + pick(2) * 10, amount: -8 + pick(3) * 20 }, { x: 45 + pick(4) * 20, width: 20, amount: -6 + pick(5) * 18 }],
    },
    structure,
    farShore: far,
    maxDepth: def.depth ?? (def.kind === 'stream' ? 1.6 : def.kind === 'river' ? 4 : 15),
    depthSlope: flowing ? 5 : (def.kind === 'stillwater' ? 12 : 30),
    bankSteepness: def.steep ?? (flowing ? 1.2 : 1),
    beachWidth: def.beach ?? (flowing ? 2 : 3),
    hills: land.hills,
    stands: def.stands ?? (flowing || def.kind === 'stillwater' ? [] : [{ x: 0, length: 5 }]),
    // River current (m/s): a float or fly drifts downstream with it.
    flow: def.flow ?? (def.kind === 'stream' ? 0.45 : def.kind === 'river' ? 0.3 : 0),
  };
  return {
    id: def.id,
    name: def.name,
    province: def.province,
    kind: def.kind,
    fly: !!def.fly,
    region: def.town,
    blurb: def.blurb,
    speciesIds: Object.keys(def.fish),
    catchShare: normaliseShares(def.fish),
    waterTint: TINTS[def.tint] || TINTS.olive,
    grassTint: land.grassTint,
    skyWarmth: land.skyWarmth,
    tempOffset: def.temp ?? land.tempOffset,
    tips: def.tips || [],
    scenery: {
      horizon: def.horizon || land.horizon,
      hills: land.hills,
      trees: land.trees,
      features: def.structure?.includes('timber') ? ['drownedTimber'] : [],
      water: { clarity: def.clarity ?? 0.5, algae: def.algae ?? 0, hyacinth: def.hyacinth ?? 0 },
      ground: land.ground,
      shoreRocks: def.rocks ?? land.shoreRocks,
      treeDensity: def.trees ?? land.treeDensity,
      bushes: land.bushes,
    },
    dam: water,
  };
}

// Tags shown on the spot cards.
export function spotTags(loc) {
  const tags = [loc.kind === 'river' ? 'River' : loc.kind === 'stream' ? 'Mountain stream' : loc.kind === 'stillwater' ? 'Stillwater' : 'Dam'];
  if (loc.fly) tags.push('Fly fishing');
  return tags;
}
