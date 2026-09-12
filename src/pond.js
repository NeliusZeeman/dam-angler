import * as THREE from '../vendor/three.module.js';

// Shared geometry constants for the circular dam layout: a round water body
// ringed by a walkable shore path, with reeds along the waterline and trees
// further back. Everything else (scene, water, player) reads these so the
// numbers only live in one place.
export const POND_CENTER = new THREE.Vector3(0, 0, 0);
export const WATER_RADIUS = 22;
export const SHORE_INNER_RADIUS = 22;
export const SHORE_OUTER_RADIUS = 30;
export const WALK_RADIUS = 26; // the path the player walks along
export const REED_RADIUS = 21; // just inside the shore edge, right at the waterline
export const TREE_INNER_RADIUS = 32;
export const TREE_OUTER_RADIUS = 46;
export const DOCK_ANGLE = -Math.PI / 2; // the player's starting position
