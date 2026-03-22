// Creates the Socket.IO server, wires up auth middleware and room handlers

import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong/common";
import { socketAuthMiddleware } from "./auth-middleware.js";
import { registerRoomHandlers, getSocketRoom } from "./room-handler.js";
import { registerGameHandlers } from "./game-handler.js";

// Track one active socket per user — new connection kicks the old one
const userSocketMap = new Map<string, string>();

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.user.userId;

    // Kick previous socket for this user (if any)
    const oldSocketId = userSocketMap.get(userId);
    if (oldSocketId) {
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.emit("session:displaced");
        oldSocket.disconnect(true);
      }
    }
    userSocketMap.set(userId, socket.id);

    socket.on("disconnect", () => {
      // Only remove if this is still the active socket for this user
      if (userSocketMap.get(userId) === socket.id) {
        userSocketMap.delete(userId);
      }
    });

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket, getSocketRoom);
  });

  return io;
}
