// Copied from VVFit packages/game-core/src/cameraReps.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): reps and holds from joint angles. A move (cameraMoves.ts) names one signal (an angle, the
 * torso's tilt, how far the hips dropped toward the knees, how high the wrists are); a rep is that signal leaving its
 * rest position, reaching the worked position and coming back. Holds are time spent inside a range. Form checks read
 * the frames at the rep's extremes. Pure and deterministic: the tests replay recorded-like landmark sequences.
 */
import {
  angleAt,
  angleToPoint,
  ankleOrBelowKnee,
  fromVertical,
  headPoint,
  meanConfidence,
  mid,
  MIN_CONF,
  ok,
  seen,
  shoulderSpan,
  shoulderWidth,
  Smoother,
  torsoLength,
  torsoTilt,
  viewOf,
  type Joint,
  type PoseFrame,
} from "./cameraPose";

/** A joint without its side ("Elbow" → lElbow / rElbow), or the nose. */
export type BodyPart = "Shoulder" | "Elbow" | "Wrist" | "Hip" | "Knee" | "Ankle" | "Ear" | "Eye" | "nose";
/**
 * How the two sides combine: their average (`both`, either side alone when one is hidden), the smaller or larger, one
 * side, or `alt`: each side on its own (alternating moves: each side's rep counts).
 */
export type SideMode = "both" | "min" | "max" | "l" | "r" | "alt";

export type SignalSpec =
  /**
   * The angle at b between a and c, degrees. `cOr`: what stands in for c when c isn't seen (c is the ankle: feet are
   * optional): another joint on the same line (the knee for a straight body line), or `belowKnee` (the shin straight
   * down under the knee, for standing knee bends).
   */
  | { k: "angle"; a: BodyPart; b: BodyPart; c: BodyPart; side: SideMode; cOr?: BodyPart | "belowKnee" }
  /** The shoulders→hips line from vertical, degrees (0 standing, 90 lying or in a plank). */
  | { k: "tilt" }
  /** Hip above knee, in standing torso lengths (about 0.8 standing, 0 with the thigh level). */
  | { k: "drop"; side: SideMode }
  /** Wrist above shoulder, in torso lengths (about −1 arms down, +0.7 overhead). */
  | { k: "height"; side: SideMode }
  /** Elbow above shoulder, in torso lengths. */
  | { k: "elbowHeight"; side: SideMode }
  /**
   * Wrist below shoulder, in shoulder widths (facing the phone on the floor: a push-up seen head-on, where the torso's
   * tilt and the elbow angle can't be read, the shoulders still go down to the hands and back up). About 1.3–1.5 with
   * the arms straight, under 0.8 at the bottom. Needs both shoulders.
   */
  | { k: "reach"; side: SideMode }
  /** Shoulder width against torso length (cameraPose.ts shoulderSpan): which way the torso points at the phone. */
  | { k: "span" }
  /** How far apart the two knees are in height: |left drop − right drop|, torso lengths (one knee forward: a lunge). */
  | { k: "dropGap" }
  /**
   * Skills (ADR-0060): the angle between the two thighs at the middle of the hips, degrees: about 0–25 standing,
   * 180 in a full split (a front split seen side-on, a middle split seen from the front). Needs both hips and knees.
   */
  | { k: "spread" }
  /**
   * Skills (ADR-0060): the hips above the shoulders, in torso lengths (about −1 standing, 0 lying flat, above 0.3 in a
   * bridge pushed up from the floor).
   */
  | { k: "hipsAbove" };

const SIDES = { l: "l", r: "r" } as const;
const joint = (p: BodyPart, s: "l" | "r"): Joint => (p === "nose" ? "nose" : (`${s}${p}` as Joint));

/** One side's raw value (no smoothing). `ref`: the standing torso length (for the scaled signals). */
function sideValue(f: PoseFrame, spec: SignalSpec, s: "l" | "r", ref: number): number | null {
  switch (spec.k) {
    case "angle": {
      const v = angleAt(f, joint(spec.a, s), joint(spec.b, s), joint(spec.c, s));
      if (v !== null || !spec.cOr) return v;
      if (spec.cOr === "belowKnee") {
        const p = ankleOrBelowKnee(f, s);
        return p ? angleToPoint(f, joint(spec.a, s), joint(spec.b, s), p) : null;
      }
      return angleAt(f, joint(spec.a, s), joint(spec.b, s), joint(spec.cOr, s));
    }
    case "drop": {
      const h = f.joints[joint("Hip", s)];
      const k = f.joints[joint("Knee", s)];
      if (!h || !k || h.c < MIN_CONF || k.c < MIN_CONF || ref <= 0) return null;
      return (k.y - h.y) / ref;
    }
    case "height": {
      const sh = f.joints[joint("Shoulder", s)];
      const w = f.joints[joint("Wrist", s)];
      if (!sh || !w || sh.c < MIN_CONF || w.c < MIN_CONF || ref <= 0) return null;
      return (sh.y - w.y) / ref;
    }
    case "elbowHeight": {
      const sh = f.joints[joint("Shoulder", s)];
      const e = f.joints[joint("Elbow", s)];
      if (!sh || !e || sh.c < MIN_CONF || e.c < MIN_CONF || ref <= 0) return null;
      return (sh.y - e.y) / ref;
    }
    case "reach": {
      const sh = f.joints[joint("Shoulder", s)];
      const w = f.joints[joint("Wrist", s)];
      const sw = shoulderWidth(f);
      if (!sh || !w || sh.c < MIN_CONF || w.c < MIN_CONF || !sw) return null;
      return (w.y - sh.y) / sw;
    }
    case "tilt":
    case "span":
    case "dropGap":
    case "spread":
    case "hipsAbove":
      return wholeValue(f, spec, ref);
  }
}

/** Signals of the whole body (no side). */
function wholeValue(f: PoseFrame, spec: SignalSpec, ref: number): number | null {
  switch (spec.k) {
    case "tilt":
      return torsoTilt(f);
    case "span":
      return shoulderSpan(f);
    case "dropGap": {
      const l = sideValue(f, { k: "drop", side: "l" }, "l", ref);
      const r = sideValue(f, { k: "drop", side: "r" }, "r", ref);
      return l === null || r === null ? null : Math.abs(l - r);
    }
    case "spread": {
      if (!ok(f, "lHip", "rHip", "lKnee", "rKnee")) return null;
      const ar = f.w / f.h;
      const lh = f.joints.lHip!;
      const rh = f.joints.rHip!;
      const hx = ((lh.x + rh.x) / 2) * ar;
      const hy = (lh.y + rh.y) / 2;
      const lk = f.joints.lKnee!;
      const rk = f.joints.rKnee!;
      const ax = lk.x * ar - hx;
      const ay = lk.y - hy;
      const bx = rk.x * ar - hx;
      const by = rk.y - hy;
      const n = Math.hypot(ax, ay) * Math.hypot(bx, by);
      if (n < 1e-9) return null;
      return (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / n))) * 180) / Math.PI;
    }
    case "hipsAbove": {
      const s = mid(f, "lShoulder", "rShoulder");
      const h = mid(f, "lHip", "rHip");
      if (!s || !h || ref <= 0) return null;
      return (s.y - h.y) / ref;
    }
    default:
      return null;
  }
}

const isWhole = (spec: SignalSpec): spec is Extract<SignalSpec, { k: "tilt" | "span" | "dropGap" | "spread" | "hipsAbove" }> =>
  spec.k === "tilt" || spec.k === "span" || spec.k === "dropGap" || spec.k === "spread" || spec.k === "hipsAbove";

/** The joints one side of a signal reads (for its confidence). */
function sideJoints(spec: SignalSpec, s: "l" | "r"): Joint[] {
  switch (spec.k) {
    case "angle":
      return [joint(spec.a, s), joint(spec.b, s)];
    case "drop":
      return [joint("Hip", s), joint("Knee", s)];
    case "height":
    case "reach":
      return [joint("Shoulder", s), joint("Wrist", s)];
    case "elbowHeight":
      return [joint("Shoulder", s), joint("Elbow", s)];
    default:
      return [];
  }
}

/** How surely a side's value is seen: its joints' lowest confidence (the far limb of a side view is a guess). */
function sideSure(f: PoseFrame, spec: SignalSpec, s: "l" | "r"): number {
  const js = sideJoints(spec, s);
  // The far end when it's used (an ankle with a stand-in isn't: the stand-in reads the joints above it).
  if (spec.k === "angle" && (!spec.cOr || seen(f, joint(spec.c, s)))) js.push(joint(spec.c, s));
  let m = 1;
  for (const j of js) m = Math.min(m, f.joints[j]?.c ?? 0);
  return m;
}

/**
 * Side-on, the far arm or leg is behind the body: detectors guess it, often straight, and averaging that guess with
 * the arm you can see halves the movement (2026-10-26 tester: push-ups from the side never counted). When one side is
 * seen clearly more surely than the other (by SURE_MARGIN), an average of an arm angle reads that side alone.
 */
export const SURE_MARGIN = 0.12;

/** The signal's value(s) this frame: one channel, or two for `alt` (left, right). */
export function signalValues(f: PoseFrame, spec: SignalSpec, ref: number): (number | null)[] {
  if (isWhole(spec)) return [wholeValue(f, spec, ref)];
  return combineSides(spec.side, sideValue(f, spec, SIDES.l, ref), sideValue(f, spec, SIDES.r, ref), preferSide(f, spec));
}

/** The side an average should read alone (see SURE_MARGIN), or null. */
function preferSide(f: PoseFrame, spec: SignalSpec): "l" | "r" | null {
  // Arm angles only: two arms move alike in every two-arm move, so the near one speaks for both. Legs don't (a lunge's
  // front and back hips differ: its average is the signal), nor do heights and drops (read near the torso).
  if (spec.k !== "angle" || spec.side !== "both" || (spec.b !== "Elbow" && spec.b !== "Shoulder")) return null;
  const l = sideSure(f, spec, "l");
  const r = sideSure(f, spec, "r");
  return l - r >= SURE_MARGIN ? "l" : r - l >= SURE_MARGIN ? "r" : null;
}

function combineSides(side: SideMode, l: number | null, r: number | null, prefer: "l" | "r" | null = null): (number | null)[] {
  switch (side) {
    case "alt":
      return [l, r];
    case "l":
      return [l];
    case "r":
      return [r];
    case "min":
      return [l === null ? r : r === null ? l : Math.min(l, r)];
    case "max":
      return [l === null ? r : r === null ? l : Math.max(l, r)];
    case "both":
      if (prefer === "l" && l !== null) return [l];
      if (prefer === "r" && r !== null) return [r];
      return [l === null ? r : r === null ? l : (l + r) / 2];
  }
}

/** How long a side that dropped out keeps its last value (ms). */
export const SIDE_HOLD_MS = 500;

/**
 * Signal values with each side's last value kept a moment: one side missing for a frame or two (a knee hidden, a
 * wrist blurred) shouldn't swap a min / max / average to the other side, whose value can be far off (the back leg of
 * a lunge): that would count a rep that didn't happen.
 */
export class SideMemo {
  private l: { v: number; t: number } | null = null;
  private r: { v: number; t: number } | null = null;
  private prefer: { s: "l" | "r"; t: number } | null = null;
  values(f: PoseFrame, spec: SignalSpec, ref: number): (number | null)[] {
    if (isWhole(spec)) return [wholeValue(f, spec, ref)];
    if (spec.side === "alt" || spec.side === "l" || spec.side === "r") return signalValues(f, spec, ref);
    let l = sideValue(f, spec, "l", ref);
    let r = sideValue(f, spec, "r", ref);
    // The surer side, judged only on frames where both sides are read (a joint dropped for a frame on the near side
    // isn't a reason to switch to the guess), and kept a moment.
    if (l !== null && r !== null) {
      const p = preferSide(f, spec);
      if (p) this.prefer = { s: p, t: f.t };
      else if (this.prefer && f.t - this.prefer.t > SIDE_HOLD_MS * 2) this.prefer = null;
    }
    if (l !== null) this.l = { v: l, t: f.t };
    else if (this.l && f.t - this.l.t <= SIDE_HOLD_MS) l = this.l.v;
    if (r !== null) this.r = { v: r, t: f.t };
    else if (this.r && f.t - this.r.t <= SIDE_HOLD_MS) r = this.r.v;
    return combineSides(spec.side, l, r, this.prefer?.s ?? null);
  }
}

/** Left minus right of a signal (symmetry), null unless both sides are seen. */
export function sideGap(f: PoseFrame, spec: SignalSpec, ref: number): number | null {
  if (isWhole(spec)) return null;
  const l = sideValue(f, spec, "l", ref);
  const r = sideValue(f, spec, "r", ref);
  return l === null || r === null ? null : l - r;
}

/**
 * A rep: the signal moves from `rest` toward `work` (down: it gets smaller, e.g. the knee angle in a squat; up: it
 * gets bigger) and comes back. Counted when it passed `work` and came back past `rest`.
 */
export interface RepSpec {
  dir: "down" | "up";
  /** Rest (start) position: the signal must be back past this to finish a rep. */
  rest: number;
  /** Worked position: reaching it counts the rep. */
  work: number;
  /** The ideal worked position (depth, lockout overhead…): reps short of it get the `depth` cue. */
  good?: number;
  /** The ideal rest position (standing tall, arms straight, full hang): short of it, the `lockout` cue. */
  lockout?: number;
  /** A rep faster than this is noise (s). */
  minS?: number;
  /** Slower than this, it's not a rep any more (s). */
  maxS?: number;
  /**
   * How the body has to travel between the rest and the worked position for the rep to count (beyond the signal):
   * the hands stay planted in a push-up (a row or a curl moves them), the hips go down in a lunge (a march doesn't).
   */
  path?: PathCheck[];
  /**
   * Adapts the worked position to your own range (within safe bounds): after a few consistent reps that all stop at
   * the same depth short of `work` (and none reached it), that depth counts (as `limited` reps). Never below
   * ADAPT.minShare of the way from rest to work.
   */
  adapt?: boolean;
  /**
   * The signal as a share of its own top (the largest value seen, slowly forgotten): for a signal whose scale depends
   * on the person (arm length against shoulder width, facing the phone), `rest`, `work` and `good` are shares of it.
   */
  relTop?: boolean;
  /** The frames the top is learnt from (the body in this move's position: not a push-up's top seen from another angle). */
  topWhen?: Guard[];
}

/**
 * A body part's travel from the rest frame to the worked frame: `down` (+ = moved down the picture) or `any` (the
 * distance moved), in torso lengths (`per: 'torso'`, default) or shoulder widths. The part is the mean of the two
 * sides seen (or the one seen).
 */
export interface PathCheck {
  part: BodyPart;
  axis: "down" | "any";
  min?: number;
  max?: number;
  per?: "torso" | "shoulders";
}

/** Range adaptation (RepSpec.adapt). */
export const ADAPT = {
  /** Consistent short reps before the range adapts. */
  reps: 3,
  /** At least this share of the way from rest to work, always (rocking in a plank must not become push-ups). */
  minShare: 0.65,
  /** "Consistent": their depths within this share of the rest→work span. */
  spread: 0.25,
  /** Not once you've shown more full reps than this (you can go deeper: the "go lower" cue is the help then). */
  maxFull: 1,
} as const;

export interface HoldSpec {
  /** The signal stays in [lo, hi]. */
  lo: number;
  hi: number;
}

/** Must hold at the worked frame for the rep to count (and every frame for a hold): body position checks. */
export interface Guard {
  sig: SignalSpec;
  min?: number;
  max?: number;
  /**
   * Checked only when it can be read: a body line to the knees when the legs are out of the picture (the phone close
   * to the head of a push-up). The other guards and the move's path checks still hold.
   */
  optional?: boolean;
}

export type CueId =
  | "depth"
  | "lockout"
  | "knee_valgus"
  | "chest_up"
  | "hinge_more"
  | "elbow_flare"
  | "symmetry"
  | "hips_sag"
  | "hips_pike"
  | "elbow_swing"
  | "knees_soft"
  | "too_high"
  | "slow_down"
  | "chin_over"
  | "upright";

export interface CueCheck {
  id: CueId;
  /** The threshold the check uses (degrees or the signal's unit), when it takes one. */
  v?: number;
}

const CUE_VIEW: Partial<Record<CueId, "front" | "side">> = {
  knee_valgus: "front",
  elbow_flare: "front",
  symmetry: "front",
  chest_up: "side",
  hinge_more: "side",
  hips_sag: "side",
  hips_pike: "side",
  knees_soft: "side",
  upright: "side",
};

/**
 * The shoulders→hips→ankles line (the knees without the feet: they're on the same line in a plank): 180 straight;
 * whether the hips are below (sag) or above (pike) the line.
 */
function bodyLine(f: PoseFrame): { deg: number; hipsLow: boolean } | null {
  const s = mid(f, "lShoulder", "rShoulder");
  const h = mid(f, "lHip", "rHip");
  const a = mid(f, "lAnkle", "rAnkle") ?? mid(f, "lKnee", "rKnee");
  if (!s || !h || !a) return null;
  const v1x = (s.x - h.x) * f.w;
  const v1y = (s.y - h.y) * f.h;
  const v2x = (a.x - h.x) * f.w;
  const v2y = (a.y - h.y) * f.h;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n < 1e-9) return null;
  const deg = (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n))) * 180) / Math.PI;
  // The hip's height against the shoulder→ankle line at its x (y grows downward).
  const t = Math.abs(a.x - s.x) < 1e-6 ? 0.5 : (h.x - s.x) / (a.x - s.x);
  const lineY = s.y + t * (a.y - s.y);
  return { deg, hipsLow: h.y > lineY };
}

/** Upper arm (shoulder → elbow) from vertical, the larger of the two sides, degrees. */
function upperArmSwing(f: PoseFrame): number | null {
  const l = fromVertical(f, "lShoulder", "lElbow");
  const r = fromVertical(f, "rShoulder", "rElbow");
  return l === null ? r : r === null ? l : Math.max(l, r);
}

export interface RepEvent {
  /** ms of the frame that finished it. */
  t: number;
  /** Which channel (0, or 1 for the right side of an `alt` move). */
  ch: number;
  /** Seconds from leaving rest to back at rest, and the way down / up. */
  durS: number;
  downS: number;
  upS: number;
  /** The extremes reached (signal units). */
  worked: number;
  rested: number;
  /** Range of motion: % of the move's ideal range reached (rest threshold → `good`), at most 120. */
  romPct: number;
  cues: CueId[];
  /**
   * `complete`: reached the worked position; `limited`: reached your own consistent range (RepSpec.adapt), short of
   * the standard one; `uncertain`: counted, but the joints were seen unsurely (low confidence): the summary labels it.
   * Absent (taught moves' template counter): complete.
   */
  quality?: RepQuality;
}

export type RepQuality = "complete" | "limited" | "uncertain";

/** Below this mean confidence of the signal's joints at the worked frame, a rep is `uncertain` and gets no form cue. */
export const SURE_CONF = 0.45;

export interface PartialEvent {
  t: number;
  ch: number;
  /** How far toward `work` it got, signal units. */
  reached: number;
}

interface Channel {
  smooth: Smoother;
  /** At rest, waiting; moving toward work; past work, coming back. */
  phase: "unknown" | "rest" | "going" | "worked";
  restExt: number;
  workExt: number;
  restFrame: PoseFrame | null;
  workFrame: PoseFrame | null;
  leftRestT: number;
  workT: number;
  lastSeenT: number;
  /** Path checks (RepSpec.path): where each part was at rest (per side), and its two largest moves since. */
  anchor: { l?: { x: number; y: number }; r?: { x: number; y: number } }[];
  pathTop: [number, number][];
}

const LOST_MS = 1500;

/**
 * Counts reps on one move. Feed frames in time order; each `push` returns the reps finished (and partial reps: the
 * signal turned back halfway without reaching `work`, for the `depth` cue).
 */
export class RepCounter {
  private chans: Channel[];
  private ref = 0;
  private refSmooth = new Smoother(0.8, 0);
  private memo = new SideMemo();
  /** The worked position in use (oriented): the move's, or your own consistent range (RepSpec.adapt). */
  private workEff: number;
  /** Depths (oriented) of the recent reps that turned back short of work; reps that reached it. */
  private shortDepths: number[] = [];
  private fullReps = 0;
  /** Reps that reached the signal's worked position but not the move's path (hands moved, hips didn't go down). */
  rejected = 0;

  constructor(
    readonly sig: SignalSpec,
    readonly rep: RepSpec,
    readonly guards: readonly Guard[] = [],
    readonly checks: readonly CueCheck[] = [],
  ) {
    const n = !isWhole(sig) && sig.side === "alt" ? 2 : 1;
    this.chans = Array.from({ length: n }, () => this.fresh());
    this.workEff = this.o(rep.work);
  }

  /** The worked position counted now (signal units): the move's, or your own range once it adapted. */
  get workNow(): number {
    return this.o(this.workEff);
  }
  /** Whether the worked position adapted to your range. */
  get adapted(): boolean {
    return this.workEff !== this.o(this.rep.work);
  }

  private fresh(): Channel {
    const n = this.rep.path?.length ?? 0;
    return {
      smooth: new Smoother(),
      phase: "unknown",
      restExt: NaN,
      workExt: NaN,
      restFrame: null,
      workFrame: null,
      leftRestT: 0,
      workT: 0,
      lastSeenT: 0,
      anchor: Array.from({ length: n }, () => ({})),
      pathTop: Array.from({ length: n }, () => [-Infinity, -Infinity] as [number, number]),
    };
  }

  /** The standing torso length the scaled signals use (the largest seen, smoothed). */
  get reference() {
    return this.ref;
  }

  /** Signal in "down" orientation: bigger = nearer rest. */
  private o(x: number) {
    return this.rep.dir === "down" ? x : -x;
  }

  private tops: number[] = [];
  /** A value as a share of its channel's top (RepSpec.relTop): the top is the largest seen, forgotten slowly. */
  private ofTop(ch: number, x: number | null, learn: boolean): number | null {
    if (x === null) return null;
    const top = learn ? Math.max((this.tops[ch] ?? 0) * 0.9998, x) : (this.tops[ch] ?? 0);
    this.tops[ch] = top;
    return top > 0 ? x / top : null;
  }

  /** Optional guards: their last verdict while seen; only out of the picture for a while do they stop counting. */
  private optSeen = new Map<number, { t: number; ok: boolean }>();
  /** Every frame: the optional guards' verdicts while their parts are seen. */
  private noteOptional(f: PoseFrame) {
    this.guards.forEach((g, i) => {
      if (!g.optional) return;
      const v = guardValue(f, g, this.ref);
      if (v !== null) this.optSeen.set(i, { t: f.t, ok: (g.min === undefined || v >= g.min) && (g.max === undefined || v <= g.max) });
    });
  }
  private guardsOk(f: PoseFrame): boolean {
    let ok = true;
    this.guards.forEach((g, i) => {
      const v = guardValue(f, g, this.ref);
      if (v === null) {
        if (!g.optional) ok = false;
        else {
          const last = this.optSeen.get(i);
          if (last && f.t - last.t < OPTIONAL_MEMORY_MS && !last.ok) ok = false;
        }
        return;
      }
      if (!((g.min === undefined || v >= g.min) && (g.max === undefined || v <= g.max))) ok = false;
    });
    return ok;
  }

  /** Tracks the path checks' parts: anchored while at rest, their largest move from there during the rep. */
  private trackPath(c: Channel, f: PoseFrame, anchorHere: boolean) {
    const checks = this.rep.path;
    if (!checks?.length) return;
    checks.forEach((p, i) => {
      const pts = { l: sidePoint(f, p.part, "l"), r: sidePoint(f, p.part, "r") };
      if (c.phase === "unknown" || c.phase === "rest") {
        if (anchorHere) {
          if (pts.l) c.anchor[i]!.l = pts.l;
          if (pts.r) c.anchor[i]!.r = pts.r;
        }
        c.pathTop[i] = [-Infinity, -Infinity];
        return;
      }
      const unit = p.per === "shoulders" ? shoulderWidth(f) : this.ref;
      if (!unit || unit <= 0) return;
      const ds: number[] = [];
      for (const s of ["l", "r"] as const) {
        const a = c.anchor[i]![s];
        const b = pts[s];
        if (!a || !b) continue;
        ds.push(p.axis === "down" ? b.y - a.y : Math.hypot((b.x - a.x) * (f.w / f.h), b.y - a.y));
      }
      if (!ds.length) return;
      const d = ds.reduce((x, y) => x + y, 0) / ds.length / unit;
      const top = c.pathTop[i]!;
      if (d > top[0]) c.pathTop[i] = [d, top[0]];
      else if (d > top[1]) top[1] = d;
    });
  }

  push(f: PoseFrame): { reps: RepEvent[]; partials: PartialEvent[] } {
    const tl = torsoLength(f);
    if (tl) {
      const s = this.refSmooth.push(f.t, tl);
      this.ref = Math.max(this.ref * 0.9995, s);
    }
    let vals = this.memo.values(f, this.sig, this.ref);
    if (this.rep.relTop) {
      const learn = !this.rep.topWhen || guardsHold(f, this.rep.topWhen, this.ref);
      vals = vals.map((x, i) => this.ofTop(i, x, learn));
    }
    this.noteOptional(f);
    const reps: RepEvent[] = [];
    const partials: PartialEvent[] = [];
    const rest = this.o(this.rep.rest);
    const work = this.workEff;
    const half = (rest + this.o(this.rep.work)) / 2;
    vals.forEach((raw, ch) => {
      const c = this.chans[ch]!;
      if (raw === null) {
        if (c.lastSeenT && f.t - c.lastSeenT > LOST_MS) {
          c.phase = "unknown";
          c.smooth.reset();
        }
        return;
      }
      c.lastSeenT = f.t;
      const v = this.o(c.smooth.push(f.t, raw));
      // Anchored at the most rested frame (the top of the rep), not the last one before leaving rest.
      this.trackPath(c, f, c.phase === "unknown" || (c.phase === "rest" && v >= c.restExt));
      switch (c.phase) {
        case "unknown":
          if (v >= rest) {
            c.phase = "rest";
            c.restExt = v;
            c.restFrame = f;
          }
          break;
        case "rest":
          if (v >= c.restExt) {
            c.restExt = v;
            c.restFrame = f;
          }
          if (v < rest) {
            c.phase = "going";
            c.leftRestT = f.t;
            c.workExt = v;
            c.workFrame = f;
          }
          break;
        case "going":
          if (v < c.workExt) {
            c.workExt = v;
            c.workFrame = f;
          }
          if (v <= work && this.guardsOk(f)) {
            c.phase = "worked";
            c.workT = f.t;
          } else if (v >= rest) {
            // Back without reaching the worked position: a partial rep if it got at least halfway.
            // (Only in the move's position: a row seen in a push-up set isn't a shallow push-up.)
            if (c.workExt <= half && c.workFrame && guardsHold(c.workFrame, this.guards, this.ref)) {
              partials.push({ t: f.t, ch, reached: this.o(c.workExt) });
              this.noteShort(c.workExt);
            }
            c.phase = "rest";
            c.restExt = v;
            c.restFrame = f;
          } else if (f.t - c.leftRestT > (this.rep.maxS ?? 15) * 1000) {
            c.phase = "unknown";
          }
          break;
        case "worked":
          if (v < c.workExt) {
            c.workExt = v;
            c.workFrame = f;
            c.workT = f.t;
          }
          if (v >= rest) {
            const durS = (f.t - c.leftRestT) / 1000;
            const okDur = durS >= (this.rep.minS ?? 0.4) && durS <= (this.rep.maxS ?? 15);
            if (okDur && !this.pathOk(c)) this.rejected++;
            else if (okDur) {
              const ev = this.repEvent(c, ch, f, durS);
              if (ev.quality !== "limited") this.fullReps++;
              reps.push(ev);
            }
            c.phase = "rest";
            c.restExt = v;
            c.restFrame = f;
          } else if (f.t - c.leftRestT > (this.rep.maxS ?? 15) * 1000) {
            c.phase = "unknown";
          }
          break;
      }
    });
    return { reps, partials };
  }

  /** A rep that turned back short: after ADAPT.reps consistent ones (and no full rep), that depth counts. */
  private noteShort(depth: number) {
    if (!this.rep.adapt || this.fullReps > ADAPT.maxFull || this.adapted) return;
    const rest = this.o(this.rep.rest);
    const work = this.o(this.rep.work);
    const span = rest - work;
    const floor = rest - ADAPT.minShare * span;
    this.shortDepths.push(depth);
    if (this.shortDepths.length > ADAPT.reps) this.shortDepths.shift();
    if (this.shortDepths.length < ADAPT.reps) return;
    const hi = Math.max(...this.shortDepths);
    const lo = Math.min(...this.shortDepths);
    if (hi > floor || hi - lo > ADAPT.spread * span) return;
    this.workEff = Math.min(floor, hi + 0.03 * span);
  }

  /**
   * The move's path checks over the rep: a part's second-largest move from where it was at rest (one glitched frame
   * isn't a move). A part never seen fails its check (true without checks).
   */
  private pathOk(c: Channel): boolean {
    const checks = this.rep.path;
    if (!checks?.length) return true;
    return checks.every((p, i) => {
      const d = c.pathTop[i]![1] === -Infinity ? c.pathTop[i]![0] : c.pathTop[i]![1];
      if (d === -Infinity) return false;
      if (p.min !== undefined && d < p.min) return false;
      if (p.max !== undefined && d > p.max) return false;
      return true;
    });
  }

  private repEvent(c: Channel, ch: number, f: PoseFrame, durS: number): RepEvent {
    const worked = this.o(c.workExt);
    const rested = this.o(c.restExt);
    // How much of the ideal range it covered: from the rest threshold to `good` (100 = all of it, capped at 120).
    const good = this.rep.good ?? this.rep.work;
    const span = Math.abs(this.rep.rest - good) || 1;
    const past = this.rep.dir === "down" ? this.rep.rest - worked : worked - this.rep.rest;
    const romPct = Math.round(Math.min(1.2, Math.max(0, past / span)) * 100);
    const downS = Math.max(0, (c.workT - c.leftRestT) / 1000);
    const limited = c.workExt > this.o(this.rep.work);
    const sure = c.workFrame ? signalConfidence(c.workFrame, this.sig) >= SURE_CONF : false;
    const quality: RepQuality = !sure ? "uncertain" : limited ? "limited" : "complete";
    const ev: RepEvent = { t: f.t, ch, durS, downS, upS: Math.max(0, durS - downS), worked, rested, romPct, cues: [], quality };
    ev.cues = repCues(this, ev, c.workFrame, c.restFrame);
    return ev;
  }
}

/** How long an optional guard's last verdict stands while its parts aren't seen (ms). */
export const OPTIONAL_MEMORY_MS = 1500;

/** A guard's value on this frame (null: its joints aren't seen). */
export function guardValue(f: PoseFrame, g: Guard, ref: number): number | null {
  const [v] = signalValues(f, !isWhole(g.sig) && g.sig.side === "alt" ? { ...g.sig, side: "both" } : g.sig, ref);
  return v ?? null;
}

/** One side's joint of a body part, when seen (the nose for both sides). */
function sidePoint(f: PoseFrame, p: BodyPart, s: "l" | "r"): { x: number; y: number } | null {
  const j = joint(p, s);
  return seen(f, j) ? f.joints[j]! : null;
}

/** All guards hold on this frame. */
export function guardsHold(f: PoseFrame, guards: readonly Guard[], ref: number): boolean {
  return guardState(f, guards, ref) === "ok";
}

/**
 * The guards on this frame: `ok`; `out` (seen, and out of position); `unseen` (a guard's joints aren't seen: tracking,
 * not the body). Out wins over unseen.
 */
export function guardState(f: PoseFrame, guards: readonly Guard[], ref: number): "ok" | "out" | "unseen" {
  let unseen = false;
  for (const g of guards) {
    const [v] = signalValues(f, !isWhole(g.sig) && g.sig.side === "alt" ? { ...g.sig, side: "both" } : g.sig, ref);
    if (v === null || v === undefined) {
      if (!g.optional) unseen = true;
      continue;
    }
    if (g.min !== undefined && v < g.min) return "out";
    if (g.max !== undefined && v > g.max) return "out";
  }
  return unseen ? "unseen" : "ok";
}

/** Where a body part is: the mean of both sides seen, or the one seen (the nose: itself). */
export function partPoint(f: PoseFrame, p: BodyPart): { x: number; y: number } | null {
  if (p === "nose") return seen(f, "nose") ? f.joints.nose! : null;
  return mid(f, joint(p, "l"), joint(p, "r"));
}

/**
 * A body part in two frames, from the same joints in both (both sides when both are seen in both frames, else the
 * side seen in both): a wrist dropped in one frame mustn't look like the hands moved.
 */
export function partPair(a: PoseFrame, b: PoseFrame, p: BodyPart): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (p === "nose") return seen(a, "nose") && seen(b, "nose") ? [a.joints.nose!, b.joints.nose!] : null;
  const L = joint(p, "l");
  const R = joint(p, "r");
  const both = (f: PoseFrame) => ({ x: (f.joints[L]!.x + f.joints[R]!.x) / 2, y: (f.joints[L]!.y + f.joints[R]!.y) / 2 });
  if (ok(a, L, R) && ok(b, L, R)) return [both(a), both(b)];
  if (seen(a, L) && seen(b, L)) return [a.joints[L]!, b.joints[L]!];
  if (seen(a, R) && seen(b, R)) return [a.joints[R]!, b.joints[R]!];
  return null;
}

/** The mean confidence of the joints a signal reads (both sides; for the whole-body ones, shoulders and hips). */
export function signalConfidence(f: PoseFrame, sig: SignalSpec): number {
  if (isWhole(sig)) return meanConfidence(f, ["lShoulder", "rShoulder", "lHip", "rHip"]);
  const l = meanConfidence(f, sideJoints(sig, "l"));
  const r = meanConfidence(f, sideJoints(sig, "r"));
  // Side-on, the near side is what counted.
  return Math.max(l, r);
}

/** The form cues a finished rep raises, in priority order. */
export function repCues(rc: RepCounter, ev: RepEvent, workFrame: PoseFrame | null, restFrame: PoseFrame | null): CueId[] {
  const out: CueId[] = [];
  // Conservative: no form cue from a rep seen unsurely; your own consistent range isn't "too shallow" any more.
  if (ev.quality === "uncertain") return out;
  const dir = rc.rep.dir === "down" ? 1 : -1;
  const view = workFrame ? viewOf(workFrame) : null;
  for (const chk of rc.checks) {
    const need = CUE_VIEW[chk.id];
    if (need && view !== need) continue;
    switch (chk.id) {
      case "depth":
        if (ev.quality !== "limited" && rc.rep.good !== undefined && dir * (ev.worked - rc.rep.good) > 0) out.push("depth");
        break;
      case "lockout":
        if (rc.rep.lockout !== undefined && dir * (rc.rep.lockout - ev.rested) > 0) out.push("lockout");
        break;
      case "slow_down":
        if (ev.downS < (chk.v ?? 0.5)) out.push("slow_down");
        break;
      default:
        if (frameCue(chk, workFrame, rc)) out.push(chk.id);
    }
  }
  return out;
}

/** Checks read from one frame (the worked position). */
function frameCue(chk: CueCheck, f: PoseFrame | null, rc: Pick<RepCounter, "sig" | "reference">): boolean {
  if (!f) return false;
  switch (chk.id) {
    case "knee_valgus": {
      if (!ok(f, "lKnee", "rKnee", "lAnkle", "rAnkle")) return false;
      const knees = Math.abs(f.joints.lKnee!.x - f.joints.rKnee!.x);
      const ankles = Math.abs(f.joints.lAnkle!.x - f.joints.rAnkle!.x);
      return ankles > 0.03 && knees < ankles * (chk.v ?? 0.8);
    }
    case "chest_up": {
      const t = torsoTilt(f);
      return t !== null && t > (chk.v ?? 50);
    }
    case "hinge_more": {
      const t = torsoTilt(f);
      return t !== null && t < (chk.v ?? 30);
    }
    case "upright": {
      const t = torsoTilt(f);
      return t !== null && t > (chk.v ?? 20);
    }
    case "elbow_flare": {
      const l = angleAt(f, "lHip", "lShoulder", "lElbow");
      const r = angleAt(f, "rHip", "rShoulder", "rElbow");
      const a = l === null ? r : r === null ? l : Math.max(l, r);
      return a !== null && a > (chk.v ?? 75);
    }
    case "symmetry": {
      const g = sideGap(f, rc.sig, rc.reference);
      if (g === null) return false;
      return Math.abs(g) > (chk.v ?? 15);
    }
    case "hips_sag": {
      const b = bodyLine(f);
      return !!b && b.hipsLow && b.deg < (chk.v ?? 160);
    }
    case "hips_pike": {
      const b = bodyLine(f);
      return !!b && !b.hipsLow && b.deg < (chk.v ?? 160);
    }
    case "elbow_swing": {
      const s = upperArmSwing(f);
      return s !== null && s > (chk.v ?? 30);
    }
    case "knees_soft": {
      const l = angleAt(f, "lHip", "lKnee", "lAnkle");
      const r = angleAt(f, "rHip", "rKnee", "rAnkle");
      const a = l === null ? r : r === null ? l : Math.min(l, r);
      return a !== null && a < (chk.v ?? 135);
    }
    case "too_high": {
      const [v] = signalValues(f, !isWhole(rc.sig) && rc.sig.side === "alt" ? { ...rc.sig, side: "max" } : rc.sig, rc.reference);
      return v !== null && v !== undefined && v > (chk.v ?? 110);
    }
    case "chin_over": {
      // Only from a head actually seen: never a cue from a guess.
      const n = headPoint(f);
      const w = mid(f, "lWrist", "rWrist");
      return !!n && !n.estimated && !!w && n.y > w.y;
    }
    default:
      return false;
  }
}

/** Hold timing (HoldTimer). */
export const HOLD = {
  /** In position this long before the clock starts (ms). */
  enterMs: 1000,
  /** Seen out of position this long: a genuine break; the clock gives back the time since you left (ms). */
  breakMs: 1200,
  /**
   * The body not seen (tracking lost, not you), or no frames at all: the clock keeps going this long, then pauses
   * (ms). Credited when you're in position before and after.
   */
  lossGraceMs: 3000,
} as const;

/**
 * Where a hold stands. `waiting`: never in position yet (the clock hasn't started: get into position first);
 * `settling`: in position, under HOLD.enterMs; `holding`: the clock runs; `wobble`: out of position for a moment (the
 * clock runs on, given back if it becomes a break); `lost`: the body isn't seen (tracking), the clock runs up to
 * HOLD.lossGraceMs then pauses; `broken`: out of position for real, the clock paused until you're back.
 */
export type HoldTimerState = "waiting" | "settling" | "holding" | "wobble" | "lost" | "broken";

export interface HoldStatus {
  state: HoldTimerState;
  heldS: number;
  /** The clock runs now. */
  running: boolean;
  /** This frame shows the position (signal in range, guards true). */
  inPosition: boolean;
  /** ms the body hasn't been seen (state `lost`). */
  lostMs: number;
}

/**
 * A hold (plank, wall sit, stretches, a carry): seconds with the signal in range and the guards true. Pose-gated: the
 * clock starts only after HOLD.enterMs in position (a timer that starts while you're still getting down is wrong,
 * 2026-10-26 tester). A brief wobble or a brief tracking loss doesn't stop it; a genuine break (seen out of position
 * for HOLD.breakMs) pauses it and gives back the seconds since you left; back in position for HOLD.enterMs, it
 * resumes.
 */
export class HoldTimer {
  private ref = 0;
  private refSmooth = new Smoother(0.8, 0);
  private smooth = new Smoother();
  private memo = new SideMemo();
  private inSince = 0;
  private lastT = 0;
  private lastInT = 0;
  private lostSince = 0;
  /** Seconds counted since the last frame in position (given back on a break). */
  private pending = 0;
  private lastIn = false;
  /** Seconds held so far. */
  heldS = 0;
  state: HoldTimerState = "waiting";
  /** Frames out of form while holding (for the hold's cues). */
  private cueCount: Partial<Record<CueId, number>> = {};

  constructor(
    readonly sig: SignalSpec,
    readonly hold: HoldSpec,
    readonly guards: readonly Guard[] = [],
    readonly checks: readonly CueCheck[] = [],
  ) {}

  get reference() {
    return this.ref;
  }

  /** The clock is running (or held through a wobble / a brief loss). */
  get holding(): boolean {
    return this.state === "holding" || this.state === "wobble" || (this.state === "lost" && this.lostMsAt(this.lastT) <= HOLD.lossGraceMs);
  }

  private lostMsAt(t: number) {
    return this.state === "lost" && this.lostSince ? t - this.lostSince : 0;
  }

  status(): HoldStatus {
    return { state: this.state, heldS: this.heldS, running: this.holding, inPosition: this.lastIn, lostMs: this.lostMsAt(this.lastT) };
  }

  /** Where this frame is: in position, seen out of it, or not seen well enough to say. */
  classify(f: PoseFrame): "in" | "out" | "unseen" {
    const tl = torsoLength(f);
    if (tl) this.ref = Math.max(this.ref * 0.9995, this.refSmooth.push(f.t, tl));
    const [raw] = this.memo.values(f, !isWhole(this.sig) && this.sig.side === "alt" ? { ...this.sig, side: "both" } : this.sig, this.ref);
    const g = guardState(f, this.guards, this.ref);
    if (g === "out") return "out";
    if (raw === null || raw === undefined) return "unseen";
    const v = this.smooth.push(f.t, raw);
    if (v < this.hold.lo || v > this.hold.hi) return "out";
    return g === "unseen" ? "unseen" : "in";
  }

  /** Returns the cues worth saying now (each at most once every 10 s of being out of form). */
  push(f: PoseFrame): CueId[] {
    const cls = this.classify(f);
    const gapMs = this.lastT ? Math.max(0, f.t - this.lastT) : 0;
    const dt = Math.min(0.5, gapMs / 1000);
    this.lastT = f.t;
    this.lastIn = cls === "in";
    const running = this.state === "holding" || this.state === "wobble" || this.state === "lost";
    if (cls === "in") {
      if (running) {
        // A gap without frames (nobody detected) while holding: tracking, credited up to the grace.
        const credit = gapMs > 500 ? Math.min(gapMs, HOLD.lossGraceMs) / 1000 : dt;
        if (this.state !== "lost" || this.lostMsAt(f.t) <= HOLD.lossGraceMs) this.heldS += credit;
        else this.heldS += dt;
        this.state = "holding";
      } else {
        if (!this.inSince) this.inSince = f.t;
        this.state = f.t - this.inSince >= HOLD.enterMs ? "holding" : "settling";
      }
      this.pending = 0;
      this.lastInT = f.t;
      this.lostSince = 0;
    } else if (cls === "out") {
      this.inSince = 0;
      if (running) {
        // Left the position. During a loss the break began at the last frame in position, and any time credited
        // since is given back with it.
        if (this.state !== "lost" && gapMs <= 500) {
          this.heldS += dt;
          this.pending += dt;
        }
        this.state = "wobble";
        if (f.t - this.lastInT >= HOLD.breakMs) this.breakNow();
      } else if (this.state === "settling") this.state = this.heldS > 0 ? "broken" : "waiting";
    } else {
      // Not seen for a moment while settling in: keep settling (a dropped joint isn't leaving the position).
      if (this.state === "settling" && f.t - this.lastInT <= 500) return [];
      this.inSince = 0;
      if (running) {
        if (this.state !== "lost") {
          this.state = "lost";
          this.lostSince = f.t - gapMs;
        }
        if (this.lostMsAt(f.t) <= HOLD.lossGraceMs) {
          this.heldS += dt;
          this.pending += dt;
        }
      } else if (this.state === "settling") this.state = this.heldS > 0 ? "broken" : "waiting";
    }
    const cues: CueId[] = [];
    if (this.state === "holding" || this.state === "settling") {
      for (const chk of this.checks) {
        const need = CUE_VIEW[chk.id];
        const view = viewOf(f);
        if (need && view !== need) continue;
        if (frameCue(chk, f, this)) {
          const n = (this.cueCount[chk.id] ?? 0) + 1;
          this.cueCount[chk.id] = n;
          // About 2 s out of form at 15 fps before it's said; then every ~10 s while it lasts.
          if (n === 30 || (n > 30 && n % 150 === 0)) cues.push(chk.id);
        } else this.cueCount[chk.id] = 0;
      }
    }
    return cues;
  }

  private breakNow() {
    this.heldS = Math.max(0, this.heldS - this.pending);
    this.pending = 0;
    this.state = "broken";
    this.lostSince = 0;
  }
}
