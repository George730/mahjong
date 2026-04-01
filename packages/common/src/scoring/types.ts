// All scoring-related types for the rule engine.

import type { Tile, Wind } from "../tiles.js";
import type { Meld } from "../game-state.js";

// --- Hand decomposition ---

export interface ParsedMeld {
  type: "chow" | "pung";
  /** Tile indices (0-33), sorted. */
  tileIndices: number[];
}

export interface Decomposition {
  closedMelds: ParsedMeld[];
  /** Tile index (0-33) of the pair. */
  pair: number;
}

export type HandForm =
  | { form: "standard"; closedMelds: ParsedMeld[]; pair: number }
  | { form: "sevenPairs"; pairs: number[] }
  | { form: "thirteenOrphans"; pair: number }
  | { form: "knitted"; closedMelds: ParsedMeld[]; pair: number; knittedIndices: number[] }
  | { form: "allUnrelated"; indices: number[] };

// --- Scoring structures ---

export interface ScoringMeld {
  type: "chow" | "pung" | "kong";
  /** Tile indices (0-33), sorted. */
  tileIndices: number[];
  concealed: boolean;
  claimedFrom?: number;
}

export type WinSource = "selfDraw" | "discard" | "kongDraw" | "robbingKong";

export interface WinContext {
  winTile: number;
  winSource: WinSource;
  seatWind: Wind;
  roundWind: Wind;
  seatIndex: number;
  isDealer: boolean;
  wallCount: number;
  bonusTileCount: number;
  isKongDraw: boolean;
  isRobbingKong: boolean;
  isLastTile: boolean;
  declaredMeldCount: number;
  /** For 和绝张: how many of the win tile are visible (discards + melds). */
  winTileVisibleCount: number;
}

export interface WinningHand {
  allMelds: ScoringMeld[];
  pair: number;
  form: HandForm["form"];
  winTile: number;
  context: WinContext;
  /** For seven pairs: the 7 pair indices. */
  sevenPairs?: number[];
  /** For thirteen orphans: all 13+1 indices. */
  thirteenOrphansIndices?: number[];
}

// --- Fan detection ---

export interface FanMatch {
  fan: string;
  score: number;
  count: number;
  involvedMelds: number[];
  involvedPair: boolean;
}

export interface FanDef {
  id: string;
  score: number;
  detector: (hand: WinningHand) => FanMatch[];
  excludes: string[];
  situational: boolean;
}

// --- Tenpai ---

export interface TenpaiWait {
  tileIndex: number;
  remainingCount: number;
  baseFans: FanMatch[];
  baseScore: number;
  decompositions: HandForm[];
}

export interface TenpaiResult {
  isTenpai: boolean;
  waits: TenpaiWait[];
}

export interface CachedWait {
  baseFans: FanMatch[];
  baseScore: number;
  decompositions: HandForm[];
  remainingCount: number;
}

export interface CachedTenpai {
  isTenpai: boolean;
  waits: Map<number, CachedWait>;
}

export interface TenpaiContext {
  melds: Meld[];
  seatWind: Wind;
  roundWind: Wind;
  bonusTileCount: number;
  visibleCounts: number[];
}

// --- Hu / Scoring results ---

export interface HuInput {
  hand: Tile[];
  melds: Meld[];
  winTile: Tile;
  winSource: WinSource;
  context: WinContext;
}

export interface ScoredHand {
  hand: WinningHand;
  fans: FanMatch[];
  fanScore: number;
  bonusScore: number;
  totalScore: number;
}

export interface ScoringResult {
  isWin: boolean;
  reason?: "no-valid-decomposition" | "insufficient-fan";
  bestScore?: number;
  result?: ScoredHand;
}
