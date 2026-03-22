// Seat utilities — computes relative table positions from a viewer's perspective

import type { Wind } from "./tiles.js";

/** Table position relative to the viewer (viewer is always "bottom"). */
export type TablePosition = "bottom" | "right" | "top" | "left";

const SEAT_WINDS: Wind[] = ["east", "south", "west", "north"];

/**
 * Given the viewer's seat index and another player's seat index,
 * returns where that player sits relative to the viewer.
 *
 * Mahjong seating is counter-clockwise when viewed from above:
 *   East(0) → South(1) → West(2) → North(3)
 * From the viewer's perspective:
 *   viewer = bottom, next seat = right, opposite = top, previous = left
 */
export function relativePosition(viewerSeat: number, targetSeat: number): TablePosition {
  const offset = ((targetSeat - viewerSeat) + 4) % 4;
  const positions: TablePosition[] = ["bottom", "right", "top", "left"];
  return positions[offset];
}

/**
 * Returns all 4 seat indices ordered by table position: [bottom, right, top, left].
 */
export function seatsFromPerspective(viewerSeat: number): [number, number, number, number] {
  return [
    viewerSeat,
    (viewerSeat + 1) % 4,
    (viewerSeat + 2) % 4,
    (viewerSeat + 3) % 4,
  ];
}

/**
 * Returns the wind for a given seat index.
 */
export function windForSeat(seatIndex: number): Wind {
  return SEAT_WINDS[seatIndex];
}
