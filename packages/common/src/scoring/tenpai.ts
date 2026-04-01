// Tenpai detection: compute which tiles complete the hand and base scores.

import { faceToIndex, tilesToCounts } from "./tile-encoding.js";
import { findAllDecompositions } from "./decompose.js";
import { buildWinningHand, scoreFans } from "./hu.js";
import { FAN_REGISTRY } from "./fan-registry.js";
import { applyExclusions, deduplicateIdenticalFans, applyOnlyOnce } from "./exclusions.js";
import type { Tile, Wind } from "../tiles.js";
import type { Meld } from "../game-state.js";
import type { TenpaiResult, TenpaiWait, TenpaiContext, HandForm, FanMatch, WinContext, ScoringMeld } from "./types.js";

/** Build a partial WinContext for tenpai scoring (situational fields are stubs). */
function buildTenpaiWinContext(ctx: TenpaiContext, winTileIdx: number): WinContext {
  return {
    winTile: winTileIdx,
    winSource: "discard", // placeholder — situational fans are skipped anyway
    seatWind: ctx.seatWind,
    roundWind: ctx.roundWind,
    seatIndex: 0,
    isDealer: false,
    wallCount: 99,
    bonusTileCount: ctx.bonusTileCount,
    isKongDraw: false,
    isRobbingKong: false,
    isLastTile: false,
    declaredMeldCount: ctx.melds.length,
    winTileVisibleCount: 0,
  };
}

/** Convert declared Melds to ScoringMelds. */
export function meldsToScoringMelds(melds: Meld[]): ScoringMeld[] {
  return melds.map(m => ({
    type: m.type,
    tileIndices: m.tiles.map(t => faceToIndex(t.face)),
    concealed: !m.exposed,
    claimedFrom: m.claimedTileId !== undefined ? undefined : undefined,
  }));
}

/** Score a set of decompositions for tenpai (tile-composition fans only). */
function scoreTenpaiDecompositions(
  decomps: HandForm[],
  winTileIdx: number,
  ctx: TenpaiContext,
): { fans: FanMatch[]; score: number } {
  let bestScore = -1;
  let bestFans: FanMatch[] = [];
  const winContext = buildTenpaiWinContext(ctx, winTileIdx);
  const declaredMelds = meldsToScoringMelds(ctx.melds);

  for (const decomp of decomps) {
    const hand = buildWinningHand(decomp, declaredMelds, winTileIdx, winContext);

    // Run only non-situational detectors
    let fans: FanMatch[] = [];
    for (const def of FAN_REGISTRY) {
      if (def.situational) continue;
      fans.push(...def.detector(hand));
    }
    fans = deduplicateIdenticalFans(fans);
    fans = applyOnlyOnce(fans);
    fans = applyExclusions(fans);

    const score = scoreFans(fans);
    if (score > bestScore) {
      bestScore = score;
      bestFans = fans;
    }
  }

  return { fans: bestFans, score: bestScore };
}

/** Compute tenpai for a hand (typically 13 tiles after discard). */
export function computeTenpai(hand: Tile[], ctx: TenpaiContext): TenpaiResult {
  const baseCounts = tilesToCounts(hand);
  const waits: TenpaiWait[] = [];
  const declaredMeldCount = ctx.melds.length;

  for (let idx = 0; idx < 34; idx++) {
    // Skip if all 4 copies accounted for
    const totalVisible = baseCounts[idx] + ctx.visibleCounts[idx];
    if (totalVisible >= 4) continue;

    // Add candidate tile
    baseCounts[idx]++;

    const decomps = findAllDecompositions(baseCounts, declaredMeldCount);
    if (decomps.length > 0) {
      const best = scoreTenpaiDecompositions(decomps, idx, ctx);
      waits.push({
        tileIndex: idx,
        remainingCount: 4 - totalVisible,
        baseFans: best.fans,
        baseScore: best.score,
        decompositions: decomps,
      });
    }

    // Remove candidate
    baseCounts[idx]--;
  }

  return { isTenpai: waits.length > 0, waits };
}
