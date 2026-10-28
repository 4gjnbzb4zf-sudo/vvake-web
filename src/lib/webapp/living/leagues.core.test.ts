// Copied from VVFit packages/game-core/test/leagues.test.ts (daa2145f 2026-09-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import { resolveLeague, weeklyLeagueScore } from "./index";

describe("weeklyLeagueScore", () => {
  it("rewards consistency and progress vs own baseline", () => {
    expect(weeklyLeagueScore({ activeDays: 4, effort: 300, baselineEffort: 300 })).toBe(4 * 20 + 100);
    expect(weeklyLeagueScore({ activeDays: 4, effort: 360, baselineEffort: 300 })).toBe(80 + 120);
  });
  it("protects two rest days and caps extreme volume", () => {
    expect(weeklyLeagueScore({ activeDays: 7, effort: 300, baselineEffort: 300 })).toBe(
      weeklyLeagueScore({ activeDays: 5, effort: 300, baselineEffort: 300 }),
    );
    expect(weeklyLeagueScore({ activeDays: 5, effort: 3000, baselineEffort: 300 })).toBe(100 + 150);
  });
  it("gives new users a neutral progress score", () => {
    expect(weeklyLeagueScore({ activeDays: 2, effort: 80, baselineEffort: 0 })).toBe(40 + 100);
    expect(weeklyLeagueScore({ activeDays: 0, effort: 0, baselineEffort: 0 })).toBe(0);
  });
  it("is age- and level-fair: a walker improving 20% beats a runner flat at a high baseline", () => {
    const walker = weeklyLeagueScore({ activeDays: 5, effort: 240, baselineEffort: 200 });
    const runner = weeklyLeagueScore({ activeDays: 5, effort: 900, baselineEffort: 900 });
    expect(walker).toBeGreaterThan(runner);
  });
});

describe("resolveLeague", () => {
  const cohort = Array.from({ length: 30 }, (_, i) => ({ id: `u${String(i).padStart(2, "0")}`, score: 300 - i * 10 }));

  it("promotes the top 7 and demotes the bottom 5", () => {
    const r = resolveLeague(cohort, "tempo");
    expect(r.filter((x) => x.outcome === "promoted")).toHaveLength(7);
    expect(r.filter((x) => x.outcome === "demoted")).toHaveLength(5);
    expect(r[0]).toMatchObject({ rank: 1, outcome: "promoted", nextTier: "threshold" });
    expect(r[29]).toMatchObject({ rank: 30, outcome: "demoted", nextTier: "jog" });
  });
  it("never demotes from the first tier or promotes past the top", () => {
    expect(resolveLeague(cohort, "warmup").some((x) => x.outcome === "demoted")).toBe(false);
    expect(resolveLeague(cohort, "legend").some((x) => x.outcome === "promoted")).toBe(false);
  });
  it("never promotes someone who did nothing", () => {
    const idle = [
      { id: "a", score: 0 },
      { id: "b", score: 0 },
    ];
    expect(resolveLeague(idle, "jog", { promote: 7, demote: 0 }).every((x) => x.outcome === "stayed")).toBe(true);
  });
});
