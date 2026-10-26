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

// The camera files, and the public text filter they use (ugc.ts: custom move and training names, ADR-0047).
const EXTRA = ["ugc.ts"];
// Single pure helpers taken out of bigger game-core files (whose other imports the web doesn't carry): the function
// and the constants it uses are cut verbatim into one small file per source.
const EXTRACTS: Record<string, { file: string; out: string; names: string[] }> = {
  "voiceCommands.js": { file: "voiceCommands.ts", out: "voiceNormalize", names: ["COMBINING", "normalizeVoice"] },
};
const copied = (f: string) => /^camera[A-Z]\w*\.ts$/.test(f) || EXTRA.includes(f);
const files = readdirSync(join(core, "src")).filter(copied);
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
    if (!copied(m[1]!.replace(/\.js$/, ".ts")) && !EXTRACTS[m[1]!])
      throw new Error(`${f} imports ./${m[1]}: only camera files can be copied`);
  let body = src.replace(/from '\.\/(camera\w+|ugc)\.js'/g, "from './$1'");
  for (const [from, x] of Object.entries(EXTRACTS)) body = body.split(`from './${from}'`).join(`from './${x.out}'`);
  writeFileSync(
    join(out, f),
    `// Copied from VVFit packages/game-core/src/${f} (${rev}) by scripts/sync-camera-core.ts. Do not edit: re-sync.\n${body}`,
  );
}
for (const x of Object.values(EXTRACTS)) {
  const src = readFileSync(join(core, "src", x.file), "utf8");
  const lines = src.split("\n");
  const parts = x.names.map((n) => {
    const start = lines.findIndex((l) => new RegExp(`^(export )?(const|function) ${n}\\b`).test(l));
    if (start < 0) throw new Error(`${n} not found in ${x.file}`);
    // A one-line constant, or a block up to its closing brace at column 0.
    const end = lines[start]!.trimEnd().endsWith(";") ? start : lines.findIndex((l, i) => i > start && l === "}");
    return lines.slice(start, end + 1).join("\n");
  });
  writeFileSync(
    join(out, `${x.out}.ts`),
    `// Cut from VVFit packages/game-core/src/${x.file} (${rev}) by scripts/sync-camera-core.ts. Do not edit: re-sync.\n${parts.join("\n\n")}\n`,
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

  // Hands-free (cameraFlow.ts): a two-set routine run on its own, nobody touching anything: the demo, 3-2-1, the
  // sets ending at their target, the rest, the countdown again, done. Fixed frames (stand, squat, stand, squat, stand).
  const { HandsFreeWorkout } = await imp("src/cameraFlow.ts");
  const { demoLoop } = await imp("src/cameraDemo.ts");
  const segs: Frame[] = [];
  let tEnd = 0;
  const push = (fs: Frame[]) => {
    const base = tEnd;
    for (const f of fs) segs.push({ ...f, t: base + f.t });
    tEnd = segs.length ? segs[segs.length - 1]!.t + 100 : 0;
  };
  const stand = (s: number, seed: number) => rounded(S.record(s, 10, () => S.standing(), { view: "front" }, seed));
  push(stand(9, 21));
  push(rounded(seq((k) => S.squat(k), { view: "front" }, 5, 2.2, 23)));
  push(stand(25, 22));
  push(rounded(seq((k) => S.squat(k), { view: "front" }, 5, 2.2, 24)));
  push(stand(10, 25));
  const routine = {
    id: "parity",
    name: { en: "Parity", fr: "Parité" },
    minutes: 2,
    equipment: "none",
    sets: [
      { move: "squat", reps: 5, restS: 10 },
      { move: "squat", reps: 5, restS: 10 },
    ],
  };
  const flow = new HandsFreeWorkout(0, seededRandom(5), { routine });
  const flowEvents: string[] = [];
  const name = (x: { type: string; [k: string]: unknown }) =>
    x.type === "countdown"
      ? `countdown:${x.n}`
      : x.type === "demo"
        ? `demo:${x.move}:${x.loop}`
        : x.type === "setEnd"
          ? `setEnd:${x.reason}`
          : x.type === "rep"
            ? `rep:${x.n}`
            : x.type === "framing"
              ? `framing:${x.framing}`
              : x.type;
  for (const x of flow.start(0)) flowEvents.push(name(x));
  let last = 0;
  for (const f of segs) {
    last = f.t;
    for (const x of flow.push(f, f.t)) flowEvents.push(name(x));
    if (flow.phase === "done") break;
  }
  const hands = {
    seed: 5,
    routine,
    frames: segs.map(flat),
    expect: { events: flowEvents, phase: flow.phase, summary: flow.summary(last) },
    demo: { move: "push-up", loopMs: demoLoop("push-up").loopMs, frames: demoLoop("push-up").frames.slice(0, 6).map(flat) },
  };

  // Custom moves and trainings (ADR-0047): a move taught from a recording (a straight punch, not in the catalogue),
  // counted back on another recording, recognised in "just start moving"; a training cleaned, expanded and scored.
  const T = await imp("src/cameraTemplate.ts");
  const C = await imp("src/cameraCustom.ts");
  const D = await imp("src/cameraDetect.ts");
  const TR = await imp("src/cameraTraining.ts");
  const punch = (k: number) =>
    S.standingWith({ l: { pitch: 90, roll: 0, elbow: 55 }, r: { pitch: 90, roll: 0, elbow: 55 + (172 - 55) * k } });
  const teachFrames = rounded(seq(punch, { view: "side" }, 4, 1.6, 3));
  const taught = T.buildTemplate(teachFrames, "reps");
  if (!taught.ok) throw new Error(`custom vectors: teaching failed (${taught.error})`);
  const testFrames = rounded(seq(punch, { view: "side" }, 6, 1.6, 9));
  const counted = T.countWith(taught.template, testFrames);
  const move = C.cleanCustomMove({ id: "m_parity0001", name: "Punch", icon: "figure.boxing", template: taught.template, checked: true });
  C.registerCustomMoves([move]);
  let detected: string | null = null;
  for (let i = 10; i <= testFrames.length && !detected; i += 7)
    detected = D.detectMove(testFrames.slice(Math.max(0, i - 8 * FPS), i))?.move.id ?? null;
  C.registerCustomMoves([]);
  const trainingIn = {
    name: "Parity burner",
    description: "Squats, punches, a plank.",
    level: "beginner",
    rounds: 2,
    roundRestS: 45,
    sets: [
      { move: "squat", reps: 12, zone: 3, restS: 30 },
      { move: "m_parity0001", reps: 10, zone: 4, restS: 20 },
      { move: "plank", holdS: 30, rpe: 6 },
    ],
    moves: [move],
    visibility: "public",
    lang: "en",
    tags: ["Legs", "core!"],
  };
  const cleaned = TR.cleanTraining(trainingIn);
  if (!("training" in cleaned)) throw new Error(`custom vectors: training refused (${cleaned.problem})`);
  const runSummary = {
    moves: [
      { id: "squat", sets: [{ reps: 12 }, { reps: 9 }] },
      { id: "m_parity0001", sets: [{ reps: 10 }, { reps: 10 }] },
      {
        id: "plank",
        sets: [
          { reps: 0, holdS: 30 },
          { reps: 0, holdS: 15 },
        ],
      },
    ],
  };
  const heartZones = { zoneS: [10, 40, 200, 300, 120, 30] };
  const custom = {
    teach: { frames: teachFrames.map(flat), expect: { reps: taught.reps, template: taught.template } },
    count: { frames: testFrames.map(flat), expect: { reps: counted, detected } },
    move,
    training: {
      input: trainingIn,
      expect: {
        training: cleaned.training,
        routine: TR.trainingRoutine(cleaned.training),
        minutes: TR.trainingMinutes(cleaned.training),
        run: TR.trainingRun(cleaned.training, runSummary, heartZones),
        runNoHeart: TR.trainingRun(cleaned.training, runSummary, null),
      },
      runSummary,
      heartZones,
      problems: [
        { input: { ...trainingIn, name: "" }, problem: TR.cleanTraining({ ...trainingIn, name: "" }).problem },
        { input: { ...trainingIn, sets: [] }, problem: TR.cleanTraining({ ...trainingIn, sets: [] }).problem },
        {
          input: { ...trainingIn, sets: [{ move: "nope", reps: 3 }] },
          problem: TR.cleanTraining({ ...trainingIn, sets: [{ move: "nope", reps: 3 }] }).problem,
        },
        { input: { ...trainingIn, rounds: 11 }, problem: TR.cleanTraining({ ...trainingIn, rounds: 11 }).problem },
        {
          input: { ...trainingIn, name: "Visit www.example.com" },
          problem: TR.cleanTraining({ ...trainingIn, name: "Visit www.example.com" }).problem,
        },
      ],
    },
  };

  writeFileSync(fixtures, JSON.stringify({ source: `VVFit packages/game-core ${rev}`, reps, holds, engine, hands, custom }));
  console.log(
    `camera: test vectors written (${reps.length} rep cases, ${holds.length} hold, engine ${events.length} events, hands-free ${flowEvents.length} events, ${flow.phase}; custom: taught ${taught.reps}, counted ${counted}, detected ${detected})`,
  );

  execFileSync("pnpm", ["exec", "prettier", "--write", out], { stdio: "inherit" });
}

vectors().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
