// Zustand store for game state — game lifecycle, local hand reorder, opponent cosmetic state,
// and meld claim detection/actions.

import { create } from "zustand";
import type { Tile, PlayerGameView, TenpaiContext } from "@mahjong/common";
import { canChow, canPung, canOpenKong, canClosedKong, computeTenpai, faceToIndex, windForSeat } from "@mahjong/common";
import type { ChowOption, PungOption, KongOption, ClosedKongOption, HuResultPayload } from "@mahjong/common";
import type { TypedSocket } from "../services/socket.ts";

/** Cosmetic state for an opponent's hand (what we can see without knowing their tiles). */
export interface OpponentHandState {
  selectedPosition: number | null; // which tile position is raised
  dragging: { fromPosition: number; hoverPosition: number } | null; // live drag state
  /** Stable tile identities [id0, id1, …] so reorders produce smooth lerp, not snap-back. */
  tileOrder: number[];
}

/** Available meld claims computed client-side from the current game state. */
export interface AvailableClaims {
  chow: ChowOption[];
  pung: PungOption | null;
  openKong: KongOption | null;
  closedKong: ClosedKongOption[];
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

  /** Client-computed available claims. Null when no claim window is active. */
  availableClaims: AvailableClaims | null;
  /** Tile IDs to highlight for the current claim (client-only, not visible to opponents). */
  highlightedTileIds: number[];
  /** Selected chow option index (when multiple chow combinations exist). */
  selectedChowOption: number | null;
  /** Brief message shown when a claim is outranked by higher priority. */
  claimRejectedMsg: string | null;

  /** True when drawn tile completes the hand (self-draw hu available). */
  canHuSelfDraw: boolean;
  /** True when last discard completes the hand (claim hu available). */
  canHuDiscard: boolean;
  /** Hu result payload received from server. */
  huResult: HuResultPayload | null;

  startGame: (socket: TypedSocket) => Promise<{ ok: boolean; error?: string }>;
  bindSocket: (socket: TypedSocket, userId: string) => void;
  selectTile: (tileId: number | null) => void;
  emitDragHover: (fromIndex: number, hoverIndex: number | null) => void;
  reorderHand: (fromIndex: number, toIndex: number) => void;
  drawTile: () => Promise<{ ok: boolean; error?: string }>;
  discardTile: (tileId: number) => Promise<{ ok: boolean; error?: string }>;
  claimChow: (handTileIds: [number, number]) => Promise<{ ok: boolean; error?: string }>;
  claimPung: () => Promise<{ ok: boolean; error?: string }>;
  claimOpenKong: () => Promise<{ ok: boolean; error?: string }>;
  claimClosedKong: (tileIds: number[]) => Promise<{ ok: boolean; error?: string }>;
  claimPass: () => Promise<{ ok: boolean; error?: string }>;
  declareHu: () => Promise<{ ok: boolean; error?: string }>;
  claimHu: () => Promise<{ ok: boolean; error?: string }>;
  selectChowOption: (index: number | null) => void;
  reset: () => void;
}

/** Safe faceToIndex — returns -1 for bonus tiles. */
function safeFaceToIndex(face: Tile["face"]): number {
  if (face.category === "season" || face.category === "flower") return -1;
  return faceToIndex(face);
}

/** Build visible tile counts from the game view (all discards, melds, own hand). */
function buildVisibleCounts(state: PlayerGameView): number[] {
  const counts = new Array(34).fill(0);
  for (const p of state.players) {
    for (const t of p.discards) {
      const idx = safeFaceToIndex(t.face);
      if (idx >= 0) counts[idx]++;
    }
    for (const m of p.melds) {
      for (const t of m.tiles) {
        const idx = safeFaceToIndex(t.face);
        if (idx >= 0) counts[idx]++;
      }
    }
  }
  for (const t of state.hand) {
    const idx = safeFaceToIndex(t.face);
    if (idx >= 0) counts[idx]++;
  }
  if (state.drawnTile) {
    const idx = safeFaceToIndex(state.drawnTile.face);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

/** Check if a tile index is in the tenpai waits for the hand. */
function checkHu(hand: Tile[], tileIdx: number, state: PlayerGameView, mySeat: number): boolean {
  const myPlayer = state.players.find(p => p.seatIndex === mySeat);
  if (!myPlayer) return false;

  const visibleCounts = buildVisibleCounts(state);
  // Remove the winning tile from visible counts (it's being "added" to the hand)
  visibleCounts[tileIdx] = Math.max(0, visibleCounts[tileIdx] - 1);

  const ctx: TenpaiContext = {
    melds: myPlayer.melds,
    seatWind: windForSeat(mySeat),
    roundWind: state.roundWind,
    bonusTileCount: myPlayer.bonusTiles.length,
    visibleCounts,
  };

  const result = computeTenpai(hand, ctx);
  return result.waits.some(w => w.tileIndex === tileIdx);
}

function mergeHandOrder(serverHand: Tile[], currentOrder: number[]): number[] {
  const serverIds = new Set(serverHand.map((t) => t.id));
  const kept = currentOrder.filter((id) => serverIds.has(id));
  const keptSet = new Set(kept);
  const added = serverHand.filter((t) => !keptSet.has(t.id)).map((t) => t.id);
  return [...kept, ...added];
}

/** Compute highlighted tile IDs for available claims. */
function computeHighlights(
  claims: AvailableClaims,
  lastDiscard: PlayerGameView["lastDiscard"],
  selectedChowIdx: number | null,
): number[] {
  const ids: number[] = [];

  // Always highlight the discard tile
  if (lastDiscard) {
    ids.push(lastDiscard.tile.id);
  }

  // Closed kong: highlight all 4 tiles
  if (claims.closedKong.length > 0) {
    for (const opt of claims.closedKong) {
      ids.push(...opt.tileIds);
    }
    return ids;
  }

  // If chow options exist and one is selected, highlight those hand tiles
  if (claims.chow.length > 0 && selectedChowIdx !== null && claims.chow[selectedChowIdx]) {
    ids.push(...claims.chow[selectedChowIdx].handTileIds);
  } else if (claims.chow.length > 0) {
    // Highlight all possible chow tiles
    const allIds = new Set<number>();
    for (const opt of claims.chow) {
      for (const id of opt.handTileIds) allIds.add(id);
    }
    ids.push(...allIds);
  }

  // Pung: highlight 2 matching hand tiles
  if (claims.pung) {
    ids.push(...claims.pung.handTileIds);
  }

  // Open kong: highlight 3 matching hand tiles
  if (claims.openKong) {
    ids.push(...claims.openKong.handTileIds);
  }

  return ids;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameView: null,
  handOrder: [],
  selectedTileId: null,
  opponentHands: {},
  error: null,
  socket: null,
  mySeatIndex: null,
  availableClaims: null,
  highlightedTileIds: [],
  selectedChowOption: null,
  claimRejectedMsg: null,
  canHuSelfDraw: false,
  canHuDiscard: false,
  huResult: null,

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
      const { handOrder, mySeatIndex: prevSeat } = get();
      const newOrder = mergeHandOrder(state.hand, handOrder);
      const mySeat = state.players.find((p) => p.userId === userId)?.seatIndex ?? null;

      // Clear claim state first
      let availableClaims: AvailableClaims | null = null;
      let highlightedTileIds: number[] = [];
      const selectedChowOption: number | null = null;

      // Compute available claims based on new state
      if (mySeat !== null) {
        if (state.turnPhase === "claiming" && state.lastDiscard && state.lastDiscard.fromSeat !== mySeat) {
          // Someone else discarded — check what we can claim
          const claims: AvailableClaims = {
            chow: canChow(state.hand, state.lastDiscard.tile, mySeat, state.lastDiscard.fromSeat),
            pung: canPung(state.hand, state.lastDiscard.tile),
            openKong: canOpenKong(state.hand, state.lastDiscard.tile),
            closedKong: [],
          };

          const hasClaims = claims.chow.length > 0 || claims.pung !== null || claims.openKong !== null;

          if (hasClaims) {
            availableClaims = claims;
            highlightedTileIds = computeHighlights(claims, state.lastDiscard, null);
          }
          // No client-side auto-pass needed — server pre-populates passes for
          // players with no claims to avoid concurrent Redis write races.
        } else if (
          state.turnPhase === "discard" &&
          state.currentTurn === mySeat
        ) {
          // Our turn to discard — check for closed kong
          const closedKongs = canClosedKong(state.hand, state.drawnTile);
          if (closedKongs.length > 0) {
            availableClaims = { chow: [], pung: null, openKong: null, closedKong: closedKongs };
            highlightedTileIds = computeHighlights(availableClaims, null, null);
          }
        }
      }

      set({
        gameView: state,
        handOrder: newOrder,
        mySeatIndex: mySeat,
        error: null,
        availableClaims,
        highlightedTileIds,
        selectedChowOption,
        canHuSelfDraw: false,
        canHuDiscard: false,
        huResult: state.phase === "roundEnd" ? get().huResult : null,
      });

      // Hu detection via tenpai — deferred so it doesn't block the state update
      if (mySeat !== null) {
        setTimeout(() => {
          try {
            if (state.turnPhase === "discard" && state.currentTurn === mySeat && state.drawnTile) {
              const winIdx = safeFaceToIndex(state.drawnTile.face);
              if (winIdx >= 0 && checkHu(state.hand, winIdx, state, mySeat)) {
                set({ canHuSelfDraw: true });
              }
            } else if (state.turnPhase === "claiming" && state.lastDiscard && state.lastDiscard.fromSeat !== mySeat) {
              const winIdx = safeFaceToIndex(state.lastDiscard.tile.face);
              if (winIdx >= 0 && checkHu(state.hand, winIdx, state, mySeat)) {
                set({ canHuDiscard: true });
              }
            }
          } catch {
            // Tenpai check failed — don't block the game
          }
        }, 0);
      }
    });

    socket.on("game:error", (message) => {
      set({ error: message });
    });

    socket.on("game:huResult", (payload) => {
      set({ huResult: payload });
    });

    socket.on("game:claimRejected", (payload) => {
      set({ claimRejectedMsg: payload.reason });
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        const { claimRejectedMsg } = get();
        if (claimRejectedMsg === payload.reason) {
          set({ claimRejectedMsg: null });
        }
      }, 3000);
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

  claimChow: async (handTileIds: [number, number]) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimChow", { handTileIds }, (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], selectedChowOption: null, selectedTileId: null });
        resolve(res);
      });
    });
  },

  claimPung: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimPung", (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], selectedChowOption: null, selectedTileId: null });
        resolve(res);
      });
    });
  },

  claimOpenKong: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimOpenKong", (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], selectedChowOption: null, selectedTileId: null });
        resolve(res);
      });
    });
  },

  claimClosedKong: async (tileIds: number[]) => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimClosedKong", { tileIds }, (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], selectedChowOption: null, selectedTileId: null });
        resolve(res);
      });
    });
  },

  declareHu: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:declareHu", (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ canHuSelfDraw: false });
        resolve(res);
      });
    });
  },

  claimHu: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimHu", (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], canHuDiscard: false });
        resolve(res);
      });
    });
  },

  claimPass: async () => {
    const { socket } = get();
    if (!socket) return { ok: false, error: "No socket" };
    return new Promise((resolve) => {
      socket.emit("game:claimPass", (res) => {
        if (!res.ok) set({ error: res.error });
        else set({ availableClaims: null, highlightedTileIds: [], selectedChowOption: null });
        resolve(res);
      });
    });
  },

  selectChowOption: (index: number | null) => {
    const { availableClaims, gameView } = get();
    if (!availableClaims) return;
    const highlights = computeHighlights(availableClaims, gameView?.lastDiscard ?? null, index);
    set({ selectedChowOption: index, highlightedTileIds: highlights });
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
      availableClaims: null,
      highlightedTileIds: [],
      selectedChowOption: null,
      claimRejectedMsg: null,
      canHuSelfDraw: false,
      canHuDiscard: false,
      huResult: null,
    });
  },
}));
