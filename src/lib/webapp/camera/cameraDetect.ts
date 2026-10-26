// Copied from VVFit packages/game-core/src/cameraDetect.ts (e628403d 2026-10-26) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): "just start moving". Replays the last seconds of pose through the counters of every
 * move the camera can count, and names the move when one clearly counted reps (two or more, more than any other),
 * or, when nothing is being repeated, a position held for a few seconds (plank, wall sit, stretches). Weighted
 * variants look like their bodyweight move (a goblet squat is a squat to the camera): the app offers to switch.
 *
 * Custom moves (ADR-0047, cameraCustom.ts) are tried too, with their taught template; on a near tie a move you
 * taught wins (you taught it for a reason: it's more specific than the catalogue's lookalike).
 */
import { CAMERA_MOVES, type MoveDef } from "./cameraMoves";
import { HoldTimer, RepCounter } from "./cameraReps";
import { MoveCounter } from "./cameraReady";
import type { PoseFrame } from "./cameraPose";
import { registeredCustomMoves, type CustomMoveDef } from "./cameraCustom";
import { CHANNELS, features, TemplateCounter, TemplateHold, TorsoRef } from "./cameraTemplate";

export const DETECT = {
  windowMs: 8000,
  minReps: 2,
  /** A position held this long (s), still held now, with nothing repeated: that hold. */
  holdS: 3,
  /** A custom move wins when it counted at least this share of the best catalogue move's reps. */
  customShare: 0.75,
} as const;

/**
 * Ties go to the earlier one: whole-body patterns before the ones they contain (a burpee has a squat in it; a squat
 * bends the knees like a lunge and the hips like a deadlift). Moves not listed come after, in catalogue order.
 */
export const DETECT_ORDER: readonly string[] = [
  "burpee",
  "squat",
  "jumping-jack",
  "overhead-press",
  "pull-up",
  "push-up",
  "deadlift",
  "romanian-deadlift",
  "sit-up",
  "glute-bridge",
  "lunge",
  "side-lunge",
  "biceps-curl",
  "bent-over-row",
  "lateral-raise",
  "front-raise",
  "high-knees",
  "mountain-climber",
  "leg-raise",
  "knee-push-up",
];

/**
 * Holds that look like standing or resting (a farmer carry is standing with the arms down; arms overhead is also a
 * liveness check): never recognised on their own, only when the routine names them.
 */
const NO_DETECT_HOLDS = new Set(["farmer-carry", "overhead-reach", "side-bend", "arm-circles"]);

export interface Detected {
  move: MoveDef;
  reps: number;
  /** A hold: seconds held so far. */
  holdS?: number;
}

const rankOf = (id: string) => {
  const i = DETECT_ORDER.indexOf(id);
  return i < 0 ? DETECT_ORDER.length + CAMERA_MOVES.findIndex((m) => m.id === id) : i;
};
const sigKey = (m: MoveDef) => JSON.stringify([m.kind, m.sig, m.rep ?? m.hold, m.guards ?? []]);
const isAlt = (m: MoveDef) => !!m.sig && "side" in m.sig && m.sig.side === "alt";

/** One move per signal: the best ranked (lookalikes count the same; the app offers the switch). */
function dedupe(ms: MoveDef[]): MoveDef[] {
  const seen = new Set<string>();
  return [...ms]
    .sort((a, b) => rankOf(a.id) - rankOf(b.id))
    .filter((m) => {
      const k = sigKey(m);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Rep candidates: every catalogue move the camera counts (not the manual ones), one per signal. */
export const DETECT_MOVES: readonly MoveDef[] = dedupe(
  CAMERA_MOVES.filter((m) => m.kind === "reps" && m.judge !== "manual" && m.sig && m.rep),
);
/** Hold candidates: the positions the camera can time, but those that look like standing. */
export const DETECT_HOLDS: readonly MoveDef[] = dedupe(
  CAMERA_MOVES.filter((m) => m.kind === "hold" && m.judge !== "manual" && m.sig && m.hold && !NO_DETECT_HOLDS.has(m.id)),
);

const isCustom = (m: MoveDef): m is CustomMoveDef => "custom" in m && !!(m as CustomMoveDef).custom;

function countReps(m: MoveDef, frames: readonly PoseFrame[]): number {
  if (isCustom(m)) {
    const c = new TemplateCounter(m.custom.template);
    let n = 0;
    for (const f of frames) n += c.push(f).reps.length;
    return n;
  }
  // Every angle the move is counted from (no cues: detection only counts).
  const rc = m.alts?.length ? new MoveCounter({ ...m, cues: [] }) : new RepCounter(m.sig!, m.rep!, m.guards ?? []);
  let n = 0;
  for (const f of frames) n += rc.push(f).reps.length;
  // An alternating move counts both sides: one cycle of each is one rep of the others' kind.
  return isAlt(m) ? n / 2 : n;
}

function heldNow(m: MoveDef, frames: readonly PoseFrame[]): number {
  if (isCustom(m)) {
    const h = new TemplateHold(m.custom.template);
    for (const f of frames) h.push(f);
    return h.holding ? h.heldS : 0;
  }
  const h = new HoldTimer(m.sig!, m.hold!, m.guards ?? []);
  for (const f of frames) h.push(f);
  return h.holding ? h.heldS : 0;
}

export interface DetectOptions {
  /** Also recognise holds (on by default). */
  holds?: boolean;
  /** Custom moves to try (default: the registered ones, cameraCustom.ts). */
  custom?: readonly MoveDef[];
}

/**
 * The clear winner, or null (wait): it counted at least two reps; every better-ranked move counted at least two
 * fewer (it's clearly more of this one); no worse-ranked move counted more than one more (a tie, or one rep ahead,
 * goes to the better-ranked move: a squat's hips bend like a deadlift's and its knees like a lunge's, and which of
 * those counters reaches two first depends on where the window starts). At most one move can pass.
 */
export function winner<T extends { move: MoveDef; reps: number }>(scored: readonly T[]): T | null {
  for (const x of scored) {
    if (x.reps < DETECT.minReps) continue;
    const rx = rankOf(x.move.id);
    const ok = scored.every((y) => y === x || (rankOf(y.move.id) < rx ? y.reps <= x.reps - 2 : y.reps <= x.reps + 1));
    if (ok) return x;
  }
  return null;
}

/** Moves whose hips travel up and down by most of a torso (a pull-up lifts the whole body; a press doesn't). */
const TRAVEL = new Set(["pull-up", "chin-up"]);
/** Moves done standing still from the hips down (presses, curls, raises): the hips barely move. */
const HIPS_STILL_FAMILIES = new Set(["press", "arms", "raise"]);
/** Moves done standing (at the top of the rep the knees are well below the hips): not lying for a sit-up. */
const STANDING_FAMILIES = new Set(["squat", "lunge"]);
const STANDING_IDS = new Set(["deadlift", "romanian-deadlift", "kettlebell-swing", "jumping-jack", "high-knees"]);

/** Hip travel (in standing torso lengths) and the most the knees were below the hips, over the window. */
function bodyFacts(frames: readonly PoseFrame[]): { travel: number; stood: number } | null {
  const ref = new TorsoRef();
  const ys: number[] = [];
  let stood = -Infinity;
  for (const f of frames) {
    const r = ref.push(f);
    const lh = f.joints.lHip;
    const rh = f.joints.rHip;
    const hy = lh && rh ? (lh.y + rh.y) / 2 : (lh ?? rh)?.y;
    if (hy !== undefined) ys.push(hy);
    const v = features(f, r);
    for (const d of [v[CHANNELS.indexOf("dropL")], v[CHANNELS.indexOf("dropR")]])
      if (d !== null && d !== undefined) stood = Math.max(stood, d / 90);
  }
  if (ys.length < 5 || ref.value <= 0) return null;
  const s = [...ys].sort((a, b) => a - b);
  return { travel: (s[Math.floor(s.length * 0.95)]! - s[Math.floor(s.length * 0.05)]!) / ref.value, stood };
}

/** Whether what the body did fits the move (beyond its counter): the lookalike counters that also fire are dropped. */
function plausible(m: MoveDef, frames: readonly PoseFrame[]): boolean {
  if (isCustom(m)) return true;
  const facts = bodyFacts(frames);
  if (!facts) return true;
  if (TRAVEL.has(m.id) && facts.travel < 0.45) return false;
  if (HIPS_STILL_FAMILIES.has(m.family) && facts.travel > 0.4) return false;
  if ((STANDING_FAMILIES.has(m.family) || STANDING_IDS.has(m.id)) && facts.stood < 0.45) return false;
  return true;
}

/** The move these frames show, or null when none is clear yet. */
export function detectMove(
  frames: readonly PoseFrame[],
  candidates: readonly MoveDef[] = DETECT_MOVES,
  o: DetectOptions = {},
): Detected | null {
  if (frames.length < 10) return null;
  const end = frames[frames.length - 1]!.t;
  const window = frames.filter((f) => f.t >= end - DETECT.windowMs);
  const custom = (o.custom ?? registeredCustomMoves()).filter((m) => isCustom(m));
  const scored = candidates.filter((m) => m.kind === "reps" && m.sig && m.rep).map((m) => ({ move: m, reps: countReps(m, window) }));
  scored.sort((a, b) => b.reps - a.reps || rankOf(a.move.id) - rankOf(b.move.id));
  const best = scored[0];
  const bestCustom = custom
    .filter((m) => m.kind === "reps")
    .map((m) => ({ move: m as MoveDef, reps: countReps(m, window) }))
    .sort((a, b) => b.reps - a.reps)[0];
  const repsOut = (d: { move: MoveDef; reps: number }): Detected => ({
    move: d.move,
    reps: Math.floor(isAlt(d.move) ? d.reps * 2 : d.reps),
  });
  if (bestCustom && bestCustom.reps >= DETECT.minReps && bestCustom.reps >= Math.ceil((best?.reps ?? 0) * DETECT.customShare))
    return repsOut(bestCustom);
  const w = winner(scored.filter((x) => plausible(x.move, window)));
  if (w) return repsOut(w);
  if (o.holds === false) return null;
  // A hold only when you're still: a plank's body line is also there through push-ups, a wall sit's knees in a squat.
  if (scored.some((x) => x.reps >= 1) || !stillFor(window, DETECT.holdS * 1000)) return null;
  // Nothing repeated: a position held still (custom holds first, then the catalogue's in rank order).
  const catalogueHolds = candidates === DETECT_MOVES ? DETECT_HOLDS : candidates.filter((m) => m.kind === "hold" && m.sig && m.hold);
  const holds: MoveDef[] = [...custom.filter((m) => m.kind === "hold"), ...catalogueHolds];
  let pick: Detected | null = null;
  for (const m of holds) {
    const s = heldNow(m, window);
    if (s >= DETECT.holdS && (!pick || s > (pick.holdS ?? 0) + 0.5)) pick = { move: m, reps: 0, holdS: s };
  }
  return pick;
}

/** Nothing moved much over the last `ms` (every joint angle seen within STILL_DEG). */
export const STILL_DEG = 18;
export function stillFor(frames: readonly PoseFrame[], ms: number): boolean {
  if (!frames.length) return false;
  const end = frames[frames.length - 1]!.t;
  if (end - frames[0]!.t < ms) return false;
  const ref = new TorsoRef();
  const cols: number[][] = CHANNELS.map(() => []);
  for (const f of frames) {
    const r = ref.push(f);
    if (f.t < end - ms) continue;
    features(f, r).forEach((v, i) => {
      if (v !== null) cols[i]!.push(v);
    });
  }
  // The 10th to 90th percentile: a joint lost for a frame (the knee angle guessed without the foot) isn't a move.
  return cols.every((c) => {
    if (c.length < 5) return true;
    const s = [...c].sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.9)]! - s[Math.floor(s.length * 0.1)]! <= STILL_DEG;
  });
}

/** Weighted moves the camera can't tell from this one (offered as "Switch to…"). */
export function lookalikes(id: string): MoveDef[] {
  const m = CAMERA_MOVES.find((x) => x.id === id);
  if (!m || !m.sig || (!m.rep && !m.hold)) return [];
  const key = JSON.stringify([m.sig, m.kind]);
  return CAMERA_MOVES.filter((x) => x.id !== id && x.sig && x.family === m.family && JSON.stringify([x.sig, x.kind]) === key);
}
