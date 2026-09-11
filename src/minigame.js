export function createMinigame() {
  let active = false;
  let tension = 0.5;
  let progress = 0;
  let holding = false;
  let context = null;

  const PULL_RATE = 0.35;
  const REEL_RATE = 0.55;
  const PROGRESS_RATE = 0.25;

  function start({ species, weightKg, rod, line, onSuccess, onFailure }) {
    active = true;
    tension = 0.5;
    progress = 0;
    context = { species, weightKg, rod, line, onSuccess, onFailure };
  }

  function setHolding(value) {
    holding = value;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, onSuccess, onFailure } = context;
    const snapMax = 0.85 + (line.breakStrength - 1) * 0.05;

    const pull = (1 - context.species.aggressiveness * 0.3) * PULL_RATE;
    tension += pull * deltaSeconds;
    if (holding) {
      tension -= REEL_RATE * (0.7 + rod.tensionTolerance * 0.15) * deltaSeconds;
      progress += PROGRESS_RATE * deltaSeconds;
    }
    tension = Math.max(0, Math.min(1.2, tension));

    if (tension >= snapMax) {
      active = false;
      onFailure('line-snapped');
      return;
    }
    if (tension <= 0 && progress < 1) {
      active = false;
      onFailure('fish-escaped');
      return;
    }
    if (progress >= 1) {
      active = false;
      onSuccess();
    }
  }

  function getState() {
    return { tension: Math.min(1, tension), active, progress };
  }

  function isActive() {
    return active;
  }

  return { start, update, getState, isActive, setHolding };
}
