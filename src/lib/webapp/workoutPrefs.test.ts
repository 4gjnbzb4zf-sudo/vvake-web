import { describe, expect, it } from "vitest";
import { parseHeartZones, parseSpeedZones, parseWorkoutVoice, reconcile } from "./workoutPrefs";

const at10 = "2026-10-17T10:00:00.000Z";
const at11 = "2026-10-17T11:00:00.000Z";

describe("workout prefs (newest wins)", () => {
  it("adopts the account's when newer or ours is missing, pushes ours when newer", () => {
    const old = { mode: "on", at: at10 };
    const fresh = { mode: "off", at: at11 };
    expect(reconcile(old, fresh)).toEqual({ adopt: fresh });
    expect(reconcile(fresh, old)).toEqual({ push: fresh });
    expect(reconcile(null, fresh)).toEqual({ adopt: fresh });
    expect(reconcile(fresh, null)).toEqual({ push: fresh });
    expect(reconcile(fresh, { ...fresh })).toEqual({});
    expect(reconcile(null, null)).toEqual({});
  });

  it("reads a workout voice choice, refuses anything else", () => {
    expect(parseWorkoutVoice({ mode: "essential", at: at10 })).toEqual({ mode: "essential", at: at10 });
    expect(parseWorkoutVoice({ mode: "loud", at: at10 })).toBeNull();
    expect(parseWorkoutVoice({ mode: "off", at: "yesterday" })).toBeNull();
    expect(parseWorkoutVoice({ mode: "off" })).toBeNull();
    expect(parseWorkoutVoice(null)).toBeNull();
  });

  it("reads speed zones, cleaning each sport and dropping bad ones", () => {
    const z = parseSpeedZones({
      at: at10,
      sports: {
        walk: { easy: 5.04, hard: 7.06 },
        run: { easy: 8, hard: 11, custom: [4, 6, 8, 10, 12] },
        ride: { easy: -1, hard: 7 },
        "Bad Key": { easy: 5, hard: 7 },
      },
    });
    expect(z).toEqual({ at: at10, sports: { walk: { easy: 5, hard: 7.1 }, run: { easy: 8, hard: 11, custom: [4, 6, 8, 10, 12] } } });
    expect(parseSpeedZones({ at: at10, sports: [] })).toBeNull();
    expect(parseSpeedZones({ sports: {} })).toBeNull();
    expect(parseSpeedZones({ at: at10, sports: {} })).toEqual({ at: at10, sports: {} });
  });

  it("reads heart zones, and treats an absent or broken value (an older API) as none", () => {
    expect(parseHeartZones(undefined)).toBeNull();
    expect(parseHeartZones({ sports: {} })).toBeNull();
    expect(parseHeartZones({ at: at10, rpe: true, sports: { swim: { maxHr: 172 }, run: { zones: [1, 2, 3, 4, 5] } } })).toEqual({
      at: at10,
      rpe: true,
      sports: { swim: { maxHr: 172 } },
    });
    // Newest wins as for the other settings.
    const ours = { at: at11, sports: {} };
    expect(reconcile(ours, parseHeartZones(undefined))).toEqual({ push: ours });
  });
});
