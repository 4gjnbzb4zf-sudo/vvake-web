import { describe, expect, it } from "vitest";
import { analysisFps, detectAverage, kgToUnits, loadToKg, motionBetween, toView } from "./webPose";
import { cameraPointsPreview, cameraSessionEmpty, strapSample, toWebCameraSession } from "./webCameraSession";
import type { CameraSummary } from "./cameraPoints";

const summary: CameraSummary = {
  v: 1,
  moves: [{ id: "squat", sets: [{ reps: 100, judged: "camera" }] }],
  trackedS: 900,
  workS: 600,
  liveness: {
    asked: 2,
    passed: 2,
    checks: [
      { t: 70, kind: "t_pose", ok: true, ms: 1200 },
      { t: 300, kind: "both_arms_up", ok: true, ms: 900 },
    ],
  },
};
const heart = { age: 35, restingHr: 60 };

describe("the web camera session", () => {
  it("tier C, the camera flag and summary, no samples, no distance", () => {
    const s = toWebCameraSession({
      id: "a",
      sport: "functional-strength",
      startedAtMs: 0,
      endedAtMs: 960_000,
      activeS: 900.4,
      summary,
      deviceKey: "web-x",
    });
    expect(s).toMatchObject({ source: "web", tier: "C", flags: ["camera"], samples: [], activeS: 900, deviceKey: "web-x" });
    expect(s.camera?.moves[0]?.sets[0]?.reps).toBe(100);
    expect(s.distanceM).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/"x":|"y":/);
  });
  it("with a strap: tier B, heart fields, camera.heart = strap", () => {
    const samples = Array.from({ length: 90 }, (_, i) => strapSample((i + 1) * 10, { v: 130, at: 0 }, 0));
    const s = toWebCameraSession({
      id: "a",
      sport: "hiit",
      startedAtMs: 0,
      endedAtMs: 960_000,
      activeS: 900,
      summary,
      deviceKey: "k",
      strap: { samples, heart, energyAtStart: 4 },
    });
    expect(s.tier).toBe("B");
    expect(s.flags).toEqual(["camera", "hr_strap"]);
    expect(s.samples.every((x, i) => x.t === (i + 1) * 10 && x.bpm === 130)).toBe(true);
    expect(s.avgBpm).toBe(130);
    // The server credits min(client scored, its own score): the upload carries the client's heart effort.
    expect(s.scored).toBeGreaterThan(0);
    expect(s).toMatchObject({ maxBpm: 130, hrProfile: { age: 35, restingHr: 60 } });
    expect(s.zoneS?.reduce((x, y) => x + y, 0)).toBeGreaterThan(0);
    expect(s.camera?.heart).toBe("strap");
    expect(s.samples).toHaveLength(90);
    expect(strapSample(10, { v: 120, at: 0 }, 20_000).bpm).toBeUndefined();
  });
  it("empty under a minute or without reps", () => {
    expect(cameraSessionEmpty(30, summary)).toBe(true);
    expect(cameraSessionEmpty(300, null)).toBe(true);
    expect(cameraSessionEmpty(300, summary)).toBe(false);
  });
  it("previews the phone's points rule", () => {
    expect(cameraPointsPreview(summary, 900)).toEqual({ points: 10, reason: "ok", workMin: 10 });
    expect(cameraPointsPreview({ ...summary, workS: 200 }, 900).reason).toBe("too_little");
  });
});

describe("webcam helpers", () => {
  it("analyses fewer frames when still or on a slow machine", () => {
    expect(analysisFps({ stillMs: 0, detectMs: 10 })).toBe(15);
    expect(analysisFps({ stillMs: 6000, detectMs: 10 })).toBe(8);
    expect(analysisFps({ stillMs: 0, detectMs: 60 })).toBe(6);
    expect(analysisFps({ stillMs: 0, detectMs: 500 })).toBe(4);
    expect(detectAverage(0, 20)).toBe(20);
    expect(detectAverage(20, 40)).toBeCloseTo(23);
  });
  it("maps the picture onto a covering view", () => {
    expect(toView({ x: 0.5, y: 0.5 }, { w: 640, h: 480 }, { width: 300, height: 400 })).toEqual({ x: 150, y: 200 });
    expect(motionBetween(null, null)).toBe(0);
  });
  it("loads in your units", () => {
    expect(loadToKg("22,5", "metric")).toBe(22.5);
    expect(loadToKg("45", "imperial")).toBe(20.4);
    expect(loadToKg("", "metric")).toBeUndefined();
    expect(kgToUnits(20.4, "imperial")).toBe("45");
  });
});
