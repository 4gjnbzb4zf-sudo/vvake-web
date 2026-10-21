import { heartEffort, zoneSeconds, type HeartProfile } from "../heart";
import { MAX_SAMPLES, MINUTES_PER_ENERGY, SAMPLE_EVERY_S, type Sample, type WebSession } from "../workout";
import { cameraSessionPoints, cameraTotals, cleanCameraSummary, type CameraSummary } from "./cameraPoints";

/**
 * A camera workout recorded in the browser, as the API takes it (the phone's lib/cameraWorkout.ts toCameraSession):
 * source "web" (the server decides it anyway), the `camera` flag and summary cleaned exactly as the server will, no
 * distance, never an image or a pose. Without a heart rate: tier C, small capped camera points by the phone's rule
 * (the server's, shared 15 a UTC day, ADR-0046 amendment 2026-10-21), never a prize. With a Web Bluetooth strap (two
 * heart samples or more): tier B, its 10-s samples and heart fields like any web workout, camera.heart = "strap", heart
 * points (camera points 0). Pure: tested in webCameraSession.test.ts.
 */

export interface CameraRecord {
  id: string;
  sport: string;
  startedAtMs: number;
  endedAtMs: number;
  activeS: number;
  summary: CameraSummary;
  deviceKey: string;
  /** A heart-rate strap paired in this browser: its 10-s samples, your heart profile, the energy left at the start. */
  strap?: { samples: readonly Sample[]; heart: HeartProfile; energyAtStart: number };
}

/** Nothing to keep: under a minute, or no set with reps or a hold. */
export function cameraSessionEmpty(activeS: number, summary: CameraSummary | null): boolean {
  if (activeS < 60 || !summary) return true;
  const t = cameraTotals(summary);
  return t.reps <= 0 && t.holdS < 1;
}

export function toWebCameraSession(r: CameraRecord): WebSession {
  const lengthS = Math.max(1, Math.round((r.endedAtMs - r.startedAtMs) / 1000));
  const activeS = Math.max(0, Math.min(Math.round(r.activeS), lengthS));
  const camera = cleanCameraSummary(r.summary);
  const s: WebSession = {
    id: r.id,
    sport: r.sport,
    source: "web",
    startedAt: new Date(r.startedAtMs).toISOString(),
    endedAt: new Date(r.endedAtMs).toISOString(),
    activeS,
    tier: "C",
    flags: ["camera"],
    samples: [],
    deviceKey: r.deviceKey,
    ...(camera ? { camera } : {}),
  };
  const samples = (r.strap?.samples ?? []).slice(0, MAX_SAMPLES);
  const bpms = samples.map((x) => x.bpm).filter((b): b is number => b !== undefined);
  if (!r.strap || bpms.length < 2) return s;
  const heart = r.strap.heart;
  const budgetMin = Math.max(0, r.strap.energyAtStart) * MINUTES_PER_ENERGY;
  const hr = heartEffort(samples, heart, budgetMin);
  const all = heartEffort(samples, heart);
  return {
    ...s,
    tier: "B",
    samples: [...samples],
    avgBpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    maxBpm: Math.max(...bpms),
    zoneS: zoneSeconds(samples, heart),
    effort: all.effort,
    scored: hr.effort,
    energyUsed: Math.min(r.strap.energyAtStart, Math.ceil(hr.activeMin / MINUTES_PER_ENERGY)),
    hrProfile: {
      age: heart.age,
      restingHr: heart.restingHr,
      ...(heart.maxHr ? { maxHr: heart.maxHr } : {}),
      ...(heart.female ? { female: true } : {}),
      ...(heart.zones ? { zones: heart.zones } : {}),
    },
    ...(s.camera ? { camera: { ...s.camera, heart: "strap" as const } } : {}),
  };
}

/** The strap's sample for the 10-s mark at session second `t` (a heart rate only when it is fresh: 15 s at most). */
export function strapSample(t: number, bpm: { v: number; at: number } | null, now: number): Sample {
  const fresh = bpm && now - bpm.at <= 15_000 ? bpm.v : undefined;
  return { t, m: 0, ...(fresh !== undefined ? { bpm: fresh } : {}) };
}

export { SAMPLE_EVERY_S };

/** What the summary says about points before the account answers (the server decides, with the day's budget). */
export function cameraPointsPreview(summary: CameraSummary, activeS: number) {
  const r = cameraSessionPoints({ camera: summary, activeS, hrSamples: 0, appDevice: true });
  return { points: r.base, reason: r.reason, workMin: r.workMin };
}
