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
  ] as const)("(%s) no single-split claim, and the open book lists Plus 30% and launchpad 70/30", (_lang, d) => {
    expect(JSON.stringify(d)).not.toMatch(ONE_SPLIT);
    const [plus, launchpad] = d.openBook.sources;
    expect(plus!.split.map((s) => s.value)).toEqual([30]);
    expect(launchpad!.split.map((s) => s.value)).toEqual([70, 30]);
  });

  it("the tokenomics list says the same as the open book", () => {
    const items = (d: typeof en) => Object.fromEntries(d.rwa.token.tokenomics.items.map((i) => [i.label, i.value]));
    expect(items(en)["Prize pool"]).toBe("30% of net Plus revenue");
    expect(items(en)["Launchpad trading fees"]).toBe("70% season rewards · 30% reserve");
    expect(items(fr)["Cagnotte de prix"]).toBe("30 % des revenus nets de Plus");
    expect(items(fr)["Frais de trading du launchpad"]).toBe("70 % récompenses de saison · 30 % réserve");
  });
});
