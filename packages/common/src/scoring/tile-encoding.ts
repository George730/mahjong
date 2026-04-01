// Tile encoding: convert TileFace to numeric index 0-33 for fast array operations.
//
// Layout:
//   wan1-9:   0-8
//   tiao1-9:  9-17
//   tong1-9:  18-26
//   east/south/west/north: 27-30
//   zhong/fa/bai: 31-33

import type { Tile, TileFace, Suit, Wind, Dragon } from "../tiles.js";

const SUIT_OFFSET: Record<Suit, number> = { wan: 0, tiao: 9, tong: 18 };
const WIND_OFFSET: Record<Wind, number> = { east: 27, south: 28, west: 29, north: 30 };
const DRAGON_OFFSET: Record<Dragon, number> = { zhong: 31, fa: 32, bai: 33 };

export function faceToIndex(face: TileFace): number {
  switch (face.category) {
    case "suited":
      return SUIT_OFFSET[face.suit] + (face.rank - 1);
    case "wind":
      return WIND_OFFSET[face.wind];
    case "dragon":
      return DRAGON_OFFSET[face.dragon];
    case "season":
    case "flower":
      throw new Error(`Bonus tiles have no index: ${face.category}`);
  }
}

const INDEX_FACES: TileFace[] = (() => {
  const faces: TileFace[] = [];
  const suits: Suit[] = ["wan", "tiao", "tong"];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      faces.push({ category: "suited", suit, rank });
    }
  }
  const winds: Wind[] = ["east", "south", "west", "north"];
  for (const wind of winds) {
    faces.push({ category: "wind", wind });
  }
  const dragons: Dragon[] = ["zhong", "fa", "bai"];
  for (const dragon of dragons) {
    faces.push({ category: "dragon", dragon });
  }
  return faces;
})();

export function indexToFace(idx: number): TileFace {
  return INDEX_FACES[idx];
}

export function tilesToCounts(tiles: Tile[]): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles) {
    if (t.face.category === "season" || t.face.category === "flower") continue;
    counts[faceToIndex(t.face)]++;
  }
  return counts;
}

// --- Predicates on indices ---

export function isSuited(idx: number): boolean {
  return idx >= 0 && idx <= 26;
}

/** Returns 0=wan, 1=tiao, 2=tong. Only valid for suited indices. */
export function suitOf(idx: number): number {
  return Math.floor(idx / 9);
}

/** Returns rank 1-9. Only valid for suited indices. */
export function rankOf(idx: number): number {
  return (idx % 9) + 1;
}

export function isTerminal(idx: number): boolean {
  if (!isSuited(idx)) return false;
  const r = rankOf(idx);
  return r === 1 || r === 9;
}

export function isHonor(idx: number): boolean {
  return idx >= 27 && idx <= 33;
}

export function isTerminalOrHonor(idx: number): boolean {
  return isTerminal(idx) || isHonor(idx);
}

export function isWind(idx: number): boolean {
  return idx >= 27 && idx <= 30;
}

export function isDragon(idx: number): boolean {
  return idx >= 31 && idx <= 33;
}

/** Check if a suited tile has rank in [2,8] (middle tiles). */
export function isMiddle(idx: number): boolean {
  if (!isSuited(idx)) return false;
  const r = rankOf(idx);
  return r >= 2 && r <= 8;
}

// Index constants for winds and dragons
export const EAST = 27;
export const SOUTH = 28;
export const WEST = 29;
export const NORTH = 30;
export const ZHONG = 31;
export const FA = 32;
export const BAI = 33;

/** Wind name → index */
export function windToIndex(wind: Wind): number {
  return WIND_OFFSET[wind];
}
