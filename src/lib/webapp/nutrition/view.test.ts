import { describe, expect, it } from "vitest";
import {
  addDays,
  addTerm,
  canShowNumbers,
  cleanTerm,
  gramsAt,
  groceryIcs,
  initialHave,
  mondayOf,
  nextPantry,
  numbersHidden,
  withTicks,
} from "./view";

const P = (o: Partial<{ hideNumbers: boolean; flagged: boolean; adult: boolean | null }>) => ({
  hideNumbers: false,
  flagged: false,
  adult: true as boolean | null,
  ...o,
});

describe("numbers", () => {
  it("shows numbers only for an adult who didn't hide them", () => {
    expect(numbersHidden(P({}))).toBe(false);
    expect(numbersHidden(P({ hideNumbers: true }))).toBe(true);
  });
  it("keeps numbers hidden in calm mode, under 18 and before the age question", () => {
    expect(numbersHidden(P({ flagged: true }))).toBe(true);
    expect(numbersHidden(P({ adult: false }))).toBe(true);
    expect(numbersHidden(P({ adult: null }))).toBe(true);
    expect(canShowNumbers(P({ flagged: true }))).toBe(false);
    expect(canShowNumbers(P({ adult: null }))).toBe(false);
    expect(canShowNumbers(P({ hideNumbers: true }))).toBe(true);
  });
});

describe("portions and days", () => {
  it("scales grams within 0.25×–3× and 1–2000 g", () => {
    expect(gramsAt(200, 1.5)).toBe(300);
    expect(gramsAt(200, 10)).toBe(600);
    expect(gramsAt(200, 0)).toBe(50);
    expect(gramsAt(1000, 3)).toBe(2000);
  });
  it("finds the Monday and adds days across months", () => {
    expect(mondayOf("2026-10-30")).toBe("2026-10-26");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
  it("cleans and adds free-text terms once", () => {
    expect(cleanTerm("  Cinnamon  Rolls ")).toBe("cinnamon rolls");
    expect(addTerm(["cinnamon"], "CINNAMON")).toEqual(["cinnamon"]);
    expect(addTerm([], "coriander")).toEqual(["coriander"]);
    expect(addTerm(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });
});

describe("grocery list", () => {
  const list = {
    dropped: 0,
    aisles: [
      {
        aisle: "produce" as const,
        items: [
          { name: "Spinach", qty: 200, unit: "g" as const, have: false, fromMeals: [] },
          { name: "Lemon", qty: 1, unit: "pc" as const, have: true, fromMeals: [] },
        ],
      },
    ],
  };
  it("starts from the pantry ticks and applies new ones", () => {
    const have = initialHave(list);
    expect([...have]).toEqual(["lemon"]);
    const next = withTicks(list, new Set(["spinach"]));
    expect(next.aisles[0]!.items.map((i) => i.have)).toEqual([true, false]);
  });
  it("remembers pantry items once, newest last, at most 60", () => {
    expect(nextPantry(["rice"], "Lemon", true)).toEqual(["rice", "lemon"]);
    expect(nextPantry(["rice", "lemon"], "lemon", false)).toEqual(["rice"]);
    expect(
      nextPantry(
        Array.from({ length: 60 }, (_, i) => `x${i}`),
        "y",
        true,
      ),
    ).toHaveLength(60);
  });
  it("makes an .ics for a future slot and refuses a past one", () => {
    const now = Date.UTC(2026, 9, 30, 12);
    const r = groceryIcs(
      { start: now + 3600_000, durationMin: 45 },
      { summary: "Groceries · VVake", note: "List:", list: "- Rice", nowMs: now, uid: "x1" },
    );
    expect("ics" in r && r.ics).toContain("DTSTART:20261030T130000Z");
    expect("ics" in r && r.ics).toContain("DTEND:20261030T134500Z");
    expect("ics" in r && r.ics).toContain("SUMMARY:Groceries · VVake");
    expect(groceryIcs({ start: now - 1, durationMin: 45 }, { summary: "s", note: "", list: "", nowMs: now, uid: "x" })).toEqual({
      fail: "past",
    });
  });
});
