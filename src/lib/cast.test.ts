import { describe, expect, it } from "vitest";
import { VVAKER_SPORTS } from "@/components/vvaker/traits";
import { ANIMALS, CAST, castPersona, isCastPersona, personaCode, personaFromCode, SPORTS } from "./personaPrompt";

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

describe("persona codes read back (VVaker ownership: the API's nearest free look is tried on the builder)", () => {
  it("personaFromCode is the inverse of personaCode and refuses what isn't a code", () => {
    const p = { ...castPersona("hiker", "Nova"), top: "puffer" as const, gear: ["towel" as const, "bottle" as const] };
    const code = personaCode(p, VVAKER_SPORTS);
    expect(personaFromCode(code.toLowerCase(), VVAKER_SPORTS, "Nova")).toEqual(p);
    expect(personaCode(personaFromCode(code, VVAKER_SPORTS)!, VVAKER_SPORTS)).toBe(code);
    expect(personaFromCode("VVP-nope", VVAKER_SPORTS)).toBeNull();
    expect(personaFromCode("VVP-zz0000-10-0", VVAKER_SPORTS)).toBeNull();
  });
});
