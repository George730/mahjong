// Renders a single mahjong tile as a CSS 3D slab with Chinese characters.
// Three visible faces: top (cream/green), front edge (thickness), right edge (depth).

import type { TileFace } from "@mahjong/common";

export type TileSize = "sm" | "md" | "lg";

interface TileRendererProps {
  face?: TileFace; // omit for face-down tiles with no face data
  onClick?: () => void;
  selected?: boolean;
  faceDown?: boolean;
  size?: TileSize;
}

// Pixel dimensions for each size
const DIMS = {
  sm: { w: 28, h: 36, depth: 4, text: "text-[10px]", sub: "text-[7px]" },
  md: { w: 36, h: 50, depth: 5, text: "text-sm", sub: "text-[9px]" },
  lg: { w: 44, h: 60, depth: 6, text: "text-base", sub: "text-xs" },
} as const;

const SUIT_CHARS: Record<string, string> = { wan: "万", tiao: "条", tong: "筒" };
const SUIT_COLORS: Record<string, string> = {
  wan: "text-red-600",
  tiao: "text-green-700",
  tong: "text-blue-600",
};
const RANK_CHARS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const WIND_CHARS: Record<string, string> = { east: "東", south: "南", west: "西", north: "北" };
const DRAGON_CHARS: Record<string, { char: string; color: string }> = {
  zhong: { char: "中", color: "text-red-600" },
  fa: { char: "發", color: "text-green-700" },
  bai: { char: "白", color: "text-blue-600" },
};
const SEASON_CHARS: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
const FLOWER_CHARS: Record<string, string> = { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" };

function renderFace(face: TileFace, textSize: string, subSize: string) {
  switch (face.category) {
    case "suited":
      return (
        <div className={`flex flex-col items-center leading-tight ${SUIT_COLORS[face.suit]}`}>
          <span className={textSize}>{RANK_CHARS[face.rank - 1]}</span>
          <span className={subSize}>{SUIT_CHARS[face.suit]}</span>
        </div>
      );
    case "wind":
      return <span className={`${textSize} text-gray-800`}>{WIND_CHARS[face.wind]}</span>;
    case "dragon": {
      const d = DRAGON_CHARS[face.dragon];
      return <span className={`${textSize} ${d.color}`}>{d.char}</span>;
    }
    case "season":
      return <span className={`${textSize} text-amber-600`}>{SEASON_CHARS[face.season]}</span>;
    case "flower":
      return <span className={`${textSize} text-pink-600`}>{FLOWER_CHARS[face.flower]}</span>;
  }
}

export default function TileRenderer({ face, onClick, selected, faceDown, size = "md" }: TileRendererProps) {
  const d = DIMS[size];
  const showBack = faceDown || !face;

  // Colors for face-up vs face-down
  const topBg = showBack ? "#166534" : "#fffbeb"; // emerald-800 / amber-50
  const frontBg = showBack ? "#14532d" : "#d6d3c4"; // darker shade for thickness
  const rightBg = showBack ? "#15803d" : "#e7e5d8"; // side edge

  return (
    <div
      onClick={onClick}
      style={{
        width: d.w,
        height: d.h,
        perspective: 200,
        cursor: onClick ? "pointer" : undefined,
      }}
      className={`relative inline-block shrink-0 transition-transform duration-150
        ${selected ? "-translate-y-2" : ""}
        ${onClick ? "hover:-translate-y-0.5" : ""}
      `}
    >
      {/* 3D container */}
      <div
        style={{
          width: d.w,
          height: d.h,
          transformStyle: "preserve-3d",
          transform: "rotateX(8deg) rotateY(-3deg)",
        }}
        className="relative"
      >
        {/* Top face */}
        <div
          style={{
            width: d.w,
            height: d.h,
            backgroundColor: topBg,
            transform: `translateZ(${d.depth}px)`,
            borderRadius: 2,
          }}
          className={`absolute inset-0 flex items-center justify-center border
            ${selected ? "border-yellow-400 ring-1 ring-yellow-400" : showBack ? "border-emerald-900/50" : "border-stone-300"}
          `}
        >
          {!showBack && face && renderFace(face, d.text, d.sub)}
          {showBack && (
            <div
              className="rounded-[1px]"
              style={{
                width: d.w - 8,
                height: d.h - 8,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            />
          )}
        </div>

        {/* Front edge (bottom thickness) */}
        <div
          style={{
            width: d.w,
            height: d.depth,
            backgroundColor: frontBg,
            transform: `rotateX(-90deg) translateZ(${d.h - d.depth}px) translateY(-${d.depth}px)`,
            transformOrigin: "top",
            borderRadius: "0 0 1px 1px",
          }}
          className="absolute top-0 left-0"
        />

        {/* Right edge (side thickness) */}
        <div
          style={{
            width: d.depth,
            height: d.h,
            backgroundColor: rightBg,
            transform: `rotateY(90deg) translateZ(${d.w - d.depth}px) translateX(-${d.depth}px)`,
            transformOrigin: "left",
            borderRadius: "0 1px 1px 0",
          }}
          className="absolute top-0 left-0"
        />
      </div>
    </div>
  );
}
