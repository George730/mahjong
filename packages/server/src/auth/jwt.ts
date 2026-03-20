// JWT sign/verify helpers using the server's secret

import jwt from "jsonwebtoken";
import type { AuthPayload } from "@mahjong/common";
import { JWT_EXPIRY } from "@mahjong/common";
import { config } from "../config.js";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}
