// Hu validation and full scoring — builds on tenpai cached state.

import { faceToIndex, tilesToCounts } from "./tile-encoding.js";
import { findAllDecompositions } from "./decompose.js";
import { FAN_REGISTRY } from "./fan-registry.js";
import { applyExclusions, applyCapRules, deduplicateIdenticalFans, applyOnlyOnce } from "./exclusions.js";
import type {
  HandForm, WinningHand, ScoringMeld, WinContext,
  FanMatch, ScoringResult, ScoredHand, CachedTenpai, CachedWait,
  HuInput,
} from "./types.js";
import type { Meld } from "../game-state.js";

/** Sum fan scores from a list of matches. */
export function scoreFans(fans: FanMatch[]): number {
  return fans.reduce((sum, m) => sum + m.score * m.count, 0);
}

/** Build a WinningHand from a decomposition + declared melds + context. */
export function buildWinningHand(
  decomp: HandForm,
  declaredMelds: ScoringMeld[],
  winTileIdx: number,
  context: WinContext,
): WinningHand {
  const allMelds = [...declaredMelds];

  if (decomp.form === "standard" || decomp.form === "knitted") {
    for (const cm of decomp.closedMelds) {
      allMelds.push({
        type: cm.type,
        tileIndices: cm.tileIndices,
        concealed: true,
      });
    }
  }

  const pair = decomp.form === "sevenPairs" ? decomp.pairs[0]
    : decomp.form === "thirteenOrphans" ? decomp.pair
    : decomp.form === "allUnrelated" ? -1
    : decomp.pair;

  const hand: WinningHand = {
    allMelds,
    pair,
    form: decomp.form,
    winTile: winTileIdx,
    context,
  };

  if (decomp.form === "sevenPairs") {
    hand.sevenPairs = decomp.pairs;
  }

  return hand;
}

/** Score a single decomposition with all detectors. */
function scoreDecomposition(
  decomp: HandForm,
  declaredMelds: ScoringMeld[],
  winTileIdx: number,
  context: WinContext,
  situationalOnly: boolean,
): { fans: FanMatch[]; score: number; hand: WinningHand } {
  const hand = buildWinningHand(decomp, declaredMelds, winTileIdx, context);

  let fans: FanMatch[] = [];
  for (const def of FAN_REGISTRY) {
    if (situationalOnly && !def.situational) continue;
    fans.push(...def.detector(hand));
  }
  fans = deduplicateIdenticalFans(fans);
  fans = applyOnlyOnce(fans);
  fans = applyExclusions(fans);
  fans = applyCapRules(fans);

  return { fans, score: scoreFans(fans), hand };
}

/** Fast path: complete hu from cached tenpai wait. */
export function completeHuFromTenpai(
  cached: CachedWait,
  winTileIdx: number,
  declaredMelds: ScoringMeld[],
  context: WinContext,
): ScoringResult {
  let bestResult: ScoredHand | null = null;

  for (const decomp of cached.decompositions) {
    const hand = buildWinningHand(decomp, declaredMelds, winTileIdx, context);

    // Start with cached base fans + add situational
    let fans: FanMatch[] = [...cached.baseFans];
    for (const def of FAN_REGISTRY) {
      if (!def.situational) continue;
      fans.push(...def.detector(hand));
    }

    // Re-apply exclusions (situational may interact)
    fans = deduplicateIdenticalFans(fans);
    fans = applyOnlyOnce(fans);
    fans = applyExclusions(fans);
    fans = applyCapRules(fans);

    const fanScore = scoreFans(fans);
    const bonusScore = context.bonusTileCount;
    const totalScore = fanScore + bonusScore;

    // Handle 无番和: if no fans at all, it's 8 points
    if (fans.length === 0) {
      fans = [{ fan: "无番和", score: 8, count: 1, involvedMelds: [], involvedPair: false }];
    }

    if (!bestResult || totalScore > bestResult.totalScore) {
      bestResult = { hand, fans, fanScore, bonusScore, totalScore };
    }
  }

  if (!bestResult) return { isWin: false, reason: "no-valid-decomposition" };

  if (bestResult.totalScore < 8) {
    return { isWin: false, reason: "insufficient-fan", bestScore: bestResult.totalScore };
  }

  return { isWin: true, result: bestResult };
}

/** Slow path: full decomposition + all detectors. */
export function scoreHandFull(
  counts: number[],
  declaredMelds: ScoringMeld[],
  winTileIdx: number,
  context: WinContext,
): ScoringResult {
  const decomps = findAllDecompositions(counts, declaredMelds.length);
  if (decomps.length === 0) {
    return { isWin: false, reason: "no-valid-decomposition" };
  }

  let bestResult: ScoredHand | null = null;

  for (const decomp of decomps) {
    const { fans, score, hand } = scoreDecomposition(
      decomp, declaredMelds, winTileIdx, context, false,
    );

    let finalFans = fans;
    const fanScore = score;
    const bonusScore = context.bonusTileCount;
    const totalScore = fanScore + bonusScore;

    if (finalFans.length === 0) {
      finalFans = [{ fan: "无番和", score: 8, count: 1, involvedMelds: [], involvedPair: false }];
    }

    if (!bestResult || totalScore > bestResult.totalScore) {
      bestResult = { hand, fans: finalFans, fanScore, bonusScore, totalScore };
    }
  }

  if (!bestResult) return { isWin: false, reason: "no-valid-decomposition" };

  if (bestResult.totalScore < 8) {
    return { isWin: false, reason: "insufficient-fan", bestScore: bestResult.totalScore };
  }

  return { isWin: true, result: bestResult };
}

/** Unified entry point: use cached tenpai if available, otherwise full pipeline. */
export function declareHu(
  cachedTenpai: CachedTenpai | null,
  winTileIdx: number,
  melds: ScoringMeld[],
  handCounts: number[],
  context: WinContext,
): ScoringResult {
  // Fast path
  if (cachedTenpai?.waits.has(winTileIdx)) {
    return completeHuFromTenpai(
      cachedTenpai.waits.get(winTileIdx)!,
      winTileIdx, melds, context,
    );
  }

  // Slow path
  return scoreHandFull(handCounts, melds, winTileIdx, context);
}
