import { describe, expect, it } from "vitest";
import { nutritionCopyIssues } from "@/lib/webapp/nutrition/nutrition";
import { getNutritionDict } from "./nutrition";

/** Every string of a dictionary, deep. */
const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("Nutrition words on the web (ADR-0070 rule 3)", () => {
  for (const lang of ["en", "fr"] as const)
    it(`never uses a shaming word (${lang})`, () => {
      const found = strings(getNutritionDict(lang)).flatMap((s) => nutritionCopyIssues(s, lang).map((w) => `${w}: ${s}`));
      expect(found).toEqual([]);
    });
  it("has the same keys in French as in English", () => {
    const keys = (v: unknown, p = ""): string[] =>
      v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => keys(x, `${p}.${k}`)) : [p];
    expect(keys(getNutritionDict("fr"))).toEqual(keys(getNutritionDict("en")));
  });
});
