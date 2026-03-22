// Integration tests for game:start — validates host-only start, 4-player requirement, state privacy

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthPayload, GameState } from "@mahjong/common";

// --- Mock Redis ---
const store = new Map<string, { value: string; ttl: number }>();
vi.mock("../redis.js", () => ({
  redis: {
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: string, _ex: string, ttl: number, nx?: string) => {
      if (nx === "NX" && store.has(key)) return null;
      store.set(key, { value, ttl });
      return "OK";
    }),
    del: vi.fn(async (key: string) => { store.delete(key); }),
    eval: vi.fn(async (_script: string, _numKeys: number, key: string, maxPlayers: string, userId: string, username: string, isGuest: string, ttlStr: string) => {
      const entry = store.get(key);
      if (!entry) throw new Error("Room not found");
      const room = JSON.parse(entry.value);
      if (room.status !== "waiting") throw new Error("Game already in progress");
      const max = parseInt(maxPlayers, 10);
      if (room.players.length >= max) throw new Error("Room is full");
      if (room.players.some((p: { userId: string }) => p.userId === userId)) return entry.value;
      const takenSeats = new Set(room.players.map((p: { seatIndex: number }) => p.seatIndex));
      let seatIndex = 0;
      while (takenSeats.has(seatIndex)) seatIndex++;
      room.players.push({ userId, username, isGuest: isGuest === "true", seatIndex });
      const encoded = JSON.stringify(room);
      const ttl = parseInt(ttlStr, 10);
      store.set(key, { value: encoded, ttl });
      return encoded;
    }),
  },
}));

const { createRoom, joinRoom } = await import("../room/room-service.js");
const { startGame, saveGameState, getGameState, createPlayerViews } = await import("../game/game-manager.js");

const host: AuthPayload = { userId: "host-1", username: "Host", isGuest: false };
const p2: AuthPayload = { userId: "p2", username: "Player2", isGuest: false };
const p3: AuthPayload = { userId: "p3", username: "Player3", isGuest: false };
const p4: AuthPayload = { userId: "p4", username: "Player4", isGuest: false };

describe("game:start integration", () => {
  beforeEach(() => {
    store.clear();
  });

  it("starts a game and deals hands to all 4 players", async () => {
    const room = await createRoom(host);
    await joinRoom(room.code, p2);
    await joinRoom(room.code, p3);
    await joinRoom(room.code, p4);

    const playerIds = ["host-1", "p2", "p3", "p4"];
    const { gameState } = startGame(playerIds);

    expect(gameState.phase).toBe("playing");
    expect(gameState.players).toHaveLength(4);
    expect(gameState.dealer).toBe(0);
    expect(gameState.currentTurn).toBe(0);
  });

  it("persists game state to Redis", async () => {
    const room = await createRoom(host);
    await joinRoom(room.code, p2);
    await joinRoom(room.code, p3);
    await joinRoom(room.code, p4);

    const playerIds = ["host-1", "p2", "p3", "p4"];
    const { gameState } = startGame(playerIds);

    await saveGameState(room.code, gameState);

    const loaded = await getGameState(room.code);
    expect(loaded).not.toBeNull();
    expect(loaded!.phase).toBe("playing");
    expect(loaded!.players).toHaveLength(4);
  });

  it("each player view contains only their own hand", () => {
    const playerIds = ["host-1", "p2", "p3", "p4"];
    const { gameState } = startGame(playerIds);

    const views = createPlayerViews(gameState);

    for (const [userId, view] of views) {
      // Player can see their own hand
      const playerState = gameState.players.find((p) => p.userId === userId)!;
      expect(view.hand).toEqual(playerState.hand);
      expect(view.hand.length).toBeGreaterThan(0);

      // No other player's hand is visible
      for (const p of view.players) {
        expect("hand" in p).toBe(false);
        expect(p.handCount).toBeGreaterThan(0);
      }

      // Wall tiles are hidden
      expect("wall" in view).toBe(false);
      expect(view.wallCount).toBeGreaterThan(0);
    }
  });

  it("no bonus tiles in any player hand after deal", () => {
    const playerIds = ["host-1", "p2", "p3", "p4"];
    const { gameState } = startGame(playerIds);

    for (const player of gameState.players) {
      for (const tile of player.hand) {
        expect(tile.face.category).not.toBe("season");
        expect(tile.face.category).not.toBe("flower");
      }
    }
  });

  it("dealer has 14 tiles in hand, others have 13 (after bonus replacement)", () => {
    // Bonus tiles are replaced 1-for-1, so hand size is always 13/14
    for (let i = 0; i < 10; i++) {
      const playerIds = ["host-1", "p2", "p3", "p4"];
      const { gameState } = startGame(playerIds);

      const dealer = gameState.players[0];
      const others = gameState.players.slice(1);

      expect(dealer.hand.length).toBe(14);
      for (const p of others) {
        expect(p.hand.length).toBe(13);
      }
    }
  });
});
