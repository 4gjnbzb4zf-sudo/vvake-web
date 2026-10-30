import { describe, expect, it } from "vitest";
import {
  adaptiveUpload,
  adjustLine,
  answerAdaptive,
  cueEssential,
  pacesOf,
  plannedOf,
  restoreAdaptive,
  RPE_CARD_S,
  startAdaptive,
  stepAdaptive,
  viewOf,
  zoneCapOf,
  type WorkoutAdaptive,
} from "./workoutAdaptive";

const run = (a: WorkoutAdaptive, from: number, to: number, x: { zone?: number; paceSPerKm?: number } = {}) => {
  const cues: string[] = [];
  for (let t = from; t <= to; t++) {
    const r = stepAdaptive(a, { t, ...x });
    a = r.a;
    cues.push(...r.cues.map((c) => c.kind));
  }
  return { a, cues };
};

describe("adaptive web workout", () => {
  it("starts only for a planned session with a live structure", () => {
    const prefs = null;
    expect(startAdaptive({ purpose: "strength", minutes: 30 }, { sport: "strength", prefs, level: "guide" })).toBeNull();
    expect(startAdaptive({ purpose: "", minutes: 30 }, { sport: "run", prefs, level: "guide" })).toBeNull();
    const a = startAdaptive({ purpose: "intervals", minutes: 45, zone: 4 }, { sport: "run", prefs, level: "guide" })!;
    expect(a.timing).toBe("adaptive");
    expect(a.rpeChecks).toBe(true);
    expect(a.structure.segments.some((s) => s.kind === "work")).toBe(true);
  });

  it("follows the settings: Fixed timing, effort checks off in Quiet unless turned on", () => {
    const at = "2026-10-30T10:00:00.000Z";
    const quiet = startAdaptive(
      { purpose: "easy", minutes: 30 },
      { sport: "run", prefs: { timing: "fixed", rpeChecks: "auto", at }, level: "quiet" },
    )!;
    expect(quiet.timing).toBe("fixed");
    expect(quiet.rpeChecks).toBe(false);
    const on = startAdaptive(
      { purpose: "easy", minutes: 30 },
      { sport: "run", prefs: { timing: "adaptive", rpeChecks: "on", at }, level: "quiet" },
    )!;
    expect(on.rpeChecks).toBe(true);
  });

  it("a strained day or an easy-only health setting makes a quality session easy", () => {
    const strained = startAdaptive(
      { purpose: "intervals", minutes: 45 },
      { sport: "run", prefs: null, level: "guide", readiness: "strained" },
    )!;
    expect(strained.structure.eased).toBe("strained");
    expect(strained.structure.segments.every((s) => s.kind !== "work")).toBe(true);
    const easyOnly = startAdaptive(
      { purpose: "intervals", minutes: 45 },
      { sport: "run", prefs: null, level: "guide", zoneCap: zoneCapOf({ easyOnly: true }) },
    )!;
    expect(easyOnly.structure.segments.every((s) => (s.zone ?? 0) <= 2)).toBe(true);
    expect(zoneCapOf({ condition: true })).toBe(3);
    expect(zoneCapOf({ condition: true, cleared: true })).toBe(5);
  });

  it("asks for effort without heart rate, shows the card 20 s, feeds the answer and uploads it", () => {
    let a = startAdaptive({ purpose: "easy", minutes: 40 }, { sport: "run", prefs: null, level: "guide" })!;
    const r = run(a, 0, 1500);
    a = r.a;
    expect(r.cues[0]).toBe("segment_start");
    expect(r.cues).toContain("rpe_check");
    // The card closes by itself after 20 s.
    expect(a.askT).toBeNull();
    let asked: number | null = null;
    for (let t = 1501; t < 2400 && asked === null; t++) {
      a = stepAdaptive(a, { t }).a;
      if (a.askT !== null) asked = t;
    }
    if (asked !== null) {
      expect(stepAdaptive(a, { t: asked + RPE_CARD_S - 1 }).a.askT).toBe(asked);
      a = answerAdaptive(a, "hard");
      expect(a.askT).toBeNull();
      a = stepAdaptive(a, { t: asked + 1 }).a;
    } else {
      a = stepAdaptive(answerAdaptive(a, "hard"), { t: 1501 }).a;
    }
    const up = adaptiveUpload(a, 1600);
    expect(up.rpe).toBe(7);
    expect(up.adaptive.summary.rpe).toContain(7);
    expect(up.adaptive.structure.purpose).toBe("easy");
  });

  it("a recovery waits for the heart with a strap, and the view says so", () => {
    let a = startAdaptive({ purpose: "intervals", minutes: 45, zone: 4 }, { sport: "run", prefs: null, level: "guide" })!;
    // Warm-up in zone 2, then the first rep in zone 4.
    const wu = a.structure.segments[0]!.durS;
    a = run(a, 0, wu, { zone: 2 }).a;
    const rep = a.structure.segments[1]!.durS;
    a = run(a, wu + 1, wu + rep + 1, { zone: 4 }).a;
    const v = viewOf(a, wu + rep + 2, true);
    expect(v.kind).toBe("recover");
    expect(v.untilRecovered).toBe(true);
    expect(viewOf(a, wu + rep + 2, false).untilRecovered).toBe(false);
  });

  it("keeps a snapshot it can trust", () => {
    const a = startAdaptive({ purpose: "tempo", minutes: 40 }, { sport: "run", prefs: null, level: "guide" })!;
    const back = restoreAdaptive(JSON.parse(JSON.stringify(a)));
    expect(back?.structure).toEqual(a.structure);
    expect(restoreAdaptive({ structure: { v: 2 } })).toBeUndefined();
    expect(restoreAdaptive(null)).toBeUndefined();
  });

  it("paces from the set speeds, essential cues, plain adjustments", () => {
    expect(pacesOf({ easy: 10, hard: 14 })).toEqual({ easy: 360, hard: 257 });
    expect(pacesOf({ easy: 0 })).toBeUndefined();
    expect(cueEssential({ kind: "segment_start", seg: 0, segKind: "warmup", t: 0, haptic: "strong" })).toBe(true);
    expect(cueEssential({ kind: "nice_hold", seg: 0, segKind: "steady", t: 0, haptic: "none" })).toBe(false);
    const line = adjustLine(
      {
        v: 1,
        timing: "adaptive",
        purpose: "intervals",
        segs: [],
        workPlannedS: 0,
        workDoneS: 0,
        adjust: { shortened: 0, extended: 2, early: 0, dropped: 1, stepUps: 0, pain: false },
        rpe: [],
      },
      "en",
    );
    expect(line).toBe("2 rests extended, last rep dropped");
  });

  it("a season session (or the plain plan's typed one) becomes a planned start", () => {
    expect(plannedOf({ id: "2026-10-30#1", purpose: "intervals", minutes: 45, zone: 4 })).toEqual({
      purpose: "intervals",
      minutes: 45,
      zone: 4,
      sessionId: "2026-10-30#1",
    });
    expect(plannedOf({ type: "easy", minutes: 30, purpose: null })).toEqual({ purpose: "easy", minutes: 30 });
    expect(plannedOf({ minutes: 30 })).toBeUndefined();
    expect(plannedOf({ purpose: "easy", minutes: 0 })).toBeUndefined();
  });
});
