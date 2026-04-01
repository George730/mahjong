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

/** Deduplicate identical fan matches (不得相同原则).
 *  If two matches of the same fan involve melds with identical tile-index sets, keep only one. */
export function deduplicateIdenticalFans(matches: FanMatch[]): FanMatch[] {
  const seen = new Map<string, Set<string>>();
  const result: FanMatch[] = [];

  for (const m of matches) {
    const key = m.fan;
    const meldKey = m.involvedMelds.sort().join(",") + (m.involvedPair ? "|P" : "");

    if (!seen.has(key)) seen.set(key, new Set());
    const keys = seen.get(key)!;
    if (!keys.has(meldKey)) {
      keys.add(meldKey);
      result.push(m);
    }
  }

  return result;
}
