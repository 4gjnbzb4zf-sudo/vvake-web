// Copied from VVFit packages/game-core/test/nextStep.test.ts (f1594c6b 2026-10-28) by scripts/sync-suggest-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import {
  ledgerCoachLine,
  mergeLedgers,
  nextSteps,
  recordStep,
  STEP_DEFS,
  type Moment,
  type StepContext,
  type StepLedger,
} from "./nextStep";

const now = new Date("2026-10-28T12:00:00Z");
const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  level: "guide",
  featureOn: () => true,
  ledger: {},
  now,
  lang: "en",
  ...over,
});
const hike: Moment = { kind: "hike_end", sport: "hike", minutes: 150, placeNew: true, spotVisits: 3, remote: true, pb: false };

describe("next steps (ADR-0062 §4)", () => {
  it("ids are unique and every step has EN and FR text", () => {
    expect(new Set(STEP_DEFS.map((d) => d.id)).size).toBe(STEP_DEFS.length);
    for (const d of STEP_DEFS) expect(d.text.en && d.text.fr, d.id).toBeTruthy();
  });
  it("a hike at a new spot: rate it first, then up to 2 more (guide)", () => {
    const r = nextSteps(hike, ctx());
    expect(r.primary?.id).toBe("rate_spot");
    expect(r.more.map((s) => s.id)).toEqual(["plan_outing", "new_spot"]);
  });
  it("essentials shows only the primary; quiet and a live workout show nothing", () => {
    expect(nextSteps(hike, ctx({ level: "essentials" }))).toEqual({ primary: expect.objectContaining({ id: "rate_spot" }), more: [] });
    expect(nextSteps(hike, ctx({ level: "quiet" }))).toEqual({ primary: null, more: [] });
    expect(nextSteps(hike, ctx({ inWorkout: true }))).toEqual({ primary: null, more: [] });
  });
  it("features that are off are never offered", () => {
    const r = nextSteps(hike, ctx({ featureOn: (f) => f !== "outdoor" }));
    expect(r.primary).toBeNull();
  });
  it("the founder examples: a best time → dare a friend; 5 in a row → City Clash", () => {
    const run: Moment = { kind: "gps_end", sport: "run", minutes: 30, pb: true, last7: 5 };
    const r = nextSteps(run, ctx());
    expect([r.primary?.id, ...r.more.map((s) => s.id)]).toEqual(["dare_pb", "clash_join"]);
    expect(r.more[0]?.text).toContain("5 sessions");
  });
  it("a camera workout: review the plan when it felt hard, teach a move, save the routine", () => {
    const cam: Moment = { kind: "camera_end", minutes: 25, feel: "hard", hasPlan: true, skippedMoves: 1, sameRoutine: 3, unsaved: true };
    const r = nextSteps(cam, ctx({ lang: "fr" }));
    expect(r.primary?.id).toBe("review_plan");
    expect(r.primary?.text).toContain("dur");
    expect(r.more.map((s) => s.id)).toEqual(["save_training", "teach_move"]);
  });
  it("dismissed twice → muted 60 days; ignored 4 times → muted 30 days; accepted 3 times → leads", () => {
    let l: StepLedger = {};
    l = recordStep(l, "rate_spot", "dismissed", now);
    expect(nextSteps(hike, ctx({ ledger: l })).primary?.id).toBe("rate_spot");
    l = recordStep(l, "rate_spot", "dismissed", now);
    expect(nextSteps(hike, ctx({ ledger: l })).primary?.id).not.toBe("rate_spot");
    const later = new Date(now.getTime() + 61 * 86_400_000);
    expect(nextSteps(hike, ctx({ ledger: l, now: later })).primary?.id).toBe("rate_spot");
    let g: StepLedger = {};
    for (let i = 0; i < 4; i++) g = recordStep(g, "new_spot", "ignored", now);
    expect(g.new_spot?.mutedUntil).toBeTruthy();
    let p: StepLedger = {};
    for (let i = 0; i < 3; i++) p = recordStep(p, "plan_outing", "accepted", now);
    expect(nextSteps(hike, ctx({ ledger: p })).primary?.id).toBe("plan_outing");
  });
  it('caps: a capped step waits its days; "never after N No" holds', () => {
    let l = recordStep({}, "dare_pb", "shown", now);
    const run: Moment = { kind: "gps_end", pb: true };
    expect(nextSteps(run, ctx({ ledger: l })).primary).toBeNull();
    expect(nextSteps(run, ctx({ ledger: l, now: new Date(now.getTime() + 8 * 86_400_000) })).primary?.id).toBe("dare_pb");
    l = recordStep(recordStep({}, "watch_install", "dismissed", now), "watch_install", "dismissed", now);
    const phone: Moment = { kind: "gps_end", phoneOnly: true, watchWithoutApp: true, minutes: 20 };
    expect(nextSteps(phone, ctx({ ledger: l, now: new Date(now.getTime() + 400 * 86_400_000) })).primary).toBeNull();
  });
  it("ledgers merge newest per step and feed the coach a line", () => {
    const a = recordStep({}, "x", "accepted", now);
    const b = recordStep({}, "x", "dismissed", new Date(now.getTime() + 1000));
    expect(mergeLedgers(a, b).x?.dismissed).toBe(1);
    let l: StepLedger = {};
    for (let i = 0; i < 3; i++) l = recordStep(l, "rate_spot", "accepted", now);
    l = recordStep(recordStep(l, "teach_move", "dismissed", now), "teach_move", "dismissed", now);
    expect(ledgerCoachLine(l, now)).toBe("Suggestions: likes rate_spot; ignores teach_move (never propose those).");
  });
});
