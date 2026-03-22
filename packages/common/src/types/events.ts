// Socket.IO event contracts between client and server

import type { Room } from "./room.js";
import type { PlayerGameView } from "../game-state.js";

// --- Broadcast payloads (cosmetic hand actions, no tile identity revealed) ---

export interface TileSelectedPayload {
  seatIndex: number;
  tilePosition: number; // index in hand, not tile ID
}

export interface TileDeselectedPayload {
  seatIndex: number;
}

export interface HandReorderedPayload {
  seatIndex: number;
  fromPosition: number;
  toPosition: number;
}

export interface TileDraggingPayload {
  seatIndex: number;
  fromPosition: number;
  hoverPosition: number | null; // null = drag ended
}

// --- Socket.IO event maps ---

export interface ServerToClientEvents {
  "room:updated": (room: Room) => void;
  "room:error": (message: string) => void;
  "session:displaced": () => void;
  "game:state": (state: PlayerGameView) => void;
  "game:error": (message: string) => void;
  "game:tileSelected": (payload: TileSelectedPayload) => void;
  "game:tileDeselected": (payload: TileDeselectedPayload) => void;
  "game:handReordered": (payload: HandReorderedPayload) => void;
  "game:tileDragging": (payload: TileDraggingPayload) => void;
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
  "game:start": (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:tileSelected": (payload: TileSelectedPayload) => void;
  "game:tileDeselected": (payload: TileDeselectedPayload) => void;
  "game:handReordered": (payload: HandReorderedPayload) => void;
  "game:tileDragging": (payload: TileDraggingPayload) => void;
}
