import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/sport-heart-fixtures.json";
import type { HeartProfile } from "./heart";
import { zoneOf } from "./heart";
import {
  bpmOfPct,
  cleanHeartZones,
  effectiveHeartZones,
  hasOwnZones,
  hrFamily,
  hrFamilyTable,
  hrIsRoughGuide,
  learnSportMaxHr,
  pctOfMax,
  RPE_ZONES,
  rpeLabel,
  rpeTalk,
  sessionHeart,
  sportAutoZones,
  sportMaxHr,
  sportProfile,
  sportThresholds,
  thresholdsFromPct,
  withRpe,
  withSportHeart,
  type HeartZonesPrefs,
} from "./sportHeart";
import {
  kindValue,
  kmhOfPaceSeconds,
  levelSpeedSetting,
  paceKind,
  paceKindText,
  paceKindUnit,
  parseKindInput,
  speedThresholdsFor,
  speedThresholdsFrom,
  stepKmh,
  zoneSports,
  type PaceKind,
} from "./speedZones";
import { WEB_SPORTS } from "./workout";

describe("sport heart zones: parity with the monorepo (sport-heart-fixtures.json)", () => {
  it("has the same families and offsets for every catalog sport", () => {
    expect(hrFamilyTable()).toEqual(fixtures.families);
  });

  it("gives the same sport max and thresholds for every profile × prefs × sport", () => {
    for (const c of fixtures.cases) {
      const p = c.profile as HeartProfile;
      const pr = c.prefs as HeartZonesPrefs | null;
      expect(sportMaxHr(p, c.sport, pr), `${JSON.stringify(p)} ${c.sport}`).toBe(c.maxHr);
      expect(sportThresholds(p, c.sport, pr), `${JSON.stringify(p)} ${c.sport}`).toEqual(c.thresholds);
    }
  });

  it("has the same effort-by-feel words", () => {
    expect(RPE_ZONES).toEqual(fixtures.rpe);
  });

  it("cleans and learns the same way", () => {
    for (const c of fixtures.cleaned) expect(cleanHeartZones(c.input) ?? null).toEqual(c.out);
    for (const c of fixtures.learn) expect(learnSportMaxHr(c.sessions, c.sport, c.profile as HeartProfile) ?? null).toEqual(c.out);
  });

  it("writes paces the same way in every kind and unit, and reads them back", () => {
    for (const c of fixtures.paces) expect(paceKindText(c.kmh, c.kind as PaceKind, c.units as "metric" | "imperial")).toBe(c.text);
    for (const c of fixtures.inverse) {
      const v = kmhOfPaceSeconds(c.seconds, c.kind as PaceKind);
      if (c.kmh === null) expect(v).toBeUndefined();
      else expect(v).toBeCloseTo(c.kmh, 9);
    }
  });

  it("gives every catalog sport the same pace kind", () => {
    expect(Object.fromEntries(WEB_SPORTS.map((s) => [s.key, paceKind(s.key)]))).toEqual(fixtures.sportKinds);
  });
});

describe("sport heart zones", () => {
  const p: HeartProfile = { age: 40, restingHr: 60 };

  it("moves the max by family", () => {
    expect(hrFamily("ride")).toBe("cycle");
    expect(sportMaxHr(p, "run")).toBe(180);
    expect(sportMaxHr(p, "ride")).toBe(174);
    expect(sportMaxHr(p, "swim")).toBe(168);
    expect(sportMaxHr(p, "hand-cycling")).toBe(165);
    expect(hrIsRoughGuide("strength")).toBe(true);
    expect(hrIsRoughGuide("yoga")).toBe(true);
    expect(hrIsRoughGuide("run")).toBe(false);
  });

  it("uses your own max or five thresholds, and resets them", () => {
    let pr = withSportHeart(null, "swim", { maxHr: 172 }, new Date("2026-10-21T10:00:00Z"));
    expect(pr.at).toBe("2026-10-21T10:00:00.000Z");
    expect(sportMaxHr(p, "swim", pr)).toBe(172);
    expect(sportThresholds(p, "swim", pr)).toEqual(sportAutoZones(p, "swim", pr));
    pr = withSportHeart(pr, "swim", { zones: [100, 110, 120, 130, 140] });
    expect(hasOwnZones("swim", pr)).toBe(true);
    expect(sportThresholds(p, "swim", pr)).toEqual([100, 110, 120, 130, 140]);
    pr = withSportHeart(pr, "swim", { zones: null, maxHr: null });
    expect(pr.sports.swim).toBeUndefined();
    expect(withRpe(pr, true).rpe).toBe(true);
    expect(withRpe(withRpe(pr, true), false).rpe).toBeUndefined();
    // Effort by feel survives a sport edit.
    expect(withSportHeart(withRpe(pr, true), "run", { maxHr: 185 }).rpe).toBe(true);
  });

  it("scores a session on the sport's thresholds with the base max", () => {
    const sp = sportProfile(p, "ride");
    expect(sp.maxHr).toBe(174);
    const s = sessionHeart({ ...p, maxHr: 190 }, "ride");
    expect(s.maxHr).toBe(190);
    expect(s.zones).toEqual(sportThresholds({ ...p, maxHr: 190 }, "ride"));
    expect(zoneOf(s.zones![1]!, s)).toBe(2);
  });

  it("lets older Health zones fill the sports the account doesn't set", () => {
    const pr: HeartZonesPrefs = { at: "2026-10-21T00:00:00.000Z", sports: { run: { maxHr: 185 } } };
    const e = effectiveHeartZones(pr, { walk: [90, 100, 110, 120, 130], run: [1, 2, 3, 4, 5] })!;
    expect(e.sports.walk?.zones).toEqual([90, 100, 110, 120, 130]);
    expect(e.sports.run).toEqual({ maxHr: 185 });
    expect(effectiveHeartZones(null, null)).toBeNull();
  });

  it("edits in percent of the sport's max", () => {
    expect(pctOfMax(144, 180)).toBe(80);
    expect(bpmOfPct(80, 180)).toBe(144);
    expect(thresholdsFromPct([60, 60, 70, 80, 90], 180)).toEqual([108, 111, 126, 144, 162]);
    expect(thresholdsFromPct([10, 20, 30, 40, 50], 180)).toBeUndefined();
  });

  it("says zones as effort by feel", () => {
    expect(rpeLabel(2)).toBe("Easy · RPE 3–4");
    expect(rpeLabel(5, "fr")).toBe("Très difficile · RPE 9–10");
    expect(rpeTalk(2)).toBe("You can chat in full sentences");
  });
});

describe("pace kinds on the web", () => {
  it("gives every sport a kind and a unit", () => {
    expect(paceKind("run")).toBe("pace");
    expect(paceKind("ride")).toBe("speed");
    expect(paceKind("swim")).toBe("swim");
    expect(paceKind("rowing")).toBe("row");
    expect(paceKind("strength")).toBe("none");
    expect(paceKindUnit("swim", "imperial")).toBe("/100 yd");
    expect(new Set(zoneSports()).size).toBe(WEB_SPORTS.length);
  });

  it("has swim and rowing defaults", () => {
    expect(paceKindText(levelSpeedSetting("swim")!.easy, "swim")).toBe("2:30 /100 m");
    expect(paceKindText(levelSpeedSetting("rowing")!.hard, "row")).toBe("2:05 /500 m");
    expect(levelSpeedSetting("run", "competitive")).toEqual({ easy: 11.3, hard: 15 });
    expect(levelSpeedSetting("run", "new")).toEqual({ easy: 7.7, hard: 10.2 });
    expect(levelSpeedSetting("strength")).toBeUndefined();
    const t = speedThresholdsFor("run", null, "trained")!;
    const d = levelSpeedSetting("run", "trained")!;
    expect(t).toEqual(speedThresholdsFrom(d.easy, d.hard));
  });

  it("steps by 5 s per unit for paces and 0.5 for speeds", () => {
    const swim = levelSpeedSetting("swim")!.easy; // 2:30 /100 m
    expect(kindValue(stepKmh(swim, "swim", "metric", 1), "swim", "metric", "en")).toBe("2:25");
    expect(kindValue(stepKmh(swim, "swim", "metric", -1), "swim", "metric", "en")).toBe("2:35");
    expect(kindValue(stepKmh(12, "row", "metric", 1), "row", "metric", "en")).toBe("2:25");
    expect(stepKmh(18, "speed", "metric", 1)).toBe(18.5);
    expect(kindValue(stepKmh(9, "pace", "metric", -1), "pace", "metric", "en")).toBe("6:45");
    expect(stepKmh(9, "none", "metric", 1)).toBe(9);
  });

  it("reads typed values in the sport's unit", () => {
    expect(parseKindInput("2:30", "swim", "metric")).toBe(2.4);
    expect(parseKindInput("2:30", "row", "metric")).toBe(12);
    expect(parseKindInput("18,5", "speed", "metric")).toBe(18.5);
    expect(parseKindInput("x", "swim", "metric")).toBeNull();
    expect(parseKindInput("2:30", "none", "metric")).toBeNull();
  });
});
