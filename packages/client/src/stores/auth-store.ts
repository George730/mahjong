// Zustand store for auth state — login, register, guest, logout with localStorage persistence

import { create } from "zustand";
import type { User, AuthResponse } from "@mahjong/common";
import { apiFetch } from "../services/api.ts";
import { useRoomStore } from "./room-store.ts";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  guest: () => Promise<void>;
  logout: () => void;
}

function loadPersistedState(): { token: string | null; user: User | null } {
  const token = localStorage.getItem("auth-token");
  const userJson = localStorage.getItem("auth-user");
  return {
    token,
    user: userJson ? JSON.parse(userJson) : null,
  };
}

function persist(token: string, user: User) {
  localStorage.setItem("auth-token", token);
  localStorage.setItem("auth-user", JSON.stringify(user));
}

function clearPersisted() {
  localStorage.removeItem("auth-token");
  localStorage.removeItem("auth-user");
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadPersistedState(),
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      persist(data.token, data.user);
      set({ token: data.token, user: data.user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  register: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      persist(data.token, data.user);
      set({ token: data.token, user: data.user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  guest: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/guest", { method: "POST" });
      persist(data.token, data.user);
      set({ token: data.token, user: data.user, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  logout: () => {
    useRoomStore.getState().disconnect();
    clearPersisted();
    set({ token: null, user: null, error: null });
  },
}));
