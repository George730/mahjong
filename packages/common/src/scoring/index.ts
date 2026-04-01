// Public API for the scoring engine.

export { computeTenpai } from "./tenpai.js";
export { declareHu, scoreHandFull, completeHuFromTenpai, buildWinningHand, scoreFans } from "./hu.js";
export { faceToIndex, indexToFace, tilesToCounts, isSuited, suitOf, rankOf, isTerminal, isHonor, isTerminalOrHonor, isWind, isDragon, windToIndex, EAST, SOUTH, WEST, NORTH, ZHONG, FA, BAI } from "./tile-encoding.js";
export { findAllDecompositions, decompose, isSevenPairs, isThirteenOrphans } from "./decompose.js";
export { FAN_REGISTRY } from "./fan-registry.js";
export { applyExclusions, applyCapRules, deduplicateIdenticalFans, applyOnlyOnce } from "./exclusions.js";
export { meldsToScoringMelds } from "./tenpai.js";

export type {
  WinningHand, ScoringMeld, WinContext, WinSource,
  FanMatch, FanDef,
  HandForm, ParsedMeld, Decomposition,
  TenpaiResult, TenpaiWait, TenpaiContext,
  CachedTenpai, CachedWait,
  HuInput, ScoringResult, ScoredHand,
} from "./types.js";
