// Copied from VVFit packages/game-core/test/coachActions.test.ts (bcd38837 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import {
  actionLines,
  claimsDone,
  cleanCoachAction,
  COACH_ACTION_KINDS,
  coachActionResult,
  gateCoachAction,
  honestReply,
  legacyAction,
  offerLine,
  spokenConfirm,
  yesNo,
} from "./coachActions";

const en = { lang: "en" as const };
const fr = { lang: "fr" as const };

describe("cleanCoachAction", () => {
  it("fills today's planned session", () => {
    const a = cleanCoachAction(
      { type: "start_workout", planned: true },
      { ...en, today: { sport: "run", minutes: 30, intensity: "easy" } },
    );
    expect(a).toMatchObject({ type: "start_workout", planned: true, sport: "run", minutes: 30, intensity: "easy" });
    expect(a!.card).toEqual({ title: "Start Run", detail: "30 min · easy", confirm: "Start", cancel: "Not now" });
  });
  it("a start with no sport is the planned one when there is one", () => {
    expect(cleanCoachAction({ type: "start_workout" }, { ...en, today: { sport: "ride", minutes: 45 } })).toMatchObject({
      planned: true,
      sport: "ride",
      minutes: 45,
    });
    expect(cleanCoachAction({ type: "start_workout" }, { ...en, today: { rest: true } })).toMatchObject({
      type: "start_workout",
      card: { title: "Start today's session" },
    });
  });
  it("a different sport than planned is a new session", () => {
    const a = cleanCoachAction(
      { type: "start_workout", planned: true, sport: "walk", minutes: 20 },
      { ...en, today: { sport: "run", minutes: 30 } },
    );
    expect(a).toMatchObject({ sport: "walk", minutes: 20 });
    expect(a!.planned).toBeUndefined();
  });
  it("bounds everything and drops unknown values", () => {
    const a = cleanCoachAction({ type: "start_workout", sport: "quidditch", minutes: 999, zone: 5, distanceKm: 5 }, en);
    expect(a).toMatchObject({ type: "start_workout", distanceKm: 5 });
    expect(a!.sport).toBeUndefined();
    expect(a!.minutes).toBeUndefined();
    expect(a!.zone).toBeUndefined();
    expect(cleanCoachAction({ type: "launch_rocket" }, en)).toBeNull();
    expect(cleanCoachAction({ type: "open_screen", route: "/admin" }, en)).toBeNull();
    expect(cleanCoachAction({ type: "set_reminder", at: "25:00" }, en)).toBeNull();
    expect(cleanCoachAction({ type: "log_habit" }, en)).toBeNull();
    expect(cleanCoachAction({ type: "add_to_calendar", date: "2026-10-30" }, en)).toBeNull();
  });
  it("camera: a routine or the last pick; none when Camera & trainings is off", () => {
    expect(cleanCoachAction({ type: "start_camera_workout", routine: "core-10" }, en)).toMatchObject({ routine: "core-10" });
    expect(cleanCoachAction({ type: "start_camera_workout", routine: "nope" }, en)).toMatchObject({ routine: "last" });
    expect(cleanCoachAction({ type: "start_camera_workout" }, { ...en, cameraOn: false })).toBeNull();
  });
  it("pause: sick 2 days by default, at most 14", () => {
    expect(cleanCoachAction({ type: "pause_streak" }, fr)).toMatchObject({
      pauseKind: "sick",
      days: 2,
      card: { confirm: "Mettre en pause", cancel: "Pas maintenant" },
    });
    expect(cleanCoachAction({ type: "pause_streak", pauseKind: "injured", days: 30 }, en)).toMatchObject({ pauseKind: "injured", days: 3 });
  });
  it("French cards", () => {
    expect(cleanCoachAction({ type: "start_workout", sport: "run", minutes: 30, intensity: "easy" }, fr)!.card).toEqual({
      title: "Démarrer : Course",
      detail: "30 min · facile",
      confirm: "Démarrer",
      cancel: "Pas maintenant",
    });
  });
  it("every kind cleans and has its lines in both languages", () => {
    const raw: Record<string, object> = {
      start_workout: { sport: "run" },
      start_camera_workout: {},
      start_daily_move: {},
      log_habit: { habit: "water" },
      set_reminder: { at: "18:30", what: "stretch" },
      add_to_calendar: { date: "2026-10-30", at: "07:00", sport: "run", minutes: 30 },
      pause_streak: {},
      open_screen: { route: "/habits" },
      log_meal: { meal: "lunch" },
      correct_data: { metric: "sleep_h", value: 8, shown: 6 },
      control_workout: { op: "pause" },
      music: { op: "next" },
      show_places: { sport: "hike", minutes: 120 },
      show_summary: { span: "week", summary: { title: "Your week", lines: ["3 runs"] } },
      review_meal: { mealId: "m_1", note: "Nice protein" },
      suggest_meals: { meal: "dinner", count: 3 },
      plan_meals: { weekStart: "2026-11-02" },
      update_nutrition: { nutrition: { dislikes: ["cinnamon"] } },
    };
    for (const kind of COACH_ACTION_KINDS) {
      for (const ctx of [
        { ...en, nutritionOn: true },
        { ...fr, nutritionOn: true },
      ]) {
        const a = cleanCoachAction({ type: kind, ...raw[kind] }, ctx);
        expect(a, kind).not.toBeNull();
        expect(a!.card.title.length).toBeGreaterThan(2);
        const lines = actionLines(a!, ctx.lang);
        for (const v of Object.values(lines)) expect(typeof v).toBe("string");
        expect(lines.cancelled.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("gate", () => {
  it("nothing starts during a workout; open_screen is just a button", () => {
    expect(gateCoachAction({ type: "start_workout" }, { device: "phone", inWorkout: true })).toEqual({ ok: false, reason: "in_workout" });
    expect(gateCoachAction({ type: "start_workout" }, { device: "phone", inWorkout: false })).toEqual({ ok: true });
  });
  it("watches hand the camera workout to the phone; camera off says why", () => {
    expect(gateCoachAction({ type: "start_camera_workout" }, { device: "watch", inWorkout: false })).toEqual({ ok: true, handoff: true });
    expect(gateCoachAction({ type: "start_camera_workout" }, { device: "phone", inWorkout: false, cameraOn: false })).toEqual({
      ok: false,
      reason: "camera_off",
    });
    expect(gateCoachAction({ type: "start_workout" }, { device: "watch", inWorkout: false })).toEqual({ ok: true });
  });
});

describe("honesty", () => {
  it("spots claims, not offers or questions", () => {
    for (const s of [
      "I've started your run. Enjoy!",
      "I started the workout for you.",
      "Done! Your reminder is set for 6.",
      "Your run is started, go easy.",
      "Okay, it's started.",
      "Starting your 30-minute run now.",
      "J'ai lancé ta séance, bon courage !",
      "C'est lancé ! Profite.",
      "Ta séance est lancée.",
      "Je t'ai ajouté la séance à ton agenda.",
      "Your streak is paused for two days.",
    ])
      expect(claimsDone(s), s).toBe(true);
    for (const s of [
      "Want me to start a 30-minute easy run?",
      "Ready when you are: tap Start.",
      "Thirty minutes easy, zone 2, conversational.",
      "Tu veux que je lance une course facile de 30 minutes ?",
      "Today's session is an easy 30-minute run.",
      "Your streak is safe: rest days never break it.",
      "C'est parti pour une bonne semaine, on garde le rythme facile.",
    ])
      expect(claimsDone(s), s).toBe(false);
  });
  it("a claim with an action becomes the offer; with no action, the honest line", () => {
    const a = cleanCoachAction({ type: "start_workout", sport: "run", minutes: 30, intensity: "easy" }, en)!;
    expect(honestReply("I've started your run!", a, "en")).toEqual({
      reply: "Ready when you are: Start Run, 30 min · easy. Tap Start to begin.",
      rewritten: true,
    });
    expect(honestReply("I've started your run!", null, "en").reply).toMatch(/can't start that myself/);
    expect(honestReply("J'ai lancé ta séance.", null, "fr").reply).toMatch(/Je ne peux rien lancer/);
    expect(honestReply("Want me to start it?", a, "en")).toEqual({ reply: "Want me to start it?", rewritten: false });
  });
  it("the offer line never claims", () => {
    for (const kind of COACH_ACTION_KINDS) {
      for (const lang of ["en", "fr"] as const) {
        const a = cleanCoachAction(
          {
            type: kind,
            sport: "run",
            habit: "water",
            at: "18:30",
            date: "2026-10-30",
            route: "/habits",
            metric: "sleep_h",
            value: 8,
            op: "pause",
            nutrition: { allergies: ["peanuts"] },
          },
          { lang, nutritionOn: true },
        )!;
        expect(claimsDone(offerLine(a, lang)), `${kind} ${lang}: ${offerLine(a, lang)}`).toBe(false);
      }
    }
  });
  it("the result line is the only done line", () => {
    const a = cleanCoachAction({ type: "start_workout", sport: "run" }, en)!;
    expect(coachActionResult(a, { ok: true, on: "watch" }, "en")).toBe("Run started on your watch. Easy for the first few minutes.");
    expect(coachActionResult(a, { ok: false, reason: "watch_unreachable" }, "en")).toMatch(/nothing started/);
    expect(coachActionResult(a, { ok: false, reason: "cancelled" }, "fr")).toBe("Pas de souci, rien n’a été lancé.");
  });
});

describe("confirming", () => {
  it("a short yes or no", () => {
    expect(yesNo("Yes!")).toBe("yes");
    expect(yesNo("oui vas-y")).toBe(null);
    expect(yesNo("vas-y")).toBe("yes");
    expect(yesNo("Not now, thanks")).toBe("no");
    expect(yesNo("yes but tell me first how long")).toBe(null);
  });
  it("a spoken yes confirms only in a live call with the card on screen", () => {
    expect(spokenConfirm({ liveCall: true, cardOnScreen: true, text: "yes" })).toBe("confirm");
    expect(spokenConfirm({ liveCall: false, cardOnScreen: true, text: "yes" })).toBe(null);
    expect(spokenConfirm({ liveCall: true, cardOnScreen: false, text: "yes" })).toBe(null);
    expect(spokenConfirm({ liveCall: false, cardOnScreen: true, text: "non" })).toBe("cancel");
  });
});

describe("older apps", () => {
  it("get what they know", () => {
    const w = cleanCoachAction({ type: "start_workout", sport: "run", minutes: 30 }, en)!;
    expect(legacyAction(w, "en")).toEqual({ action: { type: "start_workout", sport: "run", minutes: 30 } });
    expect(legacyAction(cleanCoachAction({ type: "start_camera_workout" }, en)!, "en").action).toEqual({
      type: "open_screen",
      route: "/camera-workout",
      label: "Camera workout",
    });
    const r = legacyAction(cleanCoachAction({ type: "set_reminder", at: "18:00" }, fr)!, "fr");
    expect(r.action).toEqual({ type: "none" });
    expect(r.note).toMatch(/mets VVake à jour/);
  });
});
