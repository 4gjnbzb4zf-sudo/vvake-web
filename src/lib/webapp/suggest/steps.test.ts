import { describe, expect, it } from "vitest";
import type { ApiSession } from "@/lib/webapp/api";
import { nextSteps, recordStep, STEP_DEFS, type StepContext } from "./nextStep";
import {
  accountBehind,
  cameraMoment,
  gpsMoment,
  mergeStepsPrefs,
  parseStepsPrefs,
  pruneLedger,
  replayTours,
  sessionsLast7,
  tourKey,
  tourSeen,
  trainingMoment,
  webRouteForScreen,
  COACH_SCREEN_WEB,
  webRouteForStep,
} from "./steps";

const now = new Date("2026-10-28T12:00:00Z");
const DAY = 86_400_000;
const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  level: "guide",
  featureOn: () => true,
  ledger: {},
  now,
  lang: "en",
  ...over,
});
/** The catalogue as the web offers it: only steps with a web screen. */
const webDefs = (target = {}) =>
  STEP_DEFS.filter((d) => webRouteForStep({ route: d.route, params: d.params ? d.params({ kind: d.moments[0]! }) : {} }, target));

describe("prefs.steps on the web", () => {
  it("reads a ledger, drops bad records, refuses a bad value", () => {
    const ledger = recordStep({}, "teach_move", "shown", now);
    const p = parseStepsPrefs({ ledger: { ...ledger, broken: { shown: 1 }, ["x".repeat(80)]: ledger.teach_move }, at: now.toISOString() });
    expect(Object.keys(p!.ledger)).toEqual(["teach_move"]);
    expect(p!.ledger.teach_move!.shown).toBe(1);
    expect(parseStepsPrefs({ ledger, at: "soon" })).toBeNull();
    expect(parseStepsPrefs(undefined)).toBeNull();
  });

  it("merges two devices per step, newest wins, and knows when the account lacks ours", () => {
    const a = { ledger: recordStep({}, "teach_move", "accepted", now), at: now.toISOString() };
    const later = new Date(now.getTime() + 1000);
    const b = { ledger: recordStep({}, "teach_move", "dismissed", later), at: later.toISOString() };
    const m = mergeStepsPrefs(a, b)!;
    expect(m.ledger.teach_move!.dismissed).toBe(1);
    expect(m.at).toBe(later.toISOString());
    expect(accountBehind(a.ledger, b.ledger)).toBe(false);
    expect(accountBehind(b.ledger, a.ledger)).toBe(true);
    expect(accountBehind(a.ledger, null)).toBe(true);
  });

  it("forgets steps after 90 days but never a tour", () => {
    const old = new Date(now.getTime() - 91 * DAY);
    const l = recordStep(recordStep({}, "teach_move", "shown", old), tourKey("camera"), "shown", old);
    expect(Object.keys(pruneLedger(l, now))).toEqual([tourKey("camera")]);
  });
});

describe("first-time tours", () => {
  it("show once, then come back only when replayed (stamped to win the merge)", () => {
    let l = recordStep({}, tourKey("gps"), "shown", now);
    l = recordStep(l, tourKey("gps"), "dismissed", now);
    expect(tourSeen(l, "gps")).toBe(true);
    expect(tourSeen(l, "camera")).toBe(false);
    const later = new Date(now.getTime() + 1000);
    const r = replayTours(l, later);
    expect(tourSeen(r, "gps")).toBe(false);
    expect(
      mergeStepsPrefs({ ledger: l, at: now.toISOString() }, { ledger: r, at: later.toISOString() })!.ledger[tourKey("gps")]!.shown,
    ).toBe(0);
  });
});

describe("moments from what the web knows", () => {
  it("leaves out what it doesn't know (no place, PB, friends or watch on the web)", () => {
    const m = gpsMoment({ sport: "run", activeS: 1830, feel: null, last7: 2 });
    expect(m).toEqual({ kind: "gps_end", sport: "run", minutes: 31, last7: 2 });
    expect(gpsMoment({ sport: "hike", activeS: 60 }).kind).toBe("hike_end");
    expect(cameraMoment({ sport: "strength", activeS: 600, feel: "hard", hasPlan: true })).toEqual({
      kind: "camera_end",
      sport: "strength",
      minutes: 10,
      feel: "hard",
      hasPlan: true,
    });
    expect(trainingMoment({ sport: "strength", activeS: 600, score: 840 }).score).toBe(840);
  });

  it("counts the last 7 days' sessions with the one just done", () => {
    const s = (id: string, daysAgo: number, excluded = false) =>
      ({ id, startedAt: new Date(now.getTime() - daysAgo * DAY).toISOString(), excluded }) as ApiSession;
    const list = [s("a", 1), s("b", 3), s("c", 8), s("d", 2, true)];
    expect(sessionsLast7(list, now.getTime(), "new")).toBe(3);
    expect(sessionsLast7(list, now.getTime(), "a")).toBe(2);
  });

  it("offers on the web only the steps it has a screen for", () => {
    const ids = webDefs().map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["clash_join", "teach_move", "new_training", "save_training", "review_plan", "new_spot"]));
    for (const no of ["rate_spot", "dare_pb", "race_route", "meetup_here", "invite_friend", "try_skill", "calendar_add", "watch_install"])
      expect(ids).not.toContain(no);
    expect(webDefs({ trainingRef: "ABCDEFGH" }).map((d) => d.id)).toContain("challenge_training");
  });

  it("a hard camera workout with a plan: review the week first; Quiet and a live workout: nothing", () => {
    const m = cameraMoment({ sport: "strength", activeS: 1500, feel: "hard", hasPlan: true, taughtMoves: 0, last7: 5 });
    const r = nextSteps(m, ctx(), webDefs());
    expect([r.primary?.id, ...r.more.map((x) => x.id)]).toEqual(["review_plan", "clash_join", "teach_move"]);
    expect(nextSteps(m, ctx({ level: "essentials" }), webDefs()).more).toEqual([]);
    expect(nextSteps(m, ctx({ level: "quiet" }), webDefs())).toEqual({ primary: null, more: [] });
    expect(nextSteps(m, ctx({ inWorkout: true }), webDefs())).toEqual({ primary: null, more: [] });
  });
});

describe("where a step or the coach's button opens", () => {
  it("maps the steps to web screens", () => {
    expect(webRouteForStep({ route: "/teach-move", params: {} })).toEqual({ name: "teach" });
    expect(webRouteForStep({ route: "/places", params: { sport: "hike", fresh: "1" } })).toEqual({ name: "places", sport: "hike" });
    expect(webRouteForStep({ route: "/places", params: { plan: "1" } })).toBeNull();
    expect(webRouteForStep({ route: "/challenge", params: { from: "training" } }, { trainingRef: "t_abcdefghij" })).toEqual({
      name: "training",
      ref: "t_abcdefghij",
    });
    expect(webRouteForStep({ route: "/challenge", params: { from: "pb" } })).toBeNull();
  });

  it("maps every coach open_screen route (game-core COACH_SCREENS) and nothing else", () => {
    // VVFit packages/game-core/src/coachScreens.ts, in order.
    const routes = [
      "/trainings",
      "/my-moves",
      "/skills",
      "/own-workout",
      "/move-loads",
      "/discover",
      "/teach-move",
      "/training-builder",
      "/places",
      "/season",
      "/plan",
      "/suggestions",
      "/sport-zones",
      "/connections",
      "/coach-voice",
      "/challenge",
      "/crew",
      "/health",
      "/rhythm",
      "/habits",
      "/points",
      "/you",
    ];
    expect(Object.keys(COACH_SCREEN_WEB)).toEqual(routes);
    expect(webRouteForScreen("/my-moves")).toEqual({ name: "trainings" });
    expect(webRouteForScreen("/health")).toEqual({ name: "season-health" });
    expect(webRouteForScreen("/skills")).toBeNull();
    expect(webRouteForScreen("my-moves")).toBeNull();
    expect(webRouteForScreen("/meetup")).toBeNull();
    expect(webRouteForScreen("toString")).toBeNull();
  });
});
