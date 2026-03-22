// Socket event handler for game:start — validates and initiates a new game

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong/common";
import { MAX_PLAYERS } from "@mahjong/common";
import * as roomService from "../room/room-service.js";
import * as gameManager from "../game/game-manager.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerGameHandlers(
  io: TypedServer,
  socket: TypedSocket,
  getSocketRoom: (socketId: string) => { userId: string; roomCode: string } | undefined,
) {
  socket.on("game:start", async (callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) {
        return callback({ ok: false, error: "You are not in a room" });
      }

      const room = await roomService.getRoom(entry.roomCode);
      if (!room) {
        return callback({ ok: false, error: "Room not found" });
      }

      // Only host can start
      if (room.hostId !== socket.user.userId) {
        return callback({ ok: false, error: "Only the host can start the game" });
      }

      // Need exactly 4 players
      if (room.players.length !== MAX_PLAYERS) {
        return callback({ ok: false, error: `Need ${MAX_PLAYERS} players to start` });
      }

      // Cannot start if already playing
      if (room.status !== "waiting") {
        return callback({ ok: false, error: "Game already in progress" });
      }

      // Update room status
      const updatedRoom = await roomService.updateRoomStatus(entry.roomCode, "playing");
      if (!updatedRoom) {
        return callback({ ok: false, error: "Failed to update room" });
      }

      // Sort players by seatIndex to ensure consistent ordering
      const sortedPlayers = [...room.players].sort((a, b) => a.seatIndex - b.seatIndex);
      const playerIds = sortedPlayers.map((p) => p.userId);

      // Start the game (dealer = seat 0 = East = host)
      const { gameState } = gameManager.startGame(playerIds);

      // Persist game state
      await gameManager.saveGameState(entry.roomCode, gameState);

      // Broadcast room status update
      io.to(entry.roomCode).emit("room:updated", updatedRoom);

      // Send per-player views via connected sockets in the room
      const views = gameManager.createPlayerViews(gameState);
      for (const [, s] of io.sockets.sockets) {
        if (s.rooms.has(entry.roomCode)) {
          const view = views.get(s.user?.userId);
          if (view) {
            s.emit("game:state", view);
          }
        }
      }

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });
}
