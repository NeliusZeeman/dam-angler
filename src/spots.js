// The fishing spots, province by province. Fish shares are what anglers
// report catching there (roughly, in percent); tips are local knowledge
// from forum and venue reports. Expanded into full locations by
// regions.buildSpot(). The six original, hand-tuned dams (Hartbeespoort,
// Vaal, Jozini, Bronkhorstspruit, Loskop, Roodeplaat) live in locations.js.
//
//   kind   dam | stillwater (small fly-fishing dam) | river | stream
//   land   landscape (regions.LANDSCAPES)   tint   water colour
//   clarity 0 murky .. 1 gin-clear          far    metres to the far bank
//   structure  bank cover along the shore: reeds, timber, pads, hyacinth
//   temp   water temperature offset (°C) vs a Highveld dam

export const SPOT_DEFS = [
  // ------------------------------------------------------------------ Gauteng
  {
    id: 'rietvlei', name: 'Rietvlei Dam', province: 'gauteng', town: 'Pretoria (Rietvlei Nature Reserve)',
    kind: 'dam', land: 'highveld', tint: 'olive', clarity: 0.35, far: 420, structure: ['reeds', 'reeds', 'timber'],
    fish: { 'common-carp': 45, 'largescale-yellowfish': 12, 'largemouth-bass': 14, 'mozambique-tilapia': 15, catfish: 14 },
    blurb: 'A nature-reserve dam on the edge of Pretoria — no boats (crocs and hippos), reed-lined banks, an island and rocky points. "The most rewarding and most unforgiving venue in Gauteng": a 40lb carp one day, nothing the next.',
    tips: [
      'Fish near the reeds, the island and the rocky areas — that\'s where Rietvlei\'s carp patrol.',
      'Soft yellow or orange floaties — banana, pineapple, honey — are the Rietvlei carp baits.',
      'No boats here: it\'s all bank fishing, and the big ones come close in at dawn.',
    ],
  },
  {
    id: 'emmarentia', name: 'Emmarentia Dam', province: 'gauteng', town: 'Johannesburg',
    kind: 'dam', land: 'highveld', tint: 'green', clarity: 0.3, algae: 0.1, far: 160, structure: ['reeds', 'pads'], stands: [{ x: 0, length: 4 }],
    fish: { 'common-carp': 45, 'largemouth-bass': 20, 'mozambique-tilapia': 22, catfish: 13 },
    blurb: 'A small city dam in Joburg\'s Botanical Gardens, lined with willows and oaks: carp, bass, blue kurper and barbel within earshot of the suburbs.',
    tips: [
      'Bread and mielies close to the reeds — Emmarentia\'s carp are used to both.',
      'Bass hold along the reed edges; a small spinner in the evening.',
      'A busy park by day — the quiet dawn is when the bigger fish feed.',
    ],
  },
  {
    id: 'vaal-barrage', name: 'Vaal River (Barrage)', province: 'gauteng', town: 'Vereeniging / Vanderbijlpark',
    kind: 'river', land: 'highveld', tint: 'brown', clarity: 0.15, far: 110, structure: ['reeds', 'timber', 'reeds'],
    fish: { 'common-carp': 34, 'smallmouth-yellowfish': 22, catfish: 20, mudfish: 12, 'largemouth-yellowfish': 4, 'largemouth-bass': 8 },
    blurb: 'The broad, slow Vaal above the Barrage weir: brown water, willow-lined banks and reed beds, and the full Vaal mix — carp, barbel, mudfish and smallmouth yellows, with the odd largemouth yellow.',
    tips: [
      'Mielies or a mieliebom on the bottom — the Barrage is a carp and yellowfish river.',
      'Barbel come out along the reeds at dusk — liver or worms.',
      'Watch for the current: your float drifts downstream; recast upstream of the spot.',
    ],
  },
  // --------------------------------------------------------------- Free State
  {
    id: 'vaal-parys', name: 'Vaal River at Parys', province: 'free-state', town: 'Parys (Vredefort Dome)',
    kind: 'river', fly: true, land: 'highveld', tint: 'brown', clarity: 0.4, far: 70, structure: ['reeds', 'reeds'],
    horizon: { base: 9, rough: 4, ridges: [{ az: 200, width: 0.7, height: 16 }, { az: 250, width: 0.5, height: 12 }] },
    fish: { 'smallmouth-yellowfish': 50, 'largemouth-yellowfish': 10, mudfish: 12, catfish: 12, 'common-carp': 16 },
    blurb: 'Rocky runs, islands and riffles through the Vredefort Dome hills — the heart of SA yellowfish fly fishing. Smallmouth yellows on nymphs, and the prize: largemouth yellows up to 9kg on streamers.',
    tips: [
      'A gold-bead nymph drifted through the riffles is THE Parys yellowfish method.',
      'Largemouth yellows hunt the deeper runs — a streamer swung past the rocks.',
      'Summer, when the river\'s low and clear, is peak yellowfish season.',
    ],
  },
  {
    id: 'sterkfontein', name: 'Sterkfontein Dam', province: 'free-state', town: 'Harrismith',
    kind: 'dam', fly: true, land: 'drakensberg', temp: -4, tint: 'blue', clarity: 0.95, far: null, rocks: 90, trees: 0.1,
    fish: { 'smallmouth-yellowfish': 85, 'common-carp': 10, catfish: 5 },
    blurb: 'Vast, gin-clear water against the Drakensberg — "arguably the finest yellowfish fishing in the country" because you can sight-fish to cruising yellows in the shallows.',
    tips: [
      'The water\'s so clear you can see the yellows cruising — cast ahead of them, don\'t line them.',
      'Summer is best: yellows come up into the shallows to feed on terrestrials.',
      'Long, light leader and a small nymph or dry — Sterkfontein fish are spooky.',
    ],
  },
  {
    id: 'gariep', name: 'Gariep Dam', province: 'free-state', town: 'Gariep (Orange River)',
    kind: 'dam', land: 'karoo', tint: 'muddy', clarity: 0.25, far: null, structure: ['timber'],
    fish: { 'common-carp': 34, 'smallmouth-yellowfish': 26, catfish: 16, mudfish: 12, 'largemouth-yellowfish': 12 },
    blurb: 'South Africa\'s biggest dam, on the Orange in the Karoo — flat-topped koppies, huge open water, carp, barbel, mudfish and both yellowfish.',
    tips: [
      'Carp and smallmouth yellows on mielies along the bank — the bread-and-butter here.',
      'Largemouth yellows chase baitfish off the points: spinners or a streamer.',
      'Karoo winds can blow hard in the afternoon — morning is calmer.',
    ],
  },
  {
    id: 'ash-river', name: 'Ash River (Clarens)', province: 'free-state', town: 'Clarens / Bethlehem',
    kind: 'stream', fly: true, land: 'drakensberg', temp: -7, tint: 'clear', clarity: 0.8, far: 20,
    fish: { 'rainbow-trout': 55, 'smallmouth-yellowfish': 45 },
    blurb: 'A fast, cold tailwater below the sandstone cliffs of the eastern Free State: rainbow trout and smallmouth yellowfish in the same runs.',
    tips: [
      'Cold water released from the tunnel keeps the Ash trout-friendly even in summer.',
      'Nymphs through the fast runs for both trout and yellows.',
      'Dawn and dusk for the trout; the yellows feed through the day.',
    ],
  },
  {
    id: 'allemanskraal', name: 'Allemanskraal Dam', province: 'free-state', town: 'Ventersburg (Willem Pretorius)',
    kind: 'dam', land: 'highveld', tint: 'brown', clarity: 0.2, far: 520, structure: ['reeds'],
    fish: { 'common-carp': 45, 'smallmouth-yellowfish': 18, catfish: 17, mudfish: 12, 'banded-tilapia': 8 },
    blurb: 'Flat Free State grassland around a big, silty dam in a game reserve: a classic carp-and-barbel bank venue.',
    tips: [
      'Mieliebom and mielies — a classic Free State carp water.',
      'Barbel after dark on liver.',
      'Open, flat water: find the wind-blown bank, the carp follow the food.',
    ],
  },
  // --------------------------------------------------------------- North West
  {
    id: 'bloemhof', name: 'Bloemhof Dam', province: 'north-west', town: 'Bloemhof (Vaal & Vet confluence)',
    kind: 'dam', land: 'highveld', tint: 'brown', clarity: 0.2, far: null, structure: ['timber', 'reeds'],
    fish: { 'common-carp': 38, 'smallmouth-yellowfish': 20, catfish: 18, mudfish: 12, 'largemouth-yellowfish': 6, 'largemouth-bass': 6 },
    blurb: 'A 223km² inland sea where the Vaal meets the Vet — flat, open, brown water with drowned trees; carp, barbel and yellowfish.',
    tips: [
      'The river inlets hold yellowfish; the open banks, carp.',
      'Drowned trees in the bays: barbel and the odd bass.',
      'Huge water — pick a spot the wind is blowing into.',
    ],
  },
  {
    id: 'roodekoppies', name: 'Roodekoppies Dam', province: 'north-west', town: 'Brits',
    kind: 'dam', land: 'bushveld', tint: 'olive', clarity: 0.4, far: 380, structure: ['timber', 'pads', 'reeds'],
    fish: { 'largemouth-bass': 30, 'common-carp': 34, catfish: 22, 'mozambique-tilapia': 14 },
    blurb: 'A bushveld dam among red koppies near Brits — barbel, bass and carp.',
    tips: [
      'Bass around the timber and pads early morning.',
      'Barbel are strong here — go heavy, a circle hook and 20lb.',
      'Carp on mielies along the gentler banks.',
    ],
  },
  {
    id: 'boskop', name: 'Boskop Dam', province: 'north-west', town: 'Potchefstroom (Mooi River)',
    kind: 'dam', land: 'highveld', tint: 'green', clarity: 0.55, far: 300, structure: ['reeds', 'pads'],
    fish: { 'largemouth-bass': 32, 'common-carp': 30, 'mozambique-tilapia': 16, catfish: 12, 'smallmouth-yellowfish': 10 },
    blurb: 'A clearer Highveld dam on the Mooi River near Potch, with weed beds and reeds — bass and carp water.',
    tips: [
      'Weed edges for bass — a soft plastic worked slowly.',
      'Carp cruise the shallows on warm afternoons.',
      'Kurper on worms close in, all day in summer.',
    ],
  },
  {
    id: 'buffelspoort', name: 'Buffelspoort Dam', province: 'north-west', town: 'Rustenburg (Magaliesberg)',
    kind: 'dam', land: 'bushveld', tint: 'olive', clarity: 0.5, far: 260, structure: ['pads', 'reeds'],
    horizon: { base: 12, rough: 4, ridges: [{ az: 90, width: 1.0, height: 36 }] },
    fish: { 'largemouth-bass': 30, 'common-carp': 30, 'mirror-carp': 10, catfish: 20, 'mozambique-tilapia': 10 },
    blurb: 'Under the Magaliesberg cliffs near Rustenburg: largemouth bass, barbel, common and mirror carp.',
    tips: [
      'Bass tight to the pads at first light.',
      'Common and mirror carp both — mielies fished deeper for the mirrors.',
      'Barbel feed along the inlet at night.',
    ],
  },
  // --------------------------------------------------------------- Mpumalanga
  {
    id: 'dullstroom', name: 'Dullstroom Trout Dams', province: 'mpumalanga', town: 'Dullstroom',
    kind: 'stillwater', fly: true, land: 'escarpment', temp: -9, tint: 'clear', clarity: 0.75, far: 120, structure: ['reeds'],
    fish: { 'rainbow-trout': 80, 'brown-trout': 20 },
    blurb: '"The flyfishing mecca of South Africa": misty escarpment grassland at 2000m, willow-fringed dams stocked since 1903 with rainbow and brown trout.',
    tips: [
      'Dawn and dusk — trout feed hardest in low light, and the mist lifts off the dam.',
      'A woolly bugger stripped back slowly is the Dullstroom standard.',
      'Winter is prime trout season up here — cold water, hungry fish.',
    ],
  },
  {
    id: 'heyshope', name: 'Heyshope Dam', province: 'mpumalanga', town: 'Piet Retief',
    kind: 'dam', land: 'midlands', temp: 0, tint: 'olive', clarity: 0.55, far: null, structure: ['timber', 'reeds', 'timber'],
    fish: { 'largemouth-bass': 45, 'common-carp': 25, catfish: 15, 'mozambique-tilapia': 15 },
    blurb: '50km² with 120km of shoreline in the southeast — a bass fishing destination "with a great reputation": drowned timber and endless bays.',
    tips: [
      'Bass tournament water — the drowned timber is where the big ones hold.',
      'A soft plastic on an offset hook through the timber.',
      'Dawn and dusk for bass; carp through the day.',
    ],
  },
  {
    id: 'witbank', name: 'Witbank Dam', province: 'mpumalanga', town: 'eMalahleni (Olifants River)',
    kind: 'dam', land: 'highveld', tint: 'brown', clarity: 0.3, far: 450, structure: ['reeds'],
    fish: { 'common-carp': 44, 'largemouth-bass': 16, catfish: 18, 'largescale-yellowfish': 10, 'mozambique-tilapia': 12 },
    blurb: 'Highveld coal-country water on the upper Olifants: carp, barbel, bass and largescale yellowfish.',
    tips: [
      'Carp on mielies — a reliable Highveld carp venue.',
      'Largescale yellows up the river arm on nymphs or small spinners.',
      'Barbel at night along the reeds.',
    ],
  },
  {
    id: 'crocodile-river', name: 'Crocodile River (Lowveld)', province: 'mpumalanga', town: 'Nelspruit / Mbombela',
    kind: 'river', land: 'lowveld', tint: 'olive', clarity: 0.4, far: 55, structure: ['reeds', 'timber'],
    fish: { 'largescale-yellowfish': 28, tigerfish: 18, catfish: 22, 'mozambique-tilapia': 20, 'common-carp': 12 },
    blurb: 'A warm, rocky Lowveld river under big green mountains — one of the few places outside Jozini with tigerfish, plus largescale yellowfish and barbel.',
    tips: [
      'Tigers hunt the fast water below the rapids — a spinner or streamer, and a wire trace.',
      'Largescale yellows in the runs on nymphs.',
      'Hot afternoons are slow — early morning and evening on the river.',
    ],
  },
  {
    id: 'blydepoort', name: 'Blyderivierspoort Dam', province: 'mpumalanga', town: 'Blyde River Canyon',
    kind: 'dam', land: 'lowveld', tint: 'blue', clarity: 0.7, far: 240, steep: 2.5, beach: 1.5, structure: ['timber'],
    horizon: { base: 30, rough: 10, ridges: [{ az: 0, width: 0.8, height: 80 }, { az: 180, width: 0.9, height: 70 }] },
    fish: { 'largemouth-bass': 30, 'largescale-yellowfish': 20, catfish: 20, 'mozambique-tilapia': 20, 'common-carp': 10 },
    blurb: 'Deep, clear water at the foot of the Blyde River Canyon\'s towering red cliffs and the Three Rondavels.',
    tips: [
      'Steep, deep banks — bass hold on the drop-offs.',
      'Largescale yellows where the river runs in.',
      'Clear water: light line, natural baits.',
    ],
  },
  // ------------------------------------------------------------------ Limpopo
  {
    id: 'tzaneen', name: 'Tzaneen Dam', province: 'limpopo', town: 'Tzaneen (Letaba River)',
    kind: 'dam', land: 'lowveld', tint: 'olive', clarity: 0.45, far: 350, structure: ['timber', 'reeds', 'pads'],
    fish: { 'largemouth-bass': 36, catfish: 20, 'mozambique-tilapia': 22, 'common-carp': 12, 'largescale-yellowfish': 10 },
    blurb: 'Subtropical water in the green Letaba valley below Magoebaskloof — "fast action and large predators": bass, barbel and kurper.',
    tips: [
      'Bass everywhere — spinnerbaits along the timber.',
      'Barbel are big here; liver after dark.',
      'Hot and humid: early morning and late afternoon.',
    ],
  },
  {
    id: 'ebenezer', name: 'Ebenezer Dam', province: 'limpopo', town: 'Haenertsburg (Magoebaskloof)',
    kind: 'dam', land: 'escarpment', temp: -5, tint: 'clear', clarity: 0.65, far: 280, steep: 2.2, beach: 1.5, structure: ['timber', 'reeds'],
    fish: { 'largemouth-bass': 30, 'smallmouth-bass': 12, 'rainbow-trout': 14, 'common-carp': 16, 'mozambique-tilapia': 16, catfish: 12 },
    blurb: 'A pine- and gum-forested mountain dam in the misty Magoebaskloof: bass (largemouth and smallmouth), stocked rainbow trout, carp and kurper. Steep banks.',
    tips: [
      'Steep banks make shore fishing tricky — pick the gentler points.',
      'Rainbow trout in the cooler months, bass in summer.',
      'Kurper and carp on worms and mielies in the bays.',
    ],
  },
  {
    id: 'flag-boshielo', name: 'Flag Boshielo Dam', province: 'limpopo', town: 'Marble Hall (Olifants River)',
    kind: 'dam', land: 'bushveld', tint: 'olive', clarity: 0.35, far: null, structure: ['timber', 'reeds'],
    fish: { catfish: 26, 'common-carp': 26, 'largemouth-bass': 18, 'mozambique-tilapia': 18, 'largescale-yellowfish': 12 },
    blurb: 'A big bushveld dam on the Olifants near Marble Hall: hot, dry, thorn-tree country and strong barbel.',
    tips: [
      'Big barbel — circle hooks and heavy line.',
      'Carp and kurper through the day on mielies and worms.',
      'Bass around the drowned trees at dawn.',
    ],
  },
  {
    id: 'magoebaskloof', name: 'Magoebaskloof Trout Waters', province: 'limpopo', town: 'Haenertsburg',
    kind: 'stillwater', fly: true, land: 'escarpment', temp: -8, tint: 'tea', clarity: 0.6, far: 90, structure: ['reeds'],
    fish: { 'rainbow-trout': 65, 'brown-trout': 35 },
    blurb: 'Misty mountain dams in the forest above Haenertsburg: catch-and-release rainbow and brown trout on fly.',
    tips: [
      'Mist and drizzle are trout weather — fish through it.',
      'Browns come out at dusk; a streamer along the reed edge.',
      'Rainbows cruise the margins in the morning.',
    ],
  },
  {
    id: 'olifants-limpopo', name: 'Olifants River (below Flag Boshielo)', province: 'limpopo', town: 'Marble Hall',
    kind: 'river', land: 'bushveld', tint: 'olive', clarity: 0.35, far: 60, structure: ['reeds', 'timber'],
    fish: { 'largescale-yellowfish': 32, catfish: 26, 'mozambique-tilapia': 20, 'common-carp': 12, mudfish: 10 },
    blurb: 'A bushveld river of rock bars and reed banks: largescale yellowfish in the runs and barbel in the pools.',
    tips: [
      'Largescale yellows in the fast water on nymphs and small spinners.',
      'Barbel in the deep pools after dark.',
      'Watch for hippos and crocs — fish from the rocks, not the water.',
    ],
  },
  // ------------------------------------------------------------ KwaZulu-Natal
  {
    id: 'albert-falls', name: 'Albert Falls Dam', province: 'kwazulu-natal', town: 'Pietermaritzburg (uMngeni)',
    kind: 'dam', land: 'midlands', temp: 0, tint: 'olive', clarity: 0.5, far: null, structure: ['timber', 'reeds', 'timber'],
    fish: { 'largemouth-bass': 52, 'common-carp': 22, catfish: 12, 'mozambique-tilapia': 14 },
    blurb: '"Rated one of the best bass fishing dams in the world": drowned timber, green Midlands hills and a game reserve on the banks.',
    tips: [
      'This is THE bass dam — soft plastics through the drowned timber.',
      'Big bass push into the shallows at dawn.',
      'Carp on mielies along the gentler banks.',
    ],
  },
  {
    id: 'midmar', name: 'Midmar Dam', province: 'kwazulu-natal', town: 'Howick',
    kind: 'dam', land: 'midlands', temp: -1, tint: 'olive', clarity: 0.45, far: null, structure: ['reeds', 'timber'],
    fish: { 'common-carp': 38, 'largemouth-bass': 34, catfish: 12, 'mozambique-tilapia': 16 },
    blurb: 'The Midlands\' biggest water, near Howick: some of SA\'s largest recorded bass and carp of the last 20 years came from here.',
    tips: [
      'Record-class carp: a mieliebom and patience.',
      'Bass year-round in the designated areas.',
      'Midmar can blow — find the sheltered bays.',
    ],
  },
  {
    id: 'pongola-river', name: 'Pongola River (below Jozini)', province: 'kwazulu-natal', town: 'Jozini / Pongola',
    kind: 'river', land: 'lowveld', tint: 'olive', clarity: 0.5, far: 65, structure: ['reeds', 'timber'],
    fish: { tigerfish: 40, 'mozambique-tilapia': 25, catfish: 20, 'largescale-yellowfish': 15 },
    blurb: 'The Pongola flowing out below the Lebombo gorge: tigerfish in the runs, kurper and barbel in the pools. Hot and green.',
    tips: [
      'Tigers sit where fast water meets slow — a spinner, and never without a wire trace.',
      'Blue kurper on worms in the backwaters.',
      'Tigers bite early and late; the midday heat shuts them down.',
    ],
  },
  {
    id: 'kamberg', name: 'Little Mooi River (Kamberg)', province: 'kwazulu-natal', town: 'Kamberg (Central Drakensberg)',
    kind: 'stream', fly: true, land: 'drakensberg', temp: -10, tint: 'clear', clarity: 0.85, far: 14,
    fish: { 'brown-trout': 70, 'rainbow-trout': 30 },
    blurb: 'Some of the best river fly fishing in the Drakensberg: a clear, cold stream through golden grassland under the escarpment — wild browns, stocked as early as the 1800s.',
    tips: [
      'Browns hide under the cut banks — a nymph drifted tight to the edge.',
      'Cold, clear water: stay low and cast upstream.',
      'April and May are prime: sunny days, cold nights, hungry trout.',
    ],
  },
  {
    id: 'underberg', name: 'Umzimkulu River (Underberg)', province: 'kwazulu-natal', town: 'Underberg / Himeville',
    kind: 'stream', fly: true, land: 'drakensberg', temp: -10, tint: 'clear', clarity: 0.8, far: 22,
    fish: { 'brown-trout': 55, 'rainbow-trout': 45 },
    blurb: 'Underberg is "the centre of trout fishing in KZN": river beats on the Umzimkulu under the southern Drakensberg.',
    tips: [
      'Trout rise at dusk — a dry fly on the flat water.',
      'Nymphs through the runs in the middle of the day.',
      'Autumn is the season: cold nights, log fires, big browns.',
    ],
  },
  // ------------------------------------------------------------- Eastern Cape
  {
    id: 'rhodes', name: 'Bell River (Rhodes)', province: 'eastern-cape', town: 'Rhodes (Eastern Cape Highlands)',
    kind: 'stream', fly: true, land: 'drakensberg', temp: -11, tint: 'clear', clarity: 0.85, far: 16,
    fish: { 'rainbow-trout': 55, 'smallmouth-yellowfish': 30, 'brown-trout': 15 },
    blurb: 'Home of the Wild Trout Association: a clear, cold stream in the high Southern Drakensberg around the tiny village of Rhodes. Sight-cast to yellowfish in the stream; trout everywhere.',
    tips: [
      'Sight-cast to yellowfish in the pools — they\'re visible in the clear water.',
      'Wild rainbows in the riffles on small nymphs.',
      'Winter here is freezing — the trout don\'t mind, you might.',
    ],
  },
  {
    id: 'darlington', name: 'Darlington Dam (Lake Mentz)', province: 'eastern-cape', town: 'Jansenville / Kirkwood (Sundays River)',
    kind: 'dam', land: 'karoo', temp: 3, tint: 'muddy', clarity: 0.2, far: null, structure: ['timber'],
    fish: { 'common-carp': 48, catfish: 30, mudfish: 12, 'mozambique-tilapia': 10 },
    blurb: 'Karoo heat and big water — "25% bigger than Harties when full" — on the Sundays River: carp and barbel country.',
    tips: [
      'Extreme heat in summer — fish at dawn and after dark.',
      'Carp and barbel are the targets here.',
      'Big barbel in the timber after dark.',
    ],
  },
  {
    id: 'little-fish-river', name: 'Little Fish River', province: 'eastern-cape', town: 'Somerset East',
    kind: 'river', fly: true, land: 'karoo', temp: -4, tint: 'clear', clarity: 0.6, far: 22, structure: ['reeds'], // cool Boschberg mountain water
    fish: { 'smallmouth-yellowfish': 40, 'largemouth-bass': 20, mudfish: 15, catfish: 10, 'rainbow-trout': 15 },
    blurb: 'A Karoo river near Somerset East with a river trout record over 14lb (2013): smallmouth yellowfish, bass, mudfish and barbel on fly.',
    tips: [
      'Smallmouth yellows on nymphs — indigenous fish, handle with care.',
      'The odd big trout in the cooler pools.',
      'Bass hide under the willows.',
    ],
  },
  {
    id: 'great-fish-river', name: 'Great Fish River', province: 'eastern-cape', town: 'Cradock',
    kind: 'river', land: 'karoo', tint: 'muddy', clarity: 0.25, far: 40, structure: ['reeds', 'timber'],
    fish: { 'smallmouth-yellowfish': 30, 'common-carp': 25, catfish: 20, 'largemouth-bass': 15, 'smallmouth-bass': 10 },
    blurb: 'A muddy Karoo river fed by the Orange River tunnel: yellowfish, carp, barbel and both bass among willows and thorn trees.',
    tips: [
      'Yellows and carp on mielies in the slower pools.',
      'Smallmouth bass in the faster rocky runs.',
      'Barbel at night.',
    ],
  },
  {
    id: 'xonxa', name: 'Xonxa Dam', province: 'eastern-cape', town: 'Lady Frere (White Kei River)',
    kind: 'dam', land: 'midlands', temp: -2, tint: 'brown', clarity: 0.3, far: 380, structure: ['reeds'],
    fish: { 'common-carp': 40, 'largemouth-bass': 25, catfish: 20, 'smallmouth-yellowfish': 15 },
    blurb: 'A quiet dam on the White Kei in rolling grassland: carp, bass, barbel and yellowfish.',
    tips: [
      'Carp on mielies along the bank.',
      'Bass around the reeds at dawn and dusk.',
      'Yellows near the river inlet.',
    ],
  },
  {
    id: 'orange-aliwal', name: 'Orange River at Aliwal North', province: 'eastern-cape', town: 'Aliwal North',
    kind: 'river', land: 'karoo', tint: 'muddy', clarity: 0.2, far: 90, structure: ['reeds', 'timber'],
    fish: { 'smallmouth-yellowfish': 30, 'largemouth-yellowfish': 10, 'common-carp': 25, catfish: 20, mudfish: 15 },
    blurb: 'The upper Orange on the Free State border: brown, strong water among willows and Karoo hills — yellowfish, carp, barbel and mudfish.',
    tips: [
      'Largemouth yellows chase baitfish in the deeper runs — a streamer or spinner.',
      'Carp and mudfish in the slower backwaters.',
      'The river rises fast after summer storms — muddy water, fish the edges.',
    ],
  },
  // ------------------------------------------------------------- Western Cape
  {
    id: 'theewaterskloof', name: 'Theewaterskloof Dam', province: 'western-cape', town: 'Villiersdorp',
    kind: 'dam', land: 'winelands', tint: 'tea', clarity: 0.35, far: null, structure: ['timber', 'reeds'],
    fish: { 'largemouth-bass': 30, 'smallmouth-bass': 15, 'common-carp': 30, bluegill: 25 },
    blurb: 'The Western Cape\'s biggest dam, ringed by mountains near Villiersdorp: tea-coloured water, dead trees, bass, carp and bluegill — "a great place to fish in the right conditions".',
    tips: [
      'Bluegill bite all day on worms — a fun family spot.',
      'Bass around the drowned trees.',
      'The Cape southeaster blows hard — pick a sheltered bay.',
    ],
  },
  {
    id: 'clanwilliam', name: 'Clanwilliam Dam', province: 'western-cape', town: 'Clanwilliam (Cederberg)',
    kind: 'dam', land: 'cederberg', tint: 'tea', clarity: 0.4, far: 300, structure: ['timber'],
    fish: { 'largemouth-bass': 25, 'smallmouth-bass': 25, bluegill: 22, 'common-carp': 12, catfish: 10, 'clanwilliam-yellowfish': 6 },
    blurb: '"The only place where you can find all three bass species" — under the orange Cederberg sandstone: bass, bluegill, carp, barbel and the occasional Clanwilliam yellowfish.',
    tips: [
      'Smallmouth bass on the rocky points, largemouth in the timber.',
      'Bluegill everywhere in the shallows — worms or a small dry fly.',
      'A Clanwilliam yellowfish is endangered — photograph it and let it go.',
    ],
  },
  {
    id: 'breede', name: 'Breede River', province: 'western-cape', town: 'Robertson',
    kind: 'river', land: 'winelands', tint: 'tea', clarity: 0.45, far: 50, structure: ['reeds', 'timber'],
    fish: { 'smallmouth-bass': 35, 'common-carp': 30, catfish: 15, 'largemouth-bass': 20 },
    blurb: 'Through the Robertson vineyards: smallmouth bass "thriving in fast-flowing rocky sections", carp and barbel in the slow water.',
    tips: [
      'Smallmouth bass in the fast rocky runs around Robertson.',
      'Carp in the slow, deep pools — mielies.',
      'Spring and autumn are best on the Breede.',
    ],
  },
  {
    id: 'smalblaar', name: 'Smalblaar River', province: 'western-cape', town: 'Du Toit\'s Kloof',
    kind: 'stream', fly: true, land: 'fynbos', temp: -8, tint: 'tea', clarity: 0.75, far: 14,
    fish: { 'rainbow-trout': 100 },
    blurb: '"The most popular trout river in the Western Cape": wild rainbows in a tea-coloured fynbos stream under the Du Toit\'s Kloof peaks. Catch-and-release, fly only.',
    tips: [
      'Wild rainbows — they breed here, no stocking for years.',
      'A dry fly on the pocket water; trophy fish of 3lb every year.',
      'Season runs 1 September to 31 May — catch and release only.',
    ],
  },
  {
    id: 'cederberg-olifants', name: 'Olifants River (Cederberg)', province: 'western-cape', town: 'Citrusdal / Clanwilliam',
    kind: 'river', fly: true, land: 'cederberg', tint: 'tea', clarity: 0.7, far: 35,
    fish: { 'clanwilliam-yellowfish': 60, 'smallmouth-bass': 25, catfish: 15 },
    blurb: 'Sight-fishing for the endangered Clanwilliam yellowfish in a clear, rocky Cederberg river under orange sandstone. Protected: catch and release.',
    tips: [
      'Clanwilliams are spooky — once they\'ve seen you they ignore everything.',
      'Long, light leader and a small nymph; 8-10lb fluoro tippet.',
      'Bass harm the yellowfish here — don\'t release bass in the upper river.',
    ],
  },
  {
    id: 'stettynskloof', name: 'Stettynskloof Dam', province: 'western-cape', town: 'Rawsonville',
    kind: 'dam', land: 'fynbos', temp: -3, tint: 'tea', clarity: 0.55, far: 260, steep: 2.2,
    fish: { 'smallmouth-bass': 70, 'rainbow-trout': 10, bluegill: 20 },
    blurb: 'A mountain dam above Rawsonville, "teeming with smallmouth bass", feeding the Holsloot trout stream below.',
    tips: [
      'Smallmouth bass on the rocky drop-offs — small spinners.',
      'Clear mountain water: light line.',
      'Bluegill in the shallows for the kids.',
    ],
  },
  // ------------------------------------------------------------ Northern Cape
  {
    id: 'vanderkloof', name: 'Vanderkloof Dam', province: 'northern-cape', town: 'Vanderkloof (Orange River)',
    kind: 'dam', fly: true, land: 'karoo', tint: 'olive', clarity: 0.45, far: null, steep: 1.8, structure: ['timber'],
    fish: { 'smallmouth-yellowfish': 30, 'largemouth-yellowfish': 18, 'common-carp': 25, catfish: 15, mudfish: 12 },
    blurb: 'SA\'s second-largest dam in a Karoo gorge — "the ideal habitat for largemouth yellowfish": the place to hunt a trophy largemouth.',
    tips: [
      'Trophy largemouth yellows: a big streamer along the drop-offs.',
      'Smallmouths and carp on mielies from the bank.',
      'Rocky Karoo shoreline — the deep water comes close.',
    ],
  },
  {
    id: 'orange-upington', name: 'Orange River at Upington', province: 'northern-cape', town: 'Upington',
    kind: 'river', fly: true, land: 'orange', tint: 'muddy', clarity: 0.3, far: 80, structure: ['reeds', 'timber', 'reeds'],
    fish: { 'smallmouth-yellowfish': 34, 'largemouth-yellowfish': 14, catfish: 22, 'common-carp': 18, mudfish: 12 },
    blurb: '"Long, island-dotted runs" through green vineyards on the edge of the Kalahari: smallmouth yellows on nymphs, largemouths on streamers, barbel on bait.',
    tips: [
      'Year-round smallmouth yellows on nymphs in the island runs.',
      'Streamers for the largemouths in the deeper channels.',
      'Barbel on bait or lures — big ones in the Orange.',
    ],
  },
  {
    id: 'lower-vaal', name: 'Vaal River (Barkly West)', province: 'northern-cape', town: 'Barkly West / Kimberley',
    kind: 'river', fly: true, land: 'orange', tint: 'brown', clarity: 0.4, far: 60, structure: ['reeds'],
    fish: { 'smallmouth-yellowfish': 42, 'largemouth-yellowfish': 16, 'common-carp': 16, catfish: 14, mudfish: 12 },
    blurb: 'The lower Vaal and Riet near Kimberley: "the unrivalled destination for stable fly fishing populations" of largemouth and smallmouth yellowfish.',
    tips: [
      'World-class yellowfish on fly — nymphs for smallmouths, streamers for largemouths.',
      'Rocky rapids and deep pools, old diamond-digging country.',
      'Carp and barbel in the slower pools.',
    ],
  },
  {
    id: 'douglas', name: 'Orange–Vaal Confluence (Douglas)', province: 'northern-cape', town: 'Douglas',
    kind: 'river', land: 'orange', tint: 'muddy', clarity: 0.25, far: 110, structure: ['reeds', 'timber'],
    fish: { 'common-carp': 30, 'smallmouth-yellowfish': 26, catfish: 20, mudfish: 14, 'largemouth-yellowfish': 10 },
    blurb: 'Where the Vaal meets the Orange near Douglas: big brown water, willows and reeds, and the full Orange-Vaal mix.',
    tips: [
      'Two rivers\' worth of fish — yellows, carp, barbel and mudfish.',
      'Mielies for carp and mudfish in the slow water.',
      'Largemouth yellows hunt where the rivers mix.',
    ],
  },
  {
    id: 'augrabies', name: 'Orange River (Kakamas/Augrabies)', province: 'northern-cape', town: 'Kakamas',
    kind: 'river', land: 'orange', temp: 3, tint: 'muddy', clarity: 0.3, far: 70, structure: ['reeds', 'reeds'],
    horizon: { base: 6, rough: 3, ridges: [{ az: 330, width: 0.5, height: 14 }] },
    fish: { catfish: 28, 'smallmouth-yellowfish': 26, 'common-carp': 22, mudfish: 14, 'largemouth-yellowfish': 10 },
    blurb: 'Granite and red dunes near the Augrabies gorge; the Orange runs between green islands and vineyards. Hot, and full of barbel.',
    tips: [
      'Big barbel in the Orange — heavy tackle and chicken liver.',
      'Yellows in the rocky channels between the islands.',
      'Blistering heat in summer — fish dawn and dusk.',
    ],
  },
  {
    id: 'spitskop', name: 'Spitskop Dam', province: 'northern-cape', town: 'Kimberley (Harts River)',
    kind: 'dam', land: 'orange', tint: 'brown', clarity: 0.25, far: 340, structure: ['reeds'],
    fish: { 'common-carp': 45, catfish: 25, mudfish: 15, 'smallmouth-yellowfish': 15 },
    blurb: 'A flat, dusty-veld dam on the Harts River north of Kimberley: carp and barbel water.',
    tips: [
      'Carp on the mieliebom — flat banks, easy access.',
      'Barbel after dark.',
      'Hot, open water — early and late.',
    ],
  },
];
