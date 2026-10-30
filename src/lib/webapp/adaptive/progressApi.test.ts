import { describe, expect, it } from "vitest";
import * as z from "zod/mini";
import {
  adaptiveOn,
  goalChart,
  keepFeatures,
  nextAdaptivePrefs,
  parseAdaptivePrefs,
  progressSchema,
  questionRef,
  undoable,
} from "./progressApi";

describe("athlete progress on the web", () => {
  it("reads the contract's answer, leniently", () => {
    const p = z.parse(progressSchema, {
      model: {
        load: { fitness: 30, fatigue: 35, form: -5 },
        trace: [{ week: "2026-10-26", fitness: 30, fatigue: 35 }, { bad: 1 }],
        sessionsUsed: 12,
      },
      readiness: { level: "tired", word: "A bit tired", lines: ["Under 6 hours of sleep these nights."] },
      goals: [
        {
          goalId: "sg1",
          name: "Paris half",
          trend: "behind",
          trendWord: "A little behind",
          lines: ["82% ready on the day at your current pace."],
          readiness: 82,
          needed: 50,
          now: 30,
          series: [
            { week: "2026-10-19", fitness: 28 },
            { week: "2026-10-26", fitness: 30 },
            { week: "2027-03-01", fitness: 45, projected: true },
          ],
        },
        { trend: "weird" },
      ],
      changes: [{ at: "2026-10-30T08:00:00Z", param: "maxHr", line: "Max heart rate 186 → 190: seen in 2 sessions." }],
      proposals: [
        {
          id: "abcd",
          source: "insight",
          status: "pending",
          summary: "A lighter week",
          lines: [{ label: "Sessions left", from: "100 %", to: "60 %" }],
        },
      ],
      question: {
        key: "rpe_session",
        text: "Your 40-min run: easy, moderate or hard?",
        sessionId: "s1",
        answers: ["easy", "moderate", "hard"],
      },
      training: { anything: true },
      learning: false,
    });
    expect(p.readiness?.level).toBe("tired");
    expect(p.model?.trace).toHaveLength(1);
    expect(p.goals[0]!.trend).toBe("behind");
    expect(p.goals[1]!.trend).toBe("learning");
    expect(p.proposals[0]!.why).toEqual([]);
    expect(questionRef(p.question!)).toBe("s1");
    // An older API: nothing to show, never a throw.
    const old = z.parse(progressSchema, {});
    expect(old.goals).toEqual([]);
    expect(old.question ?? null).toBeNull();
  });

  it("keeps undo for insight changes accepted lately", () => {
    const now = Date.parse("2026-10-30T12:00:00Z");
    const rows = [
      { id: "a", source: "insight", status: "accepted", undoUntil: "2026-11-20T00:00:00Z", why: [], lines: [] },
      { id: "b", source: "coach", status: "accepted", undoUntil: "2026-11-20T00:00:00Z", why: [], lines: [] },
      { id: "c", source: "insight", status: "accepted", undoUntil: "2026-10-01T00:00:00Z", why: [], lines: [] },
      { id: "d", source: "insight", status: "undone", undoUntil: "2026-11-20T00:00:00Z", why: [], lines: [] },
    ];
    expect(undoable(rows, now).map((r) => r.id)).toEqual(["a"]);
  });

  it("draws the goal: measured solid, projection dashed, the needed line", () => {
    const c = goalChart(
      {
        needed: 50,
        series: [
          { week: "a", fitness: 20 },
          { week: "b", fitness: 30 },
          { week: "c", fitness: 40, projected: true },
          { week: "d", fitness: 50, projected: true },
        ],
      },
      300,
      100,
    )!;
    expect(c.solid.startsWith("M0 ")).toBe(true);
    expect(c.dashed.split("L")).toHaveLength(3);
    expect(c.neededY).toBeCloseTo(100 - (50 / 55) * 100, 0);
    expect(goalChart({ series: [{ week: "a", fitness: 1 }] }, 300, 100)).toBeNull();
  });

  it("prefs.adaptive: newest wins, the other field kept", () => {
    expect(parseAdaptivePrefs(undefined)).toBeNull();
    expect(parseAdaptivePrefs({ timing: "fixed" })).toBeNull();
    const prev = { timing: "fixed", rpeChecks: "off", at: "2030-01-01T00:00:00.000Z" };
    const n = nextAdaptivePrefs(prev, { rpeChecks: "on" }, Date.parse("2026-10-30T00:00:00Z"));
    expect(n.timing).toBe("fixed");
    expect(n.rpeChecks).toBe("on");
    expect(Date.parse(n.at)).toBeGreaterThan(Date.parse(prev.at));
    expect(nextAdaptivePrefs(null, { timing: "fixed" }, 0).rpeChecks).toBe("auto");
  });

  it("features.adaptive from GET survives a PATCH answer without it", () => {
    const got = { id: "u", features: { adaptive: true } };
    const bare: { id: string; features?: unknown } = { id: "u" };
    const patched = keepFeatures(got, bare);
    expect(adaptiveOn(patched)).toBe(true);
    expect(adaptiveOn(bare)).toBe(false);
    const off: { id: string; features?: unknown } = { id: "u", features: { adaptive: false } };
    expect(keepFeatures(got, off).features).toEqual({ adaptive: false });
  });
});
