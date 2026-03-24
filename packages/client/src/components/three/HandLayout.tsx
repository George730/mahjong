// 3D hand layout — positions tiles for the viewer and 3 opponents on the table.
//
// Reads from Zustand game-store: handOrder, selectedTileId, opponentHands, gameView.
// Bottom player's tiles lie flat (face-up). Opponents' tiles stand upright (face outward).
// Supports click-to-select and pointer-drag-to-reorder for the viewer's hand.

import { useRef, useCallback } from "react";
import type { Tile, PublicPlayerState } from "@mahjong/common";
import { seatsFromPerspective } from "@mahjong/common";
import { useGameStore, type OpponentHandState } from "../../stores/game-store.ts";
import TileMesh, { TILE_WIDTH } from "./TileMesh.tsx";

// Layout constants (matching SceneDemoPage)
const GAP = TILE_WIDTH + 0.02;
const TABLE_EDGE = 4.25;
const CORNER_MARGIN = 1.5;
const ROW_LEFT = -(5 - CORNER_MARGIN); // leftmost position along a table edge

// Per-side config: how to compute tile position and rotation
interface SideConfig {
  /** Position for the i-th tile */
  position: (i: number) => [number, number, number];
  /** Y rotation for standing tiles */
  rotationY: number;
  /** Flat (face-up) for the viewer */
  flat: boolean;
}

const SIDE_CONFIGS: Record<string, SideConfig> = {
  bottom: {
    position: (i) => [ROW_LEFT + i * GAP, 0, TABLE_EDGE],
    rotationY: 0,
    flat: true,
  },
  top: {
    position: (i) => [-ROW_LEFT - i * GAP, 0, -TABLE_EDGE],
    rotationY: Math.PI,
    flat: false,
  },
  left: {
    position: (i) => [-TABLE_EDGE, 0, ROW_LEFT + i * GAP],
    rotationY: -Math.PI / 2,
    flat: false,
  },
  right: {
    position: (i) => [TABLE_EDGE, 0, -ROW_LEFT - i * GAP],
    rotationY: Math.PI / 2,
    flat: false,
  },
};

/** Viewer's own hand — flat tiles with selection and drag-to-reorder. */
function ViewerHand({
  tiles,
  selectedTileId,
  onSelect,
  onReorder,
  onDragHover,
}: {
  tiles: Tile[];
  selectedTileId: number | null;
  onSelect: (tileId: number | null) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDragHover: (fromIndex: number, hoverIndex: number | null) => void;
}) {
  const config = SIDE_CONFIGS.bottom;
  const dragFrom = useRef<number | null>(null);
  const lastHover = useRef<number | null>(null);

  const handlePointerDown = useCallback((index: number) => {
    dragFrom.current = index;
    lastHover.current = null;
  }, []);

  const handlePointerMove = useCallback(
    (index: number) => {
      if (dragFrom.current === null || dragFrom.current === index) return;
      if (lastHover.current === index) return;
      lastHover.current = index;
      onDragHover(dragFrom.current, index);
    },
    [onDragHover],
  );

  const handlePointerUp = useCallback(
    (index: number) => {
      if (dragFrom.current !== null && dragFrom.current !== index) {
        onReorder(dragFrom.current, index);
      }
      if (dragFrom.current !== null) {
        onDragHover(dragFrom.current, null);
      }
      dragFrom.current = null;
      lastHover.current = null;
    },
    [onReorder, onDragHover],
  );

  // Cancel drag if pointer leaves all tiles
  const handlePointerCancel = useCallback(() => {
    if (dragFrom.current !== null) {
      onDragHover(dragFrom.current, null);
    }
    dragFrom.current = null;
    lastHover.current = null;
  }, [onDragHover]);

  return (
    <group onPointerMissed={handlePointerCancel}>
      {tiles.map((tile, i) => (
        <TileMesh
          key={tile.id}
          face={tile.face}
          flat={config.flat}
          position={config.position(i)}
          rotationY={config.rotationY}
          selected={selectedTileId === tile.id}
          interactive
          onClick={() => onSelect(selectedTileId === tile.id ? null : tile.id)}
          onPointerDown={() => handlePointerDown(i)}
          onPointerEnter={() => handlePointerMove(i)}
          onPointerUp={() => handlePointerUp(i)}
        />
      ))}
    </group>
  );
}

/** Opponent hand — standing tiles, face outward (viewer sees tile backs). */
function OpponentHand({
  player,
  opponentState,
  side,
}: {
  player: PublicPlayerState;
  opponentState?: OpponentHandState;
  side: "top" | "left" | "right";
}) {
  const config = SIDE_CONFIGS[side];
  const selectedPos = opponentState?.selectedPosition ?? null;

  return (
    <group>
      {Array.from({ length: player.handCount }, (_, i) => (
        <TileMesh
          key={`${side}-${i}`}
          position={config.position(i)}
          rotationY={config.rotationY}
          flat={false}
          selected={selectedPos === i}
          interactive={false}
        />
      ))}
    </group>
  );
}

/** Root layout component — renders all 4 hands based on game state. */
export default function HandLayout() {
  const gameView = useGameStore((s) => s.gameView);
  const handOrder = useGameStore((s) => s.handOrder);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);
  const reorderHand = useGameStore((s) => s.reorderHand);
  const emitDragHover = useGameStore((s) => s.emitDragHover);
  const opponentHands = useGameStore((s) => s.opponentHands);
  const mySeatIndex = useGameStore((s) => s.mySeatIndex);

  if (!gameView || mySeatIndex === null) return null;

  // Build ordered tile list from handOrder IDs
  const tileById = new Map(gameView.hand.map((t) => [t.id, t]));
  const orderedHand: Tile[] = handOrder
    .map((id) => tileById.get(id))
    .filter((t): t is Tile => t !== undefined);

  // Seats from viewer's perspective: [bottom, right, top, left]
  const [, rightSeat, topSeat, leftSeat] = seatsFromPerspective(mySeatIndex);
  const getPlayer = (seat: number) => gameView.players.find((p) => p.seatIndex === seat);

  const seatSides: Array<{ seat: number; side: "top" | "left" | "right" }> = [
    { seat: topSeat, side: "top" },
    { seat: leftSeat, side: "left" },
    { seat: rightSeat, side: "right" },
  ];

  return (
    <group>
      {/* Viewer's hand */}
      <ViewerHand
        tiles={orderedHand}
        selectedTileId={selectedTileId}
        onSelect={selectTile}
        onReorder={reorderHand}
        onDragHover={emitDragHover}
      />

      {/* Opponents */}
      {seatSides.map(({ seat, side }) => {
        const player = getPlayer(seat);
        if (!player) return null;
        return (
          <OpponentHand
            key={side}
            player={player}
            opponentState={opponentHands[seat]}
            side={side}
          />
        );
      })}
    </group>
  );
}
