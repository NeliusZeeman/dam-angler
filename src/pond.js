import * as THREE from '../vendor/three.module.js';

// Shared geometry constants for the circular dam layout: a round water body,
// a sandy bank, then a walkable grass ring, with reeds along the waterline
// and trees further back. Everything else reads these so the numbers only
// live in one place.
//
// Radii, from the middle outward:
//   0 .. WATER_EDGE_RADIUS   open water (the only place a lure can fish)
//   WATER_EDGE .. BANK_OUTER sandy bank (dry -- the water mesh runs a little
//                            way under it so there's never a gap at the edge)
//   BANK_OUTER .. SHORE_OUTER grass, with the player's path at WALK_RADIUS
export const POND_CENTER = new THREE.Vector3(0, 0, 0);
export const WATER_EDGE_RADIUS = 20.4; // where the sand starts: the real water's edge
export const WATER_RADIUS = 22; // the water mesh itself, tucked under the bank
export const BANK_OUTER_RADIUS = 23.1;
export const SHORE_INNER_RADIUS = 22; // legacy anchor used for dock placement
export const SHORE_OUTER_RADIUS = 30;
export const WALK_RADIUS = 26; // the path the player walks along
export const REED_RADIUS = 21; // straddling the waterline
export const TREE_INNER_RADIUS = 32;
export const TREE_OUTER_RADIUS = 46;
export const DOCK_ANGLE = -Math.PI / 2; // the player's starting position
export const BANK_SURFACE_Y = 0.13;
