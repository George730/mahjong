// Zustand store for room state — manages socket connection, room create/join/leave

import { create } from "zustand";
import type { Room } from "@mahjong/common";
import { getSocket, disconnectSocket, type TypedSocket } from "../services/socket.ts";
import { useGameStore } from "./game-store.ts";

interface RoomState {
  room: Room | null;
  error: string | null;
  displaced: boolean;
  socket: TypedSocket | null;
  connect: (token: string) => void;
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  disconnect: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  error: null,
  displaced: false,
  socket: null,

  connect: (token: string) => {
    const sock = getSocket(token);
    sock.on("room:updated", (room) => {
      set({ room });
    });
    sock.on("room:error", (message) => {
      set({ error: message });
    });
    sock.on("session:displaced", () => {
      set({ displaced: true, room: null, socket: null });
    });
    useGameStore.getState().bindSocket(sock);
    set({ socket: sock });
  },

  createRoom: async () => {
    const { socket } = get();
    if (!socket) return;
    set({ error: null });
    return new Promise<void>((resolve) => {
      socket.emit("room:create", (res) => {
        if (res.ok) {
          set({ room: res.room });
        } else {
          set({ error: res.error });
        }
        resolve();
      });
    });
  },

  joinRoom: async (code: string) => {
    const { socket } = get();
    if (!socket) return;
    set({ error: null });
    return new Promise<void>((resolve) => {
      socket.emit("room:join", code, (res) => {
        if (res.ok) {
          set({ room: res.room });
        } else {
          set({ error: res.error });
        }
        resolve();
      });
    });
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("room:leave");
    }
    set({ room: null, error: null });
  },

  disconnect: () => {
    disconnectSocket();
    set({ socket: null, room: null, error: null, displaced: false });
  },
}));
