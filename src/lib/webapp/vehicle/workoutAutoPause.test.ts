import { describe, expect, it } from "vitest";
import { addFix } from "../geo";
import { heartProfileOf } from "../heart";
import { buildSession, elapsedS, newWorkout, pause, resume, tick, type WorkoutSnapshot } from "../workout";
import type { AutoPauseMode } from "./autoPause";
import {
  acceptAutoCard,
  autoPauseModeFor,
  autoPauseStep,
  dismissAutoCard,
  nextAutoPause,
  parseAutoPausePrefs,
  pausedByOf,
} from "./workoutAutoPause";
import { distanceCapKmh, inVehicle, speedReading, vehicleStep, type SpeedFix } from "./workoutVehicle";

const T0 = Date.UTC(2026, 9, 30, 8, 0, 0);
const fresh = (sport = "run") => newWorkout({ id: "11111111-2222-4333-8444-555555555555", userId: "u1", sport, now: T0, energy: 4 });
const north = (m: number) => ({ lat: 45.5 + m / 111_195, lon: -73.56 });

interface Leg {
  s: number;
  speed: number;
}
/**
 * A browser workout, one fix a second (the device's own speed on each, as phones' browsers give it), each fix through
 * geo.ts, the vehicle guard and auto-pause, as WorkoutContext runs them. Returns the workout, the actions in order
 * (`kind@second`) and where it got to.
 */
function go(w: WorkoutSnapshot, legs: Leg[], mode: AutoPauseMode, o: { from?: number; m?: number; buf?: SpeedFix[] } = {}) {
  let s = o.from ?? 0;
  let m = o.m ?? 0;
  let buf = o.buf ?? [];
  const actions: string[] = [];
  for (const leg of legs)
    for (let k = 0; k < leg.s; k++) {
      s++;
      const at = T0 + s * 1000;
      m += leg.speed;
      const f = { ...north(m), acc: 5, at, speed: leg.speed };
      w = tick(w, at);
      w = {
        ...w,
        track: addFix(w.track, f, { t: elapsedS(w, at), now: at, capKmh: distanceCapKmh(w.sport, 25), paused: w.pausedAt > 0 }).state,
      };
      const r = speedReading(buf, f);
      buf = r.buffer;
      w = vehicleStep(w, { now: at, speedMs: r.speedMs }).w;
      const x = autoPauseStep(w, { now: at, speedMs: r.speedMs, mode, fixes: buf });
      w = x.w;
      if (x.action) actions.push(`${x.action.kind}@${s}`);
    }
  return { w, actions, s, m, buf };
}

const run = (s: number): Leg => ({ s, speed: 3 });
const walk = (s: number): Leg => ({ s, speed: 1.3 });
const stop = (s: number): Leg => ({ s, speed: 0 });

describe("auto-pause in a browser workout", () => {
  it("run, Automatic: a 40 s stop pauses from where it began and moving again resumes from where you moved", () => {
    const r = go(fresh(), [run(120), stop(40), run(60)], "auto");
    expect(r.actions).toEqual(["pause@131", "resume@164"]);
    // The stop is not moving time (back-dated pause at 121 s), the 3 s before the resume count (back-dated to 161 s, resumed at 164 s).
    const moving = elapsedS(r.w, T0 + 220_000);
    expect(moving).toBe(120 + 60);
    // The distance: every moving metre (the metres walked since the resume's start count too).
    const off = go(fresh(), [run(120), stop(40), run(60)], "off");
    expect(off.actions).toEqual([]);
    expect(r.w.track.metres).toBeGreaterThan(off.w.track.metres - 6);
    expect(r.w.track.metres).toBeLessThan(540 + 6);
    expect(r.w.pausedAt).toBe(0);
    expect(r.w.autoPaused).toBe(false);
    // Samples are on moving time: none during the stop.
    const s = buildSession(
      { ...pause(r.w, T0 + 220_000), endedAt: T0 + 220_000 },
      {
        now: T0 + 220_000,
        deviceKey: "k",
        heart: heartProfileOf(null),
        gps: true,
      },
    );
    expect(s.activeS).toBe(180);
    expect(s.samples.at(-1)!.t).toBeLessThanOrEqual(180);
  });

  it("traffic lights: a stop shorter than the sport's threshold never pauses", () => {
    const r = go(fresh(), [run(60), stop(6), run(60), stop(8), run(60), stop(5), run(30)], "auto");
    expect(r.actions).toEqual([]);
    expect(elapsedS(r.w, T0 + r.s * 1000)).toBe(r.s);
  });

  it("stop and go at lights several times: each real stop pauses once and resumes once", () => {
    const r = go(fresh(), [run(60), stop(20), run(60), stop(20), run(60)], "auto");
    expect(r.actions.map((a) => a.split("@")[0])).toEqual(["pause", "resume", "pause", "resume"]);
    expect(elapsedS(r.w, T0 + r.s * 1000)).toBe(180);
  });

  it("walk, Suggest: Stopped? Pause, accepted pauses from where the stop began; it never resumes by itself", () => {
    let r = go(fresh("walk"), [walk(60), stop(25)], "suggest");
    expect(r.actions).toEqual(["suggest_pause@81"]);
    expect(r.w.autoCard).toEqual({ kind: "pause", fromMs: T0 + 61_000 });
    expect(r.w.pausedAt).toBe(0);
    let w = acceptAutoCard(r.w, T0 + 85_000);
    expect(w.pausedAt).toBe(T0 + 61_000);
    expect(pausedByOf(w)).toBe("user");
    expect(w.autoCard).toBeNull();
    r = go(w, [stop(10), walk(30)], "suggest", { from: r.s, m: r.m, buf: r.buf });
    // Moving again: only the offer, the pause stays yours.
    expect(r.actions).toEqual(["suggest_resume@100"]);
    expect(r.w.pausedAt).toBe(T0 + 61_000);
    expect(r.w.autoCard).toEqual({ kind: "resume" });
    w = acceptAutoCard(r.w, T0 + 125_000);
    expect(w.pausedAt).toBe(0);
    // Moving time: the walk up to the first still reading (61 s), nothing of the stop or the wait.
    expect(elapsedS(w, T0 + 125_000)).toBe(61);
  });

  it("walk, Suggest: walking on withdraws the card; one suggestion per 2 minutes", () => {
    const r = go(fresh("walk"), [walk(60), stop(25), walk(10), stop(25), walk(10)], "suggest");
    expect(r.actions).toEqual(["suggest_pause@81", "withdraw@86"]);
    expect(r.w.autoCard).toBeNull();
    expect(r.w.pausedAt).toBe(0);
  });

  it("the card's ×: hidden, nothing paused", () => {
    const r = go(fresh("walk"), [walk(60), stop(25)], "suggest");
    const w = dismissAutoCard(r.w);
    expect(w.autoCard).toBeNull();
    expect(w.autoPause?.showing).toBeNull();
    expect(w.pausedAt).toBe(0);
  });

  it("Automatic: a pause of yours is never resumed by itself", () => {
    let r = go(fresh(), [run(60)], "auto");
    const w = pause(r.w, T0 + 60_000);
    r = go(w, [run(60)], "auto", { from: r.s, m: r.m, buf: r.buf });
    expect(r.actions).toEqual(["suggest_resume@64"]);
    expect(r.w.pausedAt).toBe(T0 + 60_000);
    expect(pausedByOf(r.w)).toBe("user");
  });

  it("a vehicle stretch is the vehicle guard's: no auto-pause, no card", () => {
    const r = go(fresh("walk"), [walk(300), { s: 600, speed: 14 }, stop(60)], "auto");
    expect(inVehicle(r.w)).toBe(true);
    expect(r.actions).toEqual([]);
    expect(r.w.autoPaused).toBeFalsy();
    expect(pausedByOf(r.w)).toBe("vehicle");
  });

  it("Off, and sports that never auto-pause (indoor, yoga)", () => {
    expect(go(fresh(), [run(30), stop(60), run(30)], "off").actions).toEqual([]);
    expect(go(fresh("yoga"), [stop(60)], "auto").actions).toEqual([]);
    expect(autoPauseModeFor("yoga", null)).toBe("off");
    expect(autoPauseModeFor("run", null)).toBe("auto");
    expect(autoPauseModeFor("walk", null)).toBe("suggest");
  });

  it("a ride uses speed only and pauses at its own threshold", () => {
    const r = go(fresh("ride"), [{ s: 60, speed: 7 }, stop(12), { s: 30, speed: 7 }], "auto");
    expect(r.actions).toEqual(["pause@69", "resume@76"]);
  });

  it("an auto-pause resumed with the button: running again, not auto-paused", () => {
    const r = go(fresh(), [run(60), stop(20)], "auto");
    expect(pausedByOf(r.w)).toBe("auto");
    const w = { ...resume(r.w, T0 + 81_000), autoPaused: false };
    expect(pausedByOf(w)).toBeNull();
  });
});

describe("prefs.autoPause", () => {
  it("reads only valid modes; a bad value reads as none", () => {
    expect(parseAutoPausePrefs({ bySport: { run: "off", walk: "nope" }, at: "2026-10-30T10:00:00.000Z" })).toEqual({
      bySport: { run: "off" },
      at: "2026-10-30T10:00:00.000Z",
    });
    expect(parseAutoPausePrefs({ bySport: {} })).toBeNull();
    expect(parseAutoPausePrefs("x")).toBeNull();
  });

  it("a new choice keeps the other sports and is stamped after the account's, so it wins", () => {
    const later = "2030-01-01T00:00:00.000Z";
    expect(nextAutoPause({ bySport: { walk: "auto" }, at: later }, "run", "off", Date.parse("2026-10-30T10:00:00Z"))).toEqual({
      bySport: { walk: "auto", run: "off" },
      at: "2030-01-01T00:00:00.001Z",
    });
    expect(nextAutoPause(undefined, "hike", "auto", Date.parse("2026-10-30T10:00:00Z"))).toEqual({
      bySport: { hike: "auto" },
      at: "2026-10-30T10:00:00.000Z",
    });
  });
});
