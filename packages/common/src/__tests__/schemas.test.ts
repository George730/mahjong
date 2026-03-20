// Tests for Zod validation schemas (register, login, joinRoom)

import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema, joinRoomSchema } from "../schemas.js";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({ username: "player1", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = registerSchema.safeParse({ username: "a", password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid characters in username", () => {
    const result = registerSchema.safeParse({ username: "play er", password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({ username: "player1", password: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({ username: "player1", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects empty username", () => {
    const result = loginSchema.safeParse({ username: "", password: "secret" });
    expect(result.success).toBe(false);
  });
});

describe("joinRoomSchema", () => {
  it("accepts valid 6-char code", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "ABC123" });
    expect(result.success).toBe(true);
  });

  it("rejects wrong length", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "ABC" });
    expect(result.success).toBe(false);
  });

  it("rejects lowercase", () => {
    const result = joinRoomSchema.safeParse({ roomCode: "abc123" });
    expect(result.success).toBe(false);
  });
});
