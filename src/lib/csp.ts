import { createHash } from "node:crypto";
import { siteConfig } from "../config/site";
import { rewardsConfig } from "./rewards-config";

/**
 * Content-Security-Policy for the static export (VV-12). GitHub Pages can't send headers, so the policy is a
 * <meta http-equiv> written into every exported HTML file after `next build` (scripts/csp.ts, run as `postbuild`).
 *
 * - script-src: 'self' (Next's chunks) plus the sha256 of each inline script actually present in that file (theme,
 *   404 redirect, Next's RSC payload pushes). No 'unsafe-inline', no 'unsafe-eval'.
 * - connect-src: 'self' plus exactly the origins the code fetches (VVake API, public chain RPC, waitlist / live
 *   endpoints when this build has them). Fonts come from next/font, self-hosted under /_next/static/media.
 * - Cloudflare Turnstile (waitlist bot check) only when this build has a site key.
 * - style-src keeps 'unsafe-inline' (React style attributes); no script can run from a style.
 * - frame-ancestors can't be set from a meta tag: framing is handled by the frame guard (src/lib/frameGuard.ts).
 *
 * Server-only (node:crypto): imported by the build script and tests, never by a page.
 */

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const origin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export interface CspConfig {
  apiUrl: string;
  rpcUrl: string;
  waitlistEndpoint: string;
  liveEndpoint: string;
  turnstileSiteKey: string;
}

export const buildConfig = (): CspConfig => ({
  apiUrl: siteConfig.apiUrl,
  rpcUrl: rewardsConfig.chain.rpcUrl,
  waitlistEndpoint: siteConfig.waitlistEndpoint,
  liveEndpoint: siteConfig.liveEndpoint,
  turnstileSiteKey: siteConfig.turnstileSiteKey,
});

/** Every origin the site's code fetches from, for this build's configuration. */
export function connectOrigins(cfg: CspConfig = buildConfig()): string[] {
  const all = [cfg.apiUrl, cfg.rpcUrl, cfg.waitlistEndpoint, cfg.liveEndpoint].map((u) => (u ? origin(u) : null));
  return [...new Set(all.filter((o): o is string => Boolean(o)))];
}

export const scriptHash = (content: string) => `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;

const EXECUTABLE = new Set(["", "text/javascript", "application/javascript", "module", "text/ecmascript"]);

/** The inline <script> bodies a browser would run (no src, an executable type), exactly as written in the file. */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const attrs = m[1] ?? "";
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    if (!EXECUTABLE.has(type)) continue;
    out.push(m[2] ?? "");
  }
  return out;
}

export function buildCsp(hashes: string[], cfg: CspConfig = buildConfig()): string {
  const turnstile = cfg.turnstileSiteKey ? [TURNSTILE_ORIGIN] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", ...turnstile, ...[...new Set(hashes)].sort()]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...connectOrigins(cfg)]],
    ["frame-src", turnstile.length ? turnstile : ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
  ];
  return directives.map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*\/?>/i;

export const readCsp = (html: string) =>
  META.exec(html)?.[1]
    ?.replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"') ?? null;

export function parseCsp(policy: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name.toLowerCase()] = values;
  }
  return out;
}

/** Writes (or replaces) the CSP meta as the first element of <head>, before any script it governs. */
export function injectCsp(html: string, policy: string): string {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, "&quot;")}"/>`;
  const clean = html.replace(META, "");
  const head = /<head\b[^>]*>/i.exec(clean);
  if (!head) throw new Error("no <head> in exported HTML");
  const at = head.index + head[0].length;
  return clean.slice(0, at) + tag + clean.slice(at);
}

/** Adds this file's policy to an exported HTML file. */
export const withCsp = (html: string, cfg: CspConfig = buildConfig()) =>
  injectCsp(html, buildCsp(inlineScripts(html).map(scriptHash), cfg));

/** What a browser would block or what the policy misses in one exported HTML file; empty = fine. */
export function cspProblems(html: string, cfg: CspConfig = buildConfig()): string[] {
  const policy = readCsp(html);
  if (!policy) return ["no Content-Security-Policy meta"];
  const problems: string[] = [];
  const d = parseCsp(policy);
  const firstScript = html.search(/<script\b/i);
  const metaAt = html.search(META);
  if (firstScript >= 0 && metaAt > firstScript) problems.push("CSP meta comes after a script");
  const script = d["script-src"] ?? d["default-src"] ?? [];
  if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) problems.push("script-src allows unsafe-inline/eval");
  for (const body of inlineScripts(html)) {
    const h = scriptHash(body);
    if (!script.includes(h)) problems.push(`inline script not allowed by script-src: ${h} ${body.slice(0, 60)}`);
  }
  const connect = d["connect-src"] ?? [];
  for (const o of connectOrigins(cfg)) if (!connect.includes(o)) problems.push(`connect-src misses ${o}`);
  for (const [k, v] of [
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["form-action", "'self'"],
    ["default-src", "'self'"],
  ] as const)
    if (d[k]?.join(" ") !== v) problems.push(`${k} is not ${v}`);
  if (!(d["img-src"] ?? []).every((s) => s === "'self'" || s === "data:")) problems.push("img-src is wider than 'self' data:");
  // Inline event handlers and javascript: URLs would need 'unsafe-hashes'/'unsafe-inline': there must be none.
  const tags = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
  const handler = /<[a-z][^>]*\son[a-z]+\s*=/i.exec(tags);
  if (handler) problems.push(`inline event handler: ${handler[0].slice(0, 80)}`);
  if (/\b(?:href|src|action)\s*=\s*["']?\s*javascript:/i.test(tags)) problems.push("javascript: URL");
  return problems;
}
