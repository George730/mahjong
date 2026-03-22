// Renders a single mahjong tile as a styled div with Chinese characters

import type { TileFace } from "@mahjong/common";

interface TileRendererProps {
  face: TileFace;
  onClick?: () => void;
  selected?: boolean;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { w: "w-8", h: "h-10", text: "text-xs", sub: "text-[8px]" },
  md: { w: "w-10", h: "h-14", text: "text-sm", sub: "text-[10px]" },
  lg: { w: "w-12", h: "h-16", text: "text-base", sub: "text-xs" },
};

const SUIT_CHARS: Record<string, string> = {
  wan: "万",
  tiao: "条",
  tong: "筒",
};

const SUIT_COLORS: Record<string, string> = {
  wan: "text-red-600",
  tiao: "text-green-600",
  tong: "text-blue-600",
};

const RANK_CHARS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const WIND_CHARS: Record<string, string> = {
  east: "東",
  south: "南",
  west: "西",
  north: "北",
};

const DRAGON_CHARS: Record<string, { char: string; color: string }> = {
  zhong: { char: "中", color: "text-red-600" },
  fa: { char: "發", color: "text-green-600" },
  bai: { char: "白", color: "text-blue-600" },
};

const SEASON_CHARS: Record<string, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

const FLOWER_CHARS: Record<string, string> = {
  plum: "梅",
  orchid: "蘭",
  bamboo: "竹",
  chrysanthemum: "菊",
};

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
    case "dragon":
      return (
        <span className={`${textSize} ${DRAGON_CHARS[face.dragon].color}`}>
          {DRAGON_CHARS[face.dragon].char}
        </span>
      );
    case "season":
      return <span className={`${textSize} text-amber-600`}>{SEASON_CHARS[face.season]}</span>;
    case "flower":
      return <span className={`${textSize} text-pink-600`}>{FLOWER_CHARS[face.flower]}</span>;
  }
}

export default function TileRenderer({ face, onClick, selected, faceDown, size = "md" }: TileRendererProps) {
  const s = SIZES[size];

  if (faceDown) {
    return (
      <div className={`${s.w} ${s.h} rounded-sm bg-emerald-800 border border-emerald-900 shadow-sm`} />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${s.w} ${s.h} rounded-sm border bg-amber-50 shadow-sm flex items-center justify-center
        ${onClick ? "cursor-pointer hover:bg-amber-100 active:bg-amber-200" : ""}
        ${selected ? "border-yellow-400 ring-1 ring-yellow-400 -translate-y-1" : "border-stone-300"}
      `}
    >
      {renderFace(face, s.text, s.sub)}
    </div>
  );
}
