// Category E: Suit-composition fans.

import { isSuited, suitOf, isWind, isDragon } from "../tile-encoding.js";
import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [], involvedPair: true };
}

function getSuitProfile(hand: WinningHand) {
  const suits = new Set<number>();
  let hasWinds = false;
  let hasDragons = false;

  const check = (idx: number) => {
    if (isSuited(idx)) suits.add(suitOf(idx));
    else if (isWind(idx)) hasWinds = true;
    else if (isDragon(idx)) hasDragons = true;
  };

  for (const m of hand.allMelds) {
    for (const idx of m.tileIndices) check(idx);
  }
  if (hand.pair >= 0) check(hand.pair);
  if (hand.sevenPairs) hand.sevenPairs.forEach(check);
  if (hand.thirteenOrphansIndices) hand.thirteenOrphansIndices.forEach(check);
  if (hand.allUnrelated) hand.allUnrelated.forEach(check);

  return { suits, hasWinds, hasDragons, hasHonors: hasWinds || hasDragons };
}

/** 清一色 (24): all tiles from one suit, no honors */
export function qingYiSe(hand: WinningHand): FanMatch[] {
  const { suits, hasHonors } = getSuitProfile(hand);
  if (suits.size === 1 && !hasHonors) return [fm("清一色", 24)];
  return [];
}

/** 混一色 (6): all tiles from one suit + honors */
export function hunYiSe(hand: WinningHand): FanMatch[] {
  const { suits, hasHonors } = getSuitProfile(hand);
  if (suits.size === 1 && hasHonors) return [fm("混一色", 6)];
  return [];
}

/** 字一色 (64): all tiles are honors (winds + dragons) */
export function ziYiSe(hand: WinningHand): FanMatch[] {
  const { suits } = getSuitProfile(hand);
  if (suits.size === 0) return [fm("字一色", 64)];
  return [];
}

/** 五门齐 (6): all 5 categories present (wan, tiao, tong, winds, dragons) */
export function wuMenQi(hand: WinningHand): FanMatch[] {
  const { suits, hasWinds, hasDragons } = getSuitProfile(hand);
  if (suits.size === 3 && hasWinds && hasDragons) return [fm("五门齐", 6)];
  return [];
}

/** 缺一门 (1): exactly 2 of 3 suits present, no honors required */
export function queYiMen(hand: WinningHand): FanMatch[] {
  const { suits } = getSuitProfile(hand);
  if (suits.size === 2) return [fm("缺一门", 1)];
  return [];
}

/** 无字 (1): no honor tiles (winds or dragons) */
export function wuZi(hand: WinningHand): FanMatch[] {
  const { hasHonors } = getSuitProfile(hand);
  if (!hasHonors) return [fm("无字", 1)];
  return [];
}

// --- Special suit patterns ---

// 绿一色 tiles: 2s,3s,4s,6s,8s,发
const GREEN_INDICES = new Set([10, 11, 12, 14, 16, 32]); // tiao 2,3,4,6,8 + fa

/** 绿一色 (88): all tiles from {2,3,4,6,8 tiao, 发} */
export function lvYiSe(hand: WinningHand): FanMatch[] {
  const check = (idx: number) => GREEN_INDICES.has(idx);

  for (const m of hand.allMelds) {
    if (!m.tileIndices.every(check)) return [];
  }
  if (hand.pair >= 0 && !check(hand.pair)) return [];
  if (hand.sevenPairs && !hand.sevenPairs.every(check)) return [];
  if (hand.allUnrelated && !hand.allUnrelated.every(check)) return [];
  return [fm("绿一色", 88)];
}

// 推不倒 tiles: 1,2,3,4,5,8,9 tong + 2,4,5,6,8,9 tiao + 白
// These are tiles that look the same upside down
const TUI_BU_DAO = new Set([
  18, 19, 20, 21, 22, 25, 26, // tong 1,2,3,4,5,8,9
  10, 12, 13, 14, 16, 17,     // tiao 2,4,5,6,8,9
  33,                           // bai
]);

/** 推不倒 (8): all tiles are from the reversible set */
export function tuiBuDao(hand: WinningHand): FanMatch[] {
  const check = (idx: number) => TUI_BU_DAO.has(idx);

  for (const m of hand.allMelds) {
    if (!m.tileIndices.every(check)) return [];
  }
  if (hand.pair >= 0 && !check(hand.pair)) return [];
  if (hand.sevenPairs && !hand.sevenPairs.every(check)) return [];
  if (hand.allUnrelated && !hand.allUnrelated.every(check)) return [];
  return [fm("推不倒", 8)];
}
