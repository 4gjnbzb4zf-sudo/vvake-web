import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isMomentKind, MOMENT_CAST, MOMENT_KINDS, momentOgPath, momentUrl } from "./moments";
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
    expect(MOMENT_KINDS).toEqual(["move", "ghost", "trophy", "vvaker", "week"]);
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
});
