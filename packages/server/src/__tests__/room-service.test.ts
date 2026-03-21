// Unit tests for room-service (create, join, leave, host transfer, cleanup)

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthPayload } from "@mahjong/common";

// Mock Redis
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
    eval: vi.fn(async (script: string, numKeys: number, key: string, maxPlayers: string, userId: string, username: string, isGuest: string, ttlStr: string) => {
      // Simplified JS implementation of the Lua JOIN_SCRIPT
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

// Import after mock
const { createRoom, getRoom, joinRoom, leaveRoom } = await import("../room/room-service.js");

const host: AuthPayload = { userId: "host-1", username: "Host", isGuest: false };
const player2: AuthPayload = { userId: "player-2", username: "Player2", isGuest: false };

describe("room-service", () => {
  beforeEach(() => {
    store.clear();
  });

  it("creates a room with the host as first player", async () => {
    const room = await createRoom(host);
    expect(room.code).toHaveLength(6);
    expect(room.hostId).toBe("host-1");
    expect(room.players).toHaveLength(1);
    expect(room.status).toBe("waiting");
  });

  it("retrieves a room by code", async () => {
    const room = await createRoom(host);
    const found = await getRoom(room.code);
    expect(found).not.toBeNull();
    expect(found!.code).toBe(room.code);
  });

  it("allows a player to join", async () => {
    const room = await createRoom(host);
    const updated = await joinRoom(room.code, player2);
    expect(updated.players).toHaveLength(2);
  });

  it("does not duplicate player on re-join", async () => {
    const room = await createRoom(host);
    const updated = await joinRoom(room.code, host);
    expect(updated.players).toHaveLength(1);
  });

  it("removes player on leave", async () => {
    const room = await createRoom(host);
    await joinRoom(room.code, player2);
    const updated = await leaveRoom(room.code, "player-2");
    expect(updated!.players).toHaveLength(1);
  });

  it("deletes room when last player leaves", async () => {
    const room = await createRoom(host);
    const result = await leaveRoom(room.code, "host-1");
    expect(result).toBeNull();
    const found = await getRoom(room.code);
    expect(found).toBeNull();
  });

  it("transfers host when host leaves", async () => {
    const room = await createRoom(host);
    await joinRoom(room.code, player2);
    const updated = await leaveRoom(room.code, "host-1");
    expect(updated!.hostId).toBe("player-2");
  });

  it("removes guest from room on disconnect (simulating logout cleanup)", async () => {
    const guest: AuthPayload = { userId: "guest-1", username: "Guest_abc123", isGuest: true };
    const room = await createRoom(host);
    await joinRoom(room.code, guest);

    // Guest disconnects (triggered by logout)
    const updated = await leaveRoom(room.code, "guest-1");

    expect(updated).not.toBeNull();
    expect(updated!.players).toHaveLength(1);
    expect(updated!.players[0].userId).toBe("host-1");
  });

  it("does not leave orphan guests after multiple guest sessions", async () => {
    const guest1: AuthPayload = { userId: "guest-1", username: "Guest_aaa", isGuest: true };
    const guest2: AuthPayload = { userId: "guest-2", username: "Guest_bbb", isGuest: true };

    const room = await createRoom(host);
    await joinRoom(room.code, guest1);

    // Guest1 disconnects (logout)
    await leaveRoom(room.code, "guest-1");

    // Guest2 joins (re-login as new guest)
    const updated = await joinRoom(room.code, guest2);

    // Only host and guest2 — no orphan guest1
    expect(updated.players).toHaveLength(2);
    const playerIds = updated.players.map((p) => p.userId);
    expect(playerIds).toContain("host-1");
    expect(playerIds).toContain("guest-2");
    expect(playerIds).not.toContain("guest-1");
  });
});
