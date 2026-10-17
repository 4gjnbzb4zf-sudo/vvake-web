import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/speed-zone-fixtures.json";
import {
  cleanSpeedSetting,
  defaultSpeedSetting,
  hasSpeedZones,
  learnSpeedZones,
  newerPref,
  normalizeEasyHard,
  parseSpeedInput,
  speedShownAsPace,
  speedThresholdsFor,
  speedThresholdsFrom,
  speedUnit,
  speedValue,
  speedZoneSports,
  speedZonesTable,
  toggleWorkoutVoice,
  validSpeedThresholds,
  windowSpeedKmh,
  workoutChattiness,
  zoneOfSpeed,
  zoneRanges,
  type SpeedZonesPrefs,
} from "./speedZones";

describe("speed zones: parity with the monorepo (speed-zone-fixtures.json)", () => {
  it("has the same GPS sports, defaults, thresholds and pace flags", () => {
    expect(speedZonesTable()).toEqual(fixtures.table);
  });

  it("derives the same thresholds from easy / hard pairs", () => {
    for (const c of fixtures.fromPairs) expect(speedThresholdsFrom(c.easy, c.hard), `${c.easy}/${c.hard}`).toEqual(c.thresholds);
  });

  it("puts speeds in the same zones", () => {
    const table = speedZonesTable();
    for (const c of fixtures.zones) {
      expect(zoneOfSpeed(c.kmh, table.walk!.thresholds), `walk ${c.kmh}`).toBe(c.walk);
      expect(zoneOfSpeed(c.kmh, table.run!.thresholds), `run ${c.kmh}`).toBe(c.run);
    }
  });

  it("cleans settings the same way", () => {
    for (const c of fixtures.cleaned) expect(cleanSpeedSetting(c.input) ?? null).toEqual(c.out);
  });

  it("resolves the same thresholds per sport", () => {
    for (const c of fixtures.resolved)
      expect(speedThresholdsFor(c.sport, fixtures.prefs as unknown as SpeedZonesPrefs) ?? null, c.sport).toEqual(c.thresholds);
  });

  it("learns the same easy / hard", () => {
    for (const c of fixtures.learn) expect(learnSpeedZones(c.sessions, c.sport) ?? null).toEqual(c.out);
  });
});

describe("speed zones", () => {
  it("puts easy in zone 2 and hard in zone 4 for every GPS sport", () => {
    for (const sport of Object.keys(speedZonesTable())) {
      const d = defaultSpeedSetting(sport)!;
      const t = speedThresholdsFrom(d.easy, d.hard);
      expect(zoneOfSpeed(d.easy, t), sport).toBe(2);
      expect(zoneOfSpeed(d.hard, t), sport).toBe(4);
    }
  });

  it("pushes hard at least 10% over easy and validates custom values", () => {
    expect(normalizeEasyHard(10, 9)).toEqual({ easy: 10, hard: 11 });
    expect(normalizeEasyHard(5.04, 7.06)).toEqual({ easy: 5, hard: 7.1 });
    expect(validSpeedThresholds([1, 2, 3, 4, 5])).toBe(true);
    expect(validSpeedThresholds([1, 2, 2, 4, 5])).toBe(false);
    expect(validSpeedThresholds([0.1, 2, 3, 4, 5])).toBe(false);
    expect(validSpeedThresholds([1, 2, 3, 4, 500])).toBe(false);
    expect(cleanSpeedSetting("x")).toBeUndefined();
  });

  it("has no speed zones for sports without GPS", () => {
    expect(hasSpeedZones("strength")).toBe(false);
    expect(hasSpeedZones("yoga")).toBe(false);
    expect(hasSpeedZones("unknown-sport")).toBe(false);
    expect(hasSpeedZones("ride")).toBe(true);
    expect(speedShownAsPace("walk")).toBe(true);
    expect(speedShownAsPace("ride")).toBe(false);
    expect(speedShownAsPace("skate")).toBe(false);
  });

  it("lists walk, run, hike, ride first, then every other GPS sport once", () => {
    const list = speedZoneSports();
    expect(list.slice(0, 4)).toEqual(["walk", "run", "hike", "ride"]);
    expect(new Set(list).size).toBe(list.length);
    expect([...list].sort()).toEqual(Object.keys(speedZonesTable()).sort());
  });

  it("computes the live speed over the last 30 s", () => {
    const s: [number, number][] = [];
    for (let t = 0; t <= 60; t += 1) s.push([t, t * 1.25]); // 4.5 km/h
    expect(windowSpeedKmh(s)).toBeCloseTo(4.5, 5);
    // Stopped for the last 30 s after moving: speed 0, zone 0.
    const stop: [number, number][] = [...s, ...Array.from({ length: 31 }, (_, i) => [61 + i, 75] as [number, number])];
    expect(windowSpeedKmh(stop)).toBe(0);
    expect(
      windowSpeedKmh([
        [0, 0],
        [5, 10],
      ]),
    ).toBe(0);
    expect(windowSpeedKmh([])).toBe(0);
  });

  it("keeps the newest preference", () => {
    const a = { at: "2026-10-17T10:00:00.000Z", mode: "off" };
    const b = { at: "2026-10-17T11:00:00.000Z", mode: "on" };
    expect(newerPref(a, b)).toBe(b);
    expect(newerPref(b, a)).toBe(b);
    expect(newerPref(undefined, a)).toBe(a);
  });

  it("toggles the workout voice in one tap", () => {
    expect(toggleWorkoutVoice("on")).toBe("off");
    expect(toggleWorkoutVoice("essential")).toBe("off");
    expect(toggleWorkoutVoice("off")).toBe("on");
    expect(workoutChattiness("off", "chatty")).toBeNull();
    expect(workoutChattiness("essential", "chatty")).toBe("quiet");
    expect(workoutChattiness("on", "normal")).toBe("normal");
  });
});

describe("speed zones on the web: pace or speed in the app's units", () => {
  it("shows a pace per km or mile, a speed in km/h or mph", () => {
    expect(speedValue(10, true, "metric", "en")).toBe("6:00");
    expect(speedValue(9, true, "metric", "en")).toBe("6:40");
    expect(speedValue(9.656064, true, "imperial", "en")).toBe("10:00");
    expect(speedValue(18, false, "metric", "en")).toBe("18.0");
    expect(speedValue(18, false, "metric", "fr")).toBe("18,0");
    expect(speedValue(16.09344, false, "imperial", "en")).toBe("10.0");
    expect(speedValue(0, true, "metric", "en")).toBe("–");
    expect(speedUnit(true, "metric")).toBe("/km");
    expect(speedUnit(true, "imperial")).toBe("/mi");
    expect(speedUnit(false, "metric")).toBe("km/h");
    expect(speedUnit(false, "imperial")).toBe("mph");
  });

  it("reads back what was typed, in km/h", () => {
    expect(parseSpeedInput("6:00", true, "metric")).toBe(10);
    expect(parseSpeedInput(" 6 ", true, "metric")).toBe(10);
    expect(parseSpeedInput("10:00", true, "imperial")).toBeCloseTo(9.66, 2);
    expect(parseSpeedInput("18,5", false, "metric")).toBe(18.5);
    expect(parseSpeedInput("10", false, "imperial")).toBeCloseTo(16.09, 2);
    expect(parseSpeedInput("6:75", true, "metric")).toBeNull();
    expect(parseSpeedInput("6.5", true, "metric")).toBeNull();
    expect(parseSpeedInput("abc", false, "metric")).toBeNull();
    expect(parseSpeedInput("", false, "metric")).toBeNull();
    expect(parseSpeedInput("0", false, "metric")).toBeNull();
    expect(parseSpeedInput("200", false, "metric")).toBeNull();
    // Round trip: a pace shown, typed back, the same pace.
    expect(speedValue(parseSpeedInput(speedValue(9, true, "metric", "en"), true, "metric")!, true, "metric", "en")).toBe("6:40");
  });

  it("gives five ranges, the last one open", () => {
    const r = zoneRanges([2.7, 3.8, 5.2, 5.8, 7]);
    expect(r.map((x) => x.zone)).toEqual([1, 2, 3, 4, 5]);
    expect(r[0]).toEqual({ zone: 1, from: 2.7, to: 3.8 });
    expect(r[4]).toEqual({ zone: 5, from: 7, to: null });
  });
});
