// Room CRUD operations stored in Redis (create, get, join, leave, delete)

import { customAlphabet } from "nanoid";
import type { Room, RoomPlayer, AuthPayload } from "@mahjong/common";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  MAX_PLAYERS,
  ROOM_TTL_SECONDS,
} from "@mahjong/common";
import { redis } from "../redis.js";

const generateCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

function roomKey(code: string): string {
  return `room:${code}`;
}

export async function createRoom(user: AuthPayload): Promise<Room> {
  let code: string;
  do {
    code = generateCode();
  } while (await redis.exists(roomKey(code)));

  const room: Room = {
    code,
    hostId: user.userId,
    status: "waiting",
    players: [
      {
        userId: user.userId,
        username: user.username,
        isGuest: user.isGuest,
        seatIndex: 0,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  await redis.set(roomKey(code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS);
  return room;
}

export async function getRoom(code: string): Promise<Room | null> {
  const data = await redis.get(roomKey(code));
  return data ? (JSON.parse(data) as Room) : null;
}

export async function joinRoom(code: string, user: AuthPayload): Promise<Room> {
  const room = await getRoom(code);
  if (!room) throw new Error("Room not found");
  if (room.status !== "waiting") throw new Error("Game already in progress");
  if (room.players.length >= MAX_PLAYERS) throw new Error("Room is full");
  if (room.players.some((p) => p.userId === user.userId)) return room;

  const takenSeats = new Set(room.players.map((p) => p.seatIndex));
  let seatIndex = 0;
  while (takenSeats.has(seatIndex)) seatIndex++;

  const player: RoomPlayer = {
    userId: user.userId,
    username: user.username,
    isGuest: user.isGuest,
    seatIndex,
  };
  room.players.push(player);

  await redis.set(roomKey(code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS);
  return room;
}

export async function leaveRoom(code: string, userId: string): Promise<Room | null> {
  const room = await getRoom(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.userId !== userId);

  if (room.players.length === 0) {
    await redis.del(roomKey(code));
    return null;
  }

  // Transfer host if host left — new host moves to East (seat 0)
  if (room.hostId === userId) {
    room.players[0].seatIndex = 0;
    room.hostId = room.players[0].userId;
  }

  await redis.set(roomKey(code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS);
  return room;
}

export async function deleteRoom(code: string): Promise<void> {
  await redis.del(roomKey(code));
}
