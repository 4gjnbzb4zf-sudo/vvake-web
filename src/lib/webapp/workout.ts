import sportLive from "@/data/sportLive.json";
import { sports } from "@/lib/sports";
import type { Locale } from "@/i18n/config";
import { emptyTrack, type TrackState } from "./geo";
import { heartEffort, zoneSeconds, type HeartProfile } from "./heart";
import type { CameraSummary } from "./camera/cameraPoints";

/**
 * A workout recorded in the browser (vvake.com/app), with the phone app's rules (apps/mobile app/workout.tsx):
 * the clock from the wall clock minus pauses (timers stop when a tab sleeps, the time still catches up), a sample every
 * 10 s for ghosts and the server's checks (distance, heart rate; never a position), the same empty-session rule, the
 * same energy (scored minutes spend it, it refills a quarter at 00:00, 06:00, 12:00, 18:00) and the same evidence:
 * GPS only → tier C (journal, distance, streak, no points: "no sensor, no proof"); a live heart-rate strap → tier B,
 * points from the server's own heart-rate score. A web session never counts for prizes (ADR in the monorepo: web
 * workouts, points, no prize): the API stores it as source "web" whatever the page says.
 *
 * Pure: tested in workout.test.ts. The snapshot is what IndexedDB keeps so a reload resumes the workout.
 */

export interface SportLive {
  outdoor: boolean;
  cap: number | null;
  persona: string | null;
  vvaker: string;
  category: string;
  met: number;
}

const LIVE = sportLive as Record<string, SportLive>;

export interface WebSport {
  key: string;
  name: { en: string; fr: string };
  category: string;
  gps: boolean;
  distance: boolean;
  outdoor: boolean;
  capKmh: number | null;
  /** The VVaker persona picture for it (public/personas), when there is one. */
  persona: string | null;
}

export const WEB_SPORTS: WebSport[] = sports.sports.map((s) => {
  const l = LIVE[s.key];
  return {
    key: s.key,
    name: s.name,
    category: s.category,
    gps: s.gps,
    distance: s.distance,
    outdoor: l?.outdoor ?? false,
    capKmh: l?.cap ?? null,
    persona: l?.persona ?? null,
  };
});

/** The sports offered first (the apps' quick picks). */
export const QUICK_SPORTS = ["run", "walk", "ride", "hike", "strength", "yoga", "dance", "boxing"];

/**
 * The quick picks with your sports first ("Your VVake", in the order you tapped them: main first, build 56, as on the
 * phone's picker), then the usual ones; sports this site doesn't know are left out; as many as the usual grid. Pure.
 */
export function quickSportsFor(mine: readonly string[] = []): string[] {
  const known = (k: string) => WEB_SPORTS.some((s) => s.key === k);
  return [...new Set([...mine.filter(known), ...QUICK_SPORTS])].slice(0, Math.max(QUICK_SPORTS.length, mine.length));
}

export const sportOf = (key: string): WebSport =>
  WEB_SPORTS.find((s) => s.key === key) ?? {
    key: "other",
    name: { en: "Workout", fr: "Séance" },
    category: "other",
    gps: false,
    distance: false,
    outdoor: false,
    capKmh: null,
    persona: null,
  };

export const sportLabel = (key: string, lang: Locale) => sportOf(key).name[lang];

/** Tracks GPS on the web: outdoor sports that measure a distance (indoors there is nothing to follow). */
export const usesGps = (s: WebSport) => s.gps && s.outdoor;

// ── The running workout (what IndexedDB keeps) ──────────────────────────────────────────────────────────────────

export const SAMPLE_EVERY_S = 10;
/** The phone's sample cap (12 h of 10 s samples). */
export const MAX_SAMPLES = 4320;

export interface Sample {
  t: number;
  m: number;
  bpm?: number;
}

export interface WorkoutSnapshot {
  v: 1;
  /** The session id it will be uploaded with (uuid). */
  id: string;
  /** The account it belongs to (never uploaded to another one). */
  userId: string;
  sport: string;
  startedAt: number;
  pausedMs: number;
  /** When the current pause started (0: running). */
  pausedAt: number;
  track: TrackState;
  samples: Sample[];
  /** The last heart rate and when (ms), for the next sample; dropped when older than 15 s. */
  bpm?: { v: number; at: number };
  maxBpm?: number;
  /** Seconds of the last 10-s mark written. */
  lastSampleT: number;
  /** Energy left at the start (minutes of scored effort it allows). */
  energyAtStart: number;
  /** Ended: the session is built and waits in the upload queue. */
  endedAt?: number;
}

export function newWorkout(o: { id: string; userId: string; sport: string; now: number; energy: number }): WorkoutSnapshot {
  return {
    v: 1,
    id: o.id,
    userId: o.userId,
    sport: o.sport,
    startedAt: o.now,
    pausedMs: 0,
    pausedAt: 0,
    track: emptyTrack(),
    samples: [],
    lastSampleT: 0,
    energyAtStart: o.energy,
  };
}

/** Seconds of the session at `now` (pauses taken out). */
export function elapsedS(w: Pick<WorkoutSnapshot, "startedAt" | "pausedMs" | "pausedAt">, now: number): number {
  const paused = w.pausedMs + (w.pausedAt ? Math.max(0, now - w.pausedAt) : 0);
  return Math.max(0, Math.floor((now - w.startedAt - paused) / 1000));
}

export const isPaused = (w: WorkoutSnapshot) => w.pausedAt > 0;

export function pause(w: WorkoutSnapshot, now: number): WorkoutSnapshot {
  if (w.pausedAt) return w;
  // Don't count the walk back while paused: distance starts again from the next good fix.
  return { ...w, pausedAt: now, track: { ...w.track, last: null } };
}

export function resume(w: WorkoutSnapshot, now: number): WorkoutSnapshot {
  if (!w.pausedAt) return w;
  return { ...w, pausedMs: w.pausedMs + Math.max(0, now - w.pausedAt), pausedAt: 0 };
}

/**
 * After a reload: the clock keeps the time that passed (as the phone's wall clock does); the distance starts again
 * from the next fix (no straight line across the gap).
 */
export const afterReload = (w: WorkoutSnapshot): WorkoutSnapshot => ({ ...w, track: { ...w.track, last: null } });

/** A heart-rate reading from the strap. */
export function withHeart(w: WorkoutSnapshot, bpm: number, now: number): WorkoutSnapshot {
  return { ...w, bpm: { v: bpm, at: now }, maxBpm: Math.max(w.maxBpm ?? 0, bpm) };
}

/** Writes the 10-s samples due by `now` (several after the tab slept: the distance as it is now, no heart rate then). */
export function tick(w: WorkoutSnapshot, now: number): WorkoutSnapshot {
  if (w.pausedAt) return w;
  const t = elapsedS(w, now);
  if (t < w.lastSampleT + SAMPLE_EVERY_S) return w;
  const samples = [...w.samples];
  let last = w.lastSampleT;
  const fresh = w.bpm && now - w.bpm.at <= 15_000 ? w.bpm.v : undefined;
  for (let at = last + SAMPLE_EVERY_S; at <= t && samples.length < MAX_SAMPLES; at += SAMPLE_EVERY_S) {
    // A heart rate only on the mark it was read for (a catch-up after a sleep has none).
    const bpm = at + SAMPLE_EVERY_S > t ? fresh : undefined;
    samples.push({ t: at, m: Math.round(w.track.metres), ...(bpm !== undefined ? { bpm } : {}) });
    last = at;
  }
  return { ...w, samples, lastSampleT: last };
}

// ── Ending: the session the API takes (POST /v1/sessions/batch) ────────────────────────────────────────────────

/** Nothing worth saving (game-core emptySession): under a minute, or no heart rate and under 30 m. */
export function emptyReason(activeS: number, metres: number, hrSamples: number): "too_short" | "no_signal" | null {
  if (activeS < 60) return "too_short";
  if (hrSamples === 0 && metres < 30) return "no_signal";
  return null;
}

export interface WebSession {
  id: string;
  sport: string;
  source: "web";
  startedAt: string;
  endedAt: string;
  activeS: number;
  distanceM?: number;
  avgBpm?: number;
  maxBpm?: number;
  zoneS?: [number, number, number, number, number];
  effort?: number;
  scored?: number;
  tier: "B" | "C";
  energyUsed?: number;
  flags: string[];
  samples: Sample[];
  deviceKey: string;
  hrProfile?: { age: number; restingHr: number; maxHr?: number; female?: boolean; zones?: number[] };
  /** A camera workout (camera/webCameraSession.ts): counts only, never an image or a pose. */
  camera?: CameraSummary;
}

export const MINUTES_PER_ENERGY = 5;

/**
 * The session to upload. Tier B (heart-rate evidence) needs at least two heart samples; without, tier C and no
 * effort score at all (the phone never sends an estimate as points). `scored` is the effort within the energy left
 * (the server keeps min(client, its own score from the samples)).
 */
export function buildSession(w: WorkoutSnapshot, o: { now: number; deviceKey: string; heart: HeartProfile; gps: boolean }): WebSession {
  const end = w.endedAt ?? o.now;
  const activeS = elapsedS(w, end);
  const samples = w.samples.slice(0, MAX_SAMPLES);
  const bpms = samples.map((s) => s.bpm).filter((b): b is number => b !== undefined);
  const withHr = bpms.length >= 2;
  const budgetMin = Math.max(0, w.energyAtStart) * MINUTES_PER_ENERGY;
  const hr = withHr ? heartEffort(samples, o.heart, budgetMin) : null;
  const all = withHr ? heartEffort(samples, o.heart) : null;
  const metres = Math.round(w.track.metres);
  return {
    id: w.id,
    sport: w.sport,
    source: "web",
    startedAt: new Date(w.startedAt).toISOString(),
    endedAt: new Date(end).toISOString(),
    activeS,
    ...(o.gps && metres > 0 ? { distanceM: metres } : {}),
    ...(withHr
      ? {
          avgBpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
          maxBpm: Math.max(...bpms, w.maxBpm ?? 0),
          zoneS: zoneSeconds(samples, o.heart),
          effort: all!.effort,
          scored: hr!.effort,
          energyUsed: Math.min(w.energyAtStart, Math.ceil(hr!.activeMin / MINUTES_PER_ENERGY)),
          hrProfile: {
            age: o.heart.age,
            restingHr: o.heart.restingHr,
            ...(o.heart.maxHr ? { maxHr: o.heart.maxHr } : {}),
            ...(o.heart.female ? { female: true } : {}),
            ...(o.heart.zones ? { zones: o.heart.zones } : {}),
          },
        }
      : {}),
    tier: withHr ? "B" : "C",
    flags: [],
    samples,
    deviceKey: o.deviceKey,
  };
}

// ── Energy (game-core energy.ts) ─────────────────────────────────────────────────────────────────────────────

export interface EnergyState {
  current: number;
  updatedAt: number;
}

/** Max energy: 4, +1 from a 7-day streak, +2 from 30 days (no gear on the web). */
export const maxEnergy = (streakDays: number) => 4 + (streakDays >= 30 ? 2 : streakDays >= 7 ? 1 : 0);

const SLOT_MS = 6 * 3600 * 1000;

/** Refills a quarter of max at each local 00:00, 06:00, 12:00 and 18:00 crossed since `updatedAt`. */
export function refill(s: EnergyState | null, now: number, max: number, tzOffsetMin: number): EnergyState {
  if (!s || !Number.isFinite(s.current) || !Number.isFinite(s.updatedAt)) return { current: max, updatedAt: now };
  const off = tzOffsetMin * 60_000;
  const slots = now > s.updatedAt ? Math.floor((now + off) / SLOT_MS) - Math.floor((s.updatedAt + off) / SLOT_MS) : 0;
  return { current: Math.min(max, Math.max(0, s.current) + slots * 0.25 * max), updatedAt: Math.max(now, s.updatedAt) };
}

export const spend = (s: EnergyState, units: number): EnergyState => ({ ...s, current: Math.max(0, s.current - Math.max(0, units)) });

/** 1 + 5 % a day of streak, +50 % at most (game-core streakMultiplier). */
export const streakMultiplier = (days: number) => Math.round((1 + Math.min(0.5, 0.05 * Math.max(0, Math.floor(days) - 1))) * 100) / 100;

// ── Uuid ────────────────────────────────────────────────────────────────────────────────────────────────────

export function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
