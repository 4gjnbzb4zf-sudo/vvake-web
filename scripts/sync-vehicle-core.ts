/**
 * The vehicle guard, Start workouts for me and the watch takeover summary on the web (VVFit build 58, ADR-0064):
 * game-core's vehicleGuard.ts (a foot workout in a car, bus or train: paused from where it began, mostly-vehicle →
 * "Not counted: vehicle detected"), autoStart.ts (the off / ask / auto modes and newest-wins prefs.autoStart, shown on
 * vvake.com/account), handover.ts (the parts of one workout as one summary) and, from build 59 (ADR-0065), autoPause.ts
 * (auto-pause / auto-resume per sport, prefs.autoPause) are copied here unchanged, so the browser judges exactly as the
 * phone, the watches and the server do. Checked by the golden cases the watches check (vehicle-golden.json and
 * auto-pause-golden.json, in src/lib/webapp/vehicle/parity.test.ts and autoPauseParity.test.ts). Same method as
 * sync-suggest-core.ts.
 *
 *   tsx scripts/sync-vehicle-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-vehicle-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
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
const out = join(process.cwd(), "src", "lib", "webapp", "vehicle");

interface Copy {
  /** Path inside packages/game-core. */
  from: string;
  /** File name in src/lib/webapp/vehicle. */
  to: string;
  /** game-core imports the copy may make, and where the web takes them from. */
  imports: Record<string, string>;
}
const FILES: Copy[] = [
  { from: "src/vehicleGuard.ts", to: "vehicleGuard.ts", imports: {} },
  { from: "src/autoStart.ts", to: "autoStart.ts", imports: { "./vehicleGuard.js": "./vehicleGuard" } },
  { from: "src/handover.ts", to: "handover.ts", imports: {} },
  // Auto-pause and auto-resume (build 59, ADR-0065): the per-sport modes, newest-wins prefs.autoPause and the stop/go machine.
  { from: "src/autoPause.ts", to: "autoPause.ts", imports: {} },
];
const GOLDENS = ["vehicle-golden.json", "auto-pause-golden.json"].map((name) => ({
  name,
  from: join(core, "test", "fixtures", name),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", name),
}));

const revOf = (path: string) => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", path], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
};

/** The header line names the source; the revision is left out of the comparison (only the code counts). */
const headerRe =
  /^\/\/ Copied from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-vehicle-core\.ts\. Do not edit: re-sync\.\n/;

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
    const text = `// Copied from VVFit packages/game-core/${f.from} (${rev}) by scripts/sync-vehicle-core.ts. Do not edit: re-sync.\n${body}`;
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

  for (const g of GOLDENS) {
    const golden = readFileSync(g.from, "utf8");
    if (check) {
      let have = "";
      try {
        have = readFileSync(g.to, "utf8");
      } catch {
        // missing
      }
      if (have !== golden) {
        differs++;
        console.error(`✗ ${g.name} differs`);
      }
    } else writeFileSync(g.to, golden);
  }

  if (check) {
    if (differs) process.exit(1);
    console.log(`vehicle: the copies match ${core} (${revs.join(", ")})`);
  } else console.log(`vehicle: ${FILES.map((f) => f.to).join(", ")} and the golden cases copied (${revs.join(", ")})`);
}

void main();
