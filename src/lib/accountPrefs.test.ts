import * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import { accountLangOffer, accountPrefsSchema } from "./accountPrefs";

describe("the account's language on vvake.com/rewards", () => {
  it("offers the account's language when it differs from the page's", () => {
    expect(accountLangOffer("en", { lang: "fr" })).toBe("fr");
    expect(accountLangOffer("fr", { lang: "en" })).toBe("en");
  });
  it("nothing to offer: same language, Phone default, none chosen or unknown", () => {
    expect(accountLangOffer("fr", { lang: "fr" })).toBeNull();
    expect(accountLangOffer("en", { lang: "system" })).toBeNull();
    expect(accountLangOffer("en", null)).toBeNull();
    expect(accountLangOffer("en", { lang: "de" })).toBeNull();
  });
  it("reads GET /v1/me loosely: no prefs, or malformed ones, never fail", () => {
    expect(z.parse(accountPrefsSchema, { id: "u", coach: {} }).prefs).toBeUndefined();
    expect(z.parse(accountPrefsSchema, { prefs: { lang: "fr", theme: "light" } }).prefs).toEqual({ lang: "fr", theme: "light" });
    expect(z.parse(accountPrefsSchema, { prefs: "nope" }).prefs).toBeNull();
    expect(z.parse(accountPrefsSchema, { prefs: { lang: 3 } }).prefs).toEqual({ lang: null });
  });
});
