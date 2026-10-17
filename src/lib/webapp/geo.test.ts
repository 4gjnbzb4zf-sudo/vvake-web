import { describe, expect, it } from "vitest";
import { addFix, emptyTrack, gpsBars, metresBetween, paceOf, splitsOf, validFix, type Fix, type TrackState } from "./geo";

/** A point `m` metres north of the start (1° of latitude ≈ 111 195 m). */
const north = (m: number) => ({ lat: 45.5 + m / 111_195, lon: -73.56 });

function run(fixes: Partial<Fix>[], o: { capKmh?: number | null; paused?: boolean } = {}) {
  let s: TrackState = emptyTrack();
  const verdicts: string[] = [];
  for (const f of fixes) {
    const r = addFix(s, f, { t: ((f.at ?? 0) - 1_000_000) / 1000, now: f.at ?? 0, capKmh: o.capKmh ?? 25, paused: o.paused });
    s = r.state;
    verdicts.push(r.verdict);
  }
  return { s, verdicts };
}

describe("distance between points", () => {
  it("measures metres like the phone (haversine)", () => {
    expect(metresBetween(north(0), north(1000))).toBeCloseTo(1000, 0);
    expect(metresBetween({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111_195, -2);
  });
  it("refuses broken fixes (0,0, NaN, out of the globe)", () => {
    expect(validFix({ lat: 0, lon: 0, acc: 5, at: 1 })).toBe(false);
    expect(validFix({ lat: NaN, lon: 1, acc: 5, at: 1 })).toBe(false);
    expect(validFix({ lat: 95, lon: 1, acc: 5, at: 1 })).toBe(false);
    expect(validFix({ ...north(0), acc: 5, at: 1 })).toBe(true);
  });
});

describe("GPS filtering", () => {
  const t0 = 1_000_000;
  it("counts a steady run from good fixes", () => {
    // 3 m/s for 100 s, a fix every 2 s, ±5 m.
    const fixes = Array.from({ length: 51 }, (_, i) => ({ ...north(i * 6), acc: 5, at: t0 + i * 2000 }));
    const { s, verdicts } = run(fixes);
    expect(verdicts[0]).toBe("first");
    expect(s.metres).toBeCloseTo(300, -1);
    expect(s.route).toHaveLength(51);
  });

  it("never counts inaccurate fixes (over 25 m), but still shows you when within 50 m", () => {
    const { s, verdicts } = run([
      { ...north(0), acc: 5, at: t0 },
      { ...north(20), acc: 40, at: t0 + 5000 },
    ]);
    expect(verdicts[1]).toBe("inaccurate");
    expect(s.metres).toBe(0);
    expect(s.here?.lat).toBeCloseTo(north(20).lat, 6);
  });

  it("ignores jitter while standing still", () => {
    const fixes = Array.from({ length: 30 }, (_, i) => ({
      lat: 45.5 + (i % 2 ? 1.5 : -1.5) / 111_195,
      lon: -73.56,
      acc: 6,
      at: t0 + i * 2000,
    }));
    const { s } = run(fixes);
    expect(s.metres).toBe(0);
  });

  it("drops a teleport (100 m or more between fixes) and a jump faster than the sport allows", () => {
    const { s, verdicts } = run([
      { ...north(0), acc: 5, at: t0 },
      { ...north(500), acc: 5, at: t0 + 2000 },
      { ...north(60), acc: 5, at: t0 + 3000 },
      { ...north(10), acc: 5, at: t0 + 5000 },
    ]);
    expect(verdicts.slice(1)).toEqual(["jump", "too-fast", "counted"]);
    expect(s.metres).toBeCloseTo(10, 0);
  });

  it("re-anchors after three refused fixes in a row (the GPS really moved), without counting the gap", () => {
    const { s, verdicts } = run([
      { ...north(0), acc: 5, at: t0 },
      { ...north(400), acc: 5, at: t0 + 2000 },
      { ...north(404), acc: 5, at: t0 + 4000 },
      { ...north(408), acc: 5, at: t0 + 6000 },
      { ...north(420), acc: 5, at: t0 + 10000 },
    ]);
    expect(verdicts).toEqual(["first", "jump", "jump", "jump", "counted"]);
    expect(s.metres).toBeCloseTo(12, 0);
  });

  it("refuses a cached fix the browser hands back late", () => {
    const r = addFix(emptyTrack(), { ...north(0), acc: 5, at: t0 }, { t: 0, now: t0 + 60_000 });
    expect(r.verdict).toBe("stale");
  });

  it("counts nothing while paused, and the walk back isn't counted after", () => {
    let s = run([
      { ...north(0), acc: 5, at: t0 },
      { ...north(10), acc: 5, at: t0 + 4000 },
    ]).s;
    let r = addFix(s, { ...north(50), acc: 5, at: t0 + 30000 }, { t: 30, now: t0 + 30000, paused: true });
    expect(r.verdict).toBe("paused");
    s = r.state;
    r = addFix(s, { ...north(55), acc: 5, at: t0 + 34000 }, { t: 34, now: t0 + 34000 });
    expect(r.verdict).toBe("first");
    expect(r.state.metres).toBeCloseTo(10, 0);
  });

  it("adds climb with a 3 m hysteresis", () => {
    const alts = [100, 101, 102, 104, 103, 107, 106, 110];
    const { s } = run(alts.map((alt, i) => ({ ...north(i * 8), acc: 5, alt, at: t0 + i * 3000 })));
    expect(s.gainM).toBe(10);
  });
});

describe("splits and pace", () => {
  it("times each full kilometre", () => {
    const route = Array.from({ length: 31 }, (_, i) => ({ t: i * 20, m: i * 100, lat: 0, lon: 0 }));
    expect(splitsOf(route)).toEqual([200, 200, 200]);
    expect(splitsOf(route, 1609.344)).toEqual([322]);
  });
  it("pace per km, none for too little distance", () => {
    expect(paceOf(300, 1000)).toBe(300);
    expect(paceOf(30, 20)).toBeNull();
  });
  it("GPS bars like the phone", () => {
    expect([gpsBars(4), gpsBars(9), gpsBars(15), gpsBars(40), gpsBars(80), gpsBars(null)]).toEqual([4, 3, 2, 1, 0, 0]);
  });
});
