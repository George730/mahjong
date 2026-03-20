// Zod validation schemas for auth forms and room codes (shared client+server)

import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .length(6, "Room code must be 6 characters")
    .regex(/^[A-Z0-9]+$/, "Invalid room code"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
