# Rule Engine Design: Tenpai Detection, Hu Validation & Fan Scoring

## Overview

The rule engine is a unified pipeline with three layers, each building on the previous:

1. **Tenpai Detection (听牌)** — at any point, determine whether a hand is one tile away from winning, and list all waiting tiles
2. **Hu Validation (和牌)** — when a specific tile arrives (drawn or discarded), confirm the hand is complete and decompose it into valid meld+pair structures
3. **Fan Scoring (算番)** — for each valid decomposition, detect all applicable fan patterns, apply the five principles, and compute the final score

The key insight is that **tenpai and hu share the same decomposition engine**. Tenpai = "run decomposition for each of the 34 candidate tiles." Hu = "run decomposition for one specific tile, then score it." The difference is only in context: tenpai doesn't yet know situational factors (self-draw vs discard, 海底, 杠上开花, etc.), so it produces a **base score** per waiting tile. The situational fans are resolved at the moment of actual hu.

The engine lives in `packages/common/src/scoring/` so both server (authoritative) and client (tenpai hints, score preview) can use it.

---

## Layer 0: Tile Encoding

Convert `TileFace` to a numeric index 0-33 for fast array operations:

```
wan1-9:   0-8
tiao1-9:  9-17
tong1-9:  18-26
east/south/west/north: 27-30
zhong/fa/bai: 31-33
```

The hand becomes a `counts: number[34]` frequency array. This is the standard representation used in all mahjong solvers.

```typescript
function faceToIndex(face: TileFace): number;
function indexToFace(idx: number): TileFace;
function tilesToCounts(tiles: Tile[]): number[]; // 34-element frequency array
```

Helper predicates on indices:

```typescript
function isSuited(idx: number): boolean;      // 0-26
function suitOf(idx: number): 0 | 1 | 2;      // wan=0, tiao=1, tong=2
function rankOf(idx: number): number;           // 1-9 for suited tiles
function isTerminal(idx: number): boolean;      // rank 1 or 9
function isHonor(idx: number): boolean;         // 27-33
function isTerminalOrHonor(idx: number): boolean;
function isWind(idx: number): boolean;          // 27-30
function isDragon(idx: number): boolean;        // 31-33
```

---

## Layer 1: Hand Decomposition

The core of the engine. Given a set of closed-hand tiles (as a counts array), find all ways to split them into valid structures.

### Standard Form: Melds + Pair

A standard winning hand has 4 melds + 1 pair = 14 tiles. With K already-declared melds (exposed chow/pung/kong), we need (4-K) melds + 1 pair from the remaining closed tiles.

```typescript
interface Decomposition {
  closedMelds: ParsedMeld[];  // melds found by decomposition
  pair: number;               // tile index (0-33) of the pair
}

interface ParsedMeld {
  type: "chow" | "pung";
  tileIndices: number[];      // sorted tile indices
}
```

**Algorithm: Recursive Backtracking**

```
function decompose(counts: number[34], needed: number): Decomposition[]
  results = []

  // Step 1: Choose a pair
  for idx in 0..33:
    if counts[idx] >= 2:
      counts[idx] -= 2
      // Step 2: decompose remaining into `needed` melds
      findMelds(counts, needed, [], results, idx)
      counts[idx] += 2

  return results

function findMelds(counts, remaining, currentMelds, results, pairIdx):
  if remaining == 0:
    if all counts are 0:
      results.push({ closedMelds: [...currentMelds], pair: pairIdx })
    return

  // Find first non-zero tile (deterministic ordering prevents duplicates)
  idx = first i where counts[i] > 0

  // Try triplet
  if counts[idx] >= 3:
    counts[idx] -= 3
    findMelds(counts, remaining-1, [...currentMelds, pung(idx)], results, pairIdx)
    counts[idx] += 3

  // Try sequence (suited tiles only, idx must be rank 1-7 within its suit)
  if isSuited(idx) and rankOf(idx) <= 7 and counts[idx+1] > 0 and counts[idx+2] > 0:
    counts[idx]--, counts[idx+1]--, counts[idx+2]--
    findMelds(counts, remaining-1, [...currentMelds, chow(idx,idx+1,idx+2)], results, pairIdx)
    counts[idx]++, counts[idx+1]++, counts[idx+2]++
```

**Key optimization**: Always start from the leftmost non-zero tile. This forces a canonical ordering (no permutations of the same partition) and prunes the search tree dramatically. Worst case is ~100 recursive calls for a 14-tile hand.

For the fast `canDecompose` (boolean-only) variant used by tenpai, the same algorithm returns `true` on first success without collecting all results.

### Special Hand Forms

Some winning hands bypass the meld+pair pattern:

| Hand Form | Detection | Constraint |
|-----------|-----------|------------|
| **七对 (Seven Pairs)** | Exactly 7 indices have count==2, rest are 0 | No declared melds |
| **十三幺 (Thirteen Orphans)** | 1 each of 13 terminal/honor tiles + 1 duplicate among them | No declared melds |
| **全不靠 (All Unrelated)** | Specific disjoint structure: one tile each from {1,4,7}{2,5,8}{3,6,9} across 3 suits + honor singletons | No declared melds |
| **组合龙 (Knitted Straight)** | Three 1-4-7 / 2-5-8 / 3-6-9 sequences (one per suit, 9 tiles) + standard meld + pair from remaining 5 tiles | No declared melds |

```typescript
function findAllDecompositions(counts: number[], declaredMeldCount: number): HandForm[] {
  const needed = 4 - declaredMeldCount;
  const results: HandForm[] = [];

  // Standard meld+pair decomposition
  for (const d of decompose(counts, needed)) {
    results.push({ form: "standard", ...d });
  }

  // Special forms — only possible with no declared melds
  if (declaredMeldCount === 0) {
    if (isSevenPairs(counts))       results.push(buildSevenPairs(counts));
    if (isThirteenOrphans(counts))  results.push(buildThirteenOrphans(counts));
    if (isKnittedStraight(counts))  results.push(buildKnittedHand(counts));
    if (isAllUnrelated(counts))     results.push(buildAllUnrelated(counts));
  }

  return results;
}
```

---

## Layer 2: Tenpai Detection (听牌)

Tenpai is the primary real-time query: **"Is this hand one tile away from winning, and if so, which tiles and at what base score?"**

### Core API

```typescript
/** Full tenpai result for a hand. */
interface TenpaiResult {
  isTenpai: boolean;
  /** Tiles that complete the hand, with base score for each. */
  waits: TenpaiWait[];
}

interface TenpaiWait {
  tileIndex: number;          // 0-33: which tile completes the hand
  remainingCount: number;     // how many of this tile are still available (0-4 minus visible)
  /** Best decomposition + base fan score (excludes situational fans). */
  baseFans: FanMatch[];       // tile-composition fans only
  baseScore: number;          // sum of baseFans scores
  /** All valid decompositions for this wait tile (for display). */
  decompositions: HandForm[];
}

/** Partial context available during tenpai (before the winning tile arrives). */
interface TenpaiContext {
  melds: Meld[];              // declared melds
  seatWind: Wind;
  roundWind: Wind;
  bonusTileCount: number;
  /** Visible tile counts: how many of each face are known to be unavailable.
   *  Used to compute remainingCount per wait tile. */
  visibleCounts: number[];    // 34-element array: discards + other melds + own melds
}
```

### Algorithm

```typescript
function computeTenpai(hand: Tile[], ctx: TenpaiContext): TenpaiResult {
  const baseCounts = tilesToCounts(hand);
  const waits: TenpaiWait[] = [];

  for (let idx = 0; idx < 34; idx++) {
    // Skip if 4 already accounted for (impossible to get a 5th)
    if (baseCounts[idx] + ctx.visibleCounts[idx] >= 4) continue;

    // Add candidate tile
    baseCounts[idx]++;

    const decomps = findAllDecompositions(baseCounts, ctx.melds.length);
    if (decomps.length > 0) {
      // Score each decomposition with partial context (no situational fans)
      const best = scoreTenpaiDecompositions(decomps, idx, ctx);
      waits.push({
        tileIndex: idx,
        remainingCount: 4 - baseCounts[idx] - ctx.visibleCounts[idx] + 1,
        baseFans: best.fans,
        baseScore: best.score,
        decompositions: decomps,
      });
    }

    // Remove candidate tile
    baseCounts[idx]--;
  }

  return { isTenpai: waits.length > 0, waits };
}
```

### Partial Scoring for Tenpai

When computing tenpai, we don't know how the winning tile will arrive, so we split fans into two categories:

**Tile-composition fans** (computable at tenpai time):
- All meld-pattern, sequence-relationship, triplet-relationship, terminal/honor, suit-composition, wind/dragon, and wait-pattern fans
- These depend only on the tile arrangement, which is fully known once the candidate tile is chosen

**Situational fans** (resolved only at hu time):
- 自摸 (1), 不求人 (4), 门前清 (2), 海底捞月 (8), 河底捞鱼 (8), 杠上开花 (8), 抢杠和 (8), 妙手回春 (8), 花牌 (1 each)
- These depend on *how* the tile was obtained and game state at that moment

The tenpai display can show: "Waiting for X — base Y fan" and optionally "+自摸 if self-drawn" etc.

```typescript
function scoreTenpaiDecompositions(
  decomps: HandForm[],
  winTileIdx: number,
  ctx: TenpaiContext,
): { fans: FanMatch[]; score: number } {
  let bestScore = 0;
  let bestFans: FanMatch[] = [];

  for (const decomp of decomps) {
    const hand = buildWinningHand(decomp, ctx.melds, winTileIdx, ctx);

    // Run only tile-composition detectors (skip situational)
    let fans = runTileCompositionDetectors(hand);
    fans = deduplicateIdenticalFans(fans);
    fans = applyExclusions(fans);

    const score = fans.reduce((sum, m) => sum + m.score * m.count, 0);
    if (score > bestScore) {
      bestScore = score;
      bestFans = fans;
    }
  }

  return { fans: bestFans, score: bestScore };
}
```

### When to Compute Tenpai

Tenpai is recomputed **after each discard** (by the player who just discarded). At that point the player's hand is back to 13 tiles (or fewer with declared melds), and we want to know: what tiles would complete this hand, and at what base score?

The full pipeline (34 candidates x decomposition x partial scoring) runs in <1ms, so it runs on every discard without concern.

### Cached Tenpai State

The tenpai result is **cached on the player state** after each discard:

```typescript
interface CachedTenpai {
  isTenpai: boolean;
  waits: Map<number, CachedWait>;  // tileIndex → wait info
}

interface CachedWait {
  baseFans: FanMatch[];        // tile-composition fans (pre-computed)
  baseScore: number;           // sum of base fans
  decompositions: HandForm[];  // all valid decompositions for this wait tile
  remainingCount: number;      // how many of this tile are still available
}
```

This cache serves two purposes:
1. **Hu eligibility**: when a tile arrives, check `waits.has(tileIndex)` — O(1) lookup
2. **Score completion**: the cached decompositions and base fans feed directly into the full scoring pipeline, avoiding redundant decomposition work

---

## Layer 3: Hu Validation & Full Scoring (和牌 + 算番)

Hu validation is built **on top of the cached tenpai state**. When a tile arrives (self-draw or discard), the engine does not re-decompose the hand from scratch. Instead:

1. **Check**: is the arriving tile in `cachedTenpai.waits`? If no → not a hu.
2. **Complete**: take the cached decompositions + base fans, add situational context, re-run only the situational detectors, re-apply exclusions, compute final score.

This makes hu validation O(1) for the structural check and O(decompositions x situational detectors) for scoring — trivially fast since decompositions are already cached.

### When Tenpai Cache Is Available (normal flow)

The common path: player discards → tenpai is computed and cached → next tile arrives.

```typescript
function completeHuFromTenpai(
  cached: CachedWait,         // from cachedTenpai.waits.get(winTileIdx)
  winTileIdx: number,
  melds: Meld[],
  situationalCtx: WinContext,
): ScoringResult {
  let bestResult: ScoredHand | null = null;

  for (const decomp of cached.decompositions) {
    const hand = buildWinningHand(decomp, melds, winTileIdx, situationalCtx);

    // Start with cached tile-composition fans
    let matches = [...cached.baseFans];

    // Add situational fans (自摸, 海底, 杠上开花, etc.)
    for (const def of FAN_REGISTRY.filter(d => d.situational)) {
      matches.push(...def.detector(hand));
    }

    // Re-apply exclusions (situational fans may be excluded by tile fans, or vice versa)
    matches = deduplicateIdenticalFans(matches);
    matches = applyExclusions(matches);

    const fanScore = matches.reduce((sum, m) => sum + m.score * m.count, 0);
    const bonusScore = situationalCtx.bonusTileCount;
    const totalScore = fanScore + bonusScore;

    if (!bestResult || totalScore > bestResult.totalScore) {
      bestResult = { hand, fans: matches, fanScore, bonusScore, totalScore };
    }
  }

  if (bestResult!.totalScore < 8) {
    return { isWin: false, reason: "insufficient-fan", bestScore: bestResult!.totalScore };
  }

  return { isWin: true, result: bestResult! };
}
```

### When Tenpai Cache Is Stale

The cache is stale whenever the player's closed hand changes. All three hand-modifying actions require recomputation:
- **Discard** — normal trigger, always recompute
- **Open kong** — 3 tiles removed from hand, kong formed with discard, replacement drawn
- **Closed kong** — 4 tiles removed from hand, replacement drawn

After any of these, the hand structure has changed and tenpai must be recomputed.

Note: **robbing kong (抢杠和)** does NOT invalidate the cache. Another player declares kong, but *our* hand hasn't changed — if the kong tile is in our `cachedTenpai.waits`, we simply claim hu via the fast path. The only difference is `winSource: "robbingKong"` in the situational context.

When the cache is stale and hasn't been recomputed yet (e.g., hu off a kong replacement draw before the discard-triggered recompute), fall back to the **full pipeline** (decompose from scratch + all detectors):

```typescript
function scoreHandFull(input: HuInput): ScoringResult {
  const counts = tilesToCounts(input.hand);
  const decomps = findAllDecompositions(counts, input.melds.length);

  if (decomps.length === 0) {
    return { isWin: false, reason: "no-valid-decomposition" };
  }

  let bestResult: ScoredHand | null = null;

  for (const decomp of decomps) {
    const hand = buildWinningHand(decomp, input);

    // Run ALL detectors (tile-composition + situational)
    let matches: FanMatch[] = [];
    for (const def of FAN_REGISTRY) {
      matches.push(...def.detector(hand));
    }

    matches = deduplicateIdenticalFans(matches);
    matches = applyExclusions(matches);

    const fanScore = matches.reduce((sum, m) => sum + m.score * m.count, 0);
    const bonusScore = input.context.bonusTileCount;
    const totalScore = fanScore + bonusScore;

    if (!bestResult || totalScore > bestResult.totalScore) {
      bestResult = { hand, fans: matches, fanScore, bonusScore, totalScore };
    }
  }

  if (bestResult!.totalScore < 8) {
    return { isWin: false, reason: "insufficient-fan", bestScore: bestResult!.totalScore };
  }

  return { isWin: true, result: bestResult! };
}
```

### Unified Entry Point

```typescript
function declareHu(
  cachedTenpai: CachedTenpai | null,
  winTileIdx: number,
  melds: Meld[],
  hand: Tile[],              // full hand including winTile
  winSource: WinSource,
  context: WinContext,
): ScoringResult {
  // Fast path: use cached tenpai if available and the tile is in the wait set
  if (cachedTenpai?.waits.has(winTileIdx)) {
    return completeHuFromTenpai(
      cachedTenpai.waits.get(winTileIdx)!,
      winTileIdx, melds, context,
    );
  }

  // Slow path: full decomposition + scoring (kong edge cases, robbing kong, etc.)
  return scoreHandFull({
    hand, melds,
    winTile: hand.find(t => faceToIndex(t.face) === winTileIdx)!,
    winSource, context,
  });
}
```

### Types

```typescript
type WinSource = "selfDraw" | "discard" | "kongDraw" | "robbingKong";

interface WinContext {
  seatWind: Wind;
  roundWind: Wind;
  seatIndex: number;
  isDealer: boolean;
  wallCount: number;          // remaining tiles (0 = 海底/河底)
  bonusTileCount: number;     // flower/season tiles held
  isKongDraw: boolean;        // drew replacement after kong
  isRobbingKong: boolean;     // won by robbing another's kong
  isLastTile: boolean;        // last tile from wall or last discard before exhaustion
  discarderSeat?: number;     // who discarded the winning tile
  declaredMeldCount: number;  // number of exposed melds
}

interface WinningHand {
  /** All melds: declared (fixed) + decomposed (closed). Declared first, then closed. */
  allMelds: ScoringMeld[];
  /** Pair tile index (0-33). -1 for special forms like 十三幺. */
  pair: number;
  /** Hand form */
  form: "standard" | "sevenPairs" | "thirteenOrphans" | "knitted" | "allUnrelated";
  /** The tile that completed the hand */
  winTile: number;
  /** Full context */
  context: WinContext;
}

interface ScoringMeld {
  type: "chow" | "pung" | "kong";
  tileIndices: number[];      // tile indices (0-33), sorted
  concealed: boolean;         // closed-hand meld or concealed kong
  claimedFrom?: number;       // seat of discarder (for exposed melds)
}

interface ScoringResult {
  isWin: boolean;
  reason?: "no-valid-decomposition" | "insufficient-fan";
  bestScore?: number;
  result?: ScoredHand;
}

interface ScoredHand {
  hand: WinningHand;
  fans: FanMatch[];          // all counted fans after exclusions
  fanScore: number;          // sum of fan scores
  bonusScore: number;        // flower/season tiles (1 each)
  totalScore: number;        // fanScore + bonusScore
}
```

---

## Fan Detection System

### Detector Signature

```typescript
type FanDetector = (hand: WinningHand) => FanMatch[];

interface FanMatch {
  fan: string;              // Chinese name, matches fan-data.ts
  score: number;
  count: number;            // occurrences (usually 1, >1 for e.g. 四归一)
  /** Which meld indices contributed. Used for 不重复/不得相同 enforcement. */
  involvedMelds: number[];  // indices into allMelds
  involvedPair: boolean;
}
```

### Fan Categories by Detection Strategy

#### A. Meld-pattern fans (examine meld types/composition)
碰碰和, 四暗刻, 三暗刻, 双暗刻, 全求人, 门前清, 不求人, 暗杠, 双暗杠, 明杠, 双明杠, 三杠, 四杠

```typescript
// Example: 碰碰和 — all 4 melds are pung/kong
function pengPengHu(hand: WinningHand): FanMatch[] {
  if (hand.allMelds.every(m => m.type === "pung" || m.type === "kong"))
    return [match("碰碰和", 6, [0,1,2,3])];
  return [];
}
```

#### B. Sequence-relationship fans (compare chow melds)
一般高, 喜相逢, 连六, 老少副, 一色三步高, 一色三同顺, 三色三步高, 三色三同顺, 清龙, 花龙, 一色四同顺, 一色四步高, 一色双龙会, 三色双龙会

Compare pairs/triples/quads of chow melds:
- Same suit, same start rank → 一般高 / 一色三同顺 / 一色四同顺
- Same suit, consecutive start ranks (step=1,2) → 一色三步高 / 一色四步高
- Different suits, same start rank → 喜相逢 / 三色三同顺
- Same suit, start ranks 1+4+7 → 清龙
- Different suits, start ranks 1+4+7 → 花龙
- Same suit, 1-2-3 + 7-8-9 sequences + 5-5 pair → 一色双龙会

#### C. Triplet-relationship fans (compare pung/kong melds)
双同刻, 三同刻, 一色三节高, 一色四节高, 三色三节高

Same approach as B but for pungs: compare suit/rank relationships.

#### D. Terminal/honor composition fans
全带幺九, 混幺九, 清幺九, 断幺九, 全大, 全中, 全小, 大于五, 小于五, 幺九刻

Examine which rank ranges appear across all tiles in the hand.

#### E. Suit-composition fans
混一色, 清一色, 字一色, 五门齐, 缺一门, 无字

Count which suits and honor categories are present.

#### F. Wind/dragon fans
圈风刻, 门风刻, 箭刻, 双箭刻, 小三元, 大三元, 三风刻, 小四喜, 大四喜

Check for pungs/kongs of specific honor tiles relative to context (seat wind, round wind).

#### G. Wait-pattern fans (depend on which tile completes the hand)
单钓将, 边张, 坎张

Need to know the win tile and how it fits into the decomposition:
- **单钓将**: win tile completes the pair (hand was 4 complete melds + 1 single tile)
- **边张**: win tile is rank 3 in 1-2-3, or rank 7 in 7-8-9
- **坎张**: win tile is the middle tile of a sequence (e.g., 5 in 4-5-6)

**Important**: If multiple decompositions exist, the wait pattern may differ between them. The scoring pipeline already handles this by scoring each decomposition independently.

#### H. Situational fans (depend on game context, not tile composition)
自摸, 花牌, 海底捞月, 河底捞鱼, 杠上开花, 抢杠和, 妙手回春, 和绝张, 无番和

These check `WinContext` fields only. **Skipped during tenpai scoring**, resolved at hu time.

- 自摸: winSource is selfDraw or kongDraw
- 海底捞月: self-draw and wallCount == 0
- 河底捞鱼: discard win and wallCount == 0
- 杠上开花: winSource is kongDraw
- 抢杠和: winSource is robbingKong
- 妙手回春: self-draw of the very last wall tile
- 和绝张: the winning tile is the 4th copy (all others visible in discards/melds)
- 无番和: no other fan detected, but hand is valid (bumped to 8 as a floor)

#### I. Tile-count fans
四归一: any tile face appears 4 times across different melds (not as a kong). Scan all indices; for each face appearing 4x across 2+ melds, score one 四归一.

### Fan Registry

```typescript
interface FanDef {
  id: string;              // Chinese name
  score: number;
  detector: FanDetector;
  excludes: string[];      // fans this one supersedes
  situational: boolean;    // true = skip during tenpai scoring
}

const FAN_REGISTRY: FanDef[] = [
  { id: "大四喜", score: 88, detector: daSiXi,
    excludes: ["三风刻", "碰碰和", "圈风刻", "门风刻"], situational: false },
  // ... all 81 fans
];
```

The `situational` flag lets the tenpai scorer skip detectors that depend on unknown context.

---

## The Five Principles

### 1. 不重复原则 (No Double-Counting)
> The same set of tiles cannot be used to score the same fan twice.

**Implementation**: Each `FanMatch` records `involvedMelds`. Detectors are written to return at most one match per meld combination. If a detector could theoretically fire multiple times on overlapping melds, it deduplicates internally.

### 2. 不拆移原则 (No Rearranging)
> Once tiles are assigned to melds in the decomposition, they cannot be rearranged for scoring.

**Implementation**: Enforced structurally. Fan detectors receive a `WinningHand` with a fixed meld assignment and never rearrange tiles. The decomposition step already enumerated all valid arrangements; each is scored independently, and the best total is chosen.

### 3. 不得相同原则 (No Identical Fans from Identical Tiles)
> Cannot claim the same fan from tile compositions that are identical in face value (even if different physical tiles).

**Implementation**: After detection, deduplicate: if two `FanMatch` entries have the same `fan` ID and their involved melds have identical tile-index sets (comparing face values, not physical tile IDs), keep only one.

### 4. 就高不就低原则 (Higher Takes Precedence)
> When the same tiles could score a higher or lower fan, only the higher counts.

**Implementation**: The static exclusion table. After collecting all detected fans, remove any fan that appears in a detected higher fan's `excludes` list.

### 5. 套算一次原则 (Compound Applied Once)
> A compound fan that logically contains sub-fans — the sub-fans are not additionally scored.

**Implementation**: Same mechanism as principle 4. The exclusion list encodes which sub-fans each compound fan absorbs. E.g., 大四喜 excludes 三风刻 + 碰碰和 + 圈风刻 + 门风刻.

### Exclusion Algorithm

```typescript
function applyExclusions(matches: FanMatch[]): FanMatch[] {
  const detected = new Set(matches.map(m => m.fan));
  const excluded = new Set<string>();

  for (const m of matches) {
    const def = FAN_REGISTRY.find(d => d.id === m.fan)!;
    for (const ex of def.excludes) {
      if (detected.has(ex)) excluded.add(ex);
    }
  }

  return matches.filter(m => !excluded.has(m.fan));
}
```

---

## Integration with Game State

### Data Flow

```
Player discards
  → server recomputes tenpai for that player (13-tile hand)
  → caches CachedTenpai on PlayerState
  → sends tenpai info to client (waiting tiles + base scores)

Tile arrives (draw or another player's discard)
  → server checks: is this tile in cachedTenpai.waits?
  → if yes: offer Hu button to the player
  → if player declares Hu: completeHuFromTenpai() with situational context
  → final score computed, round ends
```

### Server-Side: Tenpai After Discard

After a player discards, recompute their tenpai state:

```typescript
function updateTenpaiAfterDiscard(gameState: GameState, seatIndex: number): void {
  const player = gameState.players[seatIndex];

  const visible = computeVisibleCounts(gameState, seatIndex);
  const ctx: TenpaiContext = {
    melds: player.melds,
    seatWind: windForSeat(seatIndex),
    roundWind: gameState.roundWind,
    bonusTileCount: player.bonusTiles.length,
    visibleCounts: visible,
  };

  const result = computeTenpai(player.hand, ctx);

  // Cache on player state
  player.cachedTenpai = {
    isTenpai: result.isTenpai,
    waits: new Map(result.waits.map(w => [w.tileIndex, {
      baseFans: w.baseFans,
      baseScore: w.baseScore,
      decompositions: w.decompositions,
      remainingCount: w.remainingCount,
    }])),
  };
}
```

### Server-Side: Hu Eligibility Check

When a tile becomes available (drawn or discarded), check each player's cached tenpai:

```typescript
function canPlayerHu(player: PlayerState, tileIdx: number): boolean {
  if (!player.cachedTenpai?.isTenpai) return false;
  const wait = player.cachedTenpai.waits.get(tileIdx);
  if (!wait) return false;
  // Check if base score + possible situational fans can reach 8
  // Conservative: base score alone could be enough, or base + 自摸(1) etc.
  return wait.baseScore + player.bonusTiles.length >= 8
    || wait.baseScore + player.bonusTiles.length + 1 >= 8; // +1 for 自摸
}
```

### Server-Side: Hu Declaration

When a player declares hu, use cached tenpai to avoid redundant work:

```typescript
function handleHuDeclaration(gameState: GameState, seatIndex: number): ScoringResult {
  const player = gameState.players[seatIndex];
  const winTile = player.drawnTile ?? gameState.lastDiscard?.tile;
  if (!winTile) throw new Error("No win tile");

  const winTileIdx = faceToIndex(winTile.face);
  const winSource: WinSource = player.drawnTile ? "selfDraw" : "discard";
  const context = buildWinContext(gameState, seatIndex, winSource);

  const hand = player.drawnTile
    ? [...player.hand, player.drawnTile]
    : [...player.hand, winTile];

  const result = declareHu(
    player.cachedTenpai ?? null,
    winTileIdx,
    player.melds,
    hand,
    winSource,
    context,
  );

  if (result.isWin) {
    gameState.phase = "roundEnd";
    // Store result for display / settlement
  }

  return result;
}
```

### Client-Side: Tenpai Display

The client receives the tenpai state and shows:
- Whether the player is tenpai (after their discard)
- Which tiles they are waiting for, with remaining counts
- Base fan score per waiting tile
- Preview of situational bonuses: "+自摸" if self-drawn, "+海底" if wall is low, etc.

This is purely display — the server is authoritative for hu validation.

### Hu Claim Priority

When multiple players can hu on the same discard, hu has highest priority. If multiple players declare hu on the same tile, the player closest in turn order to the discarder wins (standard 国标 rule):

```typescript
const CLAIM_PRIORITY = {
  hu: 3,        // highest
  openKong: 2,
  pung: 2,
  chow: 1,
};
```

### Tenpai Cache Invalidation

The cache is valid as long as the player's closed hand doesn't change:
- Player **discards** → recompute (normal trigger)
- Player declares **open kong** → hand changes (3 tiles removed, replacement drawn) → recompute
- Player declares **closed kong** → hand changes (4 tiles removed, replacement drawn) → recompute
- All other events (other player's discard, draw, kong, etc.) → our hand is unchanged, cache stays valid
  - Including **robbing kong**: another player's kong doesn't change our hand, so our waits are still correct

---

## Complete Exclusion Table

Each fan excludes (does not additionally score) the listed sub-fans when both are detected:

| Fan (Score) | Excludes |
|---|---|
| 大四喜 (88) | 三风刻, 碰碰和, 圈风刻, 门风刻 |
| 大三元 (88) | 双箭刻, 箭刻 |
| 绿一色 (88) | 混一色 |
| 九莲宝灯 (88) | 清一色, 门前清, 不求人 |
| 四杠 (88) | 碰碰和, 单钓将 |
| 连七对 (88) | 清一色, 不求人, 门前清, 七对, 无字 |
| 十三幺 (88) | 五门齐, 不求人, 门前清, 单钓将 |
| 清幺九 (64) | 碰碰和, 全带幺九, 双同刻, 无字 |
| 小四喜 (64) | 三风刻 |
| 小三元 (64) | 双箭刻, 箭刻 |
| 字一色 (64) | 碰碰和, 混幺九, 全带幺九 |
| 四暗刻 (64) | 碰碰和, 门前清, 不求人 |
| 一色双龙会 (64) | 一色三同顺, 七对, 清一色 |
| 一色四同顺 (48) | 一色三同顺, 一般高, 四归一 |
| 一色四节高 (48) | 一色三节高, 碰碰和 |
| 一色四步高 (32) | 一色三步高, 连六, 老少副 |
| 三杠 (32) | — |
| 混幺九 (32) | 碰碰和, 全带幺九 |
| 七对 (24) | 不求人, 门前清 |
| 七星不靠 (24) | 五门齐, 不求人, 门前清 |
| 全双刻 (24) | 碰碰和, 断幺九, 无字 |
| 清一色 (24) | 无字 |
| 一色三同顺 (24) | 一般高 |
| 一色三节高 (24) | — |
| 全大 (24) | 无字, 大于五 |
| 全中 (24) | 无字, 断幺九 |
| 全小 (24) | 无字, 小于五 |
| 清龙 (16) | 连六, 老少副 |
| 三色双龙会 (16) | 喜相逢, 老少副, 平和, 无字 |
| 一色三步高 (16) | — |
| 全带五 (16) | 无字, 断幺九 |
| 三同刻 (16) | — |
| 三暗刻 (16) | — |
| 全不靠 (12) | 五门齐, 不求人, 门前清 |
| 组合龙 (12) | 喜相逢 |
| 大于五 (12) | 无字 |
| 小于五 (12) | 无字 |
| 三风刻 (12) | — |
| 花龙 (8) | — |
| 推不倒 (8) | — |
| 三色三同顺 (8) | 喜相逢 |
| 三色三节高 (8) | — |
| 无番和 (8) | — |
| 妙手回春 (8) | 自摸 |
| 海底捞月 (8) | 自摸 |
| 杠上开花 (8) | 自摸 |
| 抢杠和 (8) | — |
| 双暗杠 (6) | — |
| 双箭刻 (6) | 箭刻 |
| 全求人 (6) | 单钓将 |
| 碰碰和 (6) | — |
| 混一色 (6) | — |
| 三色三步高 (6) | — |
| 五门齐 (6) | — |
| 全带幺九 (4) | — |
| 不求人 (4) | 自摸 |
| 双明杠 (4) | — |
| 和绝张 (4) | — |
| 圈风刻 (2) | — |
| 门风刻 (2) | — |
| 箭刻 (2) | — |
| 门前清 (2) | — |
| 平和 (2) | 无字 |
| 四归一 (2) | — |
| 双同刻 (2) | — |
| 双暗刻 (2) | — |
| 暗杠 (2) | — |
| 断幺九 (2) | — |
| 一般高 (1) | — |
| 喜相逢 (1) | — |
| 连六 (1) | — |
| 老少副 (1) | — |
| 幺九刻 (1) | — |
| 明杠 (1) | — |
| 缺一门 (1) | — |
| 无字 (1) | — |
| 边张 (1) | — |
| 坎张 (1) | — |
| 单钓将 (1) | — |
| 自摸 (1) | — |
| 花牌 (1) | — |

---

## File Structure

```
packages/common/src/scoring/
  index.ts              — public API: computeTenpai(), declareHu()
  tile-encoding.ts      — faceToIndex, indexToFace, tilesToCounts, predicates
  decompose.ts          — hand decomposition (standard + special forms)
  types.ts              — CachedTenpai, WinningHand, ScoringMeld, WinContext,
                          FanMatch, TenpaiResult, ScoringResult, etc.
  fan-registry.ts       — FAN_REGISTRY array with all 81 definitions + exclusions
  detectors/
    meld-pattern.ts     — category A: 碰碰和, 四暗刻, etc.
    chow-relations.ts   — category B: sequence relationship fans
    pung-relations.ts   — category C: triplet relationship fans
    terminals.ts        — category D: terminal/honor composition
    suits.ts            — category E: suit composition
    honors.ts           — category F: wind/dragon fans
    waits.ts            — category G: wait pattern fans
    situational.ts      — category H: context-dependent fans (skipped for tenpai)
    special.ts          — category I: 四归一, etc.
  exclusions.ts         — exclusion table + applyExclusions logic
  tenpai.ts             — computeTenpai, scoreTenpaiDecompositions
  hu.ts                 — completeHuFromTenpai, scoreHandFull (fallback), declareHu
```

---

## Performance

| Operation | Cost | When |
|-----------|------|------|
| Decomposition (1 candidate) | ~100 recursive calls, <0.05ms | Per candidate tile |
| Tenpai scan (34 candidates) | 34 x decomposition + partial scoring | After every hand change |
| Full scoring (1 hand) | decomposition + 81 detectors + exclusions | On hu declaration |
| Total tenpai pipeline | <1ms | Can run on every draw/discard |

No caching needed. The entire pipeline is pure-functional (no side effects), making it safe to run on both server and client.

---

## Testing Strategy

1. **Decomposition tests**: Known tile sets → expected number and shape of decompositions
2. **Unit tests per detector**: Constructed `WinningHand` → expected `FanMatch[]`
3. **Exclusion tests**: Hands triggering both a high fan and its excluded sub-fans → verify only the high fan survives
4. **Tenpai tests**: Known 13-tile hands → expected waiting tiles and base scores
5. **Full scoring integration**: Example hands from `fan-data.ts` → expected total scores
6. **Edge cases**:
   - Multiple decompositions yielding different scores (verify max chosen)
   - Hands below 8 fan (correctly rejected)
   - All 88-point hands (verify correct exclusion of sub-fans)
   - 四归一 appearing multiple times
   - Situational fans correctly excluded from tenpai scoring and included in hu scoring
7. **五原则 regression**: One test per principle with a hand that scores incorrectly without it
