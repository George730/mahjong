// Tile definitions, full 144-tile set generation, and shuffle for Chinese Standard Mahjong

// --- Suit and category enums ---

export type Suit = "wan" | "tiao" | "tong";
export type Wind = "east" | "south" | "west" | "north";
export type Dragon = "zhong" | "fa" | "bai";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Flower = "plum" | "orchid" | "bamboo" | "chrysanthemum";

export type TileCategory = "suited" | "wind" | "dragon" | "season" | "flower";

// --- Tile face (the logical identity, ignoring duplicates) ---

export interface SuitedFace {
  category: "suited";
  suit: Suit;
  rank: number; // 1–9
}

export interface WindFace {
  category: "wind";
  wind: Wind;
}

export interface DragonFace {
  category: "dragon";
  dragon: Dragon;
}

export interface SeasonFace {
  category: "season";
  season: Season;
}

export interface FlowerFace {
  category: "flower";
  flower: Flower;
}

export type TileFace = SuitedFace | WindFace | DragonFace | SeasonFace | FlowerFace;

// --- Tile instance (unique in a set, identified by id) ---

export interface Tile {
  id: number; // unique within a set, 0–143
  face: TileFace;
}

// --- Helpers to check tile properties ---

export function isBonusTile(tile: Tile): boolean {
  return tile.face.category === "season" || tile.face.category === "flower";
}

export function sameFace(a: TileFace, b: TileFace): boolean {
  if (a.category !== b.category) return false;
  switch (a.category) {
    case "suited":
      return a.suit === (b as SuitedFace).suit && a.rank === (b as SuitedFace).rank;
    case "wind":
      return a.wind === (b as WindFace).wind;
    case "dragon":
      return a.dragon === (b as DragonFace).dragon;
    case "season":
      return a.season === (b as SeasonFace).season;
    case "flower":
      return a.flower === (b as FlowerFace).flower;
  }
}

/** Short display string for debugging/logging (e.g. "wan5", "east", "zhong", "spring") */
export function tileFaceToString(face: TileFace): string {
  switch (face.category) {
    case "suited":
      return `${face.suit}${face.rank}`;
    case "wind":
      return face.wind;
    case "dragon":
      return face.dragon;
    case "season":
      return face.season;
    case "flower":
      return face.flower;
  }
}

// --- Set generation ---

const SUITS: Suit[] = ["wan", "tiao", "tong"];
const WINDS: Wind[] = ["east", "south", "west", "north"];
const DRAGONS: Dragon[] = ["zhong", "fa", "bai"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const FLOWERS: Flower[] = ["plum", "orchid", "bamboo", "chrysanthemum"];

/** Creates the full 144-tile set in a fixed, deterministic order. */
export function createFullSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;

  // Suited tiles: 3 suits × 9 ranks × 4 copies = 108
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: id++, face: { category: "suited", suit, rank } });
      }
    }
  }

  // Wind tiles: 4 winds × 4 copies = 16
  for (const wind of WINDS) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, face: { category: "wind", wind } });
    }
  }

  // Dragon tiles: 3 dragons × 4 copies = 12
  for (const dragon of DRAGONS) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, face: { category: "dragon", dragon } });
    }
  }

  // Season tiles: 4 × 1 = 4
  for (const season of SEASONS) {
    tiles.push({ id: id++, face: { category: "season", season } });
  }

  // Flower tiles: 4 × 1 = 4
  for (const flower of FLOWERS) {
    tiles.push({ id: id++, face: { category: "flower", flower } });
  }

  return tiles;
}

/** Fisher-Yates shuffle. Returns a new array with reassigned sequential IDs. */
export function shuffle(tiles: Tile[]): Tile[] {
  const arr = tiles.map((t) => ({ ...t, face: { ...t.face } }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Reassign IDs so they reflect position in the shuffled array
  return arr.map((t, i) => ({ ...t, id: i }));
}
