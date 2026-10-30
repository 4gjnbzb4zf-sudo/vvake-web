/**
 * Nutrition on the web (VVFit ADR-0070, optional): game-core's nutrition files (the profile and its clean-up, allergen
 * and ingredient matching EN/FR, targets and the qualitative day status, the copy-safety words, estimates and scaling,
 * the local food table from USDA FoodData Central, our own meal templates and the grocery list, shopping slot, saving
 * tips and flyer links) are copied here unchanged, so the browser filters, words and scales exactly like the phone,
 * the watches and the server. Same method as sync-coach-core.ts; the meal kinds come from the coach catalog copy.
 * A file game-core doesn't have yet is skipped with a note (the nutrition files land one by one).
 *
 *   tsx scripts/sync-nutrition-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-nutrition-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
 *
 * Run it again whenever those game-core files change; never edit the copies by hand.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as prettier from "prettier";

const args = process.argv.slice(2);
const check = args.includes("--check");
const core = resolve(args.find((a) => !a.startsWith("--")) ?? "../VVFit/packages/game-core");
const out = join(process.cwd(), "src", "lib", "webapp", "nutrition");
mkdirSync(out, { recursive: true });

interface Copy {
  /** Path inside packages/game-core. */
  from: string;
  /** File name in src/lib/webapp/nutrition. */
  to: string;
  /** game-core imports the copy may make, and where the web takes them from. */
  imports: Record<string, string>;
}
const FILES: Copy[] = [
  { from: "src/nutrition.ts", to: "nutrition.ts", imports: { "./coachActions.js": "../coach/coachActions" } },
  { from: "src/nutritionFoods.ts", to: "nutritionFoods.ts", imports: { "./nutrition.js": "./nutrition" } },
  {
    from: "src/nutritionMeals.ts",
    to: "nutritionMeals.ts",
    imports: { "./nutrition.js": "./nutrition", "./nutritionFoods.js": "./nutritionFoods", "./coachActions.js": "../coach/coachActions" },
  },
  {
    from: "src/nutritionGrocery.ts",
    to: "nutritionGrocery.ts",
    imports: {
      "./nutrition.js": "./nutrition",
      "./nutritionFoods.js": "./nutritionFoods",
      "./nutritionMeals.js": "./nutritionMeals",
      "./coachActions.js": "../coach/coachActions",
    },
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
  /^\/\/ Copied from VVFit packages\/game-core\/(?:src|test)\/[\w.]+ \([^)]*\) by scripts\/sync-nutrition-core\.ts\. Do not edit: re-sync\.\n/;

async function main() {
  let differs = 0;
  const revs: string[] = [];
  for (const f of FILES) {
    if (!existsSync(join(core, f.from))) {
      console.warn(`- ${f.from} isn't in game-core yet: skipped`);
      continue;
    }
    let src = readFileSync(join(core, f.from), "utf8");
    for (const m of src.matchAll(/from '([^']+)'/g))
      if (f.imports[m[1]!] === undefined) throw new Error(`${f.from} imports ${m[1]}: add where the web takes it from to imports`);
    for (const [from, to] of Object.entries(f.imports)) src = src.split(`from '${from}'`).join(`from '${to}'`);
    const target = join(out, f.to);
    const body = await prettier.format(src, { ...((await prettier.resolveConfig(target)) ?? {}), filepath: target });
    const rev = revOf(f.from);
    revs.push(`${f.from} ${rev}`);
    const text = `// Copied from VVFit packages/game-core/${f.from} (${rev}) by scripts/sync-nutrition-core.ts. Do not edit: re-sync.\n${body}`;
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
    console.log(`nutrition: the copies match ${core} (${revs.join(", ")})`);
  } else console.log(`nutrition: ${FILES.map((f) => f.to).join(", ")} copied (${revs.join(", ")})`);
}

void main();
