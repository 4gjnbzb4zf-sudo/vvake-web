// Copied from VVFit packages/game-core/src/cameraPose.ts (e628403d 2026-10-26) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): one body pose as the phone's on-device detector gives it (Apple Vision on iOS, MediaPipe
 * Pose Landmarker on Android), in one shared shape, and the geometry the rep counters and form cues read from it.
 * Pure: frames come in, numbers come out; video never reaches this code (or leaves the phone).
 *
 * Coordinates are normalised to the analysed image (x right, y down, 0…1), already mirrored like the preview for the
 * front camera; joint names are anatomical (your left arm is `lWrist` whichever way the image is flipped).
 */

/** The 17 joints both platforms give (COCO order). The native module sends them in this order, x,y,c each. */
export const JOINTS = [
  "nose",
  "lEye",
  "rEye",
  "lEar",
  "rEar",
  "lShoulder",
  "rShoulder",
  "lElbow",
  "rElbow",
  "lWrist",
  "rWrist",
  "lHip",
  "rHip",
  "lKnee",
  "rKnee",
  "lAnkle",
  "rAnkle",
] as const;
export type Joint = (typeof JOINTS)[number];

export interface Pt {
  x: number;
  y: number;
  /** Confidence 0…1. */
  c: number;
}

export interface PoseFrame {
  /** ms (any monotonic clock; the session uses ms since its start). */
  t: number;
  /** The analysed image's size (its aspect matters for angles: x and y are normalised separately). */
  w: number;
  h: number;
  joints: Partial<Record<Joint, Pt>>;
}

/** A joint is usable from this confidence. */
export const MIN_CONF = 0.3;

/** From the native module's flat array ([x, y, c] × 17); null when nobody is in the picture. */
export function frameFromFlat(t: number, w: number, h: number, p: readonly number[]): PoseFrame | null {
  if (!Array.isArray(p) || p.length < JOINTS.length * 3) return null;
  const joints: Partial<Record<Joint, Pt>> = {};
  let seen = 0;
  JOINTS.forEach((j, i) => {
    const x = p[i * 3]!;
    const y = p[i * 3 + 1]!;
    const c = p[i * 3 + 2]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(c) || c < MIN_CONF) return;
    joints[j] = { x, y, c };
    seen++;
  });
  return seen >= 4 ? { t, w: w > 0 ? w : 1, h: h > 0 ? h : 1, joints } : null;
}

/**
 * Head (nose, eyes, ears) and feet (ankles) are the joints the detectors find least well (real-device tests: they
 * flicker, or drift when the light is poor or the feet are cut off). Nothing requires them: the counters, the framing
 * guide and the checks work from the shoulders, elbows, wrists, hips and knees, and use these only when confident.
 */
export const OPTIONAL_JOINTS: ReadonlySet<Joint> = new Set<Joint>(["nose", "lEye", "rEye", "lEar", "rEar", "lAnkle", "rAnkle"]);
/** An optional joint is used from this confidence (the reliable ones from MIN_CONF). */
export const OPTIONAL_CONF = 0.5;

/** Whether this joint is seen well enough to use. */
export function seen(f: PoseFrame, j: Joint): boolean {
  const c = f.joints[j]?.c ?? 0;
  return c >= (OPTIONAL_JOINTS.has(j) ? OPTIONAL_CONF : MIN_CONF);
}

export const ok = (f: PoseFrame, ...js: Joint[]) => js.every((j) => seen(f, j));

/** In pixel-proportional space (x scaled by the aspect), so angles are true angles. */
function px(f: PoseFrame, j: Joint): { x: number; y: number } | null {
  const p = f.joints[j];
  if (!p || !seen(f, j)) return null;
  return { x: p.x * f.w, y: p.y * f.h };
}

/**
 * The ankle, or where it would be with the shin straight down under the knee (as long as the thigh): standing moves
 * (lunges, step-ups, wall sits) keep the shin near vertical, so the knee angle still reads when the feet don't.
 */
export function ankleOrBelowKnee(f: PoseFrame, s: "l" | "r"): { x: number; y: number; virtual: boolean } | null {
  const a = f.joints[`${s}Ankle`];
  if (a && seen(f, `${s}Ankle`)) return { x: a.x, y: a.y, virtual: false };
  const h = px(f, `${s}Hip`);
  const k = px(f, `${s}Knee`);
  if (!h || !k) return null;
  const thigh = Math.hypot(k.x - h.x, k.y - h.y);
  return { x: k.x / f.w, y: (k.y + thigh) / f.h, virtual: true };
}

/** The angle at b between a and c, where c is a point (not a joint), degrees. */
export function angleToPoint(f: PoseFrame, a: Joint, b: Joint, c: { x: number; y: number }): number | null {
  const A = px(f, a);
  const B = px(f, b);
  if (!A || !B) return null;
  const v1x = A.x - B.x;
  const v1y = A.y - B.y;
  const v2x = c.x * f.w - B.x;
  const v2y = c.y * f.h - B.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n < 1e-9) return null;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** The angle at `b` between b→a and b→c, degrees (0…180); null when a joint is missing. */
export function angleAt(f: PoseFrame, a: Joint, b: Joint, c: Joint): number | null {
  const A = px(f, a);
  const B = px(f, b);
  const C = px(f, c);
  if (!A || !B || !C) return null;
  const v1x = A.x - B.x;
  const v1y = A.y - B.y;
  const v2x = C.x - B.x;
  const v2y = C.y - B.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n < 1e-9) return null;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** The angle of a→b from vertical (0 = b straight above or below a, 90 = level), degrees. */
export function fromVertical(f: PoseFrame, a: Joint, b: Joint): number | null {
  const A = px(f, a);
  const B = px(f, b);
  if (!A || !B) return null;
  const dx = Math.abs(B.x - A.x);
  const dy = Math.abs(B.y - A.y);
  if (dx + dy < 1e-9) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export function mid(f: PoseFrame, a: Joint, b: Joint): Pt | null {
  const A = f.joints[a];
  const B = f.joints[b];
  const okA = !!A && seen(f, a);
  const okB = !!B && seen(f, b);
  if (okA && okB) return { x: (A!.x + B!.x) / 2, y: (A!.y + B!.y) / 2, c: Math.min(A!.c, B!.c) };
  if (okA) return A!;
  if (okB) return B!;
  return null;
}

/**
 * Where the head is: the nose, else the eyes or ears when confident, else estimated above the shoulders (a third of
 * a torso up). `estimated` says which. Null without shoulders and hips.
 */
export function headPoint(f: PoseFrame): { x: number; y: number; estimated: boolean } | null {
  if (seen(f, "nose")) return { x: f.joints.nose!.x, y: f.joints.nose!.y, estimated: false };
  const e = mid(f, "lEye", "rEye") ?? mid(f, "lEar", "rEar");
  if (e) return { x: e.x, y: e.y, estimated: false };
  const s = mid(f, "lShoulder", "rShoulder");
  const t = torsoLength(f);
  if (!s || !t) return null;
  return { x: s.x, y: s.y - 0.35 * t, estimated: true };
}

/** Body height in the image (nose or shoulders to ankles, or knees without the feet), 0…1 of the image height; null without enough joints. */
export function bodyHeight(f: PoseFrame): number | null {
  const top = seen(f, "nose") ? f.joints.nose! : mid(f, "lShoulder", "rShoulder");
  const bottom = mid(f, "lAnkle", "rAnkle") ?? mid(f, "lKnee", "rKnee");
  if (!top || !bottom) return null;
  return Math.hypot((bottom.x - top.x) * (f.w / f.h), bottom.y - top.y);
}

/** Shoulder-to-hip length in the image (the scale for jumps, holds and distances), 0…1 of the image height. */
export function torsoLength(f: PoseFrame): number | null {
  const s = mid(f, "lShoulder", "rShoulder");
  const h = mid(f, "lHip", "rHip");
  if (!s || !h) return null;
  return Math.hypot((h.x - s.x) * (f.w / f.h), h.y - s.y);
}

/** Front or side view, from how wide the shoulders look against the torso. */
export function viewOf(f: PoseFrame): "front" | "side" | null {
  const ls = f.joints.lShoulder;
  const rs = f.joints.rShoulder;
  const torso = torsoLength(f);
  if (!ls || !rs || !seen(f, "lShoulder") || !seen(f, "rShoulder") || !torso) return null;
  const w = Math.hypot((ls.x - rs.x) * (f.w / f.h), ls.y - rs.y) / torso;
  return w > 0.45 ? "front" : w < 0.3 ? "side" : null;
}

/** Shoulder to shoulder in the image (pixel-proportional, 0…1 of the image height); null unless both are seen. */
export function shoulderWidth(f: PoseFrame): number | null {
  if (!ok(f, "lShoulder", "rShoulder")) return null;
  const ls = f.joints.lShoulder!;
  const rs = f.joints.rShoulder!;
  return Math.hypot((ls.x - rs.x) * (f.w / f.h), ls.y - rs.y);
}

/**
 * How wide the shoulders look against the torso: about 0.75 standing and facing the phone, under 0.3 side-on, and
 * well over 1 when the torso points at the phone (on the floor facing it in a push-up or plank: the torso is seen end
 * on and looks short). Null without both shoulders and a hip.
 */
export function shoulderSpan(f: PoseFrame): number | null {
  const w = shoulderWidth(f);
  const t = torsoLength(f);
  if (w === null || !t) return null;
  return w / Math.max(t, 0.01);
}

const LIMB: readonly ("Shoulder" | "Elbow" | "Wrist" | "Hip" | "Knee")[] = ["Shoulder", "Elbow", "Wrist", "Hip", "Knee"];

/** How surely one side of the body is seen: the mean confidence of its shoulder, elbow, wrist, hip and knee (missing = 0). */
export function sideConfidence(f: PoseFrame, s: "l" | "r"): number {
  let sum = 0;
  for (const p of LIMB) sum += f.joints[`${s}${p}` as Joint]?.c ?? 0;
  return sum / LIMB.length;
}

/**
 * The side of the body facing the phone, when one clearly is (side-on: the far arm and leg are behind the body, and
 * detectors guess them, often straight): seen more surely by at least `margin`. Null when both sides look alike
 * (facing the phone) or neither is seen.
 */
export function nearSide(f: PoseFrame, margin = 0.12): "l" | "r" | null {
  const l = sideConfidence(f, "l");
  const r = sideConfidence(f, "r");
  if (l - r >= margin) return "l";
  if (r - l >= margin) return "r";
  return null;
}

/** The mean confidence of these joints (missing = 0). */
export function meanConfidence(f: PoseFrame, js: readonly Joint[]): number {
  if (!js.length) return 0;
  return js.reduce((a, j) => a + (f.joints[j]?.c ?? 0), 0) / js.length;
}

/** Parts of the body, as the screen names them. Head and feet are never required (see OPTIONAL_JOINTS). */
export type BodyArea = "shoulders" | "arms" | "hips" | "knees" | "feet" | "head";

/** What every camera move needs seen: the torso (the scale of every signal). */
export const CORE_AREAS: readonly BodyArea[] = ["shoulders", "hips"];
/** "Just start moving": the whole body but the head and feet (most moves read the knees or the arms). */
export const DETECT_AREAS: readonly BodyArea[] = ["shoulders", "arms", "hips", "knees"];

/** Whether the picture shows this part of the body (one side is enough). */
export function areaSeen(f: PoseFrame, a: BodyArea): boolean {
  switch (a) {
    case "shoulders":
      return seen(f, "lShoulder") || seen(f, "rShoulder");
    case "arms":
      return ok(f, "lElbow", "lWrist") || ok(f, "rElbow", "rWrist");
    case "hips":
      return seen(f, "lHip") || seen(f, "rHip");
    case "knees":
      return seen(f, "lKnee") || seen(f, "rKnee");
    case "feet":
      return seen(f, "lAnkle") || seen(f, "rAnkle");
    case "head":
      return !!headPoint(f) && !headPoint(f)!.estimated;
  }
}

/**
 * The framing guide's state. `none`: nobody in the picture. `tilt_down` / `tilt_up`: a needed part is cut off at the
 * bottom / top of the picture. `hidden`: a needed part is in the picture but not seen well (turned away, in shadow).
 */
export type Framing = "ok" | "none" | "step_back" | "step_closer" | "move_left" | "move_right" | "tilt_down" | "tilt_up" | "hidden";

/** Short extra tips under the framing line: more light; side-on or facing the phone for this move. */
export type FramingTip = "light" | "side_on" | "front_on";

export interface FramingReport {
  state: Framing;
  /** The needed parts not seen, in body order (never the head; the feet only for a move that needs them). */
  missing: BodyArea[];
  tips: FramingTip[];
}

const AREA_ORDER: readonly BodyArea[] = ["head", "shoulders", "arms", "hips", "knees", "feet"];
const RELIABLE_JOINTS: readonly Joint[] = JOINTS.filter((j) => !OPTIONAL_JOINTS.has(j));

/**
 * What the framing guide says: the parts this move needs in view (the shoulders and hips always, the arms or knees
 * when the move reads them, the feet only for the rare move that can't do without), not too small, centred. The head
 * and feet are used when seen and never asked for otherwise.
 */
export function framingReport(
  f: PoseFrame | null,
  opts: { need?: readonly BodyArea[]; view?: "front" | "side" | "either" } = {},
): FramingReport {
  const none: FramingReport = { state: "none", missing: [], tips: [] };
  if (!f) return none;
  const pts = JOINTS.filter((j) => seen(f, j)).map((j) => f.joints[j]!);
  if (pts.length < 4 || (!areaSeen(f, "shoulders") && !areaSeen(f, "hips"))) return none;
  const need = new Set<BodyArea>([...CORE_AREAS, ...(opts.need ?? DETECT_AREAS)]);
  need.delete("head");
  const missing = AREA_ORDER.filter((a) => need.has(a) && !areaSeen(f, a));

  const tips: FramingTip[] = [];
  const reliable = RELIABLE_JOINTS.filter((j) => f.joints[j]).map((j) => f.joints[j]!.c);
  if (reliable.length && reliable.reduce((a, b) => a + b, 0) / reliable.length < 0.55) tips.push("light");
  const v = viewOf(f);
  if (opts.view === "side" && v === "front") tips.push("side_on");
  if (opts.view === "front" && v === "side") tips.push("front_on");

  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const edge = 0.02;
  const at = (state: Framing): FramingReport => ({ state, missing, tips });
  if (minX < edge && maxX > 1 - edge) return at("step_back");
  if (minY < edge && maxY > 1 - edge) return at("step_back");
  if (missing.length) {
    const low = missing.some((a) => a === "hips" || a === "knees" || a === "feet");
    if (low && maxY > 0.8) return at("tilt_down");
    if (missing.includes("shoulders") && minY < 0.2) return at("tilt_up");
    if (missing.includes("arms") && (minX < 0.1 || maxX > 0.9)) return at("step_back");
    return at("hidden");
  }
  const cx = (minX + maxX) / 2;
  if (cx < 0.25) return at("move_right");
  if (cx > 0.75) return at("move_left");
  const span = Math.max(maxY - minY, (maxX - minX) * (f.w / f.h));
  if (span < 0.3) return at("step_closer");
  return at("ok");
}

/** The framing guide's state alone (see framingReport). */
export function framing(f: PoseFrame | null, opts: { need?: readonly BodyArea[]; view?: "front" | "side" | "either" } = {}): Framing {
  return framingReport(f, opts).state;
}

/** Lying or on hands (plank, push-up, bridge): the shoulder→hip line nearer level than upright. */
export function torsoTilt(f: PoseFrame): number | null {
  const s = mid(f, "lShoulder", "rShoulder");
  const h = mid(f, "lHip", "rHip");
  if (!s || !h) return null;
  const dx = Math.abs(h.x - s.x) * f.w;
  const dy = Math.abs(h.y - s.y) * f.h;
  if (dx + dy < 1e-9) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * A light smoother for one signal (exponential, with a faster response to big moves, a simplified one-euro filter):
 * pose jitter (±2–4°) shouldn't count as reps, real moves shouldn't lag.
 */
export class Smoother {
  private v: number | null = null;
  private lastT = 0;
  constructor(
    private readonly minCutoffHz = 1.5,
    private readonly beta = 0.02,
  ) {}
  push(t: number, x: number): number {
    if (this.v === null) {
      this.v = x;
      this.lastT = t;
      return x;
    }
    const dt = Math.max(1, t - this.lastT) / 1000;
    this.lastT = t;
    const speed = Math.abs(x - this.v) / dt;
    const cutoff = this.minCutoffHz + this.beta * speed;
    const a = 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.v = this.v + a * (x - this.v);
    return this.v;
  }
  reset() {
    this.v = null;
  }
  get value() {
    return this.v;
  }
}
