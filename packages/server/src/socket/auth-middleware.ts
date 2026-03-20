// Socket.IO middleware that verifies JWT from handshake and attaches user to socket

import type { Socket } from "socket.io";
import type { AuthPayload } from "@mahjong/common";
import { verifyToken } from "../auth/jwt.js";

declare module "socket.io" {
  interface Socket {
    user: AuthPayload;
  }
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}
