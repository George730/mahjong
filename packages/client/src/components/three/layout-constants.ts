// Shared layout constants for the 3D table — used by HandLayout, TableOverlays, SceneDemoPage.

import { TILE_WIDTH } from "./TileMesh.tsx";

/** Spacing between adjacent tiles (tile width + small gap). */
export const GAP = TILE_WIDTH + 0.02;

/** Distance from table center to each player's hand row. */
export const TABLE_EDGE = 4.25;

/** Clearance from table corner to avoid tile collisions. */
export const CORNER_MARGIN = 1.5;

/** X (or Z) coordinate of the leftmost tile position along a table edge. */
export const ROW_LEFT = -(5 - CORNER_MARGIN);

// --- Side rotation utilities ---
// Every side of the table is the "bottom" (canonical) layout rotated around Y.
// This eliminates manual per-side configs and prevents directional sign errors.

/** Visual side names in rotation order: 0°, 90°, 180°, -90°. */
export const SIDE_NAMES = ["bottom", "right", "top", "left"] as const;
export type SideName = (typeof SIDE_NAMES)[number];

/** Y-rotation angle for each visual side. */
export const SIDE_ANGLES: Record<SideName, number> = {
  bottom: 0,
  right: Math.PI / 2,
  top: Math.PI,
  left: -Math.PI / 2,
};

/** Rotate a point [x, y, z] around the Y axis by `angle` radians. */
export function rotateAroundY(
  [x, y, z]: [number, number, number],
  angle: number,
): [number, number, number] {
  if (angle === 0) return [x, y, z];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, y, -x * s + z * c];
}
