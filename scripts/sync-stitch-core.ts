/**
 * The stitched coach voice on the web (VVFit ADR-0054): game-core's stitcher core (stitchCore.ts: a line's words →
 * clip ids from a pack's own tables) and its audio (voiceAudio.ts: IMA ADPCM, the join, WAV, the VVS1 pack) are copied
 * here unchanged, so the browser stitches exactly what the phone and the watches stitch, with the golden cases the
 * watches check (stitch-golden.json, checked by src/lib/webapp/stitch/parity.test.ts).
 *
 *   tsx scripts/sync-stitch-core.ts <path to the monorepo's packages/game-core>           copy
 *   tsx scripts/sync-stitch-core.ts <path to the monorepo's packages/game-core> --check   exit 1 when a copy differs
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
const out = join(process.cwd(), "src", "lib", "webapp", "stitch");
const FILES = ["stitchCore.ts", "voiceAudio.ts"];
const GOLDEN = {
  from: join(core, "test", "fixtures", "stitch-golden.json"),
  to: join(process.cwd(), "src", "lib", "webapp", "fixtures", "stitch-golden.json"),
};

const rev = (() => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", ...FILES.map((f) => `src/${f}`)], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
})();

/** The header line names the source; the revision is left out of the comparison (only the code counts). */
const headerRe =
  /^\/\/ Copied from VVFit packages\/game-core\/src\/[\w.]+ \([^)]*\) by scripts\/sync-stitch-core\.ts\. Do not edit: re-sync\.\n/;

async function main() {
  let differs = 0;
  for (const f of FILES) {
    const src = readFileSync(join(core, "src", f), "utf8");
    if (/^import\s/m.test(src)) throw new Error(`${f} imports another file: the web copies only self-contained files`);
    const target = join(out, f);
    const body = await prettier.format(src, { ...((await prettier.resolveConfig(target)) ?? {}), filepath: target });
    const text = `// Copied from VVFit packages/game-core/src/${f} (${rev}) by scripts/sync-stitch-core.ts. Do not edit: re-sync.\n${body}`;
    if (check) {
      let have = "";
      try {
        have = readFileSync(target, "utf8");
      } catch {
        // missing: differs
      }
      if (have.replace(headerRe, "") !== body) {
        differs++;
        console.error(`✗ ${f} differs from ${core}/src/${f}`);
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
      console.error("✗ stitch-golden.json differs");
    }
  } else writeFileSync(GOLDEN.to, golden);

  if (check) {
    if (differs) process.exit(1);
    console.log(`stitch: the copies match ${core} (${rev})`);
  } else console.log(`stitch: ${FILES.length} game-core files and the golden cases copied (${rev})`);
}

void main();
