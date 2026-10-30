// Copied from VVFit packages/game-core/src/adaptiveSession.ts (15193a8f 2026-10-30) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
/**
 * Adaptive sessions (build 62, founder 2026-10-30, ADR-0069): a planned session (intervals, tempo, hills, an easy
 * run…) becomes a structure of segments (warm-up, work, recover, steady, cool-down), each with a target (a heart zone,
 * else a pace, else an effort out of 10) and bounds on its length. During the session this machine compares where the
 * athlete IS with where they SHOULD be and reacts, instead of switching zones on a clock:
 *
 * - Recoveries end when the heart has actually come down (in the recover zone for 15 s), never before their minimum
 *   and never after their maximum; a recovery that never comes down twice drops the last rep (health first).
 * - A work rep where the heart sits in zone 5 for 40% of it, or "I'm dying", ends early at its minimum; "feels easy"
 *   or a quick recovery after a rep held well makes the next rep up to 15% longer (at most twice a session).
 * - Steady segments (easy, long, tempo) hold their time: "push a little", "nicely held", "ease off", and a drift cue
 *   when the heart climbs 8% over its early level at the same pace (heat, tiredness).
 * - Without heart rate: the pace band, else effort checks ("easy, moderate or hard?") at most twice a session, in
 *   steady or recover segments only (never during a hard rep), never in Quiet unless the athlete turned them on.
 * - "Pain" ends the hard part at once: the rest becomes an easy cool-down.
 * - Fixed timing (prefs.adaptive.timing = 'fixed'): every segment lasts its planned time; cues still report status.
 *
 * The session's intent is kept: total work and time in target are tracked (`adaptiveSummary`), and the API replays
 * the target-hold bonus from the 10-s heart-rate samples (`adaptiveBonus`, same +10% rule as zone holds).
 *
 * Pure and deterministic: the caller keeps the state and steps it with the active seconds (every 1–5 s). Mirrored in
 * Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/adaptive-session-golden.json (structures, timelines
 * with every cue, cue lines EN/FR, the words heard).
 */
import { ZONE_WEIGHTS, zoneOfBpm, type Profile } from "./hr";
import type { SuggestLevel } from "../suggest/suggest";

type Lang = "en" | "fr";

// ── Settings ────────────────────────────────────────────────────────────────────────────────────────────────

export const SESSION_TIMINGS = ["adaptive", "fixed"] as const;
export type SessionTiming = (typeof SESSION_TIMINGS)[number];
export const RPE_CHECK_MODES = ["auto", "on", "off"] as const;
/** auto: on unless the athlete chose Quiet; on: also in Quiet; off: never. */
export type RpeCheckMode = (typeof RPE_CHECK_MODES)[number];

/** `prefs.adaptive = { timing, rpeChecks, at }`, synced newest-`at`-wins like prefs.autoPause. */
export interface AdaptivePrefs {
  timing: SessionTiming;
  rpeChecks: RpeCheckMode;
  at: string;
}

export const DEFAULT_ADAPTIVE_PREFS: AdaptivePrefs = { timing: "adaptive", rpeChecks: "auto", at: "1970-01-01T00:00:00.000Z" };

/** Anything stored → valid prefs, or undefined. Pure. */
export function cleanAdaptivePrefs(x: unknown): AdaptivePrefs | undefined {
  if (!x || typeof x !== "object") return undefined;
  const o = x as Record<string, unknown>;
  const timing = (SESSION_TIMINGS as readonly unknown[]).includes(o.timing) ? (o.timing as SessionTiming) : DEFAULT_ADAPTIVE_PREFS.timing;
  const rpeChecks = (RPE_CHECK_MODES as readonly unknown[]).includes(o.rpeChecks)
    ? (o.rpeChecks as RpeCheckMode)
    : DEFAULT_ADAPTIVE_PREFS.rpeChecks;
  const at = typeof o.at === "string" && Number.isFinite(Date.parse(o.at)) ? o.at : DEFAULT_ADAPTIVE_PREFS.at;
  return { timing, rpeChecks, at };
}

export function newerAdaptivePrefs(a: AdaptivePrefs | null | undefined, b: AdaptivePrefs | null | undefined): AdaptivePrefs | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

/** May the session ask "easy, moderate or hard?" Quiet stays quiet unless the athlete turned the checks on. Pure. */
export function rpeChecksOn(prefs: AdaptivePrefs | null | undefined, level: SuggestLevel): boolean {
  const m = prefs?.rpeChecks ?? "auto";
  return m === "on" || (m === "auto" && level !== "quiet");
}

// ── Structure ───────────────────────────────────────────────────────────────────────────────────────────────

export type SegmentKind = "warmup" | "work" | "recover" | "steady" | "cooldown";

export interface Segment {
  kind: SegmentKind;
  /**
   * Heart zone 1–4: work / steady hold it; warm-up and cool-down stay at or under it; recover drops to or under it.
   * Absent: no heart-rate target (strides, a test): effort and pace only.
   */
  zone?: number;
  /** Effort out of 10 the segment should feel like (no heart rate, or an effort check). */
  rpe: number;
  /** Pace target s/km when known (the sport's own pace zones); used without heart rate. */
  paceSPerKm?: number;
  /** Planned, shortest and longest length, seconds (equal when the segment never adapts). */
  durS: number;
  minS: number;
  maxS: number;
  /** Work and recover segments of a set: which rep, of how many. */
  rep?: number;
  reps?: number;
}

export type Readiness = "fresh" | "ok" | "tired" | "strained";

export interface SessionStructure {
  v: 1;
  purpose: string;
  sport: string;
  segments: Segment[];
  /** Planned seconds of work + steady (the session's intent). */
  workS: number;
  /** False: a test (benchmark): never adapted, whatever the setting. */
  adaptive: boolean;
  /** Made easier before the start because of the day's readiness. */
  eased?: "tired" | "strained";
}

export interface StructureInput {
  /** seasonWeek Purpose (intervals, tempo, hills, strides, race-pace, openers, benchmark, easy, aerobic, long…). */
  purpose: string;
  minutes: number;
  sport: string;
  /** The plan's zone for the session. */
  zone?: number;
  /** The athlete's easy and hard pace for the sport, s/km (pace zones), for pace targets without heart rate. */
  paces?: { easy?: number; hard?: number };
  readiness?: Readiness;
  /** Health cap on zones (seasonWeek zoneCap: 5 normally, 3 with a condition, 2 easy-only). */
  zoneCap?: number;
}

/** Effort out of 10 for a zone (no heart rate). */
export const SEGMENT_ZONE_RPE: readonly number[] = [2, 2, 3, 5, 7, 9];
/** The quick effort tap: easy / moderate / hard → effort out of 10. */
export const RPE_TAP = { easy: 3, moderate: 5, hard: 7 } as const;
export type RpeTap = keyof typeof RPE_TAP;

const NO_STRUCTURE = ["strength", "mobility", "technique", "race"];
const round5 = (x: number) => Math.round(x / 5) * 5;
const clampN = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function fixedSeg(kind: SegmentKind, durS: number, zone: number | undefined, rpe?: number): Segment {
  const d = Math.max(0, Math.round(durS));
  return { kind, ...(zone !== undefined ? { zone } : {}), rpe: rpe ?? SEGMENT_ZONE_RPE[zone ?? 2]!, durS: d, minS: d, maxS: d };
}

/** Work reps under a minute are fixed (heart rate lags); longer ones may end at 60% or stretch to 125%. */
function workSeg(durS: number, zone: number | undefined, rpe: number, rep: number, reps: number): Segment {
  const d = round5(durS);
  const adapt = d >= 60;
  return {
    kind: "work",
    ...(zone !== undefined ? { zone } : {}),
    rpe,
    durS: d,
    minS: adapt ? round5(d * 0.6) : d,
    maxS: adapt ? round5(d * 1.25) : d,
    rep,
    reps,
  };
}

/** Recoveries end when the heart comes down: from half their time (at least 45 s) to twice it (at most 5 min). */
function recoverSeg(durS: number, rep: number, reps: number): Segment {
  const d = round5(durS);
  return {
    kind: "recover",
    zone: 2,
    rpe: 2,
    durS: d,
    minS: Math.max(45, round5(d * 0.5)),
    maxS: Math.max(d, Math.min(300, d * 2)),
    rep,
    reps,
  };
}

function repeats(n: number, workS: number, zone: number | undefined, rpe: number, restS: number): Segment[] {
  const out: Segment[] = [];
  for (let r = 1; r <= n; r++) {
    out.push(workSeg(workS, zone, rpe, r, n));
    if (r < n) out.push(recoverSeg(restS, r, n));
  }
  return out;
}

/**
 * The segments of a planned session, or null when it has no live structure (strength, mobility, technique, race day:
 * those keep their own screens). Total length = the session's minutes; the cool-down absorbs the rest. Pure.
 */
export function sessionStructure(input: StructureInput): SessionStructure | null {
  const purpose = input.purpose;
  if (NO_STRUCTURE.includes(purpose)) return null;
  const totalS = Math.round(clampN(input.minutes, 5, 600) * 60);
  const cap = clampN(Math.round(input.zoneCap ?? 5), 1, 5);
  const capZ = (z: number) => Math.min(z, cap, 4);
  const readiness = input.readiness ?? "ok";
  let eased: SessionStructure["eased"];
  const steadyZone = capZ(input.zone ?? (purpose === "recovery" || purpose === "shakeout" ? 1 : 2));
  const steadyOnly = (z: number): Segment[] => [fixedSeg("steady", totalS, z)];
  let segs: Segment[];
  let adaptive = true;
  const hardZone = (z: number) => {
    let x = capZ(z);
    if (readiness === "tired") x = Math.max(2, x - 1);
    return x;
  };
  const repsAfter = (n: number) => (readiness === "tired" ? Math.max(2, n - 1) : n);
  const quality = ["intervals", "hills", "strides", "race-pace", "openers", "tempo", "benchmark"].includes(purpose);

  if (quality && (readiness === "strained" || cap <= 2)) {
    // Not today: the same time, easy (a strained day or an easy-only health setting).
    segs = steadyOnly(Math.min(2, cap));
    if (readiness === "strained") eased = "strained";
  } else {
    if (readiness === "tired" && quality) eased = "tired";
    switch (purpose) {
      case "intervals": {
        const z = hardZone(input.zone ?? 4);
        const wu = totalS >= 2400 ? 600 : 300;
        let n = repsAfter(clampN(Math.round((totalS / 60 - 20) / 5), 3, 8));
        while (n > 2 && wu + n * 180 + (n - 1) * 120 + 300 > totalS) n--;
        segs = [fixedSeg("warmup", wu, 2), ...repeats(n, 180, z, SEGMENT_ZONE_RPE[z]!, 120)];
        break;
      }
      case "hills": {
        const wu = totalS >= 2400 ? 900 : 600;
        let n = repsAfter(totalS >= 2400 ? 8 : 6);
        while (n > 2 && wu + n * 45 + (n - 1) * 90 + 300 > totalS) n--;
        segs = [fixedSeg("warmup", wu, 2), ...repeats(n, 45, hardZone(4), 8, 90)];
        break;
      }
      case "strides": {
        const n = repsAfter(6);
        const body = repeats(n, 20, undefined, 7, 60);
        const bodyS = body.reduce((a, s) => a + s.durS, 0);
        segs = [fixedSeg("steady", Math.max(300, totalS - bodyS - 180), capZ(2)), ...body];
        break;
      }
      case "race-pace": {
        const z = hardZone(input.zone ?? 3);
        let n = repsAfter(totalS >= 3000 ? 3 : 2);
        const work = Math.max(300, round5((totalS - 900 - 600 - (n - 1) * 180) / n));
        while (n > 2 && 900 + n * work + (n - 1) * 180 + 300 > totalS) n--;
        segs = [fixedSeg("warmup", 900, 2), ...repeats(n, work, z, SEGMENT_ZONE_RPE[z]!, 180)];
        break;
      }
      case "openers": {
        const n = repsAfter(5);
        segs = [fixedSeg("warmup", 600, 2), ...repeats(n, 60, hardZone(3), 6, 120)];
        break;
      }
      case "tempo": {
        const z = hardZone(input.zone ?? 3);
        const edge = totalS >= 1800 ? 600 : 300;
        segs = [fixedSeg("warmup", edge, 2), fixedSeg("steady", Math.max(300, totalS - 2 * edge), z)];
        break;
      }
      case "benchmark": {
        adaptive = false;
        segs = [fixedSeg("warmup", 900, 2), fixedSeg("work", Math.max(600, totalS - 1200), undefined, 8)];
        break;
      }
      default:
        segs = steadyOnly(steadyZone);
    }
  }
  // Cool-down = the rest (at least 5 minutes after hard work).
  const used = segs.reduce((a, s) => a + s.durS, 0);
  const hasHard = segs.some((s) => s.kind === "work");
  const cool = Math.max(hasHard ? 300 : 0, totalS - used);
  // Too long with the cool-down: the warm-up (or the first steady part) gives the time back, down to 5 minutes.
  let over = used + cool - totalS;
  for (const g of segs) {
    if (over <= 0) break;
    if (g.kind !== "warmup" && g.kind !== "steady") continue;
    const cut = Math.min(over, Math.max(0, g.durS - 300));
    g.durS -= cut;
    g.minS = g.durS;
    g.maxS = g.durS;
    over -= cut;
  }
  if (cool > 0) segs.push(fixedSeg("cooldown", cool, Math.min(2, cap)));
  segs = segs.filter((s) => s.durS > 0);
  // Pace targets for the segments without heart rate.
  const easy = input.paces?.easy;
  const hard = input.paces?.hard;
  if (easy && easy > 0) {
    for (const s of segs) {
      const z = s.zone ?? (s.kind === "work" ? 4 : 2);
      const p = z <= 2 ? easy : hard && hard > 0 ? (z >= 4 ? hard : Math.round((easy + hard) / 2)) : undefined;
      if (p !== undefined && s.kind !== "recover") s.paceSPerKm = Math.round(p);
    }
  }
  const workS = segs.filter((s) => s.kind === "work" || s.kind === "steady").reduce((a, s) => a + s.durS, 0);
  return { v: 1, purpose, sport: input.sport, segments: segs, workS, adaptive, ...(eased ? { eased } : {}) };
}

/** A structure from the wire (the API replays it): checked, never trusted. Pure. */
export function validStructure(x: unknown): SessionStructure | undefined {
  if (!x || typeof x !== "object") return undefined;
  const o = x as Partial<SessionStructure>;
  if (o.v !== 1 || !Array.isArray(o.segments) || o.segments.length < 1 || o.segments.length > 40) return undefined;
  if (typeof o.purpose !== "string" || typeof o.sport !== "string") return undefined;
  let total = 0;
  for (const s of o.segments as Segment[]) {
    if (!s || !["warmup", "work", "recover", "steady", "cooldown"].includes(s.kind)) return undefined;
    if (s.zone !== undefined && !(Number.isInteger(s.zone) && s.zone >= 1 && s.zone <= 4)) return undefined;
    if (![s.durS, s.minS, s.maxS].every((n) => Number.isFinite(n) && n >= 0 && n <= 6 * 3600)) return undefined;
    if (!(s.minS <= s.durS && s.durS <= s.maxS)) return undefined;
    total += s.maxS;
  }
  if (total > 13 * 3600) return undefined;
  return o as SessionStructure;
}

// ── The machine ─────────────────────────────────────────────────────────────────────────────────────────────

export type TargetStatus = "in" | "low" | "high" | "unknown";

/** What the athlete said (voice coach, a tap): classifySaid. */
export type Said = "pain" | "too_hard" | "easy" | "good";

export interface AdaptiveInput {
  /** Active seconds since the start (pauses excluded). */
  t: number;
  /** Heart zone 0–5 (sport zones), with the beats when known. */
  zone?: number;
  bpm?: number;
  /** Live pace s/km (undefined when standing still or no GPS). */
  paceSPerKm?: number;
  /** An effort answer out of 10 (the check, a tap), this tick. */
  rpe?: number;
  /** Something the athlete said, this tick. */
  said?: Said;
}

export interface AdaptiveOptions {
  timing: SessionTiming;
  /** rpeChecksOn(prefs, level); the checks are only asked when there is no heart rate this tick. */
  rpeChecks: boolean;
}

export type AdaptiveCueKind =
  | "segment_start"
  | "halfway"
  | "push_up"
  | "nice_hold"
  | "ease_off"
  | "rest_extended"
  | "rest_ready"
  | "step_up"
  | "rep_shortened"
  | "rep_dropped"
  | "drift_back_off"
  | "rpe_check"
  | "heard_hard"
  | "heard_easy"
  | "heard_good"
  | "pain_stop"
  | "session_done";

export type Haptic = "none" | "tap" | "double" | "strong";

export interface AdaptiveCue {
  kind: AdaptiveCueKind;
  /** Segment index the cue is about (segment_start: the new one). */
  seg: number;
  segKind: SegmentKind;
  t: number;
  zone?: number;
  bpm?: number;
  rep?: number;
  reps?: number;
  /** Seconds (rest_extended: rest so far; step_up / heard_easy: the next rep's new length; segment_start: its planned length). */
  s?: number;
  /** What the status cues are based on: heart rate, pace, or the effort answer (lines name a zone only with heart rate). */
  by?: "hr" | "pace" | "rpe";
  haptic: Haptic;
}

export interface AdaptiveState {
  started: boolean;
  done: boolean;
  /** Current segment, its start, and the planned length of every segment (adapted as the session goes). */
  i: number;
  segT0: number;
  durS: number[];
  /** Actual end of each finished segment (-1: not yet). */
  endT: number[];
  /** Seconds in target per segment. */
  held: number[];
  lastT: number;
  status: TargetStatus;
  /** Seconds in target / out of target in a row, and zone-5 seconds in this rep. */
  inRow: number;
  outRow: number;
  struggleS: number;
  /** The last effort answer (valid 5 minutes, and only in its segment) and when; checks asked. */
  rpe: number;
  rpeT: number;
  rpeAsks: number;
  rpeAskT: number;
  /** Last time each cue family spoke. */
  cueT: number;
  pushT: number;
  easeT: number;
  holdT: number;
  halfDone: boolean;
  extendedCued: boolean;
  drifted: boolean;
  /** Drift: early level (sums over 5–10 min into the segment) and a 5-minute moving average. */
  baseBpmSum: number;
  basePaceSum: number;
  baseN: number;
  emaBpm: number;
  emaPace: number;
  /** Adjustments made. */
  shortened: number;
  extended: number;
  early: number;
  dropped: number;
  stepUps: number;
  /** Recoveries that hit their maximum without coming down. */
  missedRecoveries: number;
  /** Effort answers given (for the model). */
  rpeAnswers: number[];
  pain: boolean;
  /** Status cues in this out-of-target stretch (at most 2; back in target for 30 s resets it). */
  outCues: number;
  /** The last work rep: its length, seconds in target, and whether it reached zone 5 (step-up rule). */
  prevWorkLen: number;
  prevWorkHeld: number;
  prevWorkStruggled: boolean;
}

const CUE_GAP_S = 20;
const PUSH_AFTER_S = 30;
const PUSH_GAP_S = 120;
const SECOND_CUE_GAP_S = 180;
const MAX_OUT_CUES = 2;
const RPE_VALID_S = 300;
const EASE_AFTER_S = 20;
const EASE_GAP_S = 90;
const HOLD_GAP_S = 300;
const HR_GRACE_S = 60;
const RECOVERED_S = 15;
const STRUGGLE_SHARE = 0.4;
const STEP_UP = 1.15;
const MAX_STEP_UPS = 2;
const RPE_MAX_ASKS = 2;
const RPE_GAP_S = 600;
const DRIFT_FROM_S = 1200;
const DRIFT_RATIO = 1.08;
const PACE_BAND = 0.05;
const MAX_STEP_S = 30;

export function newAdaptiveState(st: SessionStructure): AdaptiveState {
  const n = st.segments.length;
  return {
    started: false,
    done: false,
    i: 0,
    segT0: 0,
    durS: st.segments.map((s) => s.durS),
    endT: Array.from({ length: n }, () => -1),
    held: Array.from({ length: n }, () => 0),
    lastT: 0,
    status: "unknown",
    inRow: 0,
    outRow: 0,
    struggleS: 0,
    rpe: 0,
    rpeT: 0,
    outCues: 0,
    rpeAsks: 0,
    rpeAskT: -RPE_GAP_S,
    cueT: -CUE_GAP_S,
    pushT: -PUSH_GAP_S,
    easeT: -EASE_GAP_S,
    holdT: 0,
    halfDone: false,
    extendedCued: false,
    drifted: false,
    baseBpmSum: 0,
    basePaceSum: 0,
    baseN: 0,
    emaBpm: 0,
    emaPace: 0,
    shortened: 0,
    extended: 0,
    early: 0,
    dropped: 0,
    stepUps: 0,
    missedRecoveries: 0,
    rpeAnswers: [],
    pain: false,
    prevWorkLen: 0,
    prevWorkHeld: 0,
    prevWorkStruggled: false,
  };
}

/** Where the athlete is against the segment's target: heart zone, else effort answer, else pace band. Pure. */
export function targetStatus(seg: Segment, x: Pick<AdaptiveInput, "zone" | "paceSPerKm">, rpe = 0): TargetStatus {
  const below = seg.kind === "warmup" || seg.kind === "cooldown" || seg.kind === "recover";
  if (seg.zone !== undefined && x.zone !== undefined && Number.isFinite(x.zone)) {
    if (below) return x.zone <= seg.zone ? "in" : "high";
    return x.zone === seg.zone ? "in" : x.zone < seg.zone ? "low" : "high";
  }
  if (rpe > 0) {
    if (below) return rpe <= seg.rpe + 1 ? "in" : "high";
    return rpe > seg.rpe + 1 ? "high" : rpe < seg.rpe - 1 ? "low" : "in";
  }
  if (seg.paceSPerKm && x.paceSPerKm && x.paceSPerKm > 0) {
    const band = Math.max(5, seg.paceSPerKm * PACE_BAND);
    // Pace: a bigger number is slower (less effort).
    if (below) return x.paceSPerKm >= seg.paceSPerKm - band ? "in" : "high";
    return x.paceSPerKm > seg.paceSPerKm + band ? "low" : x.paceSPerKm < seg.paceSPerKm - band ? "high" : "in";
  }
  return "unknown";
}

const HAPTIC: Record<AdaptiveCueKind, Haptic> = {
  segment_start: "strong",
  halfway: "tap",
  push_up: "tap",
  nice_hold: "none",
  ease_off: "double",
  rest_extended: "tap",
  rest_ready: "strong",
  step_up: "double",
  rep_shortened: "double",
  rep_dropped: "double",
  drift_back_off: "double",
  rpe_check: "tap",
  heard_hard: "tap",
  heard_easy: "tap",
  heard_good: "none",
  pain_stop: "strong",
  session_done: "strong",
};

/**
 * One step: the state after `x` and the cues to say / buzz / show (in order). Pure: never mutates `state`.
 */
export function adaptiveStep(
  st: SessionStructure,
  state: AdaptiveState,
  x: AdaptiveInput,
  opts: AdaptiveOptions,
): { state: AdaptiveState; cues: AdaptiveCue[] } {
  const s: AdaptiveState = {
    ...state,
    durS: [...state.durS],
    endT: [...state.endT],
    held: [...state.held],
    rpeAnswers: [...state.rpeAnswers],
  };
  const cues: AdaptiveCue[] = [];
  if (s.done || !Number.isFinite(x.t)) return { state: s, cues };
  const adapt = opts.timing === "adaptive" && st.adaptive;
  const segs = st.segments;
  const cue = (kind: AdaptiveCueKind, extra: Partial<AdaptiveCue> = {}) => {
    const seg = segs[s.i]!;
    cues.push({
      kind,
      seg: s.i,
      segKind: seg.kind,
      t: x.t,
      ...(seg.zone !== undefined ? { zone: seg.zone } : {}),
      ...(seg.rep !== undefined ? { rep: seg.rep, reps: seg.reps } : {}),
      ...extra,
      haptic: HAPTIC[kind],
    });
    s.cueT = x.t;
  };
  const quietFor = () => x.t - s.cueT < CUE_GAP_S;

  const nextIndex = (from: number) => {
    let j = from + 1;
    while (j < segs.length && s.durS[j]! <= 0) j++;
    return j;
  };
  const endSegment = () => {
    s.endT[s.i] = x.t;
    if (segs[s.i]!.kind === "work") {
      s.prevWorkLen = x.t - s.segT0;
      s.prevWorkHeld = s.held[s.i]!;
      s.prevWorkStruggled = s.struggleS > 0;
    }
    const j = nextIndex(s.i);
    if (j >= segs.length) {
      s.done = true;
      cue("session_done", { s: Math.round(x.t) });
      return;
    }
    s.i = j;
    s.segT0 = x.t;
    s.inRow = 0;
    s.outRow = 0;
    s.struggleS = 0;
    s.rpe = 0;
    s.outCues = 0;
    s.halfDone = false;
    s.extendedCued = false;
    s.drifted = false;
    s.baseBpmSum = 0;
    s.basePaceSum = 0;
    s.baseN = 0;
    s.emaBpm = 0;
    s.emaPace = 0;
    s.holdT = x.t;
    s.pushT = x.t - PUSH_GAP_S + 60;
    s.easeT = x.t - EASE_GAP_S + 30;
    s.status = "unknown";
    cue("segment_start", { s: s.durS[s.i]!, by: x.zone !== undefined ? "hr" : "pace" });
  };

  if (!s.started) {
    s.started = true;
    s.lastT = x.t;
    s.segT0 = x.t;
    s.holdT = x.t;
    if (s.durS[0]! <= 0) endSegment();
    else cue("segment_start", { s: s.durS[0]!, by: x.zone !== undefined ? "hr" : "pace" });
  }

  const dt = x.t - s.lastT;
  const valid = dt > 0 && dt <= MAX_STEP_S;
  if (x.t > s.lastT) s.lastT = x.t;

  // What was said / answered.
  if (x.rpe !== undefined && Number.isFinite(x.rpe) && x.rpe >= 1 && x.rpe <= 10) {
    s.rpe = Math.round(x.rpe);
    s.rpeT = x.t;
    s.rpeAnswers.push(s.rpe);
  }
  const seg0 = segs[s.i]!;
  const el0 = x.t - s.segT0;
  if (x.said === "pain" && !s.pain) {
    s.pain = true;
    // Everything hard that is left goes; the cool-down stays (or the session ends when there is none).
    for (let j = s.i + 1; j < segs.length; j++) if (segs[j]!.kind !== "cooldown") s.durS[j] = 0;
    cue("pain_stop");
    if (seg0.kind !== "cooldown") {
      s.durS[s.i] = Math.max(0, Math.round(el0));
      endSegment();
    }
  } else if (x.said === "too_hard") {
    cue("heard_hard");
    // A rep the athlete called too hard never leads to a longer next one.
    if (seg0.kind === "work") s.struggleS = Math.max(s.struggleS, 1);
    if (adapt && seg0.kind === "work") {
      if (el0 >= seg0.minS) {
        s.durS[s.i] = Math.max(seg0.minS, Math.round(el0));
        s.shortened++;
      } else {
        s.durS[s.i] = seg0.minS;
        s.shortened++;
      }
    }
  } else if (x.said === "easy") {
    let longer: number | undefined;
    if (adapt && seg0.kind === "work" && s.stepUps < MAX_STEP_UPS && st.eased === undefined && stepUpNext(st, s))
      longer = s.durS[nextWork(st, s)]!;
    cue("heard_easy", longer !== undefined ? { s: longer } : {});
  } else if (x.said === "good") {
    cue("heard_good");
  }
  if (s.done) return { state: s, cues };

  const seg = segs[s.i]!;
  const el = x.t - s.segT0;
  if (s.rpe > 0 && x.t - s.rpeT > RPE_VALID_S) s.rpe = 0;
  let status = targetStatus(seg, x, s.rpe);
  const by: "hr" | "pace" | "rpe" = seg.zone !== undefined && x.zone !== undefined ? "hr" : s.rpe > 0 ? "rpe" : "pace";
  // Heart rate lags at the start of a rep: "below" isn't news for the first minute.
  if (seg.kind === "work" && status === "low" && el < HR_GRACE_S && x.zone !== undefined) status = "unknown";
  s.status = status;
  if (valid) {
    if (status === "in") {
      s.held[s.i] = s.held[s.i]! + dt;
      s.inRow += dt;
      s.outRow = 0;
      if (s.inRow >= 30) s.outCues = 0;
    } else if (status === "low" || status === "high") {
      s.outRow += dt;
      s.inRow = 0;
    } else {
      s.inRow = 0;
      s.outRow = 0;
    }
    if (seg.kind === "work" && x.zone !== undefined && x.zone >= 5) s.struggleS += dt;
    // Drift (steady segments of 20 min or more): the early level 5–10 min in, a 5-minute moving average after.
    if (seg.kind === "steady" && s.durS[s.i]! >= DRIFT_FROM_S && x.bpm !== undefined && x.bpm > 0) {
      if (el >= 300 && el < 600) {
        s.baseBpmSum += x.bpm;
        s.basePaceSum += x.paceSPerKm ?? 0;
        s.baseN += 1;
      }
      const a = Math.min(1, dt / 300);
      s.emaBpm = s.emaBpm > 0 ? s.emaBpm + a * (x.bpm - s.emaBpm) : x.bpm;
      if (x.paceSPerKm && x.paceSPerKm > 0) s.emaPace = s.emaPace > 0 ? s.emaPace + a * (x.paceSPerKm - s.emaPace) : x.paceSPerKm;
    }
  }

  // Ends.
  const dur = s.durS[s.i]!;
  if (seg.kind === "recover" && adapt && x.zone !== undefined) {
    if (status === "in" && s.inRow >= RECOVERED_S && el >= seg.minS) {
      const early = el < dur;
      if (early) s.early++;
      const heldWell = s.prevWorkLen > 0 && s.prevWorkHeld >= 0.6 * s.prevWorkLen && !s.prevWorkStruggled;
      s.durS[s.i] = Math.round(el);
      if (early && heldWell && s.stepUps < MAX_STEP_UPS && st.eased === undefined && stepUpNext(st, s)) {
        cue("step_up", { s: s.durS[nextIndex(s.i)]! });
      } else {
        cue("rest_ready", x.bpm ? { bpm: Math.round(x.bpm) } : {});
      }
      s.missedRecoveries = 0;
      endSegment();
      return { state: s, cues };
    }
    if (el >= dur && !s.extendedCued && dur < seg.maxS) {
      s.extendedCued = true;
      s.extended++;
      cue("rest_extended", { s: Math.round(el), ...(x.bpm ? { bpm: Math.round(x.bpm) } : {}) });
    }
    if (el >= seg.maxS) {
      s.durS[s.i] = Math.round(el);
      s.missedRecoveries++;
      if (s.missedRecoveries >= 2) dropLastRep(st, s, cue);
      endSegment();
      return { state: s, cues };
    }
  } else if (seg.kind === "work" && adapt && dur > seg.minS && s.struggleS >= STRUGGLE_SHARE * dur && el >= seg.minS) {
    s.durS[s.i] = Math.round(el);
    s.shortened++;
    cue("rep_shortened");
    endSegment();
    return { state: s, cues };
  } else if (el >= dur) {
    endSegment();
    return { state: s, cues };
  }

  // Reports (both timings).
  if (seg.kind === "work" && !s.halfDone && dur >= 120 && el >= dur / 2) {
    s.halfDone = true;
    if (!quietFor()) {
      cue("halfway", { s: Math.round(dur - el) });
      return { state: s, cues };
    }
  }
  if (seg.kind === "steady" && !s.drifted && el >= DRIFT_FROM_S && s.baseN >= 10 && s.emaBpm > 0) {
    const baseBpm = s.baseBpmSum / s.baseN;
    const basePace = s.basePaceSum / s.baseN;
    const notFaster = basePace <= 0 || s.emaPace <= 0 || s.emaPace >= basePace * 0.97;
    if (s.emaBpm >= baseBpm * DRIFT_RATIO && notFaster) {
      s.drifted = true;
      cue("drift_back_off", { bpm: Math.round(s.emaBpm) });
      return { state: s, cues };
    }
  }
  if (quietFor()) return { state: s, cues };
  const outGap = (gap: number) => (s.outCues === 0 ? gap : SECOND_CUE_GAP_S);
  if (
    (seg.kind === "work" || seg.kind === "steady") &&
    status === "low" &&
    s.outRow >= PUSH_AFTER_S &&
    s.outCues < MAX_OUT_CUES &&
    x.t - s.pushT >= outGap(PUSH_GAP_S)
  ) {
    s.pushT = x.t;
    s.outCues++;
    cue("push_up", { by });
  } else if (
    status === "high" &&
    s.outRow >= EASE_AFTER_S &&
    s.outCues < MAX_OUT_CUES &&
    x.t - s.easeT >= outGap(EASE_GAP_S) &&
    seg.kind !== "recover" &&
    !(seg.kind === "work" && (x.zone ?? 0) < 5 && s.rpe === 0)
  ) {
    s.easeT = x.t;
    s.outCues++;
    cue("ease_off", { by });
  } else if (
    (seg.kind === "work" || seg.kind === "steady") &&
    status === "in" &&
    s.inRow >= 60 &&
    x.t - s.holdT >= (seg.kind === "work" ? 90 : HOLD_GAP_S)
  ) {
    s.holdT = x.t;
    cue("nice_hold", { by });
  } else if (
    opts.rpeChecks &&
    (seg.kind === "steady" || seg.kind === "recover") &&
    x.zone === undefined &&
    s.rpeAsks < RPE_MAX_ASKS &&
    el >= 120 &&
    x.t >= 300 &&
    x.t - s.rpeAskT >= RPE_GAP_S &&
    s.rpe === 0
  ) {
    s.rpeAsks++;
    s.rpeAskT = x.t;
    cue("rpe_check");
  }
  return { state: s, cues };
}

/** The next work rep, up to 15% longer (within its maximum). False when there is none or it is at its maximum. */
function stepUpNext(st: SessionStructure, s: AdaptiveState): boolean {
  for (let j = s.i + 1; j < st.segments.length; j++) {
    const g = st.segments[j]!;
    if (g.kind !== "work" || s.durS[j]! <= 0) continue;
    const next = Math.min(g.maxS, round5(s.durS[j]! * STEP_UP));
    if (next <= s.durS[j]!) return false;
    s.durS[j] = next;
    s.stepUps++;
    return true;
  }
  return false;
}

function nextWork(st: SessionStructure, s: AdaptiveState): number {
  for (let j = s.i + 1; j < st.segments.length; j++) if (st.segments[j]!.kind === "work" && s.durS[j]! > 0) return j;
  return s.i;
}

/** Two recoveries that never came down: the last rep (and the recovery before it) go. */
function dropLastRep(st: SessionStructure, s: AdaptiveState, cue: (k: AdaptiveCueKind, e?: Partial<AdaptiveCue>) => void) {
  let last = -1;
  for (let j = st.segments.length - 1; j > s.i; j--)
    if (st.segments[j]!.kind === "work" && s.durS[j]! > 0) {
      last = j;
      break;
    }
  if (last < 0) return;
  // Keep at least one rep after this recovery.
  const left = st.segments.filter((g, j) => j > s.i && g.kind === "work" && s.durS[j]! > 0).length;
  if (left < 2) return;
  s.durS[last] = 0;
  if (st.segments[last - 1]?.kind === "recover") s.durS[last - 1] = 0;
  s.dropped++;
  s.missedRecoveries = 0;
  cue("rep_dropped");
}

// ── Screens ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface AdaptiveView {
  seg: number;
  segCount: number;
  kind: SegmentKind;
  zone?: number;
  rpe: number;
  paceSPerKm?: number;
  rep?: number;
  reps?: number;
  elapsedS: number;
  /** Seconds left as planned now (an adaptive recovery may end sooner or later: `untilRecovered`). */
  leftS: number;
  untilRecovered: boolean;
  status: TargetStatus;
  workDoneS: number;
  workPlannedS: number;
  next?: { kind: SegmentKind; zone?: number; durS: number };
  done: boolean;
}

export function adaptiveView(
  st: SessionStructure,
  s: AdaptiveState,
  t: number,
  opts: Pick<AdaptiveOptions, "timing"> & { hasHr: boolean },
): AdaptiveView {
  const seg = st.segments[Math.min(s.i, st.segments.length - 1)]!;
  const el = Math.max(0, t - s.segT0);
  let n = s.i + 1;
  while (n < st.segments.length && s.durS[n]! <= 0) n++;
  const nx = st.segments[n];
  const workIdx = st.segments.map((g, j) => (g.kind === "work" || g.kind === "steady" ? j : -1)).filter((j) => j >= 0);
  return {
    seg: s.i,
    segCount: st.segments.length,
    kind: seg.kind,
    ...(seg.zone !== undefined ? { zone: seg.zone } : {}),
    rpe: seg.rpe,
    ...(seg.paceSPerKm ? { paceSPerKm: seg.paceSPerKm } : {}),
    ...(seg.rep !== undefined ? { rep: seg.rep, reps: liveReps(st, s) } : {}),
    elapsedS: Math.round(el),
    leftS: Math.max(0, Math.round(s.durS[s.i]! - el)),
    untilRecovered: seg.kind === "recover" && opts.timing === "adaptive" && st.adaptive && opts.hasHr,
    status: s.status,
    workDoneS: Math.round(workIdx.reduce((a, j) => a + s.held[j]!, 0)),
    workPlannedS: workIdx.reduce((a, j) => a + s.durS[j]!, 0),
    ...(nx ? { next: { kind: nx.kind, ...(nx.zone !== undefined ? { zone: nx.zone } : {}), durS: s.durS[n]! } } : {}),
    done: s.done,
  };
}

const liveReps = (st: SessionStructure, s: AdaptiveState) => st.segments.filter((g, j) => g.kind === "work" && s.durS[j]! > 0).length;

// ── After the session ───────────────────────────────────────────────────────────────────────────────────────

export interface AdaptiveSummary {
  v: 1;
  timing: SessionTiming;
  purpose: string;
  /** Segments as run: kind, zone, from–to (active seconds), seconds in target. Skipped ones are left out. */
  segs: { k: SegmentKind; i: number; z?: number; from: number; to: number; held: number }[];
  workPlannedS: number;
  workDoneS: number;
  adjust: {
    shortened: number;
    extended: number;
    early: number;
    dropped: number;
    stepUps: number;
    pain: boolean;
    eased?: "tired" | "strained";
  };
  rpe: number[];
}

/** What the device uploads with the session (and shows on the summary). Pure. */
export function adaptiveSummary(st: SessionStructure, s: AdaptiveState, endT: number, timing: SessionTiming): AdaptiveSummary {
  const segs: AdaptiveSummary["segs"] = [];
  let from = 0;
  for (let j = 0; j < st.segments.length; j++) {
    const g = st.segments[j]!;
    if (j > s.i && !s.done) break;
    const to = s.endT[j]! >= 0 ? s.endT[j]! : j === s.i ? endT : -1;
    if (to < 0) continue;
    if (to > from || s.durS[j]! > 0)
      segs.push({
        k: g.kind,
        i: j,
        ...(g.zone !== undefined ? { z: g.zone } : {}),
        from: Math.round(from),
        to: Math.round(to),
        held: Math.round(s.held[j]!),
      });
    from = to;
  }
  const work = segs.filter((g) => g.k === "work" || g.k === "steady");
  return {
    v: 1,
    timing,
    purpose: st.purpose,
    segs,
    workPlannedS: st.workS,
    workDoneS: work.reduce((a, g) => a + g.held, 0),
    adjust: {
      shortened: s.shortened,
      extended: s.extended,
      early: s.early,
      dropped: s.dropped,
      stepUps: s.stepUps,
      pain: s.pain,
      ...(st.eased ? { eased: st.eased } : {}),
    },
    rpe: s.rpeAnswers.slice(0, 10),
  };
}

/** Target-hold bonus, as the API replays it from the 10-s heart-rate samples (as zoneHoldBonus). */
export const ADAPTIVE_HOLD_SHARE = 0.8;
export const ADAPTIVE_BONUS = 0.1;
const STEADY_BLOCK_S = 180;

/**
 * The bonus of an adaptive session: each work rep, and each 3-minute block of a steady segment, held in its zone for
 * 80% of its time earns +10% of the effort scored in it. Segment lengths are clamped to the structure's bounds (a
 * device can't stretch a segment); heart rate only (no heart rate, no bonus). Pure.
 */
export function adaptiveBonus(
  st: SessionStructure,
  sum: AdaptiveSummary,
  samples: readonly { t: number; bpm?: number }[],
  profile: Profile,
): { bonus: number; blocks: number; counted: number } {
  const pts = samples.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  let bonus = 0;
  let blocks = 0;
  let counted = 0;
  for (const g of sum.segs) {
    const seg = st.segments[g.i];
    if (!seg || seg.kind !== g.k || seg.zone === undefined || (seg.kind !== "work" && seg.kind !== "steady")) continue;
    const len = Math.min(seg.maxS, Math.max(0, g.to - g.from));
    const windows: [number, number][] = [];
    if (seg.kind === "work") windows.push([g.from, g.from + len]);
    else for (let a = g.from; a + STEADY_BLOCK_S <= g.from + len; a += STEADY_BLOCK_S) windows.push([a, a + STEADY_BLOCK_S]);
    for (const [a, b] of windows) {
      let inS = 0;
      let effort = 0;
      for (let k = 0; k + 1 < pts.length; k++) {
        const p = pts[k]!;
        const q = pts[k + 1]!;
        const lo = Math.max(a, p.t);
        const hi = Math.min(b, q.t);
        if (hi <= lo || q.t - p.t > MAX_STEP_S || p.bpm === undefined || p.bpm < 30 || p.bpm > 230) continue;
        const z = zoneOfBpm(p.bpm, profile);
        const d = hi - lo;
        effort += (d / 60) * ZONE_WEIGHTS[z];
        if (z === seg.zone) inS += d;
      }
      blocks++;
      if (inS >= ADAPTIVE_HOLD_SHARE * (b - a)) {
        counted++;
        bonus += ADAPTIVE_BONUS * effort;
      }
    }
  }
  return { bonus: Math.floor(bonus * 10 + 1e-6) / 10, blocks, counted };
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Words heard (normalised: lower case, no accents), checked in this order: pain first. */
export const SAID_WORDS: Readonly<Record<Said, readonly string[]>> = {
  pain: ["pain", "hurts", "it hurts", "injured", "injury", "cramp", "douleur", "j ai mal", "mal au", "blesse", "crampe"],
  too_hard: [
    "dying",
    "too hard",
    "cant",
    "can t",
    "exhausted",
    "dead",
    "struggling",
    "je meurs",
    "trop dur",
    "j en peux plus",
    "creve",
    "epuise",
    "galere",
    "je craque",
  ],
  easy: ["too easy", "feels easy", "easy", "trop facile", "facile", "tranquille", "cool"],
  good: ["feels good", "good", "fine", "great", "ok", "ca va", "bien", "nickel", "super"],
};
const SAID_ORDER: Said[] = ["pain", "too_hard", "easy", "good"];

const normWords = (s: string) =>
  ` ${s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

/** What a short phrase said mid-session means for the session, or null. Pure. */
export function classifySaid(text: string): Said | null {
  const t = normWords(text);
  for (const k of SAID_ORDER) if (SAID_WORDS[k].some((w) => t.includes(` ${w} `))) return k;
  return null;
}

const KIND_WORD: Record<SegmentKind, { en: string; fr: string }> = {
  warmup: { en: "Warm-up", fr: "Échauffement" },
  work: { en: "Rep", fr: "Fraction" },
  recover: { en: "Recover", fr: "Récup" },
  steady: { en: "Steady", fr: "Allure stable" },
  cooldown: { en: "Cool-down", fr: "Retour au calme" },
};
export const segmentWord = (k: SegmentKind, lang: Lang) => KIND_WORD[k][lang];

const mins = (s: number, lang: Lang) => {
  const t = Math.round(s);
  if (t < 90) return lang === "fr" ? `${t} s` : `${t} seconds`;
  const m = Math.floor(t / 60);
  const r = t % 60;
  if (r === 0 || t >= 600) return lang === "fr" ? `${Math.round(t / 60)} min` : `${Math.round(t / 60)} minutes`;
  return lang === "fr" ? `${m} min ${r}` : `${m} minute${m > 1 ? "s" : ""} ${r}`;
};

/** Without heart rate, a zone is said as an effort. */
const EFFORT_WORD: Record<number, { en: string; fr: string }> = {
  1: { en: "very easy", fr: "très facile" },
  2: { en: "easy", fr: "facile" },
  3: { en: "steady", fr: "soutenu" },
  4: { en: "hard", fr: "dur" },
};

/** The closed set of spoken and shown lines (EN, FR with "tu"). Pure. */
export function adaptiveCueLine(c: AdaptiveCue, lang: Lang): string {
  const fr = lang === "fr";
  const z = c.by === "hr" || c.by === undefined ? c.zone : undefined;
  const zone = z !== undefined ? `zone ${z}` : "";
  const effort = c.zone !== undefined ? EFFORT_WORD[c.zone]![lang] : "";
  switch (c.kind) {
    case "segment_start":
      switch (c.segKind) {
        case "warmup":
          return fr ? `Échauffement, ${mins(c.s ?? 0, lang)} tranquille.` : `Warm-up, ${mins(c.s ?? 0, lang)} easy.`;
        case "work":
          if (c.rep && c.reps && c.rep === c.reps)
            return fr ? `Dernière fraction${zone ? `, ${zone}` : ""}. Vas-y.` : `Last rep${zone ? `, ${zone}` : ""}. Go.`;
          return fr
            ? `Fraction ${c.rep ?? 1}${c.reps ? ` sur ${c.reps}` : ""}${zone ? `, ${zone}` : ""}, ${mins(c.s ?? 0, lang)}.`
            : `Rep ${c.rep ?? 1}${c.reps ? ` of ${c.reps}` : ""}${zone ? `, ${zone}` : ""}, ${mins(c.s ?? 0, lang)}.`;
        case "recover":
          return fr ? "Récup. Respire, on repart quand ton cœur redescend." : "Recover. Breathe, we go again when your heart comes down.";
        case "steady":
          if (zone) return fr ? `${mins(c.s ?? 0, lang)} en ${zone}. Trouve ton rythme.` : `${mins(c.s ?? 0, lang)} in ${zone}. Settle in.`;
          return fr
            ? `${mins(c.s ?? 0, lang)}${effort ? `, ${effort}` : ""}. Trouve ton rythme.`
            : `${mins(c.s ?? 0, lang)}${effort ? ` ${effort}` : ""}. Settle in.`;
        case "cooldown":
          return fr ? "Retour au calme. Relâche tout." : "Cool-down. Let it all go.";
      }
      break;
    case "halfway":
      return fr ? `Mi-fraction, plus que ${mins(c.s ?? 0, lang)}.` : `Halfway, ${mins(c.s ?? 0, lang)} to go.`;
    case "push_up":
      if (c.by === "pace") return fr ? "Accélère un peu, tu es sous ton allure." : "Pick it up a little, you are under your pace.";
      return fr ? `Un peu plus d’intensité${zone ? ` pour la ${zone}` : ""}.` : `Push a little${zone ? ` to reach ${zone}` : ""}.`;
    case "nice_hold":
      if (c.by === "pace") return fr ? "Bonne allure, bien tenue." : "Right on pace, nicely held.";
      if (c.by === "rpe") return fr ? "Effort juste, bien tenu." : "Right effort, nicely held.";
      return fr ? `Tu es en ${zone || "cible"}, bien tenu.` : `You're in ${zone || "target"}, nicely held.`;
    case "ease_off":
      if (c.by === "pace") return fr ? "Ralentis un peu, tu vas plus vite que prévu." : "Slow down a little, you are faster than planned.";
      return fr ? `Ralentis un peu${zone ? `, vise la ${zone}` : ""}.` : `Ease off a little${zone ? `, aim for ${zone}` : ""}.`;
    case "rest_extended":
      return fr
        ? `On prolonge la récup${c.bpm ? `, ton cœur est encore à ${c.bpm}` : ""}.`
        : `Rest a bit longer${c.bpm ? `, your heart is still at ${c.bpm}` : ""}.`;
    case "rest_ready":
      return fr ? "Ton cœur est redescendu. On repart." : "Your heart is back down. Here we go.";
    case "step_up":
      return fr
        ? `Tu récupères vite : prochaine fraction un peu plus longue, ${mins(c.s ?? 0, lang)}.`
        : `You're recovering fast: next rep a little longer, ${mins(c.s ?? 0, lang)}.`;
    case "rep_shortened":
      return fr ? "On coupe cette fraction ici. Bien joué, récupère." : "We'll stop this rep here. Well done, recover.";
    case "rep_dropped":
      return fr
        ? "On enlève la dernière fraction : ton cœur a besoin de plus de récup aujourd’hui."
        : "Dropping the last rep: your heart needs more rest today.";
    case "drift_back_off":
      return fr
        ? `Ton cœur monte à allure égale${c.bpm ? ` (${c.bpm})` : ""}. Ralentis un peu pour rester en ${zone || "zone"}, c’est normal avec la chaleur ou la fatigue.`
        : `Your heart is creeping up at the same pace${c.bpm ? ` (${c.bpm})` : ""}. Slow a little to stay in ${zone || "zone"}; heat or tiredness does that.`;
    case "rpe_check":
      return fr ? "Comment tu te sens : facile, moyen ou dur ?" : "How does it feel: easy, moderate or hard?";
    case "heard_hard":
      return c.segKind === "work"
        ? fr
          ? "Compris. On raccourcit, tiens encore un peu."
          : "Got it. Shortening this one, hold on a little."
        : fr
          ? "Compris. Ralentis, respire."
          : "Got it. Slow down and breathe.";
    case "heard_easy":
      if (c.segKind === "work")
        return c.s !== undefined
          ? fr
            ? `Super, la prochaine sera un peu plus longue : ${mins(c.s, lang)}.`
            : `Great, the next one will be a little longer: ${mins(c.s, lang)}.`
          : fr
            ? "Super, garde ce rythme."
            : "Great, keep it right there.";
      return c.zone !== undefined && c.zone <= 2
        ? fr
          ? "Parfait, facile c’est le but aujourd’hui."
          : "Perfect, easy is the point today."
        : fr
          ? "Super, garde ce rythme."
          : "Great, keep it right there.";
    case "heard_good":
      return fr ? "Top, continue comme ça." : "Great, keep it like that.";
    case "pain_stop":
      return fr
        ? "Douleur : on arrête l’intensité. Marche ou trottine tranquille, et arrête-toi si ça ne passe pas."
        : "Pain: we stop the hard part. Walk or jog easy, and stop if it doesn't ease.";
    case "session_done":
      return fr ? "Séance terminée. Bravo." : "Session done. Well done.";
  }
  return "";
}
