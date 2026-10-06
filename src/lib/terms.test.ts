import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";

/** /[lang]/terms: the apps' health & safety disclaimer (version 1), in English and in French (vous). */
describe("health & safety page", () => {
  const en = getDictionary("en");
  const fr = getDictionary("fr");

  it("has the same sections in both languages", () => {
    expect(fr.terms.sections.map((s) => s.id)).toEqual(en.terms.sections.map((s) => s.id));
    expect(fr.terms.short).toHaveLength(en.terms.short.length);
  });

  it("says what the apps say: not medical advice, suggestions, data can be wrong, you decide, stop, doctor, outside, 13", () => {
    const all = [...en.terms.short, ...en.terms.sections.map((s) => s.p)].join(" ");
    for (const must of [
      /not a medical device/,
      /medical advice/,
      /written by AI/,
      /suggestions/,
      /inaccurate/,
      /responsible for your own/,
      /emergency/,
      /doctor/,
      /traffic/,
      /headphones/,
      /under 13/,
    ]) {
      expect(all).toMatch(must);
    }
  });

  it("speaks to the reader as vous in French (a legal page)", () => {
    const all = [...fr.terms.short, ...fr.terms.sections.map((s) => s.p), fr.terms.accept].join(" ");
    expect(all).toMatch(/\bvous\b/);
    expect(all).not.toMatch(/(?<!\p{L})(tu|ton|ta|tes|toi|te)(?!\p{L})/u);
  });

  it("names only the VVake team", () => {
    const all = JSON.stringify([en.terms, fr.terms]);
    expect(all).toMatch(/the VVake team/);
    expect(all).not.toMatch(/@|\b(inc|llc|ltd|sas|sarl)\b/i);
  });

  it("is linked from the footer, the privacy policy and the rewards page", () => {
    for (const d of [en, fr]) {
      expect(d.footer.safety).toBeTruthy();
      expect(d.privacy.safetyLink).toBeTruthy();
      expect(d.rewards.health).toMatch(/effort/);
    }
  });
});
