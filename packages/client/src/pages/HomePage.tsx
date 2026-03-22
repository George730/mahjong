// Landing page after login — "Create Room" button and "Join by code" form

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store.ts";
import { useRoomStore } from "../stores/room-store.ts";

export default function HomePage() {
  const [joinCode, setJoinCode] = useState("");
  const { token, user } = useAuthStore();
  const { connect, createRoom, joinRoom, room, error, displaced } = useRoomStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) connect(token, user.id);
  }, [token, user, connect]);

  useEffect(() => {
    if (room) navigate(`/room/${room.code}`);
  }, [room, navigate]);

  const handleCreate = async () => {
    await createRoom();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length === 6) {
      await joinRoom(joinCode.toUpperCase());
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Play Mahjong</h1>
        <button
          onClick={handleCreate}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium text-lg"
        >
          Create Room
        </button>
      </div>
      <div>
        <h2 className="text-lg font-medium mb-3">Join a Room</h2>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            placeholder="Room Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-emerald-400 uppercase tracking-widest text-center"
          />
          <button
            type="submit"
            disabled={joinCode.length !== 6}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium disabled:opacity-50"
          >
            Join
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
      {displaced && (
        <p className="text-yellow-400 text-sm text-center">
          Session opened in another tab. This tab is no longer active.
        </p>
      )}
    </div>
  );
}
