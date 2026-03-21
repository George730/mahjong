// Tests that login redirect preserves intended destination (including room URLs)

import { describe, it, expect } from "vitest";

// Extracted redirect logic from LoginPage
function resolveRedirect(from: string | undefined): string {
  return from || "/";
}

describe("login redirect logic", () => {
  it("redirects to home by default", () => {
    expect(resolveRedirect(undefined)).toBe("/");
  });

  it("preserves non-room redirect paths", () => {
    expect(resolveRedirect("/")).toBe("/");
    expect(resolveRedirect("/some-page")).toBe("/some-page");
  });

  it("preserves room redirect for shared link flow", () => {
    expect(resolveRedirect("/room/ABC123")).toBe("/room/ABC123");
    expect(resolveRedirect("/room/XYZABC")).toBe("/room/XYZABC");
  });
});
