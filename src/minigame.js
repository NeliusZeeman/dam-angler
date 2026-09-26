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

  const REEL_TENSION_RATE = 0.42; // tension added per second while reeling
  const SLACK_RATE = 0.55; // tension shed per second while not reeling
  const PROGRESS_RATE = 0.22; // progress gained per second while reeling
  const PROGRESS_LOSS_RATE = 0.05; // fish takes a little line back while you rest
  const SLACK_LIMIT_SECONDS = 4; // this long with a loose line = the hook drops out
  const SLACK_THRESHOLD = 0.06;
  const SNAP_AT = 0.9; // share of the line's breaking strain where it goes

  const STYLE = {
    aggressive: { load: 1.45, runEvery: 1.6, runSize: 0.22, progressMul: 0.85 },
    heavy: { load: 1.3, runEvery: 3.2, runSize: 0.14, progressMul: 0.75 },
    steady: { load: 1.0, runEvery: 2.6, runSize: 0.1, progressMul: 1.0 },
    nibble: { load: 0.6, runEvery: 2.0, runSize: 0.06, progressMul: 1.25 },
  };

  // `canLand()`: is the fish actually at your feet? Winning the line isn't a
  // catch on its own -- the fish has to be brought in to the bank or stand.
  let landingBlocked = false;
  // `stamina` stretches the fight: 1 = a quick kurper, ~2-3 = a big carp or
  // barbel that takes a long time to tire (see fightMotion.fightStamina).
  function start({ species, weightKg, rod, line, hook = null, reel = null, onSuccess, onFailure, canLand = () => true, stamina = 1 }) {
    landingBlocked = false;
    active = true;
    tension = 0.35;
    progress = 0;
    slackTimer = 0;
    runTimer = 0;
    holding = false;
    airborne = 0;
    strainedInAir = 0;
    fishPulling = false;
    context = { species, weightKg, rod, line, hook, reel, onSuccess, onFailure, canLand, stamina: Math.max(0.5, stamina) };
  }

  function setHolding(value) {
    holding = value;
  }

  // A fish swimming away takes line off the reel against its drag: the line
  // stays tight even if you're not reeling, so that isn't slack. Only when
  // it turns toward you (or stops) and you don't reel does the line go loose.
  let fishPulling = false;
  const DRAG_TENSION = 0.28; // how tight the line sits while a fish runs against the drag
  function setFishPulling(value) {
    fishPulling = value;
  }

  // The fish leaps. Real advice (Jozini guides, bass anglers): drop the rod
  // tip and give it a moment of slack. Keep cranking while it's in the air
  // and it shakes its head against a tight line -- a hard strain, and a good
  // chance it throws the hook when it lands.
  let airborne = 0;
  let strainedInAir = 0;
  const JUMP_STRAIN = 0.25; // extra tension per second if you reel through a jump
  const THROW_CHANCE_PER_SECOND_HELD = 0.8;
  function jump(durationSeconds = 1) {
    if (!active) return;
    airborne = durationSeconds;
    strainedInAir = 0;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, hook, reel, species, weightKg, onSuccess, onFailure } = context;
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
    const snapMax = SNAP_AT;
    // Mono stretches and cushions a lunge; braid has none, so runs hit hard.
    const stretch = { mono: 0.85, fluoro: 0.95, braid: 1.3 }[line.type] ?? 1;
    const hold = (hook && hook.holdBonus) || 0;

    // Roughly how many kg the fish is hauling against you.
    const pullKg = weightKg * style.load * 0.8;
    if (holding) {
      // Winding against a fish, the line settles at the fish's pull as a
      // share of the line's breaking strain (softened by a good rod, reel
      // drag and hook). Strong line on a small fish: wind all day. Light
      // line on a big one: that share passes the snap point -- ease off.
      const rodRelief = 1 / (0.75 + (rod.tensionTolerance + hookTensionBonus + reelDragBonus) * 0.25);
      const holdTarget = 0.25 + 1.1 * (pullKg / lineKg) * rodRelief;
      const rate = REEL_TENSION_RATE * 3 * style.load;
      tension += (holdTarget - tension) * Math.min(1, rate * deltaSeconds);
      progress += (PROGRESS_RATE * style.progressMul / context.stamina) * deltaSeconds;
    } else if (fishPulling) {
      // Line peeling off against the drag: tight, but not climbing.
      tension += (DRAG_TENSION * lineRelief - tension) * Math.min(1, deltaSeconds * 2);
      progress = Math.max(0, progress - (PROGRESS_LOSS_RATE / context.stamina) * deltaSeconds);
    } else {
      tension -= SLACK_RATE * deltaSeconds;
      // It recovers while you rest -- at the same stamina-scaled pace, so a
      // strong fish's fight stretches out evenly instead of stalling.
      progress = Math.max(0, progress - (PROGRESS_LOSS_RATE / context.stamina) * deltaSeconds);
    }

    // The fish runs: a sudden pull regardless of what you're doing.
    runTimer += deltaSeconds;
    if (runTimer >= style.runEvery) {
      runTimer = 0;
      // A good rig soaks up a run, not just steady strain -- and a soft,
      // moderate/through-action blank cushions the lunge before it ever
      // reaches the line.
      const cushion = 1 - Math.min(0.6, rod.shockAbsorb || 0);
      tension += style.runSize * weightLoad * gearRelief * cushion * stretch;
    }

    // The hook: a fine-wire hook opens up (or tears out) when a heavy fish
    // pulls hard on it.
    const hookKg = (hook && hook.strengthKg) || 6;
    // Only when you're really hauling (tension bar in the red): play a big
    // fish gently on a small hook and you can still land it.
    if (tension > 0.72 && pullKg > hookKg) {
      const straightenPerSecond = Math.min(0.9, 0.6 * (pullKg / hookKg - 0.8));
      if (Math.random() < straightenPerSecond * deltaSeconds) {
        active = false;
        onFailure('hook-straightened');
        return;
      }
    }

    // A jump in progress: reeling through it strains the line, easing off
    // is safe (and doesn't count as slack -- the fish is in the air).
    if (airborne > 0) {
      airborne -= deltaSeconds;
      if (holding) {
        tension += JUMP_STRAIN * weightLoad * gearRelief * deltaSeconds;
        strainedInAir += deltaSeconds;
      }
      if (airborne <= 0 && strainedInAir > 0) {
        // A hook set deep in the corner of the mouth rarely shakes loose.
        const throwChance = Math.min(0.85, strainedInAir * THROW_CHANCE_PER_SECOND_HELD) * (1 - hold);
        strainedInAir = 0;
        if (Math.random() < throwChance) {
          active = false;
          onFailure('threw-hook');
          return;
        }
      }
      slackTimer = 0;
    }

    tension = Math.max(0, Math.min(1.2, tension));

    if (tension >= snapMax) {
      active = false;
      onFailure('line-snapped');
      return;
    }

    if (tension <= SLACK_THRESHOLD && airborne <= 0) {
      slackTimer += deltaSeconds;
      if (slackTimer >= SLACK_LIMIT_SECONDS + hold * 3) {
        active = false;
        onFailure('fish-escaped');
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
    return { tension: Math.min(1, tension), active, progress, holding, airborne: airborne > 0, landingBlocked, slack: slackTimer > 0.6 };
  }

  function isActive() {
    return active;
  }

  return { start, update, getState, isActive, setHolding, setFishPulling, jump };
}
