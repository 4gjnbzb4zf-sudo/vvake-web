// Copied from VVFit packages/game-core/src/cameraDetect.ts (4fe0f2a 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): "just start moving". Replays the last seconds of pose through the counters of the moves
 * marked `detect` and names the move when one clearly counted reps (two or more, more than any other). Weighted
 * variants look like their bodyweight move (a goblet squat is a squat to the camera): the app offers to switch.
 */
import { CAMERA_MOVES, type MoveDef } from "./cameraMoves";
import { RepCounter } from "./cameraReps";
import type { PoseFrame } from "./cameraPose";

export const DETECT = { windowMs: 8000, minReps: 2 } as const;

/** Ties go to the earlier one: whole-body patterns before the ones they contain. */
export const DETECT_ORDER: readonly string[] = [
  "burpee",
  "squat",
  "jumping-jack",
  "overhead-press",
  "push-up",
  "sit-up",
  "glute-bridge",
  "deadlift",
  "biceps-curl",
  "lateral-raise",
  "high-knees",
  "mountain-climber",
];

export interface Detected {
  move: MoveDef;
  reps: number;
}

/** Candidates: the catalog's `detect` moves with a rep signal. */
export const DETECT_MOVES: readonly MoveDef[] = CAMERA_MOVES.filter((m) => m.detect && m.kind === "reps" && m.sig && m.rep);

/** The move these frames show, or null when none is clear yet. */
export function detectMove(frames: readonly PoseFrame[], candidates: readonly MoveDef[] = DETECT_MOVES): Detected | null {
  if (frames.length < 10) return null;
  const end = frames[frames.length - 1]!.t;
  const window = frames.filter((f) => f.t >= end - DETECT.windowMs);
  const scored: { move: MoveDef; reps: number }[] = [];
  for (const m of candidates) {
    const rc = new RepCounter(m.sig!, m.rep!, m.guards ?? []);
    let n = 0;
    for (const f of window) n += rc.push(f).reps.length;
    // An alternating move counts both sides: one cycle of each is one rep of the others' kind.
    const per = m.sig!.k !== "tilt" && m.sig!.side === "alt" ? n / 2 : n;
    scored.push({ move: m, reps: per });
  }
  // Most reps first; a tie goes to the move higher in DETECT_ORDER (a squat also bends the hips like a deadlift).
  const rank = (id: string) => {
    const i = DETECT_ORDER.indexOf(id);
    return i < 0 ? DETECT_ORDER.length : i;
  };
  scored.sort((a, b) => b.reps - a.reps || rank(a.move.id) - rank(b.move.id));
  const [best] = scored;
  if (!best || best.reps < DETECT.minReps) return null;
  return { move: best.move, reps: Math.floor(best.move.sig!.k !== "tilt" && best.move.sig!.side === "alt" ? best.reps * 2 : best.reps) };
}

/** Weighted moves the camera can't tell from this one (offered as "Switch to…"). */
export function lookalikes(id: string): MoveDef[] {
  const m = CAMERA_MOVES.find((x) => x.id === id);
  if (!m || !m.sig || !m.rep) return [];
  const key = JSON.stringify([m.sig, m.kind]);
  return CAMERA_MOVES.filter((x) => x.id !== id && x.sig && x.family === m.family && JSON.stringify([x.sig, x.kind]) === key);
}
