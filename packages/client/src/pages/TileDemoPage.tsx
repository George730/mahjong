// Dev-only page to preview all tile renders

import { createFullSet, type TileFace } from "@mahjong/common";
import TileRenderer from "../components/TileRenderer.tsx";

const allTiles = createFullSet();

// Deduplicate faces for display — show one of each
function uniqueFaces(): TileFace[] {
  const seen = new Set<string>();
  const faces: TileFace[] = [];
  for (const t of allTiles) {
    const key = JSON.stringify(t.face);
    if (!seen.has(key)) {
      seen.add(key);
      faces.push(t.face);
    }
  }
  return faces;
}

const faces = uniqueFaces();

export default function TileDemoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Tile Preview (all 42 unique faces)</h1>

      <div>
        <h2 className="text-sm text-gray-400 mb-2">Small</h2>
        <div className="flex flex-wrap gap-1">
          {faces.map((f, i) => (
            <TileRenderer key={i} face={f} size="sm" />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm text-gray-400 mb-2">Medium (default)</h2>
        <div className="flex flex-wrap gap-1">
          {faces.map((f, i) => (
            <TileRenderer key={i} face={f} size="md" />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm text-gray-400 mb-2">Large</h2>
        <div className="flex flex-wrap gap-1">
          {faces.map((f, i) => (
            <TileRenderer key={i} face={f} size="lg" />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm text-gray-400 mb-2">Selected + Face Down</h2>
        <div className="flex gap-2 items-end">
          <TileRenderer face={faces[0]} selected />
          <TileRenderer face={faces[4]} selected size="lg" />
          <TileRenderer face={faces[0]} faceDown />
          <TileRenderer face={faces[0]} faceDown size="lg" />
        </div>
      </div>
    </div>
  );
}
