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
  const SLACK_LIMIT_SECONDS = 2.5; // this long near-zero tension = fish gone
  const SLACK_THRESHOLD = 0.06;

  const STYLE = {
    aggressive: { load: 1.45, runEvery: 1.6, runSize: 0.22, progressMul: 0.85 },
    heavy: { load: 1.3, runEvery: 3.2, runSize: 0.14, progressMul: 0.75 },
    steady: { load: 1.0, runEvery: 2.6, runSize: 0.1, progressMul: 1.0 },
    nibble: { load: 0.6, runEvery: 2.0, runSize: 0.06, progressMul: 1.25 },
  };

  function start({ species, weightKg, rod, line, hook = null, reel = null, onSuccess, onFailure }) {
    active = true;
    tension = 0.35;
    progress = 0;
    slackTimer = 0;
    runTimer = 0;
    holding = false;
    context = { species, weightKg, rod, line, hook, reel, onSuccess, onFailure };
  }

  function setHolding(value) {
    holding = value;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, hook, reel, species, weightKg, onSuccess, onFailure } = context;
    const style = STYLE[(species.bite && species.bite.style) || 'steady'] || STYLE.steady;
    const hookTensionBonus = (hook && hook.tensionBonus) || 0;
    const reelDragBonus = (reel && reel.dragBonus) || 0;

    // Better rod, rig and reel drag soak up strain; heavier fish load the
    // line more.
    const gearRelief = 1 / (0.75 + (rod.tensionTolerance + hookTensionBonus + reelDragBonus) * 0.25);
    const weightLoad = 0.8 + Math.min(1.2, weightKg / 8) * 0.5;
    const load = style.load * weightLoad * gearRelief;
    const snapMax = 0.86 + (line.breakStrength - 1) * 0.06;

    if (holding) {
      tension += REEL_TENSION_RATE * load * deltaSeconds;
      progress += PROGRESS_RATE * style.progressMul * deltaSeconds;
    } else {
      tension -= SLACK_RATE * deltaSeconds;
      progress = Math.max(0, progress - PROGRESS_LOSS_RATE * deltaSeconds);
    }

    // The fish runs: a sudden pull regardless of what you're doing.
    runTimer += deltaSeconds;
    if (runTimer >= style.runEvery) {
      runTimer = 0;
      // A stiffer rod and a good rig soak up a run, not just steady strain.
      tension += style.runSize * weightLoad * gearRelief;
    }

    tension = Math.max(0, Math.min(1.2, tension));

    if (tension >= snapMax) {
      active = false;
      onFailure('line-snapped');
      return;
    }

    if (tension <= SLACK_THRESHOLD) {
      slackTimer += deltaSeconds;
      if (slackTimer >= SLACK_LIMIT_SECONDS) {
        active = false;
        onFailure('fish-escaped');
        return;
      }
    } else {
      slackTimer = 0;
    }

    if (progress >= 1) {
      active = false;
      onSuccess();
    }
  }

  function getState() {
    return { tension: Math.min(1, tension), active, progress, holding };
  }

  function isActive() {
    return active;
  }

  return { start, update, getState, isActive, setHolding };
}
