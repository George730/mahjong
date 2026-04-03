// Exclusion logic: apply 就高不就低 and 套算一次 principles.

import type { FanMatch, FanDef } from "./types.js";
import { FAN_REGISTRY } from "./fan-registry.js";

const REGISTRY_MAP = new Map<string, FanDef>();
for (const def of FAN_REGISTRY) {
  REGISTRY_MAP.set(def.id, def);
}

/** Remove fans that are excluded by surviving (non-excluded) fans.
 *  Iterate until stable so that a fan which is itself excluded cannot
 *  exclude others (exclusion is not transitive). */
export function applyExclusions(matches: FanMatch[]): FanMatch[] {
  let excluded = new Set<string>();

  for (;;) {
    const next = new Set<string>();
    for (const m of matches) {
      if (excluded.has(m.fan)) continue; // this fan is excluded, skip
      const def = REGISTRY_MAP.get(m.fan);
      if (!def) continue;
      for (const ex of def.excludes) {
        if (matches.some(mm => mm.fan === ex)) next.add(ex);
      }
    }
    if (next.size === excluded.size) break;
    excluded = next;
  }

  return matches.filter(m => !excluded.has(m.fan));
}

/**
 * Cap rules: when a higher fan is present, cap a lower fan to a max count.
 * E.g. 清幺九 always has 双同刻, but official rules only count one (不计两幅双同刻).
 */
const CAP_RULES: { when: string; cap: string; deduct: number }[] = [
  { when: "清幺九", cap: "双同刻", deduct: 1 },
  { when: "九莲宝灯", cap: "幺九刻", deduct: 1 },
];

/** Apply cap rules: deduct N instances of a lower fan when a higher fan is present. */
export function applyCapRules(matches: FanMatch[]): FanMatch[] {
  const detected = new Set(matches.map(m => m.fan));
  const deductions = new Map<string, number>();

  for (const rule of CAP_RULES) {
    if (detected.has(rule.when)) {
      deductions.set(rule.cap, (deductions.get(rule.cap) ?? 0) + rule.deduct);
    }
  }

  if (deductions.size === 0) return matches;

  const removed = new Map<string, number>();
  return matches.filter(m => {
    const toRemove = deductions.get(m.fan);
    if (toRemove === undefined) return true;
    const alreadyRemoved = removed.get(m.fan) ?? 0;
    if (alreadyRemoved < toRemove) {
      removed.set(m.fan, alreadyRemoved + 1);
      return false;
    }
    return true;
  });
}

/** 不得相同原则: 凡已组合过某一番种的牌，不能再同其它一副牌组成相同的番种计分。
 *  If two matches of the same fan involve melds with identical tile-index sets, keep only one. 
 */
export function deduplicateIdenticalFans(matches: FanMatch[]): FanMatch[] {
  const seen = new Map<string, Set<string>>();
  const result: FanMatch[] = [];

  for (const m of matches) {
    const key = m.fan;
    const meldKey = [...m.involvedMelds].sort().join(",") + (m.involvedPair ? "|P" : "");

    if (!seen.has(key)) seen.set(key, new Set());
    const keys = seen.get(key)!;
    if (!keys.has(meldKey)) {
      keys.add(meldKey);
      result.push(m);
    }
  }

  return result;
}

/**
 * 套算一次原则: 如有尚未组合过的一副牌，只可同已组合过的相应的一副牌套算一次。
 *
 * Process combination fans in descending score order. A fresh meld (not yet
 * established) can be combined with already-established melds only once.
 * However, a fan that uses only already-established melds is always allowed
 * — different fans on the same melds are not restricted.
 *
 * Whole-hand fans (involvedMelds covering all 4 melds, or no specific melds)
 * and single-meld fans are exempt from this constraint.
 */
export function applyOnlyOnce(matches: FanMatch[]): FanMatch[] {
  const exempt: FanMatch[] = [];
  const combination: FanMatch[] = [];

  for (const m of matches) {
    // Whole-hand fans (all 4 melds or no specific melds) are exempt.
    // Single-meld fans (e.g. 幺九刻, 箭刻, 明杠, 暗杠) describe intrinsic
    // properties of one meld, not inter-meld combinations, so they are also exempt.
    if (m.involvedMelds.length <= 1 && !m.involvedPair
        || m.involvedMelds.length === 0
        || m.involvedMelds.length >= 4) {
      exempt.push(m);
    } else {
      combination.push(m);
    }
  }

  // Sort by score descending — higher fans are established first
  combination.sort((a, b) => b.score - a.score);

  let established = 0;   // melds used in any accepted fan
  let combined = 0;       // fresh melds that have already been 套算'd with established melds
  const selected: FanMatch[] = [];
  for (const m of combination) {
    const mask = toMeldMask(m);
    const fresh = mask & ~established;

    if (fresh === 0) {
      // All melds already established — a different fan on the same melds is allowed
      selected.push(m);
    } else if ((fresh & combined) !== 0) {
      // This fresh meld was already used in a previous 套算 — reject
      continue;
    } else {
      // Fresh meld(s) being introduced
      if ((mask & established) !== 0) {
        // Mixed fresh + established: this is a 套算, mark fresh melds as used
        combined |= fresh;
      }
      established |= mask;
      selected.push(m);
    }
  }

  return [...exempt, ...selected];
}

/** Convert involved melds/pair to a bitmask. Melds 0-3 → bits 0-3, pair → bit 4. */
function toMeldMask(m: FanMatch): number {
  let mask = 0;
  for (const idx of m.involvedMelds) mask |= (1 << idx);
  if (m.involvedPair) mask |= (1 << 4);
  return mask;
}
