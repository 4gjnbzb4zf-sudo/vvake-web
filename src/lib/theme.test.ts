import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_SCRIPT, resolveTheme, themeChoice } from "./theme";

describe("resolveTheme", () => {
  it("keeps an explicit choice whatever the device says", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
  it("System (nothing valid saved): follows the device, dark when it says nothing", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme("sepia")).toBe("dark");
  });
  it("themeChoice: light, dark or system", () => {
    expect([themeChoice("light"), themeChoice("dark"), themeChoice(null), themeChoice("sepia")]).toEqual([
      "light",
      "dark",
      "system",
      "system",
    ]);
  });
});

describe("THEME_SCRIPT (inline, before first paint)", () => {
  const run = (saved: string | null, prefersLight: boolean) => {
    const dataset: Record<string, string> = {};
    const fn = new Function("localStorage", "window", "document", THEME_SCRIPT);
    fn(
      { getItem: () => saved },
      { matchMedia: (q: string) => ({ matches: q.includes("light") && prefersLight }) },
      { documentElement: { dataset } },
    );
    return dataset;
  };
  it("sets data-theme and data-theme-choice", () => {
    expect(run(null, true)).toEqual({ theme: "light", themeChoice: "system" });
    expect(run(null, false)).toEqual({ theme: "dark", themeChoice: "system" });
    expect(run("dark", true)).toEqual({ theme: "dark", themeChoice: "dark" });
    expect(run("light", false)).toEqual({ theme: "light", themeChoice: "light" });
  });
});

/** WCAG 2.x contrast of the theme tokens in globals.css (body text and the accent foregrounds). */
describe("theme tokens: WCAG AA (4.5:1) for text", () => {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
  const block = (sel: string) => {
    const m = new RegExp(`\\[data-theme="${sel}"\\] \\{([^}]*)\\}`).exec(css);
    if (!m) throw new Error(`no ${sel} block`);
    return Object.fromEntries([...m[1]!.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1]!, x[2]!]));
  };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  it.each(["dark", "light"])("%s: text, muted, faint and every *-fg accent on night, night-2 and surface", (sel) => {
    const t = block(sel);
    const fgs = ["text", "muted", "faint", ...Object.keys(t).filter((k) => k.endsWith("-fg"))];
    const fails: string[] = [];
    for (const fg of fgs)
      for (const bg of ["night", "night-2", "surface"]) {
        const r = contrast(t[fg]!, t[bg]!);
        if (r < 4.5) fails.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    expect(fails).toEqual([]);
    expect(contrast(t.text!, t.night!)).toBeGreaterThanOrEqual(7);
  });
});
