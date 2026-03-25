// 3D hand layout — positions tiles for the viewer and 3 opponents on the table.
//
// Reads from Zustand game-store: handOrder, selectedTileId, opponentHands, gameView.
// Bottom player's tiles lie flat (face-up). Opponents' tiles stand upright (face outward).
// Supports click-to-select and drag-to-reorder for the viewer's hand.
//
// Drag-to-reorder:
//   pointerDown on a tile starts drag → pointer tracked via raycaster on horizontal
//   plane → hoverSlot computed from pointer X → non-dragged tiles shift to make a gap
//   at hoverSlot → dragged tile slides to the gap → pointerUp commits reorder.

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
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

/** Slot X position for the viewer's hand row. */
function slotX(slot: number): number {
  return ROW_LEFT + slot * GAP;
}

/** Convert a world X position to the nearest slot index (clamped). */
function xToSlot(x: number, maxSlot: number): number {
  const raw = Math.round((x - ROW_LEFT) / GAP);
  return Math.max(0, Math.min(maxSlot, raw));
}

// --- Drag gesture ---
//
// pointerDown → "pending" (records start position + tile index)
// useFrame checks pointer distance from start:
//   - if distance > DRAG_THRESHOLD → promote to "dragging" (tiles shift, gap opens)
// pointerUp:
//   - if still "pending" → treat as click → toggle selection
//   - if "dragging" → commit reorder

const DRAG_THRESHOLD = 0.15; // world units (~1/3 tile width) before drag activates

interface DragState {
  fromIndex: number;
  hoverSlot: number;
}

interface PendingState {
  index: number;
  startX: number; // world X at pointerDown
}

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

  // Two-phase gesture state:
  // pending = pointerDown happened but hasn't moved past threshold yet
  // drag    = pointer moved past threshold, tiles are shifting
  const pendingRef = useRef<PendingState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;

  // Raycaster on horizontal plane at table surface
  const { camera, pointer } = useThree();
  const handPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  /** Get current pointer world X via raycaster. */
  const getPointerX = (): number => {
    ray.setFromCamera(pointer, camera);
    ray.ray.intersectPlane(handPlane, hitPoint);
    return hitPoint.x;
  };

  // Every frame: check threshold / update hoverSlot
  useFrame(() => {
    const worldX = getPointerX();

    // Phase 1: pending — check if pointer moved past threshold
    if (pendingRef.current && !dragStateRef.current) {
      const dist = Math.abs(worldX - pendingRef.current.startX);
      if (dist > DRAG_THRESHOLD) {
        // Promote to drag — broadcast initial state so opponents see drag start
        const fromIndex = pendingRef.current.index;
        const hoverSlot = xToSlot(worldX, tiles.length - 1);
        const state: DragState = { fromIndex, hoverSlot };
        dragStateRef.current = state;
        setDragState(state);
        onDragHover(fromIndex, hoverSlot);
        document.body.style.cursor = "grabbing";
      }
      return;
    }

    // Phase 2: dragging — update hoverSlot
    const ds = dragStateRef.current;
    if (!ds) return;

    const newSlot = xToSlot(worldX, tiles.length - 1);
    if (newSlot !== ds.hoverSlot) {
      const updated = { ...ds, hoverSlot: newSlot };
      dragStateRef.current = updated;
      setDragState(updated);
      onDragHover(ds.fromIndex, newSlot);
    }
  });

  // pointerUp handler on window — resolves click vs drag
  useEffect(() => {
    const handleUp = () => {
      const pending = pendingRef.current;
      const ds = dragStateRef.current;

      if (ds) {
        // Was dragging → commit reorder
        if (ds.fromIndex !== ds.hoverSlot) {
          onReorder(ds.fromIndex, ds.hoverSlot);
        }
        onDragHover(ds.fromIndex, null);
        dragStateRef.current = null;
        setDragState(null);
        document.body.style.cursor = "auto";
      } else if (pending) {
        // Never reached threshold → treat as click (toggle selection)
        const tile = tiles[pending.index];
        if (tile) {
          onSelect(selectedTileId === tile.id ? null : tile.id);
        }
      }

      pendingRef.current = null;
    };

    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [tiles, selectedTileId, onSelect, onReorder, onDragHover]);

  // Compute display positions for each tile
  const getPosition = (i: number): [number, number, number] => {
    if (!dragState) return config.position(i);

    const { fromIndex, hoverSlot } = dragState;

    if (i === fromIndex) {
      // Dragged tile slides to the gap position
      return [slotX(hoverSlot), 0, TABLE_EDGE];
    }

    // Non-dragged tiles: compute slot with gap at hoverSlot
    const remainingIdx = i < fromIndex ? i : i - 1;
    const displaySlot = remainingIdx >= hoverSlot ? remainingIdx + 1 : remainingIdx;
    return [slotX(displaySlot), 0, TABLE_EDGE];
  };

  const handlePointerDown = (index: number) => {
    if (dragState) return; // already dragging
    pendingRef.current = { index, startX: getPointerX() };
  };

  return (
    <group>
      {tiles.map((tile, i) => {
        const isDragging = dragState?.fromIndex === i;
        return (
          <TileMesh
            key={tile.id}
            face={tile.face}
            flat={config.flat}
            position={getPosition(i)}
            rotationY={config.rotationY}
            selected={selectedTileId === tile.id}
            dragging={isDragging}
            interactive
            onPointerDown={() => handlePointerDown(i)}
          />
        );
      })}
    </group>
  );
}

/** Opponent hand — standing tiles, face outward (viewer sees tile backs).
 *  Shows selection lift and drag-to-reorder gap animation from broadcasts.
 *
 *  Uses `tileOrder` (stable identities) as React keys so that after a reorder
 *  the TileMesh instances keep their identity and lerp smoothly to new slots
 *  instead of snapping back to old positions. */
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
  const drag = opponentState?.dragging ?? null;

  // Stable identity array — survives reorders so React keys produce smooth lerp.
  // Falls back to sequential [0,1,2,...] if store hasn't been populated yet.
  const tileOrder =
    opponentState?.tileOrder?.length === player.handCount
      ? opponentState.tileOrder
      : Array.from({ length: player.handCount }, (_, i) => i);

  /** Compute tile position for a given slot — with gap shift when drag is active. */
  const getPosition = (slot: number): [number, number, number] => {
    if (!drag) return config.position(slot);

    const { fromPosition, hoverPosition } = drag;

    // Dragged tile slides to the hover slot
    if (slot === fromPosition) {
      return config.position(hoverPosition);
    }

    // Non-dragged tiles: shift to make a gap at hoverPosition
    const remainingIdx = slot < fromPosition ? slot : slot - 1;
    const displaySlot = remainingIdx >= hoverPosition ? remainingIdx + 1 : remainingIdx;
    return config.position(displaySlot);
  };

  return (
    <group>
      {tileOrder.map((tileId, slot) => (
        <TileMesh
          key={`${side}-${tileId}`}
          position={getPosition(slot)}
          rotationY={config.rotationY}
          flat={false}
          selected={selectedPos === slot}
          dragging={drag !== null && slot === drag.fromPosition}
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
