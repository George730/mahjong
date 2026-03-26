// Zustand store for game state — game lifecycle, local hand reorder, opponent cosmetic state

import { create } from "zustand";
import type { Tile, PlayerGameView } from "@mahjong/common";
import type { TypedSocket } from "../services/socket.ts";

/** Cosmetic state for an opponent's hand (what we can see without knowing their tiles). */
export interface OpponentHandState {
  selectedPosition: number | null; // which tile position is raised
  dragging: { fromPosition: number; hoverPosition: number } | null; // live drag state
  /** Stable tile identities [id0, id1, …] so reorders produce smooth lerp, not snap-back. */
  tileOrder: number[];
}

interface GameStoreState {
  gameView: PlayerGameView | null;
  /** Local hand order (tile IDs). Survives server state updates. */
  handOrder: number[];
  /** Selected tile ID in own hand or drawn tile. */
  selectedTileId: number | null;
  /** Opponent cosmetic states keyed by seatIndex. */
  opponentHands: Record<number, OpponentHandState>;
  error: string | null;
  socket: TypedSocket | null;
  mySeatIndex: number | null;

  startGame: (socket: TypedSocket) => Promise<{ ok: boolean; error?: string }>;
  bindSocket: (socket: TypedSocket, userId: string) => void;
  selectTile: (tileId: number | null) => void;
  emitDragHover: (fromIndex: number, hoverIndex: number | null) => void;
  reorderHand: (fromIndex: number, toIndex: number) => void;
  drawTile: () => Promise<{ ok: boolean; error?: string }>;
  discardTile: (tileId: number) => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
}

function mergeHandOrder(serverHand: Tile[], currentOrder: number[]): number[] {
  const serverIds = new Set(serverHand.map((t) => t.id));
  const kept = currentOrder.filter((id) => serverIds.has(id));
  const keptSet = new Set(kept);
  const added = serverHand.filter((t) => !keptSet.has(t.id)).map((t) => t.id);
  return [...kept, ...added];
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameView: null,
  handOrder: [],
  selectedTileId: null,
  opponentHands: {},
  error: null,
  socket: null,
  mySeatIndex: null,

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

  bindSocket: (socket, userId) => {
    // Prevent duplicate listeners on the same socket
    const { socket: prevSocket } = get();
    if (prevSocket === socket) return;
    set({ socket });

    socket.on("game:state", (state) => {
      const { handOrder } = get();
      const newOrder = mergeHandOrder(state.hand, handOrder);
      const mySeat = state.players.find((p) => p.userId === userId);
      set({
        gameView: state,
        handOrder: newOrder,
        mySeatIndex: mySeat?.seatIndex ?? null,
        error: null,
      });
    });

    socket.on("game:error", (message) => {
      set({ error: message });
    });

    // Opponent cosmetic broadcasts
    socket.on("game:tileSelected", (payload) => {
      set((s) => {
        const prev = s.opponentHands[payload.seatIndex];
        return {
          opponentHands: {
            ...s.opponentHands,
            [payload.seatIndex]: {
              ...prev,
              tileOrder: prev?.tileOrder ?? [],
              dragging: prev?.dragging ?? null,
              selectedPosition: payload.tilePosition,
            },
          },
        };
      });
    });

    socket.on("game:tileDeselected", (payload) => {
      set((s) => {
        const prev = s.opponentHands[payload.seatIndex];
        return {
          opponentHands: {
            ...s.opponentHands,
            [payload.seatIndex]: {
              ...prev,
              tileOrder: prev?.tileOrder ?? [],
              dragging: prev?.dragging ?? null,
              selectedPosition: null,
            },
          },
        };
      });
    });

    socket.on("game:tileDragging", (payload) => {
      set((s) => {
        const prev = s.opponentHands[payload.seatIndex];
        return {
          opponentHands: {
            ...s.opponentHands,
            [payload.seatIndex]: {
              ...prev,
              tileOrder: prev?.tileOrder ?? [],
              selectedPosition: prev?.selectedPosition ?? null,
              dragging:
                payload.hoverPosition !== null
                  ? { fromPosition: payload.fromPosition, hoverPosition: payload.hoverPosition }
                  : null,
            },
          },
        };
      });
    });

    socket.on("game:handReordered", (payload) => {
      // Apply reorder to tileOrder so React keys stay stable → smooth lerp, no snap-back.
      // Also shift selectedPosition to track the moved tile.
      set((s) => {
        const prev = s.opponentHands[payload.seatIndex];
        const { fromPosition: from, toPosition: to } = payload;

        // Update tileOrder (initialize lazily from gameView if needed)
        const prevOrder = prev?.tileOrder?.length
          ? prev.tileOrder
          : (() => {
              const p = s.gameView?.players.find((pl) => pl.seatIndex === payload.seatIndex);
              return Array.from({ length: p?.handCount ?? 13 }, (_, i) => i);
            })();
        const order = [...prevOrder];
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);

        // Shift selectedPosition to follow the reorder
        let sp = prev?.selectedPosition ?? null;
        if (sp !== null) {
          if (sp === from) {
            sp = to;
          } else if (from < to && sp > from && sp <= to) {
            sp = sp - 1;
          } else if (from > to && sp >= to && sp < from) {
            sp = sp + 1;
          }
        }

        return {
          opponentHands: {
            ...s.opponentHands,
            [payload.seatIndex]: {
              ...prev,
              selectedPosition: sp,
              dragging: null,
              tileOrder: order,
            },
          },
        };
      });
    });
  },

  selectTile: (tileId: number | null) => {
    const { socket, mySeatIndex, handOrder, selectedTileId } = get();
    const newId = tileId === selectedTileId ? null : tileId;
    set({ selectedTileId: newId });

    if (!socket || mySeatIndex === null) return;

    if (newId !== null) {
      const position = handOrder.indexOf(newId);
      if (position >= 0) {
        socket.emit("game:tileSelected", { seatIndex: mySeatIndex, tilePosition: position });
      }
    } else {
      socket.emit("game:tileDeselected", { seatIndex: mySeatIndex });
    }
  },

  emitDragHover: (fromIndex: number, hoverIndex: number | null) => {
    const { socket, mySeatIndex } = get();
    if (socket && mySeatIndex !== null) {
      socket.emit("game:tileDragging", {
        seatIndex: mySeatIndex,
        fromPosition: fromIndex,
        hoverPosition: hoverIndex,
      });
    }
  },

  reorderHand: (fromIndex: number, toIndex: number) => {
    const { handOrder, socket, mySeatIndex, selectedTileId } = get();
    if (fromIndex === toIndex) return;
    const updated = [...handOrder];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    set({ handOrder: updated });

    if (socket && mySeatIndex !== null) {
      socket.emit("game:handReordered", {
        seatIndex: mySeatIndex,
        fromPosition: fromIndex,
        toPosition: toIndex,
      });

      // Re-broadcast selected position at its new index so opponents stay in sync
      if (selectedTileId !== null) {
        const newPos = updated.indexOf(selectedTileId);
        if (newPos >= 0) {
          socket.emit("game:tileSelected", { seatIndex: mySeatIndex, tilePosition: newPos });
        }
      }
    }
  },

  drawTile: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:drawTile", (res) => {
        if (!res.ok) set({ error: res.error });
        resolve(res);
      });
    });
  },

  discardTile: async (tileId: number) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:discardTile", { tileId }, (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ selectedTileId: null }); // clear selection after discard
        resolve(res);
      });
    });
  },

  reset: () => {
    set({
      gameView: null,
      handOrder: [],
      selectedTileId: null,
      opponentHands: {},
      error: null,
      socket: null,
      mySeatIndex: null,
    });
  },
}));
