// Tiny inline mahjong tile renderer for the fan panel examples.
// Parses compact notation (e.g. "3m", "E", "Z") and renders a small styled tile.

import { SUIT_HEX, RANK_CHARS, WIND_CHARS, DRAGON_MAP, SEASON_CHARS, FLOWER_CHARS } from "../constants/tile-chars.ts";

/** Map from compact notation to display char + color. */
function parseTileCode(code: string): { char: string; color: string } | null {
  // Suited: 1m–9m, 1p–9p, 1s–9s
  const suitMatch = code.match(/^([1-9])([mps])$/);
  if (suitMatch) {
    const rank = parseInt(suitMatch[1]);
    const suitKey = suitMatch[2] === "m" ? "wan" : suitMatch[2] === "p" ? "tong" : "tiao";
    const suitChar = suitKey === "wan" ? "万" : suitKey === "tong" ? "筒" : "条";
    return { char: RANK_CHARS[rank - 1] + suitChar, color: SUIT_HEX[suitKey] };
  }

  // Winds
  const windMap: Record<string, string> = { E: "east", S: "south", W: "west", N: "north" };
  if (windMap[code]) {
    return { char: WIND_CHARS[windMap[code]], color: "#1e293b" };
  }

  // Dragons
  const dragonMap: Record<string, string> = { Z: "zhong", F: "fa", B: "bai" };
  if (dragonMap[code]) {
    const d = DRAGON_MAP[dragonMap[code]];
    return { char: d.char, color: d.hex };
  }

  // Bonus tiles
  const bonusMap: Record<string, { chars: Record<string, string>; color: string }> = {
    春: { chars: SEASON_CHARS, color: "#dc2626" },
    夏: { chars: SEASON_CHARS, color: "#dc2626" },
    秋: { chars: SEASON_CHARS, color: "#dc2626" },
    冬: { chars: SEASON_CHARS, color: "#dc2626" },
    梅: { chars: FLOWER_CHARS, color: "#15803d" },
    兰: { chars: FLOWER_CHARS, color: "#15803d" },
    竹: { chars: FLOWER_CHARS, color: "#15803d" },
    菊: { chars: FLOWER_CHARS, color: "#15803d" },
  };
  if (bonusMap[code]) {
    return { char: code, color: bonusMap[code].color };
  }

  return null;
}

/** Render a single tiny tile. */
function MiniTile({ code }: { code: string }) {
  const parsed = parseTileCode(code);
  if (!parsed) return <span className="text-gray-500 text-xs">?</span>;

  return (
    <span
      className="inline-flex items-center justify-center rounded-sm border border-gray-600 bg-[#f5f0e1] leading-none flex-shrink-0"
      style={{
        width: 18,
        height: 24,
        fontSize: parsed.char.length > 1 ? 8 : 11,
        color: parsed.color,
        fontWeight: 700,
      }}
      title={parsed.char}
    >
      {parsed.char}
    </span>
  );
}

/** Render a full example hand string. "|" separates meld groups. */
export default function MiniHand({ notation }: { notation: string }) {
  const groups = notation.split("|").map((g) => g.trim());

  return (
    <div className="flex flex-wrap items-center gap-y-1 mt-1">
      {groups.map((group, gi) => {
        const tiles = group.split(/\s+/).filter(Boolean);
        return (
          <span key={gi} className="inline-flex items-center">
            {gi > 0 && <span className="w-1.5" />}
            {tiles.map((code, ti) => (
              <span key={ti} className="inline-flex" style={{ marginLeft: ti > 0 ? 1 : 0 }}>
                <MiniTile code={code} />
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
