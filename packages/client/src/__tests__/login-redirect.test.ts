// Tests that login redirect does not send users back into a room after logout

import { describe, it, expect } from "vitest";

// Extracted redirect logic from LoginPage — room URLs should redirect to home
function resolveRedirect(from: string | undefined): string {
  const path = from || "/";
  return path.startsWith("/room/") ? "/" : path;
}

describe("login redirect logic", () => {
  it("redirects to home by default", () => {
    expect(resolveRedirect(undefined)).toBe("/");
  });

  it("preserves non-room redirect paths", () => {
    expect(resolveRedirect("/")).toBe("/");
    expect(resolveRedirect("/some-page")).toBe("/some-page");
  });

  it("does not redirect back into a room after logout", () => {
    expect(resolveRedirect("/room/ABC123")).toBe("/");
    expect(resolveRedirect("/room/XYZABC")).toBe("/");
  });
});
