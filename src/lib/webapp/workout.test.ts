import { describe, expect, it } from "vitest";
import { addFix } from "./geo";
import { goalProgress, parseGoals, validGoal, type WebGoal } from "./goals";
import { heartProfileOf } from "./heart";
import { afterUpload, enqueue, memoryKV, WORKOUT_KEY } from "./store";
import {
  afterReload,
  buildSession,
  elapsedS,
  emptyReason,
  maxEnergy,
  newWorkout,
  pause,
  refill,
  resume,
  sportOf,
  streakMultiplier,
  tick,
  usesGps,
  uuid,
  withHeart,
  type WorkoutSnapshot,
} from "./workout";

const T0 = Date.UTC(2026, 9, 17, 8, 0, 0);
const fresh = (sport = "run", energy = 4) =>
  newWorkout({ id: "11111111-2222-4333-8444-555555555555", userId: "u1", sport, now: T0, energy });
const north = (m: number) => ({ lat: 45.5 + m / 111_195, lon: -73.56 });

describe("the clock", () => {
  it("counts from the wall clock and takes pauses out", () => {
    let w = fresh();
    expect(elapsedS(w, T0 + 65_000)).toBe(65);
    w = pause(w, T0 + 60_000);
    expect(elapsedS(w, T0 + 120_000)).toBe(60);
    w = resume(w, T0 + 120_000);
    expect(elapsedS(w, T0 + 130_000)).toBe(70);
  });
  it("writes a sample every 10 s with the fresh heart rate; a catch-up after a sleep has none", () => {
    let w = withHeart(fresh(), 140, T0 + 9_000);
    w = tick(w, T0 + 10_000);
    expect(w.samples).toEqual([{ t: 10, m: 0, bpm: 140 }]);
    w = withHeart(w, 150, T0 + 59_000);
    w = tick(w, T0 + 60_500);
    expect(w.samples.map((s) => s.t)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(w.samples.filter((s) => s.bpm !== undefined).map((s) => s.t)).toEqual([10, 60]);
  });
  it("pausing forgets the last fix so the walk back isn't counted", () => {
    let w = fresh();
    w = { ...w, track: addFix(w.track, { ...north(0), acc: 5, at: T0 }, { t: 0, now: T0 }).state };
    expect(w.track.last).not.toBeNull();
    expect(pause(w, T0 + 1000).track.last).toBeNull();
  });
});

describe("resume after a reload (IndexedDB snapshot)", () => {
  it("keeps the time and the distance, restarts the distance from the next fix", async () => {
    const kv = memoryKV();
    let w = fresh();
    w = { ...w, track: addFix(w.track, { ...north(0), acc: 5, at: T0 }, { t: 0, now: T0 }).state };
    w = { ...w, track: addFix(w.track, { ...north(50), acc: 5, at: T0 + 20_000 }, { t: 20, now: T0 + 20_000 }).state };
    await kv.set(WORKOUT_KEY, w);
    const back = afterReload((await kv.get<WorkoutSnapshot>(WORKOUT_KEY))!);
    expect(back.id).toBe(w.id);
    expect(back.track.metres).toBeCloseTo(50, 0);
    expect(back.track.last).toBeNull();
    expect(elapsedS(back, T0 + 300_000)).toBe(300);
    // The next fix far away doesn't add a straight line across the gap.
    const next = addFix(back.track, { ...north(900), acc: 5, at: T0 + 300_000 }, { t: 300, now: T0 + 300_000 });
    expect(next.verdict).toBe("first");
    expect(next.state.metres).toBeCloseTo(50, 0);
  });
  it("the in-memory fallback never shares objects with the caller", async () => {
    const kv = memoryKV();
    const w = fresh();
    await kv.set(WORKOUT_KEY, w);
    const got = (await kv.get<WorkoutSnapshot>(WORKOUT_KEY))!;
    got.samples.push({ t: 1, m: 1 });
    expect((await kv.get<WorkoutSnapshot>(WORKOUT_KEY))!.samples).toHaveLength(0);
    expect(kv.durable).toBe(false);
  });
});

describe("the session uploaded", () => {
  const heart = heartProfileOf({ age: 32, restingHr: 58 });
  it("GPS only: tier C, no effort score, source web, the browser's device key, distance", () => {
    let w = fresh();
    for (let i = 0; i <= 60; i++)
      w = {
        ...w,
        track: addFix(w.track, { ...north(i * 5), acc: 5, at: T0 + i * 2000 }, { t: i * 2, now: T0 + i * 2000, capKmh: 25 }).state,
      };
    w = tick(w, T0 + 120_000);
    const s = buildSession(w, { now: T0 + 120_000, deviceKey: "web-0123456789abcdef01234567", heart, gps: true });
    expect(s).toMatchObject({ source: "web", tier: "C", sport: "run", activeS: 120, deviceKey: "web-0123456789abcdef01234567" });
    expect(s.distanceM).toBeCloseTo(300, -1);
    expect(s.scored).toBeUndefined();
    expect(s.avgBpm).toBeUndefined();
    expect(s.samples).toHaveLength(12);
    expect(s.samples.every((x) => !("lat" in x))).toBe(true);
  });
  it("with a heart-rate strap: tier B, zones, the effort within the energy left, the heart profile", () => {
    let w = fresh("strength", 1);
    for (let t = 1; t <= 900; t++) {
      w = withHeart(w, 150, T0 + t * 1000);
      w = tick(w, T0 + t * 1000);
    }
    const s = buildSession(w, { now: T0 + 900_000, deviceKey: "web-x0000000", heart, gps: false });
    expect(s.tier).toBe("B");
    expect(s.avgBpm).toBe(150);
    expect(s.zoneS?.[2]).toBeGreaterThan(800);
    // 1 energy = 5 scored minutes at zone 3 (×3) = 15; the whole session's effort is larger.
    expect(s.scored).toBeCloseTo(15, 0);
    expect(s.effort!).toBeGreaterThan(s.scored!);
    expect(s.energyUsed).toBe(1);
    expect(s.hrProfile).toEqual({ age: 32, restingHr: 58 });
    expect(s.distanceM).toBeUndefined();
  });
  it("nothing worth saving: under a minute, or no heart rate and under 30 m", () => {
    expect(emptyReason(59, 1000, 10)).toBe("too_short");
    expect(emptyReason(600, 10, 0)).toBe("no_signal");
    expect(emptyReason(600, 10, 3)).toBeNull();
    expect(emptyReason(600, 500, 0)).toBeNull();
  });
  it("tracks GPS only outdoors in a distance sport", () => {
    expect(usesGps(sportOf("run"))).toBe(true);
    expect(usesGps(sportOf("yoga"))).toBe(false);
    expect(usesGps(sportOf("swim"))).toBe(false);
    expect(sportOf("nope").key).toBe("other");
  });
  it("uuids the API takes", () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("the upload queue", () => {
  const s = (id: string) => ({ id });
  it("keeps one copy per id and drops what the API took", () => {
    let q = enqueue([], "u1", s("a"));
    q = enqueue(q, "u1", s("a"));
    q = enqueue(q, "u1", s("b"));
    expect(q).toHaveLength(2);
    q = afterUpload(q, [
      { id: "a", status: "created" },
      { id: "b", status: "invalid" },
    ]);
    expect(q.map((x) => [x.session.id, x.tries])).toEqual([["b", 1]]);
    q = afterUpload(afterUpload(q, [{ id: "b", status: "invalid" }]), [{ id: "b", status: "invalid" }]);
    expect(q).toHaveLength(0);
  });
});

describe("energy and streak (game-core rules)", () => {
  it("max 4, +1 at a 7-day streak, +2 at 30", () => {
    expect([maxEnergy(0), maxEnergy(7), maxEnergy(30)]).toEqual([4, 5, 6]);
  });
  it("refills a quarter at each local 00:00, 06:00, 12:00, 18:00 crossed", () => {
    const at = Date.UTC(2026, 9, 17, 5, 0);
    expect(refill({ current: 0, updatedAt: at }, at + 2 * 3600_000, 4, 0).current).toBe(1);
    expect(refill({ current: 3.5, updatedAt: at }, at + 24 * 3600_000, 4, 0).current).toBe(4);
    expect(refill(null, at, 4, 0).current).toBe(4);
  });
  it("streak multiplier +5 % a day, +50 % at most", () => {
    expect([streakMultiplier(0), streakMultiplier(1), streakMultiplier(3), streakMultiplier(30)]).toEqual([1, 1, 1.1, 1.5]);
  });
});

describe("goals", () => {
  const start = Date.UTC(2026, 9, 1);
  const day = 86_400_000;
  const sessions = [
    { sport: "run", startMs: start + day, distanceM: 5000 },
    { sport: "run", startMs: start + 2 * day, distanceM: 7000 },
    { sport: "yoga", startMs: start + 3 * day },
    { sport: "run", startMs: start + 9 * day, distanceM: 3000 },
  ];
  it("counts sessions, a distance, and weeks hit, in the goal's sport", () => {
    const g = (x: Partial<WebGoal>): WebGoal => ({ id: "g", kind: "sessions", startMs: start, target: 4, span: 30, ...x });
    expect(goalProgress(g({}), sessions, start + 10 * day).done).toBe(4);
    expect(goalProgress(g({ sport: "run" }), sessions, start + 10 * day).done).toBe(3);
    expect(goalProgress(g({ kind: "distance", target: 20, sport: "run" }), sessions, start + 10 * day).done).toBe(15);
    const c = goalProgress(g({ kind: "consistency", target: 2, span: 4 }), sessions, start + 14 * day);
    expect(c.done).toBe(1);
    expect(c.target).toBe(4);
    expect(goalProgress(g({ target: 3 }), sessions, start + 10 * day).status).toBe("reached");
    expect(goalProgress(g({ target: 10, span: 5 }), sessions, start + 10 * day).status).toBe("ended");
  });
  it("keeps only valid goals from storage", () => {
    expect(validGoal({ id: "a", kind: "consistency", startMs: 1, target: 8, span: 4 })).toBe(false);
    expect(parseGoals('[{"id":"a","kind":"sessions","startMs":1,"target":5,"span":10},{"kind":"weight"}]')).toHaveLength(1);
    expect(parseGoals("not json")).toEqual([]);
  });
});
