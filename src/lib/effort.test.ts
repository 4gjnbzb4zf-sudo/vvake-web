import { describe, expect, it } from "vitest";
import { sessionEffort } from "./effort";

describe("sessionEffort (mirrors game-core)", () => {
  it("multiplies minutes by the zone weight", () => {
    expect(sessionEffort(25, 3)).toBe(75);
    expect(sessionEffort(40, 1)).toBe(40);
  });
  it("never rewards zone 5 more than zone 4", () => {
    expect(sessionEffort(20, 5)).toBe(sessionEffort(20, 4));
  });
  it("ignores negative time", () => {
    expect(sessionEffort(-5, 2)).toBe(0);
  });
});
