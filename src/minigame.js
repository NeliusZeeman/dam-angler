export function createMinigame() {
  let active = false;
  let tension = 0.5;
  let progress = 0;
  let holding = false;
  let context = null;

  const PULL_RATE = 0.35;
  const REEL_RATE = 0.55;
  const PROGRESS_RATE = 0.25;

  function start({ species, weightKg, rod, line, hook = null, onSuccess, onFailure }) {
    active = true;
    tension = 0.5;
    progress = 0;
    context = { species, weightKg, rod, line, hook, onSuccess, onFailure };
  }

  function setHolding(value) {
    holding = value;
  }

  function update(deltaSeconds) {
    if (!active) return;
    const { rod, line, hook, species, onSuccess, onFailure } = context;
    const hookTensionBonus = (hook && hook.tensionBonus) || 0;
    const snapMax = 0.85 + (line.breakStrength - 1) * 0.05;

    // Bite style drives how the fight feels: an aggressive striker (bass,
    // tigerfish) yanks hard with sharp jerks, a heavy fighter (catfish,
    // mirror carp) pulls low but relentlessly, a nibbler (tilapia) is quick
    // but weak once hooked.
    const style = (species.bite && species.bite.style) || 'steady';
    const styleMultiplier = { aggressive: 1.55, heavy: 1.15, steady: 1.0, nibble: 0.65 }[style] || 1.0;
    const jerkChance = style === 'aggressive' ? 0.06 : 0;

    const pull = styleMultiplier * (1 - species.aggressiveness * 0.15) * PULL_RATE;
    tension += pull * deltaSeconds;
    if (jerkChance > 0 && Math.random() < jerkChance) {
      tension += 0.05 + Math.random() * 0.08;
    }
    if (holding) {
      tension -= REEL_RATE * (0.7 + (rod.tensionTolerance + hookTensionBonus) * 0.15) * deltaSeconds;
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
