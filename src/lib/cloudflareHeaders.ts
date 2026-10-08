import { readCsp } from "./csp";

/**
 * The `_headers` file for serving out/ from Cloudflare Workers static assets (review WEB-SEC-01; see
 * docs/cloudflare-hosting.md). GitHub Pages can't send headers, so the site carries its CSP as a <meta> per HTML file
 * (src/lib/csp.ts) and guards /rewards with a script (src/lib/frameGuard.ts). On Cloudflare the same protections become
 * real response headers:
 *
 * - every response: HSTS, nosniff, a strict Referrer-Policy, a Permissions-Policy that turns off what the site never
 *   uses, X-Frame-Options DENY, and a baseline CSP (`frame-ancestors 'none'`, no plugins, no <base>). That baseline is
 *   what a 404 (the forwarding page for /c/, /r/, /claude/, /rewards) gets on top of its own meta CSP: the 404 page is
 *   served at any path, so no per-path rule can match it.
 * - each exported page: its own meta CSP (same hashes) plus `frame-ancestors 'none'`, so no page, wallet surfaces
 *   (/en/rewards/, /fr/rewards/) included, can be framed anywhere. Cloudflare joins two matching CSP headers with a
 *   comma, which browsers enforce as two policies; the baseline restricts nothing the page policy allows.
 * - /.well-known/apple-app-site-association: served as application/json (universal links).
 *
 * Cloudflare's limits: 100 rules, 2,000 characters a line. `headersProblems` checks both.
 */

export const FRAME_ANCESTORS = "frame-ancestors 'none'";

export const BASE_HEADERS: [string, string][] = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "accelerometer=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=()",
  ],
  ["X-Frame-Options", "DENY"],
  ["Content-Security-Policy", `${FRAME_ANCESTORS}; object-src 'none'; base-uri 'none'`],
];

export const AASA_PATH = "/.well-known/apple-app-site-association";

export const MAX_RULES = 100;
export const MAX_LINE = 2000;

/** out/-relative HTML file → the URL path Cloudflare serves it at (trailing-slash folders), or null for the 404s. */
export function pagePath(file: string): string | null {
  const f = file.replace(/\\/g, "/").replace(/^\/+/, "");
  if (f === "404.html" || f === "404/index.html" || f.startsWith("_not-found/")) return null;
  if (f === "index.html") return "/";
  if (f.endsWith("/index.html")) return `/${f.slice(0, -"index.html".length)}`;
  return null;
}

/** The `_headers` text for these exported HTML files ({ file: out/-relative path, html }). */
export function buildHeaders(pages: { file: string; html: string }[]): string {
  const lines: string[] = ["/*", ...BASE_HEADERS.map(([k, v]) => `  ${k}: ${v}`), "", AASA_PATH, "  Content-Type: application/json", ""];
  const rules = pages
    .map(({ file, html }) => ({ path: pagePath(file), csp: readCsp(html) }))
    .filter((r): r is { path: string; csp: string } => Boolean(r.path && r.csp))
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const { path, csp } of rules) lines.push(path, `  Content-Security-Policy: ${csp}; ${FRAME_ANCESTORS}`, "");
  return lines.join("\n");
}

/** What Cloudflare would reject or ignore in a `_headers` text; empty = fine. */
export function headersProblems(text: string): string[] {
  const problems: string[] = [];
  const rules = text.split("\n").filter((l) => l && !l.startsWith(" ")).length;
  if (rules > MAX_RULES) problems.push(`${rules} rules (Cloudflare allows ${MAX_RULES})`);
  for (const l of text.split("\n")) if (l.length > MAX_LINE) problems.push(`line over ${MAX_LINE} characters: ${l.slice(0, 60)}…`);
  return problems;
}
