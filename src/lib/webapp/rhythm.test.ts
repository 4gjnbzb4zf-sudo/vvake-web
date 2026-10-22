import { describe, expect, it } from "vitest";
import { bedOpen, dayOf, habitSend, habitsDone, logHabit, withDay, type RhythmDay } from "./rhythm";

// Today's habits in one tap on the web (components/webapp/HabitsToday.tsx), the same day as the rhythm screen.

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const base: RhythmDay = { day: "2026-10-21", on: { water: true, meals: true, sleep: true }, glasses: 0, meals: 0 };

describe("one tap", () => {
  it("water and meals add one (capped), a habit that's off changes nothing", () => {
    expect(logHabit(base, "water", at(21, 9))?.glasses).toBe(1);
    expect(logHabit({ ...base, glasses: 24 }, "water", at(21, 9))).toBeNull();
    expect(logHabit(base, "meal", at(21, 13))?.meals).toBe(1);
    expect(logHabit({ ...base, meals: 6 }, "meal", at(21, 13))).toBeNull();
    expect(logHabit({ ...base, on: { ...base.on, water: false } }, "water", at(21, 9))).toBeNull();
    expect(logHabit({ ...base, glasses: 2 }, "water", at(21, 9), true)?.glasses).toBe(1);
  });

  it("bedtime opens 2 hours before 23:00 and until 5 am; logged once", () => {
    expect(bedOpen(at(21, 12))).toBe(false);
    expect(logHabit(base, "bed", at(21, 12))).toBeNull();
    expect(bedOpen(at(21, 21))).toBe(true);
    expect(logHabit(base, "bed", at(21, 22, 30))?.bedAt).toBe(22 * 60 + 30);
    expect(logHabit({ ...base, bedAt: 1350 }, "bed", at(21, 23))).toBeNull();
    expect(bedOpen(at(22, 0, 40))).toBe(true);
  });

  it("the habit day ends at 5 am: at 00:40 it's still yesterday's day; a new day keeps the switches", () => {
    expect(dayOf([base], at(22, 0, 40)).day).toBe("2026-10-21");
    const fresh = dayOf([{ ...base, glasses: 5, on: { water: true, meals: false, sleep: true } }], at(22, 8));
    expect(fresh).toEqual({ day: "2026-10-22", on: { water: true, meals: false, sleep: true }, glasses: 0, meals: 0 });
  });

  it("done counts and the API's day follow the same check-ins", () => {
    const d = { ...base, glasses: 8, meals: 2, bedAt: 1380 };
    expect(habitsDone(d)).toEqual({ done: 2, total: 3 });
    expect(habitSend(d)).toEqual({
      day: "2026-10-21",
      water: { glasses: 8, target: 8 },
      meals: { done: 2, target: 3 },
      sleep: { bedAt: 1380, target: 1380 },
    });
    expect(withDay([base, { ...base, day: "2026-10-19" }], { ...base, glasses: 1 }).map((x) => [x.day, x.glasses])).toEqual([
      ["2026-10-19", 0],
      ["2026-10-21", 1],
    ]);
  });
});
