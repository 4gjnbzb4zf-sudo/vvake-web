import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import data from "@/data/sports.json";
import { sportGroups, sports, sportsSchema } from "./sports";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = process.env.VVFIT_DIR
  ? resolve(process.env.VVFIT_DIR, "docs/05-tech/sports.json")
  : resolve(ROOT, "../VVFit/docs/05-tech/sports.json");

describe("sports export", () => {
  it("matches the schema and refuses a wrong count", () => {
    expect(sportsSchema.safeParse(data).success).toBe(true);
    expect(sportsSchema.safeParse({ ...data, count: data.count + 1 }).success).toBe(false);
  });

  it("has every Apple Fitness workout and unique ids", () => {
    expect(sports.count).toBeGreaterThanOrEqual(80);
    expect(new Set(sports.sports.map((s) => s.key)).size).toBe(sports.count);
    for (const k of ["run", "swim", "skate", "tennis", "climbing"]) expect(sports.sports.some((s) => s.key === k)).toBe(true);
  });

  it("groups every sport once, in a known category, in both languages", () => {
    for (const lang of ["en", "fr"] as const) {
      const groups = sportGroups(lang);
      expect(groups.flatMap((g) => g.names)).toHaveLength(sports.count);
      expect(groups.map((g) => g.key)).toEqual(sports.categories.map((c) => c.key).filter((k) => groups.some((g) => g.key === k)));
    }
    expect(sportGroups("fr").flatMap((g) => g.names)).toContain("Escalade");
  });
});

describe.skipIf(!existsSync(SOURCE))(`sports match the VVFit export (${SOURCE}; skipped when absent)`, () => {
  it("is an unedited copy of docs/05-tech/sports.json", () => {
    expect(data).toEqual(JSON.parse(readFileSync(SOURCE, "utf8")));
  });
});
