// Scoring integration tests — manually specify hands and expected fans/scores.
//
// Hand notation (compact):
//   Suited: 1m-9m (万), 1s-9s (条), 1p-9p (筒)
//   Winds:  E S W N
//   Dragons: Z(中) F(发) B(白)
//
// Melds are separated by "|". Pair is the last group.
// Prefix a meld with "!" to mark it as exposed (claimed from another player).
//
// Examples:
//   "1m 2m 3m|4p 5p 6p|7s 8s 9s|1p 2p 3p|Z Z"
//   "!1m 1m 1m|2p 2p 2p|3s 3s 3s|4m 4m 4m|5s 5s"   (first meld exposed)

import { describe, it, expect } from "vitest";
import { scoreHandFull } from "../scoring/hu.js";
import type { WinContext, ScoringMeld, ScoringResult } from "../scoring/types.js";

// ---------------------------------------------------------------------------
// Compact notation parser
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

interface ParsedHand {
  /** Closed-hand tile counts (34-element array, before declared melds are removed). */
  counts: number[];
  /** Declared (exposed) melds parsed from the notation. */
  declaredMelds: ScoringMeld[];
  /** The win tile index (last tile of the last non-pair meld, or pair tile). */
  winTile: number;
}

/**
 * Parse compact hand notation into counts + declared melds.
 *
 * Groups separated by "|". Last group = pair (2 tiles). Others = melds (3-4 tiles).
 * Prefix a meld group with "!" to mark it as exposed.
 */
function parseHand(notation: string): ParsedHand {
  const counts = new Array(34).fill(0);
  const declaredMelds: ScoringMeld[] = [];
  const groups = notation.split("|").map(g => g.trim());

  // Last group is the pair
  const pairGroup = groups[groups.length - 1];
  const pairTokens = pairGroup.replace(/^!/, "").split(/\s+/);
  for (const t of pairTokens) counts[tileIndex(t)]++;

  // Meld groups
  for (let i = 0; i < groups.length - 1; i++) {
    let group = groups[i].trim();
    const exposed = group.startsWith("!");
    if (exposed) group = group.slice(1).trim();

    const tokens = group.split(/\s+/);
    const indices = tokens.map(tileIndex);

    if (exposed) {
      const meldType = inferMeldType(indices);
      declaredMelds.push({
        type: meldType,
        tileIndices: indices,
        concealed: false,
      });
      // Declared meld tiles are NOT in the closed hand counts
    } else {
      for (const idx of indices) counts[idx]++;
    }
  }

  // Win tile: last tile of the last non-pair group, or pair tile if all melds are declared
  const lastMeldGroup = groups[groups.length - 2]?.replace(/^!/, "").trim();
  let winTile: number;
  if (lastMeldGroup) {
    const lastTokens = lastMeldGroup.split(/\s+/);
    winTile = tileIndex(lastTokens[lastTokens.length - 1]);
  } else {
    winTile = tileIndex(pairTokens[0]);
  }

  return { counts, declaredMelds, winTile };
}

function inferMeldType(indices: number[]): "chow" | "pung" | "kong" {
  if (indices.length === 4) return "kong";
  if (indices[0] === indices[1]) return "pung";
  return "chow";
}

// ---------------------------------------------------------------------------
// Default WinContext builder
// ---------------------------------------------------------------------------

interface ContextOverrides {
  winSource?: "selfDraw" | "discard" | "kongDraw" | "robbingKong";
  seatWind?: "east" | "south" | "west" | "north";
  roundWind?: "east" | "south" | "west" | "north";
  isLastTile?: boolean;
  bonusTileCount?: number;
  winTileVisibleCount?: number;
}

function makeContext(
  winTile: number,
  declaredMeldCount: number,
  overrides: ContextOverrides = {},
): WinContext {
  return {
    winTile,
    winSource: overrides.winSource ?? "selfDraw",
    seatWind: overrides.seatWind ?? "east",
    roundWind: overrides.roundWind ?? "east",
    seatIndex: 0,
    isDealer: true,
    wallCount: 40,
    bonusTileCount: overrides.bonusTileCount ?? 0,
    isKongDraw: false,
    isRobbingKong: false,
    isLastTile: overrides.isLastTile ?? false,
    declaredMeldCount,
    winTileVisibleCount: overrides.winTileVisibleCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

interface ExpectedFan {
  name: string;
  score: number;
}

/**
 * Score a hand and assert expected fans and total score.
 *
 * @param notation  Compact hand notation (see top of file)
 * @param expected  Array of { name, score } for each expected fan
 * @param totalScore  Expected total fan score (excluding bonus tiles)
 * @param ctx  Optional context overrides
 */
function expectScore(
  notation: string,
  expected: ExpectedFan[],
  totalScore: number,
  ctx?: ContextOverrides,
) {
  const { counts, declaredMelds, winTile } = parseHand(notation);
  const context = makeContext(winTile, declaredMelds.length, ctx);
  const result = scoreHandFull(counts, declaredMelds, winTile, context);

  expect(result.isWin).toBe(true);
  const scored = result.result!;

  // Check total fan score
  expect(scored.fanScore).toBe(totalScore);

  // Check each expected fan is present
  const fanMap = new Map<string, number>();
  for (const f of scored.fans) {
    fanMap.set(f.fan, (fanMap.get(f.fan) ?? 0) + f.score * f.count);
  }

  for (const e of expected) {
    expect(fanMap.get(e.name), `Expected fan "${e.name}" with score ${e.score}`).toBe(e.score);
  }

  // Check no unexpected fans
  for (const [name] of fanMap) {
    expect(expected.some(e => e.name === name), `Unexpected fan "${name}" scored`).toBe(true);
  }
}

// ===========================================================================
// TEST CASES — add your hands below
// ===========================================================================

describe("Scoring integration", () => {

  // 花龙 + 喜相逢 (套算一次: 连六 excluded because 1p2p3p already used by 花龙)
  it("花龙 + 喜相逢 + 不求人 + 边张", () => {
    expectScore(
      "1m 2m 3m|4p 5p 6p|7s 8s 9s|1p 2p 3p|Z Z",
      [
        { name: "花龙", score: 8 },
        { name: "喜相逢", score: 1 },
        { name: "不求人", score: 4 },
        { name: "边张", score: 1 },
      ],
      14,
    );
  });

  // Template: copy and fill in
  // it("description", () => {
  //   expectScore(
  //     "HAND NOTATION HERE",
  //     [
  //       { name: "FAN_NAME", score: SCORE },
  //     ],
  //     TOTAL_SCORE,
  //     { /* optional context overrides */ },
  //   );
  // });

});
