// Game board — displays the current player's hand, bonus tiles, and game info after deal

import { useRef, useState } from "react";
import type { PlayerGameView, Tile } from "@mahjong/common";
import { useGameStore } from "../stores/game-store.ts";
import TileRenderer from "./TileRenderer.tsx";

const WIND_LABELS: Record<string, string> = {
  east: "East / 东",
  south: "South / 南",
  west: "West / 西",
  north: "North / 北",
};

const SEAT_WINDS = ["east", "south", "west", "north"] as const;

interface GameBoardProps {
  gameView: PlayerGameView;
  userId: string;
  roomCode: string;
  onLeave: () => void;
}

export default function GameBoard({ gameView, userId, roomCode, onLeave }: GameBoardProps) {
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const mySeat = gameView.players.find((p) => p.userId === userId);
  const mySeatIndex = mySeat?.seatIndex ?? 0;
  const isMyTurn = gameView.currentTurn === mySeatIndex;

  // Ordered hand from store
  const handOrder = useGameStore((s) => s.handOrder);
  const reorderHand = useGameStore((s) => s.reorderHand);

  // Build ordered tile list from handOrder + gameView.hand
  const tileById = new Map(gameView.hand.map((t) => [t.id, t]));
  const orderedHand: Tile[] = handOrder
    .map((id) => tileById.get(id))
    .filter((t): t is Tile => t !== undefined);

  return (
    <div className="max-w-4xl mx-auto mt-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">
            Room <span className="text-emerald-400 tracking-widest">{roomCode}</span>
          </h1>
          <p className="text-sm text-gray-400">
            Round wind: {WIND_LABELS[gameView.roundWind]} · Wall: {gameView.wallCount} tiles
          </p>
        </div>
        <button
          onClick={onLeave}
          className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300"
        >
          Leave
        </button>
      </div>

      {/* Other players info */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {gameView.players
          .filter((p) => p.userId !== userId)
          .map((p) => (
            <div
              key={p.seatIndex}
              className={`p-3 rounded border ${
                gameView.currentTurn === p.seatIndex
                  ? "border-yellow-500 bg-yellow-900/20"
                  : "border-gray-700 bg-gray-800/50"
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">
                {WIND_LABELS[SEAT_WINDS[p.seatIndex]]}
                {gameView.dealer === p.seatIndex && (
                  <span className="ml-1 text-amber-400">(Dealer)</span>
                )}
              </div>
              <div className="text-sm">
                {p.handCount} tiles in hand
              </div>
              {p.bonusTiles.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {p.bonusTiles.map((t) => (
                    <TileRenderer key={t.id} face={t.face} size="sm" />
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Current turn indicator */}
      <div className="text-center mb-4">
        {isMyTurn ? (
          <span className="text-yellow-400 font-medium">Your turn — waiting for draw/discard phase</span>
        ) : (
          <span className="text-gray-400">
            Waiting for {WIND_LABELS[SEAT_WINDS[gameView.currentTurn]]} player...
          </span>
        )}
      </div>

      {/* My info bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">
          Your seat: {WIND_LABELS[SEAT_WINDS[mySeatIndex]]}
          {gameView.dealer === mySeatIndex && (
            <span className="ml-1 text-amber-400">(Dealer)</span>
          )}
        </span>
      </div>

      {/* My bonus tiles */}
      {gameView.bonusTiles.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Bonus tiles</p>
          <div className="flex gap-1 flex-wrap">
            {gameView.bonusTiles.map((t) => (
              <TileRenderer key={t.id} face={t.face} size="sm" />
            ))}
          </div>
        </div>
      )}

      {/* My hand — draggable to reorder */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <p className="text-xs text-gray-500 mb-2">Your hand ({orderedHand.length} tiles) — drag to reorder</p>
        <HandRow
          tiles={orderedHand}
          selectedTileId={selectedTileId}
          onSelect={(id) => setSelectedTileId(selectedTileId === id ? null : id)}
          onReorder={reorderHand}
        />
      </div>
    </div>
  );
}

// --- Draggable hand row ---

interface HandRowProps {
  tiles: Tile[];
  selectedTileId: number | null;
  onSelect: (tileId: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function HandRow({ tiles, selectedTileId, onSelect, onReorder }: HandRowProps) {
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 20, 28);
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
    <div className="flex gap-1 flex-wrap justify-center">
      {tiles.map((t, i) => (
        <div
          key={t.id}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          className={`transition-transform ${
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
