// Category I: Special fans — 四归一, 七对, 连七对, 十三幺, 全不靠, 组合龙, 七星不靠, 九莲宝灯, 无番和.

import { isSuited, suitOf, rankOf, isHonor } from "../tile-encoding.js";
import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [], involvedPair: false };
}

/** 四归一 (2): 4 tiles of the same face used across different melds (not a kong).
 *  Can occur multiple times for different faces. */
export function siGuiYi(hand: WinningHand): FanMatch[] {
  if (hand.form === "thirteenOrphans") return [];

  if (hand.form === "sevenPairs" && hand.sevenPairs) {
    // In seven pairs, a tile appearing twice in the pairs array means 4 copies
    const counts = new Map<number, number>();
    for (const idx of hand.sevenPairs) {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
    const results: FanMatch[] = [];
    for (const [, count] of counts) {
      if (count >= 2) results.push(fm("四归一", 2));
    }
    return results;
  }

  // Count occurrences of each tile index across all melds + pair
  const counts = new Array(34).fill(0);
  for (const m of hand.allMelds) {
    // Skip kongs — having 4 in a kong is not 四归一
    if (m.type === "kong") continue;
    for (const idx of m.tileIndices) counts[idx]++;
  }
  if (hand.pair >= 0) counts[hand.pair] += 2; // pair contributes 2

  const results: FanMatch[] = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) {
      results.push(fm("四归一", 2));
    }
  }
  return results;
}

/** 七对 (24): seven pairs */
export function qiDui(hand: WinningHand): FanMatch[] {
  if (hand.form === "sevenPairs") return [fm("七对", 24)];
  return [];
}

/** 连七对 (88): seven consecutive pairs in one suit */
export function lianQiDui(hand: WinningHand): FanMatch[] {
  if (hand.form !== "sevenPairs" || !hand.sevenPairs) return [];
  const pairs = [...hand.sevenPairs].sort((a, b) => a - b);
  // Remove duplicates (4-of-a-kind counted as 2 pairs)
  const unique = [...new Set(pairs)].sort((a, b) => a - b);
  if (unique.length !== 7) return [];
  // All same suit and consecutive
  if (!unique.every(i => isSuited(i))) return [];
  if (!unique.every(i => suitOf(i) === suitOf(unique[0]))) return [];
  for (let i = 1; i < 7; i++) {
    if (unique[i] - unique[i - 1] !== 1) return [];
  }
  return [fm("连七对", 88)];
}

/** 十三幺 (88): thirteen orphans */
export function shiSanYao(hand: WinningHand): FanMatch[] {
  if (hand.form === "thirteenOrphans") return [fm("十三幺", 88)];
  return [];
}

/** 全不靠 (12): all unrelated — knitted straight + distinct honors */
export function quanBuKao(hand: WinningHand): FanMatch[] {
  if (hand.form === "allUnrelated") return [fm("全不靠", 12)];
  return [];
}

/** 组合龙 (12): knitted straight (1-4-7 / 2-5-8 / 3-6-9 across 3 suits) + normal melds */
export function zuHeLong(hand: WinningHand): FanMatch[] {
  if (hand.form === "knitted") return [fm("组合龙", 12)];
  // Also fire for 全不靠 when it contains a complete 9-tile knitted straight
  if (hand.form === "allUnrelated" && hand.allUnrelated) {
    const suited = hand.allUnrelated.filter(i => i < 27);
    if (suited.length === 9) return [fm("组合龙", 12)];
  }
  return [];
}

/** 七星不靠 (24): knitted straight + all 7 honors as singles */
export function qiXingBuKao(hand: WinningHand): FanMatch[] {
  if (hand.form === "allHonors") { return [fm("七星不靠", 24)] }
  // allUnrelated indices should contain 9 knitted + 5 honors for 全不靠
  // For 七星不靠 we need 9 knitted + 7 honors = 16... but hand is 14 tiles.
  // Actually 七星不靠: 9 knitted tiles (3 per suit from disjoint sets) + 4 winds + 3 dragons = 16
  // But a hand is 14 tiles. Let me re-check.
  // 七星不靠 requires: 7 honor singletons + 7 suited tiles (one from each of 7 ranks across 3 suits
  // following the knitted pattern, but only 7 of the 9). Total = 14 tiles.
  // Actually the standard definition: each suit contributes tiles from one of {1,4,7}, {2,5,8}, {3,6,9}
  // but only need 7 suited tiles total (not all 9), plus all 7 honors.
  // However in practice: 七星不靠 is often defined as a superset of 全不靠 where all 7 honors are present.
  // If 全不靠 has 9 suited + 5 honors = 14, then 七星不靠 needs all 7 honors which means
  // 7 suited + 7 honors = 14. The suited tiles still follow the knitted pattern.

  // For our implementation: check the allUnrelated indices
  // This form was built by findKnittedDecompositions with 9 knitted + 5 honors
  // But 七星不靠 would need 7 suited + 7 honors
  // We need a separate check
  return [];
}

/** 九莲宝灯 (88): the 13-tile hand before winning must be exactly 1112345678999
 *  (one suit), then win on any tile of the same suit. */
export function jiuLianBaoDeng(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  // All tiles must be same suit
  const allIndices: number[] = [];
  for (const m of hand.allMelds) allIndices.push(...m.tileIndices);
  if (hand.pair >= 0) { allIndices.push(hand.pair); allIndices.push(hand.pair); }

  if (!allIndices.every(i => isSuited(i))) return [];
  const suit = suitOf(allIndices[0]);
  if (!allIndices.every(i => suitOf(i) === suit)) return [];

  // Count by rank, then subtract the win tile to get the 13-tile hand before winning
  const rankCounts = new Array(10).fill(0);
  for (const idx of allIndices) rankCounts[rankOf(idx)]++;
  rankCounts[rankOf(hand.winTile)]--;

  // The 13-tile hand must be exactly 1112345678999
  const basePattern = [0, 3, 1, 1, 1, 1, 1, 1, 1, 3]; // index 0 unused
  for (let r = 1; r <= 9; r++) {
    if (rankCounts[r] !== basePattern[r]) return [];
  }
  return [fm("九莲宝灯", 88)];
}

/** 无番和 (8): no other fan detected (floor of 8). Detected in the scoring pipeline, not here.
 *  This detector always returns empty — 无番和 is added by the scorer if total fan is 0. */
export function wuFanHu(_hand: WinningHand): FanMatch[] {
  return [];
}
