import { describe, expect, it } from "vitest";
import { paceOf } from "./geo";
import { elapsedS, newWorkout, pause, resume } from "./workout";
import { sessionTimes, showsPaused } from "./moving";

describe("moving time (build 56: a pause never counts in the pace)", () => {
  it("10 min, a 2 min pause, 10 min: the session's time and pace are the 20 moving minutes", () => {
    const t0 = Date.parse("2026-10-29T08:00:00Z");
    let w = newWorkout({ id: "x", userId: "u", sport: "run", now: t0, energy: 10 });
    w = pause(w, t0 + 10 * 60_000);
    w = resume(w, t0 + 12 * 60_000);
    const end = t0 + 22 * 60_000;
    const activeS = elapsedS(w, end);
    expect(activeS).toBe(1200);
    const times = sessionTimes({ startedAt: t0, endedAt: end, activeS });
    expect(times).toEqual({ movingS: 1200, elapsedS: 1320, pausedS: 120 });
    expect(showsPaused(times)).toBe(true);
    expect(paceOf(activeS, 4000)).toBe(300); // 5:00 /km, never 5:30
  });

  it("the founder's phone run shape: 1617 s in all, 1505 s moving", () => {
    const t = sessionTimes({ startedAt: "2026-10-29T15:58:00.000Z", endedAt: "2026-10-29T16:24:57.000Z", activeS: 1505 });
    expect(t).toEqual({ movingS: 1505, elapsedS: 1617, pausedS: 112 });
    expect(showsPaused(sessionTimes({ startedAt: 0, endedAt: 100_000, activeS: 90 }))).toBe(false);
    expect(sessionTimes({ startedAt: 0, endedAt: 100_000, activeS: 130 }).pausedS).toBe(0);
  });
});
