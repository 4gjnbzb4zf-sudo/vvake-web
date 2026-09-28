import { describe, expect, it } from "vitest";
import { format } from "@/i18n/dictionaries";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { shade } from "./color";
import { readReferral, referralUrl, xShareUrl } from "./referral";

describe("referral", () => {
  it("reads only well-formed codes", () => {
    expect(readReferral("?ref=AB12cd34")).toBe("ab12cd34");
    expect(readReferral("?ref=../../x")).toBeUndefined();
    expect(readReferral("")).toBeUndefined();
  });
  it("builds share links", () => {
    expect(referralUrl("https://vvake.com", "fr", "ab12cd34", "lyon")).toBe("https://vvake.com/fr/?ref=ab12cd34&city=lyon");
    expect(xShareUrl("Lyon wakes", "https://vvake.com/fr/")).toContain("x.com/intent/post?text=Lyon+wakes");
  });
});

describe("format", () => {
  it("fills known placeholders and keeps unknown ones", () => {
    expect(format("You're #{rank} in {city}.", { rank: 7, city: "Lyon" })).toBe("You're #7 in Lyon.");
    expect(format("{missing}", {})).toBe("{missing}");
  });
});

describe("shade", () => {
  it("mixes toward white and black", () => {
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#ff3d6e", 0)).toBe("#ff3d6e");
    expect(() => shade("red", 0.2)).toThrow();
  });
});

describe("dictionaries", () => {
  function leaves(obj: unknown, path = ""): [string, unknown][] {
    if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
    return [[path, obj]];
  }
  it("French has the same keys as English and no empty strings", () => {
    const enKeys = leaves(en).map(([k]) => k);
    const frLeaves = leaves(fr);
    expect(frLeaves.map(([k]) => k)).toEqual(enKeys);
    for (const [k, v] of frLeaves) if (typeof v === "string") expect(v.trim(), k).not.toBe("");
  });
  it("keeps the same placeholders in both languages", () => {
    const placeholders = (s: unknown) => (typeof s === "string" ? (s.match(/\{\w+\}/g) ?? []).sort() : []);
    const frMap = new Map(leaves(fr));
    for (const [k, v] of leaves(en)) expect(placeholders(frMap.get(k)), k).toEqual(placeholders(v));
  });
});
