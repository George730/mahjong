// Room lobby page — shows 4 player seats, invite link, leave button, and start game

import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MAX_PLAYERS } from "@mahjong/common";
import { useAuthStore } from "../stores/auth-store.ts";
import { useRoomStore } from "../stores/room-store.ts";
import PlayerSlot from "../components/PlayerSlot.tsx";
import CopyLinkButton from "../components/CopyLinkButton.tsx";

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { room, connect, joinRoom, leaveRoom, error, displaced } = useRoomStore();

  useEffect(() => {
    if (token) connect(token);
  }, [token, connect]);

  useEffect(() => {
    if (roomCode && token && !room) {
      joinRoom(roomCode);
    }
  }, [roomCode, token, room, joinRoom]);

  const handleLeave = () => {
    leaveRoom();
    navigate("/");
  };

  if (displaced) {
    return (
      <div className="text-center mt-16">
        <p className="text-yellow-400 mb-4">Session opened in another tab. This tab is no longer active.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-emerald-400 hover:underline"
        >
          Reconnect here
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center mt-16">
        {error ? (
          <div>
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => navigate("/")} className="text-emerald-400 hover:underline">
              Back to Home
            </button>
          </div>
        ) : (
          <p className="text-gray-400">Joining room...</p>
        )}
      </div>
    );
  }

  const isHost = user?.id === room.hostId;
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) =>
    room.players.find((p) => p.seatIndex === i),
  );

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">
            Room <span className="text-emerald-400 tracking-widest">{room.code}</span>
          </h1>
          <p className="text-sm text-gray-400">
            {room.players.length}/{MAX_PLAYERS} players
          </p>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton roomCode={room.code} />
          <button
            onClick={handleLeave}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {seats.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            seatIndex={i}
            isHost={player?.userId === room.hostId}
            isSelf={player?.userId === user?.id}
          />
        ))}
      </div>

      <button
        disabled
        className="w-full py-3 bg-gray-700 rounded font-medium text-gray-500 cursor-not-allowed"
        title={isHost ? "Need 4 players to start" : "Only the host can start the game"}
      >
        Start Game
      </button>
    </div>
  );
}
