import { describe, expect, it } from "vitest";
import { TAILOR_EVENT_TYPE } from "@/lib/webapp/tailor/tailor";
import { clampStep, eventDistanceSlug, eventDistanceText, MINUTES_BOUNDS, parseEventDistance } from "./customValue";

describe("Custom… answers (build 54)", () => {
  it("custom event distances: the phone's ids, valid event types, read back", () => {
    expect(eventDistanceSlug(15, "km")).toBe("15k");
    expect(eventDistanceSlug(21.1, "km")).toBe("21-1k");
    expect(eventDistanceSlug(26.22, "mi")).toBe("26-2mi");
    expect(eventDistanceSlug(5000, "km")).toBe("1000k");
    for (const x of ["15k", "21-1k", "26-2mi"]) expect(TAILOR_EVENT_TYPE.test(x)).toBe(true);
    expect(parseEventDistance("12mi")).toEqual({ value: 12, unit: "mi" });
    expect(parseEventDistance("marathon")).toBeNull();
    expect(eventDistanceText("21-1k", "fr")).toBe("21,1 km");
    expect(eventDistanceText("half", "en")).toBeNull();
  });
  it("minutes stay inside the survey's bounds", () => {
    expect(clampStep(42, MINUTES_BOUNDS.min, MINUTES_BOUNDS.max)).toBe(42);
    expect(clampStep(2, MINUTES_BOUNDS.min, MINUTES_BOUNDS.max)).toBe(10);
    expect(clampStep(900, MINUTES_BOUNDS.min, MINUTES_BOUNDS.max)).toBe(300);
    expect(clampStep(21.14, 1, 1000, 0.1)).toBe(21.1);
  });
});
