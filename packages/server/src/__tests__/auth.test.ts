// Integration tests for /auth/register, /auth/login, /auth/guest endpoints

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authRouter } from "../auth/auth-router.js";

// Mock the user repository
vi.mock("../db/user-repository.js", () => {
  const users = new Map<string, { id: string; username: string; password_hash: string; created_at: string }>();
  return {
    createUser: vi.fn(async (username: string, passwordHash: string) => {
      const user = { id: "test-uuid", username, password_hash: passwordHash, created_at: new Date().toISOString() };
      users.set(username, user);
      return user;
    }),
    findUserByUsername: vi.fn(async (username: string) => users.get(username) ?? null),
  };
});

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

describe("POST /auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user and returns token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "newplayer", password: "secret123" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.username).toBe("newplayer");
    expect(res.body.user.isGuest).toBe(false);
  });

  it("rejects invalid input", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "a", password: "123" });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with valid credentials", async () => {
    // First register
    await request(app)
      .post("/auth/register")
      .send({ username: "loginuser", password: "secret123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "loginuser", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("rejects wrong password", async () => {
    await request(app)
      .post("/auth/register")
      .send({ username: "loginuser2", password: "secret123" });

    const res = await request(app)
      .post("/auth/login")
      .send({ username: "loginuser2", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/guest", () => {
  it("returns guest token and user", async () => {
    const res = await request(app).post("/auth/guest");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.isGuest).toBe(true);
    expect(res.body.user.username).toMatch(/^Guest_/);
  });
});
