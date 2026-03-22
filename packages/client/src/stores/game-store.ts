// Zustand store for game state — handles game:start, game:state events, local hand reordering

import { create } from "zustand";
import type { Tile, PlayerGameView } from "@mahjong/common";
import type { TypedSocket } from "../services/socket.ts";

interface GameStoreState {
  gameView: PlayerGameView | null;
  /** Local hand order (tile IDs). Survives server state updates. */
  handOrder: number[];
  error: string | null;
  startGame: (socket: TypedSocket) => Promise<{ ok: boolean; error?: string }>;
  bindSocket: (socket: TypedSocket) => void;
  reorderHand: (fromIndex: number, toIndex: number) => void;
  reset: () => void;
}

/**
 * Merge server hand with local ordering.
 * Tiles that already exist in handOrder keep their position.
 * New tiles (e.g. drawn tile) are appended at the end.
 * Tiles no longer in the server hand (e.g. discarded) are removed.
 */
function mergeHandOrder(serverHand: Tile[], currentOrder: number[]): number[] {
  const serverIds = new Set(serverHand.map((t) => t.id));
  // Keep existing order for tiles still present
  const kept = currentOrder.filter((id) => serverIds.has(id));
  const keptSet = new Set(kept);
  // Append any new tiles not in the current order
  const added = serverHand.filter((t) => !keptSet.has(t.id)).map((t) => t.id);
  return [...kept, ...added];
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameView: null,
  handOrder: [],
  error: null,

  startGame: async (socket) => {
    return new Promise((resolve) => {
      socket.emit("game:start", (res) => {
        if (!res.ok) {
          set({ error: res.error });
        }
        resolve(res);
      });
    });
  },

  bindSocket: (socket) => {
    socket.on("game:state", (state) => {
      const { handOrder } = get();
      const newOrder = mergeHandOrder(state.hand, handOrder);
      set({ gameView: state, handOrder: newOrder, error: null });
    });
    socket.on("game:error", (message) => {
      set({ error: message });
    });
  },

  reorderHand: (fromIndex: number, toIndex: number) => {
    const { handOrder } = get();
    if (fromIndex === toIndex) return;
    const updated = [...handOrder];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    set({ handOrder: updated });
  },

  reset: () => {
    set({ gameView: null, handOrder: [], error: null });
  },
}));
