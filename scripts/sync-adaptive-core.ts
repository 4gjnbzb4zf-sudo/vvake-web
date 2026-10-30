/**
 * Adaptive coaching on the web (VVFit ADR-0069, docs/05-tech/adaptive-coaching.md, build 62): game-core's athlete model
 * (athleteModel.ts), progress to goals (goalProgress.ts), insight proposals (adaptiveProposals.ts) and the adaptive
 * session engine (adaptiveSession.ts) are copied here unchanged, with hr.ts (zones from beats) and one cut
 * (feasibility.ts's eventLadder). The browser runs the session engine itself during a planned GPS workout; the model,
 * the goals' progress and the proposals are computed by the API (GET /v1/athlete/progress) and only drawn here, the
 * copies give their types and words.
 *
 * adaptiveProposals.ts imports two types from seasonWeek.ts (1,100 lines the web doesn't carry): they come from
 * seasonWeekTypes.ts, a hand-written subset (the fields loadEdits reads and the two edits it makes); the type checker
 * tells when it falls behind.
 *
 * Checked by the golden structures, timelines, words heard and target statuses the watches replay
 * (adaptive-session-golden.json, in src/lib/webapp/adaptive/parity.test.ts). Same method as sync-living-core.ts.
 *
 *   tsx scripts/sync-adaptive-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-adaptive-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
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
const out = join(process.cwd(), "src", "lib", "webapp", "adaptive");
mkdirSync(out, { recursive: true });

/** Where the copies' game-core imports come from on the web. */
const SHARED: Record<string, string> = {
  "./hr.js": "./hr",
  "./adaptiveSession.js": "./adaptiveSession",
  "./athleteModel.js": "./athleteModel",
  "./goalProgress.js": "./goalProgress",
  "./feasibility.js": "./feasibilityCore",
  "./seasonWeek.js": "./seasonWeekTypes",
  "./seasonGoals.js": "../living/seasonGoals",
  "./sportCatalog.js": "../living/sportCatalog",
  "./suggest.js": "../suggest/suggest",
};
const WHOLE = ["hr.ts", "adaptiveSession.ts", "athleteModel.ts", "goalProgress.ts", "adaptiveProposals.ts"];
/** Single helpers cut from bigger game-core files, with the imports they need on the web. */
const CUTS: { file: string; to: string; names: string[]; prelude: string }[] = [
  {
    file: "feasibility.ts",
    to: "feasibilityCore.ts",
    names: ["eventLadder"],
    prelude: 'import { EVENT_PRESETS, type EventKind } from "../living/seasonGoals";\n\n',
  },
];
const GOLDEN = {
  from: join(core, "test", "fixtures", "adaptive-session-golden.json"),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", "adaptive-session-golden.json"),
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
  /^\/\/ (?:Copied|Cut) from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-adaptive-core\.ts\. Do not edit: re-sync\.\n/;

let differs = 0;
async function put(target: string, header: string, source: string) {
  const body = await prettier.format(source, { ...((await prettier.resolveConfig(target)) ?? {}), filepath: target });
  if (check) {
    let have = "";
    try {
      have = readFileSync(target, "utf8");
    } catch {
      // missing: differs
    }
    if (have.replace(headerRe, "") !== body) {
      differs++;
      console.error(`✗ ${target} differs from ${core}`);
    }
  } else writeFileSync(target, `${header}\n${body}`);
}

function cut(file: string, names: string[]): string {
  const lines = readFileSync(join(core, "src", file), "utf8").split("\n");
  return names
    .map((n) => {
      const start = lines.findIndex((l) => new RegExp(`^(export )?(const|function) ${n}\\b`).test(l));
      if (start < 0) throw new Error(`${n} not found in ${file}`);
      const end = lines[start]!.trimEnd().endsWith(";") ? start : lines.findIndex((l, i) => i > start && l === "}");
      let from = start;
      if (lines[start - 1]?.trim().endsWith("*/")) {
        from = start - 1;
        while (from > 0 && !lines[from]!.trim().startsWith("/**")) from--;
      }
      return lines.slice(from, end + 1).join("\n");
    })
    .join("\n\n");
}

async function main() {
  const revs: string[] = [];
  for (const f of WHOLE) {
    let src = readFileSync(join(core, "src", f), "utf8");
    for (const m of src.matchAll(/from '([^']+)'/g))
      if (SHARED[m[1]!] === undefined) throw new Error(`${f} imports ${m[1]}: add where the web takes it from`);
    for (const [from, to] of Object.entries(SHARED)) src = src.split(`from '${from}'`).join(`from '${to}'`);
    const rev = revOf(`src/${f}`);
    revs.push(`${f} ${rev}`);
    await put(
      join(out, f),
      `// Copied from VVFit packages/game-core/src/${f} (${rev}) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.`,
      src,
    );
  }
  for (const c of CUTS) {
    const rev = revOf(`src/${c.file}`);
    await put(
      join(out, c.to),
      `// Cut from VVFit packages/game-core/src/${c.file} (${rev}) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.`,
      c.prelude + cut(c.file, c.names) + "\n",
    );
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
      console.error("✗ adaptive-session-golden.json differs");
    }
  } else writeFileSync(GOLDEN.to, golden);

  if (check) {
    if (differs) process.exit(1);
    console.log(`adaptive: the copies match ${core}`);
  } else console.log(`adaptive: ${WHOLE.length} files, ${CUTS.length} cut and the session golden cases copied (${revs.join(", ")})`);
}

void main();
