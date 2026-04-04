// Scoring integration tests — manually specify hands and expected fans.
//
// Tile tokens:
//   Suited: 1m-9m (万), 1s-9s (条), 1p-9p (筒)
//   Winds:  E S W N
//   Dragons: Z(中) F(发) B(白)
//
// Hand: flat list of tiles currently in the closed hand (excluding the win tile).
//
// Declared melds (claimed/exposed or concealed kong), separate from hand:
//   "c(1m 2m 3m)"       — exposed chow (吃)
//   "p(Z Z Z)"          — exposed pung (碰)
//   "k(9p 9p 9p 9p)"    — exposed kong (明杠)
//   "!k(1m 1m 1m 1m)"     — concealed kong (暗杠, no "!" prefix)
//
// The rule engine decomposes the hand tiles itself.

import { describe, it, expect } from "vitest";
import { scoreHandFull } from "../scoring/hu.js";
import { FAN_REGISTRY } from "../scoring/fan-registry.js";
import type { WinContext, ScoringMeld } from "../scoring/types.js";

// ---------------------------------------------------------------------------
// Fan score lookup from registry
// ---------------------------------------------------------------------------

const FAN_SCORE_MAP = new Map<string, number>();
for (const def of FAN_REGISTRY) {
  FAN_SCORE_MAP.set(def.id, def.score);
}

function fanScore(name: string): number {
  const score = FAN_SCORE_MAP.get(name);
  if (score === undefined) throw new Error(`Unknown fan: "${name}"`);
  return score;
}

// ---------------------------------------------------------------------------
// Tile parser
// ---------------------------------------------------------------------------

/** Map compact tile token to index 0-33. */
function tileIndex(token: string): number {
  const honor: Record<string, number> = {
    E: 27, S: 28, W: 29, N: 30, Z: 31, F: 32, B: 33,
  };
  if (honor[token] !== undefined) return honor[token];
  const rank = parseInt(token[0], 10);
  const suit = token[1];
  const suitOffset: Record<string, number> = { m: 0, s: 9, p: 18 };
  if (suitOffset[suit] === undefined) throw new Error(`Unknown tile: ${token}`);
  return suitOffset[suit] + (rank - 1);
}

/** Parse a flat tile list into a 34-element counts array. */
function parseTiles(tiles: string): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles.trim().split(/\s+/)) counts[tileIndex(t)]++;
  return counts;
}

// ---------------------------------------------------------------------------
// Declared meld parser
// ---------------------------------------------------------------------------

const MELD_RE = /^(!?)([cpk])\(([^)]+)\)$/;

function parseMelds(melds: string[]): ScoringMeld[] {
  return melds.map(m => {
    const match = m.match(MELD_RE);
    if (!match) throw new Error(`Invalid meld notation: "${m}". Use c()/p()/k() for exposed, !k() for concealed kong.`);

    const concealed = match[1] === "!";
    const type = match[2] as "c" | "p" | "k";
    const tokens = match[3].trim().split(/\s+/);
    const indices = tokens.map(tileIndex);

    const meldType: "chow" | "pung" | "kong" =
      type === "c" ? "chow" : type === "p" ? "pung" : "kong";

    return { type: meldType, tileIndices: indices, concealed };
  });
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

interface TestContext {
  /** Which tile wins the hand (e.g. "3p", "Z", "E"). */
  winTile: string;
  /** How the win tile was obtained. Default: "selfDraw". */
  winSource?: "selfDraw" | "discard" | "kongDraw" | "robbingKong";
  /** Player's seat wind. Default: "east". */
  seatWind?: "east" | "south" | "west" | "north";
  /** Round wind. Default: "east". */
  roundWind?: "east" | "south" | "west" | "north";
  /** Whether this player is the dealer. Default: true. */
  isDealer?: boolean;
  /** Tiles remaining in the wall. Default: 40. */
  wallCount?: number;
  /** Number of bonus (flower) tiles. Default: 0. */
  bonusTileCount?: number;
  /** How many copies of the win tile are already visible. Default: 0. */
  winTileVisibleCount?: number;
}

function buildContext(tc: TestContext, declaredMeldCount: number): { winTileIdx: number; context: WinContext } {
  const winTileIdx = tileIndex(tc.winTile);
  return {
    winTileIdx,
    context: {
      winTile: winTileIdx,
      winSource: tc.winSource ?? "selfDraw",
      seatWind: tc.seatWind ?? "east",
      roundWind: tc.roundWind ?? "east",
      seatIndex: 0,
      isDealer: tc.isDealer ?? true,
      wallCount: tc.wallCount ?? 40,
      bonusTileCount: tc.bonusTileCount ?? 0,
      isKongDraw: (tc.winSource ?? "selfDraw") === "kongDraw",
      isRobbingKong: (tc.winSource ?? "selfDraw") === "robbingKong",
      declaredMeldCount,
      winTileVisibleCount: tc.winTileVisibleCount ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/**
 * Score a hand and assert the exact set of expected fan names.
 *
 * @param hand       Flat tile list in the closed hand (excluding the win tile).
 * @param melds      Declared melds (exposed or concealed kong), NOT in hand tiles.
 * @param expectedFans  Fan names. Repeat a name for multiple instances.
 * @param tc         Win tile, win source, seat/round wind, etc.
 */
function expectScore(
  hand: string,
  melds: string[],
  expectedFans: string[],
  tc: TestContext,
) {
  const counts = parseTiles(hand);
  const declaredMelds = parseMelds(melds);
  const { winTileIdx, context } = buildContext(tc, declaredMelds.length);
  counts[winTileIdx]++;
  const result = scoreHandFull(counts, declaredMelds, winTileIdx, context);

  expect(result.isWin).toBe(true);
  const scored = result.result!;

  // Build expected fan counts and total score
  const expectedCounts = new Map<string, number>();
  let expectedTotal = 0;
  for (const name of expectedFans) {
    expectedCounts.set(name, (expectedCounts.get(name) ?? 0) + 1);
    expectedTotal += fanScore(name);
  }

  // Build actual fan counts
  const actualCounts = new Map<string, number>();
  for (const f of scored.fans) {
    actualCounts.set(f.fan, (actualCounts.get(f.fan) ?? 0) + f.count);
  }

  // Compare and log on mismatch
  const expectedStr = [...expectedCounts].sort(([a], [b]) => a.localeCompare(b))
  .map(([n, c]) => c > 1 ? `${n}×${c}` : n).join(", ");
  const actualStr = [...actualCounts].sort(([a], [b]) => a.localeCompare(b))
  .map(([n, c]) => c > 1 ? `${n}×${c}` : n).join(", ");
  const match = expectedStr === actualStr && scored.fanScore === expectedTotal;
  if (!match) {
    console.log(`  expected: [${expectedStr}] = ${expectedTotal}`);
    console.log(`  actual:   [${actualStr}] = ${scored.fanScore}`);
  }

  // Check each expected fan is present with correct count
  for (const [name, count] of expectedCounts) {
    expect(actualCounts.get(name), `Expected fan "${name}" ×${count}`).toBe(count);
  }

  // Check no unexpected fans
  for (const [name] of actualCounts) {
    expect(expectedCounts.has(name), `Unexpected fan "${name}" scored`).toBe(true);
  }

  // Check total fan score
  expect(scored.fanScore).toBe(expectedTotal);
}

// ===========================================================================
// 88 番
// ===========================================================================

describe("88 fan", () => {

  // 大四喜: 4 wind pungs + pair
  it("大四喜1", () => {
    expectScore(
      "E E E S S S W W W N N N 9s",
      [],
      ["大四喜", "四暗刻", "混幺九", "混一色", "单钓将", "不求人"],
      { winTile: "9s" },
    );
  });
  it("大四喜2", () => {
    expectScore(
      "E E E S S S W W W N N N 9s",
      [],
      ["大四喜", "四暗刻", "混幺九", "混一色", "单钓将"],
      { winTile: "9s", winSource: "discard"},
    );
  });
  it("大四喜3", () => {
    expectScore(
      "S S S W W W N N N 9s",
      ["p(E E E)"],
      ["大四喜", "混幺九", "三暗刻", "混一色", "单钓将"],
      { winTile: "9s", winSource: "discard"},
    );
  });
  it("大四喜4", () => {
    expectScore(
      "S S S W W W N N N Z",
      ["p(E E E)"],
      ["大四喜", "字一色", "三暗刻", "单钓将"],
      { winTile: "Z", winSource: "discard"},
    );
  });

  // 大三元: 3 dragon pungs
  it("大三元1", () => {
    expectScore(
      "Z Z Z F F F B B B 1m 2m 3m 9s",
      [],
      ["大三元", "三暗刻", "全带幺九", "门前清", "缺一门", "单钓将"],
      { winTile: "9s", winSource: "discard" },
    );
  });
  it("大三元2", () => {
    expectScore(
      "Z Z Z F F F B B 1m 2m 3m 9s 9s",
      [],
      ["大三元", "全带幺九", "门前清", "双暗刻", "缺一门"],
      { winTile: "B", winSource: "discard" },
    );
  });
  it("大三元3", () => {
    expectScore(
      "Z Z Z F F F B B B E E N N",
      [],
      ["大三元", "字一色", "三暗刻", "圈风刻", "门风刻", "门前清"],
      { winTile: "E", winSource: "discard" },
    );
  });

  // 绿一色: all green tiles (2s 3s 4s 6s 8s F)
  it("绿一色1", () => {
    expectScore(
      "2s 3s 4s 4s 4s 4s 6s 6s 6s F F 8s 8s",
      [],
      ["绿一色", "箭刻", "门前清", "四归一", "双暗刻"],
      { winTile: "F", winSource: "discard" },
    );
  });
  it("绿一色2", () => {
    expectScore(
      "2s 2s 2s 3s 3s 3s 4s 4s 4s 8s 8s 6s 6s",
      [],
      ["绿一色", "清一色", "一色三节高", "三暗刻", "碰碰和", "门前清", "断幺九"],
      { winTile: "8s", winSource: "discard" },
    );
  });
  it("绿一色3", () => {
    expectScore(
      "3s 3s 3s 4s 4s 4s 8s 8s 6s 6s",
      ["p(2s 2s 2s)"],
      ["绿一色", "清一色", "一色三节高", "碰碰和", "双暗刻", "断幺九"],
      { winTile: "8s", winSource: "discard" },
    );
  });

  // 九莲宝灯: 1112345678999 + any same-suit tile
  it("九莲宝灯1", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "清龙", "四归一"], 
      { winTile: "9m", winSource: "discard" },
    );
  });
  it("九莲宝灯2", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "清龙", "四归一", "自摸"], 
      { winTile: "9m" },
    );
  });
  it("九莲宝灯3", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "双暗刻", "连六", "幺九刻"], 
      { winTile: "8m", winSource: "discard" },
    );
  });
  it("九莲宝灯4", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "双暗刻", "连六", "幺九刻", "自摸"], 
      { winTile: "8m" },
    );
  });
  it("九莲宝灯5", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "连六"], 
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("九莲宝灯6", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "连六", "自摸"], 
      { winTile: "7m" },
    );
  });
  it("九莲宝灯7", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "双暗刻", "幺九刻"], 
      { winTile: "5m", winSource: "discard" },
    );
  });
  it("九莲宝灯8", () => {
    expectScore(
      "1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m 9m",
      [],
      ["九莲宝灯", "双暗刻", "幺九刻", "自摸"], 
      { winTile: "5m" },
    );
  });
  it("九莲宝灯9", () => {
    expectScore(
      "1m 1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m",
      [],
      ["清一色", "清龙", "门前清", "四归一", "幺九刻"], 
      { winTile: "9m", winSource: "discard" },
    );
  });
  it("九莲宝灯10", () => {
    expectScore(
      "1m 1m 1m 1m 2m 3m 4m 5m 6m 7m 8m 9m 9m",
      [],
      ["清一色", "清龙", "不求人", "四归一", "幺九刻"], 
      { winTile: "9m" },
    );
  });

  // 四杠: 4 kongs (all exposed) + pair in hand
  it("四杠1", () => {
    expectScore(
      "7m",
      ["k(7s 7s 7s 7s)", "k(8m 8m 8m 8m)", "k(9p 9p 9p 9p)", "k(9s 9s 9s 9s)"],
      ["四杠", "全大", "三色三节高", "全求人", "双同刻", "幺九刻", "幺九刻"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("四杠2", () => {
    expectScore(
      "7m",
      ["k(7s 7s 7s 7s)", "!k(8m 8m 8m 8m)", "k(9p 9p 9p 9p)", "k(9s 9s 9s 9s)"],
      ["四杠", "全大", "三色三节高", "暗杠", "双同刻", "幺九刻", "幺九刻"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("四杠3", () => {
    expectScore(
      "7m",
      ["k(7s 7s 7s 7s)", "!k(8m 8m 8m 8m)", "!k(9p 9p 9p 9p)", "k(9s 9s 9s 9s)"],
      ["四杠", "全大", "三色三节高", "双暗杠", "双同刻", "幺九刻", "幺九刻"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("四杠4", () => {
    expectScore(
      "7m",
      ["k(7s 7s 7s 7s)", "!k(8m 8m 8m 8m)", "!k(9p 9p 9p 9p)", "k(9s 9s 9s 9s)"],
      ["四杠", "全大", "三色三节高", "双暗杠", "双同刻", "幺九刻", "幺九刻", "自摸"],
      { winTile: "7m" },
    );
  });
  it("四杠5", () => {
    expectScore(
      "W",
      ["k(1m 1m 1m 1m)", "k(1p 1p 1p 1p)", "k(1s 1s 1s 1s)", "k(F F F F)"],
      ["四杠", "混幺九", "三同刻", "五门齐", "全求人", "箭刻"],
      { winTile: "W", winSource: "discard" },
    );
  });
  it("四杠6", () => {
    expectScore(
      "W",
      ["k(1m 1m 1m 1m)", "k(1p 1p 1p 1p)", "k(1s 1s 1s 1s)", "k(F F F F)"],
      ["四杠", "混幺九", "三同刻", "五门齐", "箭刻", "自摸"],
      { winTile: "W" },
    );
  });
  it("四杠7", () => {
    expectScore(
      "W",
      ["!k(1m 1m 1m 1m)", "!k(1p 1p 1p 1p)", "!k(1s 1s 1s 1s)", "!k(F F F F)"],
      ["四杠", "四暗刻", "混幺九", "三同刻", "五门齐", "箭刻", "不求人"],
      { winTile: "W" },
    );
  });
  it("四杠8", () => {
    expectScore(
      "W",
      ["!k(1m 1m 1m 1m)", "!k(1p 1p 1p 1p)", "!k(1s 1s 1s 1s)", "!k(F F F F)"],
      ["四杠", "四暗刻", "混幺九", "三同刻", "五门齐", "箭刻"],
      { winTile: "W", winSource: "discard" },
    );
  });

  // 连七对: 7 consecutive pairs in one suit
  it("连七对1", () => {
    expectScore(
      "1m 1m 2m 2m 3m 3m 4m 4m 5m 5m 6m 6m 7m",
      [],
      ["连七对"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("连七对2", () => {
    expectScore(
      "2m 2m 3m 3m 4m 4m 5m 5m 6m 6m 7m 7m 8m",
      [],
      ["连七对", "自摸", "断幺九"],
      { winTile: "8m" },
    );
  });

  // 十三幺: 13 orphans + 1 duplicate
  it("十三幺1", () => {
    expectScore(
      "1m 1m 1p 9p 1s 9s E S W N Z F B",
      [],
      ["十三幺", "自摸"],
      { winTile: "9m" },
    );
  });
  it("十三幺2", () => {
    expectScore(
      "1m 1m 1p 9p 1s 9s E S W N Z F B",
      [],
      ["十三幺"],
      { winTile: "9m", winSource: "discard" },
    );
  });
  it("十三幺3", () => {
    expectScore(
      "1m 9m 1p 9p 1s 9s E S W N Z F B",
      [],
      ["十三幺"],
      { winTile: "1m", winSource: "discard" },
    );
  });
});

// ===========================================================================
// 64 番
// ===========================================================================

describe("64 fan", () => {

  // 清幺九: all terminal (1/9) pungs only, no honors
  it("清幺九1", () => {
    expectScore(
      "1m 1m 1m 1p 1p 1p 9m 9m 9m 9s 9s 9s 1s",
      [],
      ["清幺九", "四暗刻", "双同刻", "单钓将", "不求人"],
      { winTile: "1s" },
    );
  });
  it("清幺九2", () => {
    expectScore(
      "1m 1m 1p 1p 1s 1s 9m 9m 9p 9p 9s 9s 9s",
      [],
      ["清幺九", "七对", "不求人"],
      { winTile: "9s" },
    );
  });
  it("清幺九3", () => {
    expectScore(
      "1m 1m 1p 1p 1s 1s 9m 9m 9p 9p 9s 9s 9s",
      [],
      ["清幺九", "七对"],
      { winTile: "9s", winSource: "discard"},
    );
  });

  // 小四喜: 3 wind pungs + wind pair
  it("小四喜1", () => {
    expectScore(
      "E E E S S S W W W 9s 9s N N",
      [],
      ["小四喜", "四暗刻", "混幺九", "混一色", "圈风刻", "门风刻", "不求人"],
      { winTile: "9s" },
    );
  });
  it("小四喜2", () => {
    expectScore(
      "S S S W W W 9s 9s N N",
      ["p(E E E)"],
      ["小四喜", "混幺九", "混一色", "三暗刻", "圈风刻", "门风刻", "自摸"],
      { winTile: "9s" },
    );
  });
  it("小四喜3", () => {
    expectScore(
      "W W W 9s 9s N N",
      ["p(E E E)", "p(S S S)"],
      ["小四喜", "混幺九", "混一色", "双暗刻", "门风刻", "自摸"],
      { winTile: "9s", roundWind: "north"},
    );
  });
  it("小四喜4", () => {
    expectScore(
      "W W W 9s 9s N N",
      ["p(E E E)", "p(S S S)"],
      ["小四喜", "混幺九", "混一色", "门风刻"],
      { winTile: "9s", roundWind: "north", winSource: "discard"},
    );
  });
  it("小四喜5", () => {
    expectScore(
      "9s 9s N N",
      ["p(E E E)", "p(S S S)", "p(W W W)"],
      ["小四喜", "混幺九", "混一色", "自摸"],
      { winTile: "9s", roundWind: "north", seatWind: "north"},
    );
  });
  it("小四喜6", () => {
    expectScore(
      "8s 8s N N",
      ["p(E E E)", "p(S S S)", "p(W W W)"],
      ["小四喜", "碰碰和", "混一色", "自摸"],
      { winTile: "8s", roundWind: "north", seatWind: "north"},
    );
  });

  // 小三元: 2 dragon pungs + dragon pair
  it("小三元1", () => {
    expectScore(
      "Z Z Z F F F 1p 1p 1p 1s 1s 1s B",
      [],
      ["小三元", "四暗刻", "混幺九", "不求人", "双同刻", "缺一门", "单钓将"],
      { winTile: "B" },
    );
  });
  it("小三元2", () => {
    expectScore(
      "Z Z Z F F F 1p 2p 3p 7p 8p 9p B",
      [],
      ["小三元", "混一色", "全带幺九", "双暗刻", "老少副", "不求人", "单钓将"],
      { winTile: "B" },
    );
  });
  it("小三元3", () => {
    expectScore(
      "Z Z Z F F F 1p 2p 3p 4s 5s 6s B",
      [],
      ["小三元", "双暗刻", "缺一门", "不求人", "单钓将"],
      { winTile: "B" },
    );
  });
  it("小三元4", () => {
    expectScore(
      "F F F 1p 2p 3p 4p 5p 6p B",
      ["p(Z Z Z)"],
      ["小三元", "混一色", "连六", "单钓将", "自摸"],
      { winTile: "B" },
    );
  });

  // 字一色: all honor tiles
  it("字一色1", () => {
    expectScore(
      "E E E S S Z Z Z F F F W W",
      [],
      ["字一色", "三暗刻", "双箭刻", "圈风刻", "门风刻", "门前清"],
      { winTile: "S", winSource: "discard" },
    );
  });
  it("字一色2", () => {
    expectScore(
      "S S W W",
      ["p(E E E)", "p(Z Z Z)", "p(F F F)"],
      ["字一色", "双箭刻", "圈风刻", "门风刻"],
      { winTile: "S", winSource: "discard" },
    );
  });
  it("字一色3", () => {
    expectScore(
      "S S W W",
      ["p(E E E)", "p(Z Z Z)", "p(F F F)"],
      ["字一色", "双箭刻", "圈风刻", "门风刻", "自摸"],
      { winTile: "S" },
    );
  });

  // 四暗刻: 4 concealed pungs, self-draw
  it("四暗刻1", () => {
    expectScore(
      "1m 1m 1m 5p 5p 5p 9s 9s 9s 3m 3m 3m 7p",
      [],
      ["四暗刻", "幺九刻", "幺九刻", "无字", "不求人"],
      { winTile: "7p" },
    );
  });
  it("四暗刻2", () => {
    expectScore(
      "1m 1m 1m 5p 5p 5p 9s 9s 9s 3m 3m 3m 7p",
      [],
      ["四暗刻", "幺九刻", "幺九刻", "无字"],
      { winTile: "7p", winSource: "discard" },
    );
  });
  it("四暗刻3", () => {
    expectScore(
      "7p",
      ["!k(1m 1m 1m 1m)", "!k(5p 5p 5p 5p)", "!k(9s 9s 9s 9s)", "!k(6s 6s 6s 6s)"],
      ["四杠", "四暗刻", "幺九刻", "幺九刻", "无字"],
      { winTile: "7p", winSource: "discard" },
    );
  });
  it("四暗刻4", () => {
    expectScore(
      "7p",
      ["!k(1m 1m 1m 1m)", "!k(5p 5p 5p 5p)", "!k(9s 9s 9s 9s)", "!k(6s 6s 6s 6s)"],
      ["四杠", "四暗刻", "不求人", "幺九刻", "幺九刻", "无字"],
      { winTile: "7p" },
    );
  });
  it("四暗刻5", () => {
    expectScore(
      "7p 1m 1m 1m",
      ["!k(5p 5p 5p 5p)", "!k(9s 9s 9s 9s)", "!k(6s 6s 6s 6s)"],
      ["四暗刻", "三杠", "不求人", "幺九刻", "幺九刻", "无字", "单钓将"],
      { winTile: "7p" },
    );
  });
  it("四暗刻6", () => {
    expectScore(
      "7p 1m 1m 1m 5p 5p 5p",
      ["!k(9s 9s 9s 9s)", "!k(6s 6s 6s 6s)"],
      ["四暗刻", "双暗杠", "不求人", "幺九刻", "幺九刻", "无字"],
      { winTile: "7p" },
    );
  });
  it("四暗刻7", () => {
    expectScore(
      "7p 1m 1m 1m 5p 5p 5p 9s 9s 9s",
      ["!k(6s 6s 6s 6s)"],
      ["四暗刻", "暗杠", "不求人", "幺九刻", "幺九刻", "无字"],
      { winTile: "7p" },
    );
  });

  // 一色双龙会: same suit 123+789+123+789 + 55 pair
  it("一色双龙会1", () => {
    expectScore(
      "1s 2s 3s 7s 8s 9s 1s 2s 3s 7s 8s 5s 5s",
      [],
      ["一色双龙会", "不求人"],
      { winTile: "9s" },
    );
  });
  it("一色双龙会2", () => {
    expectScore(
      "1s 2s 3s 7s 8s 9s 1s 2s 3s 7s 8s 5s 5s",
      [],
      ["一色双龙会", "门前清"],
      { winTile: "9s", winSource: "discard" },
    );
  });
  it("一色双龙会3", () => {
    expectScore(
      "1s 2s 3s 7s 8s 9s 1s 2s 3s 7s 8s 9s 5s",
      [],
      ["一色双龙会", "门前清", "单钓将"],
      { winTile: "5s", winSource: "discard" },
    );
  });
});

// ===========================================================================
// 48 番
// ===========================================================================

describe("48 fan", () => {

  // 一色四同顺: 4 identical chows in same suit
  it("一色四同顺1", () => {
    expectScore(
      "2s 3s 4s 2s 3s 4s 2s 3s 4s 2s 3s 4s 8s",
      [],
      ["绿一色", "一色四同顺", "清一色", "不求人", "平和", "断幺九", "单钓将"],
      { winTile: "8s" },
    );
  });
  it("一色四同顺2", () => {
    expectScore(
      "2s 3s 4s 2s 3s 4s 2s 3s 4s 2s 3s 8s 8s",
      [],
      ["绿一色", "一色四同顺", "清一色", "门前清", "平和", "断幺九"],
      { winTile: "4s", winSource: "discard" },
    );
  });
  it("一色四同顺3", () => {
    expectScore(
      "2s 3s 4s 2s 3s 4s 2s 3s 8s 8s",
      ["c(2s 3s 4s)"],
      ["绿一色", "一色四同顺", "清一色", "平和", "断幺九"],
      { winTile: "4s", winSource: "discard" },
    );
  });

  // 一色四节高: 4 consecutive pungs in same suit (e.g. 1p 2p 3p 4p)
  it("一色四节高1", () => {
    expectScore(
      "1p 1p 1p 2p 2p 2p 3p 3p 3p 4p 4p 4p 2s",
      [],
      ["四暗刻", "一色四节高", "小于五", "推不倒", "不求人", "幺九刻", "单钓将"],
      { winTile: "2s" },
    );
  });
  it("一色四节高2", () => {
    expectScore(
      "4p 4p 4p 2s",
      ["p(1p 1p 1p)", "p(2p 2p 2p)", "p(3p 3p 3p)"],
      ["一色四节高", "小于五", "推不倒", "自摸", "幺九刻", "单钓将"],
      { winTile: "2s" },
    );
  });
  it("一色四节高3", () => {
    expectScore(
      "4p 4p 2s 2s",
      ["p(1p 1p 1p)", "p(2p 2p 2p)", "p(3p 3p 3p)"],
      ["一色四节高", "小于五", "推不倒", "自摸", "幺九刻"],
      { winTile: "4p" },
    );
  });
  it("一色四节高4", () => {
    expectScore(
      "2s",
      ["p(1p 1p 1p)", "p(2p 2p 2p)", "p(3p 3p 3p)", "p(4p 4p 4p)"],
      ["一色四节高", "小于五", "推不倒", "全求人", "幺九刻"],
      { winTile: "2s", winSource: "discard" },
    );
  });
});

// ===========================================================================
// 32 番
// ===========================================================================

describe("32 fan", () => {

  // 一色四步高: 4 chows stepping +1 in same suit
  it("一色四步高1", () => {
    expectScore(
      "2m 3m 4m 3m 4m 5m 4m 5m 6m 5m 6m N N",
      [],
      ["一色四步高", "混一色", "不求人"],
      { winTile: "7m" },
    );
  });
  it("一色四步高2", () => {
    expectScore(
      "2m 3m 4m 3m 4m 5m 4m 5m 6m 5m 7m N N",
      [],
      ["一色四步高", "混一色", "门前清"],
      { winTile: "6m", winSource: "discard" },
    );
  });
  // 一色四步高: 4 chows stepping +2 in same suit
  it("一色四步高3", () => {
    expectScore(
      "1p 2p 3p 3p 4p 5p 5p 6p 7p 7p 8p 9p 9s",
      [],
      ["一色四步高", "不求人", "平和", "缺一门", "单钓将"],
      { winTile: "9s" },
    );
  });
  it("一色四步高4", () => {
    expectScore(
      "1p 3p 3p 4p 5p 5p 6p 7p 7p 8p 9p 9s 9s",
      [],
      ["一色四步高", "门前清", "平和", "缺一门", "坎张"],
      { winTile: "2p", winSource: "discard" },
    );
  });
  it("一色四步高5", () => {
    expectScore(
      "1p 2p 3p 4p 5p 5p 6p 7p 7p 8p 9p 9s 9s",
      [],
      ["一色四步高", "门前清", "平和", "缺一门"],
      { winTile: "3p", winSource: "discard" },
    );
  });

  // 三杠: 3 kongs
  it("三杠1", () => {
    expectScore(
      "1m 2m 4p 4p",
      ["k(2s 2s 2s 2s)", "!k(3p 3p 3p 3p)", "k(4m 4m 4m 4m)"],
      ["三杠", "小于五", "三色三节高", "边张", "自摸"],
      { winTile: "3m" },
    );
  });
  it("三杠2", () => {
    expectScore(
      "1m 2m 4p 4p",
      ["k(2s 2s 2s 2s)", "k(3p 3p 3p 3p)", "k(4m 4m 4m 4m)"],
      ["三杠", "小于五", "三色三节高", "边张", "自摸"],
      { winTile: "3m" },
    );
  });
  it("三杠3", () => {
    expectScore(
      "1m 2m 4p 4p",
      ["k(2s 2s 2s 2s)", "!k(3p 3p 3p 3p)", "!k(4m 4m 4m 4m)"],
      ["三杠", "小于五", "三色三节高", "双暗刻", "边张", "自摸"],
      { winTile: "3m" },
    );
  });

  // 混幺九: terminals + honors, all pungs/pairs
  it("混幺九1", () => {
    expectScore(
      "1m 1m 1m 1p 1p 1p 1s 1s 1s B B E E",
      [],
      ["四暗刻", "混幺九", "三同刻", "五门齐", "不求人", "箭刻"],
      { winTile: "B" },
    );
  });
  it("混幺九2", () => {
    expectScore(
      "1m 1m 1p 1p 9p 9p E E E E S S F",
      [],
      ["混幺九", "七对", "四归一", "缺一门"],
      { winTile: "F", winSource: "discard" },
    );
  });
});

// ===========================================================================
// 24 番
// ===========================================================================

describe("24 fan", () => {

  // 七对: 7 pairs
  it("七对1", () => {
    expectScore(
      "1m 1m 6m 6m 7m 7m 4p 4p 9s 9s S S F",
      [],
      ["七对", "五门齐", "不求人"],
      { winTile: "F" },
    );
  });
  it("七对2", () => {
    expectScore(
      "1m 1m 6m 6m 7m 7m 4p 4p 9s 9s S S F",
      [],
      ["七对", "五门齐"],
      { winTile: "F", winSource: "discard" },
    );
  });
  it("七对3", () => {
    expectScore(
      "2s 2s 2s 2s 4s 4s 4s 4s 6s 6s 6s 8s 8s",
      [],
      ["绿一色", "七对", "清一色", "推不倒", "断幺九"],
      { winTile: "6s", winSource: "discard" },
    );
  });

  // 七星不靠: 7 honors + 7 suited tiles (knitted pattern)
  it("七星不靠1", () => {
    expectScore(
      "1m 4m 2s 8s 3p 6p 9p E S W N Z F",
      [],
      ["七星不靠", "自摸"],
      { winTile: "B" },
    );
  });
  it("七星不靠2", () => {
    expectScore(
      "1m 4m 2s 8s 3p 6p E S W N Z F B",
      [],
      ["七星不靠"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("七星不靠3", () => {
    expectScore(
      "4s 7s 2p 8p 6m 9m E S W N Z F B",
      [],
      ["七星不靠"],
      { winTile: "5p", winSource: "discard" },
    );
  });

  // 全双刻: all even-number pungs
  it("全双刻1", () => {
    expectScore(
      "2m 2m 2m 8p 8p 8p 6s 6s 6s 8s 8s 8s 4s",
      [],
      ["四暗刻", "全双刻", "不求人", "双同刻"],
      { winTile: "4s" },
    );
  });
  it("全双刻2", () => {
    expectScore(
      "2p 2p 2p 8p 8p 8p 6s 6s 6s 8s 8s 8s 4s",
      [],
      ["四暗刻", "全双刻", "推不倒", "不求人", "双同刻"],
      { winTile: "4s" },
    );
  });
  it("全双刻3", () => {
    expectScore(
      "6s 6s 6s 8s 8s 8s 4s",
      ["p(2p 2p 2p)", "p(8p 8p 8p)"],
      ["双暗刻", "全双刻", "推不倒", "自摸", "双同刻"],
      { winTile: "4s" },
    );
  });
  it("全双刻4", () => {
    expectScore(
      "8s 8s 8s 4s",
      ["p(2p 2p 2p)", "p(8p 8p 8p)", "p(6s 6s 6s)"],
      ["单钓将", "全双刻", "推不倒", "自摸", "双同刻"],
      { winTile: "4s" },
    );
  });

  // 清一色: all one suit
  it("清一色1", () => {
    expectScore(
      "1m 2m 3m 1m 2m 3m 4m 5m 6m 7m 8m 9m 1m",
      [],
      ["清一色", "清龙", "不求人", "平和", "四归一", "一般高"],
      { winTile: "1m" },
    );
  });
  it("清一色2", () => {
    expectScore(
      "1m 2m 3m 1m 2m 3m 4m 5m 6m 7m 8m 9m 1m",
      [],
      ["清一色", "清龙", "门前清", "平和", "四归一", "一般高"],
      { winTile: "1m", winSource: "discard" },
    );
  });
  it("清一色3", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 7m 8m 9m 1m",
      ["c(1m 2m 3m)"],
      ["清一色", "清龙", "平和", "四归一", "一般高"],
      { winTile: "1m", winSource: "discard" },
    );
  });
  it("清一色4", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 7m 8m 9m 1m",
      ["p(2m 2m 2m)"],
      ["清一色", "清龙", "四归一"],
      { winTile: "1m", winSource: "discard" },
    );
  });

  // 一色三同顺: 3 identical chows
  it("一色三同顺1", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1m 2m 3m 1m",
      ["c(1p 2p 3p)"],
      ["一色三同顺", "全小", "全带幺九", "平和", "喜相逢", "缺一门", "自摸"],
      { winTile: "1m" },
    );
  });
  it("一色三同顺2", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1m 2m 1m 1m",
      ["c(1p 2p 3p)"],
      ["一色三同顺", "全小", "全带幺九", "平和", "喜相逢", "缺一门", "自摸"],
      { winTile: "3m" },
    );
  });
  it("一色三同顺3", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1m 3m 1m 1m",
      ["c(1p 2p 3p)"],
      ["一色三同顺", "全小", "全带幺九", "平和", "喜相逢", "缺一门", "自摸"],
      { winTile: "2m" },
    );
  });
  it("一色三同顺4", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1m 2m 9m 9m",
      ["c(1p 2p 3p)"],
      ["一色三同顺", "全带幺九", "平和", "喜相逢", "缺一门", "边张", "自摸"],
      { winTile: "3m" },
    );
  });

  // 一色三节高: 3 consecutive pungs
  it("一色三节高1", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1p 2p 3p 1m 2m 3m 1m",
      [],
      ["一色三节高", "全小", "三暗刻", "不求人", "幺九刻", "缺一门"],
      { winTile: "1m" },
    );
  });
  it("一色三节高2", () => {
    expectScore(
      "1p 2p 1p 2p 1p 2p 1m 2m 3m 1m",
      ["p(3p 3p 3p)"],
      ["一色三节高", "全小", "双暗刻", "自摸", "幺九刻", "缺一门"],
      { winTile: "1m" },
    );
  });
  it("一色三节高3", () => {
    expectScore(
      "1p 1p 1p 1m 2m 3m 1m",
      ["p(3p 3p 3p)", "p(2p 2p 2p)"],
      ["一色三节高", "全小", "自摸", "幺九刻", "缺一门"],
      { winTile: "1m" },
    );
  });
  it("一色三节高4", () => {
    expectScore(
      "5s 5s 5s 6s 6s 6s 7s 7s 7s 7s 8s 9s Z",
      [],
      ["一色三节高", "三暗刻", "混一色", "不求人", "四归一", "单钓将"],
      { winTile: "Z" },
    );
  });
  it("一色三节高5", () => {
    expectScore(
      "5s 5s 5s 6s 6s 6s 7s 7s 7s 8s 9s Z Z",
      [],
      ["一色三节高", "三暗刻", "混一色", "门前清", "四归一"],
      { winTile: "7s", winSource: "discard" },
    );
  });
  it("一色三节高6", () => {
    expectScore(
      "2p 2p 2p 3p 3p 3p 4p 4p 9p 9p 2s 3s 4s",
      [],
      ["一色三节高", "三暗刻", "不求人", "缺一门", "无字"],
      { winTile: "4p" },
    );
  });

  // 全大: all 7/8/9 tiles
  it("全大1?", () => {
    expectScore(
      "7m 8m 9m 7p 8p 9p 7s 8s 9s 7m 8m 9m 9p",
      [],
      ["全大", "三色三同顺", "全带幺九", "不求人", "平和", "一般高"],
      // ["全大", "三色三同顺", "全带幺九", "不求人", "平和", "喜相逢"],
      { winTile: "9p" },
    );
  });
  it("全大2?", () => {
    expectScore(
      "7m 8m 9m 7p 8p 9p 7s 8s 9s 8m 9m 9p 9p",
      [],
      ["全大", "三色三同顺", "全带幺九", "门前清", "平和", "一般高", "边张"],
      { winTile: "7m", winSource: "discard" },
    );
  });
  it("全大3?", () => {
    expectScore(
      "7m 8m 9m 7p 8p 9p 7s 8s 9s 7m 9m 9p 9p",
      [],
      ["全大", "三色三同顺", "全带幺九", "门前清", "平和", "一般高", "坎张"],
      { winTile: "8m", winSource: "discard" },
    );
  });

  // 全中: all 4/5/6 tiles
  it("全中1", () => {
    expectScore(
      "4p 4p 4p 5s 5s 5s 6m 6m 6m 4s 4s 4s 6p",
      [],
      ["四暗刻", "全中", "三色三节高", "不求人", "双同刻"],
      { winTile: "6p" },
    );
  });
  it("全中2", () => {
    expectScore(
      "6m 6m 6p 4s 4s 4s 6p",
      ["p(4p 4p 4p)", "p(5s 5s 5s)"],
      ["全中", "三色三节高", "碰碰和", "双同刻", "双暗刻", "自摸"],
      { winTile: "6m" },
    );
  });

  // 全小: all 1/2/3 tiles
  it("全小1", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1p 2p 3p 1p 2p 3p 1m",
      [],
      ["一色四同顺", "全小", "全带幺九", "不求人", "平和", "缺一门", "单钓将"],
      { winTile: "1m" },
    );
  });
  it("全小2", () => {
    expectScore(
      "1p 2p 3p 1p 2p 3p 1m",
      ["c(1p 2p 3p)", "c(1p 2p 3p)"],
      ["一色四同顺", "全小", "全带幺九", "平和", "缺一门", "单钓将"],
      { winTile: "1m", winSource: "discard" },
    );
  });
});

// ===========================================================================
// 16 番
// ===========================================================================

describe("16 fan", () => {

  // 清龙: 1-9 straight in one suit
  it("清龙1", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 8s",
      [],
      ["清龙", "不求人", "平和", "喜相逢", "缺一门", "单钓将"],
      { winTile: "8s" },
    );
  });
  it("清龙2", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 7m 8m 8s 8s",
      ["c(1s 2s 3s)"],
      ["清龙", "平和", "喜相逢", "缺一门"],
      { winTile: "9m", winSource: "discard" },
    );
  });

  // 三色双龙会: 2 suits 123+789, third suit 55 pair
  it("三色双龙会1", () => {
    expectScore(
      "1m 2m 3m 7m 8m 9m 1s 2s 3s 7s 8s 9s 5p",
      [],
      ["三色双龙会", "不求人", "单钓将"],
      { winTile: "5p" },
    );
  });
  it("三色双龙会2", () => {
    expectScore(
      "1m 2m 3m 1s 2s 3s 8s 9s 5p 5p",
      ["c(7m 8m 9m)"],
      ["三色双龙会", "边张"],
      { winTile: "7s", winSource: "discard" },
    );
  });

  // 一色三步高 (+1): 3 chows stepping +1
  it("一色三步高1", () => {
    expectScore(
      "3p 4p 5p 4p 5p 6p 5p 6p 7p 2m 3m 4m 9s",
      [],
      ["一色三步高", "不求人", "平和", "单钓将"],
      { winTile: "9s" },
    );
  });
  // 一色三步高 (+2): 3 chows stepping +2
  it("一色三步高2", () => {
    expectScore(
      "1s 2s 3s 4s 5s 2m 3m 4m 9p 9p",
      ["c(5s 6s 7s)"],
      ["一色三步高", "平和"],
      { winTile: "3s", winSource: "discard" },
    );
  });

  // 全带五: every meld and pair contains a 5
  it("全带五", () => {
    expectScore(
      "4m 5m 6m 4p 5p 6p 3s 4s 5s 5s 6s 7s 5s",
      [],
      ["全带五", "不求人", "平和", "四归一", "喜相逢"],
      { winTile: "5s" },
    );
  });

  // 三同刻: same-number pungs in 3 suits
  it("三同刻1", () => {
    expectScore(
      "4m 4m 4m 4p 4p 4p 4s 4s 4s 6s 6s 6m 6m",
      [],
      ["四暗刻", "全双刻", "全中", "三同刻", "不求人"],
      { winTile: "6s" },
    );
  });
  it("三同刻2", () => {
    expectScore(
      "4s 4s 4s 6s 6s 6m 6m",
      ["p(4m 4m 4m)", "k(4p 4p 4p 4p)"],
      ["全双刻", "全中", "三同刻", "双暗刻", "明杠", "自摸"],
      { winTile: "6s" },
    );
  });

  // 三暗刻: 3 concealed pungs (self-draw to avoid discard exclusion)
  it.skip("三暗刻", () => {
    expectScore(
      "1m 1m 1m 5p 5p 5p 9s 9s 9s 3m 4m 5m 7p 7p",
      [],
      [], // TODO
      { winTile: "7p" },
    );
  });
});

// ===========================================================================
// 12 番
// ===========================================================================

describe("12 fan", () => {

  // 全不靠: all unrelated (knitted suited + honors)
  it("全不靠1", () => {
    expectScore(
      "1m 4m 7m 2p 5p 8p 3s 6s 9s E S W N",
      [],
      ["全不靠", "组合龙", "不求人"],
      { winTile: "Z" },
    );
  });
  it("全不靠2", () => {
    expectScore(
      "1m 4m 7m 2p 5p 3s 6s 9s E S W N F",
      [],
      ["全不靠"],
      { winTile: "Z", winSource: "discard" },
    );
  });

  // 组合龙: knitted 147/258/369 across suits + 1 meld + pair
  it("组合龙1", () => {
    expectScore(
      "1m 4m 7m 2s 5s 8s 3p 6p 9p 6m 7m 8m 9s",
      [],
      ["组合龙", "不求人", "平和", "单钓将"],
      { winTile: "9s" },
    );
  });
  it("组合龙2", () => {
    expectScore(
      "1p 4p 7p 2m 5m 8m 3s 9s 9s 9s",
      ["c(6m 7m 8m)"],
      ["组合龙", "平和", "自摸"],
      { winTile: "6s" },
    );
  });
  it("组合龙3", () => {
    expectScore(
      "1m 4m 7m 2s 5s 8s 3p 6p 9p Z Z W W",
      [],
      ["组合龙", "五门齐", "箭刻", "门前清"],
      { winTile: "Z", winSource: "discard" },
    );
  });

  // 大于五: all tiles 6-9
  it("大于五", () => {
    expectScore(
      "6m 7m 8m 6p 7p 8p 6m 7m 8m 9p",
      ["c(6s 7s 8s)"],
      ["大于五", "三色三同顺", "平和", "一般高", "自摸"],
      { winTile: "9p" },
    );
  });

  // 小于五: all tiles 1-4
  it("小于五1", () => {
    expectScore(
      "1p 1p 1p 2p 2p 2p 3p 3p 3p 3p 4p 4p 4p",
      [],
      ["清一色", "一色三节高", "三暗刻", "小于五", "推不倒", "不求人", "四归一", "四归一", "幺九刻"],
      { winTile: "2p" },
    );
  });
  it("小于五2", () => {
    expectScore(
      "2p 2p 2p 3p 3p 3p 2p 3p 4p 4p",
      ["p(1p 1p 1p)"],
      ["清一色", "一色三节高", "双暗刻", "小于五", "推不倒", "四归一", "四归一", "幺九刻"],
      { winTile: "4p", winSource: "discard" },
    );
  });

  // 三风刻: 3 wind pungs
  it("三风刻1", () => {
    expectScore(
      "E E E S S W W W F F F B B",
      [],
      ["字一色", "四暗刻", "三风刻", "不求人", "箭刻", "圈风刻", "门风刻"],
      { winTile: "S" },
    );
  });
  it("三风刻2", () => {
    expectScore(
      "S S W W W B B",
      ["p(F F F)", "p(E E E)"],
      ["字一色", "三风刻", "箭刻", "门风刻"],
      { winTile: "S", roundWind: "north", seatWind: "south", winSource: "discard"},
    );
  });
});

// ===========================================================================
// 8 番
// ===========================================================================

describe("8 fan", () => {

  // 花龙: 3 suits forming 1-9
  it("花龙1", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 1p 2p Z Z",
      [],
      ["花龙", "不求人", "喜相逢", "边张"],
      { winTile: "3p" },
    );
  });
  it("花龙2", () => {
    expectScore(
      "4p 6p 7s 8s 9s 2p 2p",
      ["c(1m 2m 3m)", "c(1p 2p 3p)"],
      ["花龙", "平和", "喜相逢", "坎张"],
      { winTile: "5p", winSource: "discard" },
    );
  });

  // 推不倒: symmetric tiles only (1/2/3/4/5/8/9p, 2/4/5/6/8/9s, B)
  it("推不倒1", () => {
    expectScore(
      "3p 4p 5p 9p 9p 9p 4s 5s 6s 9s 9s 9s 3p",
      [],
      ["推不倒", "不求人", "双同刻", "双暗刻", "幺九刻", "幺九刻", "无字"],
      { winTile: "3p" },
    );
  });
  it("推不倒2", () => {
    expectScore(
      "3p 4p 5p 4s 5s 6s 9s 9s 9s 3p",
      ["p(9p 9p 9p)"],
      ["推不倒", "双同刻", "幺九刻", "幺九刻", "无字"],
      { winTile: "3p", winSource: "discard" },
    );
  });
  it("推不倒2", () => {
    expectScore(
      "1p 1p 2p 2p 3p 3p 4p 4p 5p 5p 8p 8p 9p",
      [],
      ["推不倒", "七对", "清一色", "不求人"],
      { winTile: "9p" },
    );
  });

  // 三色三同顺: same-number chows in 3 suits
  it("三色三同顺", () => {
    expectScore(
      "1m 2m 3m 1p 2p 3p 1s 2s 3s 4s 5s 6s 7m",
      [],
      ["三色三同顺", "不求人", "平和", "连六", "单钓将"],
      { winTile: "7m" },
    );
  });

  // 三色三节高: consecutive pungs across 3 suits
  it("三色三节高1", () => {
    expectScore(
      "7m 7m 7m 9s 9s 9p 9p",
      ["p(8p 8p 8p)", "p(8m 8m 8m)"],
      ["全大", "三色三节高", "碰碰和", "双同刻", "双暗刻", "自摸", "幺九刻"],
      { winTile: "9s" },
    );
  });
  it("三色三节高2", () => {
    expectScore(
      "9m 9m 9m 8s 8s 8s E",
      ["p(7p 7p 7p)", "p(6m 6m 6m)"],
      ["单钓将", "三色三节高", "碰碰和", "双暗刻", "自摸", "幺九刻"],
      { winTile: "E" },
    );
  });

  // 无番和: no other fans (needs exposed melds, mixed suits, honor pair, discard win)
  it("无番和1", () => {
    expectScore(
      "1m 2m 3m 7s 8s B B",
      ["c(3m 4m 5m)", "p(2p 2p 2p)"],
      ["无番和"],
      { winTile: "6s", winSource: "discard", bonusTileCount: 2 },
    );
  });
  it("无番和2", () => {
    expectScore(
      "1m 2m 3m 7s 8s B B",
      ["c(3m 4m 5m)", "p(2p 2p 2p)"],
      ["无番和"],
      { winTile: "9s", winSource: "discard" },
    );
  });

  // 妙手回春: self-draw the very last wall tile (wallCount=0)
  it("妙手回春1", () => {
    expectScore(
      "1m 2m 3m 2p 3p 4p 7s 8s 9s 2p 3p E E",
      [],
      ["妙手回春", "不求人", "一般高"],
      { winTile: "4p", wallCount: 0 },
    );
  });
  it("妙手回春1", () => {
    expectScore(
      "1m 2m 3m 2p 3p 4p 2p 4p E E",
      ["c(3s 4s 5s)"],
      ["妙手回春", "三色三步高", "一般高", "坎张"],
      { winTile: "3p", wallCount: 0 },
    );
  });

  // 海底捞月: win on last discard (wall exhausted)
  it("海底捞月", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p E E",
      [],
      ["花龙", "门前清", "海底捞月"],
      { winTile: "4p", winSource: "discard", wallCount: 0 },
    );
  });

  // 杠上开花: win by drawing after a kong
  it("杠上开花1", () => {
    expectScore(
      "1m 2m 3m 4p 5p 7p 7p",
      ["k(9s 9s 9s 9s)", "p(E E E)"],
      ["杠上开花", "圈风刻", "门风刻", "幺九刻", "明杠"],
      { winTile: "6p", winSource: "kongDraw" },
    );
  });
  it("杠上开花2", () => {
    expectScore(
      "1m 2m 3m 4p 5p 7p 7p",
      ["!k(9s 9s 9s 9s)", "p(E E E)"],
      ["杠上开花", "圈风刻", "门风刻", "幺九刻", "暗杠"],
      { winTile: "6p", winSource: "kongDraw" },
    );
  });

  // 抢杠和: robbing another player's kong
  it("抢杠和", () => {
    expectScore(
      "1m 2m 3m 4p 5p 7p 7p",
      ["c(7s 8s 9s)", "p(N N N)"],
      ["花龙", "抢杠和"],
      { winTile: "6p", winSource: "robbingKong" },
    );
  });
});

// ===========================================================================
// 6 番
// ===========================================================================

describe("6 fan", () => {

  // 碰碰和: all 4 melds are pungs
  it("碰碰和1", () => {
    expectScore(
      "3p 3p 3p 4p 4p 4p 5p 5p 5p B",
      ["p(5s 5s 5s)"],
      ["一色三节高", "三暗刻", "推不倒", "双同刻", "碰碰和", "单钓将"],
      { winTile: "B", winSource: "discard" },
    );
  });
  it("碰碰和2", () => {
    expectScore(
      "4p 4p 4p 5p 5p B B",
      ["p(5s 5s 5s)", "p(3p 3p 3p)"],
      ["一色三节高", "碰碰和", "双同刻", "双暗刻", "推不倒", "自摸"],
      { winTile: "5p" },
    );
  });

  // 混一色: one suit + honors
  it("混一色", () => {
    expectScore(
      "1m 2m 3m 5m 5m 5m 7m 8m 9m Z Z Z E",
      [],
      ["混一色", "不求人", "箭刻", "双暗刻", "老少副", "单钓将"],
      { winTile: "E" },
    );
  });

  // 三色三步高: 3 suits, chows stepping +1 each
  it("三色三步高", () => {
    expectScore(
      "3m 4m 5m 4p 5p 6p 5s 7s 5p 5p",
      ["p(5m 5m 5m)"],
      ["全带五", "三色三步高", "四归一", "坎张", "自摸"],
      { winTile: "6s" },
    );
  });

  // 五门齐: all 5 types present (万 筒 条 风 箭)
  it("五门齐", () => {
    expectScore(
      "1m 2m 3m 1p 2p 3p 7s 8s 9s F F N N",
      [],
      ["五门齐", "全带幺九", "箭刻", "门前清", "喜相逢"],
      { winTile: "F", winSource: "discard" },
    );
  });

  // 全求人: all 4 melds exposed, win by discard on pair
  it.skip("全求人", () => {
    expectScore(
      "5p 5p",
      ["!c(1m 2m 3m)", "!p(9s 9s 9s)", "!c(4p 5p 6p)", "!c(7s 8s 9s)"],
      [], // TODO
      { winTile: "5p", winSource: "discard" },
    );
  });

  // 双暗杠: 2 concealed kongs
  it.skip("双暗杠", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 9s 9s",
      ["k(7m 7m 7m 7m)", "k(3s 3s 3s 3s)"],
      [], // TODO
      { winTile: "9s" },
    );
  });

  // 双箭刻: 2 dragon pungs
  it.skip("双箭刻", () => {
    expectScore(
      "Z Z Z F F F 1m 2m 3m 4p 5p 6p 9s 9s",
      [],
      [], // TODO
      { winTile: "9s" },
    );
  });
});

// ===========================================================================
// 4 番
// ===========================================================================

describe("4 fan", () => {

  // 全带幺九: every meld/pair has terminal or honor
  it.skip("全带幺九", () => {
    expectScore(
      "1m 2m 3m 7p 8p 9p 7s 8s 9s E E E 1p 1p",
      [],
      [], // TODO
      { winTile: "1p" },
    );
  });

  // 不求人: all concealed + self-draw
  it.skip("不求人", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2m 3m 4m 8s 8s",
      [],
      [], // TODO
      { winTile: "8s" },
    );
  });

  // 双明杠: 2 exposed kongs
  it("双明杠", () => {
    expectScore(
      "9m",
      ["k(1m 1m 1m 1m)", "k(2m 2m 2m 2m)", "p(4m 4m 4m)", "p(8m 8m 8m)"],
      ["清一色", "碰碰和", "全求人", "双明杠", "幺九刻"],
      { winTile: "9m", winSource: "discard" },
    );
  });

  // 和绝张: win tile is 4th copy (3 already visible)
  it.skip("和绝张", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p 4p E E",
      [],
      [], // TODO
      { winTile: "4p", winTileVisibleCount: 3 },
    );
  });
});

// ===========================================================================
// 2 番
// ===========================================================================

describe("2 fan", () => {

  // 箭刻: dragon pung
  it.skip("箭刻", () => {
    expectScore(
      "Z Z Z 1m 2m 3m 4p 5p 6p 7s 8s 9s 1p 1p",
      [],
      [], // TODO
      { winTile: "1p" },
    );
  });

  // 圈风刻: pung of round wind (east round, east pung)
  it.skip("圈风刻", () => {
    expectScore(
      "E E E 1m 2m 3m 4p 5p 6p 7s 8s 9s 1p 1p",
      [],
      [], // TODO
      { winTile: "1p", seatWind: "south", roundWind: "east" },
    );
  });

  // 门风刻: pung of seat wind (south seat, south pung)
  it.skip("门风刻", () => {
    expectScore(
      "S S S 1m 2m 3m 4p 5p 6p 7s 8s 9s 1p 1p",
      [],
      [], // TODO
      { winTile: "1p", seatWind: "south", roundWind: "east" },
    );
  });

  // 门前清: all concealed, win by discard
  it.skip("门前清", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p 4p 8s 8s",
      [],
      [], // TODO
      { winTile: "8s", winSource: "discard" },
    );
  });

  // 平和: all chows + suited pair
  it.skip("平和", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2m 3m 4m 8s 8s",
      [],
      [], // TODO
      { winTile: "8s" },
    );
  });

  // 四归一: 4 of same tile used across melds (not a kong)
  it.skip("四归一", () => {
    expectScore(
      "1p 2p 3p 2p 3p 4p 3p 4p 5p 3p 4p 5p 9s 9s",
      [],
      [], // TODO
      { winTile: "9s" },
    );
  });

  // 双同刻: same-number pungs in 2 suits
  it.skip("双同刻", () => {
    expectScore(
      "5m 5m 5m 5p 5p 5p 1s 2s 3s 7m 8m 9m E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 双暗刻: 2 concealed pungs
  it.skip("双暗刻", () => {
    expectScore(
      "5m 5m 5m 9p 9p 9p 1s 2s 3s 7m 8m 9m E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 暗杠: 1 concealed kong
  it.skip("暗杠", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 9s 9s",
      ["k(E E E E)"],
      [], // TODO
      { winTile: "9s" },
    );
  });

  // 断幺九: no terminals or honors
  it.skip("断幺九", () => {
    expectScore(
      "2m 3m 4m 5p 6p 7p 3s 4s 5s 6s 7s 8s 5m 5m",
      [],
      [], // TODO
      { winTile: "5m" },
    );
  });
});

// ===========================================================================
// 1 番
// ===========================================================================

describe("1 fan", () => {

  // 一般高: 2 identical chows in same suit
  it.skip("一般高", () => {
    expectScore(
      "2m 3m 4m 2m 3m 4m 5p 6p 7p 7s 8s 9s E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 喜相逢: same-sequence chows in different suits
  it.skip("喜相逢", () => {
    expectScore(
      "2m 3m 4m 2p 3p 4p 5s 6s 7s 7m 8m 9m E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 连六: 6 consecutive tiles in one suit
  it.skip("连六", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 5p 6p 7p 7s 8s 9s E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 老少副: 123 + 789 in same suit
  it.skip("老少副", () => {
    expectScore(
      "1m 2m 3m 7m 8m 9m 4p 5p 6p 7s 8s 9s E E",
      [],
      [], // TODO
      { winTile: "E" },
    );
  });

  // 幺九刻: terminal pung (1 or 9)
  it.skip("幺九刻", () => {
    expectScore(
      "1m 1m 1m 4p 5p 6p 7s 8s 9s 2m 3m 4m 8s 8s",
      [],
      [], // TODO
      { winTile: "8s" },
    );
  });

  // 明杠: 1 exposed kong
  it.skip("明杠", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 9s 9s",
      ["!k(E E E E)"],
      [], // TODO
      { winTile: "9s" },
    );
  });

  // 缺一门: missing one suit (has honors + 2 suits)
  it.skip("缺一门", () => {
    expectScore(
      "1m 2m 3m 4m 5m 6m 7s 8s 9s E E E 1s 1s",
      [],
      [], // TODO
      { winTile: "1s" },
    );
  });

  // 无字: no honor tiles
  it.skip("无字", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2m 3m 4m 8s 8s",
      [],
      [], // TODO
      { winTile: "8s" },
    );
  });

  // 边张: edge wait (12 waiting for 3, or 89 waiting for 7)
  it.skip("边张", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p 4p Z Z",
      [],
      [], // TODO
      { winTile: "3m" },
    );
  });

  // 坎张: middle wait (e.g. 46 waiting for 5)
  it.skip("坎张", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 4m 5m 6m Z Z",
      [],
      [], // TODO
      { winTile: "5m" },
    );
  });

  // 单钓将: single wait on pair tile
  it.skip("单钓将", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2m 3m 4m Z Z",
      [],
      [], // TODO
      { winTile: "Z" },
    );
  });

  // 自摸: self-draw win (no other special conditions)
  it.skip("自摸", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p 4p E E",
      [],
      [], // TODO
      { winTile: "4p" },
    );
  });

  // 花牌: bonus tiles
  it.skip("花牌", () => {
    expectScore(
      "1m 2m 3m 4p 5p 6p 7s 8s 9s 2p 3p 4p E E",
      [],
      [], // TODO
      { winTile: "4p", bonusTileCount: 2 },
    );
  });
});
