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

// Atomic join: read, validate, and write in one Redis round-trip to prevent race conditions
const JOIN_SCRIPT = `
local data = redis.call('GET', KEYS[1])
if not data then return redis.error_reply('Room not found') end
local room = cjson.decode(data)
if room['status'] ~= 'waiting' then return redis.error_reply('Game already in progress') end
if #room['players'] >= tonumber(ARGV[1]) then return redis.error_reply('Room is full') end
for _, p in ipairs(room['players']) do
  if p['userId'] == ARGV[2] then return data end
end
local takenSeats = {}
for _, p in ipairs(room['players']) do
  takenSeats[p['seatIndex']] = true
end
local seatIndex = 0
while takenSeats[seatIndex] do
  seatIndex = seatIndex + 1
end
local player = {userId=ARGV[2], username=ARGV[3], isGuest=(ARGV[4]=='true'), seatIndex=seatIndex}
table.insert(room['players'], player)
local encoded = cjson.encode(room)
redis.call('SET', KEYS[1], encoded, 'EX', tonumber(ARGV[5]))
return encoded
`;

function roomKey(code: string): string {
  return `room:${code}`;
}

export async function createRoom(user: AuthPayload): Promise<Room> {
  const host: RoomPlayer = {
    userId: user.userId,
    username: user.username,
    isGuest: user.isGuest,
    seatIndex: 0,
  };

  // SET NX is atomic — no TOCTOU gap between existence check and write
  for (;;) {
    const code = generateCode();
    const room: Room = {
      code,
      hostId: user.userId,
      status: "waiting",
      players: [host],
      createdAt: new Date().toISOString(),
    };
    const ok = await redis.set(roomKey(code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS, "NX");
    if (ok === "OK") return room;
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  const data = await redis.get(roomKey(code));
  return data ? (JSON.parse(data) as Room) : null;
}

export async function joinRoom(code: string, user: AuthPayload): Promise<Room> {
  const result = (await redis.eval(
    JOIN_SCRIPT,
    1,
    roomKey(code),
    String(MAX_PLAYERS),
    user.userId,
    user.username,
    String(user.isGuest),
    String(ROOM_TTL_SECONDS),
  )) as string;
  return JSON.parse(result) as Room;
}

export async function leaveRoom(code: string, userId: string): Promise<Room | null> {
  const room = await getRoom(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.userId !== userId);

  if (room.players.length === 0) {
    await redis.del(roomKey(code));
    return null;
  }

  // Transfer host if host left
  if (room.hostId === userId) {
    room.hostId = room.players[0].userId;
  }

  // Compact seats to 0, 1, 2, ... so the UI never shows an empty slot mid-list.
  // Host is always at array index 0 so they stay on seat 0 (East).
  room.players = room.players.map((p, i) => ({ ...p, seatIndex: i }));

  await redis.set(roomKey(code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS);
  return room;
}

export async function deleteRoom(code: string): Promise<void> {
  await redis.del(roomKey(code));
}
