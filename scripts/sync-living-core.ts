/**
 * The living app on the web (VVFit docs/02-product/living-app.md §6, §10, §14; docs/02-product/journey.md;
 * docs/05-tech/places-and-meetups.md): game-core's place notes (placeNotes.ts: the 3-tap note, its checks, the
 * aggregates), meetups (meetups.ts: the checks, "I'm here", the .ics file, the copy), and the journey's pieces the
 * browser runs itself (streakCare.ts: the pause and the weekly streak; comeback.ts; celebrations.ts; leagues.ts) are
 * copied here unchanged, with the game-core files they import (location, places, sportCatalog, vvaker, seasonGoals) and
 * two small cuts (calendar.ts's icsEscape/icsFold, habit.ts's QUIET_HOURS). The journey itself (journeyOf) is computed
 * by the API (GET /v1/journey) and only drawn here.
 *
 * Checked by game-core's own tests for place notes, meetups and leagues (copied as *.core.test.ts, reading the copies
 * through index.ts) and by the journey golden cases the watches and the API check (journey-golden.json: the weekly
 * streak, comeback stages and celebrations, in src/lib/webapp/living/parity.test.ts). Same method as
 * sync-suggest-core.ts.
 *
 *   tsx scripts/sync-living-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-living-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
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
const out = join(process.cwd(), "src", "lib", "webapp", "living");
mkdirSync(out, { recursive: true });

/** Where the copies' game-core imports come from on the web. */
const SHARED: Record<string, string> = {
  "./ugc.js": "../camera/ugc",
  "./suggest.js": "../suggest/suggest",
  "./voiceCommands.js": "../camera/voiceNormalize",
  "./calendar.js": "./icsCore",
  "./habit.js": "./quietHours",
};
/** game-core src files copied whole (each may import the others, or SHARED). */
const WHOLE = [
  "placeNotes.ts",
  "meetups.ts",
  "celebrations.ts",
  "leagues.ts",
  "streakCare.ts",
  "comeback.ts",
  "location.ts",
  "places.ts",
  "sportCatalog.ts",
  "vvaker.ts",
  "seasonGoals.ts",
];
const local = Object.fromEntries(WHOLE.map((f) => [`./${f.replace(/\.ts$/, ".js")}`, `./${f.replace(/\.ts$/, "")}`]));

interface Copy {
  from: string;
  to: string;
  imports: Record<string, string>;
}
const TEST_IMPORTS = { vitest: "vitest", "../src/index.js": "./index", "../src/location.js": "./location" };
const FILES: Copy[] = [
  ...WHOLE.map((f) => ({ from: `src/${f}`, to: f, imports: { ...local, ...SHARED } })),
  { from: "test/placeNotes.test.ts", to: "placeNotes.core.test.ts", imports: TEST_IMPORTS },
  { from: "test/meetups.test.ts", to: "meetups.core.test.ts", imports: TEST_IMPORTS },
  { from: "test/leagues.test.ts", to: "leagues.core.test.ts", imports: TEST_IMPORTS },
];
/** Single helpers cut from bigger game-core files whose other imports the web doesn't carry. */
const CUTS: { file: string; to: string; names: string[] }[] = [
  { file: "calendar.ts", to: "icsCore.ts", names: ["icsEscape", "icsFold"] },
  { file: "habit.ts", to: "quietHours.ts", names: ["QUIET_HOURS"] },
];
const GOLDEN = {
  from: join(core, "test", "fixtures", "journey-golden.json"),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", "journey-golden.json"),
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
  /^\/\/ (?:Copied|Cut) from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-living-core\.ts\. Do not edit: re-sync\.\n/;

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
      // A one-line constant, or a block up to its closing brace at column 0. The doc comment just above comes along.
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
  for (const f of FILES) {
    let src = readFileSync(join(core, f.from), "utf8");
    for (const m of src.matchAll(/from '([^']+)'/g))
      if (f.imports[m[1]!] === undefined) throw new Error(`${f.from} imports ${m[1]}: add where the web takes it from`);
    for (const [from, to] of Object.entries(f.imports)) src = src.split(`from '${from}'`).join(`from '${to}'`);
    const rev = revOf(f.from);
    revs.push(`${f.from} ${rev}`);
    await put(
      join(out, f.to),
      `// Copied from VVFit packages/game-core/${f.from} (${rev}) by scripts/sync-living-core.ts. Do not edit: re-sync.`,
      src,
    );
  }
  for (const c of CUTS) {
    const rev = revOf(`src/${c.file}`);
    await put(
      join(out, c.to),
      `// Cut from VVFit packages/game-core/src/${c.file} (${rev}) by scripts/sync-living-core.ts. Do not edit: re-sync.`,
      cut(c.file, c.names) + "\n",
    );
  }
  // The copied tests read game-core's index: here, the copies.
  const index = WHOLE.map((f) => `export * from "./${f.replace(/\.ts$/, "")}";`).join("\n") + "\n";
  const indexPath = join(out, "index.ts");
  const indexText = `// Written by scripts/sync-living-core.ts: the copies, as game-core's index exports them. Do not edit: re-sync.\n${await prettier.format(index, { ...((await prettier.resolveConfig(indexPath)) ?? {}), filepath: indexPath })}`;
  if (check) {
    let have = "";
    try {
      have = readFileSync(indexPath, "utf8");
    } catch {
      // missing
    }
    if (have !== indexText) {
      differs++;
      console.error("✗ living/index.ts differs");
    }
  } else writeFileSync(indexPath, indexText);

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
      console.error("✗ journey-golden.json differs");
    }
  } else writeFileSync(GOLDEN.to, golden);

  if (check) {
    if (differs) process.exit(1);
    console.log(`living: the copies match ${core}`);
  } else console.log(`living: ${FILES.length} files, ${CUTS.length} cuts and the journey golden cases copied (${revs[0]} …)`);
}

void main();
