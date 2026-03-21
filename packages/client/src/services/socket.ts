// Socket.IO client singleton — connects with JWT auth token

import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mahjong/common";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let activeToken: string | null = null;

export function getSocket(token: string): TypedSocket {
  // If the token changed (e.g. user logged out and back in as a different account),
  // tear down the old socket so the new connection authenticates with the correct identity.
  if (socket && activeToken !== token) {
    socket.disconnect();
    socket = null;
    activeToken = null;
  }

  if (socket) return socket;

  activeToken = token;
  socket = io("/", {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeToken = null;
}
