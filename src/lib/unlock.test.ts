import { describe, expect, it } from "vitest";
import { cityUnlockThreshold, earlyTier, unlockProgress } from "./unlock";

describe("cityUnlockThreshold (mirrors @vvfit/game-core)", () => {
  it.each([
    [4_300_000, 2_150], // Montreal
    [400_000, 300], // min clamp
    [19_000_000, 5_000], // max clamp
    [2_300_000, 1_150], // Lyon
    [330_000, 300], // Green Bay
  ])("metro %i → %i", (pop, expected) => {
    expect(cityUnlockThreshold(pop)).toBe(expected);
  });
});

describe("unlockProgress", () => {
  it("reports fraction, remaining and unlock", () => {
    expect(unlockProgress(1_075, 2_150)).toEqual({ fraction: 0.5, remaining: 1_075, unlocked: false });
    expect(unlockProgress(2_200, 2_150)).toEqual({ fraction: 1, remaining: 0, unlocked: true });
    expect(unlockProgress(-5, 300).remaining).toBe(300);
  });
});

describe("earlyTier", () => {
  it("assigns tiers by join rank", () => {
    expect(earlyTier(1)).toBe("founder");
    expect(earlyTier(100)).toBe("founder");
    expect(earlyTier(101)).toBe("pioneer");
    expect(earlyTier(1_001)).toBe("early");
    expect(earlyTier(0)).toBeNull();
    expect(earlyTier(1.5)).toBeNull();
  });
});
