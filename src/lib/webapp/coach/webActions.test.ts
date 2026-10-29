import { describe, expect, it } from "vitest";
import { claimsDone, cleanCoachAction } from "./coachActions";
import {
  actionIcs,
  cameraRoutineOf,
  cardActionOf,
  localCardFor,
  pauseUntil,
  resultLine,
  webCardPlan,
  webHabitOf,
  workoutSport,
} from "./webActions";

const today = { sport: "run", minutes: 30 };
const off = { inWorkout: false, cameraOn: true };

describe("cardActionOf: the reply's action as a card", () => {
  it("keeps the server's card and lines, checks the fields again, keeps planned", () => {
    const a = cardActionOf(
      {
        type: "start_workout",
        planned: true,
        minutes: 999,
        card: { title: "Démarrer la séance du jour", confirm: "Démarrer", cancel: "Pas maintenant" },
        lines: { done: "C’est lancé.", bogus: "x", failed: 3 },
      },
      "fr",
    )!;
    expect(a.type).toBe("start_workout");
    expect(a.planned).toBe(true);
    expect(a.minutes).toBeUndefined();
    expect(a.card.title).toBe("Démarrer la séance du jour");
    expect(a.lines?.done).toBe("C’est lancé.");
    expect(a.lines?.failed).toMatch(/rien n’a changé/);
    expect((a.lines as Record<string, string>).bogus).toBeUndefined();
  });

  it("writes the card itself when the server sent none, and drops what isn't a card", () => {
    expect(cardActionOf({ type: "start_workout", sport: "ride", minutes: 40 }, "en")?.card).toEqual({
      title: "Start Ride",
      detail: "40 min",
      confirm: "Start",
      cancel: "Not now",
    });
    expect(cardActionOf({ type: "open_screen", route: "/plan" }, "en")).toBeNull();
    expect(cardActionOf({ type: "propose_plan" }, "en")).toBeNull();
    expect(cardActionOf({ type: "set_reminder" }, "en")).toBeNull();
    expect(cardActionOf(null, "en")).toBeNull();
  });
});

describe("webCardPlan: what the web offers now", () => {
  const card = (raw: Record<string, unknown>) => cleanCoachAction(raw, { lang: "en" })!;

  it("runs GPS, camera, calendar and pause; nothing during a workout", () => {
    for (const raw of [
      { type: "start_workout", sport: "run" },
      { type: "start_camera_workout" },
      { type: "add_to_calendar", date: "2026-11-02", at: "07:00" },
      { type: "pause_streak", pauseKind: "sick", days: 2 },
    ]) {
      expect(webCardPlan(card(raw), off), raw.type).toEqual({ kind: "run" });
      expect(webCardPlan(card(raw), { inWorkout: true, cameraOn: true }), raw.type).toEqual({ kind: "line", reason: "in_workout" });
    }
  });

  it("says the phone does the daily move, reminders and habits the web doesn't keep", () => {
    expect(webCardPlan(card({ type: "start_daily_move" }), off)).toEqual({ kind: "line", reason: "not_here" });
    expect(webCardPlan(card({ type: "set_reminder", at: "18:00", what: "stretch" }), off)).toEqual({ kind: "line", reason: "not_here" });
    expect(webCardPlan(card({ type: "log_habit", habit: "meditate" }), off)).toEqual({ kind: "line", reason: "not_here" });
    expect(webCardPlan(card({ type: "log_habit", habit: "Water" }), off)).toEqual({ kind: "run" });
  });

  it("camera off: the camera_off line and the button to turn it on", () => {
    expect(webCardPlan(card({ type: "start_camera_workout" }), { inWorkout: false, cameraOn: false })).toEqual({
      kind: "line",
      reason: "camera_off",
      turnOnCamera: true,
    });
  });
});

describe("the web's helpers", () => {
  it("matches the web's habits in both languages", () => {
    expect(webHabitOf("water")).toBe("water");
    expect(webHabitOf("Boire de l’eau")).toBe("water");
    expect(webHabitOf("repas")).toBe("meal");
    expect(webHabitOf("bedtime")).toBe("bed");
    expect(webHabitOf("meditate")).toBeNull();
    expect(webHabitOf(undefined)).toBeNull();
  });

  it("starts the sport given, else today's plan, else says nothing is planned", () => {
    expect(workoutSport({ sport: "ride" }, today)).toEqual({ sport: "ride" });
    expect(workoutSport({ planned: true }, today)).toEqual({ sport: "run" });
    expect(workoutSport({ planned: true }, { rest: true })).toEqual({ fail: "no_plan_today" });
    expect(workoutSport({ planned: true }, undefined)).toEqual({ fail: "no_plan_today" });
  });

  it("opens the camera on the routine given, else the last pick", () => {
    expect(cameraRoutineOf({ routine: "core-10" })).toBe("core-10");
    expect(cameraRoutineOf({ routine: "last" })).toBeUndefined();
    expect(cameraRoutineOf({})).toBeUndefined();
  });

  it("pauses from today, the last day included", () => {
    expect(pauseUntil("2026-10-29", 1)).toBe("2026-10-29");
    expect(pauseUntil("2026-10-29", 3)).toBe("2026-10-31");
    expect(pauseUntil("2026-12-30", 3)).toBe("2027-01-01");
  });

  it("says the server's line when it sent one, game-core's otherwise", () => {
    const a = cleanCoachAction({ type: "start_workout", sport: "run" }, { lang: "en" })!;
    expect(resultLine({ ...a, lines: { done: "Off you go." } }, { ok: true }, "en")).toBe("Off you go.");
    expect(resultLine({ ...a, lines: {} }, { ok: true }, "en")).toBe("Run started. Easy for the first few minutes.");
    expect(resultLine({ ...a, lines: {} }, { ok: false, reason: "cancelled" }, "fr")).toBe("Pas de souci, rien n’a été lancé.");
    expect(resultLine(a, { ok: false, reason: "offline" }, "en")).toMatch(/offline/);
  });
});

describe("actionIcs: add to calendar", () => {
  const now = new Date(2026, 9, 29, 12, 0).getTime();
  it("makes one event at the local time, with an alarm and nothing personal", () => {
    const r = actionIcs({ date: "2026-10-30", at: "07:30", sport: "run", minutes: 45 }, "en", now, "abc");
    if (!("ics" in r)) throw new Error("no file");
    expect(r.file).toBe("vvake-run-2026-10-30.ics");
    const start = new Date(2026, 9, 30, 7, 30).getTime();
    const utc = (ms: number) =>
      new Date(ms)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    expect(r.ics).toContain(`DTSTART:${utc(start)}`);
    expect(r.ics).toContain(`DTEND:${utc(start + 45 * 60_000)}`);
    expect(r.ics).toContain("SUMMARY:Run · VVake");
    expect(r.ics).toContain("TRIGGER:-PT15M");
    expect(r.ics).not.toMatch(/ATTENDEE|ORGANIZER|@(?!vvake\.com)/);
    expect(r.ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("refuses a time already gone", () => {
    expect(actionIcs({ date: "2026-10-29", at: "08:00" }, "en", now, "x")).toEqual({ fail: "past_time" });
  });
});

describe("localCardFor: the web's fallback never claims", () => {
  it("makes a card for a plain start, in both languages", () => {
    const en = localCardFor("Start a 30 min run", "en", today)!;
    expect(en.action).toMatchObject({ type: "start_workout", sport: "run", minutes: 30 });
    const fr = localCardFor("Lance une sortie vélo", "fr")!;
    expect(fr.action.type).toBe("start_workout");
    expect(fr.action.sport).toBeTruthy();
    expect(localCardFor("start today's session", "en", today)?.action).toMatchObject({
      type: "start_workout",
      planned: true,
      sport: "run",
    });
    expect(localCardFor("start a camera workout", "en")?.action).toMatchObject({ type: "start_camera_workout", routine: "last" });
    for (const r of [en, fr]) expect(claimsDone(r.reply), r.reply).toBe(false);
  });
  it("leaves anything else to the 'couldn't reach the coach' line", () => {
    expect(localCardFor("How was my week?", "en", today)).toBeNull();
    expect(localCardFor("I ran 5 km yesterday", "en", today)).toBeNull();
    expect(localCardFor("start today's session", "en", { rest: true })).toBeNull();
  });
});
