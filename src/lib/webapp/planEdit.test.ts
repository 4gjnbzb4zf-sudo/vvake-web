import { describe, expect, it } from "vitest";
import {
  addEdit,
  changeEdit,
  choiceLine,
  dismiss,
  draftOfSession,
  draftSummary,
  duplicateEdit,
  editBody,
  editsBody,
  emptySheet,
  isDismissed,
  missedActions,
  parseKm,
  sessionSummary,
  sessionType,
  undoIds,
  withType,
  withZone,
  zoneRangeText,
} from "./planEdit";
import { parseSeason, type MissedView, type SeasonSessionView } from "./season";

const NAMES: Record<string, { en: string; fr: string }> = {
  ride: { en: "Bike", fr: "Vélo" },
  run: { en: "Run", fr: "Course" },
  swim: { en: "Swim", fr: "Natation" },
};
const en = (k: string) => NAMES[k]?.en ?? "Workout";
const fr = (k: string) => NAMES[k]?.fr ?? "Séance";

// 2026-10-24 is a Saturday.
const session = (over: Partial<SeasonSessionView> = {}): SeasonSessionView => ({
  id: "2026-10-24#0",
  date: "2026-10-24",
  day: 5,
  sport: "ride",
  minutes: 60,
  intensity: "easy",
  purpose: "aerobic",
  zone: 2,
  title: "Easy ride",
  type: "easy",
  ...over,
});

describe("sessionSummary (game-core's words)", () => {
  it("reads like the phone: sport, minutes, zone, day and time", () => {
    expect(
      sessionSummary(
        { sport: "ride", minutes: 60, zone: 2, date: "2026-10-24", slot: "09:00", purpose: "aerobic", intensity: "easy" },
        "en",
        en,
      ),
    ).toBe("Bike · 60 min · Zone 2 · Sat 9:00");
    expect(
      sessionSummary(
        { sport: "ride", minutes: 60, zone: 2, date: "2026-10-24", slot: "09:00", purpose: "aerobic", intensity: "easy" },
        "fr",
        fr,
      ),
    ).toBe("Vélo · 60 min · Zone 2 · sam. 9:00");
  });

  it("names the type unless it's plain easy, and adds distance, effort and long durations", () => {
    expect(
      sessionSummary(
        {
          sport: "ride",
          minutes: 60,
          zone: 2,
          rpe: 4,
          distanceKm: 25,
          date: "2026-10-24",
          slot: "09:00",
          purpose: "easy",
          intensity: "easy",
        },
        "en",
        en,
      ),
    ).toBe("Bike · Easy · 60 min · 25 km · Zone 2 · Effort 4/10 · Sat 9:00");
    expect(
      sessionSummary({ sport: "run", minutes: 45, zone: 3, date: "2026-10-22", purpose: "tempo", intensity: "moderate" }, "en", en),
    ).toBe("Run · Tempo · 45 min · Zone 3 · Thu");
    expect(sessionSummary({ sport: "run", minutes: 130, zone: 2, date: "2026-10-25", purpose: "long", intensity: "easy" }, "fr", fr)).toBe(
      "Course · Longue · 2 h 10 · Zone 2 · dim.",
    );
    expect(sessionSummary({ sport: "run", minutes: 130, date: "2026-10-25", purpose: "long" }, "en", en)).toBe(
      "Run · Long · 2 h 10 min · Sun",
    );
  });

  it("uses a custom training's name", () => {
    expect(
      sessionSummary(
        { sport: "strength", title: "Leg day", minutes: 40, date: "2026-10-20", purpose: "custom", intensity: "moderate" },
        "en",
        en,
      ),
    ).toBe("Leg day · Tempo · 40 min · Tue");
  });

  it("reads the type like game-core", () => {
    expect(sessionType({ purpose: "hills" })).toBe("intervals");
    expect(sessionType({ purpose: "shakeout" })).toBe("recovery");
    expect(sessionType({ purpose: "aerobic", zone: 4 })).toBe("intervals");
    expect(sessionType({ purpose: "variety", intensity: "moderate" })).toBe("tempo");
    expect(sessionType({ purpose: "aerobic", zone: 2 })).toBe("easy");
  });
});

describe("the edit sheet", () => {
  it("shows the live summary as fields change", () => {
    let d = draftOfSession(session());
    expect(draftSummary(d, "en", en)).toBe("Bike · 60 min · Zone 2 · Sat");
    d = withType(d, "intervals");
    expect(d.zone).toBe(4);
    expect(draftSummary({ ...d, slot: "07:30" }, "en", en)).toBe("Bike · Intervals · 60 min · Zone 4 · Sat 7:30");
    d = withZone(d, 3);
    expect(d.intensity).toBe("moderate");
  });

  it("sends only what changed, null clears, nothing when unchanged", () => {
    const x = session({ distanceKm: 25, slot: "09:00", memo: "with Sam" });
    expect(changeEdit(x, draftOfSession(x))).toBeNull();
    const d = { ...draftOfSession(x), minutes: 75, distanceKm: null, slot: null, memo: "  ", date: "2026-10-25", locked: true };
    expect(changeEdit(x, d)).toEqual({
      kind: "change",
      session: "2026-10-24#0",
      minutes: 75,
      distanceKm: null,
      to: "2026-10-25",
      slot: null,
      memo: null,
      locked: true,
    });
  });

  it("sends the type, the zone and the effort", () => {
    const x = session();
    expect(changeEdit(x, withType(draftOfSession(x), "tempo"))).toEqual({ kind: "change", session: x.id, purpose: "tempo", zone: 3 });
    expect(changeEdit(x, { ...withZone(draftOfSession(x), null), rpe: 6 })).toEqual({ kind: "change", session: x.id, zone: null, rpe: 6 });
  });

  it("changing the sport of a custom training clears the training", () => {
    const x = session({ sport: "strength", trainingId: "t1", title: "Leg day", type: "strength" });
    expect(draftOfSession(x).title).toBe("Leg day");
    expect(changeEdit(x, { ...draftOfSession(x), sport: "run", trainingId: null, title: null })).toEqual({
      kind: "change",
      session: x.id,
      sport: "run",
      trainingId: null,
      title: null,
    });
    // A session's display title isn't a custom name.
    expect(draftOfSession(session()).title).toBeNull();
  });

  it("Add a session is an add with only the fields set", () => {
    expect(addEdit(emptySheet("2026-10-23", "swim"))).toEqual({
      kind: "add",
      date: "2026-10-23",
      sport: "swim",
      minutes: 30,
      purpose: "easy",
      zone: 2,
    });
    const d = { ...emptySheet("2026-10-23"), minutes: 2, rpe: 7, zone: null, distanceKm: 8, slot: "18:00", memo: " track ", locked: true };
    expect(addEdit(d)).toEqual({
      kind: "add",
      date: "2026-10-23",
      sport: "run",
      minutes: 5,
      purpose: "easy",
      rpe: 7,
      distanceKm: 8,
      slot: "18:00",
      memo: "track",
      locked: true,
    });
  });

  it("Duplicate is an add with the session's fields on another day", () => {
    expect(duplicateEdit(session({ rpe: 4, distanceKm: 25, memo: "flat" }), "2026-10-25")).toEqual({
      kind: "add",
      date: "2026-10-25",
      sport: "ride",
      minutes: 60,
      intensity: "easy",
      purpose: "easy",
      zone: 2,
      rpe: 4,
      distanceKm: 25,
      memo: "flat",
    });
  });

  it("reads distances and zone ranges", () => {
    expect(parseKm("12,5")).toBe(12.5);
    expect(parseKm("")).toBeNull();
    expect(parseKm("0")).toBeNull();
    expect(zoneRangeText([120, 135, 150, 165, 180], 2)).toBe("135–149 bpm");
    expect(zoneRangeText([120, 135, 150, 165, 180], 5)).toBe("≥ 180 bpm");
    expect(zoneRangeText([], 2)).toBeNull();
  });
});

describe("request bodies", () => {
  it("one edit, a batch, and the ids to undo", () => {
    expect(editBody({ kind: "skip", session: "2026-10-21#0" })).toEqual({ edit: { kind: "skip", session: "2026-10-21#0" }, device: "web" });
    const many = Array.from({ length: 9 }, (_, i) => ({ kind: "move", session: `2026-10-2${i}#0`, to: "2026-10-26" }));
    expect(editsBody(many).edits).toHaveLength(7);
    expect(editsBody(many).device).toBe("web");
    expect(undoIds({ editId: "a", editIds: ["a", "b"] })).toEqual(["a", "b"]);
    expect(undoIds({ editId: "a" })).toEqual(["a"]);
    expect(undoIds({})).toEqual([]);
  });
});

const choice = (to: string, ok = true, extra: Record<string, unknown> = {}) => ({
  to,
  ok,
  label: to,
  lines: ok ? [`moved to ${to}`] : [],
  ...(ok
    ? { edit: { kind: "postpone", session: "2026-10-21#0", from: "2026-10-21", to, copy: {} } }
    : { why: "race", whyText: "Race day" }),
  ...extra,
});

describe("the skipped session", () => {
  const raw = {
    session: { ...session({ id: "2026-10-21#0", date: "2026-10-21" }), summary: "Bike · 60 min · Zone 2 · Wed" },
    title: "You skipped Easy ride · 60 min. Postpone it?",
    body: "It happens.",
    unwell: false,
    quick: { ...choice("2026-10-23"), label: "Friday 23" },
    tomorrow: choice("2026-10-22", false),
    today: { ...choice("2026-10-21"), easier: true, minutes: 30 },
    days: [choice("2026-10-22", false), choice("2026-10-23"), choice("2026-10-24")],
    best: choice("2026-10-23"),
    skip: { kind: "skip", session: "2026-10-21#0" },
  };
  const parsed = parseSeason({
    state: { goals: [], prefs: {}, edits: [] },
    plan: null,
    missed: raw,
    today: [],
    goals: [],
    feasibility: [],
  });

  it("parses and offers the quick day, the days, shorter today and skip", () => {
    const m = parsed!.missed as MissedView;
    expect(m.title).toContain("Postpone");
    const a = missedActions(m);
    expect(a.quick?.label).toBe("Friday 23");
    expect(a.days.map((d) => d.ok)).toEqual([false, true, true]);
    expect(a.days[0]!.whyText).toBe("Race day");
    expect(a.today?.minutes).toBe(30);
    expect(a.skip).toEqual({ kind: "skip", session: "2026-10-21#0" });
    expect(choiceLine(a.quick)).toBe("moved to 2026-10-23");
  });

  it("falls back to tomorrow, and offers rest only when unwell", () => {
    const m = parsed!.missed as MissedView;
    expect(missedActions({ ...m, quick: null, tomorrow: m.best }).quick?.to).toBe("2026-10-23");
    const sick = missedActions({ ...m, unwell: true });
    expect(sick.quick).toBeNull();
    expect(sick.days).toEqual([]);
    expect(sick.today).toBeNull();
    expect(sick.skip).not.toBeNull();
  });

  it("Not now keeps the card closed for that session today only", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(isDismissed(store, "2026-10-22", "2026-10-21#0")).toBe(false);
    dismiss(store, "2026-10-22", "2026-10-21#0");
    expect(isDismissed(store, "2026-10-22", "2026-10-21#0")).toBe(true);
    expect(isDismissed(store, "2026-10-22", "2026-10-20#0")).toBe(false);
    expect(isDismissed(store, "2026-10-23", "2026-10-21#0")).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isDismissed(broken, "2026-10-22", "x")).toBe(false);
    expect(() => dismiss(broken, "2026-10-22", "x")).not.toThrow();
    expect(isDismissed(null, "2026-10-22", "x")).toBe(false);
  });
});

describe("the answer without a season (basic week) and the notes", () => {
  it("parses the plain week, the new session fields and the warnings; an older answer still parses", () => {
    const a = parseSeason({
      state: { goals: [], prefs: {}, edits: [] },
      plan: null,
      week: {
        basic: true,
        start: "2026-10-19",
        targetMin: 150,
        sessions: [
          {
            ...session(),
            locked: true,
            slot: "09:00",
            rpe: 4,
            distanceKm: 25,
            memo: "flat",
            edited: "postpone",
            from: "2026-10-21",
            summary: "Bike · 60 min",
          },
        ],
        warnings: [
          {
            kind: "hard-streak",
            dates: ["2026-10-22"],
            text: "3 hard days in a row: want me to rebalance?",
            rebalance: [{ kind: "change", session: "x", zone: 2 }],
            lines: [],
          },
          { text: 42 },
        ],
      },
      today: [],
      goals: [],
      feasibility: [],
    });
    expect(a?.week?.basic).toBe(true);
    expect(a?.week?.index).toBe(0);
    const x = a!.week!.sessions[0]!;
    expect([x.locked, x.slot, x.rpe, x.distanceKm, x.memo, x.edited, x.from, x.summary]).toEqual([
      true,
      "09:00",
      4,
      25,
      "flat",
      "postpone",
      "2026-10-21",
      "Bike · 60 min",
    ]);
    expect(a!.week!.warnings).toHaveLength(1);
    expect(a!.week!.warnings[0]!.rebalance[0]).toEqual({ kind: "change", session: "x", zone: 2 });

    const old = parseSeason({ state: { goals: [], prefs: {}, edits: [] }, plan: null, today: [], goals: [], feasibility: [] });
    expect(old?.missed ?? null).toBeNull();
    expect(old?.week ?? null).toBeNull();
  });
});
