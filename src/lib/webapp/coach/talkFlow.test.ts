import { describe, expect, it } from "vitest";
import { cleanCoachAction } from "./coachActions";
import {
  cardAnswer,
  cardIdOf,
  hikeMinutes,
  outingPlaces,
  placesForCoach,
  placesSportOf,
  pttNext,
  runsOnArrival,
  webTalkMode,
} from "./talkFlow";
import { correctionsOf, memoryGroups, memoryItemsOf, talkStatusOf } from "./talkApi";

const base = { tier: "plus" as const, liveOn: true, online: true, canHear: true, canListen: true };

describe("which way the talk opens (ADR-0068, web)", () => {
  it("Plus / Premium with the server on and minutes left: live", () => {
    expect(webTalkMode(base)).toEqual({ mode: "live" });
    expect(webTalkMode({ ...base, tier: "premium", leftS: 300 })).toEqual({ mode: "live" });
  });
  it("Free, live off, minutes used, offline: push-to-talk with the reason", () => {
    expect(webTalkMode({ ...base, tier: "free" })).toEqual({ mode: "ptt", why: "free" });
    expect(webTalkMode({ ...base, liveOn: false })).toEqual({ mode: "ptt", why: "off" });
    expect(webTalkMode({ ...base, leftS: 10 })).toEqual({ mode: "ptt", why: "no_minutes" });
    expect(webTalkMode({ ...base, online: false })).toEqual({ mode: "ptt", why: "offline" });
    expect(webTalkMode({ ...base, forcePtt: true })).toEqual({ mode: "ptt", why: "off" });
  });
  it("what the browser can do: no mic stream → push-to-talk; no speech recognition → text", () => {
    expect(webTalkMode({ ...base, canHear: false })).toEqual({ mode: "ptt", why: "no_mic" });
    expect(webTalkMode({ ...base, tier: "free", canListen: false })).toEqual({ mode: "text", why: "no_mic", noSpeech: true });
    expect(webTalkMode({ ...base, canHear: false, canListen: false })).toEqual({ mode: "text", why: "no_mic" });
    expect(webTalkMode({ ...base, micDenied: true })).toEqual({ mode: "text", why: "no_mic" });
    expect(webTalkMode({ ...base, prefersText: true })).toEqual({ mode: "text", why: "typing" });
  });
});

describe("push-to-talk loop", () => {
  it("tap, the end of speech sends, the reply speaks, then idle", () => {
    expect(pttNext("idle", { type: "tap" })).toEqual({ phase: "listening", listen: true });
    expect(pttNext("listening", { type: "heard", text: " how was my week " })).toEqual({ phase: "thinking", send: "how was my week" });
    expect(pttNext("thinking", { type: "reply", spoken: true })).toEqual({ phase: "speaking" });
    expect(pttNext("speaking", { type: "spoken" })).toEqual({ phase: "idle" });
    expect(pttNext("thinking", { type: "reply", spoken: false })).toEqual({ phase: "idle" });
  });
  it("tap while it speaks stops it and listens; tap while listening stops; silence goes idle", () => {
    expect(pttNext("speaking", { type: "tap" })).toEqual({ phase: "listening", listen: true, stopVoice: true });
    expect(pttNext("listening", { type: "tap" })).toEqual({ phase: "idle", stopListening: true });
    expect(pttNext("listening", { type: "heard", text: "  " })).toEqual({ phase: "idle" });
    expect(pttNext("listening", { type: "silence" })).toEqual({ phase: "idle" });
    expect(pttNext("thinking", { type: "tap" })).toEqual({ phase: "thinking" });
    expect(pttNext("listening", { type: "error" })).toEqual({ phase: "idle", stopListening: true });
  });
});

describe("a said or typed answer to the card on screen (every mode)", () => {
  const card = { pending: true, runnable: true };
  it("yes confirms, no cancels, 'no, rather Thursday' is a change", () => {
    expect(cardAnswer("yes", card)).toEqual({ kind: "confirm" });
    expect(cardAnswer("Oui vas-y", card)).toEqual({ kind: "confirm" });
    expect(cardAnswer("no thanks", card)).toEqual({ kind: "cancel" });
    expect(cardAnswer("no, rather Thursday", card)).toEqual({ kind: "change", rest: "thursday" });
    expect(cardAnswer("non, plutôt jeudi", card)).toEqual({ kind: "change", rest: "jeudi" });
  });
  it("anything else goes to the coach; no card, a done card or one the web can't run: no confirm", () => {
    expect(cardAnswer("how far is it?", card)).toBeNull();
    expect(cardAnswer("yes", null)).toBeNull();
    expect(cardAnswer("yes", { pending: false, runnable: true })).toBeNull();
    expect(cardAnswer("yes", { pending: true, runnable: false })).toBeNull();
    expect(cardAnswer("no", { pending: true, runnable: false })).toEqual({ kind: "cancel" });
  });
  it("pause / resume, summaries and places run on arrival; stop and meals wait for a yes", () => {
    const a = (raw: Record<string, unknown>) => cleanCoachAction(raw, { lang: "en" })!;
    expect(runsOnArrival(a({ type: "control_workout", op: "pause" }))).toBe(true);
    expect(runsOnArrival(a({ type: "control_workout", op: "stop" }))).toBe(false);
    expect(runsOnArrival(a({ type: "show_summary", span: "week" }))).toBe(true);
    expect(runsOnArrival(a({ type: "show_places", sport: "hike", minutes: 240 }))).toBe(true);
    expect(runsOnArrival(a({ type: "log_meal", meal: "lunch" }))).toBe(false);
    expect(runsOnArrival(a({ type: "open_screen", route: "/plan" }))).toBe(false);
    expect(cardIdOf({ id: "c-12" }, "t9")).toBe("c-12");
    expect(cardIdOf({ id: "<bad>" }, "t9")).toBe("t9");
  });
});

describe("places for an outing", () => {
  const at = { lat: 45.5, lon: 6.0 };
  const places = [
    { id: "w1", kind: "hiking_route", name: "Lake loop", lat: 45.51, lon: 6.0, lengthM: 15_800 },
    { id: "w2", kind: "hiking_route", name: "Short loop", lat: 45.501, lon: 6.0, lengthM: 3_000 },
    { id: "w3", kind: "park", name: "Far park", lat: 46.5, lon: 6.0 },
    { id: "w4", kind: "park", name: "", lat: 45.502, lon: 6.0 },
  ];
  it("routes that fit the outing first, then nearest, within the travel limit", () => {
    const r = outingPlaces(places, at, { sport: "hike", minutes: 240 }, "en");
    expect(r.map((p) => p.name)).toEqual(["Lake loop", "Short loop", "Park"]);
    expect(r[0]).toMatchObject({ awayKm: 1.1, loopKm: 15.8, minutes: 237 });
    expect(placesForCoach(r)[0]).toEqual({ name: "Lake loop", awayKm: 1.1, loopKm: 15.8, minutes: 237 });
  });
  it("hike pacing and the search sport", () => {
    expect(hikeMinutes(8, 600)).toBe(180);
    expect(placesSportOf(undefined)).toBe("hike");
    expect(placesSportOf("run")).toBe("run");
    expect(placesSportOf("chess")).toBe("hike");
  });
});

describe("the super coach's API answers, leniently", () => {
  it("talk status: an older API without `talk` is push-to-talk", () => {
    expect(talkStatusOf({ talk: { live: true, leftS: 412.4 } })).toEqual({ live: true, leftS: 412 });
    expect(talkStatusOf({ talk: { live: false, why: "free" } })).toEqual({ live: false, why: "free" });
    expect(talkStatusOf({ remainingS: 300 })).toEqual({ live: false, why: "off" });
    expect(talkStatusOf(null)).toEqual({ live: false, why: "off" });
  });
  it("memory: v1 lines read as preferences; grouped in game-core's order", () => {
    const items = memoryItemsOf([
      { id: "a", text: "Prefers morning runs", source: "said", createdAt: "2026-10-01" },
      { id: "b", text: "Left knee sore", kind: "injury", on: "2026-10-28", active: true, source: "extracted", createdAt: "2026-10-28" },
      { id: "c", text: "Straight talk", kind: "style", source: "edited", createdAt: "2026-10-02" },
      null,
    ]);
    expect(items[0]).toMatchObject({ kind: "preference", source: "said" });
    expect(memoryGroups(items).map((g) => g.kind)).toEqual(["style", "injury", "preference"]);
  });
  it("corrections: newest day first, unknown metrics left out", () => {
    const c = correctionsOf({
      corrections: [
        { metric: "sleep_h", day: "2026-10-29", value: 8, shown: 6, at: "x", source: "voice" },
        { metric: "mood", day: "2026-10-30", value: 1 },
        { metric: "steps", day: "2026-10-30", value: 9000, source: "tap" },
      ],
    });
    expect(c.map((x) => x.metric)).toEqual(["steps", "sleep_h"]);
    expect(c[1]).toMatchObject({ shown: 6, source: "voice" });
  });
});
