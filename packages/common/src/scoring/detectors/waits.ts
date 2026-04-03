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

/** 边张 (1): win tile is rank 3 in 1-2-3 or rank 7 in 7-8-9.
 *  Only fires if every chow containing the win tile has it in an edge position. */
export function bianZhang(hand: WinningHand): FanMatch[] {
  const wt = hand.winTile;
  if (!isSuited(wt)) return [];
  const r = rankOf(wt);

  let found = false;
  for (const meld of hand.allMelds) {
    if (meld.type !== "chow") continue;
    if (!meld.tileIndices.includes(wt)) continue;
    const startRank = rankOf(meld.tileIndices[0]);
    const isEdge = (startRank === 1 && r === 3) || (startRank === 7 && r === 7);
    if (!isEdge) return []; // win tile in a non-edge chow → not a pure edge wait
    found = true;
  }
  if (found) return [fm("边张", 1)];
  return [];
}

/** 坎张 (1): win tile is the middle of a sequence.
 *  Only fires if every chow containing the win tile has it in the middle position. */
export function kanZhang(hand: WinningHand): FanMatch[] {
  const wt = hand.winTile;
  if (!isSuited(wt)) return [];

  let found = false;
  for (const meld of hand.allMelds) {
    if (meld.type !== "chow") continue;
    if (!meld.tileIndices.includes(wt)) continue;
    if (meld.tileIndices[1] !== wt) return []; // win tile in a non-middle chow → not a pure middle wait
    found = true;
  }
  if (found) return [fm("坎张", 1)];
  return [];
}
