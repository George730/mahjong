// Category B: Sequence-relationship fans — compare chow melds for patterns.

import { suitOf, rankOf } from "../tile-encoding.js";
import type { FanMatch, WinningHand, ScoringMeld } from "../types.js";

interface ChowInfo {
  suit: number;
  startRank: number;
  meldIdx: number;
}

function getChows(hand: WinningHand): ChowInfo[] {
  return hand.allMelds
    .map((m, i) => ({ m, i }))
    .filter(x => x.m.type === "chow")
    .map(x => ({
      suit: suitOf(x.m.tileIndices[0]),
      startRank: rankOf(x.m.tileIndices[0]),
      meldIdx: x.i,
    }));
}

function fm(fan: string, score: number, melds: number[]): FanMatch {
  return { fan, score, count: 1, involvedMelds: melds, involvedPair: false };
}

/** 一般高 (1): two identical chows in same suit (concealed) */
export function yiBanGao(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  const results: FanMatch[] = [];
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      if (chows[i].suit === chows[j].suit && chows[i].startRank === chows[j].startRank) {
        results.push(fm("一般高", 1, [chows[i].meldIdx, chows[j].meldIdx]));
      }
    }
  }
  return results;
}

/** 喜相逢 (1): two chows with same ranks but different suits */
export function xiXiangFeng(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  const results: FanMatch[] = [];
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      if (chows[i].suit !== chows[j].suit && chows[i].startRank === chows[j].startRank) {
        results.push(fm("喜相逢", 1, [chows[i].meldIdx, chows[j].meldIdx]));
      }
    }
  }
  return results;
}

/** 连六 (1): two chows in same suit, consecutive (e.g. 123+456 or 456+789) */
export function lianLiu(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  const results: FanMatch[] = [];
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      if (chows[i].suit === chows[j].suit) {
        const diff = Math.abs(chows[i].startRank - chows[j].startRank);
        if (diff === 3) {
          results.push(fm("连六", 1, [chows[i].meldIdx, chows[j].meldIdx]));
        }
      }
    }
  }
  return results;
}

/** 老少副 (1): same suit, 123 + 789 */
export function laoShaoFu(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  const results: FanMatch[] = [];
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      if (chows[i].suit === chows[j].suit) {
        const ranks = [chows[i].startRank, chows[j].startRank].sort((a, b) => a - b);
        if (ranks[0] === 1 && ranks[1] === 7) {
          results.push(fm("老少副", 1, [chows[i].meldIdx, chows[j].meldIdx]));
        }
      }
    }
  }
  return results;
}

// --- Triple/quad chow patterns ---

/** 一色三同顺 (24): three identical chows in same suit */
export function yiSeSanTongShun(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        if (chows[i].suit === chows[j].suit && chows[j].suit === chows[k].suit &&
            chows[i].startRank === chows[j].startRank && chows[j].startRank === chows[k].startRank) {
          return [fm("一色三同顺", 24, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 一色四同顺 (48): four identical chows in same suit */
export function yiSeSiTongShun(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  if (chows.length < 4) return [];
  if (chows.every(c => c.suit === chows[0].suit && c.startRank === chows[0].startRank)) {
    return [fm("一色四同顺", 48, chows.map(c => c.meldIdx))];
  }
  return [];
}

/** 三色三同顺 (8): three chows with same ranks in three different suits */
export function sanSeSanTongShun(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        const suits = new Set([chows[i].suit, chows[j].suit, chows[k].suit]);
        if (suits.size === 3 &&
            chows[i].startRank === chows[j].startRank && chows[j].startRank === chows[k].startRank) {
          return [fm("三色三同顺", 8, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 一色三步高 (16): three chows in same suit, start ranks differ by a constant step (1 or 2) */
export function yiSeSanBuGao(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        if (chows[i].suit !== chows[j].suit || chows[j].suit !== chows[k].suit) continue;
        const ranks = [chows[i].startRank, chows[j].startRank, chows[k].startRank].sort((a, b) => a - b);
        const step = ranks[1] - ranks[0];
        if ((step === 1 || step === 2) && ranks[2] - ranks[1] === step) {
          return [fm("一色三步高", 16, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 一色四步高 (32): four chows in same suit, ascending by step 1 or 2 */
export function yiSeSiBuGao(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  if (chows.length < 4) return [];
  // Check all 4 chows
  const sameSuit = chows.filter(c => c.suit === chows[0].suit);
  if (sameSuit.length < 4) return [];
  const ranks = sameSuit.map(c => c.startRank).sort((a, b) => a - b);
  const step = ranks[1] - ranks[0];
  if ((step === 1 || step === 2) && ranks[2] - ranks[1] === step && ranks[3] - ranks[2] === step) {
    return [fm("一色四步高", 32, sameSuit.map(c => c.meldIdx))];
  }
  return [];
}

/** 三色三步高 (6): three chows in three different suits, start ranks ascending by 1 */
export function sanSeSanBuGao(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        const suits = new Set([chows[i].suit, chows[j].suit, chows[k].suit]);
        if (suits.size !== 3) continue;
        const ranks = [chows[i].startRank, chows[j].startRank, chows[k].startRank].sort((a, b) => a - b);
        if (ranks[1] - ranks[0] === 1 && ranks[2] - ranks[1] === 1) {
          return [fm("三色三步高", 6, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 清龙 (16): same suit, 123+456+789 */
export function qingLong(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        if (chows[i].suit !== chows[j].suit || chows[j].suit !== chows[k].suit) continue;
        const ranks = [chows[i].startRank, chows[j].startRank, chows[k].startRank].sort((a, b) => a - b);
        if (ranks[0] === 1 && ranks[1] === 4 && ranks[2] === 7) {
          return [fm("清龙", 16, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 花龙 (8): three different suits, ranks 123+456+789 (one each) */
export function huaLong(hand: WinningHand): FanMatch[] {
  const chows = getChows(hand);
  for (let i = 0; i < chows.length; i++) {
    for (let j = i + 1; j < chows.length; j++) {
      for (let k = j + 1; k < chows.length; k++) {
        const suits = new Set([chows[i].suit, chows[j].suit, chows[k].suit]);
        if (suits.size !== 3) continue;
        const ranks = [chows[i].startRank, chows[j].startRank, chows[k].startRank].sort((a, b) => a - b);
        if (ranks[0] === 1 && ranks[1] === 4 && ranks[2] === 7) {
          return [fm("花龙", 8, [chows[i].meldIdx, chows[j].meldIdx, chows[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 一色双龙会 (64): same suit, two 123 + two 789 + pair of 5 */
export function yiSeShuangLongHui(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  const chows = getChows(hand);
  if (chows.length !== 4) return [];
  // All same suit
  const suit = chows[0].suit;
  if (!chows.every(c => c.suit === suit)) return [];
  // Count 123s and 789s
  const count1 = chows.filter(c => c.startRank === 1).length;
  const count7 = chows.filter(c => c.startRank === 7).length;
  if (count1 !== 2 || count7 !== 2) return [];
  // Pair must be rank 5 of same suit
  const pairRank = rankOf(hand.pair);
  if (suitOf(hand.pair) !== suit || pairRank !== 5) return [];
  return [fm("一色双龙会", 64, chows.map(c => c.meldIdx))];
}

/** 三色双龙会 (16): two suits each have 123+789, third suit has pair of 5 */
export function sanSeShuangLongHui(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  const chows = getChows(hand);
  if (chows.length !== 4) return [];

  // Group by suit
  const bySuit = new Map<number, ChowInfo[]>();
  for (const c of chows) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit)!.push(c);
  }

  // Need exactly 2 suits with chows
  const suitEntries = [...bySuit.entries()];
  if (suitEntries.length !== 2) return [];

  // Each suit must have 123 + 789
  for (const [, cs] of suitEntries) {
    if (cs.length !== 2) return [];
    const ranks = cs.map(c => c.startRank).sort((a, b) => a - b);
    if (ranks[0] !== 1 || ranks[1] !== 7) return [];
  }

  // Pair must be rank 5 of the third suit
  const usedSuits = new Set(suitEntries.map(e => e[0]));
  const pairSuit = suitOf(hand.pair);
  if (usedSuits.has(pairSuit)) return [];
  if (!isSuitedPairRank5(hand.pair)) return [];

  return [fm("三色双龙会", 16, chows.map(c => c.meldIdx))];
}

function isSuitedPairRank5(pairIdx: number): boolean {
  return pairIdx >= 0 && pairIdx <= 26 && rankOf(pairIdx) === 5;
}

/** 平和 (2): all chows, no honors, non-wait-pattern (pair is not wind/dragon) */
export function pingHu(hand: WinningHand): FanMatch[] {
  if (hand.form !== "standard") return [];
  if (hand.allMelds.length !== 4) return [];
  if (!hand.allMelds.every(m => m.type === "chow")) return [];
  // Pair must not be honor
  if (hand.pair >= 27) return [];
  return [fm("平和", 2, [0, 1, 2, 3])];
}
