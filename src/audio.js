// Every sound in the game, generated live with the Web Audio API -- no audio
// files, so nothing extra to download on a phone.
//
//   ambience  wind in the reeds (follows the game's wind), water lapping at
//             the bank, the odd fish rising, birds by day, crickets and
//             reed frogs after dark
//   casting   the rod whooshing, line peeling off the reel, the plop
//   fight     reel ratchet while you wind, the drag screaming when a fish
//             takes line, splashes, the line creaking near breaking point
//   moments   the bite, a snapped line, a landed fish
//
// Browsers only allow sound after the player taps or clicks, so the audio
// starts suspended and unlocks on the first touch / click / key.

const BIRD_RATE = { morning: 1.4, midMorning: 0.9, midday: 0.35, afternoon: 0.7, sunset: 1.0, lateTwilight: 0.15, night: 0 };
const NIGHT = { lateTwilight: 0.6, night: 1 };

export function createAudio({ volume = 0.7 } = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const silent = {
    unlock() {}, setVolume() {}, update() {}, cast() {}, plop() {}, splash() {}, rise() {}, bite() {}, snap() {}, landed() {}, click() {},
  };
  if (!Ctx) return silent;

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
  const amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
  let vol = volume;
  const applyVolume = () => master.gain.setTargetAtTime(vol * vol, ctx.currentTime, 0.05);
  applyVolume();

  // Two seconds of white noise, reused by every noisy sound.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (loop = false) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; };
  const filter = (type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const gainNode = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  // ---- Ambience: continuous layers --------------------------------------
  // Wind: low rumbling noise, louder and brighter in a stronger wind.
  const windF = filter('lowpass', 500, 0.5);
  const windG = gainNode(0);
  const windSrc = noise(true);
  windSrc.connect(windF); windF.connect(windG); windG.connect(amb);
  // Water lapping at the bank: soft, muffled, swelling and fading.
  const lapF = filter('lowpass', 320, 0.8);
  const lapG = gainNode(0);
  const lapSrc = noise(true);
  lapSrc.playbackRate.value = 0.8;
  lapSrc.connect(lapF); lapF.connect(lapG); lapG.connect(amb);
  // Crickets: a high tone pulsed ~28 times a second, in bursts.
  const cricketOsc = ctx.createOscillator(); cricketOsc.type = 'square'; cricketOsc.frequency.value = 4400;
  const cricketF = filter('bandpass', 4400, 12);
  const cricketPulse = gainNode(0);
  const pulseLfo = ctx.createOscillator(); pulseLfo.type = 'square'; pulseLfo.frequency.value = 28;
  const pulseDepth = gainNode(0.5);
  const pulseBias = ctx.createConstantSource ? ctx.createConstantSource() : null;
  pulseLfo.connect(pulseDepth); pulseDepth.connect(cricketPulse.gain);
  if (pulseBias) { pulseBias.offset.value = 0.5; pulseBias.connect(cricketPulse.gain); }
  const cricketG = gainNode(0);
  cricketOsc.connect(cricketF); cricketF.connect(cricketPulse); cricketPulse.connect(cricketG); cricketG.connect(amb);
  // Line strain: a taut, creaking hum as the line nears breaking point.
  const strainOsc = ctx.createOscillator(); strainOsc.type = 'sawtooth'; strainOsc.frequency.value = 165;
  const strainF = filter('bandpass', 900, 3);
  const strainG = gainNode(0);
  strainOsc.connect(strainF); strainF.connect(strainG); strainG.connect(sfx);

  let started = false;
  function startLayers() {
    if (started) return;
    started = true;
    windSrc.start(); lapSrc.start(); cricketOsc.start(); pulseLfo.start(); strainOsc.start();
    if (pulseBias) pulseBias.start();
  }

  // ---- One-shot sounds ---------------------------------------------------
  // A shaped burst of filtered noise (splash, whoosh, crack).
  function noiseBurst({ dur = 0.3, type = 'lowpass', freq = 1200, freqEnd = null, q = 0.8, vol = 0.5, attack = 0.005, when = 0, dest = sfx }) {
    const t = ctx.currentTime + when;
    const src = noise();
    const f = filter(type, freq, q);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  // A pitched blip that slides (bird chirps, plops, notes).
  function tone({ freq = 440, freqEnd = null, dur = 0.2, type = 'sine', vol = 0.3, attack = 0.005, when = 0, dest = sfx }) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // One reel click: a tiny, bright tick.
  function reelClick(bright = 1, vol = 0.12) {
    noiseBurst({ dur: 0.018, type: 'bandpass', freq: 2600 * bright, q: 4, vol, attack: 0.001 });
  }

  // A bird: a few quick chirps from a random "species" of song.
  function bird() {
    const base = 2400 + Math.random() * 2600;
    const notes = 2 + Math.floor(Math.random() * 4);
    const up = Math.random() < 0.5;
    for (let i = 0; i < notes; i++) {
      const f = base * (1 + (Math.random() - 0.5) * 0.25);
      tone({ freq: f, freqEnd: f * (up ? 1.35 : 0.72), dur: 0.07 + Math.random() * 0.06, vol: 0.05 + Math.random() * 0.04, when: i * (0.1 + Math.random() * 0.06), dest: amb });
    }
  }
  // Night frogs at an SA dam. Mostly painted reed frogs: short, high
  // whistled "tinks" from the reeds, a few at a time and never quite
  // evenly spaced. Now and then a guttural toad's long, soft snore.
  function frog() {
    if (Math.random() < 0.8) {
      const n = 2 + Math.floor(Math.random() * 4);
      let when = 0;
      for (let i = 0; i < n; i++) {
        const f = 2700 + Math.random() * 700;
        tone({ freq: f, freqEnd: f * 1.06, dur: 0.045 + Math.random() * 0.03, vol: 0.018 + Math.random() * 0.018, attack: 0.008, when, dest: amb });
        when += 0.18 + Math.random() * 0.35;
      }
      return;
    }
    // Guttural toad: a buzzy note trilled ~20 times a second, muffled by
    // distance, swelling in and out over about a second.
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 170 + Math.random() * 40;
    const lp = filter('lowpass', 650, 0.7);
    const trill = ctx.createOscillator();
    trill.frequency.value = 18 + Math.random() * 6;
    const trillDepth = gainNode(0.5);
    const g = gainNode(0.5); // 0.5 +/- 0.5: pulses between silent and full
    const body = gainNode(0);
    trill.connect(trillDepth); trillDepth.connect(g.gain);
    body.gain.setValueAtTime(0, t);
    body.gain.linearRampToValueAtTime(0.03, t + 0.25);
    body.gain.setValueAtTime(0.03, t + 0.7);
    body.gain.linearRampToValueAtTime(0, t + 1.1);
    o.connect(lp); lp.connect(g); g.connect(body); body.connect(amb);
    o.start(t); trill.start(t);
    o.stop(t + 1.2); trill.stop(t + 1.2);
  }
  // A small wave arriving at the bank: swells in slowly, then washes out.
  // No hard edge, so it never sounds like a knock.
  function lap(windiness) {
    noiseBurst({ dur: 0.9 + Math.random() * 0.6, type: 'lowpass', freq: 520 + windiness * 300, freqEnd: 160, q: 0.6,
      vol: 0.025 + windiness * 0.03 + Math.random() * 0.01, attack: 0.3 + Math.random() * 0.2, dest: amb });
  }

  // ---- Per-frame state ---------------------------------------------------
  let ambienceOn = false;
  let birdTimer = 2, frogTimer = 4, lapPhase = 0, cricketPhase = 0, lapTimer = 1;
  let reelAcc = 0, dragAcc = 0;

  function update(dt, { active = false, windSpeed = 0, timeOfDay = 'midday', reelRate = 0, dragRate = 0, tension = 0 } = {}) {
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Ambience fades in while you're at the water, out on the menus.
    if (active !== ambienceOn) {
      ambienceOn = active;
      amb.gain.setTargetAtTime(active ? 1 : 0, now, 0.8);
    }
    if (!active) { strainG.gain.setTargetAtTime(0, now, 0.05); return; }

    const w = Math.min(1, windSpeed / 12);
    windG.gain.setTargetAtTime(0.04 + w * 0.22, now, 0.5);
    windF.frequency.setTargetAtTime(300 + w * 900, now, 0.5);

    lapPhase += dt * (0.5 + Math.random() * 0.2);
    lapG.gain.setTargetAtTime(0.035 + 0.03 * (0.5 + 0.5 * Math.sin(lapPhase * 1.3) * Math.sin(lapPhase * 0.37)) + w * 0.025, now, 0.3);
    // Now and then a little wave laps in -- more often in a breeze.
    lapTimer -= dt * (0.6 + w);
    if (lapTimer <= 0) { lap(w); lapTimer = 1.5 + Math.random() * 3; }

    const night = NIGHT[timeOfDay] || 0;
    cricketPhase += dt;
    const chirping = (cricketPhase % 1.1) < 0.45; // bursts of cricket song
    cricketG.gain.setTargetAtTime(night * (chirping ? 0.018 : 0), now, 0.03);

    const birdRate = BIRD_RATE[timeOfDay] ?? 0.5;
    birdTimer -= dt * birdRate;
    if (birdTimer <= 0) { if (birdRate > 0) bird(); birdTimer = 2 + Math.random() * 6; }
    frogTimer -= dt * night;
    if (frogTimer <= 0) { frog(); frogTimer = 2.5 + Math.random() * 6; }

    // Winding the reel: steady ratchet clicks.
    reelAcc += dt * 16 * reelRate;
    while (reelAcc >= 1) { reelAcc -= 1; reelClick(1, 0.08); }
    // Drag: a fish taking line makes the spool scream -- fast, bright clicks.
    dragAcc += dt * 48 * dragRate;
    while (dragAcc >= 1) { dragAcc -= 1; reelClick(1.35, 0.1); }

    // Creak as the line nears its breaking strain.
    const strain = Math.max(0, (tension - 0.65) / 0.3);
    strainG.gain.setTargetAtTime(Math.min(1, strain) * 0.05, now, 0.08);
    strainOsc.frequency.setTargetAtTime(150 + strain * 90 + Math.sin(now * 23) * 6, now, 0.05);
  }

  return {
    // Browsers need a tap/click first.
    unlock() {
      if (ctx.state === 'suspended') ctx.resume();
      startLayers();
    },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); applyVolume(); },
    // 'running' once unlocked; 'suspended' before the first tap.
    get state() { return ctx.state; },
    update,
    // Rod whooshing through the air, then line peeling off the spool.
    cast(power = 1) {
      noiseBurst({ dur: 0.35, type: 'bandpass', freq: 1800, freqEnd: 500, q: 1.2, vol: 0.18 + power * 0.25, attack: 0.03 });
      const peel = 6 + Math.round(power * 10);
      for (let i = 0; i < peel; i++) {
        const t = 0.12 + i * (0.035 + i * 0.004);
        setTimeout(() => reelClick(1.2, 0.05 * (1 - i / peel)), t * 1000);
      }
    },
    // The rig landing: a plop, bigger for a heavier rig.
    plop(size = 1) {
      tone({ freq: 420 * (1.2 - Math.min(0.6, size * 0.3)), freqEnd: 90, dur: 0.14, vol: 0.28 * size });
      noiseBurst({ dur: 0.18, type: 'lowpass', freq: 1400, freqEnd: 300, vol: 0.12 * size });
    },
    // Splashes: a fish thrashing or jumping, breadcrumbs landing.
    splash(strength = 1) {
      const s = Math.min(1.6, strength);
      noiseBurst({ dur: 0.25 + s * 0.3, type: 'lowpass', freq: 1800, freqEnd: 350, vol: 0.14 + s * 0.18, attack: 0.01 });
      noiseBurst({ dur: 0.12, type: 'highpass', freq: 3000, vol: 0.05 * s, when: 0.02 });
    },
    // A fish rising somewhere on the dam: a soft bloop, not a splash.
    rise(strength = 1) {
      const s = Math.min(1, strength);
      tone({ freq: 240 + Math.random() * 80, freqEnd: 110, dur: 0.16, vol: 0.09 * s, attack: 0.012 });
      noiseBurst({ dur: 0.3, type: 'lowpass', freq: 900, freqEnd: 220, vol: 0.05 * s, attack: 0.02, when: 0.01 });
    },
    // Something's taken the bait.
    bite() {
      tone({ freq: 900, freqEnd: 500, dur: 0.08, vol: 0.14 });
      tone({ freq: 900, freqEnd: 500, dur: 0.08, vol: 0.12, when: 0.12 });
    },
    // The line parts: a crack and a whip.
    snap() {
      noiseBurst({ dur: 0.08, type: 'highpass', freq: 2500, vol: 0.4, attack: 0.001 });
      tone({ freq: 1400, freqEnd: 180, dur: 0.3, type: 'triangle', vol: 0.18 });
    },
    // Fish landed: a bright little rising tune.
    landed() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.12, when: i * 0.09 }));
    },
    // Menu / button tick.
    click() { tone({ freq: 1200, freqEnd: 900, dur: 0.04, vol: 0.06 }); },
  };
}
