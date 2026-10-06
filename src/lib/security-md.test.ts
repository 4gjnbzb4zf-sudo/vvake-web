import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { rewardsConfig } from "./rewards-config";

const md = readFileSync(join(__dirname, "..", "..", "SECURITY.md"), "utf8");

/**
 * Hosts SECURITY.md may name. Only registered, controlled ones: a domain listed as "official" but not registered is
 * a gift to phishers (VV-02). Add a domain here only once it is registered, auto-renewing and pointed at vvake.com.
 */
const ALLOWED_HOSTS = new Set([
  "vvake.com",
  new URL(siteConfig.apiUrl).host, // vvake-api.simon-54e.workers.dev
  new URL(rewardsConfig.chain.explorerUrl).host,
  "github.com",
]);

describe("VV-02 SECURITY.md", () => {
  it("VV-02 names no domain outside the allow-list (vvake.fr / vvake.app are not registered)", () => {
    const hosts = [...md.matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|fr|app|io|dev|net|org|xyz|fun|fit|co|ai|eu|me|gg|so))\b/gi)].map((m) =>
      m[1]!.toLowerCase(),
    );
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.filter((h) => !ALLOWED_HOSTS.has(h))).toEqual([]);
  });

  it("VV-02 lists the only API host and the three contract addresses from rewards-config.ts", () => {
    expect(md).toContain(siteConfig.apiUrl);
    for (const a of [rewardsConfig.rewardsContract, rewardsConfig.prizePool, rewardsConfig.token]) expect(md).toContain(a);
  });

  it("VV-02 the security contact works: no @vvake.com mailbox (no MX yet), a private GitHub advisory link instead", () => {
    expect(md).not.toMatch(/[a-z0-9._-]+@vvake\.com/i);
    expect(md).toContain("https://github.com/4gjnbzb4zf-sudo/vvake-web/security/advisories/new");
  });
});
