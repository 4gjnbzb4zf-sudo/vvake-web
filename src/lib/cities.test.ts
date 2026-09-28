import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CITIES, CITY_SLUGS, RIVALRIES, rivalOf, thresholdFor } from "./cities";

describe("cities and rivalries", () => {
  it("has unique slugs and every rivalry references known cities of its country", () => {
    expect(new Set(CITY_SLUGS).size).toBe(CITY_SLUGS.length);
    for (const r of RIVALRIES) {
      for (const slug of r.cities) expect(CITIES.get(slug)?.country).toBe(r.country);
    }
  });

  it("gives every city exactly one rival, symmetrically", () => {
    for (const slug of CITY_SLUGS) {
      const rival = rivalOf(slug);
      expect(rival, slug).toBeDefined();
      expect(rivalOf(rival!.slug)?.slug).toBe(slug);
    }
  });

  it("has a story for every rivalry", () => {
    for (const r of RIVALRIES) expect(Object.keys(en.rivalries.stories)).toContain(r.id);
    expect(Object.keys(en.rivalries.stories)).toHaveLength(RIVALRIES.length);
  });

  it("computes launch thresholds within bounds", () => {
    expect(thresholdFor("paris")).toBe(5_000);
    expect(thresholdFor("green-bay")).toBe(300);
    expect(() => thresholdFor("atlantis")).toThrow();
  });
});
