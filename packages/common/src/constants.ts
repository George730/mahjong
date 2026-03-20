// Shared constants for room codes, player limits, auth, and TTLs

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_PLAYERS = 4;
export const JWT_EXPIRY = "24h";
export const ROOM_TTL_SECONDS = 2 * 60 * 60; // 2 hours
