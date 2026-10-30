import { describe, expect, it } from "vitest";
import { addFix } from "../geo";
import { heartProfileOf } from "../heart";
import { buildSession, elapsedS, newWorkout, pause, tick, type WorkoutSnapshot } from "../workout";
import { sourcesLine, vehicleLine } from "./journal";
import { cutFrom, distanceCapKmh, inVehicle, speedReading, vehicleOutcome, vehicleResumeNow, vehicleStep } from "./workoutVehicle";

const T0 = Date.UTC(2026, 9, 30, 8, 0, 0);
const fresh = (sport = "walk") => newWorkout({ id: "11111111-2222-4333-8444-555555555555", userId: "u1", sport, now: T0, energy: 4 });
const north = (m: number) => ({ lat: 45.5 + m / 111_195, lon: -73.56 });

/** A walk: one fix a second at `speed` m/s from `fromS` to `toS`, distance from geo.ts, the guard on each fix. */
function drive(w: WorkoutSnapshot, fromS: number, toS: number, speed: number, startM: number) {
  let buf: { lat: number; lon: number; at: number }[] = [];
  let m = startM;
  const events: string[] = [];
  for (let s = fromS; s <= toS; s++) {
    const at = T0 + s * 1000;
    m += speed;
    const f = { ...north(m), acc: 5, at };
    w = tick(w, at);
    w = {
      ...w,
      track: addFix(w.track, f, { t: elapsedS(w, at), now: at, capKmh: distanceCapKmh(w.sport, 12), paused: w.pausedAt > 0 }).state,
    };
    const r = speedReading(buf, f);
    buf = r.buffer;
    const x = vehicleStep(w, { now: at, speedMs: r.speedMs });
    w = x.w;
    if (x.event) events.push(`${x.event.kind}@${s}`);
  }
  return { w, m, events };
}

describe("vehicle guard in a browser workout", () => {
  it("a walk, a car ride, a walk: paused from where the ride began, resumes by itself on foot, the ride left out", () => {
    let w = fresh();
    let r = drive(w, 1, 300, 1.4, 0); // 5 min walking
    expect(r.events).toEqual([]);
    const walked = r.w.track.metres;
    r = drive(r.w, 301, 900, 14, r.m); // 10 min in a car
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatch(/^entered@33\d$/);
    expect(inVehicle(r.w)).toBe(true);
    // Back-dated: nothing of the ride counted, the clock stopped where it began.
    expect(r.w.track.metres).toBeLessThan(walked + 20);
    expect(elapsedS(r.w, T0 + 900_000)).toBeLessThanOrEqual(306);
    expect(r.w.samples.every((s) => s.t <= 306)).toBe(true);
    r = drive(r.w, 901, 1500, 1.4, r.m); // 10 min walking again
    expect(r.events[0]).toMatch(/^left@9\d\d$/);
    expect(inVehicle(r.w)).toBe(false);
    w = r.w;
    const end = T0 + 1500_000;
    const activeS = elapsedS(w, end);
    expect(activeS).toBeGreaterThan(860);
    expect(activeS).toBeLessThan(920);
    const out = vehicleOutcome(w, activeS, end);
    expect(out.verdict).toBe("ok");
    expect(out.vehicleS).toBeGreaterThan(550);
    const s = buildSession(
      { ...pause(w, end), endedAt: end },
      { now: end, deviceKey: "web-x", heart: heartProfileOf(null), gps: true, vehicle: out },
    );
    expect(s.flags).toEqual([]);
    expect(s.vehicleS).toBe(out.vehicleS);
    expect(s.distanceM).toBeLessThan(1300);
  });

  it("started in a car: mostly vehicle → flag 'vehicle', kept, nothing scored", () => {
    const r = drive(fresh(), 1, 600, 14, 0);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatch(/^entered@/);
    const end = T0 + 600_000;
    const activeS = elapsedS(r.w, end);
    const out = vehicleOutcome(r.w, activeS, end);
    expect(out.verdict).toBe("vehicle");
    const s = buildSession(
      { ...r.w, endedAt: end },
      { now: end, deviceKey: "web-x", heart: heartProfileOf(null), gps: true, vehicle: out },
    );
    expect(s.flags).toEqual(["vehicle"]);
    expect(s.scored).toBeUndefined();
    expect(s.energyUsed).toBeUndefined();
  });

  it("Resume on the banner ends the stretch now; the athlete's own pause is left alone", () => {
    const r = drive(fresh(), 1, 200, 14, 0);
    expect(inVehicle(r.w)).toBe(true);
    const back = vehicleResumeNow(r.w, T0 + 210_000);
    expect(inVehicle(back)).toBe(false);
    expect(back.pausedAt).toBe(0);
    expect(back.vehicle!.stretches).toHaveLength(1);
    const own = pause(fresh(), T0 + 5000);
    expect(vehicleStep(own, { now: T0 + 6000, speedMs: 20 }).w).toBe(own);
    // Indoor or non-foot sports are never judged.
    const ride = fresh("ride");
    expect(vehicleStep(ride, { now: T0 + 6000, speedMs: 20 }).w).toBe(ride);
    expect(distanceCapKmh("ride", 40)).toBe(40);
    expect(distanceCapKmh("run", 25)).toBeCloseTo(21.6);
  });

  it("cutFrom drops what was recorded since the stretch began", () => {
    let w = fresh();
    for (let s = 10; s <= 120; s += 10) w = tick({ ...w, track: { ...w.track, metres: s * 1.4 } }, T0 + s * 1000);
    const c = cutFrom(w, T0 + 60_000, T0 + 120_000);
    expect(c.samples.at(-1)!.t).toBe(60);
    expect(c.lastSampleT).toBe(60);
    expect(elapsedS(c, T0 + 200_000)).toBe(60);
    expect(c.vehiclePaused).toBe(true);
  });

  it("speed from the device, else from the good fixes of the last seconds", () => {
    expect(speedReading([], { ...north(0), acc: 40, at: T0 }).speedMs).toBeNull();
    expect(speedReading([], { ...north(0), acc: 5, at: T0, speed: 3 }).speedMs).toBe(3);
    let b = speedReading([], { ...north(0), acc: 5, at: T0 }).buffer;
    expect(speedReading(b, { ...north(10), acc: 5, at: T0 + 2000 }).speedMs).toBeNull();
    b = speedReading(b, { ...north(10), acc: 5, at: T0 + 2000 }).buffer;
    expect(speedReading(b, { ...north(100), acc: 5, at: T0 + 10_000 }).speedMs).toBeCloseTo(10, 0);
  });

  it("the journal lines", () => {
    const t = {
      vehicleNotCounted: "Not counted: vehicle detected",
      vehicleLeftOut: "Vehicle stretch left out: {n} min",
      sourcePhone: "Phone {n} min",
      sourceWatch: "Watch {n} min",
    };
    const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
    expect(vehicleLine({ flags: ["vehicle"], vehicleS: 900 }, t, fmt)).toBe("Not counted: vehicle detected");
    expect(vehicleLine({ flags: [], vehicleS: 300 }, t, fmt)).toBe("Vehicle stretch left out: 5 min");
    expect(vehicleLine({ flags: [] }, t, fmt)).toBeNull();
    expect(
      sourcesLine(
        {
          sources: [
            { device: "phone", minutes: 10 },
            { device: "watch", minutes: 14 },
          ],
        },
        t,
        fmt,
      ),
    ).toBe("Phone 10 min · Watch 14 min");
    expect(sourcesLine({ sources: [{ device: "watch", minutes: 14 }] }, t, fmt)).toBeNull();
  });
});
