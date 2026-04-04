// Category A: Meld-pattern fans — examine meld types, concealed/exposed status, kong counts.

import type { FanMatch, WinningHand } from "../types.js";

function m(fan: string, score: number, melds: number[] = [0, 1, 2, 3], pair = false): FanMatch {
  return { fan, score, count: 1, involvedMelds: melds, involvedPair: pair };
}

/** 碰碰和 (6): all 4 melds are pung/kong */
export function pengPengHu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard" && hand.form !== "knitted") return [];
  if (hand.allMelds.length < 4) return [];
  if (hand.allMelds.every(m => m.type === "pung" || m.type === "kong"))
    return [m("碰碰和", 6)];
  return [];
}

/** Count concealed pungs (including concealed kongs treated as pungs for counting).
 *  When winning on a discard, a pung containing the win tile is NOT concealed
 *  (it was completed by claiming the discard) — unless the win tile can be
 *  assigned to another meld (a chow) or the pair instead. */
function countConcealedPungs(hand: WinningHand): number {
  const isDiscard = hand.context.winSource === "discard" || hand.context.winSource === "robbingKong";
  if (!isDiscard) {
    // Self-draw: all concealed pungs/kongs count
    return hand.allMelds.filter(m =>
      (m.type === "pung" || m.type === "kong") && m.concealed
    ).length;
  }

  // Check if the win tile can be assigned to a chow or the pair,
  // allowing all concealed pungs to stay concealed
  const winTileCanGoElsewhere =
    hand.allMelds.some(m =>
      m.type === "chow" && m.tileIndices.includes(hand.winTile)
    ) || hand.winTile === hand.pair;

  let count = 0;
  let winMeldExcluded = false;
  for (const m of hand.allMelds) {
    if ((m.type !== "pung" && m.type !== "kong") || !m.concealed) continue;
    if (!winTileCanGoElsewhere && !winMeldExcluded
        && m.type === "pung" && m.tileIndices.includes(hand.winTile)) {
      winMeldExcluded = true;
      continue;
    }
    count++;
  }
  return count;
}

/** 四暗刻 (64): 4 concealed pungs/kongs */
export function siAnKe(hand: WinningHand): FanMatch[] {
  if (countConcealedPungs(hand) === 4) return [m("四暗刻", 64)];
  return [];
}

/** 三暗刻 (16): exactly 3 concealed pungs/kongs */
export function sanAnKe(hand: WinningHand): FanMatch[] {
  if (countConcealedPungs(hand) === 3) {
    const melds = hand.allMelds.map((m, i) => ({ m, i }))
      .filter(x => (x.m.type === "pung" || x.m.type === "kong") && x.m.concealed)
      .map(x => x.i);
    return [{ fan: "三暗刻", score: 16, count: 1, involvedMelds: melds, involvedPair: false }];
  }
  return [];
}

/** 双暗刻 (2): exactly 2 concealed pungs/kongs */
export function shuangAnKe(hand: WinningHand): FanMatch[] {
  if (countConcealedPungs(hand) === 2) {
    const melds = hand.allMelds.map((m, i) => ({ m, i }))
      .filter(x => (x.m.type === "pung" || x.m.type === "kong") && x.m.concealed)
      .map(x => x.i);
    return [{ fan: "双暗刻", score: 2, count: 1, involvedMelds: melds, involvedPair: false }];
  }
  return [];
}

/** 门前清 (2): no exposed melds (all concealed) */
export function menQianQing(hand: WinningHand): FanMatch[] {
  if (hand.allMelds.every(m => m.concealed))
    return [m("门前清", 2, [])];
  return [];
}

/** 不求人 (4): no exposed melds, win by self-draw */
export function buQiuRen(hand: WinningHand): FanMatch[] {
  const src = hand.context.winSource;
  if (src === "selfDraw" || src === "kongDraw") {
    if (hand.allMelds.every(m => m.concealed))
      return [m("不求人", 4, [])];
  }
  return [];
}

/** 全求人 (6): all melds exposed, win by discard (单钓将) */
export function quanQiuRen(hand: WinningHand): FanMatch[] {
  if (hand.context.winSource !== "discard") return [];
  if (hand.allMelds.length === 4 && hand.allMelds.every(m => !m.concealed))
    return [m("全求人", 6)];
  return [];
}

// --- Kong counting ---

function countKongs(hand: WinningHand, exposed: boolean | null): number {
  return hand.allMelds.filter(m => {
    if (m.type !== "kong") return false;
    if (exposed === null) return true;
    return exposed ? !m.concealed : m.concealed;
  }).length;
}

/** 四杠 (88) */
export function siGang(hand: WinningHand): FanMatch[] {
  if (countKongs(hand, null) === 4) return [m("四杠", 88)];
  return [];
}

/** 三杠 (32) */
export function sanGang(hand: WinningHand): FanMatch[] {
  if (countKongs(hand, null) === 3) return [m("三杠", 32)];
  return [];
}

/** 明杠 (1): each exposed kong scores 1 */
export function mingGang(hand: WinningHand): FanMatch[] {
  const count = countKongs(hand, true);
  if (count > 0) return [{ fan: "明杠", score: 1, count, involvedMelds: [], involvedPair: false }];
  return [];
}

/** 暗杠 (2): each concealed kong scores 2 */
export function anGang(hand: WinningHand): FanMatch[] {
  const count = countKongs(hand, false);
  if (count > 0) return [{ fan: "暗杠", score: 2, count, involvedMelds: [], involvedPair: false }];
  return [];
}

/** 双明杠 (4): exactly 2 exposed kongs */
export function shuangMingGang(hand: WinningHand): FanMatch[] {
  if (countKongs(hand, true) === 2) return [m("双明杠", 4, [])];
  return [];
}

/** 双暗杠 (6): exactly 2 concealed kongs */
export function shuangAnGang(hand: WinningHand): FanMatch[] {
  if (countKongs(hand, false) === 2) return [m("双暗杠", 6, [])];
  return [];
}

/** 明暗杠 (5): at least 1 exposed kong + at least 1 concealed kong */
export function mingAnGang(hand: WinningHand): FanMatch[] {
  if (countKongs(hand, true) >= 1 && countKongs(hand, false) >= 1)
    return [m("明暗杠", 5, [])];
  return [];
}
