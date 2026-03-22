// First-person mahjong table — viewer at bottom, opponents on left/right/top

import { useRef, useState } from "react";
import type { PlayerGameView, Tile, PublicPlayerState, RoomPlayer } from "@mahjong/common";
import { seatsFromPerspective, windForSeat } from "@mahjong/common";
import { useGameStore, type OpponentHandState } from "../stores/game-store.ts";
import TileRenderer from "./TileRenderer.tsx";

const WIND_CN: Record<string, string> = { east: "东", south: "南", west: "西", north: "北" };

interface GameBoardProps {
  gameView: PlayerGameView;
  userId: string;
  roomCode: string;
  roomPlayers: RoomPlayer[];
  onLeave: () => void;
}

export default function GameBoard({ gameView, userId, roomCode, roomPlayers, onLeave }: GameBoardProps) {
  const handOrder = useGameStore((s) => s.handOrder);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);
  const reorderHand = useGameStore((s) => s.reorderHand);
  const opponentHands = useGameStore((s) => s.opponentHands);

  const mySeat = gameView.players.find((p) => p.userId === userId);
  const mySeatIndex = mySeat?.seatIndex ?? 0;

  // Build ordered tile list
  const tileById = new Map(gameView.hand.map((t) => [t.id, t]));
  const orderedHand: Tile[] = handOrder
    .map((id) => tileById.get(id))
    .filter((t): t is Tile => t !== undefined);

  // Seats from viewer's perspective: [bottom, right, top, left]
  const [, rightSeat, topSeat, leftSeat] = seatsFromPerspective(mySeatIndex);

  const getPlayer = (seat: number) => gameView.players.find((p) => p.seatIndex === seat);
  const getUsername = (seat: number) => {
    const p = getPlayer(seat);
    if (!p) return "?";
    const rp = roomPlayers.find((r) => r.userId === p.userId);
    return rp?.username ?? p.userId.slice(0, 8);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-2 px-2 select-none" style={{ minHeight: "85vh" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400">
          Room <span className="text-emerald-400 tracking-widest font-mono">{roomCode}</span>
          <span className="mx-2">·</span>
          Round: {WIND_CN[gameView.roundWind]}
          <span className="mx-2">·</span>
          Wall: {gameView.wallCount}
        </div>
        <button
          onClick={onLeave}
          className="px-3 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-xs text-red-300"
        >
          Leave
        </button>
      </div>

      {/* Table */}
      <div
        className="relative bg-emerald-950 rounded-xl border border-emerald-800 overflow-hidden"
        style={{ aspectRatio: "4 / 3" }}
      >
        {/* Felt texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.08)_0%,_transparent_70%)]" />

        {/* Top player */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pt-3 z-10">
          <PlayerLabel
            name={getUsername(topSeat)}
            wind={windForSeat(topSeat)}
            isDealer={gameView.dealer === topSeat}
            isActive={gameView.currentTurn === topSeat}
          />
          <OpponentTileRow
            player={getPlayer(topSeat)}
            opponentState={opponentHands[topSeat]}
            orientation="horizontal"
            position="top"
          />
        </div>

        {/* Left player */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pl-3 z-10">
          <div className="flex flex-col items-center">
            <PlayerLabel
              name={getUsername(leftSeat)}
              wind={windForSeat(leftSeat)}
              isDealer={gameView.dealer === leftSeat}
              isActive={gameView.currentTurn === leftSeat}
              vertical
            />
          </div>
          <OpponentTileRow
            player={getPlayer(leftSeat)}
            opponentState={opponentHands[leftSeat]}
            orientation="vertical"
            position="left"
          />
        </div>

        {/* Right player */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pr-3 z-10">
          <OpponentTileRow
            player={getPlayer(rightSeat)}
            opponentState={opponentHands[rightSeat]}
            orientation="vertical"
            position="right"
          />
          <div className="flex flex-col items-center">
            <PlayerLabel
              name={getUsername(rightSeat)}
              wind={windForSeat(rightSeat)}
              isDealer={gameView.dealer === rightSeat}
              isActive={gameView.currentTurn === rightSeat}
              vertical
            />
          </div>
        </div>

        {/* Center area — discard pool placeholder + turn indicator */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div className="text-center">
            {gameView.currentTurn === mySeatIndex ? (
              <span className="text-yellow-400/80 text-sm font-medium">Your turn</span>
            ) : (
              <span className="text-emerald-300/40 text-xs">
                {WIND_CN[windForSeat(gameView.currentTurn)]}'s turn
              </span>
            )}
          </div>
        </div>

        {/* Bottom (viewer) — hand area */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-2 z-10">
          {/* Bonus tiles */}
          {gameView.bonusTiles.length > 0 && (
            <div className="flex gap-0.5 mb-1">
              {gameView.bonusTiles.map((t) => (
                <TileRenderer key={t.id} face={t.face} size="sm" />
              ))}
            </div>
          )}
          {/* Viewer label */}
          <PlayerLabel
            name="You"
            wind={windForSeat(mySeatIndex)}
            isDealer={gameView.dealer === mySeatIndex}
            isActive={gameView.currentTurn === mySeatIndex}
          />
          {/* Hand */}
          <HandRow
            tiles={orderedHand}
            selectedTileId={selectedTileId}
            onSelect={selectTile}
            onReorder={reorderHand}
          />
        </div>
      </div>
    </div>
  );
}

// --- Player label ---

function PlayerLabel({
  name,
  wind,
  isDealer,
  isActive,
  vertical,
}: {
  name: string;
  wind: string;
  isDealer: boolean;
  isActive: boolean;
  vertical?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs mb-1
        ${isActive ? "bg-yellow-900/40 text-yellow-300" : "text-gray-400"}
        ${vertical ? "flex-col" : ""}
      `}
    >
      <span className="font-medium">{WIND_CN[wind]}</span>
      <span className="truncate max-w-[80px]">{name}</span>
      {isDealer && <span className="text-amber-400 text-[10px]">庄</span>}
    </div>
  );
}

// --- Opponent face-down tile row ---

function OpponentTileRow({
  player,
  opponentState,
  orientation,
  position,
}: {
  player?: PublicPlayerState;
  opponentState?: OpponentHandState;
  orientation: "horizontal" | "vertical";
  position: "top" | "left" | "right";
}) {
  if (!player) return null;

  const isVertical = orientation === "vertical";
  const selectedPos = opponentState?.selectedPosition ?? null;

  // Rise direction: selected tile pops toward the center of the table.
  // After rotate(90deg): translateY maps to visual-X (negative = rightward, positive = leftward).
  const riseTransform = (selected: boolean) => {
    if (!selected) return isVertical ? "rotate(90deg)" : undefined;
    switch (position) {
      case "top":    return "translateY(6px)";                      // downward toward center
      case "left":   return "rotate(90deg) translateY(-8px)";      // rightward toward center
      case "right":  return "rotate(90deg) translateY(8px)";       // leftward toward center
    }
  };

  // Rotated tiles keep their original bounding box (28w×36h → visual 36×28 but DOM still 28×36).
  // Negative margin collapses the 8px dead space so tiles sit flush like the horizontal rows.
  const tileStyle = (i: number) => ({
    transform: riseTransform(selectedPos === i),
    ...(isVertical && i > 0 ? { marginTop: -8 } : {}),
  });

  return (
    <div className={`flex ${isVertical ? "flex-col" : "flex-row gap-px"}`}>
      {/* Bonus tiles (face-up, small) */}
      {player.bonusTiles.length > 0 && (
        <div className={`flex ${isVertical ? "flex-col" : "flex-row"} gap-px ${isVertical ? "mb-1" : "mr-1"}`}>
          {player.bonusTiles.map((t) => (
            <TileRenderer key={t.id} face={t.face} size="sm" />
          ))}
        </div>
      )}
      {/* Hand tiles (face-down) */}
      {Array.from({ length: player.handCount }, (_, i) => (
        <div
          key={i}
          className="transition-transform duration-150"
          style={tileStyle(i)}
        >
          <TileRenderer faceDown size="sm" />
        </div>
      ))}
    </div>
  );
}

// --- Draggable hand row ---

function HandRow({
  tiles,
  selectedTileId,
  onSelect,
  onReorder,
}: {
  tiles: Tile[];
  selectedTileId: number | null;
  onSelect: (tileId: number | null) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 18, 25);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setDropTarget(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) {
      onReorder(dragIndex.current, index);
    }
    dragIndex.current = null;
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDropTarget(null);
  };

  return (
    <div className="flex gap-0.5 flex-wrap justify-center px-2">
      {tiles.map((t, i) => (
        <div
          key={t.id}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          className={`transition-transform duration-100 ${
            dropTarget === i ? "scale-90 opacity-60" : ""
          }`}
        >
          <TileRenderer
            face={t.face}
            size="md"
            selected={selectedTileId === t.id}
            onClick={() => onSelect(t.id)}
          />
        </div>
      ))}
    </div>
  );
}
