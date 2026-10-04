import { describe, expect, it } from "vitest";
import { sampleWeek, sessionMinutes } from "./sampleWeek";

describe("sample week", () => {
  it("multiplies days by minutes", () => {
    expect(sampleWeek([true, false, true, false, false, true, false], 30, false)).toEqual({ each: 30, sessions: 3, total: 90 });
  });

  it("makes a lighter week about 75%, rounded to 5, at least 10 minutes", () => {
    expect(sessionMinutes(60, true)).toBe(45);
    expect(sessionMinutes(30, true)).toBe(25); // 22.5 → 25
    expect(sessionMinutes(15, true)).toBe(10);
    expect(sessionMinutes(10, true)).toBe(10);
  });

  it("handles no days", () => {
    expect(sampleWeek(Array(7).fill(false), 45, true)).toEqual({ each: 35, sessions: 0, total: 0 });
  });
});
