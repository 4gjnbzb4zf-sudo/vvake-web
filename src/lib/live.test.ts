import { describe, expect, it } from "vitest";
import { demoActivity, liveSnapshotSchema, visibleCount } from "./live";

describe("live map privacy", () => {
  it("hides cities under 10 movers and rounds the rest", () => {
    expect(visibleCount(9)).toBe(0);
    expect(visibleCount(10)).toBe(10);
    expect(visibleCount(1_234)).toBe(1_230);
  });
  it("validates the live feed shape", () => {
    expect(liveSnapshotSchema.safeParse({ updatedAt: "now", cities: [{ slug: "lyon", active: 42 }] }).success).toBe(true);
    expect(liveSnapshotSchema.safeParse({ cities: [{ slug: "lyon", active: -1 }] }).success).toBe(false);
  });
  it("makes demo activity follow local time (evening busier than 3am)", () => {
    const evening = Date.UTC(2026, 8, 28, 16, 30); // 18:30 in Paris (lon ≈ 2.35 → solar ~16:40 +)
    const night = Date.UTC(2026, 8, 28, 1, 30);
    expect(demoActivity(13_000_000, 2.35, evening, 1)).toBeGreaterThan(demoActivity(13_000_000, 2.35, night, 1));
  });
});
