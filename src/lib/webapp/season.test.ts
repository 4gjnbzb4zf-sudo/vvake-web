import { describe, expect, it } from "vitest";
import fixture from "./fixtures/season-fixture.json";
import {
  addDays,
  applyAlternative,
  byDay,
  cleanHealth,
  cleanPrefs,
  countdown,
  draftOf,
  duration,
  emptyDraft,
  finishTime,
  goalOf,
  goalProblems,
  lastUndo,
  mondayOf,
  newGoalId,
  parseSeason,
  shareText,
  storedGoals,
  timeline,
  todaySchema,
  weekdayOf,
  type SeasonGoal,
} from "./season";
import * as z from "zod/mini";

// The fixture is a live GET /v1/season answer (2026-10-22, Paris): an A marathon on 2027-04-11 and a B half on
// 2027-02-14, running 4× and strength 1× a week, 5 days, 5 h a week.
const TODAY = "2026-10-22";
const NOW = "2026-10-22T10:00:00.000Z";

describe("season answer parsing", () => {
  it("reads the live answer: plan, phases, week, goals, card", () => {
    const s = parseSeason(fixture)!;
    expect(s.plan!.phases.map((p) => p.phase)).toEqual(["base", "build", "peak", "taper", "race", "recovery"]);
    expect(s.week!.label).toBe("Base · week 1/10");
    expect(s.week!.sessions.length).toBeGreaterThan(0);
    expect(s.week!.sessions[0]!.line).toMatch(/^Base week 1/);
    expect(s.goals.find((g) => g.goalId === "sgtestmar1")!.days).toBe(171);
    expect(s.card!.countdown).toBe(171);
    expect(s.feasibility[0]!.text!.alternatives.length).toBe(s.feasibility[0]!.alternatives.length);
  });
  it("an empty season (no plan yet) and older answers without the new fields still parse", () => {
    const s = parseSeason({
      state: { goals: [], prefs: { sports: [], days: [1, 3] }, edits: [] },
      health: {},
      notMedical: "x",
      plan: null,
    })!;
    expect(s.plan).toBeNull();
    expect(s.goals).toEqual([]);
    expect(s.week ?? null).toBeNull();
    expect(s.today).toEqual([]);
  });
  it("drops a bad entry instead of failing the whole answer", () => {
    const raw = structuredClone(fixture) as unknown as { week: { sessions: unknown[] }; state: { goals: unknown[] } };
    raw.week.sessions.push({ id: 3 }, null);
    raw.state.goals.push({ nope: true });
    const s = parseSeason(raw)!;
    expect(s.week!.sessions.length).toBe(fixture.week.sessions.length);
    expect(s.state.goals.length).toBe(2);
    expect(parseSeason("hello")).toBeNull();
  });
  it("today's season words are optional (an older API sends none)", () => {
    expect(
      z.parse(todaySchema, { suggestion: { sport: "run", minutes: 30 }, reason: "Easy run" }).suggestion!.phaseLabel ?? null,
    ).toBeNull();
    const rest = z.parse(todaySchema, {
      suggestion: null,
      reason: "Rest day",
      season: { phaseLabel: "Base · week 1/10", goal: { name: "Marathon", days: 171 } },
    });
    expect(rest.season!.goal!.days).toBe(171);
  });
  it("keeps the stored goals and prefs in the API's shape", () => {
    const s = parseSeason(fixture)!;
    const goals = storedGoals(s);
    expect(goals.map((g) => g.id).sort()).toEqual(["sgtesthalf1", "sgtestmar1"]);
    expect(goals[0]).not.toHaveProperty("title");
    expect(cleanPrefs(s.state.prefs)).toEqual({
      sports: [
        { sport: "run", perWeek: 4 },
        { sport: "strength", perWeek: 1 },
      ],
      days: [0, 1, 3, 5, 6],
      hoursPerWeek: 5,
    });
  });
});

describe("prefs and health flags", () => {
  it("clamps and drops what the API refuses", () => {
    expect(
      cleanPrefs({
        sports: [
          { sport: "run", perWeek: 9 },
          { sport: "Bad Sport", perWeek: 2 },
        ],
        days: [6, 1, 1, 8],
        slots: { "1": { start: "07:00", end: "08:00" }, "2": { start: "09:00", end: "08:00" }, "9": { start: "07:00", end: "08:00" } },
        hoursPerWeek: 4.3,
        horizonWeeks: 2,
      }),
    ).toEqual({
      sports: [{ sport: "run", perWeek: 7 }],
      days: [1, 6],
      slots: { "1": { start: "07:00", end: "08:00" } },
      hoursPerWeek: 4.5,
      horizonWeeks: 4,
    });
  });
  it("sends flags only, and the go-ahead only with a condition", () => {
    expect(cleanHealth({ condition: true, cleared: true, injury: false, age: 41 })).toEqual({ condition: true, cleared: true, age: 41 });
    expect(cleanHealth({ cleared: true })).toEqual({});
    const withName = { condition: true, name: "hypertension" } as unknown as Parameters<typeof cleanHealth>[0];
    expect(JSON.stringify(cleanHealth(withName))).not.toMatch(/hypertension/);
  });
});

describe("days and words", () => {
  it("counts days and weeks on calendar days", () => {
    expect(weekdayOf(TODAY)).toBe(3);
    expect(mondayOf(TODAY)).toBe("2026-10-19");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-27", 2)).toBe("2027-03-29"); // across a clock change
  });
  it("says countdowns, durations and times", () => {
    expect(countdown(171, "en")).toBe("171 d");
    expect(countdown(171, "fr")).toBe("171 j");
    expect(countdown(0, "en")).toBe("today");
    expect(countdown(1, "fr")).toBe("demain");
    expect(duration(70)).toBe("1 h 10 min");
    expect(duration(45)).toBe("45 min");
    expect(duration(120)).toBe("2 h");
    expect(finishTime(3 * 3600 + 45 * 60)).toBe("3:45:00");
    expect(finishTime(52 * 60 + 30)).toBe("52:30");
  });
});

describe("goals", () => {
  it("makes ids the API accepts", () => {
    expect(newGoalId()).toMatch(/^sg[a-z0-9]{4,24}$/);
    expect(newGoalId(() => 0.999999)).toMatch(/^sg[a-z0-9]{10}$/);
  });
  it("turns a draft into an event goal with its preset distance, a custom trail, and a time", () => {
    const d = {
      ...emptyDraft(TODAY, "sgabcdef"),
      kind: "marathon" as const,
      date: "2027-04-11",
      targetH: 3,
      targetM: 45,
      title: " Paris ",
    };
    expect(goalOf(d, TODAY, NOW)).toEqual({
      id: "sgabcdef",
      type: "event",
      priority: "A",
      title: "Paris",
      sport: "run",
      event: { kind: "marathon", distanceM: 42195 },
      targetTimeS: 13500,
      date: "2027-04-11",
      start: TODAY,
      updatedAt: NOW,
    });
    const trail = goalOf({ ...d, kind: "trail", distanceKm: 42.5, elevationM: 2400, targetH: 0, targetM: 0, title: "" }, TODAY, NOW);
    expect(trail.event).toEqual({ kind: "trail", distanceM: 42500, elevationM: 2400 });
    expect(trail).not.toHaveProperty("targetTimeS");
  });
  it("a health or free goal spans weeks from today", () => {
    const g = goalOf({ ...emptyDraft(TODAY, "sgabcdef"), type: "health", health: "strength", spanWeeks: 26 }, TODAY, NOW);
    expect(g).toMatchObject({ type: "health", health: "strength", date: addDays(TODAY, 182) });
    expect(g).not.toHaveProperty("event");
    expect(draftOf(g, TODAY).spanWeeks).toBe(26);
  });
  it("finds the problems the API would refuse", () => {
    const base = goalOf({ ...emptyDraft(TODAY, "sgabcdef"), kind: "10k" }, TODAY, NOW);
    expect(goalProblems(base, TODAY)).toEqual([]);
    expect(goalProblems({ ...base, date: "2026-09-01" }, TODAY)).toEqual(["date-past"]);
    expect(goalProblems({ ...base, date: "2028-06-01" }, TODAY)).toEqual(["too-far"]);
    expect(goalProblems({ ...base, type: "performance" }, TODAY)).toEqual(["bad-time"]);
    expect(goalProblems({ ...base, date: "nope" }, TODAY)).toEqual(["no-date"]);
    expect(goalProblems({ id: "sgabcdef", type: "free", priority: "A", start: TODAY, date: addDays(TODAY, 7) }, TODAY)).toEqual([
      "bad-span",
    ]);
  });
  it("draft → goal → draft keeps what was typed", () => {
    const g = storedGoals(parseSeason(fixture)!).find((x) => x.id === "sgtestmar1")!;
    const back = goalOf(draftOf(g, TODAY), TODAY, NOW);
    expect({ ...back, updatedAt: undefined }).toEqual({ ...g, updatedAt: undefined });
  });
});

describe("applying a review's alternative", () => {
  const goal: SeasonGoal = {
    id: "sgtesthalf1",
    type: "performance",
    priority: "A",
    title: "City half",
    sport: "run",
    event: { kind: "half", distanceM: 21097 },
    targetTimeS: 5400,
    date: "2027-02-14",
    start: TODAY,
  };
  const o = { prefs: { sports: [], days: [1, 3, 5] }, health: {}, nowIso: NOW, today: TODAY, newId: "sgnewstep01" };
  const alt = (a: Record<string, unknown>) =>
    ({ date: null, event: null, timeS: null, hoursPerWeek: null, ...a }) as Parameters<typeof applyAlternative>[1];
  it("a later date, a shorter distance (its name and time dropped), B priority", () => {
    expect(applyAlternative(goal, alt({ kind: "later-date", date: "2027-04-08" }), o)!.goals[0]).toMatchObject({
      date: "2027-04-08",
      updatedAt: NOW,
    });
    const shorter = applyAlternative(goal, alt({ kind: "shorter", event: "10k" }), o)!.goals[0]!;
    expect(shorter).toMatchObject({ type: "event", event: { kind: "10k", distanceM: 10000 } });
    expect(shorter).not.toHaveProperty("title");
    expect(shorter).not.toHaveProperty("targetTimeS");
    expect(applyAlternative(goal, alt({ kind: "make-b" }), o)!.goals[0]!.priority).toBe("B");
  });
  it("a step first: a new B race, the goal unchanged", () => {
    const r = applyAlternative(goal, alt({ kind: "intermediate", event: "10k", date: "2027-01-28" }), o)!;
    expect(r.goals).toEqual([
      {
        id: "sgnewstep01",
        type: "event",
        priority: "B",
        sport: "run",
        event: { kind: "10k", distanceM: 10000 },
        date: "2027-01-28",
        start: TODAY,
        updatedAt: NOW,
      },
    ]);
  });
  it("a realistic time, finishing instead, more hours, the doctor's go-ahead; unknown kinds do nothing", () => {
    expect(applyAlternative(goal, alt({ kind: "target-time", timeS: 6000 }), o)!.goals[0]!.targetTimeS).toBe(6000);
    const finish = applyAlternative(goal, alt({ kind: "finish-goal" }), o)!.goals[0]!;
    expect(finish.type).toBe("event");
    expect(finish).not.toHaveProperty("targetTimeS");
    expect(applyAlternative(goal, alt({ kind: "more-hours", hoursPerWeek: 4.5 }), o)).toEqual({
      goals: [],
      prefs: { ...o.prefs, hoursPerWeek: 4.5 },
    });
    expect(applyAlternative(goal, alt({ kind: "clearance" }), o)!.health).toEqual({ condition: true, cleared: true });
    expect(applyAlternative(goal, alt({ kind: "teleport" }), o)).toBeNull();
    expect(applyAlternative(goal, alt({ kind: "shorter", event: "moon" }), o)).toBeNull();
  });
});

describe("the week and undo", () => {
  it("lays the week out Monday to Sunday", () => {
    const s = parseSeason(fixture)!;
    const days = byDay(s.week!.sessions, s.week!.start);
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(days.flatMap((d) => d.sessions).length).toBe(s.week!.sessions.length);
  });
  it("undoes the newest change; a coach change as a whole", () => {
    expect(lastUndo([])).toBeNull();
    expect(
      lastUndo([
        { id: "aaaaaa111111", kind: "move", source: "user", changeId: null, createdAt: "2026-10-22T08:00:00Z" },
        { id: "bbbbbb222222", kind: "easier", source: "coach", changeId: "9e0666882b109963", createdAt: "2026-10-22T09:00:00Z" },
      ]),
    ).toEqual({ kind: "change", id: "9e0666882b109963" });
    expect(lastUndo([{ id: "aaaaaa111111", kind: "move", source: "user", changeId: null, createdAt: "2026-10-22T08:00:00Z" }])).toEqual({
      kind: "edit",
      id: "aaaaaa111111",
    });
  });
});

describe("the timeline", () => {
  const s = parseSeason(fixture)!;
  const t = timeline(s.plan!, TODAY);
  it("phases fill the width in order, without gaps or overlaps", () => {
    expect(t.weeks).toBe(29);
    expect(t.segments[0]!.left).toBe(0);
    for (let i = 1; i < t.segments.length; i++) expect(t.segments[i]!.left).toBeCloseTo(t.segments[i - 1]!.left + t.segments[i - 1]!.width);
    const last = t.segments.at(-1)!;
    expect(last.left + last.width).toBeCloseTo(1);
    expect(t.segments[0]).toMatchObject({ phase: "base", weeks: 10, from: "2026-10-19", to: "2026-12-27", current: true });
  });
  it("places the races, the benchmarks, today and the months", () => {
    expect(t.races.map((r) => [r.goalId, r.priority])).toEqual([
      ["sgtesthalf1", "B"],
      ["sgtestmar1", "A"],
    ]);
    expect(t.races[1]!.at).toBeCloseTo((24 * 7 + 6) / (29 * 7));
    expect(t.benchmarks.length).toBeGreaterThan(0);
    expect(t.today).toBeCloseTo(3 / (29 * 7));
    expect(t.months[0]!.date).toBe("2026-11-01");
    expect(t.months.length).toBeLessThanOrEqual(7);
    expect(t.bars.length).toBe(29);
    expect(Math.max(...t.bars.map((b) => b.value))).toBe(1);
    expect(t.bars.filter((b) => b.current).map((b) => b.index)).toEqual([0]);
  });
});

describe("sharing", () => {
  it("says the goal, the countdown, the phase and readiness, nothing about health", () => {
    const card = parseSeason(fixture)!.card!;
    const text = shareText(card, { daysToGo: "{n} days to go", readiness: "readiness {n}/100" }, "https://vvake.com/en/app/");
    expect(text).toBe("Marathon · 11 April 2027 · 171 days to go · Base · readiness 0/100\nhttps://vvake.com/en/app/");
  });
});
