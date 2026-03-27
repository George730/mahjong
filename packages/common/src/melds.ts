// Meld detection functions — pure helpers to check what claims are available
//
// canChow:      left-seat player can claim a sequence (suited tiles only)
// canPung:      any player can claim a triplet (2 matching in hand)
// canOpenKong:  any player can claim a quad (3 matching in hand)
// canClosedKong: current player has 4 identical tiles in hand+drawnTile

import type { Tile, TileFace } from "./tiles.js";
import { sameFace } from "./tiles.js";

// --- Option types ---

export interface ChowOption {
  /** IDs of the two hand tiles that form the sequence with the discard. */
  handTileIds: [number, number];
}

export interface PungOption {
  /** IDs of the two hand tiles that match the discard face. */
  handTileIds: [number, number];
}

export interface KongOption {
  /** IDs of the three hand tiles that match the discard face. */
  handTileIds: [number, number, number];
}

export interface ClosedKongOption {
  /** IDs of all four tiles forming the kong. */
  tileIds: number[];
  /** The shared face. */
  face: TileFace;
}

// --- Detection functions ---

/**
 * Returns all chow (sequence) options available to the claimer.
 * Only valid for suited tiles, and only when claimer is the next player
 * in turn order after the discarder (left-seat rule).
 */
export function canChow(
  hand: Tile[],
  discardTile: Tile,
  claimerSeat: number,
  discarderSeat: number,
): ChowOption[] {
  // Left-seat rule: claimer must be the next player after discarder
  if ((discarderSeat + 1) % 4 !== claimerSeat) return [];

  const face = discardTile.face;
  if (face.category !== "suited") return [];

  const { suit, rank } = face;
  const options: ChowOption[] = [];

  // Find all suited hand tiles of the same suit
  const suitTiles = hand.filter(
    (t) => t.face.category === "suited" && t.face.suit === suit,
  );

  // Three possible sequences containing the discard rank:
  // [rank-2, rank-1, rank], [rank-1, rank, rank+1], [rank, rank+1, rank+2]
  const combos: [number, number][] = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2],
  ];

  for (const [r1, r2] of combos) {
    if (r1 < 1 || r1 > 9 || r2 < 1 || r2 > 9) continue;

    // Find all tiles matching r1 and r2
    const tiles1 = suitTiles.filter(
      (t) => t.face.category === "suited" && t.face.rank === r1,
    );
    const tiles2 = suitTiles.filter(
      (t) => t.face.category === "suited" && t.face.rank === r2,
    );

    // Generate all combinations of one tile from each rank
    for (const t1 of tiles1) {
      for (const t2 of tiles2) {
        options.push({ handTileIds: [t1.id, t2.id] });
      }
    }
  }

  return options;
}

/**
 * Returns a pung option if the hand has at least 2 tiles matching the discard face.
 * Returns only the first valid pair found (any 2 of the matching tiles).
 */
export function canPung(hand: Tile[], discardTile: Tile): PungOption | null {
  const matching = hand.filter((t) => sameFace(t.face, discardTile.face));
  if (matching.length < 2) return null;
  return { handTileIds: [matching[0].id, matching[1].id] };
}

/**
 * Returns an open kong option if the hand has 3 tiles matching the discard face.
 */
export function canOpenKong(hand: Tile[], discardTile: Tile): KongOption | null {
  const matching = hand.filter((t) => sameFace(t.face, discardTile.face));
  if (matching.length < 3) return null;
  return { handTileIds: [matching[0].id, matching[1].id, matching[2].id] };
}

/**
 * Returns all closed kong options from the combined hand + drawnTile.
 * A closed kong requires 4 identical tiles all in the player's possession.
 */
export function canClosedKong(
  hand: Tile[],
  drawnTile: Tile | null,
): ClosedKongOption[] {
  const allTiles = drawnTile ? [...hand, drawnTile] : [...hand];
  const options: ClosedKongOption[] = [];

  // Group tiles by face
  const groups = new Map<string, Tile[]>();
  for (const tile of allTiles) {
    const key = faceKey(tile.face);
    const group = groups.get(key);
    if (group) {
      group.push(tile);
    } else {
      groups.set(key, [tile]);
    }
  }

  for (const tiles of groups.values()) {
    if (tiles.length === 4) {
      options.push({
        tileIds: tiles.map((t) => t.id),
        face: tiles[0].face,
      });
    }
  }

  return options;
}

/** Stable string key for grouping tiles by face. */
function faceKey(face: TileFace): string {
  switch (face.category) {
    case "suited":
      return `${face.suit}${face.rank}`;
    case "wind":
      return face.wind;
    case "dragon":
      return face.dragon;
    case "season":
      return face.season;
    case "flower":
      return face.flower;
  }
}
