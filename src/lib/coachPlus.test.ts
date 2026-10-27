import { describe, expect, it } from "vitest";
import { getAccountDict } from "@/i18n/account";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { format } from "@/i18n/dictionaries";
import { getWebAppDict } from "@/i18n/webapp";
import { accountTier, coachPlusActive, coachTierName, ownPlanName, ownPlanTier } from "./coachPlus";

const NOW = Date.parse("2026-10-23T12:00:00Z");

describe("VVake Coach Plus on (Plus, Premium, early testers)", () => {
  it("plusUntil in the future is Plus, in the past is not, whatever the plan says", () => {
    expect(coachPlusActive({ plan: "plus", plusUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
    expect(coachPlusActive({ plan: "plus", plusUntil: "2026-10-01T00:00:00Z" }, NOW)).toBe(false);
    expect(coachPlusActive({ plan: "free", tier: "premium", plusUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe(true);
  });
  it("Premium (and 'pro' before the rename) and early testers are Plus", () => {
    expect(coachPlusActive({ tier: "premium" }, NOW)).toBe(true);
    expect(coachPlusActive({ tier: "pro" }, NOW)).toBe(true);
    expect(coachPlusActive({ plan: "premium" }, NOW)).toBe(true);
    expect(coachPlusActive({ earlyTester: true, plusUntil: "2026-10-01T00:00:00Z" }, NOW)).toBe(true);
  });
  it("free and unknown are not", () => {
    expect(coachPlusActive({ plan: "free" }, NOW)).toBe(false);
    expect(coachPlusActive({}, NOW)).toBe(false);
    expect(coachPlusActive(null, NOW)).toBe(false);
  });
});

describe("plan names follow the account's plan (founder 2026-10-27)", () => {
  it("coachTierName mirrors game-core: brand names in both languages, Free translated, pro = Premium", () => {
    expect(coachTierName("premium")).toBe("VVake Coach Premium");
    expect(coachTierName("pro", "fr")).toBe("VVake Coach Premium");
    expect(coachTierName("premium", "fr", "short")).toBe("Coach Premium");
    expect(coachTierName("plus", "en", "short")).toBe("Coach Plus");
    expect(coachTierName("plus", "fr")).toBe("VVake Coach Plus");
    expect(coachTierName("free", "fr")).toBe("Gratuit");
    expect(coachTierName("nope")).toBe("Free");
    expect(ownPlanTier("pro")).toBe("premium");
    expect(ownPlanTier("free")).toBe("plus");
    expect(ownPlanTier(undefined)).toBe("plus");
  });

  it("accountTier: Premium for premium, pro and early testers; Plus for plus or Plus by date; else free", () => {
    expect(accountTier({ tier: "premium" }, NOW)).toBe("premium");
    expect(accountTier({ tier: "pro", plan: "plus" }, NOW)).toBe("premium");
    expect(accountTier({ earlyTester: true, plan: "plus" }, NOW)).toBe("premium");
    expect(accountTier({ earlyTester: true, tier: "plus" }, NOW)).toBe("premium");
    expect(accountTier({ tier: "plus" }, NOW)).toBe("plus");
    expect(accountTier({ plusUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe("plus");
    expect(accountTier({ plan: "free" }, NOW)).toBe("free");
    expect(accountTier(null, NOW)).toBe("free");
  });

  it("ownPlanName: a tester or Premium account reads Premium, a Plus or free account reads Plus", () => {
    expect(ownPlanName({ earlyTester: true }, "name", NOW)).toBe("VVake Coach Premium");
    expect(ownPlanName({ tier: "premium" }, "short", NOW)).toBe("Coach Premium");
    expect(ownPlanName({ tier: "plus" }, "name", NOW)).toBe("VVake Coach Plus");
    expect(ownPlanName({ plan: "free" }, "name", NOW)).toBe("VVake Coach Plus");
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("(%s) every line about your own plan takes {plan}, and a tester's reads Premium only", (lang, dict) => {
    const a = getAccountDict(lang);
    const w = getWebAppDict(lang);
    const lines = [
      a.plusSection.lead,
      a.plusSection.manage,
      a.data.deleteNote,
      ...a.data.stayItems.filter((x) => x.includes("{plan}")),
      w.onboarding.vvaker.lead,
      w.coach.voiceNote,
      w.you.settingsDetail,
      w.you.sourcesPlus,
      dict.plusPay.account.kicker,
      dict.plusPay.account.title,
      dict.plusPay.account.active,
    ];
    expect(a.data.stayItems.some((x) => x.includes("{plan}"))).toBe(true);
    const plan = ownPlanName({ earlyTester: true }, "name", NOW);
    for (const line of lines) {
      expect(line).toContain("{plan}");
      const out = format(line, { plan, date: "1 Nov" });
      expect(out).toContain("VVake Coach Premium");
      expect(out).not.toContain("Coach Plus");
    }
  });
});
