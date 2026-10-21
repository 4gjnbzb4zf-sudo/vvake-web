// Copied from VVFit packages/game-core/src/cameraMoves.ts (0be276a 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): the move catalog. Data only: each move names its signal (cameraReps.ts), the rest and
 * worked positions, the body checks that must hold for a rep to count, the form cues that apply, where to put the
 * phone, and how far the camera can judge it:
 *
 * - `camera`: counted and judged from one camera angle (depth, lockout, knees, back, elbows, symmetry…);
 * - `count`: counted from the pose, form only partly visible from one angle (no form judgement promised);
 * - `manual`: the camera can't count it reliably (too small a movement, or the body hidden): you tap or type the reps
 *   or time it; it's logged but never earns camera points.
 *
 * The camera never sees the load: weighted moves ask for it per set (kg or lb, lib/units.ts in the app).
 */
import type { BodyPart, CueCheck, Guard, HoldSpec, RepSpec, SignalSpec } from "./cameraReps";
import type { CameraJudge } from "./cameraPoints";
import { CORE_AREAS, type BodyArea } from "./cameraPose";

export type Equipment = "bodyweight" | "dumbbell" | "barbell" | "kettlebell" | "bar" | "bench" | "box";
export type MoveFamily =
  "squat" | "lunge" | "hinge" | "push" | "pull" | "press" | "arms" | "raise" | "core" | "cardio" | "carry" | "mobility";
export type CameraPlacement = "front" | "side";

export interface MoveDef {
  id: string;
  name: { en: string; fr: string };
  family: MoveFamily;
  equipment: Equipment[];
  /** Asks for a load per set. */
  weighted: boolean;
  kind: "reps" | "hold";
  /** Where the phone should be: in front of you or at your side; `either` works both ways (front is better for knees). */
  view: CameraPlacement | "either";
  judge: CameraJudge;
  /** One side at a time (log sets per side). */
  unilateral?: boolean;
  sig?: SignalSpec;
  rep?: RepSpec;
  hold?: HoldSpec;
  guards?: Guard[];
  cues?: CueCheck[];
  /** Cue lines of this move instead of the defaults (cameraCues.ts). */
  cueText?: Partial<Record<CueCheck["id"], { en: string; fr: string }>>;
  /** Tried by auto-detect (cameraDetect.ts). */
  detect?: boolean;
  /** The VVake sport a session of mostly this move is saved as. */
  sport: "strength" | "functional-strength" | "core" | "flexibility" | "hiit";
}

// ── Signals ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The feet are optional (cameraPose.ts OPTIONAL_JOINTS): every signal that reads an ankle says what stands in for it.
/** The knee angle; without the feet, from the thigh (the shin taken as straight down: standing knee bends). */
const knee = (side: "both" | "min" | "alt" = "min"): SignalSpec => ({
  k: "angle",
  a: "Hip",
  b: "Knee",
  c: "Ankle",
  side,
  cOr: "belowKnee",
});
const elbow = (side: "both" | "min" | "max" = "both"): SignalSpec => ({ k: "angle", a: "Shoulder", b: "Elbow", c: "Wrist", side });
const hip = (side: "both" | "max" | "alt" = "both"): SignalSpec => ({ k: "angle", a: "Shoulder", b: "Hip", c: "Knee", side });
/** The shoulder→hip→ankle line; without the feet, to the knee (on the same line with straight legs). */
const bodyHip = (side: "both" | "min" = "both"): SignalSpec => ({ k: "angle", a: "Shoulder", b: "Hip", c: "Ankle", side, cOr: "Knee" });
const abduct = (side: "both" | "max" = "both"): SignalSpec => ({ k: "angle", a: "Hip", b: "Shoulder", c: "Elbow", side });
const flex = (side: "both" | "max" = "both"): SignalSpec => ({ k: "angle", a: "Hip", b: "Shoulder", c: "Wrist", side });
const DROP: SignalSpec = { k: "drop", side: "both" };
const TILT: SignalSpec = { k: "tilt" };
const wrists = (side: "both" | "min" | "max" = "both"): SignalSpec => ({ k: "height", side });

// ── Guards ───────────────────────────────────────────────────────────────────────────────────────────────────────
const STANDING: Guard = { sig: TILT, max: 35 };
const UPRIGHT: Guard = { sig: TILT, max: 45 };
const HORIZONTAL: Guard = { sig: TILT, min: 55 };
const HINGED: Guard = { sig: TILT, min: 25 };
const ARMS_UP: Guard = { sig: wrists("min"), min: 0.2 };
const ARMS_DOWN: Guard = { sig: wrists("max"), max: -0.3 };
/** Elbows by your sides (curls: the wrists come up, the elbows stay down). */
const ELBOWS_DOWN: Guard = { sig: { k: "elbowHeight", side: "max" }, max: -0.3 };

// ── Rep shapes ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Squats: the hips drop toward the knees (about 0.8 standing, 0 with the thigh level). */
const SQUAT: RepSpec = { dir: "down", rest: 0.62, work: 0.35, good: 0.14, minS: 0.6 };
const PUSHUP: RepSpec = { dir: "down", rest: 150, work: 110, good: 95, lockout: 160, minS: 0.5 };
const CURL: RepSpec = { dir: "down", rest: 140, work: 75, good: 55, lockout: 155, minS: 0.6 };
const PRESS_UP: RepSpec = { dir: "up", rest: 110, work: 150, good: 165, minS: 0.5 };
const RAISE: RepSpec = { dir: "up", rest: 35, work: 65, good: 78, minS: 0.6 };
const HINGE: RepSpec = { dir: "down", rest: 160, work: 125, good: 105, lockout: 168, minS: 0.7 };
const LUNGE: RepSpec = { dir: "down", rest: 155, work: 122, good: 100, minS: 0.6 };
const ROW: RepSpec = { dir: "down", rest: 145, work: 110, good: 95, minS: 0.5 };
const BRIDGE: RepSpec = { dir: "up", rest: 153, work: 164, good: 171, minS: 0.6 };

const name = (en: string, fr: string) => ({ en, fr });
const SQUAT_CUES: CueCheck[] = [{ id: "depth" }, { id: "knee_valgus" }, { id: "chest_up", v: 55 }, { id: "symmetry", v: 0.25 }];
const PUSH_CUES: CueCheck[] = [{ id: "depth" }, { id: "lockout" }, { id: "hips_sag", v: 155 }, { id: "hips_pike", v: 155 }];
const CURL_CUES: CueCheck[] = [
  { id: "depth" },
  { id: "lockout" },
  { id: "elbow_swing", v: 35 },
  { id: "symmetry", v: 25 },
  { id: "slow_down", v: 0.4 },
];
const PRESS_CUES: CueCheck[] = [{ id: "depth" }, { id: "symmetry", v: 20 }, { id: "upright", v: 20 }];
const HINGE_CUES: CueCheck[] = [{ id: "depth" }, { id: "lockout" }, { id: "slow_down", v: 0.5 }];
const PRESS_TEXT = { depth: name("Lock out overhead.", "Verrouille bien en haut.") };
const PULL_TEXT = {
  depth: name("Pull a little higher.", "Tire un peu plus haut."),
  lockout: name("Full hang at the bottom.", "Bras tendus en bas."),
};
const ROW_TEXT = { depth: name("Pull the elbows further back.", "Tire les coudes plus loin en arrière.") };
const BRIDGE_TEXT = { depth: name("Squeeze the hips all the way up.", "Monte les hanches jusqu’en haut, serre les fessiers.") };
const RAISE_TEXT = { depth: name("Up to shoulder height.", "Jusqu’à hauteur d’épaules.") };
const HINGE_TEXT = {
  lockout: name("Stand tall at the top.", "Grandis-toi bien en haut."),
  depth: name("Hips back a little further.", "Recule un peu plus les hanches."),
};

type Opt = Partial<Omit<MoveDef, "id" | "name" | "family" | "sport">>;
function reps(id: string, n: { en: string; fr: string }, family: MoveFamily, sport: MoveDef["sport"], o: Opt): MoveDef {
  const equipment = o.equipment ?? ["bodyweight"];
  return {
    id,
    name: n,
    family,
    sport,
    kind: "reps",
    view: "either",
    judge: "camera",
    ...o,
    equipment,
    weighted: o.weighted ?? equipment.some((e) => e === "dumbbell" || e === "barbell" || e === "kettlebell"),
  };
}
function hold(id: string, n: { en: string; fr: string }, family: MoveFamily, sport: MoveDef["sport"], o: Opt): MoveDef {
  const equipment = o.equipment ?? ["bodyweight"];
  return {
    id,
    name: n,
    family,
    sport,
    kind: "hold",
    view: "either",
    judge: "camera",
    ...o,
    equipment,
    weighted: o.weighted ?? equipment.some((e) => e === "dumbbell" || e === "barbell" || e === "kettlebell"),
  };
}
const DB: Equipment[] = ["dumbbell"];
const BB: Equipment[] = ["barbell"];
const KB: Equipment[] = ["kettlebell"];
const FREE: Equipment[] = ["dumbbell", "barbell", "kettlebell"];

export const CAMERA_MOVES: readonly MoveDef[] = [
  // ── Bodyweight ─────────────────────────────────────────────────────────────────────────────────────────────────
  reps("squat", name("Squat", "Squat"), "squat", "functional-strength", {
    sig: DROP,
    rep: SQUAT,
    guards: [UPRIGHT],
    cues: SQUAT_CUES,
    detect: true,
  }),
  reps("jump-squat", name("Jump squat", "Squat sauté"), "squat", "hiit", {
    sig: DROP,
    rep: { ...SQUAT, work: 0.42, good: 0.25, minS: 0.5 },
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "knee_valgus" }],
  }),
  reps("lunge", name("Forward lunge", "Fente avant"), "lunge", "functional-strength", {
    view: "side",
    sig: knee("min"),
    rep: LUNGE,
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "upright", v: 25 }],
  }),
  reps("reverse-lunge", name("Reverse lunge", "Fente arrière"), "lunge", "functional-strength", {
    view: "side",
    sig: knee("min"),
    rep: LUNGE,
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "upright", v: 25 }],
  }),
  reps("side-lunge", name("Side lunge", "Fente latérale"), "lunge", "functional-strength", {
    view: "front",
    sig: knee("min"),
    rep: { ...LUNGE, work: 125, good: 105 },
    guards: [UPRIGHT],
    cues: [{ id: "depth" }],
  }),
  reps("push-up", name("Push-up", "Pompe"), "push", "functional-strength", {
    view: "side",
    sig: elbow(),
    rep: PUSHUP,
    guards: [HORIZONTAL],
    cues: PUSH_CUES,
    detect: true,
  }),
  reps("knee-push-up", name("Knee push-up", "Pompe sur les genoux"), "push", "functional-strength", {
    view: "side",
    sig: elbow(),
    rep: PUSHUP,
    guards: [{ sig: TILT, min: 45 }],
    cues: [{ id: "depth" }, { id: "lockout" }],
  }),
  reps("pike-push-up", name("Pike push-up", "Pompe pike"), "push", "functional-strength", {
    view: "side",
    sig: elbow(),
    rep: { ...PUSHUP, work: 115, good: 100 },
    guards: [{ sig: bodyHip(), max: 125 }],
    cues: [{ id: "depth" }, { id: "lockout" }],
  }),
  reps("dip", name("Dip", "Dips"), "push", "functional-strength", {
    view: "side",
    equipment: ["bench"],
    weighted: false,
    sig: elbow(),
    rep: { ...PUSHUP, work: 115, good: 95 },
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "lockout" }],
  }),
  reps("burpee", name("Burpee", "Burpee"), "cardio", "hiit", {
    view: "side",
    sig: TILT,
    rep: { dir: "up", rest: 30, work: 60, minS: 1.2, maxS: 12 },
    guards: [{ sig: bodyHip(), min: 145 }],
    judge: "count",
    detect: true,
  }),
  reps("jumping-jack", name("Jumping jack", "Jumping jack"), "cardio", "hiit", {
    view: "front",
    sig: wrists(),
    rep: { dir: "up", rest: -0.3, work: 0.3, good: 0.5, minS: 0.35 },
    guards: [STANDING],
    cues: [{ id: "depth" }],
    cueText: { depth: name("Hands all the way up.", "Les mains bien en haut.") },
    detect: true,
  }),
  reps("high-knees", name("High knees", "Montées de genoux"), "cardio", "hiit", {
    sig: { k: "drop", side: "alt" },
    rep: { dir: "down", rest: 0.55, work: 0.3, good: 0.1, minS: 0.25 },
    guards: [STANDING],
    cues: [{ id: "depth" }],
    cueText: { depth: name("Knees up to hip height.", "Genoux à hauteur de hanches.") },
    judge: "count",
    detect: true,
  }),
  reps("mountain-climber", name("Mountain climber", "Mountain climber"), "cardio", "hiit", {
    view: "side",
    sig: hip("alt"),
    rep: { dir: "down", rest: 150, work: 120, minS: 0.25 },
    guards: [HORIZONTAL],
    judge: "count",
    detect: true,
  }),
  hold("plank", name("Plank", "Gainage (planche)"), "core", "core", {
    view: "side",
    sig: bodyHip(),
    hold: { lo: 145, hi: 181 },
    guards: [{ sig: TILT, min: 45 }],
    cues: [
      { id: "hips_sag", v: 160 },
      { id: "hips_pike", v: 160 },
    ],
  }),
  hold("side-plank", name("Side plank", "Gainage latéral"), "core", "core", {
    view: "front",
    unilateral: true,
    sig: bodyHip(),
    hold: { lo: 150, hi: 181 },
    guards: [{ sig: TILT, min: 45 }],
    judge: "count",
  }),
  hold("wall-sit", name("Wall sit", "Chaise contre le mur"), "squat", "functional-strength", {
    view: "side",
    sig: knee("both"),
    hold: { lo: 70, hi: 120 },
    guards: [UPRIGHT],
    cues: [],
  }),
  reps("glute-bridge", name("Glute bridge", "Pont fessier"), "hinge", "functional-strength", {
    view: "side",
    sig: hip(),
    rep: BRIDGE,
    guards: [HORIZONTAL],
    cues: [{ id: "depth" }],
    cueText: BRIDGE_TEXT,
    detect: true,
  }),
  reps("sit-up", name("Sit-up", "Redressement assis"), "core", "core", {
    view: "side",
    sig: TILT,
    rep: { dir: "down", rest: 70, work: 45, good: 35, minS: 0.7 },
    cues: [{ id: "depth" }],
    cueText: { depth: name("Sit all the way up.", "Redresse-toi jusqu’en haut.") },
    detect: true,
  }),
  reps("crunch", name("Crunch", "Crunch"), "core", "core", {
    view: "side",
    sig: TILT,
    rep: { dir: "down", rest: 80, work: 70, minS: 0.5 },
    judge: "count",
  }),
  reps("leg-raise", name("Leg raise", "Relevé de jambes"), "core", "core", {
    view: "side",
    sig: bodyHip(),
    rep: { dir: "down", rest: 155, work: 120, good: 100, minS: 0.8 },
    guards: [HORIZONTAL],
    cues: [{ id: "depth" }],
    cueText: { depth: name("Legs a little higher.", "Les jambes un peu plus haut.") },
  }),
  reps("superman", name("Superman", "Superman"), "core", "core", {
    view: "side",
    sig: bodyHip(),
    rep: { dir: "down", rest: 170, work: 160, minS: 0.8 },
    guards: [HORIZONTAL],
    judge: "count",
  }),
  reps("bird-dog", name("Bird dog", "Bird dog"), "core", "core", {
    view: "side",
    sig: hip("max"),
    rep: { dir: "up", rest: 120, work: 155, minS: 0.8 },
    guards: [HORIZONTAL],
    judge: "count",
  }),
  reps("step-up", name("Step-up", "Montée sur marche"), "lunge", "functional-strength", {
    view: "side",
    equipment: ["box"],
    weighted: false,
    sig: knee("min"),
    rep: { dir: "down", rest: 160, work: 125, minS: 0.8 },
    guards: [UPRIGHT],
    judge: "count",
  }),
  reps("calf-raise", name("Calf raise", "Extension des mollets"), "squat", "functional-strength", { view: "side", judge: "manual" }),
  reps("pull-up", name("Pull-up", "Traction"), "pull", "functional-strength", {
    view: "front",
    equipment: ["bar"],
    weighted: false,
    sig: elbow(),
    rep: { dir: "down", rest: 150, work: 95, good: 75, lockout: 160, minS: 0.8 },
    guards: [ARMS_UP],
    cues: [{ id: "depth" }, { id: "lockout" }, { id: "chin_over" }],
    cueText: PULL_TEXT,
  }),
  reps("chin-up", name("Chin-up", "Traction supination"), "pull", "functional-strength", {
    view: "front",
    equipment: ["bar"],
    weighted: false,
    sig: elbow(),
    rep: { dir: "down", rest: 150, work: 95, good: 70, lockout: 160, minS: 0.8 },
    guards: [ARMS_UP],
    cues: [{ id: "depth" }, { id: "lockout" }, { id: "chin_over" }],
    cueText: PULL_TEXT,
  }),
  reps("inverted-row", name("Inverted row", "Rowing inversé"), "pull", "functional-strength", {
    view: "side",
    equipment: ["bar"],
    weighted: false,
    sig: elbow(),
    rep: { ...ROW, rest: 150, work: 105 },
    guards: [{ sig: TILT, min: 40 }],
    cues: [{ id: "depth" }, { id: "hips_sag", v: 155 }],
    cueText: ROW_TEXT,
    judge: "count",
  }),

  // ── Weights ────────────────────────────────────────────────────────────────────────────────────────────────────
  reps("back-squat", name("Back squat", "Squat barre arrière"), "squat", "strength", {
    equipment: BB,
    sig: DROP,
    rep: SQUAT,
    guards: [UPRIGHT],
    cues: [...SQUAT_CUES, { id: "slow_down", v: 0.6 }],
  }),
  reps("front-squat", name("Front squat", "Squat avant"), "squat", "strength", {
    equipment: BB,
    sig: DROP,
    rep: SQUAT,
    guards: [UPRIGHT],
    cues: [...SQUAT_CUES, { id: "slow_down", v: 0.6 }],
  }),
  reps("goblet-squat", name("Goblet squat", "Squat goblet"), "squat", "strength", {
    equipment: ["dumbbell", "kettlebell"],
    sig: DROP,
    rep: SQUAT,
    guards: [UPRIGHT],
    cues: SQUAT_CUES,
  }),
  reps("deadlift", name("Deadlift", "Soulevé de terre"), "hinge", "strength", {
    view: "side",
    equipment: FREE,
    sig: hip(),
    rep: { ...HINGE, work: 120, good: 100 },
    cues: HINGE_CUES,
    cueText: HINGE_TEXT,
    detect: true,
  }),
  reps("romanian-deadlift", name("Romanian deadlift", "Soulevé de terre roumain"), "hinge", "strength", {
    view: "side",
    equipment: FREE,
    sig: hip(),
    rep: HINGE,
    cues: [...HINGE_CUES, { id: "knees_soft", v: 135 }],
    cueText: {
      ...HINGE_TEXT,
      knees_soft: name("Soft knees: push the hips back, don’t squat it.", "Genoux souples : recule les hanches, ne squatte pas."),
    },
  }),
  reps("hip-thrust", name("Hip thrust", "Hip thrust"), "hinge", "strength", {
    view: "side",
    equipment: ["barbell", "dumbbell", "bench"],
    sig: hip(),
    rep: BRIDGE,
    cues: [{ id: "depth" }],
    cueText: BRIDGE_TEXT,
  }),
  reps("bench-press", name("Bench press", "Développé couché"), "push", "strength", {
    view: "side",
    equipment: ["barbell", "dumbbell", "bench"],
    sig: elbow(),
    rep: { ...PUSHUP, work: 105, good: 90 },
    guards: [HORIZONTAL],
    cues: [{ id: "depth" }, { id: "lockout" }],
    judge: "count",
  }),
  reps("floor-press", name("Floor press", "Développé au sol"), "push", "strength", {
    view: "side",
    equipment: ["barbell", "dumbbell"],
    sig: elbow(),
    rep: { ...PUSHUP, work: 112, good: 100 },
    guards: [HORIZONTAL],
    cues: [{ id: "lockout" }],
    judge: "count",
  }),
  reps("overhead-press", name("Overhead press", "Développé militaire"), "press", "strength", {
    view: "front",
    equipment: FREE,
    sig: elbow(),
    rep: PRESS_UP,
    guards: [STANDING, { sig: wrists("min"), min: -0.2 }],
    cues: [...PRESS_CUES, { id: "elbow_flare", v: 100 }],
    cueText: PRESS_TEXT,
    detect: true,
  }),
  reps("push-press", name("Push press", "Push press"), "press", "strength", {
    view: "front",
    equipment: FREE,
    sig: elbow(),
    rep: PRESS_UP,
    guards: [UPRIGHT, { sig: wrists("min"), min: -0.2 }],
    cues: [{ id: "depth" }],
    cueText: PRESS_TEXT,
    judge: "count",
  }),
  reps("bent-over-row", name("Bent-over row", "Rowing buste penché"), "pull", "strength", {
    view: "side",
    equipment: FREE,
    sig: elbow(),
    rep: ROW,
    guards: [HINGED],
    cues: [{ id: "depth" }, { id: "hinge_more", v: 30 }, { id: "slow_down", v: 0.4 }],
    cueText: ROW_TEXT,
  }),
  reps("upright-row", name("Upright row", "Tirage menton"), "pull", "strength", {
    view: "front",
    equipment: FREE,
    sig: wrists(),
    rep: { dir: "up", rest: -0.65, work: -0.3, minS: 0.6 },
    guards: [STANDING],
    judge: "count",
  }),
  reps("biceps-curl", name("Biceps curl", "Curl biceps"), "arms", "strength", {
    equipment: ["dumbbell", "barbell", "kettlebell"],
    sig: elbow("min"),
    rep: CURL,
    guards: [STANDING, ELBOWS_DOWN],
    cues: CURL_CUES,
    cueText: {
      depth: name("Curl all the way up.", "Monte jusqu’en haut."),
      lockout: name("All the way down, arms straight.", "Descends bras tendus."),
    },
    detect: true,
  }),
  reps("hammer-curl", name("Hammer curl", "Curl marteau"), "arms", "strength", {
    equipment: DB,
    sig: elbow("min"),
    rep: CURL,
    guards: [STANDING, ELBOWS_DOWN],
    cues: CURL_CUES,
    cueText: {
      depth: name("Curl all the way up.", "Monte jusqu’en haut."),
      lockout: name("All the way down, arms straight.", "Descends bras tendus."),
    },
  }),
  reps("triceps-extension", name("Overhead triceps extension", "Extension triceps au-dessus de la tête"), "arms", "strength", {
    equipment: ["dumbbell", "kettlebell"],
    sig: elbow(),
    rep: { dir: "up", rest: 85, work: 140, good: 160, minS: 0.6 },
    guards: [{ sig: { k: "elbowHeight", side: "both" }, min: 0.15 }],
    cues: [{ id: "depth" }],
    cueText: { depth: name("Straighten the arms fully.", "Tends complètement les bras.") },
    judge: "count",
  }),
  reps("triceps-kickback", name("Triceps kickback", "Kickback triceps"), "arms", "strength", {
    view: "side",
    equipment: DB,
    sig: elbow("max"),
    rep: { dir: "up", rest: 110, work: 145, good: 160, minS: 0.5 },
    guards: [HINGED],
    cues: [{ id: "depth" }],
    cueText: { depth: name("Straighten the arm fully.", "Tends complètement le bras.") },
  }),
  reps("lateral-raise", name("Lateral raise", "Élévations latérales"), "raise", "strength", {
    view: "front",
    equipment: DB,
    sig: abduct(),
    rep: RAISE,
    guards: [STANDING],
    cues: [{ id: "depth" }, { id: "too_high", v: 110 }, { id: "symmetry", v: 15 }, { id: "slow_down", v: 0.4 }],
    cueText: RAISE_TEXT,
    detect: true,
  }),
  reps("front-raise", name("Front raise", "Élévations frontales"), "raise", "strength", {
    view: "side",
    equipment: ["dumbbell", "barbell", "kettlebell"],
    sig: flex("max"),
    rep: RAISE,
    guards: [STANDING],
    cues: [{ id: "depth" }, { id: "too_high", v: 115 }],
    cueText: RAISE_TEXT,
  }),
  reps("shrug", name("Shrug", "Haussement d’épaules"), "arms", "strength", { view: "front", equipment: FREE, judge: "manual" }),
  reps("kettlebell-swing", name("Kettlebell swing", "Swing kettlebell"), "hinge", "strength", {
    view: "side",
    equipment: KB,
    sig: hip(),
    rep: { dir: "down", rest: 158, work: 128, lockout: 166, minS: 0.6 },
    cues: [{ id: "lockout" }],
    cueText: { lockout: name("Snap the hips through at the top.", "Ouvre bien les hanches en haut.") },
    judge: "count",
  }),
  reps("clean", name("Clean", "Épaulé"), "hinge", "strength", {
    equipment: ["barbell", "kettlebell", "dumbbell"],
    sig: wrists("max"),
    rep: { dir: "up", rest: -0.8, work: -0.3, minS: 0.6 },
    judge: "count",
  }),
  reps("snatch", name("Snatch", "Arraché"), "hinge", "strength", {
    equipment: ["barbell", "kettlebell", "dumbbell"],
    sig: wrists("max"),
    rep: { dir: "up", rest: -0.8, work: 0.5, minS: 0.6 },
    judge: "count",
  }),
  reps("thruster", name("Thruster", "Thruster"), "press", "strength", {
    view: "front",
    equipment: ["barbell", "dumbbell", "kettlebell"],
    sig: wrists("min"),
    rep: { dir: "up", rest: 0.15, work: 0.6, minS: 0.8 },
    judge: "count",
  }),
  reps("weighted-lunge", name("Lunge with weights", "Fente lestée"), "lunge", "strength", {
    view: "side",
    equipment: ["dumbbell", "barbell", "kettlebell"],
    sig: knee("min"),
    rep: LUNGE,
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "upright", v: 25 }],
  }),
  reps("weighted-reverse-lunge", name("Reverse lunge with weights", "Fente arrière lestée"), "lunge", "strength", {
    view: "side",
    equipment: ["dumbbell", "barbell", "kettlebell"],
    sig: knee("min"),
    rep: LUNGE,
    guards: [UPRIGHT],
    cues: [{ id: "depth" }, { id: "upright", v: 25 }],
  }),
  hold("farmer-carry", name("Farmer carry", "Marche du fermier"), "carry", "strength", {
    equipment: ["dumbbell", "kettlebell"],
    sig: TILT,
    hold: { lo: 0, hi: 25 },
    guards: [ARMS_DOWN],
    judge: "count",
  }),

  // ── Mobility and stretches ─────────────────────────────────────────────────────────────────────────────────────
  hold("deep-squat-hold", name("Deep squat hold", "Squat profond tenu"), "mobility", "flexibility", {
    sig: DROP,
    hold: { lo: -0.6, hi: 0.18 },
    guards: [UPRIGHT],
  }),
  // The heel pulled to the seat: only the ankle shows it (the one move that needs the feet in view).
  hold("quad-stretch", name("Standing quad stretch", "Étirement des quadriceps debout"), "mobility", "flexibility", {
    unilateral: true,
    view: "side",
    sig: { k: "angle", a: "Hip", b: "Knee", c: "Ankle", side: "min" },
    hold: { lo: 0, hi: 65 },
    guards: [STANDING],
  }),
  hold("hamstring-stretch", name("Standing hamstring fold", "Étirement ischio-jambiers debout"), "mobility", "flexibility", {
    view: "side",
    sig: hip(),
    hold: { lo: 0, hi: 95 },
    guards: [{ sig: knee("min"), min: 145 }],
  }),
  hold("hip-flexor-stretch", name("Hip flexor lunge stretch", "Étirement des fléchisseurs de hanche"), "mobility", "flexibility", {
    unilateral: true,
    view: "side",
    sig: knee("min"),
    hold: { lo: 60, hi: 120 },
    guards: [STANDING],
    judge: "count",
  }),
  hold("downward-dog", name("Downward dog", "Chien tête en bas"), "mobility", "flexibility", {
    view: "side",
    sig: bodyHip(),
    hold: { lo: 30, hi: 105 },
    cues: [],
  }),
  hold("cobra", name("Cobra", "Cobra"), "mobility", "flexibility", {
    view: "side",
    sig: TILT,
    hold: { lo: 30, hi: 75 },
    guards: [{ sig: bodyHip(), max: 168 }],
    judge: "count",
  }),
  // Kneeling, folded over the thighs: the hip angle (the shins on the floor hide the feet, and the knee guess is off).
  hold("childs-pose", name("Child’s pose", "Posture de l’enfant"), "mobility", "flexibility", {
    view: "side",
    sig: hip(),
    hold: { lo: 0, hi: 70 },
    guards: [{ sig: TILT, min: 50 }],
    judge: "count",
  }),
  hold("side-bend", name("Standing side bend", "Inclinaison latérale debout"), "mobility", "flexibility", {
    unilateral: true,
    view: "front",
    sig: TILT,
    hold: { lo: 12, hi: 50 },
    guards: [ARMS_UP],
    judge: "count",
  }),
  hold("overhead-reach", name("Overhead reach", "Étirement bras en haut"), "mobility", "flexibility", {
    view: "front",
    sig: wrists("min"),
    hold: { lo: 0.5, hi: 3 },
    guards: [STANDING],
    judge: "count",
  }),
  reps("cat-cow", name("Cat-cow", "Chat-vache"), "mobility", "flexibility", { view: "side", judge: "manual" }),
  hold("pigeon", name("Pigeon stretch", "Posture du pigeon"), "mobility", "flexibility", {
    unilateral: true,
    view: "side",
    judge: "manual",
  }),
  hold("butterfly", name("Butterfly stretch", "Étirement papillon"), "mobility", "flexibility", { view: "front", judge: "manual" }),
  hold("shoulder-stretch", name("Cross-body shoulder stretch", "Étirement de l’épaule bras croisé"), "mobility", "flexibility", {
    unilateral: true,
    view: "front",
    judge: "manual",
  }),
];

const BY_ID = new Map(CAMERA_MOVES.map((m) => [m.id, m]));
export const cameraMove = (id: string): MoveDef | undefined => BY_ID.get(id);
export const moveName = (m: Pick<MoveDef, "name">, lang: "en" | "fr") => m.name[lang];

/** The equipment chips the picker shows. */
export const EQUIPMENT_NAMES: Readonly<Record<Equipment, { en: string; fr: string }>> = {
  bodyweight: name("Bodyweight", "Poids du corps"),
  dumbbell: name("Dumbbells", "Haltères"),
  barbell: name("Barbell", "Barre"),
  kettlebell: name("Kettlebell", "Kettlebell"),
  bar: name("Pull-up bar", "Barre de traction"),
  bench: name("Bench", "Banc"),
  box: name("Box or step", "Box ou marche"),
};

export const FAMILY_NAMES: Readonly<Record<MoveFamily, { en: string; fr: string }>> = {
  squat: name("Squats", "Squats"),
  lunge: name("Lunges", "Fentes"),
  hinge: name("Hinges", "Charnière de hanche"),
  push: name("Push", "Poussée"),
  pull: name("Pull", "Tirage"),
  press: name("Overhead", "Au-dessus de la tête"),
  arms: name("Arms", "Bras"),
  raise: name("Shoulders", "Épaules"),
  core: name("Core", "Gainage et abdos"),
  cardio: name("Cardio", "Cardio"),
  carry: name("Carries", "Portés"),
  mobility: name("Mobility and stretches", "Mobilité et étirements"),
};

const AREA_OF: Readonly<Record<BodyPart, BodyArea | null>> = {
  Shoulder: "shoulders",
  Elbow: "arms",
  Wrist: "arms",
  Hip: "hips",
  Knee: "knees",
  Ankle: "feet",
  Ear: null,
  Eye: null,
  nose: null,
};

function signalAreas(sig: SignalSpec): BodyArea[] {
  switch (sig.k) {
    case "tilt":
      return ["shoulders", "hips"];
    case "drop":
      return ["hips", "knees"];
    case "height":
    case "elbowHeight":
      return ["shoulders", "arms"];
    case "angle": {
      const c = sig.c === "Ankle" && sig.cOr ? (sig.cOr === "belowKnee" ? "Knee" : sig.cOr) : sig.c;
      return [sig.a, sig.b, c].map((p) => AREA_OF[p]).filter((a): a is BodyArea => !!a);
    }
  }
}

/**
 * The parts of the body a move needs in view: the torso always, and what its signal and guards read. The head never
 * (nothing counts from it); the feet only when nothing can stand in for them (the quad stretch). Form cues that read
 * the head or feet just stay quiet without them.
 */
export function moveNeeds(m: Pick<MoveDef, "sig" | "guards" | "judge">): BodyArea[] {
  const out = new Set<BodyArea>(CORE_AREAS);
  if (m.judge !== "manual") {
    if (m.sig) signalAreas(m.sig).forEach((a) => out.add(a));
    for (const g of m.guards ?? []) signalAreas(g.sig).forEach((a) => out.add(a));
  }
  return (["shoulders", "arms", "hips", "knees", "feet"] as const).filter((a) => out.has(a));
}

/** Where to put the phone, said before the set. */
export function placementHint(m: Pick<MoveDef, "view" | "sig" | "guards" | "judge">, lang: "en" | "fr"): string {
  const feet = moveNeeds(m).includes("feet");
  const inView = feet
    ? lang === "fr"
      ? "tout le corps visible"
      : "whole body in view"
    : lang === "fr"
      ? "des épaules aux genoux visibles"
      : "shoulders to knees in view";
  if (m.view === "side")
    return lang === "fr" ? `Pose le téléphone sur le côté, à 2–3 m, ${inView}.` : `Put the phone at your side, 2–3 m away, ${inView}.`;
  if (m.view === "front")
    return lang === "fr" ? `Pose le téléphone face à toi, à 2–3 m, ${inView}.` : `Put the phone in front of you, 2–3 m away, ${inView}.`;
  return lang === "fr"
    ? `Face à toi ou sur le côté, à 2–3 m, ${inView} (de face pour les genoux).`
    : `In front of you or at your side, 2–3 m away, ${inView} (in front to check your knees).`;
}

/** The sport a session is saved as: the one most of its sets were (weights → strength). */
export function cameraSessionSport(moveIds: readonly string[]): MoveDef["sport"] {
  const n = new Map<MoveDef["sport"], number>();
  for (const id of moveIds) {
    const m = BY_ID.get(id);
    if (m) n.set(m.sport, (n.get(m.sport) ?? 0) + 1);
  }
  if ((n.get("strength") ?? 0) > 0) return "strength";
  let best: MoveDef["sport"] = "functional-strength";
  let max = 0;
  for (const [k, v] of n) if (v > max) [best, max] = [k, v];
  return best;
}
