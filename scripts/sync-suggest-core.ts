/**
 * Quiet on the web (VVFit ADR-0062 §4.4): game-core's suggest.ts (the three levels, suggestAllowed: nothing during a
 * workout, quiet keeps only celebrations, newest-wins prefs) is copied here unchanged, so the browser holds back
 * exactly what the phone, the watches and the server hold back, with the golden cases the watches check
 * (suggest-golden.json, checked by src/lib/webapp/suggest/parity.test.ts). Same method as sync-tailor-core.ts.
 *
 *   tsx scripts/sync-suggest-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-suggest-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
 *
 * Run it again whenever those game-core files change; never edit the copies by hand.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as prettier from "prettier";

const args = process.argv.slice(2);
const check = args.includes("--check");
const core = resolve(args.find((a) => !a.startsWith("--")) ?? "../VVFit/packages/game-core");
const out = join(process.cwd(), "src", "lib", "webapp", "suggest");
const FILE = "suggest.ts";
/** game-core imports the copy may make, and where the web takes them from. */
const IMPORTS: Record<string, string> = {};
const GOLDEN = {
  from: join(core, "test", "fixtures", "suggest-golden.json"),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", "suggest-golden.json"),
};

const rev = (() => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", `src/${FILE}`], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

/** The header line names the source; the revision is left out of the comparison (only the code counts). */
const headerRe =
  /^\/\/ Copied from VVFit packages\/game-core\/src\/[\w.]+ \([^)]*\) by scripts\/sync-suggest-core\.ts\. Do not edit: re-sync\.\n/;

async function main() {
  let differs = 0;
  let src = readFileSync(join(core, "src", FILE), "utf8");
  for (const m of src.matchAll(/from '([^']+)'/g))
    if (!IMPORTS[m[1]!]) throw new Error(`${FILE} imports ${m[1]}: add where the web takes it from to IMPORTS`);
  for (const [from, to] of Object.entries(IMPORTS)) src = src.split(`from '${from}'`).join(`from '${to}'`);
  const target = join(out, FILE);
  const body = await prettier.format(src, { ...((await prettier.resolveConfig(target)) ?? {}), filepath: target });
  const text = `// Copied from VVFit packages/game-core/src/${FILE} (${rev}) by scripts/sync-suggest-core.ts. Do not edit: re-sync.\n${body}`;
  if (check) {
    let have = "";
    try {
      have = readFileSync(target, "utf8");
    } catch {
      // missing: differs
    }
    if (have.replace(headerRe, "") !== body) {
      differs++;
      console.error(`✗ ${FILE} differs from ${core}/src/${FILE}`);
    }
  } else writeFileSync(target, text);

  const golden = readFileSync(GOLDEN.from, "utf8");
  if (check) {
    let have = "";
    try {
      have = readFileSync(GOLDEN.to, "utf8");
    } catch {
      // missing
    }
    if (have !== golden) {
      differs++;
      console.error("✗ suggest-golden.json differs");
    }
  } else writeFileSync(GOLDEN.to, golden);

  if (check) {
    if (differs) process.exit(1);
    console.log(`suggest: the copy matches ${core} (${rev})`);
  } else console.log(`suggest: ${FILE} and the golden cases copied (${rev})`);
}

void main();
