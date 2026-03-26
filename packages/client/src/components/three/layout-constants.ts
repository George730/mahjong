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
