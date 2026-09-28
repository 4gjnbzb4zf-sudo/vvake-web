import { describe, expect, it } from "vitest";
import { DEFAULT_TRAITS } from "@/components/vvaker/traits";
import { encodeDna } from "./dna";

describe("encodeDna (shared vectors with @vvfit/game-core)", () => {
  it("matches the game-core encoding", () => {
    expect(encodeDna(DEFAULT_TRAITS, "night")).toBe("VV-000-0000-00-0");
    expect(
      encodeDna(
        { ...DEFAULT_TRAITS, color: "coral", sport: "cyclist", headgear: "helmet", eyes: "visor", accessory: "bib", bib: 42 },
        "cream",
      ),
    ).toBe("VV-603-4403-42-5");
  });
  it("adds the look suffix only for Athlete styles", () => {
    expect(encodeDna({ ...DEFAULT_TRAITS, look: "athlete-b" }, "night")).toBe("VV-000-0000-00-0-2");
  });
  it("adds style extras like game-core", () => {
    expect(
      encodeDna(
        {
          ...DEFAULT_TRAITS,
          hair: "mohawk",
          facial: "beard",
          tattoo: "ecg",
          piercing: "nose",
          scar: "brow",
          physique: "muscular",
          eyeColor: "green",
        },
        "night",
      ),
    ).toBe("VV-000-0000-00-0-04232133");
  });
  it("ignores the bib number unless a bib is worn", () => {
    expect(encodeDna({ ...DEFAULT_TRAITS, bib: 55 }, "night")).toBe("VV-000-0000-00-0");
  });
});
