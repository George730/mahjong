// Category C: Triplet-relationship fans — compare pung/kong melds.

import { suitOf, rankOf, isSuited } from "../tile-encoding.js";
import type { FanMatch, WinningHand } from "../types.js";

interface PungInfo {
  tileIdx: number;  // the repeated tile index
  suit: number;
  rank: number;
  isSuited: boolean;
  meldIdx: number;
}

function getPungs(hand: WinningHand): PungInfo[] {
  return hand.allMelds
    .map((m, i) => ({ m, i }))
    .filter(x => x.m.type === "pung" || x.m.type === "kong")
    .map(x => {
      const idx = x.m.tileIndices[0];
      return {
        tileIdx: idx,
        suit: isSuited(idx) ? suitOf(idx) : -1,
        rank: isSuited(idx) ? rankOf(idx) : -1,
        isSuited: isSuited(idx),
        meldIdx: x.i,
      };
    });
}

function fm(fan: string, score: number, melds: number[]): FanMatch {
  return { fan, score, count: 1, involvedMelds: melds, involvedPair: false };
}

/** 双同刻 (2): two pungs with same rank in different suits */
export function shuangTongKe(hand: WinningHand): FanMatch[] {
  const pungs = getPungs(hand).filter(p => p.isSuited);
  const results: FanMatch[] = [];
  for (let i = 0; i < pungs.length; i++) {
    for (let j = i + 1; j < pungs.length; j++) {
      if (pungs[i].rank === pungs[j].rank && pungs[i].suit !== pungs[j].suit) {
        results.push(fm("双同刻", 2, [pungs[i].meldIdx, pungs[j].meldIdx]));
      }
    }
  }
  return results;
}

/** 三同刻 (16): three pungs with same rank in three different suits */
export function sanTongKe(hand: WinningHand): FanMatch[] {
  const pungs = getPungs(hand).filter(p => p.isSuited);
  for (let i = 0; i < pungs.length; i++) {
    for (let j = i + 1; j < pungs.length; j++) {
      for (let k = j + 1; k < pungs.length; k++) {
        if (pungs[i].rank === pungs[j].rank && pungs[j].rank === pungs[k].rank) {
          const suits = new Set([pungs[i].suit, pungs[j].suit, pungs[k].suit]);
          if (suits.size === 3) {
            return [fm("三同刻", 16, [pungs[i].meldIdx, pungs[j].meldIdx, pungs[k].meldIdx])];
          }
        }
      }
    }
  }
  return [];
}

/** 一色三节高 (24): three pungs in same suit, consecutive ranks */
export function yiSeSanJieGao(hand: WinningHand): FanMatch[] {
  const pungs = getPungs(hand).filter(p => p.isSuited);
  for (let i = 0; i < pungs.length; i++) {
    for (let j = i + 1; j < pungs.length; j++) {
      for (let k = j + 1; k < pungs.length; k++) {
        if (pungs[i].suit !== pungs[j].suit || pungs[j].suit !== pungs[k].suit) continue;
        const ranks = [pungs[i].rank, pungs[j].rank, pungs[k].rank].sort((a, b) => a - b);
        if (ranks[1] - ranks[0] === 1 && ranks[2] - ranks[1] === 1) {
          return [fm("一色三节高", 24, [pungs[i].meldIdx, pungs[j].meldIdx, pungs[k].meldIdx])];
        }
      }
    }
  }
  return [];
}

/** 一色四节高 (48): four pungs in same suit, consecutive ranks */
export function yiSeSiJieGao(hand: WinningHand): FanMatch[] {
  const pungs = getPungs(hand).filter(p => p.isSuited);
  if (pungs.length < 4) return [];
  // Find 4 same-suit pungs
  const bySuit = new Map<number, PungInfo[]>();
  for (const p of pungs) {
    if (!bySuit.has(p.suit)) bySuit.set(p.suit, []);
    bySuit.get(p.suit)!.push(p);
  }
  for (const [, ps] of bySuit) {
    if (ps.length < 4) continue;
    const ranks = ps.map(p => p.rank).sort((a, b) => a - b);
    if (ranks[1] - ranks[0] === 1 && ranks[2] - ranks[1] === 1 && ranks[3] - ranks[2] === 1) {
      return [fm("一色四节高", 48, ps.map(p => p.meldIdx))];
    }
  }
  return [];
}

/** 三色三节高 (8): three pungs in three different suits, same consecutive ranks */
export function sanSeSanJieGao(hand: WinningHand): FanMatch[] {
  const pungs = getPungs(hand).filter(p => p.isSuited);
  for (let i = 0; i < pungs.length; i++) {
    for (let j = i + 1; j < pungs.length; j++) {
      for (let k = j + 1; k < pungs.length; k++) {
        const suits = new Set([pungs[i].suit, pungs[j].suit, pungs[k].suit]);
        if (suits.size !== 3) continue;
        const ranks = [pungs[i].rank, pungs[j].rank, pungs[k].rank].sort((a, b) => a - b);
        if (ranks[1] - ranks[0] === 1 && ranks[2] - ranks[1] === 1) {
          return [fm("三色三节高", 8, [pungs[i].meldIdx, pungs[j].meldIdx, pungs[k].meldIdx])];
        }
      }
    }
  }
  return [];
}
