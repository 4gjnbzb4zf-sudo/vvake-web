import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isMomentKind, MOMENT_CAST, MOMENT_KINDS, momentOgPath, momentUrl, ordinal, readCityRank } from "./moments";
import { parseReferralCode } from "./referralLink";

const BANNED = /token|crypto|wallet|portefeuille|prize|\bprix\b|jeton|reward|récompense|\bearn|\bgagne|\bwin\b|lottery|\$VVAKE/i;

describe("moment share pages", () => {
  it("builds the link the app shares, with the invite code in the hash", () => {
    expect(momentUrl("https://vvake.com/", "en", "move")).toBe("https://vvake.com/en/m/move/");
    const url = momentUrl("https://vvake.com", "fr", "ghost", "abcd2345");
    expect(url).toBe("https://vvake.com/fr/m/ghost/#ABCD2345");
    expect(parseReferralCode(new URL(url).hash)).toBe("ABCD2345");
    expect(momentOgPath("fr", "vvaker")).toBe("/og/fr-m-vvaker.png");
  });

  it("knows its kinds, each with a cast duo that exists", () => {
    expect(MOMENT_KINDS).toEqual(["move", "ghost", "trophy", "vvaker", "week", "challenge", "city"]);
    expect(isMomentKind("ghost")).toBe(true);
    expect(isMomentKind("r")).toBe(false);
    for (const kind of MOMENT_KINDS)
      for (const id of MOMENT_CAST[kind]) expect(existsSync(join(process.cwd(), "public", "personas", `${id}.webp`)), id).toBe(true);
  });

  it("has fun, safe copy for every kind in English and French", () => {
    for (const locale of locales) {
      const m = getDictionary(locale).moments;
      for (const kind of MOMENT_KINDS) {
        const k = m.kinds[kind];
        for (const text of Object.values(k)) {
          expect(text.length, text).toBeGreaterThan(0);
          expect(BANNED.test(text), text).toBe(false);
          expect(/\d/.test(text), `no numbers: ${text}`).toBe(false);
        }
        expect(k.ogTitle.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("shows a city rank only for a known city and a plausible rank", () => {
    expect(readCityRank("?city=montreal&rank=3")).toEqual({ city: "Montréal", rank: 3 });
    expect(readCityRank("?city=MONTREAL&rank=12")).toEqual({ city: "Montréal", rank: 12 });
    expect(readCityRank("?city=atlantis&rank=3")).toBeNull();
    expect(readCityRank("?city=montreal&rank=0")).toBeNull();
    expect(readCityRank("?city=montreal&rank=1000")).toBeNull();
    expect(readCityRank("?city=montreal&rank=2.5")).toBeNull();
    expect(readCityRank("")).toBeNull();
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map((n) => ordinal(n, "en"))).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
      "111th",
    ]);
    expect([1, 2, 3].map((n) => ordinal(n, "fr"))).toEqual(["1er", "2e", "3e"]);
  });

  it("keeps the page copy free of money words in both languages", () => {
    for (const locale of locales) {
      const m = getDictionary(locale).moments;
      for (const text of [m.about, ...Object.values(m.page).flat()]) expect(BANNED.test(text), text).toBe(false);
    }
  });
});
