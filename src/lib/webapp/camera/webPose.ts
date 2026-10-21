import { frameFromFlat, JOINTS, type PoseFrame } from "./cameraPose";

/**
 * The browser's pose, in the phone's shape (monorepo apps/mobile/modules/vvake-pose, Android's MediaPipe path): the
 * webcam frame is analysed as the camera gives it (never mirrored), MediaPipe's 33 landmarks become the 17 joints
 * game-core reads (cameraPose.ts JOINTS, COCO order), confidence = the landmark's visibility (else its presence), and
 * x is flipped for a user-facing camera so the points sit on the mirrored preview; the labels stay anatomical (your
 * left arm is `lWrist`). Pure: tested in webPose.test.ts.
 */

/** MediaPipe's 33 landmarks → our 17: nose, l/r eye, l/r ear, l/r shoulder, elbow, wrist, hip, knee, ankle. */
export const MP_INDEX = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] as const;

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

/** The native module's flat array ([x, y, c] × 17), from one person's 33 landmarks; [] when nobody is there. */
export function flatFromLandmarks(lms: readonly Landmark[] | null | undefined, mirror: boolean): number[] {
  if (!lms || lms.length < 29) return [];
  const out: number[] = [];
  for (const i of MP_INDEX) {
    const lm = lms[i];
    if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) {
      out.push(0, 0, 0);
      continue;
    }
    const c = Math.min(1, Math.max(0, lm.visibility ?? lm.presence ?? 0));
    out.push(mirror ? 1 - lm.x : lm.x, lm.y, c);
  }
  return out;
}

/** A game-core frame from MediaPipe's landmarks (null: nobody, or too few joints sure). */
export function frameFromLandmarks(
  t: number,
  w: number,
  h: number,
  lms: readonly Landmark[] | null | undefined,
  mirror: boolean,
): PoseFrame | null {
  return frameFromFlat(t, w, h, flatFromLandmarks(lms, mirror));
}

export const JOINT_COUNT = JOINTS.length;

/** How much the body moved between two frames (mean joint shift, image fractions): under ~0.012 is "still". */
export function motionBetween(a: PoseFrame | null, b: PoseFrame | null): number {
  if (!a || !b) return 0;
  let sum = 0;
  let n = 0;
  for (const k of Object.keys(b.joints) as (keyof PoseFrame["joints"])[]) {
    const p = a.joints[k];
    const q = b.joints[k];
    if (!p || !q) continue;
    sum += Math.hypot(p.x - q.x, p.y - q.y);
    n++;
  }
  return n ? sum / n : 0;
}

/**
 * How many frames a second to analyse (the phone's analysisFps, with a slow computer instead of a hot phone): 15
 * while you move, 8 once you've held still for 5 s; on a machine where one analysis takes long, fewer (keep it under
 * about 40 % of the time), never under 4.
 */
export function analysisFps(o: { stillMs: number; detectMs: number }): number {
  const base = o.stillMs >= 5000 ? 8 : 15;
  if (!(o.detectMs > 0)) return base;
  return Math.max(4, Math.min(base, Math.floor(400 / o.detectMs)));
}

/** A running average of the analysis time (ms), so one slow frame doesn't drop the rate. */
export function detectAverage(prev: number, ms: number): number {
  if (!(ms >= 0) || !Number.isFinite(ms)) return prev;
  return prev > 0 ? prev * 0.85 + ms * 0.15 : ms;
}

/**
 * Where a normalised point of the analysed image lands in the view: the video fills the view (object-fit: cover,
 * centred), like the phone's native preview.
 */
export function toView(
  p: { x: number; y: number },
  img: { w: number; h: number },
  view: { width: number; height: number },
): { x: number; y: number } {
  const scale = Math.max(view.width / img.w, view.height / img.h);
  const dx = (view.width - img.w * scale) / 2;
  const dy = (view.height - img.h * scale) / 2;
  return { x: p.x * img.w * scale + dx, y: p.y * img.h * scale + dy };
}

/** The rest left, "1:05". */
export const restClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A seeded random source from the browser's secure random bytes (game-core's liveness schedule, mulberry32). */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const LB_PER_KG = 2.20462;

/** A load typed in your units → kg (one decimal); nothing or not a number → undefined (apps/mobile cameraWorkout.ts). */
export function loadToKg(text: string, units: "metric" | "imperial"): number | undefined {
  const n = Number(String(text).replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return undefined;
  return Math.round((units === "imperial" ? n / LB_PER_KG : n) * 10) / 10;
}

/** kg → the number shown in your units (whole lb, kg to one decimal when it has one). */
export function kgToUnits(kg: number, units: "metric" | "imperial"): string {
  if (units === "imperial") return String(Math.round(kg * LB_PER_KG));
  return String(Math.round(kg * 10) / 10);
}

export const loadUnit = (units: "metric" | "imperial") => (units === "imperial" ? "lb" : "kg");
