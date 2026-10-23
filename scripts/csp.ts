/**
 * postbuild (VV-12): writes the Content-Security-Policy meta into every HTML file of out/, with the hashes of that
 * file's inline scripts, then checks every file (src/lib/csp.ts cspProblems) and fails the build on any problem.
 *
 *   tsx scripts/csp.ts           inject + verify
 *   tsx scripts/csp.ts --check   verify only (exit 1 if a file has no policy or the policy misses something)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { accountFile, buildConfig, cspProblems, MAP_ORIGIN, webAppFile, webAppMedia, webAppScript, withCsp } from "../src/lib/csp";

const OUT = join(process.cwd(), "out");

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

const checkOnly = process.argv.includes("--check");
const files = htmlFiles(OUT);
let bad = 0;
for (const file of files) {
  let html = readFileSync(file, "utf8");
  if (!checkOnly) {
    const app = webAppFile(relative(OUT, file));
    const media = app || accountFile(relative(OUT, file));
    html = withCsp(html, buildConfig(), app ? [MAP_ORIGIN] : [], media ? webAppMedia() : [], app ? webAppScript() : []);
    writeFileSync(file, html);
  }
  const problems = cspProblems(html);
  if (problems.length) {
    bad++;
    console.error(`✗ ${relative(OUT, file)}\n  ${problems.join("\n  ")}`);
  }
}
if (!files.length) {
  console.error("csp: no HTML files in out/ (run next build first)");
  process.exit(1);
}
console.log(`csp: ${files.length - bad}/${files.length} HTML files have a complete Content-Security-Policy`);
if (bad) process.exit(1);
