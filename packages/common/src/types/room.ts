// Room and player types for the lobby/waiting-room system

export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomPlayer {
  userId: string;
  username: string;
  isGuest: boolean;
  seatIndex: number;
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  createdAt: string;
}
