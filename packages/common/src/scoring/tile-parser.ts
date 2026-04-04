// Compact tile notation parser — shared between tests and client scoring tools.
//
// Tile tokens:
//   Suited: 1m-9m (万), 1s-9s (条), 1p-9p (筒)
//   Winds:  E S W N
//   Dragons: Z(中) F(发) B(白)
//
// Meld notation:
//   "c(1m 2m 3m)"       — exposed chow
//   "p(Z Z Z)"          — exposed pung
//   "k(9p 9p 9p 9p)"    — exposed kong
//   "!k(1m 1m 1m 1m)"   — concealed kong

import type { ScoringMeld } from "./types.js";

const HONOR_MAP: Record<string, number> = {
  E: 27, S: 28, W: 29, N: 30, Z: 31, F: 32, B: 33,
};

const SUIT_OFFSET: Record<string, number> = { m: 0, s: 9, p: 18 };

/** Map compact tile token (e.g. "3p", "E") to index 0-33. */
export function tileIndex(token: string): number {
  if (HONOR_MAP[token] !== undefined) return HONOR_MAP[token];
  const rank = parseInt(token[0], 10);
  const suit = token[1];
  if (SUIT_OFFSET[suit] === undefined) throw new Error(`Unknown tile: ${token}`);
  return SUIT_OFFSET[suit] + (rank - 1);
}

/** Parse a space-separated tile list into a 34-element counts array. */
export function parseTiles(tiles: string): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles.trim().split(/\s+/)) counts[tileIndex(t)]++;
  return counts;
}

const MELD_RE = /^(!?)([cpk])\(([^)]+)\)$/;

/** Parse meld notation strings into ScoringMeld objects. */
export function parseMelds(melds: string[]): ScoringMeld[] {
  return melds.map(m => {
    const match = m.match(MELD_RE);
    if (!match) throw new Error(`Invalid meld notation: "${m}". Use c()/p()/k() for exposed, !k() for concealed kong.`);

    const concealed = match[1] === "!";
    const type = match[2] as "c" | "p" | "k";
    const tokens = match[3].trim().split(/\s+/);
    const indices = tokens.map(tileIndex);

    const meldType: "chow" | "pung" | "kong" =
      type === "c" ? "chow" : type === "p" ? "pung" : "kong";

    return { type: meldType, tileIndices: indices, concealed };
  });
}

/** Tile token back to display name. */
const SUIT_LABELS = ["万", "条", "筒"];
const WIND_LABELS: Record<number, string> = { 27: "东", 28: "南", 29: "西", 30: "北" };
const DRAGON_LABELS: Record<number, string> = { 31: "中", 32: "发", 33: "白" };

export function tileDisplayName(idx: number): string {
  if (idx < 27) {
    const suit = Math.floor(idx / 9);
    const rank = (idx % 9) + 1;
    return `${rank}${SUIT_LABELS[suit]}`;
  }
  return WIND_LABELS[idx] ?? DRAGON_LABELS[idx] ?? "?";
}
