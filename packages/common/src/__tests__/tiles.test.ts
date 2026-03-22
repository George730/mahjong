// Tests for tile system: set generation, distribution, metadata, and shuffle

import { describe, it, expect } from "vitest";
import {
  createFullSet,
  shuffle,
  isBonusTile,
  sameFace,
  tileFaceToString,
  type Tile,
  type SuitedFace,
  type WindFace,
  type DragonFace,
  type SeasonFace,
  type FlowerFace,
} from "../tiles.js";

const fullSet = createFullSet();

describe("createFullSet", () => {
  it("contains exactly 144 tiles", () => {
    expect(fullSet).toHaveLength(144);
  });

  it("assigns unique sequential IDs 0–143", () => {
    const ids = fullSet.map((t) => t.id);
    expect(ids).toEqual(Array.from({ length: 144 }, (_, i) => i));
  });

  it("contains 108 suited tiles (3 suits × 9 ranks × 4 copies)", () => {
    const suited = fullSet.filter((t) => t.face.category === "suited");
    expect(suited).toHaveLength(108);
  });

  it("has each suited tile (wan/tiao/tong 1–9) exactly 4 times", () => {
    for (const suit of ["wan", "tiao", "tong"] as const) {
      for (let rank = 1; rank <= 9; rank++) {
        const count = fullSet.filter(
          (t) => t.face.category === "suited" && (t.face as SuitedFace).suit === suit && (t.face as SuitedFace).rank === rank,
        ).length;
        expect(count, `${suit}${rank} should appear 4 times`).toBe(4);
      }
    }
  });

  it("has each wind (东南西北) exactly 4 times", () => {
    for (const wind of ["east", "south", "west", "north"] as const) {
      const count = fullSet.filter(
        (t) => t.face.category === "wind" && (t.face as WindFace).wind === wind,
      ).length;
      expect(count, `${wind} should appear 4 times`).toBe(4);
    }
  });

  it("has each dragon (中发白) exactly 4 times", () => {
    for (const dragon of ["zhong", "fa", "bai"] as const) {
      const count = fullSet.filter(
        (t) => t.face.category === "dragon" && (t.face as DragonFace).dragon === dragon,
      ).length;
      expect(count, `${dragon} should appear 4 times`).toBe(4);
    }
  });

  it("has each season (春夏秋冬) exactly once", () => {
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      const count = fullSet.filter(
        (t) => t.face.category === "season" && (t.face as SeasonFace).season === season,
      ).length;
      expect(count, `${season} should appear once`).toBe(1);
    }
  });

  it("has each flower (梅兰竹菊) exactly once", () => {
    for (const flower of ["plum", "orchid", "bamboo", "chrysanthemum"] as const) {
      const count = fullSet.filter(
        (t) => t.face.category === "flower" && (t.face as FlowerFace).flower === flower,
      ).length;
      expect(count, `${flower} should appear once`).toBe(1);
    }
  });

  it("contains 16 wind tiles", () => {
    expect(fullSet.filter((t) => t.face.category === "wind")).toHaveLength(16);
  });

  it("contains 12 dragon tiles", () => {
    expect(fullSet.filter((t) => t.face.category === "dragon")).toHaveLength(12);
  });

  it("contains 4 season tiles", () => {
    expect(fullSet.filter((t) => t.face.category === "season")).toHaveLength(4);
  });

  it("contains 4 flower tiles", () => {
    expect(fullSet.filter((t) => t.face.category === "flower")).toHaveLength(4);
  });

  it("contains 8 bonus tiles total (4 seasons + 4 flowers)", () => {
    expect(fullSet.filter(isBonusTile)).toHaveLength(8);
  });
});

describe("tile metadata", () => {
  it("suited tiles have correct suit and rank", () => {
    const wan5s = fullSet.filter(
      (t) => t.face.category === "suited" && (t.face as SuitedFace).suit === "wan" && (t.face as SuitedFace).rank === 5,
    );
    expect(wan5s).toHaveLength(4);
    for (const t of wan5s) {
      expect(t.face.category).toBe("suited");
      expect((t.face as SuitedFace).suit).toBe("wan");
      expect((t.face as SuitedFace).rank).toBe(5);
    }
  });

  it("suited tile ranks are 1–9 only", () => {
    const ranks = fullSet
      .filter((t) => t.face.category === "suited")
      .map((t) => (t.face as SuitedFace).rank);
    for (const r of ranks) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(9);
    }
  });
});

describe("isBonusTile", () => {
  it("returns true for seasons and flowers", () => {
    const bonus = fullSet.filter(isBonusTile);
    expect(bonus).toHaveLength(8);
    for (const t of bonus) {
      expect(["season", "flower"]).toContain(t.face.category);
    }
  });

  it("returns false for suited, wind, and dragon tiles", () => {
    const nonBonus = fullSet.filter((t) => !isBonusTile(t));
    expect(nonBonus).toHaveLength(136);
  });
});

describe("sameFace", () => {
  it("matches identical suited faces", () => {
    const wan1s = fullSet.filter(
      (t) => t.face.category === "suited" && (t.face as SuitedFace).suit === "wan" && (t.face as SuitedFace).rank === 1,
    );
    expect(sameFace(wan1s[0].face, wan1s[1].face)).toBe(true);
  });

  it("does not match different suited faces", () => {
    const wan1 = fullSet.find(
      (t) => t.face.category === "suited" && (t.face as SuitedFace).suit === "wan" && (t.face as SuitedFace).rank === 1,
    )!;
    const wan2 = fullSet.find(
      (t) => t.face.category === "suited" && (t.face as SuitedFace).suit === "wan" && (t.face as SuitedFace).rank === 2,
    )!;
    expect(sameFace(wan1.face, wan2.face)).toBe(false);
  });

  it("does not match across categories", () => {
    const suited = fullSet.find((t) => t.face.category === "suited")!;
    const wind = fullSet.find((t) => t.face.category === "wind")!;
    expect(sameFace(suited.face, wind.face)).toBe(false);
  });

  it("matches identical wind faces", () => {
    const easts = fullSet.filter((t) => t.face.category === "wind" && (t.face as WindFace).wind === "east");
    expect(sameFace(easts[0].face, easts[1].face)).toBe(true);
  });

  it("matches identical dragon faces", () => {
    const zhongs = fullSet.filter((t) => t.face.category === "dragon" && (t.face as DragonFace).dragon === "zhong");
    expect(sameFace(zhongs[0].face, zhongs[1].face)).toBe(true);
  });
});

describe("tileFaceToString", () => {
  it("formats suited tiles as suit+rank", () => {
    const face: SuitedFace = { category: "suited", suit: "wan", rank: 5 };
    expect(tileFaceToString(face)).toBe("wan5");
  });

  it("formats wind tiles", () => {
    const face: WindFace = { category: "wind", wind: "east" };
    expect(tileFaceToString(face)).toBe("east");
  });

  it("formats dragon tiles", () => {
    const face: DragonFace = { category: "dragon", dragon: "zhong" };
    expect(tileFaceToString(face)).toBe("zhong");
  });

  it("formats season tiles", () => {
    const face: SeasonFace = { category: "season", season: "spring" };
    expect(tileFaceToString(face)).toBe("spring");
  });

  it("formats flower tiles", () => {
    const face: FlowerFace = { category: "flower", flower: "plum" };
    expect(tileFaceToString(face)).toBe("plum");
  });
});

describe("shuffle", () => {
  it("returns exactly 144 tiles", () => {
    const shuffled = shuffle(fullSet);
    expect(shuffled).toHaveLength(144);
  });

  it("contains the same tile faces as the original set", () => {
    const shuffled = shuffle(fullSet);
    const originalFaces = fullSet.map((t) => tileFaceToString(t.face)).sort();
    const shuffledFaces = shuffled.map((t) => tileFaceToString(t.face)).sort();
    expect(shuffledFaces).toEqual(originalFaces);
  });

  it("assigns sequential IDs 0–143", () => {
    const shuffled = shuffle(fullSet);
    expect(shuffled.map((t) => t.id)).toEqual(Array.from({ length: 144 }, (_, i) => i));
  });

  it("produces a different ordering (probabilistic)", () => {
    const shuffled = shuffle(fullSet);
    const originalFaces = fullSet.map((t) => tileFaceToString(t.face));
    const shuffledFaces = shuffled.map((t) => tileFaceToString(t.face));
    // It's astronomically unlikely that a shuffle preserves the exact same order
    expect(shuffledFaces).not.toEqual(originalFaces);
  });

  it("two shuffles produce different orderings", () => {
    const a = shuffle(fullSet).map((t) => tileFaceToString(t.face));
    const b = shuffle(fullSet).map((t) => tileFaceToString(t.face));
    expect(a).not.toEqual(b);
  });

  it("does not mutate the original array", () => {
    const original = createFullSet();
    const originalIds = original.map((t) => t.id);
    shuffle(original);
    expect(original.map((t) => t.id)).toEqual(originalIds);
  });
});
