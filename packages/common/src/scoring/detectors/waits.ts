// Category G: Wait-pattern fans — depend on which tile completes the hand.

import { isSuited, rankOf } from "../tile-encoding.js";
import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [], involvedPair: true };
}

/** 单钓将 (1): win tile completes the pair */
export function danDiaoJiang(hand: WinningHand): FanMatch[] {
  if (hand.pair >= 0 && hand.winTile === hand.pair) {
    // Make sure the win tile actually goes to the pair (not a meld that also uses it)
    // If winTile == pair index, it's a single wait on the pair.
    return [fm("单钓将", 1)];
  }
  return [];
}

/** 边张 (1): win tile is rank 3 in 1-2-3 or rank 7 in 7-8-9 */
export function bianZhang(hand: WinningHand): FanMatch[] {
  const wt = hand.winTile;
  if (!isSuited(wt)) return [];
  const r = rankOf(wt);

  for (const meld of hand.allMelds) {
    if (meld.type !== "chow") continue;
    if (!meld.tileIndices.includes(wt)) continue;
    const startRank = rankOf(meld.tileIndices[0]);
    // 1-2-3 and win tile is 3 (edge wait on low end)
    if (startRank === 1 && r === 3) return [fm("边张", 1)];
    // 7-8-9 and win tile is 7 (edge wait on high end)
    if (startRank === 7 && r === 7) return [fm("边张", 1)];
  }
  return [];
}

/** 坎张 (1): win tile is the middle of a sequence */
export function kanZhang(hand: WinningHand): FanMatch[] {
  const wt = hand.winTile;
  if (!isSuited(wt)) return [];

  for (const meld of hand.allMelds) {
    if (meld.type !== "chow") continue;
    if (!meld.tileIndices.includes(wt)) continue;
    // Middle tile of the chow
    if (meld.tileIndices[1] === wt) return [fm("坎张", 1)];
  }
  return [];
}
