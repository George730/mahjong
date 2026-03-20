// Express routes for register, login, and guest auth (POST /auth/*)

import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { registerSchema, loginSchema } from "@mahjong/common";
import type { AuthResponse, User } from "@mahjong/common";
import { createUser, findUserByUsername } from "../db/user-repository.js";
import { signToken } from "./jwt.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { username, password } = parsed.data;

  const existing = await findUserByUsername(username);
  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const dbUser = await createUser(username, passwordHash);

  const user: User = {
    id: dbUser.id,
    username: dbUser.username,
    isGuest: false,
    createdAt: dbUser.created_at,
  };
  const token = signToken({ userId: user.id, username: user.username, isGuest: false });

  const response: AuthResponse = { token, user };
  res.status(201).json(response);
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { username, password } = parsed.data;
  const dbUser = await findUserByUsername(username);
  if (!dbUser) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, dbUser.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const user: User = {
    id: dbUser.id,
    username: dbUser.username,
    isGuest: false,
    createdAt: dbUser.created_at,
  };
  const token = signToken({ userId: user.id, username: user.username, isGuest: false });

  const response: AuthResponse = { token, user };
  res.json(response);
});

authRouter.post("/guest", async (_req, res) => {
  const userId = crypto.randomUUID();
  const username = `Guest_${userId.slice(0, 6)}`;
  const user: User = {
    id: userId,
    username,
    isGuest: true,
    createdAt: new Date().toISOString(),
  };
  const token = signToken({ userId, username, isGuest: true });

  const response: AuthResponse = { token, user };
  res.status(201).json(response);
});
