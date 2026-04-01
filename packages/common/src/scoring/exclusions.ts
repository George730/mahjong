// Exclusion logic: apply 就高不就低 and 套算一次 principles.

import type { FanMatch, FanDef } from "./types.js";
import { FAN_REGISTRY } from "./fan-registry.js";

const REGISTRY_MAP = new Map<string, FanDef>();
for (const def of FAN_REGISTRY) {
  REGISTRY_MAP.set(def.id, def);
}

/** Remove fans that are excluded by higher-scoring fans. */
export function applyExclusions(matches: FanMatch[]): FanMatch[] {
  const detected = new Set(matches.map(m => m.fan));
  const excluded = new Set<string>();

  for (const m of matches) {
    const def = REGISTRY_MAP.get(m.fan);
    if (!def) continue;
    for (const ex of def.excludes) {
      if (detected.has(ex)) excluded.add(ex);
    }
  }

  return matches.filter(m => !excluded.has(m.fan));
}

/**
 * Cap rules: when a higher fan is present, cap a lower fan to a max count.
 * E.g. 清幺九 always has 双同刻, but official rules only count one (不计两幅双同刻).
 */
const CAP_RULES: { when: string; cap: string; maxCount: number }[] = [
  { when: "清幺九", cap: "双同刻", maxCount: 1 },
];

/** Apply cap rules: limit certain fan counts when a higher fan is present. */
export function applyCapRules(matches: FanMatch[]): FanMatch[] {
  const detected = new Set(matches.map(m => m.fan));
  const caps = new Map<string, number>();

  for (const rule of CAP_RULES) {
    if (detected.has(rule.when)) {
      const existing = caps.get(rule.cap);
      if (existing === undefined || rule.maxCount < existing) {
        caps.set(rule.cap, rule.maxCount);
      }
    }
  }

  if (caps.size === 0) return matches;

  const counts = new Map<string, number>();
  return matches.filter(m => {
    const max = caps.get(m.fan);
    if (max === undefined) return true;
    const seen = (counts.get(m.fan) ?? 0) + 1;
    counts.set(m.fan, seen);
    return seen <= max;
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
 * Process combination fans in descending score order. When a fan is selected,
 * ALL its involved melds become "established." A subsequent fan is only valid
 * if at least one of its melds is NOT yet established (introduces a fresh meld).
 *
 * Whole-hand fans (involvedMelds covering all 4 melds, or no specific melds)
 * evaluate the overall hand pattern and are exempt from this constraint.
 */
export function applyOnlyOnce(matches: FanMatch[]): FanMatch[] {
  const exempt: FanMatch[] = [];
  const combination: FanMatch[] = [];

  for (const m of matches) {
    // Whole-hand fans (all 4 melds or no specific melds) are exempt
    if (m.involvedMelds.length === 0 || m.involvedMelds.length >= 4) {
      exempt.push(m);
    } else {
      combination.push(m);
    }
  }

  // Sort by score descending — higher fans are established first
  combination.sort((a, b) => b.score - a.score);

  // Greedily accept fans that introduce at least one fresh meld
  let established = 0;
  const selected: FanMatch[] = [];
  for (const m of combination) {
    const mask = toMeldMask(m);
    if ((mask & ~established) === 0) continue; // all melds already established
    established |= mask;
    selected.push(m);
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
