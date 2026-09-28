import { describe, expect, it } from "vitest";
import { planWeek, planWeeks, type Weekday } from "./plan";

// Shared vectors with packages/game-core/test/plan.test.ts.
const WEEK: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

describe("plan mirror", () => {
  it("matches game-core targets and progression", () => {
    expect(
      planWeek({ goal: "start", availableDays: [1, 3, 5, 6], minutesPerDay: 30, sports: ["walker", "yogi"], recentWeeklyMinutes: 40 })
        .targetMinutes,
    ).toBe(65);
    const weeks = planWeeks({ goal: "endurance", availableDays: WEEK, minutesPerDay: 90, sports: ["walker"], recentWeeklyMinutes: 100 }, 4);
    expect(weeks.map((w) => w.targetMinutes)).toEqual([110, 120, 130, 115]);
  });
});

describe("calendar mirror", () => {
  it("exports the demo week as a recurring, private .ics", async () => {
    const { placeSessions, toIcs } = await import("./calendar");
    const week = planWeek({
      goal: "consistency",
      availableDays: [0, 2, 3, 5, 6],
      minutesPerDay: 40,
      sports: ["runner"],
      recentWeeklyMinutes: 90,
    });
    const ics = toIcs(placeSessions(week.sessions, []), {
      weekStart: "2026-10-05",
      timeZone: "Europe/Paris",
      title: () => "VVake · Run",
      nowMs: 0,
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(week.sessions.length);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("CLASS:PRIVATE");
  });
});
