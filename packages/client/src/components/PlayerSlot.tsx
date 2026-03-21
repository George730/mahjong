// Displays one seat (East/South/West/North) — shows player name or "Empty"

import type { RoomPlayer } from "@mahjong/common";

const WIND_LABELS = ["East", "South", "West", "North"];

interface PlayerSlotProps {
  player?: RoomPlayer;
  seatIndex: number;
  isHost: boolean;
  isSelf: boolean;
}

export default function PlayerSlot({ player, seatIndex, isHost, isSelf }: PlayerSlotProps) {
  return (
    <div
      className={`rounded-lg border-2 p-4 flex flex-col items-center justify-center min-h-[120px] ${
        isSelf
          ? "border-yellow-400 bg-gray-800 ring-1 ring-yellow-400/30"
          : player
            ? "border-emerald-500 bg-gray-800"
            : "border-gray-600 bg-gray-800/50 border-dashed"
      }`}
    >
      <span className="text-xs text-gray-400 mb-2">{WIND_LABELS[seatIndex]}</span>
      {player ? (
        <>
          <span className="font-medium">{player.username}</span>
          {isSelf && <span className="text-xs text-yellow-400 mt-1">You</span>}
          {isHost && <span className={`text-xs mt-1 ${isSelf ? "text-yellow-400" : "text-emerald-400"}`}>Host</span>}

        </>
      ) : (
        <span className="text-gray-500 text-sm">Empty</span>
      )}
    </div>
  );
}
