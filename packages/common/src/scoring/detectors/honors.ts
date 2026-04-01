// Category F: Wind and dragon fans.

import { EAST, SOUTH, WEST, NORTH, ZHONG, FA, BAI, windToIndex } from "../tile-encoding.js";
import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number, melds: number[] = []): FanMatch {
  return { fan, score, count: 1, involvedMelds: melds, involvedPair: false };
}

function hasPungOf(hand: WinningHand, idx: number): { found: boolean; meldIdx: number } {
  for (let i = 0; i < hand.allMelds.length; i++) {
    const m = hand.allMelds[i];
    if ((m.type === "pung" || m.type === "kong") && m.tileIndices[0] === idx) {
      return { found: true, meldIdx: i };
    }
  }
  return { found: false, meldIdx: -1 };
}

/** 箭刻 (2): pung/kong of any dragon (中发白). One per dragon. */
export function jianKe(hand: WinningHand): FanMatch[] {
  const results: FanMatch[] = [];
  for (const d of [ZHONG, FA, BAI]) {
    const r = hasPungOf(hand, d);
    if (r.found) results.push(fm("箭刻", 2, [r.meldIdx]));
  }
  return results;
}

/** 双箭刻 (6): two pung/kongs of dragons */
export function shuangJianKe(hand: WinningHand): FanMatch[] {
  let count = 0;
  const melds: number[] = [];
  for (const d of [ZHONG, FA, BAI]) {
    const r = hasPungOf(hand, d);
    if (r.found) { count++; melds.push(r.meldIdx); }
  }
  if (count === 2) return [fm("双箭刻", 6, melds)];
  return [];
}

/** 大三元 (88): pung/kong of all three dragons */
export function daSanYuan(hand: WinningHand): FanMatch[] {
  const melds: number[] = [];
  for (const d of [ZHONG, FA, BAI]) {
    const r = hasPungOf(hand, d);
    if (!r.found) return [];
    melds.push(r.meldIdx);
  }
  return [fm("大三元", 88, melds)];
}

/** 小三元 (64): two dragon pungs + pair of third dragon */
export function xiaoSanYuan(hand: WinningHand): FanMatch[] {
  let pungCount = 0;
  let pairDragon = false;
  const melds: number[] = [];
  for (const d of [ZHONG, FA, BAI]) {
    const r = hasPungOf(hand, d);
    if (r.found) { pungCount++; melds.push(r.meldIdx); }
    else if (hand.pair === d) pairDragon = true;
  }
  if (pungCount === 2 && pairDragon) return [fm("小三元", 64, melds)];
  return [];
}

const WINDS = [EAST, SOUTH, WEST, NORTH];

/** 三风刻 (12): three pung/kongs of winds */
export function sanFengKe(hand: WinningHand): FanMatch[] {
  const melds: number[] = [];
  for (const w of WINDS) {
    const r = hasPungOf(hand, w);
    if (r.found) melds.push(r.meldIdx);
  }
  if (melds.length === 3) return [fm("三风刻", 12, melds)];
  return [];
}

/** 大四喜 (88): pung/kong of all four winds */
export function daSiXi(hand: WinningHand): FanMatch[] {
  const melds: number[] = [];
  for (const w of WINDS) {
    const r = hasPungOf(hand, w);
    if (!r.found) return [];
    melds.push(r.meldIdx);
  }
  return [fm("大四喜", 88, melds)];
}

/** 小四喜 (64): three wind pungs + pair of fourth wind */
export function xiaoSiXi(hand: WinningHand): FanMatch[] {
  let pungCount = 0;
  let pairWind = false;
  const melds: number[] = [];
  for (const w of WINDS) {
    const r = hasPungOf(hand, w);
    if (r.found) { pungCount++; melds.push(r.meldIdx); }
    else if (hand.pair === w) pairWind = true;
  }
  if (pungCount === 3 && pairWind) return [fm("小四喜", 64, melds)];
  return [];
}

/** 圈风刻 (2): pung/kong of round wind */
export function quanFengKe(hand: WinningHand): FanMatch[] {
  const idx = windToIndex(hand.context.roundWind);
  const r = hasPungOf(hand, idx);
  if (r.found) return [fm("圈风刻", 2, [r.meldIdx])];
  return [];
}

/** 门风刻 (2): pung/kong of seat wind */
export function menFengKe(hand: WinningHand): FanMatch[] {
  const idx = windToIndex(hand.context.seatWind);
  const r = hasPungOf(hand, idx);
  if (r.found) return [fm("门风刻", 2, [r.meldIdx])];
  return [];
}
