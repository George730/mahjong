// Socket event handlers for game actions and cosmetic hand broadcasts

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong/common";
import { MAX_PLAYERS } from "@mahjong/common";
import * as roomService from "../room/room-service.js";
import * as gameManager from "../game/game-manager.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Helper: broadcast updated game views to all players in a room. */
function broadcastViews(
  io: TypedServer,
  roomCode: string,
  gameState: Parameters<typeof gameManager.createPlayerViews>[0],
) {
  const views = gameManager.createPlayerViews(gameState);
  for (const [, s] of io.sockets.sockets) {
    if (s.rooms.has(roomCode)) {
      const view = views.get(s.user?.userId);
      if (view) s.emit("game:state", view);
    }
  }
}

export function registerGameHandlers(
  io: TypedServer,
  socket: TypedSocket,
  getSocketRoom: (socketId: string) => { userId: string; roomCode: string } | undefined,
) {
  // --- Game start ---
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

      if (room.hostId !== socket.user.userId) {
        return callback({ ok: false, error: "Only the host can start the game" });
      }

      if (room.players.length !== MAX_PLAYERS) {
        return callback({ ok: false, error: `Need ${MAX_PLAYERS} players to start` });
      }

      if (room.status !== "waiting") {
        return callback({ ok: false, error: "Game already in progress" });
      }

      const updatedRoom = await roomService.updateRoomStatus(entry.roomCode, "playing");
      if (!updatedRoom) {
        return callback({ ok: false, error: "Failed to update room" });
      }

      const sortedPlayers = [...room.players].sort((a, b) => a.seatIndex - b.seatIndex);
      const playerIds = sortedPlayers.map((p) => p.userId);

      const { gameState } = gameManager.startGame(playerIds);
      await gameManager.saveGameState(entry.roomCode, gameState);

      io.to(entry.roomCode).emit("room:updated", updatedRoom);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Draw tile ---
  socket.on("game:drawTile", async (callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });
      if (gameState.currentTurn !== player.seatIndex) {
        return callback({ ok: false, error: "Not your turn" });
      }
      if (gameState.turnPhase !== "draw") {
        return callback({ ok: false, error: "Not in draw phase" });
      }

      gameManager.handleDrawTile(gameState);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Discard tile ---
  socket.on("game:discardTile", async (payload, callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });
      if (gameState.currentTurn !== player.seatIndex) {
        return callback({ ok: false, error: "Not your turn" });
      }
      if (gameState.turnPhase !== "discard") {
        return callback({ ok: false, error: "Not in discard phase" });
      }

      gameManager.handleDiscardTile(gameState, payload.tileId);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Claim chow ---
  socket.on("game:claimChow", async (payload, callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });

      gameManager.handleClaimChow(gameState, player.seatIndex, payload.handTileIds);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Claim pung ---
  socket.on("game:claimPung", async (callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });

      gameManager.handleClaimPung(gameState, player.seatIndex);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Claim open kong ---
  socket.on("game:claimOpenKong", async (callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });

      gameManager.handleClaimOpenKong(gameState, player.seatIndex);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Declare closed kong ---
  socket.on("game:claimClosedKong", async (payload, callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });
      if (gameState.currentTurn !== player.seatIndex) {
        return callback({ ok: false, error: "Not your turn" });
      }

      gameManager.handleDeclareClosedKong(gameState, player.seatIndex, payload.tileIds);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Pass on claim ---
  socket.on("game:claimPass", async (callback) => {
    try {
      const entry = getSocketRoom(socket.id);
      if (!entry) return callback({ ok: false, error: "You are not in a room" });

      const gameState = await gameManager.getGameState(entry.roomCode);
      if (!gameState) return callback({ ok: false, error: "No active game" });

      const player = gameState.players.find((p) => p.userId === socket.user.userId);
      if (!player) return callback({ ok: false, error: "You are not in this game" });

      gameManager.handleClaimPass(gameState, player.seatIndex);
      await gameManager.saveGameState(entry.roomCode, gameState);
      broadcastViews(io, entry.roomCode, gameState);

      callback({ ok: true });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  // --- Cosmetic hand broadcasts (relay to other players in room, no server-side mutation) ---

  socket.on("game:tileSelected", (payload) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return;
    socket.to(entry.roomCode).emit("game:tileSelected", payload);
  });

  socket.on("game:tileDeselected", (payload) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return;
    socket.to(entry.roomCode).emit("game:tileDeselected", payload);
  });

  socket.on("game:handReordered", (payload) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return;
    socket.to(entry.roomCode).emit("game:handReordered", payload);
  });

  socket.on("game:tileDragging", (payload) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return;
    socket.to(entry.roomCode).emit("game:tileDragging", payload);
  });
}
