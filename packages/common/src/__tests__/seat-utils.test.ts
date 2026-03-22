// Unit tests for seat utility functions — relative positioning from viewer's perspective

import { describe, it, expect } from "vitest";
import { relativePosition, seatsFromPerspective, windForSeat } from "../seat-utils.js";

describe("relativePosition", () => {
  it("viewer sees themselves at bottom", () => {
    expect(relativePosition(0, 0)).toBe("bottom");
    expect(relativePosition(1, 1)).toBe("bottom");
    expect(relativePosition(2, 2)).toBe("bottom");
    expect(relativePosition(3, 3)).toBe("bottom");
  });

  it("viewer at seat 0 (East) sees correct positions", () => {
    expect(relativePosition(0, 0)).toBe("bottom"); // self
    expect(relativePosition(0, 1)).toBe("right");  // South
    expect(relativePosition(0, 2)).toBe("top");    // West
    expect(relativePosition(0, 3)).toBe("left");   // North
  });

  it("viewer at seat 2 (West) sees correct positions", () => {
    expect(relativePosition(2, 2)).toBe("bottom"); // self
    expect(relativePosition(2, 3)).toBe("right");  // North
    expect(relativePosition(2, 0)).toBe("top");    // East
    expect(relativePosition(2, 1)).toBe("left");   // South
  });

  it("viewer at seat 1 (South) sees correct positions", () => {
    expect(relativePosition(1, 1)).toBe("bottom"); // self
    expect(relativePosition(1, 2)).toBe("right");  // West
    expect(relativePosition(1, 3)).toBe("top");    // North
    expect(relativePosition(1, 0)).toBe("left");   // East
  });

  it("viewer at seat 3 (North) sees correct positions", () => {
    expect(relativePosition(3, 3)).toBe("bottom"); // self
    expect(relativePosition(3, 0)).toBe("right");  // East
    expect(relativePosition(3, 1)).toBe("top");    // South
    expect(relativePosition(3, 2)).toBe("left");   // West
  });
});

describe("seatsFromPerspective", () => {
  it("returns [bottom, right, top, left] for viewer at seat 0", () => {
    expect(seatsFromPerspective(0)).toEqual([0, 1, 2, 3]);
  });

  it("returns correct order for viewer at seat 2", () => {
    expect(seatsFromPerspective(2)).toEqual([2, 3, 0, 1]);
  });

  it("returns correct order for viewer at seat 1", () => {
    expect(seatsFromPerspective(1)).toEqual([1, 2, 3, 0]);
  });

  it("returns correct order for viewer at seat 3", () => {
    expect(seatsFromPerspective(3)).toEqual([3, 0, 1, 2]);
  });
});

describe("windForSeat", () => {
  it("maps seat indices to winds", () => {
    expect(windForSeat(0)).toBe("east");
    expect(windForSeat(1)).toBe("south");
    expect(windForSeat(2)).toBe("west");
    expect(windForSeat(3)).toBe("north");
  });
});
