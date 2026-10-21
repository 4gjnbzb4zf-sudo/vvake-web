// Copied from VVFit packages/game-core/src/cameraLiveness.ts (322f91e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): liveness checks. A replayed or pre-recorded video can make a pose detector count reps,
 * but it can't answer a request it couldn't know: "raise your left arm now", at a random moment, from a random list,
 * checked by the pose within a few seconds. Only asked during rest (never with a bar on your back), and the session's
 * camera points need enough of them, mostly passed (cameraPoints.ts).
 */
import { areaSeen, headPoint, ok, seen, torsoLength, type PoseFrame } from "./cameraPose";

export type LivenessKind =
  "raise_left_arm" | "raise_right_arm" | "both_arms_up" | "touch_left_knee" | "touch_right_knee" | "hands_on_head" | "t_pose";
export const LIVENESS_KINDS: readonly LivenessKind[] = [
  "raise_left_arm",
  "raise_right_arm",
  "both_arms_up",
  "touch_left_knee",
  "touch_right_knee",
  "hands_on_head",
  "t_pose",
];

export const LIVENESS_TEXT: Readonly<Record<LivenessKind, { en: string; fr: string }>> = {
  raise_left_arm: { en: "Check: raise your left arm now.", fr: "Contrôle : lève le bras gauche maintenant." },
  raise_right_arm: { en: "Check: raise your right arm now.", fr: "Contrôle : lève le bras droit maintenant." },
  both_arms_up: { en: "Check: both arms up now.", fr: "Contrôle : les deux bras en l’air maintenant." },
  touch_left_knee: { en: "Check: touch your left knee now.", fr: "Contrôle : touche ton genou gauche maintenant." },
  touch_right_knee: { en: "Check: touch your right knee now.", fr: "Contrôle : touche ton genou droit maintenant." },
  hands_on_head: { en: "Check: hands on your head now.", fr: "Contrôle : les mains sur la tête maintenant." },
  t_pose: { en: "Check: arms out to the sides, like a T.", fr: "Contrôle : bras tendus sur les côtés, en T." },
};

/** Seconds to answer, and how long the pose must be held (ms). */
export const LIVENESS = { answerMs: 6000, holdMs: 400, firstAfterS: 60, minGapS: 150, maxGapS: 270 } as const;

/**
 * Whether this frame shows the asked pose. Left and right are yours (anatomical), whichever way the image is flipped.
 * Read from the shoulders, elbows, wrists, hips and knees: the head is used when seen, else placed above the
 * shoulders (cameraPose.ts headPoint), so a check never fails for a head the detector missed.
 */
export function livenessPose(kind: LivenessKind, f: PoseFrame): boolean {
  const torso = torsoLength(f);
  const head = headPoint(f);
  if (!torso || !head) return false;
  const j = f.joints;
  const above = (w: "lWrist" | "rWrist") => ok(f, w) && j[w]!.y < head.y - 0.05 * torso;
  const low = (w: "lWrist" | "rWrist", s: "lShoulder" | "rShoulder") => ok(f, w, s) && j[w]!.y > j[s]!.y;
  const dist = (a: "lWrist" | "rWrist", b: "lKnee" | "rKnee" | "head") => {
    const A = j[a];
    const B = b === "head" ? head : j[b];
    if (!A || !B || !seen(f, a) || (b !== "head" && !seen(f, b))) return Infinity;
    return Math.hypot((A.x - B.x) * (f.w / f.h), A.y - B.y) / torso;
  };
  switch (kind) {
    case "raise_left_arm":
      return above("lWrist") && low("rWrist", "rShoulder");
    case "raise_right_arm":
      return above("rWrist") && low("lWrist", "lShoulder");
    case "both_arms_up":
      return above("lWrist") && above("rWrist");
    case "touch_left_knee":
      return Math.min(dist("lWrist", "lKnee"), dist("rWrist", "lKnee")) < 0.3;
    case "touch_right_knee":
      return Math.min(dist("lWrist", "rKnee"), dist("rWrist", "rKnee")) < 0.3;
    case "hands_on_head":
      return (
        dist("lWrist", "head") < 0.55 &&
        dist("rWrist", "head") < 0.55 &&
        ok(f, "lElbow", "rElbow", "lShoulder", "rShoulder") &&
        j.lElbow!.y < j.lShoulder!.y + 0.15 * torso &&
        j.rElbow!.y < j.rShoulder!.y + 0.15 * torso &&
        // The hands at the head, not stretched up past it (that's "both arms up").
        j.lWrist!.y < j.lShoulder!.y &&
        j.rWrist!.y < j.rShoulder!.y
      );
    case "t_pose": {
      if (!ok(f, "lWrist", "rWrist", "lShoulder", "rShoulder")) return false;
      const level = Math.abs(j.lWrist!.y - j.lShoulder!.y) < 0.3 * torso && Math.abs(j.rWrist!.y - j.rShoulder!.y) < 0.3 * torso;
      const span = Math.abs(j.lWrist!.x - j.rWrist!.x) * (f.w / f.h);
      return level && span > 1.6 * torso;
    }
  }
}

/** Whether this check can be answered in the picture as it is: the knee touches need the knees in view. */
export function livenessFits(kind: LivenessKind, f: PoseFrame | null): boolean {
  if (!f) return true;
  if (kind === "touch_left_knee" || kind === "touch_right_knee") return areaSeen(f, "knees");
  return true;
}

/** A small seeded random source (mulberry32), so tests replay the same schedule; the app seeds it from crypto. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LivenessResult {
  kind: LivenessKind;
  /** Seconds since the session start when asked. */
  t: number;
  ok: boolean;
  ms?: number;
}

/**
 * When to ask and whether it passed. `due(sessionS, resting)`: a check is due during rest once the random gap since
 * the last one has passed (the first after 60 s of session). `ask` starts one (a random kind, never the same twice in
 * a row); `push` frames until it passes (held 0.4 s) or times out (6 s).
 */
export class LivenessChecker {
  private nextAtS: number;
  private lastKind: LivenessKind | null = null;
  private pending: { kind: LivenessKind; atMs: number; atS: number; heldSince: number } | null = null;
  readonly results: LivenessResult[] = [];

  constructor(private readonly rnd: () => number) {
    this.nextAtS = LIVENESS.firstAfterS + Math.floor(rnd() * 60);
  }

  get active(): LivenessKind | null {
    return this.pending?.kind ?? null;
  }

  due(sessionS: number, resting: boolean): boolean {
    return !this.pending && resting && sessionS >= this.nextAtS;
  }

  /** `f`: the latest frame, so the check asked fits the picture (no knee touch with the knees out of view). */
  ask(nowMs: number, sessionS: number, f: PoseFrame | null = null): LivenessKind {
    const all = LIVENESS_KINDS.filter((k) => k !== this.lastKind);
    const fit = all.filter((k) => livenessFits(k, f));
    const choices = fit.length ? fit : all;
    const kind = choices[Math.floor(this.rnd() * choices.length) % choices.length]!;
    this.lastKind = kind;
    this.pending = { kind, atMs: nowMs, atS: sessionS, heldSince: 0 };
    return kind;
  }

  /** The result once decided (passed or timed out), else null. Frames without a body count as not answering. */
  push(f: PoseFrame | null, nowMs: number): LivenessResult | null {
    const p = this.pending;
    if (!p) return null;
    if (f && livenessPose(p.kind, f)) {
      if (!p.heldSince) p.heldSince = nowMs;
      if (nowMs - p.heldSince >= LIVENESS.holdMs) return this.finish(true, nowMs);
    } else p.heldSince = 0;
    if (nowMs - p.atMs > LIVENESS.answerMs) return this.finish(false, nowMs);
    return null;
  }

  private finish(okd: boolean, nowMs: number): LivenessResult {
    const p = this.pending!;
    this.pending = null;
    const r: LivenessResult = { kind: p.kind, t: Math.round(p.atS), ok: okd, ...(okd ? { ms: Math.round(nowMs - p.atMs) } : {}) };
    this.results.push(r);
    this.nextAtS = p.atS + LIVENESS.minGapS + Math.floor(this.rnd() * (LIVENESS.maxGapS - LIVENESS.minGapS));
    return r;
  }

  /** Abandons a check in progress without a result (the session ended or paused). */
  cancel() {
    this.pending = null;
  }
}
