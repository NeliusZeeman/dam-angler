import { ENGINE } from './tuning/engine.js';
// The fight: hold to reel. Reeling gains progress but loads the line; ease
// off when the tension bar runs red or it snaps. Give too much slack for too
// long and the fish throws the hook. Fish "runs" spike the tension on their
// own, harder and more often for aggressive strikers.
export function createMinigame() {
  let active = false;
  let tension = 0.35;
  let progress = 0;
  let holding = false;
  let slackTimer = 0;
  let runTimer = 0;
  let context = null;


  // The reel's drag: the spool slips and gives line once the pull passes
  // the setting, so a lunge can't reach the line's breaking strain. Set as
  // a share of the line's breaking strain -- the angler's rule of thumb is
  // a third. Too tight and a lunge snaps the line before it slips; too
  // loose and the fish takes line at will and tires slowly.
  const MIN_DRAG = 0.05;
  const MAX_DRAG = 0.9;
  // Where on the tension bar the drag starts to slip.
  const slipPoint = (d) => 0.25 + 0.95 * d;
  // Winding hard against a slipping drag still overloads the line a bit.

  const STYLE = {
    aggressive: { load: 1.45, runEvery: 1.6, runSize: 0.22, progressMul: 0.85 },
    heavy: { load: 1.3, runEvery: 3.2, runSize: 0.14, progressMul: 0.75 },
    steady: { load: 1.0, runEvery: 2.6, runSize: 0.1, progressMul: 1.0 },
    nibble: { load: 0.6, runEvery: 2.0, runSize: 0.06, progressMul: 1.25 },
  };

  // `canLand()`: is the fish actually at your feet? Winning the line isn't a
  // catch on its own -- the fish has to be brought in to the bank or stand.
  let landingBlocked = false;
  let hookStrain = 0; // seconds of hauling in the red
  let drag = ENGINE.fight.defaultDrag;
  // What the rod, reel, line and hook are going through right now -- for the
  // fight gauges and for saying what went wrong when a fish is lost.
  let slipping = false;
  let lastSpike = 0; // seconds since a lunge jolted the line
  let stuckDrag = false; // that lunge caught a jerky drag before it slipped
  let rodLoad = 0; // share of the rod's rated lifting power
  let hookLoad = 0; // share of what the hook holds before opening
  let lineLoad = 0; // share of the line's breaking strain
  let rodOverloaded = 0; // seconds bent past its rating
  // `stamina` stretches the fight: 1 = a quick kurper, ~2-3 = a big carp or
  // barbel that takes a long time to tire (see fightMotion.fightStamina).
  function start({ species, weightKg, rod, line, hook = null, reel = null, onSuccess, onFailure, canLand = () => true, stamina = 1, drag: startDrag = null }) {
    landingBlocked = false;
    if (startDrag !== null) setDrag(startDrag);
    slipping = false;
    lastSpike = 99;
    stuckDrag = false;
    rodLoad = 0;
    hookLoad = 0;
    lineLoad = 0;
    rodOverloaded = 0;
    active = true;
    tension = 0.35;
    progress = 0;
    slackTimer = 0;
    runTimer = 0;
    holding = false;
    airborne = 0;
    strainedInAir = 0;
    hookStrain = 0;
    fishPulling = false;
    context = { species, weightKg, rod, line, hook, reel, onSuccess, onFailure, canLand, stamina: Math.max(0.5, stamina) };
  }

  function setDrag(value) {
    drag = Math.max(MIN_DRAG, Math.min(MAX_DRAG, value));
  }

  // Loses the fish and reports the state everything was in at that moment.
  function fail(reason) {
    active = false;
    context.onFailure(reason, {
      holding, slipping, drag, airborne: airborne > 0, jolt: lastSpike < 0.35, stuckDrag,
      rodLoad, hookLoad, lineLoad, rodOverloaded: rodOverloaded > 0.3,
    });
  }

  function setHolding(value) {
    holding = value;
  }

  // A fish swimming away takes line off the reel against its drag: the line
  // stays tight even if you're not reeling, so that isn't slack. Only when
  // it turns toward you (or stops) and you don't reel does the line go loose.
  let fishPulling = false;
  function setFishPulling(value) {
    fishPulling = value;
  }

  // The fish leaps. Real advice (Jozini guides, bass anglers): drop the rod
  // tip and give it a moment of slack. Keep cranking while it's in the air
  // and it shakes its head against a tight line -- a hard strain, and a good
  // chance it throws the hook when it lands.
  let airborne = 0;
  let strainedInAir = 0;
  function jump(durationSeconds = 1) {
    if (!active) return;
    airborne = durationSeconds;
    strainedInAir = 0;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, hook, reel, species, weightKg, onSuccess } = context;
    const style = STYLE[(species.bite && species.bite.style) || 'steady'] || STYLE.steady;
    const hookTensionBonus = (hook && hook.tensionBonus) || 0;
    const reelDragBonus = (reel && reel.dragBonus) || 0;

    // Better rod, rig and reel drag soak up strain; heavier fish load the
    // line more.
    // The tension bar is the share of the line's breaking strain the fish is
    // pulling: the same fish on 30lb braid sits far lower than on 10lb mono.
    const lineKg = line.breakKg || 4.5 * (line.breakStrength || 1);
    const lineRelief = Math.pow(4.5 / lineKg, 0.75);
    const gearRelief = lineRelief / (0.75 + (rod.tensionTolerance + hookTensionBonus + reelDragBonus) * 0.25);
    const weightLoad = 0.8 + Math.min(1.2, weightKg / 8) * 0.5;
    const load = style.load * weightLoad * gearRelief;
    const snapMax = ENGINE.fight.snapAt;
    // Mono stretches and cushions a lunge; braid has none, so runs hit hard.
    // A fly line plus nylon tippet (and the soft fly rod) cushions most.
    const stretch = { mono: 0.85, fluoro: 0.95, braid: 1.3, fly: 0.8 }[line.type] ?? 1;
    const hold = (hook && hook.holdBonus) || 0;

    // Roughly how many kg the fish is hauling against you.
    const pullKg = weightKg * style.load * 0.8;
    const slipAt = slipPoint(drag);
    // A cheap drag is jerky: it sticks for a moment before it gives, so a
    // lunge overshoots the setting. A smooth carbon/disc drag barely does.
    const sticky = Math.max(0, 0.2 - reelDragBonus * 0.55);
    // A rod bent past its rating locks up and stops cushioning anything.
    const rodLocked = rodLoad > 1;
    slipping = false;
    lastSpike += deltaSeconds;
    if (holding) {
      // Winding against a fish, the line settles at the fish's pull as a
      // share of the line's breaking strain (softened by a good rod, reel
      // drag and hook). Strong line on a small fish: wind all day. Light
      // line on a big one: that share passes the snap point -- ease off.
      const rodRelief = 1 / (0.75 + (rod.tensionTolerance + hookTensionBonus + reelDragBonus) * 0.25);
      const wantTarget = 0.25 + 1.1 * (pullKg / lineKg) * rodRelief;
      // Past the drag setting the spool slips: winding then gains little
      // (a light drag on a big fish is a long fight), and the line only
      // loads a bit past the setting.
      slipping = wantTarget > slipAt;
      const holdTarget = Math.min(wantTarget, slipAt + ENGINE.fight.haulOver);
      const gain = slipping ? 0.45 + 0.55 * Math.min(1, (slipAt - 0.25) / (wantTarget - 0.25)) : 1;
      const rate = ENGINE.fight.reelTensionRate * 3 * style.load;
      tension += (holdTarget - tension) * Math.min(1, rate * deltaSeconds);
      progress += (ENGINE.fight.progressRate * style.progressMul * gain / context.stamina) * deltaSeconds;
    } else if (fishPulling) {
      // Line peeling off against the drag: tight, but not climbing.
      // A tighter drag makes it work harder for every metre.
      const runTension = Math.min(slipAt, ENGINE.fight.dragTension * lineRelief * (0.6 + drag * 1.2));
      tension += (runTension - tension) * Math.min(1, deltaSeconds * 2);
      slipping = true;
      // Every run against the drag wears it down -- how a big fish that
      // would break the line if you hauled on it is landed with patience.
      progress += (ENGINE.fight.progressRate * ENGINE.fight.dragTire * (0.4 + drag * 1.8) * style.progressMul / context.stamina) * deltaSeconds;
    } else {
      tension -= ENGINE.fight.slackRate * deltaSeconds;
      // It recovers while you rest -- at the same stamina-scaled pace, so a
      // strong fish's fight stretches out evenly instead of stalling.
      progress = Math.max(0, progress - (ENGINE.fight.progressLossRate / context.stamina) * deltaSeconds);
    }

    // The fish runs: a sudden pull regardless of what you're doing.
    runTimer += deltaSeconds;
    if (runTimer >= style.runEvery) {
      runTimer = 0;
      // A good rig soaks up a run, not just steady strain -- and a soft,
      // moderate/through-action blank cushions the lunge before it ever
      // reaches the line.
      const cushion = rodLocked ? 1 : 1 - Math.min(0.6, rod.shockAbsorb || 0);
      tension += style.runSize * weightLoad * gearRelief * cushion * stretch;
      // The drag gives line before the lunge can go further -- after a jerky
      // drag's moment of sticking.
      const cap = slipAt + (holding ? ENGINE.fight.haulOver : 0) + sticky;
      stuckDrag = tension > slipAt + (holding ? ENGINE.fight.haulOver : 0) && sticky > 0.05;
      if (tension > cap) tension = cap;
      if (tension > slipAt) slipping = true;
      lastSpike = 0;
    }

    // The hook: a fine-wire hook opens up (or tears out) when a heavy fish
    // pulls hard on it.
    const hookKg = (hook && hook.strengthKg) || 6;
    // Only when you're really hauling (tension bar in the red): play a big
    // fish gently on a small hook and you can still land it.
    // Only while you're winding in the red -- a lunge you give line to
    // doesn't open it.
    // A fish doesn't haul its whole weight on the hook: about half of it.
    const hookLoadKg = weightKg * style.load * 0.5;
    // It takes sustained hauling in the red, not a brief touch of it.
    // A locked-up rod passes every jolt straight to the hook, so it opens
    // sooner.
    hookStrain = holding && tension > 0.72 ? hookStrain + deltaSeconds * (rodLocked ? 1.6 : 1) : 0;
    hookLoad = holding ? hookLoadKg / hookKg : hookLoadKg / hookKg * 0.4;
    if (hookStrain > 0.45 && hookLoadKg > hookKg) {
      const straightenPerSecond = Math.min(0.9, 0.5 * (hookLoadKg / hookKg - 0.8));
      if (Math.random() < straightenPerSecond * deltaSeconds) {
        fail('hook-straightened');
        return;
      }
    }

    // A jump in progress: reeling through it strains the line, easing off
    // is safe (and doesn't count as slack -- the fish is in the air).
    if (airborne > 0) {
      airborne -= deltaSeconds;
      if (holding) {
        tension += ENGINE.fight.jumpStrain * weightLoad * gearRelief * deltaSeconds;
        strainedInAir += deltaSeconds;
      }
      if (airborne <= 0 && strainedInAir > 0) {
        // A hook set deep in the corner of the mouth rarely shakes loose.
        const throwChance = Math.min(0.85, strainedInAir * ENGINE.fight.throwChancePerSecond) * (1 - hold);
        strainedInAir = 0;
        if (Math.random() < throwChance) {
          fail('threw-hook');
          return;
        }
      }
      slackTimer = 0;
    }

    tension = Math.max(0, Math.min(1.2, tension));

    // Gauges: the line against its breaking strain; the rod against what
    // it's rated to lift (the pull really reaching it, never more than the
    // line is carrying).
    lineLoad = tension / snapMax;
    const lineKgNow = lineLoad * lineKg;
    const rodKg = Math.min(pullKg * (holding ? 1.15 : fishPulling ? 1 : 0.3), lineKgNow);
    rodLoad = rodKg / (rod.maxKg || 6);
    rodOverloaded = rodLoad > 1 ? rodOverloaded + deltaSeconds : 0;

    if (tension >= snapMax) {
      fail('line-snapped');
      return;
    }

    if (tension <= ENGINE.fight.slackThreshold && airborne <= 0) {
      slackTimer += deltaSeconds;
      if (slackTimer >= ENGINE.fight.slackLimitSeconds + hold * 3) {
        fail('fish-escaped');
        return;
      }
    } else {
      slackTimer = 0;
    }

    if (progress >= 1) {
      progress = 1;
      if (context.canLand()) {
        active = false;
        landingBlocked = false;
        onSuccess();
      } else {
        // All the line's in but the fish is still out in open water (you're
        // standing back from the edge): keep it on until you get to it.
        landingBlocked = true;
      }
    } else if (progress < 0.9) {
      // It took real line back -- no longer waiting at the edge.
      landingBlocked = false;
    }
  }

  function getState() {
    return {
      tension: Math.min(1, tension), active, progress, holding, airborne: airborne > 0, landingBlocked, slack: slackTimer > 0.6,
      drag, slipping, rodLoad, hookLoad, lineLoad, jolt: lastSpike < 0.35, stuckDrag: stuckDrag && lastSpike < 0.5,
    };
  }

  function isActive() {
    return active;
  }

  return { start, update, getState, isActive, setHolding, setFishPulling, jump, setDrag, getDrag: () => drag };
}
