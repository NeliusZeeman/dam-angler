import * as THREE from '../vendor/three.module.js';

// Shared geometry constants for the dam layout. The shoreline itself is no
// longer a perfect circle (see pondShape.js) -- these are now *offsets*
// from the shape's radiusAt(theta) at a given angle, so every ring (bank,
// waterline, grass, trees) follows the same irregular outline the water
// does, from the middle outward:
//
//   0 .. radiusAt(theta)                     open water
//   .. + BANK_WIDTH                          sandy bank (dry)
//   .. + BANK_WIDTH + SHORE_WIDTH            grass, player's path at
//                                            + WALK_BAND_OFFSET
//   .. + TREE_BAND_INNER_OFFSET .. +width    trees
export const POND_CENTER = new THREE.Vector3(0, 0, 0);

// Kept as the reference values a location's `shape.baseRadius` is tuned
// against; individual locations may vary this.
export const WATER_EDGE_RADIUS = 20.4;
export const WATER_RADIUS = 22; // the water mesh itself, tucked under the bank
export const BANK_OUTER_RADIUS = 23.1;
export const SHORE_OUTER_RADIUS = 30;
export const WALK_RADIUS = 26;
export const REED_RADIUS = 21;
export const TREE_INNER_RADIUS = 32;
export const TREE_OUTER_RADIUS = 46;

// Offsets from the water's edge at a given angle (radiusAt(theta)).
export const WATER_MESH_OFFSET = WATER_RADIUS - WATER_EDGE_RADIUS; // water mesh tucks under the bank
export const BANK_WIDTH = BANK_OUTER_RADIUS - WATER_EDGE_RADIUS;
export const SHORE_WIDTH = SHORE_OUTER_RADIUS - BANK_OUTER_RADIUS;
export const WALK_BAND_OFFSET = WALK_RADIUS - WATER_EDGE_RADIUS;
export const REED_BAND_OFFSET = REED_RADIUS - WATER_EDGE_RADIUS;
export const TREE_BAND_INNER_OFFSET = TREE_INNER_RADIUS - WATER_EDGE_RADIUS;
export const TREE_BAND_WIDTH = TREE_OUTER_RADIUS - TREE_INNER_RADIUS;

export const DOCK_ANGLE = -Math.PI / 2; // the player's starting position
export const BANK_SURFACE_Y = 0.13;
