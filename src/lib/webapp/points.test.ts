import { describe, expect, it } from "vitest";
import { habitsDoor, weekPoints, weekStartMs } from "./points";

// Wednesday 21 October 2026, 15:00 local time.
const NOW = new Date(2026, 9, 21, 15, 0, 0).getTime();
const at = (day: number, h = 9) => new Date(2026, 9, day, h, 0, 0).toISOString();

describe("VV points this week", () => {
  it("starts the week on Monday at midnight", () => {
    expect(new Date(weekStartMs(NOW)).getDate()).toBe(19);
    expect(new Date(weekStartMs(NOW)).getHours()).toBe(0);
    // A Sunday belongs to the week that began the Monday before.
    expect(new Date(weekStartMs(new Date(2026, 9, 25, 22).getTime())).getDate()).toBe(19);
  });
  it("sums the points since Monday, without excluded sessions or last week", () => {
    const r = weekPoints(
      [
        { startedAt: at(21), points: 40, pointsDetail: { streakBonus: 4 } },
        { startedAt: at(19, 0), points: 10 },
        { startedAt: at(20), points: 25, excluded: true },
        { startedAt: at(18, 23), points: 99 },
        { startedAt: at(20), points: null },
        { startedAt: "nope", points: 5 },
      ],
      NOW,
    );
    expect(r).toEqual({ points: 50, bonus: 4, counted: 2 });
  });
  it("is zero with nothing loaded", () => {
    expect(weekPoints([], NOW)).toEqual({ points: 0, bonus: 0, counted: 0 });
  });
});

describe("the Habits door", () => {
  const on = { water: true, meals: true, sleep: false };
  it("shows today's glasses and meals for the habits that are on", () => {
    expect(habitsDoor({ on, glasses: 3, meals: 1 })).toEqual({ kind: "both", glasses: 3, meals: 1 });
    expect(habitsDoor({ on: { ...on, meals: false }, glasses: 3, meals: 1 })).toEqual({ kind: "water", glasses: 3 });
    expect(habitsDoor({ on: { ...on, water: false }, glasses: 0, meals: 2 })).toEqual({ kind: "meals", meals: 2 });
  });
  it("falls back to the generic line before anything is logged", () => {
    expect(habitsDoor(null)).toEqual({ kind: "none" });
    expect(habitsDoor({ on, glasses: 0, meals: 0 })).toEqual({ kind: "none" });
    expect(habitsDoor({ on: { water: false, meals: false, sleep: true }, glasses: 2, meals: 0 })).toEqual({ kind: "none" });
  });
});
