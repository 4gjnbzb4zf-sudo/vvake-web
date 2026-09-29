import { describe, expect, it } from "vitest";
import { VVAKER_SPORTS } from "@/components/vvaker/traits";
import { ANIMALS, CAST, castPersona, isCastPersona, SPORTS } from "./personaPrompt";

describe("cast bank", () => {
  it("has one cast member per sport, with the animal actually on the render", () => {
    for (const s of VVAKER_SPORTS) {
      expect(CAST[s], s).toBeDefined();
      expect(ANIMALS[CAST[s].animal].startsWith(SPORTS[s].animal), s).toBe(true);
    }
  });
  it("recognises a cast persona and a player's own mix", () => {
    const p = castPersona("racket", "Nova");
    expect(p.name).toBe("Nova");
    expect(isCastPersona(p)).toBe(true);
    expect(isCastPersona({ ...p, top: "hoodie" })).toBe(false);
    expect(isCastPersona({ ...castPersona("runner"), gear: [] })).toBe(false);
  });
});
