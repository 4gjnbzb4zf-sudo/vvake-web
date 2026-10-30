import { describe, expect, it } from "vitest";
import golden from "../fixtures/vehicle-golden.json";
import { newVehicleGuard, vehicleSegments, vehicleSuspicion, vehicleTick, vehicleVerdict, type VehicleTickInput } from "./vehicleGuard";
import { newerAutoStartPrefs } from "./autoStart";

/**
 * The browser judges a vehicle as the phone, the watches and the server do: the golden cases game-core writes for the
 * ports (VVFit packages/game-core/test/fixtures/vehicle-golden.json, copied by scripts/sync-vehicle-core.ts).
 */
describe("vehicle guard parity with game-core", () => {
  it("matches the golden fixture", () => {
    for (const g of golden.suspicion as (Omit<VehicleTickInput, "t"> & { sport: string; why: string | null })[])
      expect(vehicleSuspicion(g.sport, g), JSON.stringify(g)).toBe(g.why);
    for (const tl of golden.timelines as unknown as {
      sport: string;
      step: number;
      rows: Omit<VehicleTickInput, "t">[];
      events: unknown[];
      stretches: unknown[];
    }[]) {
      let s = newVehicleGuard();
      const events: unknown[] = [];
      tl.rows.forEach((r, i) => {
        const x = vehicleTick(tl.sport, s, { t: i * tl.step, ...r });
        s = x.state;
        if (x.event) events.push({ i, ...x.event });
      });
      expect(events).toEqual(tl.events);
      expect(s.stretches).toEqual(tl.stretches);
    }
    for (const c of golden.segments as unknown as {
      sport: string;
      samples: { t: number; m: number; steps?: number }[];
      vehicleS: number;
      segments: unknown[];
    }[])
      expect(vehicleSegments(c.samples, c.sport)).toEqual({ vehicleS: c.vehicleS, segments: c.segments });
    for (const v of golden.verdicts as { footS: number; vehicleS: number; verdict: string }[]) expect(vehicleVerdict(v)).toBe(v.verdict);
  });

  it("prefs.autoStart: the newer choice wins", () => {
    const a = { mode: "auto" as const, at: "2026-10-30T10:00:00.000Z" };
    const b = { mode: "off" as const, at: "2026-10-29T10:00:00.000Z" };
    expect(newerAutoStartPrefs(a, b)).toEqual(a);
    expect(newerAutoStartPrefs(null, b)).toEqual(b);
  });
});

describe("Start workouts for me on the account page", () => {
  it("stamps a new choice after the account's, so it wins", async () => {
    const { nextAutoStart } = await import("./autoStartPrefs");
    const { autoStartModeOf } = await import("./autoStart");
    const later = "2030-01-01T00:00:00.000Z";
    expect(nextAutoStart({ mode: "ask", at: later }, "auto", Date.parse("2026-10-30T10:00:00Z"))).toEqual({
      mode: "auto",
      at: "2030-01-01T00:00:00.001Z",
    });
    expect(nextAutoStart(undefined, "off", Date.parse("2026-10-30T10:00:00Z")).at).toBe("2026-10-30T10:00:00.000Z");
    expect(autoStartModeOf(undefined)).toBe("ask");
    expect(autoStartModeOf("nope")).toBe("ask");
  });
});
