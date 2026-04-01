// Hand decomposition: find all valid ways to split closed-hand tiles
// into melds + pair (standard), or detect special hand forms.

import { isSuited, rankOf, suitOf, isTerminalOrHonor, isHonor } from "./tile-encoding.js";
import type { Decomposition, ParsedMeld, HandForm } from "./types.js";

// --- Standard decomposition: recursive backtracking ---

export function decompose(counts: number[], needed: number): Decomposition[] {
  const results: Decomposition[] = [];

  // Step 1: choose a pair
  for (let idx = 0; idx < 34; idx++) {
    if (counts[idx] >= 2) {
      counts[idx] -= 2;
      findMelds(counts, needed, [], results, idx);
      counts[idx] += 2;
    }
  }

  return results;
}

function findMelds(
  counts: number[],
  remaining: number,
  current: ParsedMeld[],
  results: Decomposition[],
  pair: number,
): void {
  if (remaining === 0) {
    // Check all used up
    for (let i = 0; i < 34; i++) {
      if (counts[i] !== 0) return;
    }
    results.push({ closedMelds: [...current], pair });
    return;
  }

  // Find first non-zero (canonical ordering)
  let idx = -1;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) { idx = i; break; }
  }
  if (idx === -1) return;

  // Try triplet
  if (counts[idx] >= 3) {
    counts[idx] -= 3;
    current.push({ type: "pung", tileIndices: [idx, idx, idx] });
    findMelds(counts, remaining - 1, current, results, pair);
    current.pop();
    counts[idx] += 3;
  }

  // Try sequence (suited only, rank <= 7)
  if (isSuited(idx) && rankOf(idx) <= 7) {
    const idx1 = idx + 1;
    const idx2 = idx + 2;
    // Ensure same suit
    if (suitOf(idx) === suitOf(idx2) && counts[idx1] > 0 && counts[idx2] > 0) {
      counts[idx]--;
      counts[idx1]--;
      counts[idx2]--;
      current.push({ type: "chow", tileIndices: [idx, idx1, idx2] });
      findMelds(counts, remaining - 1, current, results, pair);
      current.pop();
      counts[idx]++;
      counts[idx1]++;
      counts[idx2]++;
    }
  }
}

/** Fast boolean check: can the counts be decomposed into `needed` melds + no remainder? */
export function canDecompose(counts: number[], needed: number): boolean {
  for (let idx = 0; idx < 34; idx++) {
    if (counts[idx] >= 2) {
      counts[idx] -= 2;
      if (canFindMelds(counts, needed)) {
        counts[idx] += 2;
        return true;
      }
      counts[idx] += 2;
    }
  }
  return false;
}

function canFindMelds(counts: number[], remaining: number): boolean {
  if (remaining === 0) {
    for (let i = 0; i < 34; i++) {
      if (counts[i] !== 0) return false;
    }
    return true;
  }

  let idx = -1;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) { idx = i; break; }
  }
  if (idx === -1) return false;

  // Try triplet
  if (counts[idx] >= 3) {
    counts[idx] -= 3;
    if (canFindMelds(counts, remaining - 1)) {
      counts[idx] += 3;
      return true;
    }
    counts[idx] += 3;
  }

  // Try sequence
  if (isSuited(idx) && rankOf(idx) <= 7) {
    const idx1 = idx + 1;
    const idx2 = idx + 2;
    if (suitOf(idx) === suitOf(idx2) && counts[idx1] > 0 && counts[idx2] > 0) {
      counts[idx]--;
      counts[idx1]--;
      counts[idx2]--;
      if (canFindMelds(counts, remaining - 1)) {
        counts[idx]++;
        counts[idx1]++;
        counts[idx2]++;
        return true;
      }
      counts[idx]++;
      counts[idx1]++;
      counts[idx2]++;
    }
  }

  return false;
}

// --- Special hand forms ---

/** 七对: exactly 7 pairs, each count == 2. */
export function isSevenPairs(counts: number[]): boolean {
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 2) pairs++;
    else if (counts[i] === 4) pairs += 2; // 4 of same counts as 2 pairs
    else if (counts[i] !== 0) return false;
  }
  return pairs === 7;
}

export function buildSevenPairs(counts: number[]): HandForm {
  const pairs: number[] = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 2) pairs.push(i);
    else if (counts[i] === 4) { pairs.push(i); pairs.push(i); }
  }
  return { form: "sevenPairs", pairs };
}

/** 十三幺: 1 each of 13 terminals/honors + 1 duplicate. */
const THIRTEEN_ORPHAN_INDICES = [
  0, 8,     // wan 1, 9
  9, 17,    // tiao 1, 9
  18, 26,   // tong 1, 9
  27, 28, 29, 30, // E S W N
  31, 32, 33,     // Z F B
];

export function isThirteenOrphans(counts: number[]): boolean {
  let pairIdx = -1;
  for (const idx of THIRTEEN_ORPHAN_INDICES) {
    if (counts[idx] === 0) return false;
    if (counts[idx] === 2) {
      if (pairIdx !== -1) return false; // more than one pair
      pairIdx = idx;
    } else if (counts[idx] !== 1) return false;
  }
  if (pairIdx === -1) return false;
  // Ensure no other tiles
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0 && !THIRTEEN_ORPHAN_INDICES.includes(i)) return false;
  }
  return true;
}

export function buildThirteenOrphans(counts: number[]): HandForm {
  let pair = -1;
  for (const idx of THIRTEEN_ORPHAN_INDICES) {
    if (counts[idx] === 2) pair = idx;
  }
  return { form: "thirteenOrphans", pair };
}

/** 组合龙 / 全不靠: knitted straight detection.
 *
 * 组合龙: 3 suits contribute ranks from disjoint sets {1,4,7}, {2,5,8}, {3,6,9}
 *   one suit per set (9 tiles), + 1 meld + 1 pair from remaining 5 tiles.
 * 全不靠: same knitted structure + all remaining tiles are distinct honors.
 */

const KNITTED_SETS = [
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
];

/**
 * Try all 6 suit-to-set assignments for the knitted straight.
 * Returns all valid knitted hand decompositions.
 */
export function findKnittedDecompositions(counts: number[]): HandForm[] {
  const results: HandForm[] = [];
  const suitPerms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];

  for (const perm of suitPerms) {
    // Check if the knitted pattern exists
    const knittedIndices: number[] = [];
    let valid = true;

    for (let setIdx = 0; setIdx < 3; setIdx++) {
      const suit = perm[setIdx];
      for (const rank of KNITTED_SETS[setIdx]) {
        const idx = suit * 9 + (rank - 1);
        if (counts[idx] < 1) { valid = false; break; }
        knittedIndices.push(idx);
      }
      if (!valid) break;
    }
    if (!valid) continue;

    // Remove knitted tiles, decompose remaining 5 tiles into 1 meld + 1 pair
    const remaining = [...counts];
    for (const idx of knittedIndices) remaining[idx]--;

    // Check for 全不靠: remaining are all distinct honors (no meld, no pair in standard sense)
    // 全不靠 has 14 tiles: 9 knitted + 5 distinct honors, but that's only possible if total = 14
    const remainCount = remaining.reduce((a, b) => a + b, 0);
    if (remainCount === 5) {
      // Try to decompose as 1 meld + 1 pair
      const decomps = decompose(remaining, 1);
      for (const d of decomps) {
        results.push({
          form: "knitted",
          closedMelds: d.closedMelds,
          pair: d.pair,
          knittedIndices,
        });
      }

      // Check 全不靠: all 5 remaining are distinct honors
      let allDistinctHonors = true;
      for (let i = 0; i < 34; i++) {
        if (remaining[i] > 1) { allDistinctHonors = false; break; }
        if (remaining[i] === 1 && !isHonor(i)) { allDistinctHonors = false; break; }
      }
      if (allDistinctHonors && remainCount === 5) {
        const indices = [...knittedIndices];
        for (let i = 27; i < 34; i++) {
          if (remaining[i] === 1) indices.push(i);
        }
        results.push({ form: "allUnrelated", indices });
      }
    }
  }

  return results;
}

// --- Master decomposition entry point ---

export function findAllDecompositions(counts: number[], declaredMeldCount: number): HandForm[] {
  const needed = 4 - declaredMeldCount;
  const results: HandForm[] = [];

  // Standard meld+pair
  for (const d of decompose(counts, needed)) {
    results.push({ form: "standard", closedMelds: d.closedMelds, pair: d.pair });
  }

  // Special forms: only when no declared melds (full 14-tile hand)
  if (declaredMeldCount === 0) {
    if (isSevenPairs(counts)) results.push(buildSevenPairs(counts));
    if (isThirteenOrphans(counts)) results.push(buildThirteenOrphans(counts));
    const knitted = findKnittedDecompositions(counts);
    results.push(...knitted);
  }

  return results;
}
