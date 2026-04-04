// Category G: Wait-pattern fans — depend on which tile completes the hand.
// All three wait fans (单钓将, 边张, 坎张) require that the tenpai hand has
// exactly one winning tile. If multiple tiles can complete the hand, no wait
// fan is awarded.

import { isSuited, rankOf } from "../tile-encoding.js";
import { findAllDecompositions } from "../decompose.js";
import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [], involvedPair: true };
}

/** Reconstruct closed-hand tile counts from WinningHand.
 *  Only includes tiles from closed melds + pair (excludes declared melds). */
function reconstructClosedCounts(hand: WinningHand): number[] {
  const counts = new Array(34).fill(0);
  const declaredCount = hand.context.declaredMeldCount;
  for (let i = declaredCount; i < hand.allMelds.length; i++) {
    for (const idx of hand.allMelds[i].tileIndices) counts[idx]++;
  }
  if (hand.pair >= 0) counts[hand.pair] += 2;
  if (hand.sevenPairs) {
    for (const idx of hand.sevenPairs) counts[idx] += 2;
  }
  if (hand.allUnrelated) {
    for (const idx of hand.allUnrelated) counts[idx]++;
  }
  return counts;
}

/** Check that the tenpai hand can only win on exactly the given tile.
 *  Returns false if any other tile also produces a valid decomposition. */
function isUniqueWait(hand: WinningHand): boolean {
  const counts = reconstructClosedCounts(hand);
  counts[hand.winTile]--;

  const declaredMeldCount = hand.context.declaredMeldCount;
  for (let t = 0; t < 34; t++) {
    if (t === hand.winTile) continue;
    if (counts[t] >= 4) continue;
    counts[t]++;
    const decomps = findAllDecompositions(counts, declaredMeldCount);
    counts[t]--;
    if (decomps.length > 0) return false;
  }
  return true;
}

/** 单钓将 (1): win tile completes the pair, and the tenpai has exactly one
 *  winning tile (the pair tile). */
export function danDiaoJiang(hand: WinningHand): FanMatch[] {
  if (hand.pair < 0 || hand.winTile !== hand.pair) return [];
  if (!isUniqueWait(hand)) return [];
  return [fm("单钓将", 1)];
}

/** 边张 (1): win tile is rank 3 in 1-2-3 or rank 7 in 7-8-9.
 *  Only fires if every chow containing the win tile has it in an edge position,
 *  and the tenpai has exactly one winning tile. */
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
    if (!isEdge) return [];
    found = true;
  }
  if (!found) return [];
  if (!isUniqueWait(hand)) return [];
  return [fm("边张", 1)];
}

/** 坎张 (1): win tile is the middle of a sequence.
 *  Only fires if every chow containing the win tile has it in the middle position,
 *  and the tenpai has exactly one winning tile. */
export function kanZhang(hand: WinningHand): FanMatch[] {
  const wt = hand.winTile;
  if (!isSuited(wt)) return [];

  let found = false;
  for (const meld of hand.allMelds) {
    if (meld.type !== "chow") continue;
    if (!meld.tileIndices.includes(wt)) continue;
    if (meld.tileIndices[1] !== wt) return [];
    found = true;
  }
  if (!found) return [];
  if (!isUniqueWait(hand)) return [];
  return [fm("坎张", 1)];
}
