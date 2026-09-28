// What each rod and reel looks like, after the real tackle SA shops sell.
// The shapes are built in rod.js; these are the descriptions.
//
// Rods (lengths are the real rod's, in metres; rough = blank roughness):
//   guides   ring | chunky | casting (small, on top) | snake (fly) |
//            carp (big butt guide) | onePiece (stainless, no insert)
//   grip     foam | splitCork | fullCork | fullWells | cigar | splitEva |
//            shrink | longEva
//   seat     spinning | trigger (reel on top) | fly (reel at the butt) |
//            screw (carp)

export const ROD_MODELS = {
  // Cheap fibreglass starter combo: short, thick, glossy cream glass,
  // chunky chrome guides, plain foam handle.
  'rod-starter': {
    len: 1.8, tipR: 0.0028, buttR: 0.0105, blank: 0xeee2c2, rough: 0.25, metal: 0.05, wrap: 0xb8302a,
    guides: 'chunky', count: 5, grip: 'foam', gripColor: 0x1d1d1d, seat: 'spinning', seatColor: 0x2c2c2c, ferrules: 1,
  },
  // Okuma Fin Chaser-style kurper rod: very slim green graphite, tiny guides,
  // split cork grip.
  'rod-kurper': {
    len: 1.8, tipR: 0.0014, buttR: 0.0062, blank: 0x2c4a30, rough: 0.2, metal: 0.4, wrap: 0xe0c040,
    guides: 'ring', count: 6, butt: 0.015, grip: 'splitCork', seat: 'spinning', seatColor: 0x1a1a1a, ferrules: 1,
  },
  // Everyday 7ft graphite spinning rod: gunmetal blank, full cork handle.
  'rod-spinning': {
    len: 2.1, tipR: 0.0018, buttR: 0.0085, blank: 0x4b525b, rough: 0.18, metal: 0.5, wrap: 0x1f4f9a,
    guides: 'ring', count: 6, butt: 0.021, grip: 'fullCork', seat: 'spinning', seatColor: 0x202226, ferrules: 1,
  },
  // 9ft 5-weight trout rod: long slender olive blank, wire snake guides,
  // full-wells cork grip, reel right at the butt.
  'rod-fly': {
    len: 2.7, tipR: 0.0011, buttR: 0.0072, blank: 0x3c4a2c, rough: 0.35, metal: 0.25, wrap: 0xb08a3a,
    guides: 'snake', count: 9, strippers: 2, butt: 0.013, grip: 'fullWells', seat: 'fly', seatColor: 0x26262a, seatWood: null, ferrules: 3,
  },
  // 7ft 3-weight creek rod: honey-amber glass, cigar grip, wooden reel seat.
  'rod-fly-3wt': {
    len: 2.1, tipR: 0.0012, buttR: 0.0068, blank: 0xb3782e, rough: 0.2, metal: 0.05, wrap: 0x2f6a4a,
    guides: 'snake', count: 7, strippers: 1, butt: 0.011, grip: 'cigar', seat: 'fly', seatColor: 0xb8b8bc, seatWood: 0x7a4a24, ferrules: 2,
  },
  // Crankbait casting rod: guides on top, trigger grip, green blank.
  'rod-bass': {
    len: 2.0, tipR: 0.0016, buttR: 0.0082, blank: 0x1d3a26, rough: 0.15, metal: 0.5, wrap: 0xd8d8d8,
    guides: 'casting', count: 8, butt: 0.011, grip: 'splitEva', gripColor: 0x1b1b1b, seat: 'trigger', seatColor: 0x1c1c1c, ferrules: 0,
  },
  // 7ft medium-heavy baitcasting rod: black and red, trigger grip.
  'rod-baitcast': {
    len: 2.1, tipR: 0.0017, buttR: 0.0088, blank: 0x141418, rough: 0.12, metal: 0.6, wrap: 0xc03030,
    guides: 'casting', count: 9, butt: 0.012, grip: 'splitEva', gripColor: 0x151515, seat: 'trigger', seatColor: 0x151515, ferrules: 0,
  },
  // 12ft 2.75lb carp rod (Daiwa Crosscast-style): matte black woven carbon,
  // big 50mm butt guide, shrink-wrap handle, screw reel seat, line clip.
  'rod-carp': {
    len: 3.6, tipR: 0.0019, buttR: 0.0105, blank: 0x1e1e22, rough: 0.55, metal: 0.25, wrap: 0x3a3a3e, weave: true,
    guides: 'carp', count: 5, butt: 0.03, grip: 'shrink', gripColor: 0x161616, seat: 'screw', seatColor: 0x1a1a1a, ferrules: 1, lineClip: true,
  },
  // Ugly Stik Tiger-style barbel/tiger rod: thick black blank with a
  // see-through clear tip, one-piece stainless guides, long foam grip.
  'rod-heavy': {
    len: 2.1, tipR: 0.0032, buttR: 0.0115, blank: 0x121214, rough: 0.2, metal: 0.4, wrap: 0xd6a73a, clearTip: 0.34,
    guides: 'onePiece', count: 6, butt: 0.02, grip: 'longEva', gripColor: 0x141414, seat: 'spinning', seatColor: 0x121212, ferrules: 0,
  },
};

// Reels:  spinning | bigpit | baitcaster | fly
export const REEL_MODELS = {
  // Small plastic spinning reel: grey body, silver spool.
  'reel-starter': { style: 'spinning', size: 0.85, body: 0x3b3e44, bodyMetal: 0.3, accent: 0xb4b4b8, trim: 0x7a7a80 },
  // Mid-size metal "coffee grinder": gunmetal with blue trim.
  'reel-spinning': { style: 'spinning', size: 1.0, body: 0x3f444c, bodyMetal: 0.75, accent: 0xc8ccd2, trim: 0x2b5fb3 },
  // Big pit (Shimano Ultegra-style): big body, tall cone-shaped long-cast
  // spool, front drag, large handle.
  'reel-bigpit': { style: 'bigpit', size: 1.0, body: 0x2a2a2e, bodyMetal: 0.8, accent: 0xd8d8dc, trim: 0xc9a13a },
  // Low-profile baitcaster, sitting on top of the rod.
  'reel-baitcaster': { style: 'baitcaster', size: 1.0, body: 0x2a3440, bodyMetal: 0.7, accent: 0xc0c4ca, trim: 0xc03030 },
  // Classic narrow click-and-pawl fly reel.
  'reel-fly': { style: 'fly', size: 1.0, body: 0x18181a, bodyMetal: 0.5, accent: 0x9a9aa0, trim: 0x5a5a60, arbor: 'narrow' },
  // Machined large-arbor fly reel with ported sides.
  'reel-fly-disc': { style: 'fly', size: 1.0, body: 0xb8bcc2, bodyMetal: 0.9, accent: 0xd4a640, trim: 0x2a2a2e, arbor: 'large' },
};

export const DEFAULT_ROD = 'rod-starter';
export const DEFAULT_REEL = 'reel-starter';
