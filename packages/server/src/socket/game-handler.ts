// Socket event handlers for game actions and cosmetic hand broadcasts

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, GameState } from "@mahjong/common";
import { MAX_PLAYERS } from "@mahjong/common";
import * as roomService from "../room/room-service.js";
import * as gameManager from "../game/game-manager.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Per-room mutex to serialize claim operations and avoid concurrent Redis read-modify-write races.
const roomLocks = new Map<string, Promise<void>>();
async function withRoomLock<T>(roomCode: string, fn: () => Promise<T>): Promise<T> {
  const prev = roomLocks.get(roomCode) ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  roomLocks.set(roomCode, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve();
    // Clean up if we're the last in the chain
    if (roomLocks.get(roomCode) === next) roomLocks.delete(roomCode);
  }
}

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

  // --- Claim helpers ---

  /** After a claim or pass, check resolution and broadcast results. */
  async function handleClaimResolution(
    entry: { roomCode: string },
    gameState: Parameters<typeof gameManager.createPlayerViews>[0],
    resolution: ReturnType<typeof gameManager.handleSubmitClaim>,
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) {
    await gameManager.saveGameState(entry.roomCode, gameState);

    if (resolution) {
      // All players decided — broadcast resolved state
      broadcastViews(io, entry.roomCode, gameState);

      // If hu won the claim, broadcast detailed scoring
      const gs = gameState as GameState;
      if (gs.roundResult?.type === "hu" && gs.roundResult.scoring) {
        const rr = gs.roundResult;
        io.to(entry.roomCode).emit("game:huResult", {
          winnerSeat: rr.winnerSeat!,
          discarderSeat: rr.discarderSeat,
          winSource: rr.winSource!,
          fans: rr.scoring!.fans.map(f => ({ fan: f.fan, score: f.score, count: f.count })),
          fanScore: rr.scoring!.fanScore,
          bonusScore: rr.scoring!.bonusScore,
          totalScore: rr.scoring!.totalScore,
        });
      }

      // Notify losers whose claims were outranked
      if (resolution.losers.length > 0) {
        const winType = resolution.winner?.type ?? "unknown";
        for (const loserSeat of resolution.losers) {
          const loserPlayer = gs.players.find((p) => p.seatIndex === loserSeat);
          if (!loserPlayer) continue;
          for (const [, s] of io.sockets.sockets) {
            if (s.rooms.has(entry.roomCode) && s.user?.userId === loserPlayer.userId) {
              s.emit("game:claimRejected", {
                reason: `Your claim was outranked by ${winType}`,
              });
            }
          }
        }
      }
    }
    // If not resolved yet (null), state is saved but no broadcast — wait for more decisions

    callback({ ok: true });
  }

  // --- Claim chow ---
  socket.on("game:claimChow", async (payload, callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });

        const resolution = gameManager.handleSubmitClaim(gameState, player.seatIndex, "chow", payload.handTileIds);
        await handleClaimResolution(entry, gameState, resolution, callback);
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Claim pung ---
  socket.on("game:claimPung", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });

        const resolution = gameManager.handleSubmitClaim(gameState, player.seatIndex, "pung");
        await handleClaimResolution(entry, gameState, resolution, callback);
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Claim open kong ---
  socket.on("game:claimOpenKong", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });

        const resolution = gameManager.handleSubmitClaim(gameState, player.seatIndex, "openKong");
        await handleClaimResolution(entry, gameState, resolution, callback);
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Declare closed kong ---
  socket.on("game:claimClosedKong", async (payload, callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
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
  });

  // --- Pass on claim ---
  socket.on("game:claimPass", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });

        const resolution = gameManager.handleClaimPass(gameState, player.seatIndex);
        await handleClaimResolution(entry, gameState, resolution, callback);
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Self-draw hu (自摸) ---
  socket.on("game:declareHu", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });
        if (gameState.currentTurn !== player.seatIndex) {
          return callback({ ok: false, error: "Not your turn" });
        }

        const roundResult = gameManager.handleDeclareSelfDrawHu(gameState, player.seatIndex);
        await gameManager.saveGameState(entry.roomCode, gameState);
        broadcastViews(io, entry.roomCode, gameState);

        // Broadcast detailed hu result to all players
        if (roundResult.scoring) {
          io.to(entry.roomCode).emit("game:huResult", {
            winnerSeat: roundResult.winnerSeat!,
            discarderSeat: roundResult.discarderSeat,
            winSource: roundResult.winSource!,
            fans: roundResult.scoring.fans.map(f => ({ fan: f.fan, score: f.score, count: f.count })),
            fanScore: roundResult.scoring.fanScore,
            bonusScore: roundResult.scoring.bonusScore,
            totalScore: roundResult.scoring.totalScore,
          });
        }

        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Claim hu on discard (点炮) ---
  socket.on("game:claimHu", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });

        const player = gameState.players.find((p) => p.userId === socket.user.userId);
        if (!player) return callback({ ok: false, error: "You are not in this game" });

        const resolution = gameManager.handleClaimHu(gameState, player.seatIndex);
        await gameManager.saveGameState(entry.roomCode, gameState);

        if (resolution) {
          broadcastViews(io, entry.roomCode, gameState);

          // If hu won, broadcast detailed result
          if (gameState.roundResult?.type === "hu" && gameState.roundResult.scoring) {
            const rr = gameState.roundResult;
            io.to(entry.roomCode).emit("game:huResult", {
              winnerSeat: rr.winnerSeat!,
              discarderSeat: rr.discarderSeat,
              winSource: rr.winSource!,
              fans: rr.scoring!.fans.map(f => ({ fan: f.fan, score: f.score, count: f.count })),
              fanScore: rr.scoring!.fanScore,
              bonusScore: rr.scoring!.bonusScore,
              totalScore: rr.scoring!.totalScore,
            });
          }

          // Notify losers
          if (resolution.losers.length > 0) {
            for (const loserSeat of resolution.losers) {
              const loserPlayer = gameState.players.find((p) => p.seatIndex === loserSeat);
              if (!loserPlayer) continue;
              for (const [, s] of io.sockets.sockets) {
                if (s.rooms.has(entry.roomCode) && s.user?.userId === loserPlayer.userId) {
                  s.emit("game:claimRejected", { reason: "Your claim was outranked by hu" });
                }
              }
            }
          }
        }

        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
  });

  // --- Next round (host only) ---
  socket.on("game:nextRound", async (callback) => {
    const entry = getSocketRoom(socket.id);
    if (!entry) return callback({ ok: false, error: "You are not in a room" });

    await withRoomLock(entry.roomCode, async () => {
      try {
        const room = await roomService.getRoom(entry.roomCode);
        if (!room) return callback({ ok: false, error: "Room not found" });
        if (room.hostId !== socket.user.userId) {
          return callback({ ok: false, error: "Only the host can start the next round" });
        }

        const gameState = await gameManager.getGameState(entry.roomCode);
        if (!gameState) return callback({ ok: false, error: "No active game" });
        if (gameState.phase !== "roundEnd") {
          return callback({ ok: false, error: "Round has not ended yet" });
        }

        const newState = gameManager.startNextRound(gameState);

        if (newState === null) {
          // All 16 hands complete — mark game as ended
          gameState.phase = "gameEnd";
          await gameManager.saveGameState(entry.roomCode, gameState);
          broadcastViews(io, entry.roomCode, gameState);

          // Update room status back to waiting so host can start a new game
          await roomService.updateRoomStatus(entry.roomCode, "waiting");
          const updatedRoom = await roomService.getRoom(entry.roomCode);
          if (updatedRoom) io.to(entry.roomCode).emit("room:updated", updatedRoom);

          return callback({ ok: true });
        }

        await gameManager.saveGameState(entry.roomCode, newState);
        broadcastViews(io, entry.roomCode, newState);

        callback({ ok: true });
      } catch (err) {
        callback({ ok: false, error: (err as Error).message });
      }
    });
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
