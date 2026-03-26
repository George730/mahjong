// Shared Chinese character and color maps for mahjong tile rendering.
// Used by both the 2D TileRenderer and 3D tileTextures.

/** Suit name characters. */
export const SUIT_CHARS: Record<string, string> = { wan: "万", tiao: "条", tong: "筒" };

/** Suit hex colors (red wan, green tiao, blue tong). */
export const SUIT_HEX: Record<string, string> = {
  wan: "#dc2626",
  tiao: "#15803d",
  tong: "#2563eb",
};

/** Suit Tailwind text color classes. */
export const SUIT_TW: Record<string, string> = {
  wan: "text-red-600",
  tiao: "text-green-700",
  tong: "text-blue-600",
};

/** Rank characters (1–9). */
export const RANK_CHARS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** Wind characters (traditional). */
export const WIND_CHARS: Record<string, string> = { east: "東", south: "南", west: "西", north: "北" };

/** Dragon characters with hex colors. */
export const DRAGON_MAP: Record<string, { char: string; hex: string; tw: string }> = {
  zhong: { char: "中", hex: "#dc2626", tw: "text-red-600" },
  fa: { char: "發", hex: "#15803d", tw: "text-green-700" },
  bai: { char: "白", hex: "#2563eb", tw: "text-blue-600" },
};

/** Season characters. */
export const SEASON_CHARS: Record<string, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

/** Flower characters. */
export const FLOWER_CHARS: Record<string, string> = { plum: "梅", orchid: "蘭", bamboo: "竹", chrysanthemum: "菊" };
