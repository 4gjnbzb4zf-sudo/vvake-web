/**
 * Camera workouts on the web (ADR-0046 amendment 2026-10-21 in the monorepo): the phone's camera rules (game-core
 * camera*.ts: pose geometry, moves, reps and holds, detection, cues, liveness, the session engine, points) are copied
 * here unchanged, so the browser counts exactly what the phone counts. This script copies them and writes the shared
 * test vectors (landmark sequences and what game-core counts on them), checked by src/lib/webapp/camera/parity.test.ts.
 *
 *   tsx scripts/sync-camera-core.ts <path to the monorepo's packages/game-core>
 *
 * Run it again whenever game-core's camera files change; never edit the copies by hand.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const core = resolve(process.argv[2] ?? "../VVFit/packages/game-core");
const out = join(process.cwd(), "src", "lib", "webapp", "camera");
const fixtures = join(process.cwd(), "src", "lib", "webapp", "fixtures", "camera-fixtures.json");
mkdirSync(out, { recursive: true });

const files = readdirSync(join(core, "src")).filter((f) => /^camera[A-Z]\w*\.ts$/.test(f));
if (!files.includes("cameraPose.ts")) throw new Error(`no game-core camera files in ${core}/src`);
const rev = (() => {
  try {
    return execFileSync("git", ["-C", core, "log", "-1", "--format=%h %cs", "--", "src"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

for (const f of files) {
  const src = readFileSync(join(core, "src", f), "utf8");
  for (const m of src.matchAll(/from '\.\/([\w.]+)'/g))
    if (!/^camera[A-Z]\w*\.js$/.test(m[1]!)) throw new Error(`${f} imports ./${m[1]}: only camera files can be copied`);
  const body = src.replace(/from '\.\/(camera\w+)\.js'/g, "from './$1'");
  writeFileSync(
    join(out, f),
    `// Copied from VVFit packages/game-core/src/${f} (${rev}) by scripts/sync-camera-core.ts. Do not edit: re-sync.\n${body}`,
  );
}
console.log(`camera: ${files.length} game-core files copied (${rev})`);

// ── Shared test vectors ────────────────────────────────────────────────────────────────────────────────────────
type Frame = { t: number; w: number; h: number; joints: Record<string, { x: number; y: number; c: number } | undefined> };

async function vectors() {
  const imp = (p: string) => import(pathToFileURL(join(core, p)).href);
  const S = await imp("test/camera/skeleton.ts");
  const { RepCounter, HoldTimer } = await imp("src/cameraReps.ts");
  const { cameraMove } = await imp("src/cameraMoves.ts");
  const { JOINTS, framing } = await imp("src/cameraPose.ts");
  const { CameraWorkoutEngine } = await imp("src/cameraSession.ts");
  const { seededRandom } = await imp("src/cameraLiveness.ts");

  const q = (x: number) => Math.round(x * 1000) / 1000;
  /** [t, w, h, x, y, c × 17], 3 decimals; a missing joint is 0, 0, 0. */
  const flat = (f: Frame): number[] => [
    Math.round(f.t),
    f.w,
    f.h,
    ...(JOINTS as string[]).flatMap((j) => {
      const p = f.joints[j];
      return p ? [q(p.x), q(p.y), q(p.c)] : [0, 0, 0];
    }),
  ];
  const unflat = (a: number[]): Frame => {
    const joints: Frame["joints"] = {};
    (JOINTS as string[]).forEach((j, i) => {
      const c = a[3 + i * 3 + 2]!;
      if (c > 0) joints[j] = { x: a[3 + i * 3]!, y: a[3 + i * 3 + 1]!, c };
    });
    return { t: a[0]!, w: a[1]!, h: a[2]!, joints };
  };
  const without = (frames: Frame[], drop: string[]): Frame[] =>
    frames.map((f) => ({ ...f, joints: Object.fromEntries(Object.entries(f.joints).filter(([k]) => !drop.includes(k))) }));

  const FPS = 15;
  const seq = (body: (k: number) => unknown, cam: object, n: number, repS = 2.2, seed = 3): Frame[] => {
    const total = 1.5 + n * (repS * 1.15 + 0.4) + 1.5;
    return S.record(total, FPS, (s: number) => body(S.repPhase(s, { reps: n, repS, seed })), cam, seed);
  };
  const HEAD_FEET = ["nose", "lEye", "rEye", "lEar", "rEar", "lAnkle", "rAnkle"];

  const repCases: { name: string; move: string; frames: Frame[] }[] = [
    { name: "squat front", move: "squat", frames: seq((k) => S.squat(k), { view: "front" }, 6) },
    {
      name: "squat, head and feet unseen",
      move: "squat",
      frames: without(
        seq((k) => S.squat(k), { view: "front" }, 6, 2.2, 11),
        HEAD_FEET,
      ),
    },
    { name: "push-up side", move: "push-up", frames: seq((k) => S.pushUp(k), { view: "side", center: 0.7 }, 8, 1.6) },
    {
      name: "biceps curl, head and feet unseen",
      move: "biceps-curl",
      frames: without(
        seq((k) => S.curl(k), { view: "front" }, 6, 2.2, 29),
        HEAD_FEET,
      ),
    },
    { name: "jumping jack", move: "jumping-jack", frames: seq((k) => S.jack(k), { view: "front" }, 10, 0.9) },
  ];

  const rounded = (fs: Frame[]) => fs.map((f) => unflat(flat(f)));
  const reps = repCases.map((c) => {
    const frames = rounded(c.frames);
    const m = cameraMove(c.move);
    const rc = new RepCounter(m.sig, m.rep, m.guards ?? [], m.cues ?? []);
    let n = 0;
    let partials = 0;
    const cues: string[][] = [];
    const roms: number[] = [];
    for (const f of frames) {
      const r = rc.push(f);
      n += r.reps.length;
      partials += r.partials.length;
      for (const x of r.reps) {
        cues.push(x.cues);
        roms.push(x.romPct);
      }
    }
    return {
      name: c.name,
      move: c.move,
      frames: frames.map(flat),
      expect: { reps: n, partials, cues, roms, framing: framing(frames[Math.floor(frames.length / 2)]) },
    };
  });

  const plankFrames = rounded(S.record(14, FPS, () => S.plank(), { view: "side", center: 0.7 }, 5));
  const plank = cameraMove("plank");
  const ht = new HoldTimer(plank.sig, plank.hold, plank.guards ?? [], plank.cues ?? []);
  for (const f of plankFrames) ht.push(f);
  const holds = [
    { name: "plank side", move: "plank", frames: plankFrames.map(flat), expect: { heldS: Math.round(ht.heldS * 1000) / 1000 } },
  ];

  // The session engine: "just start moving" (detect), a rest, a liveness check (asked during rest), the summary.
  const squats = rounded(seq((k) => S.squat(k), { view: "front" }, 8, 2.2, 7));
  const standing = rounded(S.record(45, 5, () => S.standing(), { view: "front" }, 9));
  const armUp = rounded(
    S.record(3, 10, () => S.standingWith({ l: { pitch: 175, elbow: 175 }, r: { pitch: 5, elbow: 170 } }), { view: "front" }, 4),
  );
  const e = new CameraWorkoutEngine(0, seededRandom(7));
  const events: string[] = [];
  e.startSet(0, null);
  let clock = 0;
  const feed = (fs: Frame[], offset: number) => {
    for (const f of fs) {
      clock = offset + f.t;
      for (const x of e.push({ ...f, t: clock }, clock))
        events.push(
          x.type === "framing"
            ? `framing:${x.framing}`
            : x.type === "liveness"
              ? `liveness:${x.kind}`
              : x.type === "detected"
                ? `detected:${x.move}:${x.reps}`
                : x.type === "rep"
                  ? `rep:${x.n}`
                  : x.type,
        );
    }
  };
  feed(squats, 0);
  e.endSet(clock, 30);
  feed(standing, clock + 100);
  feed(armUp, clock + 100);
  const engine = {
    seed: 7,
    steps: [
      { kind: "startSet", at: 0, move: null },
      { kind: "frames", offset: 0, frames: squats.map(flat) },
      { kind: "endSet", restS: 30 },
      { kind: "frames", offsetAfter: 100, frames: standing.map(flat) },
      { kind: "frames", offsetAfter: 100, frames: armUp.map(flat) },
    ],
    expect: { events, summary: e.summary(clock), sport: e.sport() },
  };

  writeFileSync(fixtures, JSON.stringify({ source: `VVFit packages/game-core ${rev}`, reps, holds, engine }));
  console.log(`camera: test vectors written (${reps.length} rep cases, ${holds.length} hold, engine ${events.length} events)`);

  execFileSync("npx", ["prettier", "--write", out], { stdio: "inherit" });
}

vectors().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
