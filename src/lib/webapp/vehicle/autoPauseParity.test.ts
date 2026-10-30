import { describe, expect, it } from "vitest";
import golden from "../fixtures/auto-pause-golden.json";
import { autoPauseModeFor, autoPauseTick, newAutoPause, newerAutoPausePrefs, type AutoPauseInput, type AutoPauseMode } from "./autoPause";

/**
 * The browser pauses and resumes as the phone and the watches do: game-core's golden stop/go timelines (VVFit
 * packages/game-core/test/fixtures/auto-pause-golden.json, copied by scripts/sync-vehicle-core.ts), replayed the way
 * game-core's export runs them (an action changes the pause state the next reading sees).
 */
type Row = Omit<AutoPauseInput, "t" | "pausedBy"> & { user?: "pause" | "resume" | "vehicle" | "vehicle_end" };
interface Timeline {
  name: string;
  sport: string;
  mode: AutoPauseMode;
  step: number;
  rows: Row[];
  actions: unknown[];
  pausedBy: AutoPauseInput["pausedBy"];
}

describe("auto-pause parity with game-core", () => {
  it("replays the golden stop/go timelines", () => {
    for (const tl of golden.timelines as unknown as Timeline[]) {
      let s = newAutoPause();
      let pausedBy: AutoPauseInput["pausedBy"] = null;
      const actions: unknown[] = [];
      tl.rows.forEach((row, k) => {
        const { user, ...r } = row;
        if (user === "pause") pausedBy = "user";
        if (user === "resume" || user === "vehicle_end") pausedBy = null;
        if (user === "vehicle") pausedBy = "vehicle";
        const x = autoPauseTick(tl.sport, tl.mode, s, { t: k * tl.step, ...r, pausedBy });
        s = x.state;
        if (x.action) {
          actions.push({ i: k, ...x.action });
          if (x.action.kind === "pause") pausedBy = "auto";
          if (x.action.kind === "resume") pausedBy = null;
        }
      });
      expect(actions, tl.name).toEqual(tl.actions);
      expect(pausedBy, tl.name).toBe(tl.pausedBy);
    }
  });

  it("matches the per-sport defaults and stored choices", () => {
    for (const m of golden.modes as { sport: string; def: string; set: string }[]) {
      expect(autoPauseModeFor(m.sport, null), m.sport).toBe(m.def);
      expect(autoPauseModeFor(m.sport, { bySport: { [m.sport]: "off" } }), m.sport).toBe(m.set);
    }
  });

  it("prefs.autoPause: the newer choice wins", () => {
    const a = { bySport: { run: "off" as const }, at: "2026-10-30T10:00:00.000Z" };
    const b = { bySport: { run: "auto" as const }, at: "2026-10-29T10:00:00.000Z" };
    expect(newerAutoPausePrefs(a, b)).toEqual(a);
    expect(newerAutoPausePrefs(b, a)).toEqual(a);
    expect(newerAutoPausePrefs(null, b)).toEqual(b);
  });
});
