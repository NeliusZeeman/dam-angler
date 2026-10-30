// The boat's own rods: a rack of rods rigged for one kind of fish, there
// for the taking while you're on the boat (gfx/boats.js has them in the
// rod holders). Fish what a rod is rigged for and that fish pays
// BOAT_ROD_BONUS times the credits and the level points. Step ashore and
// the rod stays in the rack -- you're back on your own rod.
//
// Each comes fully rigged: rod, reel, line, hook and a choice of the baits
// it's meant for (the first is on when you pick it up) -- none of your own
// rig comes across. Built on gear from the tackle box, so the server knows
// it too (server/saves.js pays boat catches the same way).

import { RODS, REELS, LINES, HOOKS, LURES, getGearById } from './gear.js';
import { spotsFor } from './pegs.js';
import { boatKindFor } from './boatDrive.js';

export const BOAT_ROD_BONUS = 1.5;

const DEFS = [
  {
    id: 'boat-rod-bass', name: 'Boat Rod: Bass Flipping Stick', base: 'rod-okuma-hakai-cast', reel: 'reel-shimano-slx-150xg', line: 'line-braid',
    hook: 'hook-offset-worm', baits: ['soft-plastic', 'spinner', 'crankbait', 'bass-jig', 'topwater-frog'],
    boats: ['bass', 'kayak'], targets: ['largemouth-bass', 'smallmouth-bass'],
    blurb: 'A 2.1 m medium-heavy baitcaster on braid — pitch it into the timber and pull bass out of the cover.',
  },
  {
    id: 'boat-rod-carp', name: 'Boat Rod: Carp Rod', base: 'rod-sensation-dc-booster', reel: 'reel-shimano-baitrunner-xt', line: 'line-carp-15',
    hook: 'hook-carp-hair', baits: ['mielies', 'mieliebom', 'boilies', 'method-feeder'],
    boats: ['bass', 'tiger'], targets: ['common-carp', 'mirror-carp'],
    blurb: '3.6 m carp rod and baitrunner. Anchor off a drop-off and fish a mielie bomb.',
  },
  {
    id: 'boat-rod-yellow', name: 'Boat Rod: Yellowfish & Trout Spinner', base: 'rod-shimano-clarus-spin', reel: 'reel-spinning', line: 'line-fluoro',
    hook: 'hook-small', baits: ['spinner', 'worm', 'spoon-lure', 'rapala-minnow'],
    boats: ['bass', 'tiger', 'kayak'], targets: ['smallmouth-yellowfish', 'largescale-yellowfish', 'largemouth-yellowfish', 'clanwilliam-yellowfish', 'rainbow-trout', 'brown-trout'],
    blurb: 'A light, fast spinning rod on fluorocarbon for yellows in the current and trout off the points.',
  },
  {
    id: 'boat-rod-barbel', name: 'Boat Rod: Barbel Rod', base: 'rod-heavy', reel: 'reel-bigpit', line: 'line-braid-50',
    hook: 'hook-circle', baits: ['chicken-liver', 'sardine', 'frog-bait'],
    boats: ['bass', 'tiger'], targets: ['catfish', 'mudfish'],
    blurb: 'Heavy rod, big-pit reel and 22 kg braid. Drop chicken liver in the deep holes for barbel.',
  },
  {
    id: 'boat-rod-tiger', name: 'Boat Rod: Tiger Tamer', base: 'rod-shimano-beastmaster-tiger', reel: 'reel-shimano-slx-dc', line: 'line-jbraid-30',
    hook: 'hook-wire-trace', baits: ['spoon-lure', 'spinner', 'rapala-minnow', 'sardine'],
    boats: ['tiger'], targets: ['tigerfish'],
    blurb: 'A heavy baitcaster on 13 kg braid. Troll or cast a spoon past the drifts and hold on — tigers jump.',
  },
  {
    id: 'boat-rod-kurper', name: 'Boat Rod: Kurper Rod', base: 'rod-kurper', reel: 'reel-banax-zest', line: 'line-mono-12',
    hook: 'hook-small', baits: ['worm', 'bread-bait', 'dough-bait'],
    boats: ['bass', 'tiger', 'kayak'], targets: ['mozambique-tilapia', 'banded-tilapia', 'bluegill'],
    blurb: 'A soft 1.8 m ultralight for kurper and bluegill along the reed beds.',
  },
];

// The outfits, ready to fish: rod (with its own id and name), reel, line,
// hook and baits.
export const BOAT_RODS = DEFS.map((d) => {
  const base = getGearById(RODS, d.base);
  const rod = {
    ...base, id: d.id, name: d.name, cost: 0, boatRod: true, inShop: false,
    // Looks like the rod it's built on.
    model: base.model ?? { base: base.id },
  };
  return {
    id: d.id, name: d.name, blurb: d.blurb, boats: d.boats, targets: d.targets, rod,
    reel: getGearById(REELS, d.reel), line: getGearById(LINES, d.line), hook: getGearById(HOOKS, d.hook),
    baits: d.baits.map((id) => getGearById(LURES, id)),
  };
});

export const boatRodById = (id) => BOAT_RODS.find((b) => b.id === id) || null;

// The rods in the rack of a boat kind ('bass', 'tiger', 'kayak').
export const boatRodsFor = (kind) => BOAT_RODS.filter((b) => b.boats.includes(kind));

// The boat rod sent with a catch, if it's really on the boat you'd have at
// that water -- otherwise null (the server pays it as your own gear).
export function boatRodAt(id, locationId) {
  const b = boatRodById(id);
  const kind = boatKindFor(spotsFor(locationId)?.boats);
  return b && kind && b.boats.includes(kind) ? b : null;
}

// How much more a fish pays on this boat rod: the bonus for what it's
// rigged for, nothing extra for anything else.
export function boatBonus(boatRod, speciesId) {
  return boatRod && boatRod.targets.includes(speciesId) ? BOAT_ROD_BONUS : 1;
}
