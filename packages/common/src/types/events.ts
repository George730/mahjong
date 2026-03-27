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

// --- Draw & discard payloads ---

export interface DiscardTilePayload {
  tileId: number; // ID of the tile to discard
}

// --- Claim payloads ---

export interface ClaimChowPayload {
  handTileIds: [number, number]; // IDs of the two hand tiles to use
}

export interface ClaimClosedKongPayload {
  tileIds: number[]; // IDs of all 4 tiles forming the closed kong
}

// --- Socket.IO event maps ---

export interface ClaimRejectedPayload {
  reason: string;
}

export interface ServerToClientEvents {
  "room:updated": (room: Room) => void;
  "room:error": (message: string) => void;
  "session:displaced": () => void;
  "game:state": (state: PlayerGameView) => void;
  "game:error": (message: string) => void;
  "game:claimRejected": (payload: ClaimRejectedPayload) => void;
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
  "game:drawTile": (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:discardTile": (
    payload: DiscardTilePayload,
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:claimChow": (
    payload: ClaimChowPayload,
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:claimPung": (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:claimOpenKong": (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:claimClosedKong": (
    payload: ClaimClosedKongPayload,
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:claimPass": (
    callback: (response: { ok: true } | { ok: false; error: string }) => void,
  ) => void;
  "game:tileSelected": (payload: TileSelectedPayload) => void;
  "game:tileDeselected": (payload: TileDeselectedPayload) => void;
  "game:handReordered": (payload: HandReorderedPayload) => void;
  "game:tileDragging": (payload: TileDraggingPayload) => void;
}
