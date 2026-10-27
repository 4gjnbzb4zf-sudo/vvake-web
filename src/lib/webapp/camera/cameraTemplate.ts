// Copied from VVFit packages/game-core/src/cameraTemplate.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Custom moves (ADR-0047): "teach VVake a new move". You do 3 to 5 reps (or hold the position a few seconds) in front
 * of the camera; VVake keeps a template made of numbers only (joint-angle curves of the joints that moved, the rep's
 * timing, a few stick-figure keyframes for the demo) and from then on counts that move in sets and in "just start
 * moving", like a catalogue move. No video and no picture is kept or sent: the template is derived from the same
 * 17-joint frames the counters already read (cameraPose.ts), and it's all the share link carries.
 *
 * How a rep is matched: the channel that moved the most (the primary) segments reps with hysteresis (rest → worked →
 * back), then the whole rep (every channel that moved, resampled to a fixed length) is compared with the taught rep by
 * dynamic time warping. A rep counts when it's close enough (the tolerance is learnt from how alike the taught reps
 * were) and took about as long. One-sided moves are also matched mirrored (the other arm or leg), and an alternating
 * move counts each side. Head and feet are never needed: the knee angle falls back to the thigh (belowKnee), like the
 * catalogue counters.
 *
 * Pure and deterministic: the tests teach moves from the skeleton recordings and count them back.
 */
import {
  angleAt,
  angleToPoint,
  ankleOrBelowKnee,
  JOINTS,
  OPTIONAL_JOINTS,
  seen,
  Smoother,
  torsoLength,
  torsoTilt,
  type Joint,
  type PoseFrame,
  type Pt,
} from "./cameraPose";
import type { RepEvent } from "./cameraReps";
import type { DemoLoop } from "./cameraDemo";

// ── Features ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The channels a template can use: joint angles (degrees) and heights (torso lengths × 90, so on the same scale). */
export const CHANNELS = [
  "elbowL",
  "elbowR",
  "shoulderL",
  "shoulderR",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "tilt",
  "wristL",
  "wristR",
  "dropL",
  "dropR",
] as const;
export type Channel = (typeof CHANNELS)[number];
const NCH = CHANNELS.length;
const CH_INDEX: Readonly<Record<Channel, number>> = Object.fromEntries(CHANNELS.map((c, i) => [c, i])) as Record<Channel, number>;
/** A channel's other side (tilt has none). */
const MIRROR: readonly number[] = CHANNELS.map((c) => {
  if (c === "tilt") return CH_INDEX.tilt;
  const other = (c.endsWith("L") ? c.slice(0, -1) + "R" : c.slice(0, -1) + "L") as Channel;
  return CH_INDEX[other];
});
/** Heights in torso lengths, scaled to sit on the degrees' scale. */
const HEIGHT_SCALE = 90;

type Vec = (number | null)[];

/** Running torso-length reference (the standing torso, as the counters use). */
export class TorsoRef {
  private ref = 0;
  private sm = new Smoother(0.8, 0);
  push(f: PoseFrame): number {
    const tl = torsoLength(f);
    if (tl) this.ref = Math.max(this.ref * 0.9995, this.sm.push(f.t, tl));
    return this.ref;
  }
  get value() {
    return this.ref;
  }
}

function side(
  f: PoseFrame,
  s: "l" | "r",
  ref: number,
): [number | null, number | null, number | null, number | null, number | null, number | null] {
  const J = (p: string) => `${s}${p}` as Joint;
  const elbow = angleAt(f, J("Shoulder"), J("Elbow"), J("Wrist"));
  const shoulder = angleAt(f, J("Hip"), J("Shoulder"), J("Elbow"));
  const hip = angleAt(f, J("Shoulder"), J("Hip"), J("Knee"));
  let knee = angleAt(f, J("Hip"), J("Knee"), J("Ankle"));
  if (knee === null) {
    const p = ankleOrBelowKnee(f, s);
    knee = p ? angleToPoint(f, J("Hip"), J("Knee"), p) : null;
  }
  const sh = f.joints[J("Shoulder")];
  const w = f.joints[J("Wrist")];
  const h = f.joints[J("Hip")];
  const k = f.joints[J("Knee")];
  const wrist = sh && w && seen(f, J("Shoulder")) && seen(f, J("Wrist")) && ref > 0 ? ((sh.y - w.y) / ref) * HEIGHT_SCALE : null;
  const drop = h && k && seen(f, J("Hip")) && seen(f, J("Knee")) && ref > 0 ? ((k.y - h.y) / ref) * HEIGHT_SCALE : null;
  return [elbow, shoulder, hip, knee, wrist, drop];
}

/** One frame's feature vector (CHANNELS order; null where the joints aren't seen). */
export function features(f: PoseFrame, ref: number): Vec {
  const [eL, sL, hL, kL, wL, dL] = side(f, "l", ref);
  const [eR, sR, hR, kR, wR, dR] = side(f, "r", ref);
  return [eL, eR, sL, sR, hL, hR, kL, kR, torsoTilt(f), wL, wR, dL, dR];
}

const mirrorVec = (v: Vec): Vec => MIRROR.map((j) => v[j]!);

// ── The template ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Points per channel a rep is resampled to. */
export const TEMPLATE_N = 24;

export interface MoveTemplate {
  v: 1;
  kind: "reps" | "hold";
  /** The channels that moved (reps) or that define the position (hold). */
  ch: Channel[];
  /** Reps: the channel that segments reps, its rest and worked values (the taught reps' medians). */
  primary?: Channel;
  rest?: number;
  work?: number;
  /** Reps: the taught rep per channel (`ch` order), TEMPLATE_N points each. Hold: one value per channel. */
  traj: number[][];
  /** How far a rep (or the position) may be from the template: mean degrees per point. */
  tol: number;
  /** Rep time range (s), from the taught reps. */
  minS?: number;
  maxS?: number;
  /** One-sided: also matched on the other side. `alt`: the taught reps alternated sides (each side counts). */
  mirror: boolean;
  /** How good the teaching was: `good` can earn camera points once the live test passed, `fair` counts but never earns. */
  quality: "good" | "fair";
  /** Taught reps (reps) or seconds held (hold). */
  taught: number;
  /** The demo: a loop of stick-figure keyframes (13 joints, x/y in a 480×640 box, no head or feet when unseen). */
  demo: { ms: number; view: "front" | "side"; frames: (number | null)[][] };
}

export type TeachError = "not_seen" | "no_movement" | "too_few_reps" | "inconsistent" | "like_standing" | "too_short";

export interface TeachResult {
  ok: boolean;
  template?: MoveTemplate;
  error?: TeachError;
  /** Reps found in the recording (reps moves), shown while teaching. */
  reps: number;
}

export const TEACH = {
  /** A channel moved when its range (5th to 95th percentile) is at least this. */
  minRange: 20,
  /** The primary must have moved at least this to be a rep at all. */
  minPrimaryRange: 28,
  /** And this much for a `good` template. */
  goodRange: 40,
  minReps: 3,
  maxReps: 8,
  /** A channel seen less than this share of the time is left out. */
  minCoverage: 0.6,
  /** Tolerance bounds (mean degrees). */
  tolMin: 16,
  tolMax: 30,
  /** Good templates have taught reps at most this far apart (mean degrees). */
  goodSpread: 16,
  /** Hold: at least this long, steady. */
  holdMinS: 3,
  /** A hold must differ from standing by this much on some channel. */
  standingGap: 30,
  /** Where a rep leaves rest / counts as worked, as a share of rest→work. */
  leave: 0.3,
  worked: 0.65,
  /** The demo keeps this many keyframes per loop. */
  demoFrames: 16,
} as const;

/** Standing still, arms down (the hold that must not be taught: it would match every rest). */
const STANDING: Readonly<Partial<Record<Channel, number>>> = {
  elbowL: 170,
  elbowR: 170,
  shoulderL: 12,
  shoulderR: 12,
  hipL: 175,
  hipR: 175,
  kneeL: 175,
  kneeR: 175,
  tilt: 3,
  wristL: -100,
  wristR: -100,
  dropL: 75,
  dropR: 75,
};

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const i = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))));
  return s[i]!;
}
const median = (xs: number[]) => pct(xs, 0.5);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Fills a channel's gaps by linear interpolation (edges hold the nearest value); null when never seen. */
function fill(xs: (number | null)[]): number[] | null {
  const idx: number[] = [];
  xs.forEach((x, i) => x !== null && Number.isFinite(x) && idx.push(i));
  if (!idx.length) return null;
  const out = new Array<number>(xs.length);
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] !== null && Number.isFinite(xs[i]!)) {
      out[i] = xs[i]!;
      continue;
    }
    let a = -1;
    let b = -1;
    for (const j of idx) {
      if (j < i) a = j;
      else if (j > i) {
        b = j;
        break;
      }
    }
    if (a < 0) out[i] = xs[b]!;
    else if (b < 0) out[i] = xs[a]!;
    else out[i] = xs[a]! + ((xs[b]! - xs[a]!) * (i - a)) / (b - a);
  }
  return out;
}

/** A median of 3 (a joint lost for a frame is a spike, not a move), then a light moving average. */
function smooth(xs: number[], k = 2): number[] {
  const med = xs.map((_, i) => {
    const w = xs.slice(Math.max(0, i - 1), Math.min(xs.length, i + 2)).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)]!;
  });
  return avg(med, k);
}
function avg(xs: number[], k: number): number[] {
  return xs.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(xs.length - 1, i + k); j++) {
      s += xs[j]!;
      n++;
    }
    return s / n;
  });
}

/** Resamples a series to n points (linear). */
export function resampleSeries(xs: readonly number[], n = TEMPLATE_N): number[] {
  if (!xs.length) return new Array(n).fill(0);
  if (xs.length === 1) return new Array(n).fill(xs[0]);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i * (xs.length - 1)) / (n - 1);
    const a = Math.floor(p);
    const b = Math.min(xs.length - 1, a + 1);
    out.push(xs[a]! + (xs[b]! - xs[a]!) * (p - a));
  }
  return out;
}

/**
 * Dynamic time warping distance between two multichannel series of the same length (channels × points), with a
 * Sakoe-Chiba band: the mean absolute difference per point and channel along the best alignment (degrees).
 */
export function dtw(a: readonly (readonly number[])[], b: readonly (readonly number[])[], band = 0.25): number {
  const n = a[0]?.length ?? 0;
  const m = b[0]?.length ?? 0;
  const nc = Math.min(a.length, b.length);
  if (!n || !m || !nc) return Infinity;
  const w = Math.max(Math.ceil(Math.max(n, m) * band), Math.abs(n - m));
  const INF = Number.POSITIVE_INFINITY;
  let prev = new Array<number>(m + 1).fill(INF);
  let prevLen = new Array<number>(m + 1).fill(0);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1).fill(INF);
    const curLen = new Array<number>(m + 1).fill(0);
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      let d = 0;
      for (let c = 0; c < nc; c++) d += Math.abs(a[c]![i - 1]! - b[c]![j - 1]!);
      d /= nc;
      const opts: [number, number][] = [
        [prev[j - 1]!, prevLen[j - 1]!],
        [prev[j]!, prevLen[j]!],
        [cur[j - 1]!, curLen[j - 1]!],
      ];
      let best = opts[0]!;
      for (const o of opts) if (o[0] < best[0]) best = o;
      cur[j] = best[0] + d;
      curLen[j] = best[1] + 1;
    }
    prev = cur;
    prevLen = curLen;
  }
  return prev[m]! / Math.max(1, prevLen[m]!);
}

interface Seg {
  a: number;
  b: number;
  /** Which side it was (mirrored segments of an alternating move). */
  mirrored: boolean;
}

/**
 * Segments reps on one series: rest → past `worked` → back past `leave`. `dir` +1 when the worked value is bigger.
 * Returns [start, end] indexes (start: where it left rest, end: where it came back).
 */
function segment(xs: readonly number[], rest: number, work: number): { a: number; b: number }[] {
  const span = work - rest;
  if (Math.abs(span) < 1e-6) return [];
  const k = (x: number) => (x - rest) / span; // 0 at rest, 1 worked
  const out: { a: number; b: number }[] = [];
  let phase: "rest" | "going" | "worked" | "unknown" = "unknown";
  let a = 0;
  for (let i = 0; i < xs.length; i++) {
    const p = k(xs[i]!);
    switch (phase) {
      case "unknown":
        if (p < TEACH.leave) phase = "rest";
        break;
      case "rest":
        if (p >= TEACH.leave) {
          phase = "going";
          // The frame before the crossing: where the live counter starts a rep too.
          a = Math.max(0, i - 1);
        }
        break;
      case "going":
        if (p >= TEACH.worked) phase = "worked";
        else if (p < TEACH.leave) phase = "rest";
        break;
      case "worked":
        if (p < TEACH.leave) {
          out.push({ a, b: i });
          phase = "rest";
        }
        break;
    }
  }
  return out;
}

/** The rep's frames, resampled per channel. */
function repTraj(cols: readonly (readonly number[])[], ch: readonly number[], a: number, b: number): number[][] {
  return ch.map((c) => resampleSeries(cols[c]!.slice(a, b + 1)));
}

/** Keyframes for the demo from a run of frames: 13 joints (no eyes/ears), in the demo's 480×640 box, fitted once. */
function demoFrom(frames: readonly PoseFrame[], n: number): (number | null)[][] {
  if (!frames.length) return [];
  const pick = Array.from(
    { length: n },
    (_, i) => frames[Math.min(frames.length - 1, Math.round((i * (frames.length - 1)) / Math.max(1, n - 1)))]!,
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const pts = pick.map((f) =>
    DEMO_JOINTS.map((j) => {
      const p = f.joints[j];
      if (!p || !seen(f, j)) return null;
      const x = p.x * f.w;
      const y = p.y * f.h;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return [x, y] as const;
    }),
  );
  if (!Number.isFinite(minX)) return [];
  const W = 480;
  const H = 640;
  const scale = Math.min((H * 0.8) / Math.max(1, maxY - minY), (W * 0.86) / Math.max(1, maxX - minX));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return pts.map((row) =>
    row.flatMap((p) => (p ? [round1(W / 2 + (p[0] - cx) * scale), round1(H / 2 + (p[1] - cy) * scale)] : [null, null])),
  );
}
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** The joints a custom move's demo draws (the head and feet only when they were seen). */
export const DEMO_JOINTS: readonly Joint[] = JOINTS.filter(
  (j) => j === "nose" || !OPTIONAL_JOINTS.has(j) || j === "lAnkle" || j === "rAnkle",
);

/** Records the teaching: feed frames while the person does the reps (or holds), then `build`. */
export class TemplateRecorder {
  private ref = new TorsoRef();
  readonly frames: PoseFrame[] = [];
  private vecs: Vec[] = [];
  constructor(readonly kind: "reps" | "hold") {}
  push(f: PoseFrame | null) {
    if (!f) return;
    const r = this.ref.push(f);
    this.frames.push(f);
    this.vecs.push(features(f, r));
  }
  /** Reps seen so far (for the screen's count while teaching). */
  repsSoFar(): number {
    if (this.kind !== "reps" || this.vecs.length < 10) return 0;
    const r = buildTemplate(this.frames, "reps");
    return r.reps;
  }
  build(): TeachResult {
    return buildTemplate(this.frames, this.kind);
  }
}

/** Builds a template from the frames of the teaching (reps: 3–5 reps from rest; hold: a few seconds in position). */
export function buildTemplate(frames: readonly PoseFrame[], kind: "reps" | "hold"): TeachResult {
  if (frames.length < 10) return { ok: false, error: "not_seen", reps: 0 };
  const ref = new TorsoRef();
  // The reference grows over the first frames: compute it first, then the features with the settled value.
  for (const f of frames) ref.push(f);
  const vecs = frames.map((f) => features(f, ref.value));
  const colsRaw = CHANNELS.map((_, c) => vecs.map((v) => v[c]!));
  const coverage = colsRaw.map((col) => col.filter((x) => x !== null).length / col.length);
  const cols: number[][] = colsRaw.map((col, c) => {
    if (coverage[c]! < TEACH.minCoverage) return [];
    return smooth(fill(col) ?? []);
  });
  const usable = CHANNELS.map((_, c) => c).filter((c) => cols[c]!.length);
  if (!usable.length) return { ok: false, error: "not_seen", reps: 0 };
  const durS = (frames[frames.length - 1]!.t - frames[0]!.t) / 1000;
  return kind === "hold" ? buildHold(frames, cols, usable, durS) : buildReps(frames, cols, usable);
}

function buildHold(frames: readonly PoseFrame[], cols: number[][], usable: number[], durS: number): TeachResult {
  // The steady part: the middle 60 % (getting into position and out of it trimmed).
  const n = frames.length;
  const a = Math.floor(n * 0.2);
  const b = Math.max(a + 1, Math.ceil(n * 0.8));
  const steadyS = ((frames[b - 1]!.t - frames[a]!.t) / 1000) | 0;
  if (durS < TEACH.holdMinS || steadyS < TEACH.holdMinS * 0.6) return { ok: false, error: "too_short", reps: 0 };
  const means = usable.map((c) => mean(cols[c]!.slice(a, b)));
  const sds = usable.map((c, i) => Math.sqrt(mean(cols[c]!.slice(a, b).map((x) => (x - means[i]!) ** 2))));
  // Standing still isn't a hold: it'd match every rest between sets.
  const gap = Math.max(...usable.map((c, i) => Math.abs(means[i]! - (STANDING[CHANNELS[c]!] ?? means[i]!))));
  if (gap < TEACH.standingGap) return { ok: false, error: "like_standing", reps: 0 };
  const wobble = mean(sds);
  const tol = clamp(Math.max(14, wobble * 3), 14, TEACH.tolMax);
  const ch = usable.map((c) => CHANNELS[c]!);
  // One-sided when the left and right channels differ a lot (a side plank, a one-leg stand).
  const asym = usable.some((c, i) => {
    const o = MIRROR[c]!;
    const j = usable.indexOf(o);
    return o !== c && j >= 0 && Math.abs(means[i]! - means[j]!) > 35;
  });
  const quality: MoveTemplate["quality"] = wobble <= 8 && steadyS >= TEACH.holdMinS ? "good" : "fair";
  const view = frames.length ? viewGuess(frames[Math.floor(n / 2)]!) : "front";
  return {
    ok: true,
    reps: 0,
    template: {
      v: 1,
      kind: "hold",
      ch,
      traj: means.map((m) => [round2(m)]),
      tol: round2(tol),
      mirror: asym,
      quality,
      taught: Math.round(durS),
      demo: { ms: 3200, view, frames: demoFrom(frames.slice(a, b), 2) },
    },
  };
}

interface SegTry {
  primary: number;
  xs: number[];
  restHi: boolean;
  segs: Seg[];
  alt: boolean;
  other: number;
}

/** Reps segmented on one channel (and on its other side when the move alternates). */
function segmentOn(cols: number[][], primary: number, range: (c: number) => number): SegTry {
  const xs = cols[primary]!;
  const lo = pct(xs, 0.05);
  const hi = pct(xs, 0.95);
  // You start at rest: the end nearer the first second's value is rest.
  const startV = median(xs.slice(0, Math.max(3, Math.min(xs.length, 15))));
  const restHi = Math.abs(startV - hi) < Math.abs(startV - lo);
  let segs: Seg[] = segment(xs, restHi ? hi : lo, restHi ? lo : hi).map((x) => ({ ...x, mirrored: false }));
  // Alternating moves (high knees, lunges each leg…): the other side's channel does the same rep between this one's.
  const other = MIRROR[primary]!;
  let alt = false;
  const pr = range(primary);
  if (other !== primary && cols[other]!.length && range(other) >= pr * 0.6) {
    const o = cols[other]!;
    const os = segment(o, restHi ? pct(o, 0.95) : pct(o, 0.05), restHi ? pct(o, 0.05) : pct(o, 0.95));
    const overlap = os.filter((q) => segs.some((x) => q.a < x.b && x.a < q.b)).length;
    if (os.length >= 1 && overlap <= Math.floor(os.length / 3)) {
      alt = true;
      segs = [...segs, ...os.map((x) => ({ ...x, mirrored: true }))].sort((x, y) => x.a - y.a);
    }
  }
  return { primary, xs, restHi, segs, alt, other };
}

function buildReps(frames: readonly PoseFrame[], cols: number[][], usable: number[]): TeachResult {
  const range = (c: number) => pct(cols[c]!, 0.95) - pct(cols[c]!, 0.05);
  const moved = usable.filter((c) => range(c) >= TEACH.minRange);
  if (!moved.length) return { ok: false, error: "no_movement", reps: 0 };
  // The primary: the channel whose reps come out clearest (most reps found, then the widest range). Arms swinging
  // with high knees can move more than the knees, but only the knees give a rep each side.
  const maxRange = Math.max(...moved.map(range));
  const tries = moved
    .filter((c) => range(c) >= Math.max(TEACH.minPrimaryRange, maxRange * 0.35))
    .map((c) => segmentOn(cols, c, range))
    .sort((a, b) => b.segs.length - a.segs.length || range(b.primary) - range(a.primary));
  const best0 = tries[0];
  if (!best0) return { ok: false, error: "no_movement", reps: 0 };
  const { primary, xs, restHi, segs, alt, other } = best0;
  const pr = range(primary);
  const nReps = segs.length;
  if (nReps < TEACH.minReps) return { ok: false, error: "too_few_reps", reps: nReps };
  const use = segs.slice(0, TEACH.maxReps);
  const ch = moved.slice();
  // For alternating moves the template is the primary side's rep; the other side's reps are read mirrored.
  const chMir = ch.map((c) => MIRROR[c]!);
  const trajs = use.map((s) => (s.mirrored ? repTraj(cols, chMir, s.a, s.b) : repTraj(cols, ch, s.a, s.b)));
  if (trajs.some((t) => t.some((row) => row.some((x) => !Number.isFinite(x))))) return { ok: false, error: "not_seen", reps: nReps };
  const tmpl = ch.map((_, i) => resampleSeries(Array.from({ length: TEMPLATE_N }, (_, p) => mean(trajs.map((t) => t[i]![p]!)))));
  const dists = trajs.map((t) => dtw(t, tmpl));
  const spread = mean(dists);
  const sd = Math.sqrt(mean(dists.map((d) => (d - spread) ** 2)));
  if (Math.max(...dists) > TEACH.tolMax * 1.6) return { ok: false, error: "inconsistent", reps: nReps };
  const durs = use.map((s) => (frames[s.b]!.t - frames[s.a]!.t) / 1000);
  const dMean = mean(durs);
  const dSd = Math.sqrt(mean(durs.map((d) => (d - dMean) ** 2)));
  if (dMean > 0 && dSd / dMean > 0.6) return { ok: false, error: "inconsistent", reps: nReps };
  // Learnt from how alike the taught reps were, never tighter than a share of the move's range (you won't do it
  // exactly the same next week).
  const rel = 0.14 * mean(moved.map(range));
  const tol = clamp(Math.max(Math.max(...dists) * 1.6, spread + 3 * sd, rel, TEACH.tolMin), TEACH.tolMin, TEACH.tolMax);
  // The rest and worked values the live counter segments on: the taught reps' medians.
  const restV = median(use.map((s) => (s.mirrored ? cols[other]! : xs)[s.a]!));
  const workV = median(
    use.map((s) => {
      const series = (s.mirrored ? cols[other]! : xs).slice(s.a, s.b + 1);
      return restHi ? Math.min(...series) : Math.max(...series);
    }),
  );
  // One-sided: the other side barely moved (a one-arm curl): matched mirrored too, so either side counts.
  const oneSided = other !== primary && (!cols[other]!.length || range(other) < pr * 0.45);
  const quality: MoveTemplate["quality"] = pr >= TEACH.goodRange && spread <= TEACH.goodSpread && nReps >= TEACH.minReps ? "good" : "fair";
  const best = use[dists.indexOf(Math.min(...dists))]!;
  const pad = Math.max(0, Math.round((best.b - best.a) * 0.08));
  const demoFrames = frames.slice(Math.max(0, best.a - pad), Math.min(frames.length, best.b + pad + 1));
  const demoMsV = clamp(Math.round((demoFrames[demoFrames.length - 1]!.t - demoFrames[0]!.t || 2000) / 100) * 100, 1200, 6000);
  return {
    ok: true,
    reps: nReps,
    template: {
      v: 1,
      kind: "reps",
      ch: ch.map((c) => CHANNELS[c]!),
      primary: CHANNELS[primary]!,
      rest: round2(restV),
      work: round2(workV),
      traj: tmpl.map((row) => row.map(round2)),
      tol: round2(tol),
      minS: round2(Math.max(0.3, Math.min(...durs) * 0.5)),
      maxS: round2(Math.min(15, Math.max(...durs) * 2.2)),
      mirror: alt || oneSided,
      quality,
      taught: nReps,
      demo: { ms: demoMsV, view: viewGuess(frames[best.a]!), frames: demoFrom(demoFrames, TEACH.demoFrames) },
    },
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function viewGuess(f: PoseFrame): "front" | "side" {
  const ls = f.joints.lShoulder;
  const rs = f.joints.rShoulder;
  const tl = torsoLength(f);
  if (!ls || !rs || !tl) return "front";
  const w = Math.hypot((ls.x - rs.x) * (f.w / f.h), ls.y - rs.y) / tl;
  return w < 0.35 ? "side" : "front";
}

// ── Validation (the API keeps only what this accepts) ────────────────────────────────────────────────────────────

/** A template as received (a share link, the API): checked and cleaned, or null. */
export function cleanTemplate(x: unknown): MoveTemplate | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Record<string, unknown>;
  if (t.v !== 1 || (t.kind !== "reps" && t.kind !== "hold")) return null;
  const ch = Array.isArray(t.ch)
    ? t.ch.filter((c): c is Channel => typeof c === "string" && (CHANNELS as readonly string[]).includes(c))
    : [];
  if (!ch.length || ch.length !== (t.ch as unknown[]).length || new Set(ch).size !== ch.length) return null;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  if (!Array.isArray(t.traj) || t.traj.length !== ch.length) return null;
  const len = t.kind === "reps" ? TEMPLATE_N : 1;
  const traj: number[][] = [];
  for (const row of t.traj as unknown[]) {
    if (!Array.isArray(row) || row.length !== len) return null;
    const r = row.map((v) => num(v, -400, 400));
    if (r.some((v) => v === null)) return null;
    traj.push(r as number[]);
  }
  const tol = num(t.tol, 1, 60);
  if (tol === null) return null;
  const demoIn = t.demo as Record<string, unknown> | undefined;
  const frames: (number | null)[][] = [];
  if (demoIn && Array.isArray(demoIn.frames)) {
    for (const row of (demoIn.frames as unknown[]).slice(0, 32)) {
      if (!Array.isArray(row) || row.length !== DEMO_JOINTS.length * 2) return null;
      frames.push(row.map((v) => (v === null ? null : num(v, -200, 900))));
    }
  }
  const out: MoveTemplate = {
    v: 1,
    kind: t.kind,
    ch,
    traj,
    tol,
    mirror: t.mirror === true,
    quality: t.quality === "good" ? "good" : "fair",
    taught: num(t.taught, 0, 600) ?? 0,
    demo: { ms: num(demoIn?.ms, 500, 10_000) ?? 2600, view: demoIn?.view === "side" ? "side" : "front", frames },
  };
  if (t.kind === "reps") {
    const primary = typeof t.primary === "string" && ch.includes(t.primary as Channel) ? (t.primary as Channel) : null;
    const rest = num(t.rest, -400, 400);
    const work = num(t.work, -400, 400);
    const minS = num(t.minS, 0.1, 30);
    const maxS = num(t.maxS, 0.2, 30);
    if (
      !primary ||
      rest === null ||
      work === null ||
      Math.abs(work - rest) < TEACH.minPrimaryRange * 0.8 ||
      minS === null ||
      maxS === null ||
      maxS <= minS
    )
      return null;
    Object.assign(out, { primary, rest, work, minS, maxS });
  }
  return out;
}

// ── Matching ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The live share of rest→work a rep must reach (a little easier than when teaching: you're tired by set 3). */
const LIVE = { leave: 0.3, worked: 0.6 } as const;
const LOST_MS = 1500;

interface Lane {
  mirrored: boolean;
  smooth: Smoother;
  phase: "unknown" | "rest" | "going" | "worked";
  buf: Vec[];
  ts: number[];
  startT: number;
  lastSeenT: number;
  peak: number;
}

/**
 * Counts a custom move's reps live, like RepCounter does for catalogue moves (it returns the same RepEvents: the
 * session engine treats both alike). Each candidate rep is checked against the template by DTW before it counts.
 */
export class TemplateCounter {
  private ref = new TorsoRef();
  private lanes: Lane[];
  private pi: number;
  private chIdx: number[];
  /** The last candidate's distance (degrees) and whether it counted: the teaching screen shows it. */
  lastScore: { dist: number; counted: boolean } | null = null;
  private lastRep: { t: number; ch: number } | null = null;

  constructor(readonly tpl: MoveTemplate) {
    this.pi = CH_INDEX[tpl.primary ?? tpl.ch[0]!];
    this.chIdx = tpl.ch.map((c) => CH_INDEX[c]);
    const lane = (mirrored: boolean): Lane => ({
      mirrored,
      smooth: new Smoother(),
      phase: "unknown",
      buf: [],
      ts: [],
      startT: 0,
      lastSeenT: 0,
      peak: 0,
    });
    this.lanes = tpl.mirror ? [lane(false), lane(true)] : [lane(false)];
  }

  /** 0 at rest, 1 at the taught worked position. */
  private k(v: number) {
    const span = (this.tpl.work ?? 1) - (this.tpl.rest ?? 0);
    return span ? (v - (this.tpl.rest ?? 0)) / span : 0;
  }

  push(f: PoseFrame): { reps: RepEvent[] } {
    const ref = this.ref.push(f);
    const v0 = features(f, ref);
    const reps: RepEvent[] = [];
    this.lanes.forEach((L, ch) => {
      const v = L.mirrored ? mirrorVec(v0) : v0;
      const raw = v[this.pi];
      if (raw === null || raw === undefined) {
        if (L.lastSeenT && f.t - L.lastSeenT > LOST_MS) {
          L.phase = "unknown";
          L.smooth.reset();
          L.buf = [];
          L.ts = [];
        }
        return;
      }
      L.lastSeenT = f.t;
      const p = this.k(L.smooth.push(f.t, raw));
      if (L.phase === "going" || L.phase === "worked") {
        L.buf.push(v);
        L.ts.push(f.t);
        L.peak = Math.max(L.peak, p);
      }
      switch (L.phase) {
        case "unknown":
          if (p < LIVE.leave) L.phase = "rest";
          break;
        case "rest":
          // Keep a short pre-roll: the rep starts where it left rest.
          L.buf = [v];
          L.ts = [f.t];
          if (p >= LIVE.leave) {
            L.phase = "going";
            L.startT = f.t;
            L.peak = p;
          }
          break;
        case "going":
          if (p >= LIVE.worked) L.phase = "worked";
          else if (p < LIVE.leave) L.phase = "rest";
          else if (f.t - L.startT > (this.tpl.maxS ?? 15) * 1000) L.phase = "unknown";
          break;
        case "worked":
          if (p < LIVE.leave) {
            const ev = this.judge(L, ch, f.t);
            if (ev) reps.push(ev);
            L.phase = "rest";
            L.buf = [v];
            L.ts = [f.t];
          } else if (f.t - L.startT > (this.tpl.maxS ?? 15) * 1000) L.phase = "unknown";
          break;
      }
    });
    return { reps };
  }

  private judge(L: Lane, ch: number, t: number): RepEvent | null {
    const durS = (t - L.startT) / 1000;
    const minS = this.tpl.minS ?? 0.3;
    const maxS = this.tpl.maxS ?? 15;
    if (durS < minS || durS > maxS) {
      this.lastScore = { dist: Infinity, counted: false };
      return null;
    }
    const rows = this.chIdx.map((c) => fill(L.buf.map((v) => v[c] ?? null)));
    // Channels missing for the rep are left out (a hidden arm); the primary must be there.
    const keep = rows.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    if (!keep.length || !rows[this.chIdx.indexOf(this.pi)]) return null;
    const live = keep.map((i) => resampleSeries(smooth(rows[i]!, 1)));
    const ref = keep.map((i) => this.tpl.traj[i]!);
    const dist = dtw(live, ref);
    const counted = dist <= this.tpl.tol;
    this.lastScore = { dist: round2(dist), counted };
    if (!counted) return null;
    // Both lanes on the same rep (a one-arm move done with both arms at once): one rep.
    if (this.lanes.length > 1 && this.lastRep && this.lastRep.ch !== ch && L.startT < this.lastRep.t) return null;
    this.lastRep = { t, ch };
    const romPct = Math.round(clamp(L.peak, 0, 1.2) * 100);
    return { t, ch, durS, downS: durS / 2, upS: durS / 2, worked: this.tpl.work ?? 0, rested: this.tpl.rest ?? 0, romPct, cues: [] };
  }
}

/** A custom hold: seconds in the taught position (the same pause-and-resume rules as HoldTimer). */
export class TemplateHold {
  private ref = new TorsoRef();
  private chIdx: number[];
  private inSince = 0;
  private outSince = 0;
  private lastT = 0;
  heldS = 0;
  holding = false;
  constructor(readonly tpl: MoveTemplate) {
    this.chIdx = tpl.ch.map((c) => CH_INDEX[c]);
  }
  /** Mean distance to the position (degrees), over the channels seen; null when too few are seen. */
  distance(f: PoseFrame): number | null {
    const v0 = features(f, this.ref.push(f));
    const d = (v: Vec) => {
      const ds: number[] = [];
      this.chIdx.forEach((c, i) => {
        const x = v[c];
        if (x !== null && x !== undefined) ds.push(Math.abs(x - this.tpl.traj[i]![0]!));
      });
      return ds.length >= Math.max(1, Math.ceil(this.chIdx.length * 0.6)) ? mean(ds) : null;
    };
    const a = d(v0);
    const b = this.tpl.mirror ? d(mirrorVec(v0)) : null;
    return a === null ? b : b === null ? a : Math.min(a, b);
  }
  push(f: PoseFrame): [] {
    const dist = this.distance(f);
    const dt = this.lastT ? Math.min(0.5, Math.max(0, (f.t - this.lastT) / 1000)) : 0;
    this.lastT = f.t;
    const inPos = dist !== null && dist <= this.tpl.tol;
    if (inPos) {
      this.outSince = 0;
      if (!this.inSince) this.inSince = f.t;
      if (!this.holding && f.t - this.inSince >= 1000) this.holding = true;
      if (this.holding) this.heldS += dt;
    } else {
      this.inSince = 0;
      if (this.holding) {
        if (!this.outSince) this.outSince = f.t;
        if (f.t - this.outSince > 1500) this.holding = false;
      }
    }
    return [];
  }
}

// ── The live test before saving ──────────────────────────────────────────────────────────────────────────────────

/** Reps asked for in the test after teaching. */
export const TEST_REPS = 3;

/**
 * The test after teaching ("do 3 more"): passes when the count is within one of what was asked and at least two
 * counted. A `good` template that passed can earn camera points; anything else counts but never earns.
 */
export function liveTestPassed(counted: number, asked = TEST_REPS): boolean {
  return counted >= 2 && Math.abs(counted - asked) <= 1;
}

/** Counts a recording with a template (the tests, the screen's "try it" check). */
export function countWith(tpl: MoveTemplate, frames: readonly PoseFrame[]): number {
  if (tpl.kind === "hold") {
    const h = new TemplateHold(tpl);
    for (const f of frames) h.push(f);
    return Math.floor(h.heldS);
  }
  const c = new TemplateCounter(tpl);
  let n = 0;
  for (const f of frames) n += c.push(f).reps.length;
  return n;
}

/** The custom move's demo as a loop the demo screen plays (twice before its first set, like the catalogue's). */
export function templateDemo(moveId: string, tpl: MoveTemplate): DemoLoop {
  const W = 480;
  const H = 640;
  const rows = tpl.demo.frames.length ? tpl.demo.frames : [];
  const n = Math.max(1, rows.length);
  const step = tpl.demo.ms / n;
  const frames: PoseFrame[] = rows.map((row, i) => {
    const joints: Partial<Record<Joint, Pt>> = {};
    DEMO_JOINTS.forEach((j, k) => {
      const x = row[k * 2];
      const y = row[k * 2 + 1];
      if (x !== null && x !== undefined && y !== null && y !== undefined) joints[j] = { x: x / W, y: y / H, c: 0.95 };
    });
    return { t: Math.round(i * step), w: W, h: H, joints };
  });
  // A hold's two keyframes: hold the position for most of the loop.
  return { move: moveId, frames: frames.length ? frames : [{ t: 0, w: W, h: H, joints: {} }], loopMs: tpl.demo.ms, view: tpl.demo.view };
}
