// Category D: Terminal/honor composition fans.

import { isSuited, rankOf, isTerminalOrHonor, isTerminal, isHonor } from "../tile-encoding.js";
import type { FanMatch, WinningHand, ScoringMeld } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [0, 1, 2, 3], involvedPair: true };
}

/** Collect all tile indices in the hand (melds + pair). */
function allIndices(hand: WinningHand): number[] {
  const indices: number[] = [];
  for (const m of hand.allMelds) {
    indices.push(...m.tileIndices);
  }
  if (hand.pair >= 0) indices.push(hand.pair);
  if (hand.sevenPairs) indices.push(...hand.sevenPairs);
  return indices;
}

/** Check if every meld contains at least one terminal or honor. */
function everyMeldHasTerminalOrHonor(hand: WinningHand): boolean {
  for (const meld of hand.allMelds) {
    if (!meld.tileIndices.some(isTerminalOrHonor)) return false;
  }
  // Pair also must be terminal/honor
  return hand.pair < 0 || isTerminalOrHonor(hand.pair);
}

/** 全带幺九 (4): every meld and pair contains a terminal or honor */
export function quanDaiYaoJiu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  if (!everyMeldHasTerminalOrHonor(hand)) return [];
  // Must have at least one chow (otherwise it's 混幺九 or 清幺九)
  if (!hand.allMelds.some(m => m.type === "chow")) return [];
  // Must have both suited and honor tiles
  const all = allIndices(hand);
  const hasSuited = all.some(isSuited);
  const hasHonor = all.some(isHonor);
  if (!hasSuited || !hasHonor) return [];
  return [fm("全带幺九", 4)];
}

/** 混幺九 (32): all tiles are terminals or honors, all pungs/kongs */
export function hunYaoJiu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  const all = allIndices(hand);
  if (!all.every(isTerminalOrHonor)) return [];
  // Must have both suited terminals and honors
  if (!all.some(isTerminal) || !all.some(isHonor)) return [];
  return [fm("混幺九", 32)];
}

/** 清幺九 (64): all tiles are terminals (1 or 9 of suited), no honors */
export function qingYaoJiu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  const all = allIndices(hand);
  if (!all.every(isTerminal)) return [];
  return [fm("清幺九", 64)];
}

/** 断幺九 (2): no terminals or honors at all */
export function duanYaoJiu(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.length === 0) return [];
  if (all.every(i => isSuited(i) && !isTerminal(i)))
    return [fm("断幺九", 2)];
  return [];
}

/** 全大 (24): all tiles are rank 7,8,9 */
export function quanDa(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.every(i => isSuited(i) && rankOf(i) >= 7))
    return [fm("全大", 24)];
  return [];
}

/** 全中 (24): all tiles are rank 4,5,6 */
export function quanZhong(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.every(i => isSuited(i) && rankOf(i) >= 4 && rankOf(i) <= 6))
    return [fm("全中", 24)];
  return [];
}

/** 全小 (24): all tiles are rank 1,2,3 */
export function quanXiao(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.every(i => isSuited(i) && rankOf(i) <= 3))
    return [fm("全小", 24)];
  return [];
}

/** 大于五 (12): all tiles are rank 6-9 */
export function daYuWu(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.every(i => isSuited(i) && rankOf(i) >= 6))
    return [fm("大于五", 12)];
  return [];
}

/** 小于五 (12): all tiles are rank 1-4 */
export function xiaoYuWu(hand: WinningHand): FanMatch[] {
  const all = allIndices(hand);
  if (all.every(i => isSuited(i) && rankOf(i) <= 4))
    return [fm("小于五", 12)];
  return [];
}

/** 幺九刻 (1): each pung/kong of a terminal or honor. Returns one per qualifying meld. */
export function yaoJiuKe(hand: WinningHand): FanMatch[] {
  const results: FanMatch[] = [];
  for (let i = 0; i < hand.allMelds.length; i++) {
    const meld = hand.allMelds[i];
    if (meld.type === "pung" || meld.type === "kong") {
      if (isTerminalOrHonor(meld.tileIndices[0])) {
        results.push({ fan: "幺九刻", score: 1, count: 1, involvedMelds: [i], involvedPair: false });
      }
    }
  }
  return results;
}

/** 全带五 (16): every meld and pair contains rank 5 */
export function quanDaiWu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  for (const meld of hand.allMelds) {
    if (!meld.tileIndices.some(i => isSuited(i) && rankOf(i) === 5)) return [];
  }
  if (hand.pair < 0 || !isSuited(hand.pair) || rankOf(hand.pair) !== 5) return [];
  return [fm("全带五", 16)];
}

/** 全双刻 (24): all pungs/kongs of even rank (2,4,6,8), pair also even */
export function quanShuangKe(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  const all = allIndices(hand);
  if (!all.every(i => isSuited(i) && rankOf(i) % 2 === 0))
    return [];
  return [fm("全双刻", 24)];
}
