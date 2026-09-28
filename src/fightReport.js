// After a lost fish: what went wrong, part by part. Each of the rod, reel,
// line and hook gets a verdict -- 'ok', 'warn' (it played a part) or
// 'fail' (this is what gave) -- with a line of plain fishing advice.
//
// `info` is the state of the fight at the moment it was lost (see
// minigame.js fail()): whether you were winding, the drag setting, whether
// a lunge had just hit, and how loaded the rod, line and hook were.

const pct = (x) => `${Math.round(x * 100)}%`;
const short = (name) => name.split(' (')[0];

export function diagnoseLoss(reason, info = {}, { rod, reel, line, hook, weightKg = 0 } = {}) {
  const parts = {
    rod: { status: 'ok', text: `${short(rod.name)} — rated ~${rod.maxKg ?? 6} kg` },
    reel: { status: 'ok', text: `Drag at ${pct(info.drag ?? 0.33)} of the line` },
    line: { status: 'ok', text: `${short(line.name)} — breaks at ${line.breakKg} kg` },
    hook: { status: 'ok', text: `${short(hook.name)} — holds ~${hook.strengthKg} kg` },
  };
  const drag = info.drag ?? 0.33;
  const dragKg = (drag * line.breakKg).toFixed(1);
  let title = 'The fish got away';
  let tip = '';

  if (reason === 'line-snapped') {
    title = 'Line snapped';
    parts.line = { status: 'fail', text: `Pulled past its ${line.breakKg} kg breaking strain` };
    if (drag >= 0.5) {
      parts.reel = { status: 'fail', text: `Drag at ${pct(drag)} (${dragKg} kg) — too tight to slip before the line broke` };
      tip = 'Set the drag to about a third of the line\'s strength ( [ and ] keys, or − / + ).';
    } else if (info.stuckDrag) {
      parts.reel = { status: 'fail', text: `${short(reel.name)}'s drag stuck on the lunge before it slipped` };
      tip = 'A smoother reel (big pit, baitcaster, disc-drag fly reel) gives line cleanly on a lunge. Or loosen the drag a click.';
    } else if (info.holding) {
      parts.reel = { status: 'warn', text: 'You were winding against a slipping drag' };
      tip = 'Stop winding when the line bar runs red — let the drag and the rod do the work.';
    }
    if (info.jolt && (rod.shockAbsorb ?? 0) < 0.15) {
      parts.rod = { status: 'warn', text: `Stiff ${rod.action}-action blank passed the lunge straight to the line` };
    }
    if (info.rodOverloaded) parts.rod = { status: 'warn', text: 'Bent past its rating — it stopped cushioning' };
    if (line.type === 'braid' && info.jolt) parts.line.text += ' · braid has no stretch to absorb the jolt';
    if (!tip) tip = `A ${weightKg.toFixed(1)} kg fish needs stronger line, or easing off sooner.`;
  } else if (reason === 'hook-straightened') {
    title = 'Hook straightened';
    parts.hook = { status: 'fail', text: `Opened under a ${weightKg.toFixed(1)} kg fish — it holds ~${hook.strengthKg} kg` };
    if (info.rodOverloaded) parts.rod = { status: 'fail', text: 'Bent past its rating and locked up — every jolt went to the hook' };
    if (drag >= 0.5) parts.reel = { status: 'warn', text: `Drag at ${pct(drag)} — tight drag loads the hook` };
    tip = 'Use a stronger hook for big fish, and don\'t haul in the red.';
  } else if (reason === 'threw-hook') {
    title = 'It jumped and threw the hook';
    parts.hook = { status: 'fail', text: 'Shaken loose while it was in the air' };
    parts.rod = info.rodHighInJump
      ? { status: 'warn', text: 'Rod held high during the jump' }
      : { status: 'ok', text: 'Rod tip was down — it was the winding that did it' };
    tip = 'When it jumps, stop winding and drop the rod tip until it\'s back in the water. Circle and hair-rig hooks hold better.';
  } else if (reason === 'fish-escaped') {
    title = 'Slack line — it shook free';
    parts.line = { status: 'fail', text: 'Went slack too long; the hook dropped out' };
    if (drag <= 0.15) parts.reel = { status: 'warn', text: `Drag at ${pct(drag)} — so loose it barely set or held the hook` };
    tip = 'When the fish swims toward you, wind to keep the line tight.';
  }

  // Warnings the moment it was lost, even where they weren't the cause.
  if (parts.rod.status === 'ok' && info.rodLoad > 0.9) parts.rod = { status: 'warn', text: `Loaded to ${pct(info.rodLoad)} of its rating` };
  if (parts.hook.status === 'ok' && info.hookLoad > 1) parts.hook = { status: 'warn', text: `Under ${pct(info.hookLoad)} of what it holds` };

  return { title, parts, tip };
}
