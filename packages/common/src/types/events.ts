// Socket.IO event contracts between client and server

import type { Room } from "./room.js";

export interface ServerToClientEvents {
  "room:updated": (room: Room) => void;
  "room:error": (message: string) => void;
  "session:displaced": () => void;
}

export interface ClientToServerEvents {
  "room:create": (
    callback: (response: { ok: true; room: Room } | { ok: false; error: string }) => void,
  ) => void;
  "room:join": (
    roomCode: string,
    callback: (response: { ok: true; room: Room } | { ok: false; error: string }) => void,
  ) => void;
  "room:leave": () => void;
}
