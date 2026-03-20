// Unit tests for room-service (create, join, leave, host transfer, cleanup)

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthPayload } from "@mahjong/common";

// Mock Redis
const store = new Map<string, { value: string; ttl: number }>();
vi.mock("../redis.js", () => ({
  redis: {
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    set: vi.fn(async (key: string, value: string, _ex: string, ttl: number) => {
      store.set(key, { value, ttl });
    }),
    del: vi.fn(async (key: string) => { store.delete(key); }),
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
});
