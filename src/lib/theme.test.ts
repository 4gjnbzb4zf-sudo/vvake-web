import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("keeps an explicit choice", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });
  it("defaults to dark when nothing valid is saved", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme("sepia")).toBe("dark");
  });
});
