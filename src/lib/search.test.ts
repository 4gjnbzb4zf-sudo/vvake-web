import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import { hasExactMatch, normalizeText, searchByName } from "./search";

const cities = [...CITIES.values()];

describe("city search", () => {
  it("ignores case and accents", () => {
    expect(normalizeText("  Québec City ")).toBe("quebec city");
    expect(searchByName(cities, "quebec")[0]?.slug).toBe("quebec-city");
    expect(searchByName(cities, "MONTREAL")[0]?.slug).toBe("montreal");
  });
  it("ranks prefixes, then word starts, then substrings", () => {
    const r = searchByName(cities, "saint").map((c) => c.slug);
    expect(r[0]).toBe("saint-etienne");
    expect(searchByName(cities, "bay").map((c) => c.slug)).toContain("green-bay");
    expect(searchByName(cities, "")).toEqual([]);
    expect(searchByName(cities, "o", 3)).toHaveLength(3);
  });
  it("detects exact matches so a request option only appears for new cities", () => {
    expect(hasExactMatch(cities, "montréal")).toBe(true);
    expect(hasExactMatch(cities, "Grenoble")).toBe(false);
  });
});
