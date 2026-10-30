# Changelog — Dam Angler

A 3D browser fishing game set on six real South African dams. Newest first.
Each entry names the commit it shipped in (see `git log`).

## v2 — Faster High/Ultra on phones (built locally, not live yet)

- Phones and tablets (iPhone, Android) keep the same look on High, Ultra and Ultra+ but on a phone budget:
  - drawn at 1.5× sharpness at most (an iPhone was drawing up to 2×, on a 3× screen);
  - 4× edge smoothing instead of 8×, and a lighter water reflection;
  - 2048 shadows instead of 4096;
  - half the grass, 60% of the bank weeds, normal leaf density and at most 5 campers.
- Auto-sharpness still steps down further if the frame rate drops (`main.js` `graphicsFor`, `scene.js` `handheld`).

## v2 — Camp people fixes (built locally, not live yet)

- **Chairs the right way round**: the scanned plastic chairs were turned 180°, so campers sat facing the backrest (`camp.js` `SCAN_CHAIR_TURN` is now 0).
- **Faces in the shade**: heads give back a little of their own colour (more for darker skin, dimmed at night, `people.js` `setPeopleLight`). Faces no longer go flat black when lit from behind or under a boat's canopy.
- **Food and drink held properly**: bottles and cans stand upright in the hand and tip to the lips when drinking. The boerewors roll is held crosswise and now looks like one: crust, soft inside, wors poking out both ends, and relish. The bottle got a gold cap and the can a silver top.

## v2 — Boat rods and walking the deck (built locally, not live yet)

- **The boat's own rods** (`src/boatRods.js`): a rack of six outfits, each rigged for one kind of fish — bass, carp, yellowfish & trout, barbel, tigerfish and kurper. The bass boat, tiger boat and kayak each carry their own set. Fish what a rod is rigged for and that fish pays **+50% credits and +50% XP**. Each comes fully rigged: reel, line, hook and its own baits, picked in the rack (the bass rod has a soft plastic, spinner, crankbait, jig and frog). Nothing from your own rig comes across, so a mieliebom no longer ends up on the bass rod. The rods stay on the boat: step ashore and you're back on your own rod and rig, and your saved gear never changes.
- **Walk the deck** (H, or the "Walk the deck" button): the anchor drops and W/A/S/D (or the stick) walks you round the boat, inside the gunwales and round the consoles. The rod rack is at the stern (R, or "Boat rods"). In a kayak the rods are behind your seat. H takes the helm again.
- **Server pays it too**: a catch sends its boat rod. The server only accepts it on water where you'd have that boat, then works out the bonus itself. The extra XP is stored per catch (migration `010_boat_rods.sql`, `catches.boat_pts`).
- Phones: the boat buttons sit above the drag control.
- Tests: `test/boatRods.test.js`, plus a server test for boat-rod payouts.

## v2 — Real boats, modelled in Blender (built locally, not live yet)

- **Every boat rebuilt from scratch in Blender** (`tools/build-boats.mjs`):
  bass boat, tiger boat, fishing kayak, ski boat, pontoon, houseboat and
  yacht. Proper V-bottom hulls with chines, spray rails and a rising bow;
  carpeted decks with rod lockers and livewells; consoles with wheel,
  gauges and fish finder; bucket seats; outboards with a spinning prop;
  bow trolling motor; rods in holders; shade canopy on the tiger boat,
  wakeboard tower on the ski boat, sails on the yacht. Corner shading
  baked in Cycles. Each boat its own paint (metal-flake bass boats,
  painted aluminium tiger boats, bright kayaks); shiny paint and chrome
  reflect the sky.
- The live crews stand and sit in the boats' real seats; the kayak has a
  real paddler with both hands on a working paddle.
- **White-water wake** trails behind your boat and the ski boats.
- Low graphics keeps the old simple boats.

## v2 — Starter kits, your own boat, and a living campsite (built locally, not live yet)

- **Starter kits**: five free kits everyone owns from the start (old saves
  get them too): General, **Bass** (Sensation Rapid Spin, spinning reel,
  light fluorocarbon, weedless hooks, soft plastic, spinnerbait), **Carp**
  (Adrenalin Eco Tech 3.66 m, budget baitrunner, carp mono, hair rigs,
  mielies, mieliebom), Fly, and Barbel & Tiger. One tap in the Tackle Box
  rigs a whole kit. The server hands them out too, and they don't count
  against the guest-import limit.
- **Your own boat** on dams that allow boats: a bass boat (a tiger boat on
  tigerfish water, a kayak where only paddling is allowed), tied up off the
  slipway or beside your spot. G or the on-screen button gets in and out;
  W/S throttle, A/D steer, Shift full speed. It rides the waves, leaves a
  wake, bumps off the bank and stands; the anchor drops while your line is
  out, and you step ashore only near the bank or a stand.
- **Real people at the camps**: men, women and kids with real faces, skin
  and clothes (Microsoft Rocketbox, MIT licence, converted and retargeted in
  Blender) walking, sitting, drinking, eating boerewors rolls, laughing and
  chatting. The braai master turns the meat with tongs, has a beer and
  fetches another from the cooler box; the kids run about.
- **The anglers really fish**: they wait in their chairs behind the rod
  pods, run for the rod on a take, play the fish in (rod bending and
  pumping, line cutting the water, splashes as it comes close), land it,
  hold it up for a photo while the camp claps and cheers, slip it back,
  cast out again and sit down. You hear about it when you're nearby.
- **Boat crews too**: anglers on the bass and tiger boats cast and work
  lures and now and then hook one; the rest sit back.
- **Real fire**: the braai flames are a fire simulated in Blender
  (Mantaflow), rendered frame by frame and played back over the coals,
  with boerewors and chops on the grid.
- Rebuild: `python tools/fetch-rocketbox.py`, then
  `node tools/build-campers.mjs` (people, motions and the fire).
  Previews: /tools/people-preview and /tools/people-game-preview.

## v2 — Smoother frames and Blender-rendered Tackle Box (built locally, not live yet)

- **Smoother**: the water's mirror image and the sun's shadows are redrawn
  every other frame (shadows every frame while you move); every graphics
  program is built before the first frame, so nothing hitches the first
  time it comes into view; and the picture's sharpness now follows the
  frame rate the whole time (down to half when it struggles, back up when
  there's headroom) instead of being set once at the start. Draw calls per
  frame down about a third.
- **F3** shows frames a second, frame time, sharpness and which graphics
  chip and renderer the game is on.
- **Tackle Box pictures rendered in Blender** (Cycles, on the graphics
  card): every rod, reel, combo, line, hook, lure, bait and fish finder,
  lit like a product photo -- the same models and framing as before.
  Pipeline: `node tools/gear-export-server.mjs` + open
  http://localhost:5191/tools/gear-export.html (exports the models), then
  `node tools/build-gear-pictures.mjs`. Anything without a picture is still
  photographed in the game as before.

## v2 — Photo-scanned scenery and Blender people (built locally, not live yet)

- **Real scanned ground**: photo-scanned grass (lush in KZN and the
  Lowveld, dry tufts in the Karoo and Cape, Highveld veld elsewhere) and bank
  soil (damp sand, dry Vaal silt, red Loskop laterite) from Poly Haven
  (CC0), tiled at their real size.
- **Real boulders**: scanned Namaqualand boulders and stones in place of the
  built rocks, on the land and along the waterline.
- **Undergrowth**: wild rooibos and other shrubs, weeds along the margin,
  stumps, fallen logs and dry branches on every bank (more on higher
  settings), drawn patch by patch so what's behind you costs nothing.
- **Camps**: white plastic monobloc chairs, a drum braai, a picnic table
  with a lantern, a bread crate and a bucket -- all scans -- and people
  modelled in Blender (smooth bodies, bucket hats and caps, mixed skin
  tones and outfits; sitting, standing, and with a rod).
- **Bark and planks**: scanned blue-gum and willow bark on the trees, and
  weathered scanned planks on the jetties.
- Pipeline: `python tools/fetch-scans.py` (downloads ~88 MB of scans into
  art-source/, not in git) then `node tools/build-scenery.mjs` (Blender
  shrinks them for the browser into assets/scenery, ~19 MB; a dam loads only
  what it uses). Low graphics keeps the old built scenery.
- New test: every scenery file the game asks for is present.

## v2 — Fish remodelled in Blender (built locally, not live yet)

- **All 16 species rebuilt in Blender** (tools/blender/build_fish.py, run by
  `node tools/build-fish-models.mjs`; models in assets/fish3d/*.glb). Each
  family has its real outline from body depth vs length: humped carp, deep
  bluegill disc, deep tilapia, torpedo tigerfish, long bass with a big
  jutting jaw, slim trout and yellowfish, long flat-headed catfish. Shaped
  in: curved gill covers, mouths and fleshy lips (underslung on carp and
  yellowfish), eye sockets, a smoothed (subdivided) skin, ribbed fins,
  pectorals standing off the flank, wet eyes with iris and pupil, barbels
  and tigerfish teeth. A light version is used for the fish swimming out in
  the dam.
- Same skins, swimming and sizes as before, on every graphics setting except
  Low (phones keep the light built-in fish). Only the dam's own species are
  loaded (about 2 MB); if a file doesn't arrive the built-in fish is used.
- New test: every species has its model, with the parts and layout the game
  expects.

## v2 — WebGPU "Ultra+" graphics and three.js r186 (built locally, not live yet)

- **3D engine updated**: three.js r160 to r186 (Sept 2026). All graphics
  settings run on it; soft shadows now come from the sun's shadow blur.
- **Ultra+ (WebGPU)** in Settings > Graphics: the whole look rebuilt as
  three.js node materials running on WebGPU -- sky, clouds, stars and moon,
  mist, far hills, ground, swaying grass/reeds/leaves, the water, fish
  swimming, the landing net, and the picture pipeline. On top of Ultra:
  - water you can see into: the bank, weed, timber and your float's stem
    are seen through the surface, bent by the ripples, and fade with real
    depth (clear Jozini shows deeper than muddy Bronkies or the Vaal);
  - ambient occlusion: soft contact shadow under rocks, jetty planks,
    trunks and in the reeds;
  - FXAA edge smoothing, and a capped bloom so water glitter sparkles
    without washing out the picture.
  Fetched only when picked (the WebGPU build is ~2 MB); falls back to Ultra
  with a note if the browser can't do WebGPU. Auto never picks it.
- **Grass in patches** (all settings): planted in 16 m patches so patches
  behind you aren't drawn and far ones are thinned. Ultra+ went from about
  32 ms to 18 ms a frame on an Intel Iris Xe test machine.
- Fireflies are glow sprites on Ultra+ (WebGPU draws points 1 pixel wide).
- Server accepts the new `ultraplus` setting (tested).

## v2 — Fishing spots, camps, boats, waves, graphics settings (built locally, not live yet)

- **Fishing-spot maps**: the six big dams each have 3-4 named spots from SA
  forums and resort pages (Harties: Schoemansville, Kommandonek, Ifafi &
  Meerhof, Crocodile River inlet; Vaal: Deneysville, Oranjeville camp, Vaal
  Marina timber; Jozini: Nkonkoni camp, Lebombo gorge, Pongola inlet;
  Bronkies: northern jetties, estate slipway, camping bay; Loskop: Forever
  Resort, Olifants inlet, wall rocks; Roodeplaat: north-shore campsite, reed
  bay, the wall). Pick one on a sketch map in New Game. Each is its own
  scene (bank, reeds, weed, timber, rocks, depth, water) and nudges what's
  caught there. The last spot is remembered (also online).
- **Camps** where there really are campsites: dome tents, a gazebo, camp
  chairs round a braai with fire, smoke and a lantern at night, a cooler
  box, a bakkie (a caravan at the bigger resorts), people, and carp rods on
  pods at the water.
- **Boats** only where they're allowed: yachts, ski boats, bass boats and a
  party pontoon at Harties; yachts, ski and bass boats on the Vaal; tiger
  boats and a houseboat at Jozini; kayaks and sail at Roodeplaat
  (no motors). They ride the waves and leave rings behind them. Slipways
  with a bakkie and trailer, and moored boats, at spots that have them.
- **Wind waves**: the dam gets a chop as the wind picks up (about 10 cm at
  30 km/h), running with the wind; the float and the net ride them.
- **Fuller trees**: rounder, denser crowns on the gums and acacias; more
  willow strands.
- **Graphics setting: Low / Medium / High / Ultra** (Settings). Ultra: full
  screen resolution, 160k grass blades, 4096 shadows over a wider area,
  sharper reflections, fuller trees, 8x anti-aliasing -- it loads slower and
  wants a good graphics card.
- **Bait sense**: bass, tigers and largemouth yellowfish next to never take
  mieliebom, boilies, mielies, bread or dough; carp and mudfish next to
  never hit spinners, crankbaits or frogs. Bass take worms now and then.
- **Gear check**: every rod, reel, line and hook was fought against the fish
  a player at its level meets, in a matched rig -- none loses fish quickly.
  The starter size-10 hook is a bit stronger (3.2 kg) and hooks need 3.5 s
  of real overload before they can open.

## v2 — XP, levels and boss fish (built locally, not live yet)

- **XP and levels**: every new angler starts at level 1 with 0 XP. Landing
  fish earns XP -- 10 per kg, plus bonuses for your first of a species, a
  personal best, a trophy, a boss, releasing a fish, and a top-3 place in a
  monthly competition. Each level needs more XP than the last (about 30 fish
  to level 6, 95 to level 10, 180 to level 14). The level and a bar to the
  next one sit beside your credits; the title card shows level and XP.
- **Gear by level**: everything stays on show in the tackle box; anything
  above your level is faded with a padlock and the level it needs. The
  server checks it too (online players can't buy around it).
- **Fish follow your level**: beginners hook small, easy fish; the biggest
  you can hook grows each level (full size range from about level 21), and
  big ones come more often as you climb.
- **BOSS fish**: about 1 bite in 25 is a boss -- the top of your level's
  range or past it -- with a warning, a BOSS badge on the catch card and
  +120 XP. The server only accepts a boss that's a real lump for its species.
- **Gentler fight**: a jumping fish you keep winding on throws the hook far
  less often (at most 4 in 10, was up to 8 in 10 -- small bass were the
  big losers); winding while a fish runs jolts the line less, and a cheap
  reel's drag sticks less often. Big fish on light line still need care.
- **Mist** drifts with the wind properly: it no longer swings or jumps when
  the wind turns, barely moves on a still morning, drifts along in a breeze,
  thins out and blows away when the wind gets up, churns and changes shape
  as it goes, and stretches into streaks along a stronger wind.
- **Fix**: a missing import in the boss-fish code crashed the game on every
  bite (caught while testing, before anyone played it).
- Every number is tunable in the admin area (Levels section). Server:
  migration 009 adds the boss column; level worked out from the catches.

## v2 — Real landing net and living water (built locally, not live yet)

- **Landing net**: a proper 42" triangular carp net — two carbon arms, a
  spreader block, a cord across the front and a 1.8 m handle up to your
  hand. The knotted mesh bag sags, sways and fades into murky water. It
  slides in beside a beaten fish, sits half-sunk, and on a good scoop lifts
  the fish out curled in the bag.
- **Water**: real rings spread in the surface (they bend the reflections)
  from splashes, a nodding float, rising fish and spray drops; a fish
  fighting on top churns the water white; wind gusts drift darker rough
  patches across the dam with glassy slicks between. Splash spray is a
  crown of big drops and fine mist instead of eight white balls.
- **Fish close up** (on the line, in the net, in your hands): raised scales
  under a wet, glossy slime coat; silvery fish (yellowfish, tigers, trout)
  shimmer with a hint of rainbow. Barbel get leathery skin, no scales.
- **The fight on top**: the fish rolls onto its flank, kicks and shakes its
  head with its back out of the water; water streams off it in a jump.
- **Willows** weep: each strand arches out from the crown and falls in a
  curtain, instead of straight up-and-down cards.
- **Sun rays** stream out past trees, hills and your rod when you look
  towards a low sun (off on the Low graphics setting).
- **The fight and the drag** (line snapped far too easily): winding steadily
  against a slipping drag no longer breaks the line -- the drag now does
  its job. A loose drag lets even a fish twice the line's rating take line
  instead of snapping it; the price is a long fight (a 9 kg barbel on
  4.5 kg line at 15% drag: about a minute). What still breaks line: a drag
  screwed down tight, winding while the fish runs and tears line off (a
  cheap starter drag sometimes sticks on a lunge), and line fraying when a
  fish heavier than its rating keeps it loaded hard for a long time. New
  tunables: lungeOver, stickChance, lineWear, wearFrom, slipGain.
- **No more fish lost in the first seconds**: a fish in weed or reeds no
  longer snaps the line when you wind -- the drag slips, as it would; snags
  are rarer (a run bolts for cover 30% of the time, not 70%) and you get 20 s
  to free one (tapping no longer starts the count over). A hook only opens
  after 2 s of real overload, judged on the pull that actually reaches it.
  The line can never carry more than the fish can pull (a 1.5 kg bass can't
  break 4.5 kg line). Tired fish pull less, and a beaten fish stops running
  and comes in on the reel. Tunables: coverChance, straySnagChance,
  hookStrainSeconds, hookOpenRate, shockFactor, tireRelief.

## v2 — Admin area and game tuning (built locally, not live yet)

- **Admin area** at `/admin` (admins only; the role is set on the server
  with `server/make-admin.js`): dashboard (players, active today / this
  week, fish landed, credits held, biggest fish, catches per spot); player
  search and sorting; player page (tackle, catches, credit history); give
  or take credits with a reason; delete players; admin log of every action.
- **Tuning tab:** 853 values — every fish (weights, water temperature,
  credits per kg, feeding through the day, bait liking, fight), every
  tackle item (price, in the shop or not, performance), every spot's catch
  mix and water temperature, and 25 game settings (bites, fight, casting,
  money) — each with a hint, its built-in value and limits.
- Changes save to a **draft**; **Play with draft** previews it (nothing
  saved online); **Publish** (with a note) makes it live for everyone and
  for the server's payouts, prices and checks; every version is kept and
  can be rolled back; export/import moves tuning between PC and server.
- `npm run dev` fills a local test database with 50 made-up players.

## v2 — The server keeps the books (no more cheating credits)

- Logged in, credits only change on the server: a catch pays what the
  server works out (same sum the catch card shows — the price wobble is
  fixed by the catch's id), buying charges the real price and only with
  enough credits, breadcrumbs cost 15. Every change is recorded
  (credit_log).
- A save can no longer set credits or add gear; editing the browser's
  storage gets undone on the next load. A purchase the server refuses is
  undone on the device.
- Trophies are decided by the fish's weight; the payout only counts gear
  the player owns.
- A guest's progress still comes across at sign-up, up to 10,000 credits'
  worth (credits plus gear).

## v2 (branch `v2`, angler-v2.homeprojecthub.co.za) — Accounts and cloud saves

- **Sign up / log in** (email, username, password) from the title screen,
  or keep playing as a guest. A guest's progress (credits, gear, catch log)
  moves into the new account. POPIA privacy notice and consent on sign-up;
  delete your account (and everything in it) any time.
- **One game on every device:** credits, gear, what's rigged, drag, last
  spot and settings are saved on the server; log in on a phone, tablet or
  PC and carry on. Changes go up within 2 seconds; offline they wait on the
  device and sync when the connection is back ("Saved on this device — will
  sync"). If two devices clash, gear bought on either is kept.
- **Every catch is stored** (species, weight, length, trophy, spot, time)
  exactly once, and builds your catch log.
- **Dam records:** spot cards show the record fish and who caught it, and
  how many fish the dam has given up; the catch card says "New dam record!".
- Server: Node/Express API + Postgres (`angler` schema in `dam_anglers`) on
  192.168.1.36 behind nginx and the Cloudflare Tunnel; passwords bcrypt-
  hashed, login cookies HTTPS-only, password guessing rate-limited; only
  usernames are ever public. `bash tools/deploy-v2.sh` publishes.

## 2026-09-27 — Fight gauges out of the way on phones

- On phones and small screens the rod/reel/line/hook gauges sit small in
  the top-right corner instead of the middle of the screen; the tip bubble
  steps aside while a fish is on.

## 2026-09-27 — Loose drag lets fish run; New Game: province, then dams or rivers

- **Drag and line out:** a loose drag lets a strong fish strip line and run
  much further (over 20 s a big barbel ends up ~38 m out on a loose drag,
  ~33 m at a third, ~26 m screwed down). Winding against a slipping drag
  barely gains line — the spool just turns.
- **New Game** always starts at the provinces (the one you last fished is
  marked), then asks Dams / Rivers & streams / Fly fishing / All waters
  with the spots in each, then the spot list and time of day. Back buttons
  step back one page at a time.

## 2026-09-27 — Chicken liver, the SA forums' way

- Still the barbel bait, but tigerfish now take it occasionally (by day in
  tiger water; barbel dominate at night) — from SEALINE and SA angling
  sites.
- It's soft: a hard cast can flick it off (~24% at full power) and it
  washes or gets picked off as it soaks (~20% a minute, faster while
  reeled). A message says so and the status bar shows "Bait's off the
  hook"; nothing bites a bare hook. Reel in and it's re-baited.

## 2026-09-27 — Drag, fight gauges and "what went wrong"

- **Drag setting:** the reel's drag is set as a share of the line's
  breaking strain (the rule of thumb is a third — 33% by default). The
  spool slips and gives line once the pull passes it. Tight drag tires a
  fish faster but a lunge can snap the line; loose drag is safe but slow.
  Change it in the tackle box (slider), or in the game with **[ and ]**
  (or − / + on the keyboard, − / + buttons on phones). Shown as % and kg.
- **Jerky vs smooth drags:** a starter reel's drag sticks for a moment on a
  lunge; big-pit, baitcaster and disc-drag fly reels give line cleanly.
- **Fight gauges:** Rod (load against its rated lifting power), Reel (pull
  against the drag, with a marker where it slips, "giving line" / "DRAG
  STUCK"), Line (share of breaking strain, "EASE OFF" / "SLACK") and Hook
  ("OPENING", "JUMP — ease off").
- **Rods are rated** (e.g. kurper rod ~3.5 kg, carp rod ~12 kg, heavy rod
  ~18 kg). Bent past that it locks up: no more cushion, and the hook takes
  every jolt.
- **Lost fish report:** what gave — rod, reel, line or hook, each marked
  ✓ / ! / ✕ with the reason — and what to change.
- **Fix:** casting with ordinary (non-fly) line froze the game as soon as
  the line was drawn — the new fly-line colouring assumed a fly line was
  on. Broke in `17cd78f`.
- **Metric only:** line strengths in kg (no more lb), rod lengths in
  metres, jig weight in grams.

## 2026-09-27 — More tackle, priced from SA shops

- **General:** Ultralight Kurper Rod (150; sensitive tip, more kurper and
  bluegill hook-ups), Pap Dough Bait (15), Seaguar Fluorocarbon 10lb (180).
- **Carp:** Boilies (70; ~R130/kg Carp Pro), Pop-Ups (60), Method Feeder
  (80; heavy, casts far, builds a feeding spot — Korda ~R115), Chod Rig
  for pop-ups (95).
- **Bass:** Crankbait (95; Sensation Baby-B ~R95), Topwater Frog (110),
  Flipping Jig (100), Baitcasting Rod 7ft MH (560), Baitcaster Reel (450;
  SA ~R600–R3,000), PowerPro Braid 50lb for frogging (750).
- **Fly & Trout:** Stream Fly Rod 7ft 3-weight (390), and three SA flies:
  Red-Eyed Damsel, Walker's Killer, Zak Nymph.
- **Barbel & Tiger:** Sardine cut bait (30), Rapala Minnow Plug (150).
- Catch-card pictures for the five new fish: rainbow and brown trout,
  largemouth and Clanwilliam yellowfish, bluegill (~70 KB WebP each).
- Checked by simulation: boilies at Harties → 77% carp; a frog at Albert
  Falls at sunset → 85% bass; sardine at Jozini at night → 82% barbel; a
  Rapala at Jozini → 80% tigers; Zak at Parys → 93% smallmouth yellows;
  damsel at Dullstroom → 92% rainbows.

## 2026-09-27 — Tackle box by kind of fishing

- The tackle box is laid out like a tackle shop's aisles: **General,
  Carp, Bass, Fly & Trout, Barbel & Tiger**, then Bait / Rods / Reels /
  Line / Hooks inside each. Items that suit two styles show in both (a
  spinnerbait is bass and tigerfish tackle). Fly & Trout has no Hooks tab
  — flies come tied on their own hooks.
- A "Rigged:" line at the top shows what's on the rod right now, with the
  rig check under it.

## 2026-09-27 — Fly lines, fly reels and real fly casting

- **Fly lines** (Line tab, bought with credits): Floating WF5F + 4X tippet
  6lb (380) for dry flies and nymphs, Intermediate Sinking WF6I + 1X tippet
  12lb (460) for streamers. Priced from SA fly shops (Airflo ~R700, RIO
  Gold ~R1,700). The tippet is what breaks.
- **Fly reels** (Reels tab): Fly Reel 5/6 click & pawl (220) and a
  machined sealed-disc-drag reel (650) for big yellows.
- **Rig check:** the tackle box shows whether rod, reel, line and bait
  belong together. Wrong pairings still work, badly: a fly on a spinning
  rod drops at your feet (~40% distance), fly line won't cast off other
  rods, a mieliebom folds a fly rod, a sinking line drowns a dry fly. A
  mismatched cast says why.
- **Fly casting:** with a full fly rig the line whips back and forth
  overhead — back cast, forward cast, a false cast or two (more on a
  harder cast), then the loop unrolls and lays the fly softly on the
  water. The rod stops high behind and punches forward, each stroke
  swishes, and the fly line is drawn thick and bright with a thin clear
  leader.

## 2026-09-27 (overnight) — Fishing all over South Africa

### 51 spots in all nine provinces
- **45 new waters** alongside the original six dams — at least 5 in every
  province, researched from SA angling forums, venue sites and fly-fishing
  guides (full list with fish mixes and sources: `docs/fishing-spots.md`).
- **Rivers and mountain streams** (19): a far bank you can see across, a
  current that carries your float or fly downstream ("trotting"), ripples
  sliding downstream on the water. E.g. the Vaal at Parys, the Orange at
  Upington, the Pongola below Jozini, Cape trout streams, the Cederberg
  Olifants.
- **Fly-fishing waters** (14): Dullstroom and Magoebaskloof trout dams,
  Kamberg and Underberg brown-trout streams, the Bell River at Rhodes,
  the Smalblaar, Sterkfontein, and the yellowfish rivers.
- Each spot has its own landscape (Highveld, bushveld, Lowveld, escarpment,
  Drakensberg, KZN Midlands, Karoo, Orange River/Kalahari, Cape fynbos,
  Winelands, Cederberg), water colour and clarity, bank cover, and its own
  **water temperature** — cold trout streams, warm Lowveld and Karoo water.
- Local tips for every spot, plus province-wide knowledge.

### New fish: rainbow & brown trout, largemouth & Clanwilliam yellowfish, bluegill
- Rainbow trout (leap when hooked), brown trout (dusk and night feeders),
  largemouth yellowfish (the Orange-Vaal's trophy predator), Clanwilliam
  yellowfish (endangered, Cederberg only), bluegill (Cape dams).
- Each lives only where it really does: trout in cold water, tigerfish in
  the Pongola/Jozini/Lowveld, Clanwilliams in the Cape, the Orange-Vaal
  yellowfish never in the Limpopo systems.

### Fly fishing gear
- **Fly Rod (9ft 5-weight)** and three flies: **Nymph** (yellowfish and
  trout below the surface), **Dry Fly** (rising trout and bluegill),
  **Streamer** (largemouth yellows, trout, bass, even tigers).

### New Game: province → spot → time
- Pick a province (what it offers and how many dams, rivers and fly
  waters), then a spot — filter by Dams / Rivers & streams / Fly fishing —
  with its type, town, look, main fish and catch shares, best time of day
  and water temperature; then the time of day.

### Fixes
- Largemouth bass stopped biting above 24°C and smallmouth above 19°C, so
  bass never bit on a summer Highveld dam. Now 31°C and 27°C.

## 2026-09-27

### Sound (`61e00bb`)
- All sound is generated live in the browser (no audio files to download):
  wind that follows the game's wind, water lapping, birds by day, crickets
  and frogs after dark.
- Cast whoosh, line peeling off the reel, a plop (deeper for a heavy
  mieliebom), reel ratchet while winding, the drag screaming when a fish
  takes line, splashes, the line creaking near its breaking point, a snap,
  and a short tune when a fish is landed. Far-off splashes are quieter.
- Settings → Sound: Off / Low / Medium / High. Press **M** in the game to
  mute. On phones sound starts after the first tap.

### Bigger fish fight harder; the 1-in-300 trophy (`61e00bb`)
- Every fish fights according to its size for its kind, on any gear:
  more stamina, faster runs, and slower to reel in the bigger it is.
- A fish running against the drag now tires — careful play can land a
  fish that would break the line if you hauled on it.
- A hook only opens under sustained hauling in the red, not from a lunge.
- **Trophy fish:** about 1 bite in 300 is 1.5–2.1× the species' usual
  maximum. It breaks even 30lb J-Braid if you haul on it, but can be
  landed if you play it carefully. Warning on the hook-up, a gold
  "TROPHY" catch card, triple payout, and trophies counted in the catch log.

### Always the latest version (`53954e3`)
- `version.json` fingerprints every game file; it's rewritten by
  `Start Game.bat` and on every git commit (`.githooks/pre-commit`).
- The page loads every file tagged with that version, so phones and web
  hosts can't keep running an old copy.
- An open game checks for a newer version every 2 minutes and when you
  come back to it: reloads on the title screen, shows "New version
  available — tap to update" mid-game. The title screen shows the version.

## 2026-09-26

### Live fish fights, jumps, landing, distance counter, real line and hooks (`9004ebf`)
- The hooked fish really swims: runs away and to the side, cruises, tires,
  and the float and line follow it. Ease off and it's free to go anywhere —
  even away from you, taking line against the drag.
- Jumpers, from angling research: tigerfish (most — first jump within
  seconds), largemouth and smallmouth bass; yellowfish rarely; carp,
  barbel, kurper and mudfish never. Reeling through a jump can make it
  throw the hook — ease off, like the Jozini guides say.
- A fish is only landed once it's brought to your feet (within ~4 m);
  "walk to the water" hint if you're standing back. Slack-line warning.
- Longer fights for strong fish (per-species stamina).
- **Distance counter:** Aim / Cast / Line / Fish in metres, with "taking
  line" / "coming in".
- **Lines** from SA shops and forum advice: Starter 10lb mono, Trilene XL
  12lb, Carp mono 15lb, Berkley Vanish fluorocarbon 15lb (line-shy fish
  bite more), Trilene Big Game 20lb, Sufix 832 braid 20lb, Daiwa J-Braid X8
  30lb. The tension bar is now the share of the line's breaking strain;
  braid has no stretch so runs hit harder.
- **Hooks:** size 10 fine-wire, Mustad baitholder 2, double hook trace
  (2× Owner carp 8), Korda Kurv 6 hair rig, circle 2/0, Gamakatsu offset
  3/0, 40lb wire trace. Each has a strength (small hooks straighten on big
  fish), a hold, and the right hook gets more bites.
- Tackle box has tabs (Bait · Rods · Reels · Line · Hooks) so nothing hides
  below the fold; `serve.json` makes browsers fetch updated files.

### Daily feeding rhythms, groundbait, mieliebom, catch-card lock (`fd0773c`)
- Each species feeds on its real daily rhythm (carp dawn/dusk and night,
  barbel at night, bass in low light, kurper and yellowfish by day).
- Breadcrumbs work like real feed: fish find it in ~10 s, hold on it,
  drift off over 2.5 min; only fish that eat it are drawn in, and the
  visible fish swim over.
- **Mieliebom** groundbait feeder: carp's favourite, heavy so it casts
  further (62 m → 81 m on the carp rod), and it builds its own feeding spot.
- After a catch the rod button switches off and "Keep fishing" is locked
  for 1.5 s so a held thumb can't dismiss the card.

### Open dams, phones, fish pictures, catch mix per dam (`52758d9`)
- Fish directly in six real SA dams (Hartbeespoort, Vaal, Jozini,
  Bronkhorstspruit, Loskop, Roodeplaat) from the bank and angling stands,
  walking freely; cast distance from the rod, reel, line and cast power.
- Title screen (Continue, New Game, Tackle Box, Catch Log, Settings).
- First-person mouse-look; phones and tablets get a thumb-stick,
  drag-to-look, a rod button and fullscreen.
- Solid swimming fish models; catch card with photo, weight, length, value.
- Researched catch shares per dam; smallmouth and largescale yellowfish
  and mudfish added where they really live.
- "What's biting" tips, live from the bite model plus local knowledge.
- Fish pictures as ~70 KB WebP (`Optimize Fish Images.bat`).

## 2026-09-12 and earlier

- Irregular dam shapes, more locations, structure-based bites, chum,
  Escape menu (`414cced`).
- Mouse-motion rod control, cursor aiming, on-water landing ring, cast
  power meter, start menu (`af4f5f7`, `86fccfa`, `e00e93c`).
- Casting rework (click to cast, twitch, hold to reel), curved line,
  spinners (`1da5aac`).
- Day cycle with bite windows, real SA species, tackle box, shore walk
  (`6a1099a`, `1aaf211`).
- First playable 3D fishing game with sky, textures and 3D fish
  (`f54bb39`, `2139426`).
