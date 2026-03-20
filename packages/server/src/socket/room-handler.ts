// Socket event handlers for room:create, room:join, room:leave, and disconnect

import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong/common";
import * as roomService from "../room/room-service.js";

// Track which room each socket is in (keyed by socketId to handle displacement correctly)
const socketRoomMap = new Map<string, { userId: string; roomCode: string }>();

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  const { user } = socket;

  socket.on("room:create", async (callback) => {
    try {
      await handleLeave(io, socket);

      const room = await roomService.createRoom(user);
      socketRoomMap.set(socket.id, { userId: user.userId, roomCode: room.code });
      await socket.join(room.code);
      callback({ ok: true, room });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("room:join", async (roomCode, callback) => {
    try {
      await handleLeave(io, socket);

      const room = await roomService.joinRoom(roomCode, user);
      socketRoomMap.set(socket.id, { userId: user.userId, roomCode: room.code });
      await socket.join(room.code);
      io.to(room.code).emit("room:updated", room);
      callback({ ok: true, room });
    } catch (err) {
      callback({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("room:leave", async () => {
    await handleLeave(io, socket);
  });

  socket.on("disconnect", async () => {
    await handleLeave(io, socket);
  });
}

async function handleLeave(io: TypedServer, socket: TypedSocket) {
  const entry = socketRoomMap.get(socket.id);
  if (!entry) return;

  socketRoomMap.delete(socket.id);
  socket.leave(entry.roomCode);

  const room = await roomService.leaveRoom(entry.roomCode, entry.userId);
  if (room) {
    io.to(entry.roomCode).emit("room:updated", room);
  }
}
