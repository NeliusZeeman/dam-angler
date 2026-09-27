// Soft baits come off the hook. SA barbel anglers say chicken liver is a top
// bait but "tricky to get to stay on the hook": a hard cast can flick it
// off, and it washes or gets picked off the longer it sits. A lure's
// `soft` = { onCast, perMinute }:
//   onCast     chance it flies off on a medium cast (more on a hard one)
//   perMinute  chance it's gone after a minute in the water (doubled while
//              the rig is being worked or reeled)

export function castLossChance(lure, power = 0.5) {
  if (!lure?.soft) return 0;
  return Math.min(0.9, lure.soft.onCast * (0.3 + Math.max(0, power)) / 0.8);
}

export function soakLossChance(lure, dtSeconds, moving = false) {
  if (!lure?.soft) return 0;
  const perSecond = -Math.log(1 - lure.soft.perMinute) / 60;
  return 1 - Math.exp(-perSecond * dtSeconds * (moving ? 2 : 1));
}
