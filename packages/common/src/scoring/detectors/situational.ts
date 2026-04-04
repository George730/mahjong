// Category H: Situational fans — depend on game context, not tile composition.
// These are skipped during tenpai scoring.

import type { FanMatch, WinningHand } from "../types.js";

function fm(fan: string, score: number): FanMatch {
  return { fan, score, count: 1, involvedMelds: [], involvedPair: false };
}

/** 自摸 (1): won by self-draw */
export function ziMo(hand: WinningHand): FanMatch[] {
  const src = hand.context.winSource;
  if (src === "selfDraw" || src === "kongDraw") return [fm("自摸", 1)];
  return [];
}

/** 花牌 (1 each): bonus tiles held */
export function huaPai(hand: WinningHand): FanMatch[] {
  const count = hand.context.bonusTileCount;
  if (count > 0) return [{ fan: "花牌", score: 1, count, involvedMelds: [], involvedPair: false }];
  return [];
}

/** 妙手回春 (8): self-draw the very last tile from the wall */
export function miaoShouHuiChun(hand: WinningHand): FanMatch[] {
  if (hand.context.winSource === "selfDraw" && hand.context.wallCount === 0)
    return [fm("妙手回春", 8)];
  return [];
}

/** 海底捞月 (8): win on the last discard (wall exhausted) */
export function haiDiLaoYue(hand: WinningHand): FanMatch[] {
  if (hand.context.winSource === "discard" && hand.context.wallCount === 0)
    return [fm("海底捞月", 8)];
  return [];
}

/** 河底捞鱼 — alias kept for compatibility, not used in registry */
export function heDiLaoYu(hand: WinningHand): FanMatch[] {
  return haiDiLaoYue(hand);
}

/** 杠上开花 (8): won by drawing a replacement tile after kong */
export function gangShangKaiHua(hand: WinningHand): FanMatch[] {
  if (hand.context.isKongDraw) return [fm("杠上开花", 8)];
  return [];
}

/** 抢杠和 (8): won by robbing another player's kong declaration */
export function qiangGangHu(hand: WinningHand): FanMatch[] {
  if (hand.context.isRobbingKong) return [fm("抢杠和", 8)];
  return [];
}

/** 和绝张 (4): the winning tile is the 4th and last copy */
export function huJueZhang(hand: WinningHand): FanMatch[] {
  if (hand.context.winTileVisibleCount >= 3) return [fm("和绝张", 4)];
  return [];
}
