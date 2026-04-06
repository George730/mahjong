// Dev page to preview the Three.js scene — table, lighting, and tile layouts.
//
// Two modes:
// 1. "static" — original hardcoded layout (no store dependency)
// 2. "store" — HandLayout wired to Zustand game-store with mock game state
//
// Toggle with the button below the canvas.
// In "store" mode, a scenario selector lets you preview different game states:
// normal play, chow/pung/kong claiming, and after-meld display.

import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import {
  createFullSet, shuffle, type TileFace, type Tile, type Meld, type PlayerGameView, type PublicPlayerState, sameFace,
  TEST_SCENARIOS, buildWinContext, parseTiles, parseMeldNotation, tileIndex, indexToFace, scoreHandFull,
  type TestScenario, type RoundResult, type FanMatch,
} from "@mahjong/common";
import SceneLighting from "../components/three/SceneLighting.tsx";
import TableMesh from "../components/three/TableMesh.tsx";
import TileMesh from "../components/three/TileMesh.tsx";
import { GAP, TABLE_EDGE, ROW_LEFT } from "../components/three/layout-constants.ts";
import HandLayout from "../components/three/HandLayout.tsx";
import TableOverlays from "../components/three/TableOverlays.tsx";
import { useGameStore } from "../stores/game-store.ts";
import { useRoomStore } from "../stores/room-store.ts";
import SidePanel from "../components/SidePanel.tsx";

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

// --- Scenario types ---

type DemoScenario =
  | "normal"
  | "chow-claiming"
  | "pung-claiming"
  | "open-kong-claiming"
  | "closed-kong"
  | "after-chow"
  | "after-pung"
  | "after-open-kong"
  | "after-closed-kong"
  | "hu-test";

const SCENARIO_LABELS: Record<DemoScenario, string> = {
  "normal": "Normal Play",
  "chow-claiming": "Chow Claiming",
  "pung-claiming": "Pung Claiming",
  "open-kong-claiming": "Open Kong Claiming",
  "closed-kong": "Closed Kong Available",
  "after-chow": "After Chow (meld)",
  "after-pung": "After Pung (meld)",
  "after-open-kong": "After Open Kong (meld)",
  "after-closed-kong": "After Closed Kong (meld)",
  "hu-test": "Hu Test",
};

// --- Mock data builders ---

/** Find tiles from a pool that match a specific face. */
function findTiles(pool: Tile[], face: TileFace, count: number): Tile[] {
  return pool.filter((t) => sameFace(t.face, face)).slice(0, count);
}

/** Build mock game state for a given scenario. */
function buildMockState(scenario: DemoScenario): {
  mockView: PlayerGameView;
  handOrder: number[];
  highlightedTileIds: number[];
  availableClaims: ReturnType<typeof useGameStore.getState>["availableClaims"];
} {
  const tiles = shuffle(createFullSet());

  // Base: non-bonus suited tiles for controllable scenarios
  const suitedTiles = tiles.filter((t) => t.face.category === "suited");
  const bonusPool = tiles.filter((t) => t.face.category === "season" || t.face.category === "flower");

  // Shared state
  const myBonus = bonusPool.slice(0, 2);
  const opp1Bonus = bonusPool.slice(2, 4);

  const basePlayers = (handCount: number, melds: Meld[][] = [[], [], [], []]): PublicPlayerState[] => [
    { userId: "me", seatIndex: 0, handCount, hasDrawnTile: false, bonusTiles: myBonus, discards: [], melds: melds[0] },
    { userId: "opp1", seatIndex: 1, handCount: 13, hasDrawnTile: false, bonusTiles: opp1Bonus, discards: [], melds: melds[1] },
    { userId: "opp2", seatIndex: 2, handCount: 13, hasDrawnTile: false, bonusTiles: [], discards: [], melds: melds[2] },
    { userId: "opp3", seatIndex: 3, handCount: 13, hasDrawnTile: false, bonusTiles: [], discards: [], melds: melds[3] },
  ];

  switch (scenario) {
    case "normal": {
      const hand = suitedTiles.slice(0, 14);
      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(14), wallCount: 88,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 0, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }

    case "chow-claiming": {
      // Seat 3 (left of seat 0) discarded wan5, we have wan4 and wan6
      const wan4Tiles = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 4 }, 1);
      const wan6Tiles = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 6 }, 1);
      const wan3Tiles = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 3 }, 1);
      const wan5Tiles = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 5 }, 1);
      const otherHand = suitedTiles.filter(
        (t) => !wan4Tiles.includes(t) && !wan6Tiles.includes(t) && !wan3Tiles.includes(t) && !wan5Tiles.includes(t),
      ).slice(0, 10);
      const hand = [...wan3Tiles, ...wan4Tiles, ...wan6Tiles, ...otherHand];
      const discardTile = wan5Tiles[0];

      const players = basePlayers(hand.length);
      players[3].discards = [discardTile];

      const highlightedTileIds = [discardTile.id, ...wan4Tiles.map((t) => t.id), ...wan6Tiles.map((t) => t.id), ...wan3Tiles.map((t) => t.id)];

      return {
        mockView: {
          phase: "playing", turnPhase: "claiming", hand, drawnTile: null,
          bonusTiles: myBonus, players, wallCount: 86,
          currentTurn: 3, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 1,
          lastDiscard: { tile: discardTile, fromSeat: 3 },
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds,
        availableClaims: {
          chow: [
            { handTileIds: [wan3Tiles[0].id, wan4Tiles[0].id] },
            { handTileIds: [wan4Tiles[0].id, wan6Tiles[0].id] },
          ],
          pung: null, openKong: null, closedKong: [],
        },
      };
    }

    case "pung-claiming": {
      // Seat 1 discarded tong3, we have 2 tong3s
      const tong3Tiles = findTiles(suitedTiles, { category: "suited", suit: "tong", rank: 3 }, 3);
      const discardTile = tong3Tiles[2];
      const handMatching = tong3Tiles.slice(0, 2);
      const otherHand = suitedTiles.filter((t) => !tong3Tiles.includes(t)).slice(0, 11);
      const hand = [...handMatching, ...otherHand];

      const players = basePlayers(hand.length);
      players[1].discards = [discardTile];

      return {
        mockView: {
          phase: "playing", turnPhase: "claiming", hand, drawnTile: null,
          bonusTiles: myBonus, players, wallCount: 85,
          currentTurn: 1, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 2,
          lastDiscard: { tile: discardTile, fromSeat: 1 },
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [discardTile.id, ...handMatching.map((t) => t.id)],
        availableClaims: {
          chow: [],
          pung: { handTileIds: [handMatching[0].id, handMatching[1].id] },
          openKong: null, closedKong: [],
        },
      };
    }

    case "open-kong-claiming": {
      // Seat 2 discarded tiao7, we have 3 tiao7s
      const tiao7Tiles = findTiles(suitedTiles, { category: "suited", suit: "tiao", rank: 7 }, 4);
      const discardTile = tiao7Tiles[3];
      const handMatching = tiao7Tiles.slice(0, 3);
      const otherHand = suitedTiles.filter((t) => !tiao7Tiles.includes(t)).slice(0, 10);
      const hand = [...handMatching, ...otherHand];

      const players = basePlayers(hand.length);
      players[2].discards = [discardTile];

      return {
        mockView: {
          phase: "playing", turnPhase: "claiming", hand, drawnTile: null,
          bonusTiles: myBonus, players, wallCount: 84,
          currentTurn: 2, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 3,
          lastDiscard: { tile: discardTile, fromSeat: 2 },
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [discardTile.id, ...handMatching.map((t) => t.id)],
        availableClaims: {
          chow: [], pung: { handTileIds: [handMatching[0].id, handMatching[1].id] },
          openKong: { handTileIds: [handMatching[0].id, handMatching[1].id, handMatching[2].id] },
          closedKong: [],
        },
      };
    }

    case "closed-kong": {
      // Our turn, drew a tile that completes 4-of-a-kind
      const wan1Tiles = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 1 }, 4);
      const handKong = wan1Tiles.slice(0, 3);
      const drawnTile = wan1Tiles[3];
      const otherHand = suitedTiles.filter((t) => !wan1Tiles.includes(t)).slice(0, 10);
      const hand = [...handKong, ...otherHand];

      const players = basePlayers(hand.length);
      players[0].hasDrawnTile = true;

      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile,
          bonusTiles: myBonus, players, wallCount: 83,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 4,
          lastDiscard: null, roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: wan1Tiles.map((t) => t.id),
        availableClaims: {
          chow: [], pung: null, openKong: null,
          closedKong: [{ tileIds: wan1Tiles.map((t) => t.id), face: wan1Tiles[0].face }],
        },
      };
    }

    case "after-chow": {
      // Player has a chow meld
      const wan4 = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 4 }, 1);
      const wan5 = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 5 }, 1);
      const wan6 = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 6 }, 1);
      const chowMeld: Meld = { type: "chow", tiles: [...wan4, ...wan5, ...wan6], exposed: true, claimedTileId: wan5[0].id };

      const usedIds = new Set([...wan4, ...wan5, ...wan6].map((t) => t.id));
      const hand = suitedTiles.filter((t) => !usedIds.has(t.id)).slice(0, 11);

      const melds: Meld[][] = [[chowMeld], [], [], []];

      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(hand.length, melds), wallCount: 80,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 5, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }

    case "after-pung": {
      const tong5 = findTiles(suitedTiles, { category: "suited", suit: "tong", rank: 5 }, 3);
      const pungMeld: Meld = { type: "pung", tiles: tong5, exposed: true, claimedTileId: tong5[2].id };

      const usedIds = new Set(tong5.map((t) => t.id));
      const hand = suitedTiles.filter((t) => !usedIds.has(t.id)).slice(0, 11);

      const melds: Meld[][] = [[pungMeld], [], [], []];

      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(hand.length, melds), wallCount: 79,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 6, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }

    case "after-open-kong": {
      const tiao9 = findTiles(suitedTiles, { category: "suited", suit: "tiao", rank: 9 }, 4);
      const kongMeld: Meld = { type: "kong", tiles: tiao9, exposed: true, claimedTileId: tiao9[3].id };

      const usedIds = new Set(tiao9.map((t) => t.id));
      const hand = suitedTiles.filter((t) => !usedIds.has(t.id)).slice(0, 11);

      const melds: Meld[][] = [[kongMeld], [], [], []];

      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(hand.length, melds), wallCount: 77,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 7, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }

    case "after-closed-kong": {
      const wan2 = findTiles(suitedTiles, { category: "suited", suit: "wan", rank: 2 }, 4);
      const closedKongMeld: Meld = { type: "kong", tiles: wan2, exposed: false };

      const usedIds = new Set(wan2.map((t) => t.id));
      const hand = suitedTiles.filter((t) => !usedIds.has(t.id)).slice(0, 11);

      const melds: Meld[][] = [[closedKongMeld], [], [], []];

      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(hand.length, melds), wallCount: 76,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 8, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }

    case "hu-test": {
      // Handled by buildHuMockState — fallback to normal
      const hand = suitedTiles.slice(0, 14);
      return {
        mockView: {
          phase: "playing", turnPhase: "discard", hand, drawnTile: null,
          bonusTiles: myBonus, players: basePlayers(14), wallCount: 88,
          currentTurn: 0, dealer: 0, roundWind: "east", windRoundIndex: 0, handIndex: 0, turnCount: 0, lastDiscard: null,
          roundResult: null,
        },
        handOrder: hand.map((t) => t.id),
        highlightedTileIds: [],
        availableClaims: null,
      };
    }
  }
}

// --- Hu test scenario builder ---

/** Convert a TestScenario to a mock PlayerGameView with full scoring result. */
function buildHuMockState(testScenario: TestScenario): {
  mockView: PlayerGameView;
  handOrder: number[];
  highlightedTileIds: number[];
  availableClaims: ReturnType<typeof useGameStore.getState>["availableClaims"];
} {
  // Parse hand tiles into counts, then create Tile objects
  const counts = parseTiles(testScenario.hand);
  const declaredMelds = parseMeldNotation(testScenario.melds);
  const { winTileIdx, context: winContext } = buildWinContext(testScenario.ctx, declaredMelds.length);

  // Build Tile objects for the hand (including win tile)
  let nextId = 0;
  const handTiles: Tile[] = [];
  for (let idx = 0; idx < 34; idx++) {
    for (let c = 0; c < counts[idx]; c++) {
      handTiles.push({ id: nextId++, face: indexToFace(idx) });
    }
  }
  // The win tile is the drawn tile (shown separately)
  const drawnTile: Tile = { id: nextId++, face: indexToFace(winTileIdx) };

  // Build exposed melds as Meld objects
  const meldObjects: Meld[] = declaredMelds.map((m) => {
    const tiles: Tile[] = m.tileIndices.map((idx) => ({ id: nextId++, face: indexToFace(idx) }));
    return {
      type: m.type,
      tiles,
      exposed: !m.concealed,
      ...(m.concealed ? {} : { claimedTileId: tiles[tiles.length - 1].id }),
    };
  });

  // Run the scoring engine
  const fullCounts = [...counts];
  fullCounts[winTileIdx]++;
  const scoringResult = scoreHandFull(fullCounts, declaredMelds, winTileIdx, winContext);

  // Build RoundResult
  const roundResult: RoundResult = scoringResult.isWin ? {
    type: "hu",
    winnerSeat: 0,
    discarderSeat: winContext.winSource === "discard" ? 3 : undefined,
    winSource: winContext.winSource,
    scoring: {
      fans: scoringResult.result!.fans,
      fanScore: scoringResult.result!.fanScore,
      bonusScore: scoringResult.result!.bonusScore,
      totalScore: scoringResult.result!.totalScore,
    },
  } : { type: "draw" };

  const bonusCount = testScenario.ctx.bonusTileCount ?? 0;
  const flowerNames = ["plum", "orchid", "bamboo", "chrysanthemum"] as const;
  const bonusTiles: Tile[] = Array.from({ length: bonusCount }, (_, i) => ({
    id: nextId++,
    face: { category: "flower" as const, flower: flowerNames[i % 4] },
  }));

  const players: PublicPlayerState[] = [
    { userId: "me", seatIndex: 0, handCount: handTiles.length, hasDrawnTile: true, bonusTiles, discards: [], melds: meldObjects },
    { userId: "opp1", seatIndex: 1, handCount: 13, hasDrawnTile: false, bonusTiles: [], discards: [], melds: [] },
    { userId: "opp2", seatIndex: 2, handCount: 13, hasDrawnTile: false, bonusTiles: [], discards: [], melds: [] },
    { userId: "opp3", seatIndex: 3, handCount: 13, hasDrawnTile: false, bonusTiles: [], discards: [], melds: [] },
  ];

  return {
    mockView: {
      phase: "playing", turnPhase: "discard",
      hand: handTiles, drawnTile,
      bonusTiles, players, wallCount: testScenario.ctx.wallCount ?? 40,
      currentTurn: 0, dealer: 0, roundWind: testScenario.ctx.roundWind ?? "east",
      windRoundIndex: 0, handIndex: 0, turnCount: 10, lastDiscard: null,
      roundResult,
    },
    handOrder: handTiles.map((t) => t.id),
    highlightedTileIds: [drawnTile.id],
    availableClaims: null,
  };
}

// --- Store-driven demo (HandLayout) ---

/** Seed the game store and room store with mock data so HandLayout + TableOverlays render. */
function useMockGameState(scenario: DemoScenario, huScenarioIndex: number) {
  const gameStore = useGameStore;
  const roomStore = useRoomStore;

  useEffect(() => {
    const { mockView, handOrder, highlightedTileIds, availableClaims } =
      scenario === "hu-test" && TEST_SCENARIOS[huScenarioIndex]
        ? buildHuMockState(TEST_SCENARIOS[huScenarioIndex])
        : buildMockState(scenario);

    gameStore.setState({
      gameView: mockView,
      handOrder,
      mySeatIndex: 0,
      selectedTileId: null,
      opponentHands: {},
      highlightedTileIds,
      availableClaims,
      selectedChowOption: null,
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
  }, [scenario, huScenarioIndex]);
}

function StoreDemoScene({ scenario, huScenarioIndex }: { scenario: DemoScenario; huScenarioIndex: number }) {
  useMockGameState(scenario, huScenarioIndex);
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
  const [scenario, setScenario] = useState<DemoScenario>("normal");
  const [huScenarioIndex, setHuScenarioIndex] = useState(0);
  const [huFilter, setHuFilter] = useState("");
  const [huResult, setHuResult] = useState<{ fans: FanMatch[]; fanScore: number; bonusScore: number; totalScore: number; pass: boolean } | null>(null);

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
      {mode === "store" && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(Object.keys(SCENARIO_LABELS) as DemoScenario[]).map((key) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={`px-2 py-1 rounded text-xs ${
                scenario === key ? "bg-cyan-700 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {SCENARIO_LABELS[key]}
            </button>
          ))}
        </div>
      )}
      {mode === "store" && scenario === "hu-test" && (
        <div className="mb-3 p-2 bg-gray-900/60 rounded border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Hu Scenario:</span>
            <input
              type="text"
              value={huFilter}
              onChange={(e) => setHuFilter(e.target.value)}
              placeholder="Filter..."
              className="flex-1 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200"
            />
          </div>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {TEST_SCENARIOS.map((s, i) => {
              if (huFilter && !s.name.toLowerCase().includes(huFilter.toLowerCase())
                && !s.expected.some(e => e.includes(huFilter))) return null;
              return (
                <button
                  key={i}
                  onClick={() => { setHuScenarioIndex(i); setHuResult(null); }}
                  className={`px-2 py-0.5 rounded text-xs ${
                    huScenarioIndex === i ? "bg-red-700 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  title={s.expected.join(", ")}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          {TEST_SCENARIOS[huScenarioIndex] && (
            <div className="mt-2 flex items-center gap-3">
              <div className="text-xs text-gray-400 flex-1">
                <span className="text-gray-200 font-medium">{TEST_SCENARIOS[huScenarioIndex].name}</span>
                {" — expected: "}
                {TEST_SCENARIOS[huScenarioIndex].expected.join(", ")}
              </div>
              <button
                onClick={() => {
                  const s = TEST_SCENARIOS[huScenarioIndex];
                  const counts = parseTiles(s.hand);
                  const declaredMelds = parseMeldNotation(s.melds);
                  const { winTileIdx, context } = buildWinContext(s.ctx, declaredMelds.length);
                  counts[winTileIdx]++;
                  const r = scoreHandFull(counts, declaredMelds, winTileIdx, context);
                  if (r.isWin) {
                    const actualNames = r.result!.fans.flatMap(f => Array.from({ length: f.count }, () => f.fan)).sort();
                    const expectedNames = [...s.expected].sort();
                    setHuResult({
                      fans: r.result!.fans,
                      fanScore: r.result!.fanScore,
                      bonusScore: r.result!.bonusScore,
                      totalScore: r.result!.totalScore,
                      pass: JSON.stringify(actualNames) === JSON.stringify(expectedNames),
                    });
                  } else {
                    setHuResult({ fans: [], fanScore: 0, bonusScore: 0, totalScore: 0, pass: false });
                  }
                }}
                className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm font-bold shrink-0"
              >
                Hu!
              </button>
            </div>
          )}
        </div>
      )}
      {/* Fan reference panel — fixed to right edge of viewport */}
      <SidePanel />

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
            <StoreDemoScene scenario={scenario} huScenarioIndex={huScenarioIndex} />
          )}
        </Canvas>
      </div>
      {mode === "static" && (
        <p className="text-xs text-gray-500 mt-2">
          Selected tile: {selected !== null ? selected : "none"}
        </p>
      )}
      {mode === "store" && scenario !== "hu-test" && (
        <p className="text-xs text-gray-500 mt-2">
          Scenario: {SCENARIO_LABELS[scenario]}. Click tiles to select. Drag across tiles to reorder.
          {scenario === "after-closed-kong" && " Hover over the face-down meld to reveal tiles (your closed kong only)."}
        </p>
      )}
      {mode === "store" && scenario === "hu-test" && huResult && (
        <div className="mt-3 p-3 bg-gray-900/60 rounded border border-gray-700">
          {huResult.fans.length === 0 ? (
            <p className="text-red-400 text-sm">Not a valid hu</p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-2xl font-bold text-yellow-400">{huResult.totalScore} fan</span>
                <span className="text-sm text-gray-400">
                  (pattern: {huResult.fanScore} + bonus: {huResult.bonusScore})
                </span>
                <span className={`text-sm font-bold ${huResult.pass ? "text-emerald-400" : "text-red-400"}`}>
                  {huResult.pass ? "PASS" : "MISMATCH"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {huResult.fans.map((fan, i) => (
                  <span key={i} className="text-sm bg-gray-800 px-2 py-1 rounded border border-gray-700">
                    <span className="text-gray-200">{fan.fan}</span>
                    {fan.count > 1 && <span className="text-gray-500"> x{fan.count}</span>}
                    <span className="text-yellow-400 ml-1">{fan.score * fan.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
