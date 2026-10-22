import { describe, expect, it } from "vitest";
import { getAccountDict } from "./account";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { getSeasonDict } from "./season";
import { getSportZonesDict } from "./sportZones";
import { getTrainingsDict } from "./trainings";
import { getWebAppDict } from "./webapp";

/**
 * The plan names (2026-10-22): the paid plan is "VVake Coach Plus" ("Coach Plus" where space is tight) and the higher
 * tier is "Coach Premium". The old names never come back in user-facing copy, in either language.
 */
const OLD_NAMES = /Coach Pro\b|VVake Plus\b|VVake Fit Plus\b/;

const copy = {
  en: [en, getAccountDict("en"), getWebAppDict("en"), getTrainingsDict("en"), getSeasonDict("en"), getSportZonesDict("en")],
  fr: [fr, getAccountDict("fr"), getWebAppDict("fr"), getTrainingsDict("fr"), getSeasonDict("fr"), getSportZonesDict("fr")],
};

describe("plan names: VVake Coach Plus and Coach Premium", () => {
  it.each(["en", "fr"] as const)("(%s) no old plan name in any dictionary", (lang) => {
    for (const d of copy[lang]) expect(JSON.stringify(d)).not.toMatch(OLD_NAMES);
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("(%s) the plans page names VVake Coach Plus and Coach Premium, and says beta testers have Premium", (_lang, d) => {
    const plans = JSON.stringify(d.plusPay.plans);
    expect(plans).toContain("VVake Coach Plus");
    expect(plans).toContain("Coach Premium");
    expect(d.plusPay.plans.tiers.plus.name).toBe("Coach Plus");
    expect(d.plusPay.plans.tiers.premium.name).toBe("Coach Premium");
    expect(d.plusPay.plans.beta).toContain("Coach Premium");
  });

  it("no doubled name", () => {
    for (const d of [...copy.en, ...copy.fr]) expect(JSON.stringify(d)).not.toMatch(/Coach Coach|VVake Coach Coach/);
  });

  it.each(["en", "fr"] as const)("(%s) the account page's plan pills and the early tester badge", (lang) => {
    const s = getAccountDict(lang).plusSection;
    expect(s.tierPlus).toBe("Coach Plus");
    expect(s.tierPremium).toBe("Coach Premium");
    expect(s.earlyTester).toBe(lang === "en" ? "Early tester · Coach Premium" : "Testeur pionnier · Coach Premium");
  });
});
