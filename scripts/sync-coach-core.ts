/**
 * The coach's app actions on the web (VVFit ADR-0063, build 55): game-core's coachActions.ts (the catalog, the confirm
 * cards, the gate, the result lines, the honesty check, yes/no) and coachScreens.ts (the screens the coach may open,
 * which the catalog imports) are copied here unchanged, so the web shows the same cards and says the same truth as the
 * phone, the watches and the server. Checked by game-core's own coachActions tests, copied with them
 * (coachActions.core.test.ts). The catalog's other imports come from copies the web already holds (the camera
 * routines, the sport catalog, the streak pause). Same method as sync-suggest-core.ts. Build 60 (ADR-0068) adds
 * coachTalk.ts (talk modes), coachMemory.ts (what the coach remembers) and dataCorrections.ts (Health corrections);
 * coachTalk's plan tier type comes from coachPlans.ts beside the copies (the web's CoachTierKey).
 *
 *   tsx scripts/sync-coach-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-coach-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
 *
 * Run it again whenever those game-core files change; never edit the copies by hand.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as prettier from "prettier";

const args = process.argv.slice(2);
const check = args.includes("--check");
const core = resolve(args.find((a) => !a.startsWith("--")) ?? "../VVFit/packages/game-core");
const out = join(process.cwd(), "src", "lib", "webapp", "coach");
mkdirSync(out, { recursive: true });

interface Copy {
  /** Path inside packages/game-core. */
  from: string;
  /** File name in src/lib/webapp/coach. */
  to: string;
  /** game-core imports the copy may make, and where the web takes them from. */
  imports: Record<string, string>;
}
const FILES: Copy[] = [
  { from: "src/coachScreens.ts", to: "coachScreens.ts", imports: {} },
  {
    from: "src/coachActions.ts",
    to: "coachActions.ts",
    imports: {
      "./cameraSession.js": "../camera/cameraSession",
      "./coachScreens.js": "./coachScreens",
      "./sportCatalog.js": "../living/sportCatalog",
      "./streakCare.js": "../living/streakCare",
    },
  },
  // Super coach (build 60, ADR-0068): the talk modes, the coach's memory (You › Coach memory) and Health corrections.
  { from: "src/coachTalk.ts", to: "coachTalk.ts", imports: { "./coachPlans.js": "./coachPlans" } },
  { from: "src/coachMemory.ts", to: "coachMemory.ts", imports: {} },
  { from: "src/dataCorrections.ts", to: "dataCorrections.ts", imports: { "./coachActions.js": "./coachActions" } },
  {
    from: "test/coachActions.test.ts",
    to: "coachActions.core.test.ts",
    imports: { vitest: "vitest", "../src/coachActions.js": "./coachActions" },
  },
];

const revOf = (path: string) => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", path], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
};

/** The header line names the source; the revision is left out of the comparison (only the code counts). */
const headerRe =
  /^\/\/ Copied from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-coach-core\.ts\. Do not edit: re-sync\.\n/;

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
    const text = `// Copied from VVFit packages/game-core/${f.from} (${rev}) by scripts/sync-coach-core.ts. Do not edit: re-sync.\n${body}`;
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
  if (check) {
    if (differs) process.exit(1);
    console.log(`coach: the copies match ${core} (${revs.join(", ")})`);
  } else console.log(`coach: ${FILES.map((f) => f.to).join(", ")} copied (${revs.join(", ")})`);
}

void main();
