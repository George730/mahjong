// Shared user-related types used by both client and server

export interface User {
  id: string;
  username: string;
  isGuest: boolean;
  createdAt: string;
}

export interface AuthPayload {
  userId: string;
  username: string;
  isGuest: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}
