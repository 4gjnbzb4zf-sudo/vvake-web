/**
 * Quiet and next steps on the web (VVFit ADR-0062 §4): game-core's suggest.ts (the three levels, suggestAllowed: nothing
 * during a workout, quiet keeps only celebrations, newest-wins prefs) and nextStep.ts (the next-step engine: the step
 * catalogue, the learning ledger, merge) are copied here unchanged, so the browser holds back and offers exactly what
 * the phone, the watches and the server do. Checked by the golden cases the watches check (suggest-golden.json, in
 * src/lib/webapp/suggest/parity.test.ts) and by game-core's own nextStep tests, copied with the engine
 * (nextStep.core.test.ts). Same method as sync-tailor-core.ts.
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

interface Copy {
  /** Path inside packages/game-core. */
  from: string;
  /** File name in src/lib/webapp/suggest. */
  to: string;
  /** game-core imports the copy may make, and where the web takes them from. */
  imports: Record<string, string>;
}
const FILES: Copy[] = [
  { from: "src/suggest.ts", to: "suggest.ts", imports: {} },
  { from: "src/nextStep.ts", to: "nextStep.ts", imports: { "./tailor.js": "../tailor/tailor", "./suggest.js": "./suggest" } },
  { from: "test/nextStep.test.ts", to: "nextStep.core.test.ts", imports: { vitest: "vitest", "../src/nextStep": "./nextStep" } },
];
const GOLDEN = {
  from: join(core, "test", "fixtures", "suggest-golden.json"),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", "suggest-golden.json"),
};

const revOf = (path: string) => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", path], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
};

/** The header line names the source; the revision is left out of the comparison (only the code counts). */
const headerRe =
  /^\/\/ Copied from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-suggest-core\.ts\. Do not edit: re-sync\.\n/;

async function main() {
  let differs = 0;
  const revs: string[] = [];
  for (const f of FILES) {
    let src = readFileSync(join(core, f.from), "utf8");
    for (const m of src.matchAll(/from '([^']+)'/g))
      if (f.imports[m[1]!] === undefined) throw new Error(`${f.from} imports ${m[1]}: add where the web takes it from to imports`);
    for (const [from, to] of Object.entries(f.imports)) src = src.split(`from '${from}'`).join(`from '${to}'`);
    const target = join(out, f.to);
    const body = await prettier.format(src, { ...((await prettier.resolveConfig(target)) ?? {}), filepath: target });
    const rev = revOf(f.from);
    revs.push(`${f.from} ${rev}`);
    const text = `// Copied from VVFit packages/game-core/${f.from} (${rev}) by scripts/sync-suggest-core.ts. Do not edit: re-sync.\n${body}`;
    if (check) {
      let have = "";
      try {
        have = readFileSync(target, "utf8");
      } catch {
        // missing: differs
      }
      if (have.replace(headerRe, "") !== body) {
        differs++;
        console.error(`✗ ${f.to} differs from ${core}/${f.from}`);
      }
    } else writeFileSync(target, text);
  }

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
    console.log(`suggest: the copies match ${core} (${revs.join(", ")})`);
  } else console.log(`suggest: ${FILES.map((f) => f.to).join(", ")} and the golden cases copied (${revs.join(", ")})`);
}

void main();
