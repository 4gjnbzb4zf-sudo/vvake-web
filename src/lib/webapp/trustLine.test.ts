import { describe, expect, it } from "vitest";
import { getWebAppDict } from "../../i18n/webapp";
import { trustLine } from "./trustLine";

describe("trustLine (ADR-0067)", () => {
  it("one calm line, the decision first, in EN and FR", () => {
    for (const lang of ["en", "fr"] as const) {
      const t = getWebAppDict(lang).workout;
      expect(trustLine([], t)).toBeNull();
      expect(trustLine(["move_points", "trust_reduced"], t)).toBe(t.trustReduced);
      expect(trustLine(["trust_held", "move_trust"], t)).toBe(t.trustHeld);
      expect(trustLine(["trust_cleared"], t)).toBe(t.trustCleared);
      expect(trustLine(["indoor_steps", "move_indoor_budget"], t)).toBe(t.indoorBudget);
      for (const l of [t.trustReduced, t.trustHeld, t.trustDuplicate, t.trustReview])
        expect(l.toLowerCase()).not.toMatch(/cheat|fraud|triche|fraude|suspect/);
    }
  });
});
