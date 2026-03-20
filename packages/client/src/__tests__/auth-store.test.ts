// Tests for auth Zustand store (login, guest, logout, error handling)

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

const { useAuthStore } = await import("../stores/auth-store.ts");

describe("auth-store", () => {
  beforeEach(() => {
    storage.clear();
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
  });

  it("logs in and persists token", async () => {
    const mockUser = { id: "1", username: "test", isGuest: false, createdAt: "2024-01-01" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-token", user: mockUser }),
    });

    await useAuthStore.getState().login("test", "password");

    expect(useAuthStore.getState().token).toBe("jwt-token");
    expect(useAuthStore.getState().user?.username).toBe("test");
    expect(storage.get("auth-token")).toBe("jwt-token");
  });

  it("sets error on login failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invalid credentials" }),
    });

    await expect(useAuthStore.getState().login("bad", "bad")).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe("Invalid credentials");
  });

  it("creates guest session", async () => {
    const mockUser = { id: "g1", username: "Guest_abc", isGuest: true, createdAt: "2024-01-01" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "guest-token", user: mockUser }),
    });

    await useAuthStore.getState().guest();

    expect(useAuthStore.getState().user?.isGuest).toBe(true);
  });

  it("clears state on logout", async () => {
    storage.set("auth-token", "old-token");
    useAuthStore.setState({ token: "old-token", user: { id: "1", username: "x", isGuest: false, createdAt: "" } });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(storage.has("auth-token")).toBe(false);
  });
});
