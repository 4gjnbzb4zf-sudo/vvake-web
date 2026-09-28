import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./negotiate";

const supported = ["en", "fr"];

describe("negotiateLocale", () => {
  it("respects the browser's order of preference", () => {
    expect(negotiateLocale(["de-DE", "fr-CA", "en"], supported, "en")).toBe("fr");
    expect(negotiateLocale(["en-GB", "fr"], supported, "en")).toBe("en");
    expect(negotiateLocale(["FR-be"], supported, "en")).toBe("fr");
  });
  it("falls back to English", () => {
    expect(negotiateLocale(["ja", "es"], supported, "en")).toBe("en");
    expect(negotiateLocale([], supported, "en")).toBe("en");
  });
});
