/**
 * Writes out/_headers for the Cloudflare deploy (docs/cloudflare-hosting.md): real security headers, each page's CSP
 * with frame-ancestors 'none', and the app-site-association content type (src/lib/cloudflareHeaders.ts). Run after
 * `npm run build` (which writes the meta CSPs); `npm run deploy:cloudflare` does both. GitHub Pages ignores the file.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildHeaders, headersProblems } from "../src/lib/cloudflareHeaders";

const OUT = join(process.cwd(), "out");

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

const pages = htmlFiles(OUT).map((p) => ({ file: relative(OUT, p), html: readFileSync(p, "utf8") }));
if (!pages.length) {
  console.error("cloudflare-headers: no HTML files in out/ (run npm run build first)");
  process.exit(1);
}
const text = buildHeaders(pages);
const problems = headersProblems(text);
if (problems.length) {
  console.error(`cloudflare-headers:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
writeFileSync(join(OUT, "_headers"), text);
console.log(`cloudflare-headers: out/_headers written (${text.split("\n").filter((l) => l.startsWith("/")).length} rules)`);
