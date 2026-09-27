# Changelog — Dam Angler

A 3D browser fishing game set on six real South African dams. Newest first.
Each entry names the commit it shipped in (see `git log`).

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
