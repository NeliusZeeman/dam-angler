import { FISH_SPECIES, suitability } from './fish.js';
import { LURES } from './gear.js';
import { TIME_OF_DAY_PHASES } from './environment.js';

// "What's biting" hints. Two kinds, mixed at random:
//   live  -- read off the game's own bite model for this dam, right now
//            (time of day, water temperature), so a hint always tells the
//            truth: which fish, on what, and where to put it.
//   local -- bank-side wisdom per dam, from forum and venue reports.

// What anglers call them on the bank.
const BANK_NAMES = {
  'mozambique-tilapia': 'blue kurper', 'banded-tilapia': 'vlei kurper',
  'common-carp': 'carp', 'mirror-carp': 'mirror carp',
  'largemouth-bass': 'bass', 'smallmouth-bass': 'smallmouth bass',
  catfish: 'barbel', tigerfish: 'tigers',
  'smallmouth-yellowfish': 'smallmouth yellows', 'largescale-yellowfish': 'largescale yellows',
  mudfish: 'mudfish',
};
const BAIT_PHRASE = {
  'bread-bait': 'bread', worm: 'worms', mielies: 'mielies', 'chicken-liver': 'chicken liver',
  'frog-bait': 'a platanna', mieliebom: 'a mieliebom', spinner: 'a spinnerbait', 'soft-plastic': 'a soft plastic', 'spoon-lure': 'a spoon',
};
const TIME_PHRASE = {
  morning: 'first light', midMorning: 'mid-morning', midday: 'midday', afternoon: 'the afternoon',
  sunset: 'sunset', lateTwilight: 'dusk', night: 'dark',
};

// Places a line can sit, as the bite model sees them.
const SPOTS = [
  { habitat: { zone: 'structure', depthFactor: 0.5 }, phrase: 'tight to the reeds, pads and timber' },
  { habitat: { zone: 'open', depthFactor: 0.25 }, phrase: 'in the shallows close to the bank' },
  { habitat: { zone: 'open', depthFactor: 0.8 }, phrase: 'out in the deep water — cast long' },
  { habitat: { zone: 'open', depthFactor: 0.5 }, phrase: 'along the drop-off' },
];

export const LOCAL_TIPS = {
  hartbeespoort: [
    'Harties carp love mielies — build a bed of mielies and put one on the hook.',
    'A mieliebom packs its own feed round the hook — cast it to the same spot and let the carp find it.',
    'Early mornings and late evenings are the Harties windows. Midday in the sun is hard going.',
    'Bass hide under the hyacinth mats — work a spinnerbait along the edges.',
    'Kurper here take worms best, fished close in.',
    'Barbel prowl the margins after dark — chicken liver or a platanna.',
    'Every now and then a big scaly mirror turns up among the commons — mielies, fished deep.',
  ],
  vaal: [
    'The Vaal is a carp and yellowfish nursery — plenty of bites, mostly small fish. Mielies on the bottom keep them coming.',
    'Smallmouth yellowfish fight way above their weight. Ease off and let them run.',
    'Mudfish graze the margins — bread or mielies close to the bank.',
    'Vaal feeder anglers swear by a mieliebom: yellows and carp crowd onto the groundbait.',
    'Most Vaal anglers put every fish back. The big ones start as the small ones you release.',
    'Smallmouth bass like cooler water and the drowned trees — try a spinner when it turns cold.',
    'Barbel come up into the shallows at dusk — worms or chicken liver.',
  ],
  jozini: [
    'Tigers bite straight through nylon — no wire trace, no tigerfish.',
    'Tigers hunt early and late in the day and switch off in the midday heat.',
    'Blue kurper are everywhere at Jozini — bread or worms close in.',
    'Largescale yellowfish sit on the rocky drop-offs — a spinner or spoon works.',
    'Tigerfish are catch-and-release on Jozini. Get it back in the water fast.',
    'Hot, clear water: fish the shade and the drop-offs when the sun is high.',
  ],
  bronkhorstspruit: [
    'Carp is king at Bronkies — expect twenty small ones before a big one.',
    'The west side is carp water; the jetties on the north shore are bass water.',
    "Thick water-grass here — don't bully a fish through it or you'll lose it.",
    'Bass hold under the jetties — work a soft plastic or spinnerbait along them.',
    'Largescale yellowfish run up the Bronkhorstspruit — mielies or a small spinner.',
  ],
  loskop: [
    'Loskop holds the SA record bass, 7.19 kg. The big ones sit in the timber — spinnerbait or soft plastic.',
    'Lots of 0.5–2 kg carp along the banks. Be patient for the big ones.',
    'Largescale yellowfish cruise the clear water — spinner, spoon or worm near the rocks.',
    'Barbel and mudfish work the inlets — worms in the evening.',
    'Kurper take artlures here too, but worms and mielies are surer.',
  ],
  roodeplaat: [
    'Roodeplaat carp run 10–12 kg — mielies on the bottom and patience.',
    'The barbel population here is prolific — chicken liver or frogs after dark.',
    'Early mornings and late afternoons, carp and barbel come right in to the bank.',
    'The northern shore is the angling side — bass, carp and kurper.',
    'After the first heavy summer rains the fishing really switches on.',
  ],
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

// For one species right now: its best bait and spot, and how good that is.
// Equally good options (carp don't care where; barbel take worms, liver or
// frogs alike) are picked at random so the tips vary.
function bestSetup(species, conditions, rng) {
  let score = 0;
  let ties = [];
  for (const lure of LURES) {
    if (!species.preferredLureIds.includes(lure.id)) continue;
    for (const spot of SPOTS) {
      const s = suitability(species, { ...conditions, equippedLureId: lure.id, lureKind: lure.kind, habitat: spot.habitat });
      if (s > score + 1e-9) { score = s; ties = [{ lure, spot }]; }
      else if (s > 0 && Math.abs(s - score) <= 1e-9) ties.push({ lure, spot });
    }
  }
  return ties.length ? { score, ...pick(ties, rng) } : { score: 0, lure: null, spot: null };
}

function nextActiveTime(species, timeOfDay) {
  const i = TIME_OF_DAY_PHASES.indexOf(timeOfDay);
  for (let k = 1; k <= TIME_OF_DAY_PHASES.length; k++) {
    const phase = TIME_OF_DAY_PHASES[(i + k) % TIME_OF_DAY_PHASES.length];
    if (species.activeTimes?.includes(phase)) return phase;
  }
  return null;
}

// A tip from the live bite model: a fish that's really feeding here now,
// chosen at random in proportion to how much it's biting.
export function liveTip(location, { waterTempC, timeOfDay }, { rng = Math.random, ownedLureIds = null } = {}) {
  const species = FISH_SPECIES.filter((s) => location.speciesIds.includes(s.id));
  const conditions = { waterTempC, timeOfDay };
  const options = species.map((s) => {
    const setup = bestSetup(s, conditions, rng);
    return { species: s, ...setup, weight: (location.catchShare?.[s.id] ?? 1) * setup.score };
  }).filter((o) => o.weight > 0);

  // Now and then, a heads-up about a fish that's off the feed but coming on.
  const sleeping = species.filter((s) => s.activeTimes && !s.activeTimes.includes(timeOfDay)
    && (location.catchShare?.[s.id] ?? 0) >= 12
    && waterTempC >= s.tempRangeC[0] && waterTempC <= s.tempRangeC[1]);
  if (sleeping.length && rng() < 0.12) {
    const s = pick(sleeping, rng);
    const when = nextActiveTime(s, timeOfDay);
    const bait = s.preferredLureIds.map((id) => BAIT_PHRASE[id]).filter(Boolean)[0];
    if (when) return { kind: 'live', speciesId: s.id, text: `${cap(BANK_NAMES[s.id])} are quiet now but switch on at ${TIME_PHRASE[when]}. Have ${bait} ready.` };
  }

  if (!options.length) return null;
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  let chosen = options[options.length - 1];
  for (const o of options) { roll -= o.weight; if (roll <= 0) { chosen = o; break; } }

  const name = BANK_NAMES[chosen.species.id] || chosen.species.name;
  const bait = BAIT_PHRASE[chosen.lure.id] || chosen.lure.name;
  const templates = [
    `${cap(name)} are feeding ${chosen.spot.phrase}. Try ${bait}.`,
    `Word on the bank: ${name} on ${bait}, ${chosen.spot.phrase}.`,
    `${cap(name)} are active right now — ${bait}, ${chosen.spot.phrase}.`,
    `The guys down the bank are getting ${name} on ${bait}.`,
  ];
  let text = pick(templates, rng);
  if (ownedLureIds && !ownedLureIds.includes(chosen.lure.id)) text += ` Get ${bait} from the tackle box shop.`;
  return { kind: 'live', speciesId: chosen.species.id, lureId: chosen.lure.id, text };
}

export function localTip(location, rng = Math.random) {
  const list = LOCAL_TIPS[location.id];
  return list?.length ? { kind: 'local', text: pick(list, rng) } : null;
}

// A random hint for this dam: mostly live bite reports, some local lore.
export function randomTip(location, conditions, { rng = Math.random, ownedLureIds = null } = {}) {
  const tip = rng() < 0.6 ? liveTip(location, conditions, { rng, ownedLureIds }) : null;
  return tip || localTip(location, rng) || liveTip(location, conditions, { rng, ownedLureIds });
}
