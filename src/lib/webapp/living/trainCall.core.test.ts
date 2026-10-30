// Copied from VVFit packages/game-core/test/trainCall.test.ts (3e812ccd 2026-10-30) by scripts/sync-living-core.ts. Do not edit: re-sync.
import { describe, expect, it } from "vitest";
import {
  audioUnavailableText,
  boardElapsed,
  boardView,
  bearingDeg,
  callCountdown,
  callEgressGb,
  callMeterMinutes,
  callOpen,
  checkMeetup,
  checkPin,
  cleanBeat,
  dueCallCoachEvent,
  nearestPublic,
  pinAtPublic,
  pinDirection,
  pinExpired,
  pinProblemText,
  pinSafety,
  snapPin,
  trainCallAudioDecision,
  type BoardRow,
} from "./index";

const NOW = Date.parse("2026-11-02T10:00:00Z");
const row = (o: Partial<BoardRow> & { userId: string }): BoardRow => ({
  name: o.userId,
  state: "running",
  elapsedS: 60,
  atMs: NOW,
  joinedMs: NOW,
  ...o,
});

describe("train together over a call", () => {
  it("a call meetup needs no meeting point; a place meetup still does", () => {
    const base = { sport: "run", startMs: NOW + 3_600_000, durationMin: 45, maxPeople: 4, invitees: ["b"] };
    const call = checkMeetup({ ...base, pointKey: "", mode: "call" }, NOW);
    expect(call).toMatchObject({ ok: true, mode: "call", pointKey: "" });
    expect(checkMeetup({ ...base, pointKey: "" }, NOW)).toEqual({ ok: false, problem: "point" });
    expect(checkMeetup({ ...base, pointKey: "pin" }, NOW)).toMatchObject({ ok: true, mode: "place", pointKey: "pin" });
    expect(checkMeetup({ ...base, pointKey: "n123" }, NOW)).toMatchObject({ ok: true, pointKey: "osm:node/123" });
  });

  it("the board hides people who left, keeps join order and never ranks", () => {
    const rows = [
      row({ userId: "fast", distanceM: 9000, joinedMs: NOW - 1000 }),
      row({ userId: "slow", distanceM: 1000, joinedMs: NOW - 5000 }),
      row({ userId: "gone", state: "left", joinedMs: NOW - 9000 }),
    ];
    const v = boardView(rows, "fast", NOW + 5000);
    expect(v.map((r) => r.userId)).toEqual(["slow", "fast"]);
    expect(v[1]!.me).toBe(true);
    expect(v[0]!.elapsedNowS).toBe(65);
  });

  it("counts on while running, stops counting past the stale window, marks stale rows", () => {
    expect(boardElapsed({ state: "paused", elapsedS: 100, atMs: NOW }, NOW + 30_000)).toBe(100);
    expect(boardElapsed({ state: "running", elapsedS: 100, atMs: NOW }, NOW + 10 * 60_000)).toBe(145);
    expect(boardView([row({ userId: "a" })], "b", NOW + 46_000)[0]!.stale).toBe(true);
  });

  it("opens 15 min before and closes 60 min after the end, only for calls", () => {
    const m = { mode: "call" as const, status: "planned", startMs: NOW, durationMin: 30 };
    expect(callOpen(m, NOW - 16 * 60_000)).toBe(false);
    expect(callOpen(m, NOW - 15 * 60_000)).toBe(true);
    expect(callOpen(m, NOW + 90 * 60_000)).toBe(true);
    expect(callOpen(m, NOW + 91 * 60_000)).toBe(false);
    expect(callOpen({ ...m, mode: "place" }, NOW)).toBe(false);
    expect(callOpen({ ...m, status: "cancelled" }, NOW)).toBe(false);
  });

  it("runs the shared countdown", () => {
    expect(callCountdown(null, NOW)).toEqual({ phase: "none" });
    expect(callCountdown(NOW + 9_500, NOW)).toEqual({ phase: "counting", secondsLeft: 10 });
    expect(callCountdown(NOW + 1, NOW)).toEqual({ phase: "counting", secondsLeft: 1 });
    expect(callCountdown(NOW, NOW + 1000)).toEqual({ phase: "go" });
    expect(callCountdown(NOW, NOW + 3000)).toEqual({ phase: "started" });
  });

  it("cleans beats", () => {
    expect(cleanBeat({ state: "running", elapsedS: 61.7, distanceM: 1234.4, reps: -3, zone: 7 })).toEqual({
      state: "running",
      elapsedS: 61,
      distanceM: 1234,
      reps: null,
      zone: null,
    });
    expect(cleanBeat({ state: "hack", elapsedS: Infinity, zone: 3 })).toEqual({
      state: "waiting",
      elapsedS: 0,
      distanceM: null,
      reps: null,
      zone: 3,
    });
  });

  it("meters at most 30 s a beat", () => {
    expect(callMeterMinutes(null, NOW)).toBe(0);
    expect(callMeterMinutes(NOW - 10_000, NOW)).toBeCloseTo(1 / 6);
    expect(callMeterMinutes(NOW - 600_000, NOW)).toBe(0.5);
  });

  it("decides audio: switch, testers, configuration, global then personal caps", () => {
    const o = {
      switch: "on" as const,
      tester: false,
      configured: true,
      globalUsedMin: 0,
      globalCapMin: 3000,
      userUsedMin: 0,
      userCapMin: 120,
    };
    expect(trainCallAudioDecision(o)).toBe("ok");
    expect(trainCallAudioDecision({ ...o, switch: "off" })).toBe("off");
    expect(trainCallAudioDecision({ ...o, switch: "testers" })).toBe("tester_only");
    expect(trainCallAudioDecision({ ...o, switch: "testers", tester: true })).toBe("ok");
    expect(trainCallAudioDecision({ ...o, configured: false })).toBe("not_configured");
    expect(trainCallAudioDecision({ ...o, globalUsedMin: 3000 })).toBe("global_cap");
    expect(trainCallAudioDecision({ ...o, userUsedMin: 120 })).toBe("user_cap");
    expect(audioUnavailableText("off", "fr")).toContain("tableau");
  });

  it("estimates egress: a 4-person 60-minute call is about 0.22 GB (0.9 MB a participant-minute)", () => {
    expect(callEgressGb(1, 60)).toBe(0);
    expect(callEgressGb(4, 60)).toBeCloseTo(0.216, 3);
  });

  it("says each coach line once, at go, halfway, 5 min left and the end", () => {
    expect(dueCallCoachEvent(null, 30, NOW, [])).toBeNull();
    expect(dueCallCoachEvent(NOW, 30, NOW + 10_000, [])).toBe("go");
    expect(dueCallCoachEvent(NOW, 30, NOW + 10_000, ["go"])).toBeNull();
    expect(dueCallCoachEvent(NOW, 30, NOW + 15 * 60_000, ["go"])).toBe("half");
    expect(dueCallCoachEvent(NOW, 30, NOW + 25 * 60_000, ["go", "half"])).toBe("last_five");
    expect(dueCallCoachEvent(NOW, 30, NOW + 30 * 60_000, ["go", "half", "last_five"])).toBe("done");
  });
});

describe("custom meeting point", () => {
  const park = { id: "n1", name: "Parc Laurier", lat: 45.5, lon: -73.6 };
  it("checks the name, the note and the coordinates", () => {
    expect(checkPin({ name: "  North   gate ", lat: 45.1234567, lon: 5.7 })).toEqual({
      ok: true,
      pin: { name: "North gate", lat: 45.123457, lon: 5.7 },
    });
    expect(checkPin({ name: "", lat: 45, lon: 5 })).toEqual({ ok: false, problem: "pin_name" });
    expect(checkPin({ name: "x".repeat(41), lat: 45, lon: 5 })).toEqual({ ok: false, problem: "pin_name_long" });
    expect(checkPin({ name: "Gate", note: "y".repeat(201), lat: 45, lon: 5 })).toEqual({ ok: false, problem: "pin_note_long" });
    expect(checkPin({ name: "Gate", lat: 0, lon: 0 })).toEqual({ ok: false, problem: "pin_where" });
    expect(checkPin({ name: "Gate", note: "call me at bob@example.com", lat: 45, lon: 5 })).toMatchObject({
      ok: false,
      problem: "contact",
    });
    expect(pinProblemText("pin_name", "fr")).toContain("Porte nord");
  });

  it("finds the nearest public place within 150 m and tells whether the pin is at one", () => {
    const near = { lat: 45.5009, lon: -73.6 }; // ~100 m north
    expect(nearestPublic(near, [park])?.id).toBe("n1");
    expect(nearestPublic({ lat: 45.503, lon: -73.6 }, [park])).toBeNull(); // ~330 m
    expect(pinAtPublic(near, [park])).toBe(false);
    expect(pinAtPublic({ lat: 45.5002, lon: -73.6 }, [park])).toBe(true);
    expect(pinSafety(near, [park])).toMatchObject({ hint: true, snapTo: { id: "n1" } });
    expect(pinSafety({ lat: 45.6, lon: -73.6 }, [park])).toEqual({ hint: true, snapTo: null });
    expect(pinSafety({ lat: 45.5, lon: -73.6 }, [park])).toEqual({ hint: false });
  });

  it("snaps onto the place and keeps the typed name", () => {
    expect(snapPin({ name: "North gate", lat: 45.5009, lon: -73.6 }, park)).toEqual({ name: "North gate", lat: 45.5, lon: -73.6 });
    expect(snapPin({ name: "", lat: 45.5009, lon: -73.6 }, park).name).toBe("Parc Laurier");
  });

  it("expires 7 days after the end", () => {
    expect(pinExpired(NOW, NOW + 7 * 86_400_000 - 1)).toBe(false);
    expect(pinExpired(NOW, NOW + 7 * 86_400_000)).toBe(true);
    expect(pinExpired(NOW, NOW + 86_400_000, 1)).toBe(true);
  });

  it("gives distance and direction like the watches", () => {
    expect(pinDirection({ lat: 45.5, lon: -73.6 }, { lat: 45.5029, lon: -73.6 }, "en").text).toBe("320 m N");
    expect(pinDirection({ lat: 45.5, lon: -73.6 }, { lat: 45.49, lon: -73.615 }, "fr").text).toBe("1,6 km SO");
    expect(Math.round(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }))).toBe(90);
  });
});
