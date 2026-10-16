import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";

/** One split per source (Plus revenue, launchpad trading fees): no copy may say one split covers every fee. */
const ONE_SPLIT =
  /every fee|one public split|our public split|public split:|where every fee|chaque frais passe|une seule répartition|notre répartition publique|où va chaque frais|comme tous les frais/i;

describe("fee splits: one split per source (EN and FR)", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("(%s) no single-split claim, and the open book lists Plus 30% and the launchpad 3% tax as 1.5/0.9/0.6", (_lang, d) => {
    expect(JSON.stringify(d)).not.toMatch(ONE_SPLIT);
    const [plus, launchpad] = d.openBook.sources;
    expect(plus!.split.map((s) => s.value)).toEqual([30]);
    expect(launchpad!.split.map((s) => s.value)).toEqual([1.5, 0.9, 0.6]);
    expect(launchpad!.total).toBe(3);
    expect(launchpad!.split.reduce((a, s) => a + s.value, 0)).toBeCloseTo(3);
  });

  it("the tokenomics list says the same as the open book", () => {
    const items = (d: typeof en) => Object.fromEntries(d.rwa.token.tokenomics.items.map((i) => [i.label, i.value]));
    expect(items(en)["Prize pool"]).toBe("15% of net Plus revenue");
    expect(items(en)["Launchpad trading fees"]).toBe(
      "3% per trade: 1.5% team (development, marketing, platforms) · 0.9% season rewards · 0.6% vibe/vibe",
    );
    expect(items(fr)["Cagnotte de prix"]).toBe("15 % des revenus nets de Plus");
    expect(items(fr)["Frais de trading du launchpad"]).toBe(
      "3 % par transaction : 1,5 % équipe (développement, marketing, plateformes) · 0,9 % récompenses de saison · 0,6 % vibe/vibe",
    );
  });

  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("(%s) no current-fact team lock or vesting claim, and the relaunch explains the claim over the airdrop", (_lang, d) => {
    const all = JSON.stringify(d);
    expect(all).not.toMatch(
      /locked (for )?12 months|vested over|locked and vested|bloqués? 12 mois|libérés? sur 3 ans,|libérés progressivement/i,
    );
    expect(d.rwa.token.relaunch.airdrop.body).toMatch(/Airdrop Board/);
  });
});
