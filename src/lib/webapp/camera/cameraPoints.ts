// Copied from VVFit packages/game-core/src/cameraPoints.ts (200973e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts (ADR-0046): what a session recorded with the phone's camera (on-device pose, no phone or watch worn)
 * uploads, and the small, capped points it may earn. Pure and deterministic, shared by the API (which enforces it)
 * and the app (which only previews it).
 *
 * The camera proves that a body moved in front of the phone, not how hard it worked, and a replayed video could fool
 * it. So, without heart-rate samples:
 * - points come only from camera-counted work (reps the pose counted, holds it timed), never from typed reps;
 * - random liveness checks ("raise your left arm now") must have been asked and mostly passed;
 * - 1 point a counted minute, from 5 minutes, at most 15 a UTC day across all camera sessions (no per-session or
 *   per-week cap: founder decision 2026-10-20, ADR-0046 amendment);
 * - never a prize, a ranked clash, Fan Clash, pool credit or a referral reward (like the web, ADR-0043).
 * With heart-rate samples (a strap through the phone) the usual heart-based points apply instead (ADR-0024 tiers);
 * a watch worn alongside records its own session, which carries the heart points. When both carry the same `link`
 * the server merges them into one session (linkedScore below): the camera block rides on the watch's session.
 */

export const CAMERA_POINTS = {
  /** Points per camera-counted minute. */
  perMin: 1,
  /** Under this many counted minutes: nothing. */
  minWorkMin: 5,
  /** Camera points per UTC day, across all camera sessions (the only cap). */
  dayCap: 15,
  /** At least one liveness check per this many counted minutes (and at least one). */
  livenessEveryMin: 5,
  /** Share of the checks that must pass. */
  livenessPassRatio: 2 / 3,
  /** A counted rep is at most this many seconds of work (a slow tempo rep), whatever the claim says. */
  maxRepS: 8,
} as const;

/** How the camera judged a set: from pose angles; counted from pose but not judged for form; typed by you. */
export type CameraJudge = "camera" | "count" | "manual";

export interface CameraSet {
  /** Reps counted (or typed, `judged: "manual"`). */
  reps: number;
  /** A hold's seconds (plank, wall sit, farmer carry, stretches). */
  holdS?: number;
  /** The load you entered, in kg (the app converts from lb). The camera never measures it. */
  loadKg?: number;
  /** One side of a unilateral move. */
  side?: "l" | "r";
  /** Range of motion, % of the move's full range (median rep). */
  romPct?: number;
  /** Average seconds per rep. */
  tempoS?: number;
  /** Form cue ids raised in this set (cameraForm.ts), at most 6. */
  cues?: string[];
  judged: CameraJudge;
}

export interface CameraMoveLog {
  /** Move id from the catalog (cameraMoves.ts). */
  id: string;
  sets: CameraSet[];
}

export interface LivenessCheckLog {
  /** Seconds since the session start when it was asked. */
  t: number;
  /** Prompt id (cameraLiveness.ts). */
  kind: string;
  ok: boolean;
  /** How long it took to pass, ms. */
  ms?: number;
}

/** The `camera` block of an uploaded session. */
export interface CameraSummary {
  v: 1;
  moves: CameraMoveLog[];
  /** Seconds with a whole body in frame. */
  trackedS: number;
  /** Seconds of camera-counted work (sets with counted reps, timed holds). */
  workS: number;
  liveness: { asked: number; passed: number; checks?: LivenessCheckLog[] };
  /** A heart-rate source ran alongside: the paired watch (its own session) or a strap through the phone. */
  heart?: "watch" | "strap";
  /** Where the phone stood. */
  view?: "front" | "side";
}

export const CAMERA_LIMITS = { moves: 40, setsPerMove: 30, checks: 80, cues: 6 } as const;

export type CameraPointsReason =
  | "ok"
  | "heart" // heart-rate points apply instead
  | "watch" // the watch's own session carries the points
  | "too_little" // under minWorkMin counted minutes
  | "liveness_missing"
  | "liveness_failed"
  | "not_app" // a web upload or an unattested device
  | "overlap" // another session already covers this time
  | "budget"; // the day's camera budget is spent

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Seconds of work the reps and holds can account for (only camera-counted sets). */
export function countedWorkCapS(c: Pick<CameraSummary, "moves">): number {
  let s = 0;
  for (const m of c.moves) {
    for (const set of m.sets) {
      if (set.judged === "manual") continue;
      s += Math.max(0, Math.floor(finite(set.reps) ? set.reps : 0)) * CAMERA_POINTS.maxRepS;
      s += Math.max(0, finite(set.holdS) ? set.holdS : 0);
    }
  }
  return s;
}

/** Counted minutes: the claim, bounded by the session's active time, the tracked time and what the reps can explain. */
export function cameraWorkMin(c: CameraSummary, activeS: number): number {
  const s = Math.min(Math.max(0, c.workS), Math.max(0, c.trackedS), Math.max(0, activeS), countedWorkCapS(c));
  return Math.floor((s / 60) * 10) / 10;
}

/** Liveness checks needed for this many counted minutes. */
export const livenessNeeded = (workMin: number) => Math.max(1, Math.floor(workMin / CAMERA_POINTS.livenessEveryMin));

export interface CameraPointsInput {
  camera: CameraSummary;
  activeS: number;
  /** Heart-rate samples the server counted (≥ 2: the heart score applies instead). */
  hrSamples: number;
  /** A phone app upload the server trusts (not the web, attestation ok or not required). */
  appDevice: boolean;
  overlap?: boolean;
}

/** A session's camera points before the day budget, and why. */
export function cameraSessionPoints(i: CameraPointsInput): { base: number; workMin: number; reason: CameraPointsReason } {
  const workMin = cameraWorkMin(i.camera, i.activeS);
  if (i.hrSamples >= 2) return { base: 0, workMin, reason: "heart" };
  if (i.camera.heart === "watch") return { base: 0, workMin, reason: "watch" };
  if (!i.appDevice) return { base: 0, workMin, reason: "not_app" };
  if (i.overlap) return { base: 0, workMin, reason: "overlap" };
  if (workMin < CAMERA_POINTS.minWorkMin) return { base: 0, workMin, reason: "too_little" };
  const asked = Math.max(0, Math.floor(i.camera.liveness.asked));
  const passed = Math.min(asked, Math.max(0, Math.floor(i.camera.liveness.passed)));
  if (asked < livenessNeeded(workMin)) return { base: 0, workMin, reason: "liveness_missing" };
  if (passed / asked < CAMERA_POINTS.livenessPassRatio - 1e-9) return { base: 0, workMin, reason: "liveness_failed" };
  return { base: Math.floor(workMin * CAMERA_POINTS.perMin), workMin, reason: "ok" };
}

/** What's left of the UTC day's camera budget takes the session's base: the points it really gets. */
export function cameraBudgeted(base: number, used: { day: number }): { points: number; capped: boolean } {
  const room = Math.max(0, CAMERA_POINTS.dayCap - used.day);
  const points = Math.max(0, Math.min(base, room));
  return { points, capped: points < base };
}

/**
 * Linked camera + watch workouts (ADR-0046 amendment 2026-10-20): the phone's camera session and the watch's session
 * share a `link` and are one session. A camera session whose watch session hasn't arrived waits this long after its
 * end; then it counts on its own (camera points under the day cap).
 */
export const CAMERA_LINK_WINDOW_MS = 12 * 3_600_000;

/** The `link` both sessions carry: a lowercase uuid the phone made at the start. */
export const CAMERA_LINK_RE = /^[a-f0-9-]{36}$/;

/**
 * A linked watch session that arrives after its camera session already counted on its own: it keeps only what the
 * camera session didn't already score, so the workout never counts twice.
 */
export function linkedScore(heartScored: number, cameraScored: number): number {
  const h = finite(heartScored) ? heartScored : 0;
  const c = finite(cameraScored) ? cameraScored : 0;
  return Math.max(0, Math.round((h - c) * 10) / 10);
}

/**
 * The summary as the server keeps it: whole numbers, known shapes, bounded lists. Unknown keys dropped. Returns null
 * when nothing usable is left.
 */
export function cleanCameraSummary(raw: unknown): CameraSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number) => (finite(x) ? Math.min(hi, Math.max(lo, x)) : undefined);
  const moves: CameraMoveLog[] = [];
  for (const m of Array.isArray(r.moves) ? r.moves.slice(0, CAMERA_LIMITS.moves) : []) {
    const mm = m as Record<string, unknown>;
    if (typeof mm?.id !== "string" || !/^[a-z0-9-]{2,40}$/.test(mm.id)) continue;
    const sets: CameraSet[] = [];
    for (const s of Array.isArray(mm.sets) ? mm.sets.slice(0, CAMERA_LIMITS.setsPerMove) : []) {
      const ss = s as Record<string, unknown>;
      const judged = ss?.judged === "camera" || ss?.judged === "count" || ss?.judged === "manual" ? ss.judged : null;
      if (!judged) continue;
      const set: CameraSet = { reps: Math.round(num(ss.reps, 0, 500) ?? 0), judged };
      const hold = num(ss.holdS, 0, 3600);
      if (hold) set.holdS = Math.round(hold);
      const load = num(ss.loadKg, 0, 500);
      if (load) set.loadKg = Math.round(load * 10) / 10;
      if (ss.side === "l" || ss.side === "r") set.side = ss.side;
      const rom = num(ss.romPct, 0, 150);
      if (rom !== undefined) set.romPct = Math.round(rom);
      const tempo = num(ss.tempoS, 0, 60);
      if (tempo) set.tempoS = Math.round(tempo * 10) / 10;
      if (Array.isArray(ss.cues)) {
        const cues = ss.cues.filter((x): x is string => typeof x === "string" && /^[a-z0-9_]{2,32}$/.test(x)).slice(0, CAMERA_LIMITS.cues);
        if (cues.length) set.cues = [...new Set(cues)];
      }
      if (set.reps > 0 || set.holdS) sets.push(set);
    }
    if (sets.length) moves.push({ id: mm.id, sets });
  }
  const l = (r.liveness ?? {}) as Record<string, unknown>;
  const checks: LivenessCheckLog[] = [];
  for (const c of Array.isArray(l.checks) ? l.checks.slice(0, CAMERA_LIMITS.checks) : []) {
    const cc = c as Record<string, unknown>;
    if (typeof cc?.kind !== "string" || !/^[a-z0-9_]{2,32}$/.test(cc.kind) || typeof cc.ok !== "boolean") continue;
    const t = num(cc.t, 0, 13 * 3600);
    if (t === undefined) continue;
    const ms = num(cc.ms, 0, 60_000);
    checks.push({ t: Math.round(t), kind: cc.kind, ok: cc.ok, ...(ms !== undefined ? { ms: Math.round(ms) } : {}) });
  }
  const asked = Math.round(num(l.asked, 0, 500) ?? 0);
  const claimedPassed = num(l.passed, 0, 500);
  // The list, when sent, is the evidence: its length is what was asked (a smaller `asked` can't hide the failed
  // checks it lists) and the passes can't be more than it shows.
  const listed = checks.length ? { asked: checks.length, passed: checks.filter((c) => c.ok).length } : null;
  const liveness = {
    asked: listed ? listed.asked : asked,
    passed: listed ? Math.min(listed.passed, Math.round(claimedPassed ?? listed.passed)) : Math.round(claimedPassed ?? 0),
    ...(checks.length ? { checks } : {}),
  };
  liveness.passed = Math.min(liveness.passed, liveness.asked);
  if (!moves.length) return null;
  return {
    v: 1,
    moves,
    trackedS: Math.round(num(r.trackedS, 0, 13 * 3600) ?? 0),
    workS: Math.round(num(r.workS, 0, 13 * 3600) ?? 0),
    liveness,
    ...(r.heart === "watch" || r.heart === "strap" ? { heart: r.heart } : {}),
    ...(r.view === "front" || r.view === "side" ? { view: r.view } : {}),
  };
}

/** Total volume (Σ reps × kg) of a summary, for the review and the coach. */
export function cameraVolumeKg(c: Pick<CameraSummary, "moves">): number {
  let v = 0;
  for (const m of c.moves) for (const s of m.sets) if (s.loadKg) v += s.reps * s.loadKg;
  return Math.round(v);
}

/** Total reps and sets of a summary. */
export function cameraTotals(c: Pick<CameraSummary, "moves">): { reps: number; sets: number; holdS: number } {
  let reps = 0;
  let sets = 0;
  let holdS = 0;
  for (const m of c.moves)
    for (const s of m.sets) {
      sets++;
      reps += s.reps;
      holdS += s.holdS ?? 0;
    }
  return { reps, sets, holdS };
}
