import { describe, expect, it } from "vitest";
import { CAMERA_ROUTINES } from "./camera/cameraSession";
import {
  canHideWay,
  cameraPickOf,
  cleanStartWays,
  DEFAULT_CAMERA_ROUTINE,
  homeWays,
  newerStartWays,
  openingPick,
  parseCameraPick,
  setStartWay,
} from "./startWays";

const known = { routine: (id: string) => CAMERA_ROUTINES.some((r) => r.id === id), move: (id: string) => id === "squat" };
const at = "2026-10-29T12:00:00.000Z";

describe("camera workout: the last pick", () => {
  it("the default routine exists", () => expect(known.routine(DEFAULT_CAMERA_ROUTINE)).toBe(true));
  it("reads only well-formed picks", () => {
    expect(parseCameraPick('{"kind":"routine","id":"core-10"}')).toEqual({ kind: "routine", id: "core-10" });
    expect(parseCameraPick('{"kind":"free"}')).toEqual({ kind: "free" });
    for (const bad of [null, "", "x", '{"kind":"move"}', '{"kind":"routine","id":"A B"}', "[]", "null"])
      expect(parseCameraPick(bad)).toBeNull();
  });
  it("remembers catalogue routines, moves and free moving; not trainings, skills or plan-made routines", () => {
    expect(cameraPickOf({ routine: { id: "core-10" }, move: null }, known)).toEqual({ kind: "routine", id: "core-10" });
    expect(cameraPickOf({ routine: null, move: "squat" }, known)).toEqual({ kind: "move", id: "squat" });
    expect(cameraPickOf({ routine: null, move: null }, known)).toEqual({ kind: "free" });
    expect(cameraPickOf({ routine: { id: "core-10-x2" }, move: null }, known)).toBeNull();
    expect(cameraPickOf({ routine: { id: "core-10" }, move: null, training: { id: "t" } }, known)).toBeNull();
    expect(cameraPickOf({ routine: { id: "core-10" }, move: null, skill: "handstand" }, known)).toBeNull();
  });
  it("opens on the last pick, else the beginner routine with the choices open", () => {
    expect(openingPick({ kind: "routine", id: "core-10" }, known)).toEqual({ pick: { kind: "routine", id: "core-10" }, open: false });
    expect(openingPick({ kind: "free" }, known).open).toBe(false);
    expect(openingPick(null, known)).toEqual({ pick: { kind: "routine", id: DEFAULT_CAMERA_ROUTINE }, open: true });
    expect(openingPick({ kind: "move", id: "gone" }, known).open).toBe(true);
  });
});

describe("show on Home: GPS & sensors, camera", () => {
  it("both by default; camera only with the feature", () => {
    expect(homeWays(null, true)).toEqual({ gps: true, camera: true });
    expect(homeWays(null, false)).toEqual({ gps: true, camera: false });
    expect(homeWays({ gps: false, camera: true }, true)).toEqual({ gps: false, camera: true });
    // Camera feature off: GPS comes back even if it was hidden.
    expect(homeWays({ gps: false, camera: true }, false)).toEqual({ gps: true, camera: false });
  });
  it("never hides the last way", () => {
    expect(canHideWay("gps", null, true)).toBe(true);
    expect(canHideWay("gps", null, false)).toBe(false);
    expect(canHideWay("camera", { gps: false, camera: true }, true)).toBe(false);
    expect(setStartWay({ gps: false, camera: true }, "camera", false, true)).toBeNull();
    expect(setStartWay(null, "gps", false, false)).toBeNull();
    const now = new Date(at);
    expect(setStartWay(null, "gps", false, true, now)).toEqual({ gps: false, camera: true, at });
    expect(setStartWay({ gps: false, camera: true }, "gps", true, true, now)).toEqual({ gps: true, camera: true, at });
    expect(setStartWay(null, "camera", false, true, now)).toEqual({ gps: true, camera: false, at });
  });
  it("cleans stored prefs (never both hidden) and keeps the newest", () => {
    expect(cleanStartWays({ gps: false, camera: false, at })).toEqual({ gps: true, camera: false, at });
    expect(cleanStartWays({ gps: true, camera: "x", at })).toBeNull();
    expect(cleanStartWays({ gps: true, camera: true, at: "nope" })).toBeNull();
    const a = { gps: true, camera: false, at };
    const b = { gps: false, camera: true, at: "2026-10-29T13:00:00.000Z" };
    expect(newerStartWays(a, b)).toBe(b);
    expect(newerStartWays(b, a)).toBe(b);
    expect(newerStartWays(null, a)).toBe(a);
  });
});
