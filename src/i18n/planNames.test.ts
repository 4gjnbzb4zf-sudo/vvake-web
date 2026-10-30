import { describe, expect, it } from "vitest";
import { planLine } from "@/components/plus/CoachPlans";
import { getDictionary } from "./dictionaries";
import { getAccountDict } from "./account";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { getSeasonDict } from "./season";
import { getSportZonesDict } from "./sportZones";
import { getTrainingsDict } from "./trainings";
import { getWebAppDict } from "./webapp";

/**
 * The plan names (2026-10-22): the paid plan is "VVake Coach Plus" ("Coach Plus" where space is tight) and the higher
 * tier is "VVake Coach Premium" ("Coach Premium" where space is tight). The old names never come back in user-facing copy, in either language.
 */
const OLD_NAMES = /Coach Pro\b|VVake Plus\b|VVake Fit Plus\b/;

const copy = {
  en: [en, getAccountDict("en"), getWebAppDict("en"), getTrainingsDict("en"), getSeasonDict("en"), getSportZonesDict("en")],
  fr: [fr, getAccountDict("fr"), getWebAppDict("fr"), getTrainingsDict("fr"), getSeasonDict("fr"), getSportZonesDict("fr")],
};

describe("plan names: VVake Coach Plus and VVake Coach Premium", () => {
  it.each(["en", "fr"] as const)("(%s) no old plan name in any dictionary", (lang) => {
    for (const d of copy[lang]) expect(JSON.stringify(d)).not.toMatch(OLD_NAMES);
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)(
    "(%s) the plans page names VVake Coach Plus and VVake Coach Premium in full, and says beta testers have Premium",
    (_lang, d) => {
      const plans = JSON.stringify(d.plusPay.plans);
      expect(plans).toContain("VVake Coach Plus");
      expect(plans).toContain("Coach Premium");
      expect(plans).toContain("VVake Coach Premium");
      expect(d.plusPay.plans.tiers.plus.name).toBe("VVake Coach Plus");
      expect(d.plusPay.plans.tiers.premium.name).toBe("VVake Coach Premium");
      expect(d.plusPay.plans.beta).toContain("VVake Coach Premium");
    },
  );

  it("no doubled name", () => {
    for (const d of [...copy.en, ...copy.fr]) expect(JSON.stringify(d)).not.toMatch(/Coach Coach|VVake Coach Coach/);
  });

  it.each(["en", "fr"] as const)("(%s) the account page's plan pills and the early tester badge", (lang) => {
    const s = getAccountDict(lang).plusSection;
    expect(s.tierPlus).toBe("Coach Plus");
    expect(s.tierPremium).toBe("Coach Premium");
    expect(s.earlyTester).toBe(lang === "en" ? "Early tester · VVake Coach Premium" : "Testeur pionnier · VVake Coach Premium");
    expect(s.previewOn).toContain("VVake Coach Premium");
    expect(s.previewOff).toContain("VVake Coach Premium");
  });
});

describe("plans page numbers (the API's defaults)", () => {
  it.each(["en", "fr"] as const)("(%s) live minutes, voice characters and calls per plan", (lang) => {
    const tiers = getDictionary(lang).plusPay.plans.tiers;
    const plus = tiers.plus.lines.map((l) => planLine(l, "plus", lang)).join(" | ");
    const premium = tiers.premium.lines.map((l) => planLine(l, "premium", lang)).join(" | ");
    expect(plus).not.toMatch(/\{\w+\}/);
    expect(premium).not.toMatch(/\{\w+\}/);
    expect(plus).toContain(lang === "en" ? "60 live coach minutes a month" : "60 minutes de coach en direct par mois");
    expect(premium).toContain(lang === "en" ? "120 live coach minutes a month" : "120 minutes de coach en direct par mois");
    expect(plus).toContain(lang === "en" ? "1,000 new characters a day" : "1 000 nouveaux caractères par jour");
    expect(premium).toContain(lang === "en" ? "2,000 new characters a day" : "2 000 nouveaux caractères par jour");
    expect(plus).toContain(lang === "en" ? "up to 3 a week" : "jusqu'à 3 par semaine");
    expect(premium).toContain(lang === "en" ? "up to 1 a day" : "jusqu'à 1 par jour");
  });
});
