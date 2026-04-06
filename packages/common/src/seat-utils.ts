// Seat utilities — computes relative table positions from a viewer's perspective

import type { Wind } from "./tiles.js";

/** Table position relative to the viewer (viewer is always "bottom"). */
export type TablePosition = "bottom" | "right" | "top" | "left";

const SEAT_WINDS: Wind[] = ["east", "south", "west", "north"];

/** Simplified Chinese wind names for UI display. */
export const WIND_CN: Record<string, string> = { east: "东", south: "南", west: "西", north: "北" };

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
 * Returns the wind for a given seat index (assumes dealer is always seat 0).
 * @deprecated Use seatWind(seatIndex, dealer) for dealer-relative wind.
 */
export function windForSeat(seatIndex: number): Wind {
  return SEAT_WINDS[seatIndex];
}

/**
 * Returns the seat wind for a given seat index relative to the dealer.
 * The dealer's wind is always East; subsequent seats are South, West, North.
 */
export function seatWind(seatIndex: number, dealer: number): Wind {
  return SEAT_WINDS[((seatIndex - dealer) + 4) % 4];
}

// --- Wind round rotation table ---

/**
 * Dealer order for each wind round. Index = wind round (0=east, 1=south, 2=west, 3=north).
 * Each sub-array lists the player index who deals in hands 1–4 of that round.
 */
export const WIND_ROUND_DEALER_ORDER: readonly [number, number, number, number][] = [
  [0, 1, 2, 3], // East round
  [1, 0, 3, 2], // South round
  [2, 3, 1, 0], // West round
  [3, 2, 0, 1], // North round
];

export const WIND_ROUND_WINDS: readonly Wind[] = ["east", "south", "west", "north"];

/** Total number of hands in a full game. */
export const TOTAL_HANDS = 16;

/**
 * Returns the dealer player index for a given wind round and hand within that round.
 */
export function getDealerForHand(windRoundIndex: number, handIndex: number): number {
  return WIND_ROUND_DEALER_ORDER[windRoundIndex][handIndex];
}
