import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("keeps an explicit choice over the OS setting", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
  it("follows the OS when nothing valid is saved", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme("sepia", false)).toBe("dark");
  });
});
