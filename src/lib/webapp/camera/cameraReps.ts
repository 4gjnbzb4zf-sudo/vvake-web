// Copied from VVFit packages/game-core/src/cameraReps.ts (d40e8e6 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
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
  mid,
  MIN_CONF,
  ok,
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
  | { k: "elbowHeight"; side: SideMode };

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
    case "tilt":
      return torsoTilt(f);
  }
}

/** The signal's value(s) this frame: one channel, or two for `alt` (left, right). */
export function signalValues(f: PoseFrame, spec: SignalSpec, ref: number): (number | null)[] {
  if (spec.k === "tilt") return [torsoTilt(f)];
  return combineSides(spec.side, sideValue(f, spec, SIDES.l, ref), sideValue(f, spec, SIDES.r, ref));
}

function combineSides(side: SideMode, l: number | null, r: number | null): (number | null)[] {
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
  values(f: PoseFrame, spec: SignalSpec, ref: number): (number | null)[] {
    if (spec.k === "tilt") return [torsoTilt(f)];
    if (spec.side === "alt" || spec.side === "l" || spec.side === "r") return signalValues(f, spec, ref);
    let l = sideValue(f, spec, "l", ref);
    let r = sideValue(f, spec, "r", ref);
    if (l !== null) this.l = { v: l, t: f.t };
    else if (this.l && f.t - this.l.t <= SIDE_HOLD_MS) l = this.l.v;
    if (r !== null) this.r = { v: r, t: f.t };
    else if (this.r && f.t - this.r.t <= SIDE_HOLD_MS) r = this.r.v;
    return combineSides(spec.side, l, r);
  }
}

/** Left minus right of a signal (symmetry), null unless both sides are seen. */
export function sideGap(f: PoseFrame, spec: SignalSpec, ref: number): number | null {
  if (spec.k === "tilt") return null;
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
}

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
}

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

  constructor(
    readonly sig: SignalSpec,
    readonly rep: RepSpec,
    readonly guards: readonly Guard[] = [],
    readonly checks: readonly CueCheck[] = [],
  ) {
    const n = sig.k !== "tilt" && sig.side === "alt" ? 2 : 1;
    this.chans = Array.from({ length: n }, () => this.fresh());
  }

  private fresh(): Channel {
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

  private guardsOk(f: PoseFrame): boolean {
    return guardsHold(f, this.guards, this.ref);
  }

  push(f: PoseFrame): { reps: RepEvent[]; partials: PartialEvent[] } {
    const tl = torsoLength(f);
    if (tl) {
      const s = this.refSmooth.push(f.t, tl);
      this.ref = Math.max(this.ref * 0.9995, s);
    }
    const vals = this.memo.values(f, this.sig, this.ref);
    const reps: RepEvent[] = [];
    const partials: PartialEvent[] = [];
    const rest = this.o(this.rep.rest);
    const work = this.o(this.rep.work);
    const half = (rest + work) / 2;
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
            if (c.workExt <= half) partials.push({ t: f.t, ch, reached: this.o(c.workExt) });
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
            if (okDur) reps.push(this.repEvent(c, ch, f, durS));
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

  private repEvent(c: Channel, ch: number, f: PoseFrame, durS: number): RepEvent {
    const worked = this.o(c.workExt);
    const rested = this.o(c.restExt);
    // How much of the ideal range it covered: from the rest threshold to `good` (100 = all of it, capped at 120).
    const good = this.rep.good ?? this.rep.work;
    const span = Math.abs(this.rep.rest - good) || 1;
    const past = this.rep.dir === "down" ? this.rep.rest - worked : worked - this.rep.rest;
    const romPct = Math.round(Math.min(1.2, Math.max(0, past / span)) * 100);
    const downS = Math.max(0, (c.workT - c.leftRestT) / 1000);
    const ev: RepEvent = { t: f.t, ch, durS, downS, upS: Math.max(0, durS - downS), worked, rested, romPct, cues: [] };
    ev.cues = repCues(this, ev, c.workFrame, c.restFrame);
    return ev;
  }
}

/** All guards hold on this frame. */
export function guardsHold(f: PoseFrame, guards: readonly Guard[], ref: number): boolean {
  for (const g of guards) {
    const [v] = signalValues(f, g.sig.k !== "tilt" && g.sig.side === "alt" ? { ...g.sig, side: "both" } : g.sig, ref);
    if (v === null || v === undefined) return false;
    if (g.min !== undefined && v < g.min) return false;
    if (g.max !== undefined && v > g.max) return false;
  }
  return true;
}

/** The form cues a finished rep raises, in priority order. */
export function repCues(rc: RepCounter, ev: RepEvent, workFrame: PoseFrame | null, restFrame: PoseFrame | null): CueId[] {
  const out: CueId[] = [];
  const dir = rc.rep.dir === "down" ? 1 : -1;
  const view = workFrame ? viewOf(workFrame) : null;
  for (const chk of rc.checks) {
    const need = CUE_VIEW[chk.id];
    if (need && view !== need) continue;
    switch (chk.id) {
      case "depth":
        if (rc.rep.good !== undefined && dir * (ev.worked - rc.rep.good) > 0) out.push("depth");
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
      const [v] = signalValues(f, rc.sig.k !== "tilt" && rc.sig.side === "alt" ? { ...rc.sig, side: "max" } : rc.sig, rc.reference);
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

/**
 * A hold (plank, wall sit, stretches, a carry): seconds with the signal in range and the guards true. A short wobble
 * (under 1.5 s) pauses the clock without ending the hold; the clock starts after 1 s in position.
 */
export class HoldTimer {
  private ref = 0;
  private refSmooth = new Smoother(0.8, 0);
  private smooth = new Smoother();
  private memo = new SideMemo();
  private inSince = 0;
  private lastT = 0;
  private outSince = 0;
  /** Seconds held so far. */
  heldS = 0;
  holding = false;
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

  /** Returns the cues worth saying now (each at most once every 10 s of being out of form). */
  push(f: PoseFrame): CueId[] {
    const tl = torsoLength(f);
    if (tl) this.ref = Math.max(this.ref * 0.9995, this.refSmooth.push(f.t, tl));
    const [raw] = this.memo.values(
      f,
      this.sig.k !== "tilt" && this.sig.side === "alt" ? { ...this.sig, side: "both" } : this.sig,
      this.ref,
    );
    const dt = this.lastT ? Math.min(0.5, Math.max(0, (f.t - this.lastT) / 1000)) : 0;
    this.lastT = f.t;
    const v = raw === null || raw === undefined ? null : this.smooth.push(f.t, raw);
    const inRange = v !== null && v >= this.hold.lo && v <= this.hold.hi && guardsHold(f, this.guards, this.ref);
    const cues: CueId[] = [];
    if (inRange) {
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
    if (this.holding || this.inSince) {
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
}
