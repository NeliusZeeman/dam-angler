// Real SA shop tackle: the most popular freshwater rods, reels and combos at
// Jacita Bait & Tackle (jacita.co.za, Sept 2026), each built from its
// maker's spec sheet. Prices are the shop's rand price; in the game an item
// costs about half its rand price in credits.
//
// The game stats are worked out from the real specs (see rod() and reel()
// below) so a rod with a higher line class really is stronger, a longer rod
// really casts further, and a reel with more drag really fights better.

const FT = 0.3048;
const LB = 0.4536;
const credits = (rand) => Math.max(40, Math.round((rand * 0.5) / 10) * 10);
const tierFor = (rand) => (rand < 600 ? 1 : rand < 1300 ? 2 : 3);
const r2 = (x) => Math.round(x * 100) / 100;
const half = (x) => Math.round(x * 2) / 2;
const rands = (n) => `R${Math.round(n).toLocaleString('en-ZA')}`;

// ─── Rods ────────────────────────────────────────────────────────────────────
// blank: glass | composite | carbon24 | carbon30 | carbon36 (tons of the
// carbon: higher = lighter, crisper, casts further).
const BLANK_CAST = { glass: -1, composite: -0.5, carbon24: 0, carbon30: 0.5, carbon36: 1 };
const BLANK_AIM = { glass: 0.8, composite: 0.4, carbon24: 0, carbon30: -0.1, carbon36: -0.2 };
const BLANK_CUSHION = { glass: 0.1, composite: 0.05, carbon24: 0, carbon30: 0, carbon36: 0 };
// Real action -> where it bends on the game's blank, and how much a lunge is
// soaked up before it reaches the line.
const ACTION = {
  'extra-fast': { game: 'fast', flex: 0.5, shock: 0.05 },
  fast: { game: 'fast', flex: 0.62, shock: 0.1 },
  'moderate-fast': { game: 'moderate', flex: 0.85, shock: 0.2 },
  moderate: { game: 'moderate', flex: 1.0, shock: 0.3 },
  through: { game: 'through', flex: 1.45, shock: 0.45 },
};
const POWER_SOFT = { light: 1.45, 'medium-light': 1.25, medium: 1.1, 'medium-heavy': 0.95, heavy: 0.72 };

function rod(s) {
  const len = s.ft * FT;
  const carp = !!s.tcLb;
  const maxKg = carp ? half(s.tcLb * 4.4) : half(s.lineKg[1]);
  const act = ACTION[s.action];
  const soft = carp ? 1.15 - (s.tcLb - 2.75) * 0.25 : POWER_SOFT[s.power];
  const spec = [
    `${len.toFixed(2)} m`,
    carp ? `${(s.tcLb * LB).toFixed(2)} kg test curve` : `${s.lineKg[0]}–${s.lineKg[1]} kg line`,
    s.lureG ? `${s.lureG[0]}–${s.lureG[1]} g ${carp ? 'casting weight' : 'lures'}` : null,
    `${s.action.replace('-', ' ')} action`,
  ].filter(Boolean).join(' · ');
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    tier: tierFor(s.rand),
    cost: credits(s.rand),
    priceR: s.rand,
    lengthM: r2(len),
    maxKg,
    castSpeed: half(8 + 7 * len + BLANK_CAST[s.blank] + (carp ? 1.5 : 0)),
    spread: r2(Math.max(0.9, (s.casting ? 1.2 : carp ? 2.9 : 2.2) + BLANK_AIM[s.blank] + (s.ft <= 9 && carp ? -0.6 : 0))),
    tensionTolerance: r2(Math.min(2.4, 0.9 + maxKg * 0.075)),
    action: act.game,
    power: s.powerLabel || s.power || (s.tcLb >= 3.5 ? 'heavy' : s.tcLb >= 3 ? 'medium-heavy' : 'medium'),
    flex: { length: act.flex, softness: r2(soft + (s.blank === 'glass' ? 0.15 : 0)) },
    shockAbsorb: r2(Math.min(0.6, act.shock + BLANK_CUSHION[s.blank] + (carp ? 0.1 : 0))),
    ...(s.biteBonus ? { biteBonus: s.biteBonus } : {}),
    note: `${spec} · ${s.note ? `${s.note} · ` : ''}${rands(s.rand)} in SA shops`,
    sections: s.sections,
    ...(s.comboOnly ? { comboOnly: true } : {}),
    // How it looks (see gfx/rodModels.js): the base model plus this rod's
    // own length, colours, grip and guides.
    model: { ...s.look, len: r2(len) },
  };
}

const BASS = { 'largemouth-bass': 1.08, 'smallmouth-bass': 1.08 };
const FINESSE = { 'largemouth-bass': 1.12, 'smallmouth-bass': 1.15, 'smallmouth-yellowfish': 1.1, 'largescale-yellowfish': 1.08 };
const TIGER = { tigerfish: 1.12 };

const SPIN = { base: 'rod-spinning' };
const CAST = { base: 'rod-baitcast' };
const CARP = { base: 'rod-carp' };

export const SHOP_RODS = [
  // ── Bass & estuary rods ──
  rod({ id: 'rod-shimano-scimitar-spin', brand: 'Shimano', name: 'Shimano Scimitar Spin 2pc (2.13m ML)', rand: 640, ft: 7, power: 'medium-light', action: 'fast', lineKg: [2.7, 5.4], lureG: [3, 14], blank: 'carbon30',
    biteBonus: FINESSE, note: 'Titanium-oxide guides, cork and EVA', sections: ['bass', 'general'],
    look: { ...SPIN, blank: 0x2a2c30, wrap: 0xa0a0a8, grip: 'fullCork', tipR: 0.0016, buttR: 0.0078 } }),
  rod({ id: 'rod-daiwa-black-spin', brand: 'Daiwa', name: 'Daiwa Black Spin 2pc (2.13m M)', rand: 570, ft: 7, power: 'medium', action: 'fast', lineKg: [3.6, 7.3], lureG: [5, 21], blank: 'carbon24',
    biteBonus: BASS, sections: ['bass', 'general'],
    look: { ...SPIN, blank: 0x111113, wrap: 0x2a2a2e, grip: 'splitEva', gripColor: 0x121212 } }),
  rod({ id: 'rod-sensation-rapid-spin', brand: 'Sensation', name: 'Sensation Rapid Spin 2pc (2.13m M)', rand: 369, ft: 7, power: 'medium', action: 'fast', lineKg: [3, 7], lureG: [5, 20], blank: 'carbon24',
    note: 'Dynaflow guides, EVA and cork', sections: ['bass', 'general'],
    look: { ...SPIN, blank: 0x5a1a1e, wrap: 0xc8c8c8, grip: 'fullCork' } }),
  rod({ id: 'rod-sensation-power-plus-finesse', brand: 'Sensation', name: 'Sensation Power Plus Finesse 2pc (2.13m)', rand: 749, ft: 7, power: 'medium-light', action: 'moderate-fast', lineKg: [2.7, 5.4], lureG: [3, 12], blank: 'composite',
    biteBonus: FINESSE, note: 'Duraflex blank, Fuji guides — light lures for shy bass and yellows', sections: ['bass'],
    look: { ...SPIN, blank: 0x18181a, wrap: 0xd4a640, grip: 'splitEva', gripColor: 0x161616, tipR: 0.0014, buttR: 0.0074 } }),
  rod({ id: 'rod-jarvis-karbonite', brand: 'Jarvis Walker', name: 'Jarvis Walker Karbonite 2pc (2.13m M)', rand: 485, ft: 7, power: 'medium', action: 'fast', lineKg: [3, 8], lureG: [7, 28], blank: 'carbon24',
    sections: ['bass', 'general'],
    look: { ...SPIN, blank: 0x1a1e2a, wrap: 0x2a7ad8, grip: 'splitEva', gripColor: 0x1f5fbf } }),
  rod({ id: 'rod-okuma-pulse-spin', brand: 'Okuma', name: 'Okuma Pulse Spin 2pc (2.13m M)', rand: 769, ft: 7, power: 'medium', action: 'fast', lineKg: [3.6, 7.3], lureG: [7, 21], blank: 'carbon30',
    biteBonus: BASS, sections: ['bass'],
    look: { ...SPIN, blank: 0x4a4a30, wrap: 0x8a8a5a, grip: 'splitEva', gripColor: 0x8a7a55 } }),
  rod({ id: 'rod-okuma-psycho-stick', brand: 'Okuma', name: 'Okuma Psycho Stick Cast (2.13m MH)', rand: 999, ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [5.4, 11.3], lureG: [10, 28], blank: 'carbon36', casting: true,
    biteBonus: BASS, note: '46-ton carbon, Fuji KW guides', sections: ['bass', 'predator'],
    look: { ...CAST, blank: 0xd8dde0, wrap: 0x2a9ad8, grip: 'splitEva', gripColor: 0x6f7f62 } }),
  rod({ id: 'rod-shimano-scimitar-cast', brand: 'Shimano', name: 'Shimano Scimitar Cast 2pc (1.98m MH)', rand: 599, ft: 6.5, power: 'medium-heavy', action: 'fast', lineKg: [4.5, 9], lureG: [10, 28], blank: 'carbon30', casting: true,
    biteBonus: BASS, sections: ['bass'],
    look: { ...CAST, blank: 0x1c1c20, wrap: 0xa0a0a8, grip: 'fullCork' } }),
  rod({ id: 'rod-shimano-clarus-spin', brand: 'Shimano', name: 'Shimano Clarus Spin 2pc (2.13m MH)', rand: 1280, ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [4.5, 9], lureG: [7, 28], blank: 'carbon30',
    biteBonus: BASS, note: '30-ton blank, Fuji seat, AA cork', sections: ['bass', 'predator'],
    look: { ...SPIN, blank: 0x1e3a2a, wrap: 0x3a6a4a, grip: 'fullCork' } }),
  rod({ id: 'rod-okuma-hakai-cast', brand: 'Okuma', name: 'Okuma Hakai Cast 1pc (2.13m MH)', rand: 1799, ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [5.4, 11], lureG: [10, 35], blank: 'carbon36', casting: true,
    biteBonus: { 'largemouth-bass': 1.12, 'smallmouth-bass': 1.1 }, note: 'One piece: no joint, crisp and sensitive', sections: ['bass', 'predator'],
    look: { ...CAST, blank: 0x141416, wrap: 0xc02828, grip: 'splitEva', gripColor: 0x141414, ferrules: 0 } }),
  rod({ id: 'rod-13-omen-black', brand: '13 Fishing', name: '13 Fishing Omen Black Cast (2.18m MH)', rand: 1199, ft: 7.17, power: 'medium-heavy', action: 'extra-fast', lineKg: [5.4, 11.3], lureG: [10, 28], blank: 'carbon36', casting: true,
    biteBonus: { 'largemouth-bass': 1.12, 'smallmouth-bass': 1.1 }, note: 'Toray 36-ton, Alps guides, split cork', sections: ['bass', 'predator'],
    look: { ...CAST, blank: 0x0e0e10, wrap: 0x3a3a3e, grip: 'splitCork' } }),
  rod({ id: 'rod-okuma-wave-power', brand: 'Okuma', name: 'Okuma Wave Power Pro 2pc (2.13m M)', rand: 440, ft: 7, power: 'medium', action: 'moderate-fast', lineKg: [4, 8], lureG: [7, 28], blank: 'composite',
    sections: ['bass', 'general'],
    look: { ...SPIN, blank: 0x5a5e66, wrap: 0x2a2a2a, grip: 'splitEva', gripColor: 0x222222 } }),

  // ── Carp rods ──
  rod({ id: 'rod-okuma-barbarian-lr', brand: 'Okuma', name: 'Okuma Barbarian Low Rider (3.66m)', rand: 849, ft: 12, tcLb: 3.5, action: 'moderate-fast', blank: 'carbon24',
    note: 'Low-rider anti-tangle guides, camo EVA', sections: ['carp'],
    look: { ...CARP, blank: 0x1c1c1e, wrap: 0x4a4a44, grip: 'longEva', gripColor: 0x55554a, weave: false } }),
  rod({ id: 'rod-sensation-short-range', brand: 'Sensation', name: 'Sensation Short Range Tactical (2.74m)', rand: 1049, ft: 9, tcLb: 2.75, action: 'moderate-fast', lureG: [7, 56], blank: 'carbon24',
    biteBonus: { 'common-carp': 1.06, 'mirror-carp': 1.06 }, note: 'Short and accurate for carp feeding close in', sections: ['carp'],
    look: { ...CARP, blank: 0x3a4030, wrap: 0x5a6a3a, grip: 'longEva', gripColor: 0x55653a, weave: false } }),
  rod({ id: 'rod-adrenalin-eco-tech', brand: 'Adrenalin', name: 'Adrenalin Eco Tech (3.66m)', rand: 440, ft: 12, tcLb: 2.5, action: 'moderate', blank: 'composite',
    note: 'Budget composite, slow-medium — forgiving', sections: ['carp', 'general'],
    look: { ...CARP, blank: 0x1a1a1c, wrap: 0x9a9aa0, grip: 'shrink', weave: false } }),
  rod({ id: 'rod-sensation-dc-booster', brand: 'Sensation', name: 'Sensation DC Booster Carp Low Rider (3.81m)', rand: 1999, ft: 12.5, tcLb: 3.75, action: 'moderate-fast', lureG: [30, 105], blank: 'carbon36',
    note: '36-ton blank, Fuji seat, AAA cork — a distance caster', sections: ['carp'],
    look: { ...CARP, blank: 0x3e4c62, wrap: 0xc8c8cc, grip: 'fullCork', seat: 'screw', weave: false } }),
  rod({ id: 'rod-adrenalin-blixem-evo', brand: 'Adrenalin', name: 'Adrenalin Blixem Evo (3.66m)', rand: 999, ft: 12, tcLb: 3, action: 'moderate-fast', blank: 'carbon24',
    note: 'Slim graphite, K-type guides', sections: ['carp'],
    look: { ...CARP, blank: 0x18181a, wrap: 0x8a7a50, grip: 'longEva', gripColor: 0x5a4f3a, weave: false } }),
  rod({ id: 'rod-sensation-rocket-ng', brand: 'Sensation', name: 'Sensation Rocket New Generation (3.66m)', rand: 1699, ft: 12, tcLb: 3.65, action: 'moderate-fast', lureG: [25, 100], blank: 'carbon36',
    note: '36-ton X carbon: light, fast recovery, built for power casting', sections: ['carp'],
    look: { ...CARP, blank: 0x1a1a1c, wrap: 0xb02020, grip: 'fullCork', weave: false } }),
  rod({ id: 'rod-okuma-8k-specimen', brand: 'Okuma', name: 'Okuma 8K Specimen (3.66m)', rand: 1730, ft: 12, tcLb: 3.5, action: 'moderate-fast', blank: 'carbon30',
    note: 'Toray 30-ton, Fuji DPS seat, SiC guides, shrink handle', sections: ['carp'],
    look: { ...CARP, blank: 0x1e1e22, wrap: 0x2a2a2e, grip: 'shrink', weave: true } }),
  rod({ id: 'rod-bat-shadow-carp', brand: 'B.A.T', name: 'B.A.T Shadow Carp (3.66m)', rand: 600, ft: 12, tcLb: 3, action: 'moderate-fast', blank: 'carbon24',
    sections: ['carp'],
    look: { ...CARP, blank: 0x141416, wrap: 0xa01818, grip: 'longEva', gripColor: 0x141414, weave: false } }),
  rod({ id: 'rod-adrenalin-carp-killer', brand: 'Adrenalin', name: 'Adrenalin Carp Killer III (2.44m)', rand: 279, ft: 8, tcLb: 2.5, action: 'moderate', blank: 'composite',
    note: 'Cheap and cheerful short carp rod', sections: ['carp', 'general'],
    look: { ...CARP, blank: 0x161618, wrap: 0xc02020, grip: 'foam', gripColor: 0x151515, weave: false } }),
  rod({ id: 'rod-okuma-inception', brand: 'Okuma', name: 'Okuma Inception 2pc (3.66m)', rand: 1299, ft: 12, tcLb: 3, action: 'moderate-fast', blank: 'carbon24',
    sections: ['carp'],
    look: { ...CARP, blank: 0x1a1a1c, wrap: 0x2a5aa8, grip: 'fullCork', weave: false } }),
  rod({ id: 'rod-okuma-tornado', brand: 'Okuma', name: 'Okuma Tornado (3.66m)', rand: 1699, ft: 12, tcLb: 3.5, action: 'moderate-fast', blank: 'carbon36',
    note: '36-ton Toray, low-rider guides, cork and rubber-cork', sections: ['carp'],
    look: { ...CARP, blank: 0x18181a, wrap: 0xc9a13a, grip: 'fullCork', weave: false } }),
  rod({ id: 'rod-mitchell-catapult-pro', brand: 'Mitchell', name: 'Mitchell Catapult Pro Carp (3.96m)', rand: 899, ft: 13, tcLb: 3.5, action: 'moderate-fast', blank: 'carbon30',
    note: 'A 3.96 m distance rod', sections: ['carp'],
    look: { ...CARP, blank: 0x26282c, wrap: 0x8a8a8e, grip: 'shrink', weave: false } }),

  // ── Tigerfish rods ──
  rod({ id: 'rod-sensation-tiger-tamer-3', brand: 'Sensation', name: 'Sensation Tiger Tamer Travel 3pc (2.24m MH)', rand: 1699, ft: 7.33, power: 'medium-heavy', action: 'fast', lineKg: [6.8, 13.6], lureG: [20, 80], blank: 'carbon30',
    biteBonus: TIGER, note: 'Packs down to ~80 cm for the plane to Jozini or the Zambezi', sections: ['predator'],
    look: { ...SPIN, blank: 0x3a4038, wrap: 0xd4a640, grip: 'splitEva', gripColor: 0x4a4e48, tipR: 0.0024, buttR: 0.0095, ferrules: 2, butt: 0.022 } }),
  rod({ id: 'rod-sensation-tiger-tamer-4', brand: 'Sensation', name: 'Sensation Tiger Tamer Travel 4pc (2.24m MH)', rand: 2325, ft: 7.33, power: 'medium-heavy', action: 'fast', lineKg: [6.8, 13.6], lureG: [20, 80], blank: 'carbon30',
    biteBonus: TIGER, note: 'Four pieces, ~60 cm packed, semi-rigid case', sections: ['predator'],
    look: { ...SPIN, blank: 0x3a4038, wrap: 0xd4a640, grip: 'splitEva', gripColor: 0x4a4e48, tipR: 0.0024, buttR: 0.0095, ferrules: 3, butt: 0.022 } }),
  rod({ id: 'rod-shimano-beastmaster-tiger', brand: 'Shimano', name: 'Shimano Beastmaster Special Tiger Spin 3pc (2.13m H)', rand: 2299, ft: 7, power: 'heavy', action: 'fast', lineKg: [6.8, 13.6], lureG: [10, 28], blank: 'carbon30',
    biteBonus: TIGER, note: 'Fuji Alconite guides, split EVA, up to 8 kg drag', sections: ['predator'],
    look: { ...SPIN, blank: 0x121214, wrap: 0xd4a640, grip: 'splitEva', gripColor: 0x121212, tipR: 0.0026, buttR: 0.01, ferrules: 2, butt: 0.022 } }),
];

// ─── Reels ───────────────────────────────────────────────────────────────────
// style: baitcaster | baitrunner (free-spool lever for carp and barbel) |
// bigpit (big long-cast spool, front drag).
const CARP_FISH = { 'common-carp': 1.08, 'mirror-carp': 1.08, catfish: 1.06 };

function reel(s) {
  const premium = !!s.premium;
  const dragBonus = r2(Math.min(0.45, 0.04 + s.dragKg * 0.014 + (premium ? 0.06 : 0) + Math.min(0.04, s.bearings * 0.004)));
  const cast = s.style === 'baitcaster'
    ? 1.15 + (premium ? 0.05 : 0) + (s.dc ? 0.05 : 0) + Math.min(0.04, s.bearings * 0.005)
    : 1.2 + (s.longCast ? 0.12 : 0) + (s.style === 'bigpit' ? 0.06 : 0) + (premium ? 0.03 : 0);
  const free = s.style === 'baitrunner' || s.freeSpool;
  return {
    id: s.id,
    name: s.name,
    brand: s.brand,
    tier: tierFor(s.rand),
    cost: credits(s.rand),
    priceR: s.rand,
    castMultiplier: r2(cast),
    dragBonus,
    dragKg: s.dragKg,
    ...(free ? { baitrunner: true, biteBonus: CARP_FISH } : {}),
    note: [
      s.ratio ? `${s.ratio}:1` : null,
      `${s.dragKg} kg drag`,
      `${s.bearings} bearings`,
      free ? 'free-spool baitrunner — carp and barbel run off with the bait and hook themselves' : null,
      s.note,
      `${rands(s.rand)} in SA shops`,
    ].filter(Boolean).join(' · '),
    sections: s.sections,
    ...(s.comboOnly ? { comboOnly: true } : {}),
    model: { style: s.style === 'baitcaster' ? 'baitcaster' : s.style === 'bigpit' ? 'bigpit' : 'spinning', baitrunner: free, ...s.look },
  };
}

export const SHOP_REELS = [
  // ── Baitcasters ──
  reel({ id: 'reel-shimano-slx-150xg', brand: 'Shimano', name: 'Shimano SLX 150XG A (Baitcaster)', rand: 1599, style: 'baitcaster', ratio: 8.2, dragKg: 5, bearings: 4, premium: true, note: 'Hagane body, SVS Infinity brakes', sections: ['bass', 'predator'],
    look: { body: 0x1c1e22, bodyMetal: 0.6, accent: 0x2a7ad8, trim: 0x2a7ad8 } }),
  reel({ id: 'reel-13-modus-sz2', brand: '13 Fishing', name: '13 Fishing Modus SZ2 (Baitcaster)', rand: 2355, style: 'baitcaster', ratio: 7.3, dragKg: 8, bearings: 8, premium: true, note: 'Aluminium frame, Hamai-cut gear', sections: ['bass', 'predator'],
    look: { body: 0x8a8e96, bodyMetal: 0.8, accent: 0xc8c8cc, trim: 0x7a4ab8, knob: 0xb8a8e0 } }),
  reel({ id: 'reel-okuma-ceymar-c100h', brand: 'Okuma', name: 'Okuma Ceymar C-100H (Baitcaster)', rand: 899, style: 'baitcaster', ratio: 7.2, dragKg: 5, bearings: 6, sections: ['bass'],
    look: { body: 0x1a1a1c, bodyMetal: 0.5, accent: 0xb02020, trim: 0xc02828 } }),
  reel({ id: 'reel-banax-zest', brand: 'Banax', name: 'Banax Zest (Baitcaster)', rand: 859, style: 'baitcaster', ratio: 7.3, dragKg: 9, bearings: 5, note: 'Magnetic cast control', sections: ['bass', 'predator'],
    look: { body: 0x5a5e66, bodyMetal: 0.5, accent: 0x2a5ae0, trim: 0x1f4fd8 } }),
  reel({ id: 'reel-adrenalin-adr109', brand: 'Adrenalin', name: 'Adrenalin ADR 109 (Baitcaster)', rand: 899, style: 'baitcaster', ratio: 7.1, dragKg: 7, bearings: 6, note: 'Carbon drag washers', sections: ['bass', 'predator'],
    look: { body: 0x3a3a3e, bodyMetal: 0.7, accent: 0xc0c0c4, trim: 0xc02020 } }),
  reel({ id: 'reel-adrenalin-adr101', brand: 'Adrenalin', name: 'Adrenalin ADR 101 (Baitcaster)', rand: 569, style: 'baitcaster', ratio: 6.3, dragKg: 5, bearings: 4, sections: ['bass'],
    look: { body: 0x202022, bodyMetal: 0.4, accent: 0x8a8a8e, trim: 0x3a3a3e } }),
  reel({ id: 'reel-13-modus-c2', brand: '13 Fishing', name: '13 Fishing Modus C2 (Baitcaster)', rand: 1450, style: 'baitcaster', ratio: 6.6, dragKg: 8, bearings: 7, premium: true, note: 'Round-bodied, aluminium chassis', sections: ['bass', 'predator'],
    look: { body: 0xb8bcc2, bodyMetal: 0.85, accent: 0xc9a13a, trim: 0x2a2a2a } }),
  reel({ id: 'reel-banax-astra-105', brand: 'Banax', name: 'Banax Astra 105 (Baitcaster)', rand: 699, style: 'baitcaster', ratio: 7.3, dragKg: 8, bearings: 5, sections: ['bass'],
    look: { body: 0x2a2a2c, bodyMetal: 0.4, accent: 0x6a6a6e, trim: 0x8a8a8e } }),
  reel({ id: 'reel-cullem-raptor', brand: 'Cullem', name: 'Cullem Raptor (Baitcaster)', rand: 549, style: 'baitcaster', ratio: 6.1, dragKg: 5, bearings: 5, sections: ['bass'],
    look: { body: 0x8a9098, bodyMetal: 0.6, accent: 0xc8c8cc, trim: 0xe04a1a, knob: 0xd02010 } }),
  reel({ id: 'reel-shimano-slx-dc', brand: 'Shimano', name: 'Shimano SLX DC 150XG (Baitcaster)', rand: 3999, style: 'baitcaster', ratio: 8.2, dragKg: 5, bearings: 5, premium: true, dc: true,
    note: 'I-DC4 digital brake: a computer stops the overruns', sections: ['bass', 'predator'],
    look: { body: 0x1c2230, bodyMetal: 0.6, accent: 0x2a6ad0, trim: 0x2ab0c8 } }),
  reel({ id: 'reel-adrenalin-bt100', brand: 'Adrenalin', name: 'Adrenalin BT 100 (Baitcaster)', rand: 359, style: 'baitcaster', ratio: 6.3, dragKg: 5, bearings: 4, sections: ['bass', 'general'],
    look: { body: 0xa8b0bc, bodyMetal: 0.7, accent: 0x2a5aa8, trim: 0x1a1a1a } }),
  reel({ id: 'reel-adrenalin-adr103', brand: 'Adrenalin', name: 'Adrenalin ADR 103 (Baitcaster)', rand: 450, style: 'baitcaster', ratio: 6.3, dragKg: 5, bearings: 5, sections: ['bass'],
    look: { body: 0x1a1a1c, bodyMetal: 0.5, accent: 0x8a8a8e, trim: 0xd02020, knob: 0xd02020 } }),

  // ── Baitrunners and big pits ──
  reel({ id: 'reel-okuma-longbow-xr', brand: 'Okuma', name: 'Okuma Longbow Baitfeeder XR', rand: 724, style: 'baitrunner', ratio: 4.9, dragKg: 8, bearings: 5, note: 'Line-control spool', sections: ['carp'],
    look: { size: 1.05, body: 0x1c1c1e, bodyMetal: 0.5, accent: 0x3a3a3e, trim: 0xd06a1a } }),
  reel({ id: 'reel-okuma-ls-6k', brand: 'Okuma', name: 'Okuma Baitfeeder LS-6K', rand: 1299, style: 'bigpit', freeSpool: true, longCast: true, ratio: 5.3, dragKg: 12, bearings: 6, note: 'Long-stroke 30 mm spool', sections: ['carp', 'predator'],
    look: { size: 0.95, body: 0x18181a, bodyMetal: 0.6, accent: 0x2a2a2c, trim: 0x8a6a3a, knob: 0x8a6a3a } }),
  reel({ id: 'reel-okuma-carbonite', brand: 'Okuma', name: 'Okuma Carbonite Baitfeeder', rand: 482, style: 'baitrunner', ratio: 4.5, dragKg: 8, bearings: 2, sections: ['carp', 'general'],
    look: { size: 1.0, body: 0x1a1a1c, bodyMetal: 0.35, accent: 0x5a5a5e, trim: 0x3a6ab0 } }),
  reel({ id: 'reel-okuma-ls-8k', brand: 'Okuma', name: 'Okuma LS-8K Long Cast Baitfeeder', rand: 1349, style: 'bigpit', freeSpool: true, longCast: true, ratio: 5.3, dragKg: 16, bearings: 6, note: '440 m of 0.33 mm line', sections: ['carp', 'predator'],
    look: { size: 1.05, body: 0x18181a, bodyMetal: 0.6, accent: 0x2a2a2c, trim: 0x8a6a3a, knob: 0x8a6a3a } }),
  reel({ id: 'reel-okuma-custom-black-60', brand: 'Okuma', name: 'Okuma Custom Black 60 (Big Pit)', rand: 999, style: 'bigpit', longCast: true, ratio: 4.5, dragKg: 12, bearings: 4, note: 'Quick front drag, spare spool', sections: ['carp'],
    look: { size: 1.05, body: 0x141416, bodyMetal: 0.6, accent: 0x1e1e20, trim: 0x8a6a3a, knob: 0x8a6a3a } }),
  reel({ id: 'reel-adrenalin-blixem-50lc', brand: 'Adrenalin', name: 'Adrenalin Blixem 50 Long Cast', rand: 619, style: 'baitrunner', longCast: true, ratio: 5.5, dragKg: 8, bearings: 8, note: 'Tapered aluminium spool', sections: ['carp'],
    look: { size: 1.1, body: 0x2a2a2c, bodyMetal: 0.5, accent: 0x4a4a4e, trim: 0xa01818 } }),
  reel({ id: 'reel-shimano-baitrunner-st', brand: 'Shimano', name: 'Shimano Baitrunner Deluxe (BTR-ST)', rand: 1299, style: 'baitrunner', premium: true, ratio: 4.6, dragKg: 8, bearings: 3, note: 'The original baitrunner: rear drag', sections: ['carp', 'predator'],
    look: { size: 1.1, body: 0x1a1a1c, bodyMetal: 0.6, accent: 0xb8b8bc, trim: 0xc8a040 } }),
  reel({ id: 'reel-adrenalin-q3000', brand: 'Adrenalin', name: 'Adrenalin Baitrunner Q3000', rand: 209, style: 'baitrunner', ratio: 5.0, dragKg: 5, bearings: 2, note: 'Budget baitrunner', sections: ['carp', 'general'],
    look: { size: 0.9, body: 0x1e1e20, bodyMetal: 0.3, accent: 0xa8a8ac, trim: 0x5a5a5e } }),
  reel({ id: 'reel-shimano-baitrunner-xt', brand: 'Shimano', name: 'Shimano Baitrunner XT-RB (BTR-XT)', rand: 2349, style: 'baitrunner', premium: true, ratio: 4.6, dragKg: 6, bearings: 5, note: 'Aero Wrap II line lay, cold-forged spool', sections: ['carp', 'predator'],
    look: { size: 1.12, body: 0x2a2a2e, bodyMetal: 0.8, accent: 0xd0d0d4, trim: 0xc8a040 } }),
  reel({ id: 'reel-adrenalin-blixem-40lc', brand: 'Adrenalin', name: 'Adrenalin Blixem 40 Long Cast', rand: 579, style: 'baitrunner', longCast: true, ratio: 5.5, dragKg: 7, bearings: 8, sections: ['carp'],
    look: { size: 1.0, body: 0x2a2a2c, bodyMetal: 0.5, accent: 0x4a4a4e, trim: 0xa01818 } }),
  reel({ id: 'reel-bat-valour-6500', brand: 'B.A.T', name: 'B.A.T Valour 6500 Longcast (Big Pit)', rand: 769, style: 'bigpit', longCast: true, ratio: 4.4, dragKg: 12, bearings: 7, note: 'Quick drag, CNC bail and handle', sections: ['carp', 'predator'],
    look: { size: 1.0, body: 0x2e4a2a, bodyMetal: 0.5, accent: 0x3a3a3a, trim: 0x6a8a4a, knob: 0x3a4a34 } }),
  reel({ id: 'reel-bat-hornet', brand: 'B.A.T', name: 'B.A.T Baitfeeder Hornet', rand: 629, style: 'baitrunner', ratio: 5.2, dragKg: 8, bearings: 6, note: 'Aluminium spool plus a spare', sections: ['carp'],
    look: { size: 1.05, body: 0x2a2c2e, bodyMetal: 0.5, accent: 0x4a4c50, trim: 0xc0a040 } }),
];

// ─── Combos ──────────────────────────────────────────────────────────────────
// Sold as a pair in the shops: buy the combo and you get both. The combo's
// own rod and reel aren't sold on their own.
const combo = (id, name, rand, rodSpec, reelSpec, sections, note) => {
  const r = rod({ ...rodSpec, id: `rod-${id}`, rand: rand * 0.55, comboOnly: true, sections });
  const l = reel({ ...reelSpec, id: `reel-${id}`, rand: rand * 0.45, comboOnly: true, sections });
  r.note = r.note.replace(/ · R[\d\s,]+ in SA shops$/, ' · part of the combo');
  l.note = l.note.replace(/ · R[\d\s,]+ in SA shops$/, ' · part of the combo');
  return {
    combo: { id: `combo-${id}`, name, cost: credits(rand), priceR: rand, rodId: r.id, reelId: l.id, sections, note: `${note} · ${rands(rand)} in SA shops` },
    rod: r,
    reel: l,
  };
};

const COMBO_DATA = [
  combo('adrenalin', 'Adrenalin Combo (2.13m + spinning reel)', 369,
    { name: 'Adrenalin Combo Rod (2.13m)', brand: 'Adrenalin', ft: 7, power: 'medium', action: 'moderate-fast', lineKg: [3, 7], lureG: [7, 28], blank: 'composite', look: { ...SPIN, blank: 0x141416, wrap: 0xc02020, grip: 'splitEva', gripColor: 0x141414 } },
    { name: 'Adrenalin Combo Reel', brand: 'Adrenalin', style: 'spinning', ratio: 5.2, dragKg: 5, bearings: 3, look: { size: 0.9, body: 0x1a1a1c, bodyMetal: 0.3, accent: 0xb0b0b4, trim: 0xc02020 } },
    ['general'], 'A first rod and reel that does a bit of everything'),
  combo('sensation-instinct', 'Sensation Instinct 2pc Casting Combo', 949,
    { name: 'Sensation Instinct Casting Rod (2.13m MH)', brand: 'Sensation', ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [4.5, 9], lureG: [7, 28], blank: 'composite', casting: true, look: { ...CAST, blank: 0x3a5a8a, wrap: 0x9aa4b0, grip: 'splitEva', gripColor: 0x5a6068 } },
    { name: 'Sensation Instinct Baitcaster', brand: 'Sensation', style: 'baitcaster', ratio: 6.1, dragKg: 5, bearings: 5, look: { body: 0x7a8ea8, bodyMetal: 0.5, accent: 0xc0c8d0, trim: 0x2a4a7a } },
    ['bass', 'general'], 'Carbon-composite casting rod with a magnetic-brake baitcaster'),
  combo('shimano-sienna', 'Shimano Sienna 3000 + Sienna MH Combo', 1299,
    { name: 'Shimano Sienna Rod (2.13m MH)', brand: 'Shimano', ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [3.6, 7.3], lureG: [7, 28], blank: 'glass', look: { ...SPIN, blank: 0x2a2c30, wrap: 0x8a2020, grip: 'fullCork' } },
    { name: 'Shimano Sienna 3000 Reel', brand: 'Shimano', style: 'spinning', premium: true, ratio: 5.0, dragKg: 8, bearings: 4, look: { size: 1.0, body: 0x2a2a2e, bodyMetal: 0.6, accent: 0xc8c8cc, trim: 0xa02020 } },
    ['general', 'bass'], 'Propulsion line management: longer casts, fewer wind knots'),
  combo('okuma-vibe', 'Okuma Vibe Lumou Combo (Blue)', 459,
    { name: 'Okuma Vibe Lumou Rod (2.13m)', brand: 'Okuma', ft: 7, power: 'medium', action: 'moderate', lineKg: [3, 6], lureG: [5, 25], blank: 'glass', look: { ...SPIN, blank: 0x1f6fd0, wrap: 0xe8e8e8, grip: 'foam', gripColor: 0x1a1a1a } },
    { name: 'Okuma Vibe Reel', brand: 'Okuma', style: 'spinning', ratio: 5.0, dragKg: 4, bearings: 1, look: { size: 0.85, body: 0x1f6fd0, bodyMetal: 0.3, accent: 0xc8c8cc, trim: 0x1a1a1a } },
    ['general'], 'Glass-fibre starter combo — glows under a torch'),
  combo('okuma-fin-chaser', 'Okuma Fin Chaser Combo (Blue)', 485,
    { name: 'Okuma Fin Chaser Rod (2.13m)', brand: 'Okuma', ft: 7, power: 'medium', action: 'moderate', lineKg: [3.6, 6.8], lureG: [7, 21], blank: 'glass', biteBonus: { 'mozambique-tilapia': 1.1, 'banded-tilapia': 1.1, bluegill: 1.1 }, look: { ...SPIN, blank: 0x1f5fb0, wrap: 0xe0e0e0, grip: 'splitEva', gripColor: 0x1f4f90 } },
    { name: 'Okuma Fin Chaser 40 Reel', brand: 'Okuma', style: 'spinning', ratio: 5.0, dragKg: 5, bearings: 1, look: { size: 0.9, body: 0x1a3a70, bodyMetal: 0.3, accent: 0xc8c8cc, trim: 0x2a6ad0 } },
    ['general'], 'The SA kurper-and-carp starter combo'),
  combo('pioneer-eco', 'Pioneer Eco Carp Combo', 659,
    { name: 'Pioneer Eco Carp Rod (3.05m)', brand: 'Pioneer', ft: 10, tcLb: 2.5, action: 'moderate', blank: 'composite', look: { ...CARP, blank: 0x18181a, wrap: 0x2a8a3a, grip: 'foam', gripColor: 0x161616, weave: false } },
    { name: 'Pioneer Eco Baitrunner', brand: 'Pioneer', style: 'baitrunner', ratio: 4.7, dragKg: 6, bearings: 2, look: { size: 1.0, body: 0x1a1a1c, bodyMetal: 0.3, accent: 0x2a8a3a, trim: 0xd06a1a } },
    ['carp', 'general'], 'Budget 3 m carp rod with a baitrunner'),
  combo('fish-x', 'Fish X Combo', 259,
    { name: 'Fish X Rod (2.13m)', brand: 'Fish X', ft: 7, power: 'medium', action: 'moderate', lineKg: [2.5, 5], lureG: [5, 20], blank: 'glass', look: { ...SPIN, blank: 0x2a8a2a, wrap: 0x1a1a1a, grip: 'foam', gripColor: 0x1a1a1a } },
    { name: 'Fish X Reel', brand: 'Fish X', style: 'spinning', ratio: 5.1, dragKg: 3, bearings: 1, look: { size: 0.8, body: 0x2a2a2e, bodyMetal: 0.2, accent: 0xb8b8bc, trim: 0x2a8a2a } },
    ['general'], 'Bright glass-fibre kids\' combo'),
  combo('quantum-invade', 'Quantum Invade MH Casting Combo', 839,
    { name: 'Quantum Invade Casting Rod (1.98m MH)', brand: 'Quantum', ft: 6.5, power: 'medium-heavy', action: 'fast', lineKg: [4.5, 9], lureG: [10, 28], blank: 'carbon24', casting: true, look: { ...CAST, blank: 0x3a3c40, wrap: 0xc02020, grip: 'splitEva', gripColor: 0x1a1a1a } },
    { name: 'Quantum Invade Baitcaster', brand: 'Quantum', style: 'baitcaster', ratio: 6.1, dragKg: 6.8, bearings: 5, look: { body: 0x3a3c40, bodyMetal: 0.5, accent: 0xb8b8bc, trim: 0xc02020 } },
    ['bass'], 'IM6 graphite rod, 6.8 kg drag baitcaster'),
  combo('adrenalin-razor-g', 'Adrenalin Razor G Combo', 379,
    { name: 'Adrenalin Razor G Rod (2.13m)', brand: 'Adrenalin', ft: 7, power: 'medium', action: 'moderate-fast', lineKg: [3, 7], lureG: [7, 28], blank: 'composite', look: { ...SPIN, blank: 0x1a1a1c, wrap: 0x3ad83a, grip: 'splitEva', gripColor: 0x1a1a1a } },
    { name: 'Adrenalin Razor G Reel', brand: 'Adrenalin', style: 'spinning', ratio: 5.2, dragKg: 5, bearings: 3, look: { size: 0.9, body: 0x3ad83a, bodyMetal: 0.3, accent: 0x1a1a1a, trim: 0x1a1a1a } },
    ['general'], 'Lime-green spinning combo'),
  combo('adrenalin-big-fish', 'Adrenalin Big Fish Combo', 379,
    { name: 'Adrenalin Big Fish Rod (2.13m)', brand: 'Adrenalin', ft: 7, power: 'medium-heavy', action: 'moderate', lineKg: [5, 10], lureG: [15, 60], blank: 'composite', look: { ...SPIN, blank: 0x1c1c1e, wrap: 0xc9a13a, grip: 'foam', gripColor: 0x161616, tipR: 0.0026, buttR: 0.01 } },
    { name: 'Adrenalin Big Fish Reel', brand: 'Adrenalin', style: 'spinning', ratio: 4.7, dragKg: 7, bearings: 3, look: { size: 1.05, body: 0x2a2a2c, bodyMetal: 0.4, accent: 0xb0b0b4, trim: 0x5a5a5e } },
    ['general', 'predator'], 'A stronger all-rounder for barbel and bigger carp'),
  combo('dark-shadow', 'Sensation Dark Shadow MH Casting Combo', 1239,
    { name: 'Sensation Dark Shadow Casting Rod (2.13m MH)', brand: 'Sensation', ft: 7, power: 'medium-heavy', action: 'fast', lineKg: [4.5, 9.1], lureG: [7, 28], blank: 'carbon24', casting: true, look: { ...CAST, blank: 0x6a7684, wrap: 0xc02020, grip: 'splitEva', gripColor: 0x9aa0a8 } },
    { name: 'Sensation Dark Shadow Baitcaster', brand: 'Sensation', style: 'baitcaster', ratio: 6.6, dragKg: 5, bearings: 6, look: { body: 0x1a1a1c, bodyMetal: 0.5, accent: 0x8a8a8e, trim: 0xd02020, knob: 0xd02020 } },
    ['bass'], '24-ton carbon rod and a 5+1 bearing baitcaster'),
  combo('adrenalin-evo', 'Adrenalin EVO Combo', 449,
    { name: 'Adrenalin EVO Rod (1.83m)', brand: 'Adrenalin', ft: 6, power: 'medium', action: 'moderate-fast', lineKg: [4, 8], lureG: [10, 40], blank: 'composite', look: { ...SPIN, blank: 0x1a1a1c, wrap: 0xc9a13a, grip: 'splitEva', gripColor: 0x1a1a1a } },
    { name: 'Adrenalin EVO Reel', brand: 'Adrenalin', style: 'spinning', ratio: 4.9, dragKg: 8, bearings: 4, look: { size: 1.1, body: 0x1a1a1c, bodyMetal: 0.5, accent: 0xc9a13a, trim: 0xc9a13a } },
    ['general'], 'Short, strong rod with a big gold-spool reel'),
];

export const COMBO_RODS = COMBO_DATA.map((c) => c.rod);
export const COMBO_REELS = COMBO_DATA.map((c) => c.reel);
export const COMBOS = COMBO_DATA.map((c) => c.combo);
