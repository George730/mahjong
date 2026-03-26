// Dev page to preview the Three.js scene — table, lighting, and tile layouts.
//
// Two modes:
// 1. "static" — original hardcoded layout (no store dependency)
// 2. "store" — HandLayout wired to Zustand game-store with mock game state
//
// Toggle with the button below the canvas.

import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { createFullSet, shuffle, type TileFace, type Tile, type PlayerGameView } from "@mahjong/common";
import SceneLighting from "../components/three/SceneLighting.tsx";
import TableMesh from "../components/three/TableMesh.tsx";
import TileMesh from "../components/three/TileMesh.tsx";
import { GAP, TABLE_EDGE, ROW_LEFT } from "../components/three/layout-constants.ts";
import HandLayout from "../components/three/HandLayout.tsx";
import TableOverlays from "../components/three/TableOverlays.tsx";
import { useGameStore } from "../stores/game-store.ts";
import { useRoomStore } from "../stores/room-store.ts";

// --- Static demo helpers ---

function uniqueFaces(): TileFace[] {
  const seen = new Set<string>();
  const faces: TileFace[] = [];
  for (const t of createFullSet()) {
    const key = JSON.stringify(t.face);
    if (!seen.has(key)) {
      seen.add(key);
      faces.push(t.face);
    }
  }
  return faces;
}

const allFaces = uniqueFaces();

const HAND_COUNT = 14;       // dealer hand
const OPP_COUNT = 13;        // non-dealer opponents

// --- Static demo scene (original) ---

function StaticDemoScene({ selectedIndex, onSelect }: { selectedIndex: number | null; onSelect: (i: number | null) => void }) {
  return (
    <>
      {/* Bottom player (you) — tiles lie flat, face-up, left to right */}
      {allFaces.slice(0, HAND_COUNT).map((face, i) => (
        <TileMesh
          key={`hand-${i}`}
          face={face}
          flat
          position={[ROW_LEFT + i * GAP, 0, TABLE_EDGE]}
          selected={selectedIndex === i}
          interactive
          onClick={() => onSelect(selectedIndex === i ? null : i)}
        />
      ))}

      {/* Top opponent */}
      {Array.from({ length: OPP_COUNT }, (_, i) => (
        <TileMesh
          key={`opp-${i}`}
          face={allFaces[i]}
          position={[-ROW_LEFT - i * GAP, 0, -TABLE_EDGE]}
          rotationY={Math.PI}
          interactive={false}
        />
      ))}

      {/* Left opponent */}
      {Array.from({ length: OPP_COUNT }, (_, i) => (
        <TileMesh
          key={`left-${i}`}
          face={allFaces[i]}
          position={[-TABLE_EDGE, 0, ROW_LEFT + i * GAP]}
          rotationY={-Math.PI / 2}
          interactive={false}
        />
      ))}

      {/* Right opponent */}
      {Array.from({ length: OPP_COUNT }, (_, i) => (
        <TileMesh
          key={`right-${i}`}
          face={allFaces[i]}
          position={[TABLE_EDGE, 0, -ROW_LEFT - i * GAP]}
          rotationY={Math.PI / 2}
          interactive={false}
        />
      ))}

      {/* Discarded tiles in center */}
      {allFaces.slice(14, 20).map((face, i) => (
        <TileMesh
          key={`center-${i}`}
          face={face}
          position={[-1.2 + i * GAP, 0, 0]}
          rotationY={0}
          interactive={false}
        />
      ))}
    </>
  );
}

// --- Store-driven demo (HandLayout) ---

/** Seed the game store and room store with mock data so HandLayout + TableOverlays render. */
function useMockGameState() {
  const gameStore = useGameStore;
  const roomStore = useRoomStore;

  useEffect(() => {
    const tiles = shuffle(createFullSet());

    // Deal: seat 0 (dealer) gets 14, pick out some bonus tiles for demo
    const hand: Tile[] = tiles.slice(0, 14);
    const bonusPool = tiles.filter((t) => t.face.category === "season" || t.face.category === "flower");
    const myBonus = bonusPool.slice(0, 2);
    const opp1Bonus = bonusPool.slice(2, 4);
    const opp2Bonus = bonusPool.slice(4, 5);
    const opp3Bonus = bonusPool.slice(5, 7);

    const mockView: PlayerGameView = {
      phase: "playing",
      hand,
      bonusTiles: myBonus,
      players: [
        { userId: "me", seatIndex: 0, handCount: 14, bonusTiles: myBonus, discards: [], melds: [] },
        { userId: "opp1", seatIndex: 1, handCount: 13, bonusTiles: opp1Bonus, discards: [], melds: [] },
        { userId: "opp2", seatIndex: 2, handCount: 13, bonusTiles: opp2Bonus, discards: [], melds: [] },
        { userId: "opp3", seatIndex: 3, handCount: 13, bonusTiles: opp3Bonus, discards: [], melds: [] },
      ],
      wallCount: 88,
      currentTurn: 0,
      dealer: 0,
      roundWind: "east",
      turnCount: 0,
    };

    gameStore.setState({
      gameView: mockView,
      handOrder: hand.map((t) => t.id),
      mySeatIndex: 0,
      selectedTileId: null,
      opponentHands: {},
    });

    // Mock room data so TableOverlays can resolve usernames
    roomStore.setState({
      room: {
        code: "DEMO",
        hostId: "me",
        status: "playing",
        createdAt: new Date().toISOString(),
        players: [
          { userId: "me", username: "You", isGuest: false, seatIndex: 0 },
          { userId: "opp1", username: "Alice", isGuest: false, seatIndex: 1 },
          { userId: "opp2", username: "Bob", isGuest: false, seatIndex: 2 },
          { userId: "opp3", username: "Charlie", isGuest: false, seatIndex: 3 },
        ],
      },
    });

    return () => {
      gameStore.getState().reset();
      roomStore.setState({ room: null });
    };
  }, []);
}

function StoreDemoScene() {
  useMockGameState();
  return (
    <>
      <HandLayout />
      <TableOverlays />
    </>
  );
}

// --- Page ---

export default function SceneDemoPage() {
  const [mode, setMode] = useState<"static" | "store">("store");
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="max-w-5xl mx-auto mt-4 px-4">
      <h1 className="text-xl font-bold mb-2">Three.js Scene Demo</h1>
      <p className="text-sm text-gray-400 mb-2">
        Each side holds up to 18 tiles. Bottom = your hand (flat, face-up). Others = opponents (standing, face outward).
      </p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("static")}
          className={`px-3 py-1 rounded text-xs ${mode === "static" ? "bg-emerald-700 text-white" : "bg-gray-700 text-gray-300"}`}
        >
          Static Layout
        </button>
        <button
          onClick={() => setMode("store")}
          className={`px-3 py-1 rounded text-xs ${mode === "store" ? "bg-emerald-700 text-white" : "bg-gray-700 text-gray-300"}`}
        >
          Store-driven (HandLayout)
        </button>
      </div>
      <div style={{ width: "100%", aspectRatio: "4 / 3" }}>
        <Canvas
          shadows
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
          }}
          style={{ borderRadius: 12 }}
        >
          <PerspectiveCamera
            makeDefault
            position={[0, 8, 9]}
            fov={45}
            near={0.1}
            far={100}
            rotation={[-0.72, 0, 0]}
          />
          <color attach="background" args={["#0d1a12"]} />
          <SceneLighting />
          <TableMesh />
          {mode === "static" ? (
            <StaticDemoScene selectedIndex={selected} onSelect={setSelected} />
          ) : (
            <StoreDemoScene />
          )}
        </Canvas>
      </div>
      {mode === "static" && (
        <p className="text-xs text-gray-500 mt-2">
          Selected tile: {selected !== null ? selected : "none"}
        </p>
      )}
      {mode === "store" && (
        <p className="text-xs text-gray-500 mt-2">
          Click tiles to select. Drag across tiles to reorder.
        </p>
      )}
    </div>
  );
}
