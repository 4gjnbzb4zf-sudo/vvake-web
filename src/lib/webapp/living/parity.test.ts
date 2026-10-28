import { describe, expect, it } from "vitest";
import golden from "../fixtures/journey-golden.json";
import { celebrationFor, type MilestoneSnapshot } from "./celebrations";
import { comebackStage } from "./comeback";
import { streakWeeks, weeklyStreak, type StreakPause } from "./streakCare";

/**
 * The web celebrates, counts weeks and welcomes back exactly as the phone, the watches and the API do: the golden cases
 * game-core writes for the ports (VVFit packages/game-core/test/fixtures/journey-golden.json, copied by
 * scripts/sync-living-core.ts). The path itself (journeyOf) is the API's answer, drawn as it comes.
 */
describe("journey parity with game-core", () => {
  it("counts the weekly streak the same way (rest and paused weeks hold)", () => {
    const cases = golden.weeklyStreak as { name: string; days: string[]; today: string; pause?: StreakPause; output: object }[];
    expect(cases.length).toBeGreaterThanOrEqual(3);
    for (const c of cases)
      expect(weeklyStreak(streakWeeks(c.days, c.today, { pauses: c.pause ? [c.pause] : [] }), c.today), c.name).toEqual(c.output);
  });
  it("finds the same comeback stage", () => {
    const cases = golden.comeback as { last: string | null; today: string; paused: boolean; missed: number; stage: string }[];
    expect(cases.length).toBeGreaterThanOrEqual(5);
    for (const c of cases) expect(comebackStage(c.last, c.today, c.paused, c.missed), JSON.stringify(c)).toBe(c.stage);
  });
  it("celebrates the same one milestone per session, in EN and FR", () => {
    const cases = golden.celebrations as { name: string; before: MilestoneSnapshot; after: MilestoneSnapshot; en: unknown; fr: unknown }[];
    expect(cases.length).toBeGreaterThanOrEqual(4);
    for (const c of cases) {
      expect(celebrationFor(c.before, c.after, "en"), c.name).toEqual(c.en);
      expect(celebrationFor(c.before, c.after, "fr"), c.name).toEqual(c.fr);
    }
  });
});
