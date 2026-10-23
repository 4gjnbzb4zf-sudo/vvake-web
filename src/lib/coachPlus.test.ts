import { describe, expect, it } from "vitest";
import { coachPlusActive } from "./coachPlus";

const NOW = Date.parse("2026-10-23T12:00:00Z");

describe("VVake Coach Plus on (Plus, Premium, early testers)", () => {
  it("plusUntil in the future is Plus, in the past is not, whatever the plan says", () => {
    expect(coachPlusActive({ plan: "plus", plusUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
    expect(coachPlusActive({ plan: "plus", plusUntil: "2026-10-01T00:00:00Z" }, NOW)).toBe(false);
    expect(coachPlusActive({ plan: "free", tier: "premium", plusUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
  });
  it("Premium (and 'pro' before the rename) and early testers are Plus", () => {
    expect(coachPlusActive({ tier: "premium" }, NOW)).toBe(true);
    expect(coachPlusActive({ tier: "pro" }, NOW)).toBe(true);
    expect(coachPlusActive({ plan: "premium" }, NOW)).toBe(true);
    expect(coachPlusActive({ earlyTester: true, plusUntil: "2026-10-01T00:00:00Z" }, NOW)).toBe(true);
  });
  it("free and unknown are not", () => {
    expect(coachPlusActive({ plan: "free" }, NOW)).toBe(false);
    expect(coachPlusActive({}, NOW)).toBe(false);
    expect(coachPlusActive(null, NOW)).toBe(false);
  });
});
