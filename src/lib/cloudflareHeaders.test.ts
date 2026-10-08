import { describe, expect, it } from "vitest";
import { AASA_PATH, BASE_HEADERS, buildHeaders, headersProblems, MAX_LINE, pagePath } from "./cloudflareHeaders";
import { buildCsp, injectCsp, scriptHash } from "./csp";

const page = (script: string) =>
  injectCsp(`<html><head><script>${script}</script></head><body></body></html>`, buildCsp([scriptHash(script)]));

describe("Cloudflare _headers (WEB-SEC-01)", () => {
  it("maps exported files to the paths Cloudflare serves, and skips the 404 page", () => {
    expect(pagePath("index.html")).toBe("/");
    expect(pagePath("en/rewards/index.html")).toBe("/en/rewards/");
    expect(pagePath("fr/s/3/index.html")).toBe("/fr/s/3/");
    expect(pagePath("404.html")).toBeNull();
    expect(pagePath("404/index.html")).toBeNull();
    expect(pagePath("_not-found/index.html")).toBeNull();
  });

  it("sends the security headers on every path, frame-ancestors 'none' included", () => {
    const text = buildHeaders([]);
    expect(text.startsWith("/*\n")).toBe(true);
    const names = BASE_HEADERS.map(([k]) => k);
    for (const h of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
      "Content-Security-Policy",
    ])
      expect(names).toContain(h);
    expect(text).toContain("Content-Security-Policy: frame-ancestors 'none'");
    expect(text).toContain("max-age=31536000");
    // Passkeys (the rewards wallet), the clipboard and Web Share stay allowed: they are never listed.
    expect(text).not.toMatch(/publickey-credentials|clipboard|web-share/);
  });

  it("serves the app-site-association as JSON", () => {
    expect(buildHeaders([])).toContain(`${AASA_PATH}\n  Content-Type: application/json`);
  });

  it("gives each page its own meta CSP, hashes included, plus frame-ancestors 'none'", () => {
    const html = page("console.log(1)");
    const text = buildHeaders([
      { file: "en/rewards/index.html", html },
      { file: "404.html", html },
    ]);
    expect(text).toContain(
      `/en/rewards/\n  Content-Security-Policy: default-src 'self'; script-src 'self' ${scriptHash("console.log(1)")}`,
    );
    expect(text).toMatch(/form-action 'self'; frame-ancestors 'none'\n/);
    expect(text).not.toContain("/404");
    expect(headersProblems(text)).toEqual([]);
  });

  it("flags what Cloudflare would refuse: over 100 rules or a line over 2,000 characters", () => {
    const many = Array.from({ length: 101 }, (_, i) => `/p${i}/\n  X-A: b`).join("\n");
    expect(headersProblems(many)).toHaveLength(1);
    expect(headersProblems(`/*\n  X-A: ${"a".repeat(MAX_LINE)}`)).toHaveLength(1);
  });
});
