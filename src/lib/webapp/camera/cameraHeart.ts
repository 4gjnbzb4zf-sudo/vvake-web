// Copied from VVFit packages/game-core/src/cameraHeart.ts (4fe0f2a 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * The heart rate during a camera workout (ADR-0046 amendment 2026-10-21, "live heart rate"). Founder, after build 35:
 * "while video training, the heart rate should be shown and taken into account for intensity and points when a sensor
 * like a watch transmits the data."
 *
 * Sources, best first: the watch worn in the linked session (its live messages, about every 5 s: Apple Watch through
 * the mirrored workout, Wear OS over the Data Layer), then a Bluetooth heart-rate strap on the phone (or, in the web
 * app, through Web Bluetooth). Never both for the points: a linked watch session carries the heart, a strap only
 * scores without one (cameraPoints.ts, lib/cameraWorkout.ts toCameraSession).
 *
 * - `CameraHeart`: the bpm now (fresh for 15 s, then "no heart signal"), its zone (your own zones for the sport when
 *   you set them, hr.ts), and the session's heart effort for the summary (average, max, time in zones).
 * - `restHeartDecision`: the hands-free rest follows the heart (cameraFlow.ts): still in the top zones when the rest
 *   ends → 15 s more, at most 45 s more a rest; recovered (zone 1 or below for 5 s) halfway through a long rest of a
 *   routine with flexible rests → the next set in 10 s. Interval routines (`rest: "fixed"`) are never shortened and
 *   only stretched in zone 5.
 *
 * Display and pacing only: the points stay the server's (the heart samples a watch or strap session uploads).
 * Pure and deterministic.
 */
/** A heart zone, 0 (under zone 1) to 5 (hr.ts Zone). */
export type HeartZone = 0 | 1 | 2 | 3 | 4 | 5;
/** The zone of a heart rate (the phone passes hr.ts zoneOfBpm with your profile; the web its own copy). */
export type ZoneOf = (bpm: number) => number;
const clampZone = (z: number): HeartZone => Math.max(0, Math.min(5, Math.round(Number.isFinite(z) ? z : 0))) as HeartZone;

export type CameraHeartSource = "watch" | "strap";

export const CAMERA_HEART = {
  /** A reading older than this isn't "now": the screen says "no heart signal". */
  staleMs: 15_000,
  /** A heart rate a person can have during a workout. */
  minBpm: 25,
  maxBpm: 240,
  /** Gaps longer than this between two readings don't count toward the time in zones. */
  maxGapMs: 10_000,
  /** Still high when the rest ends: this many seconds more… */
  extendS: 15,
  /** …at most this many more a rest. */
  maxExtraS: 45,
  /** "Still high": this zone or above (`rest: "fixed"` routines: zone 5 only). */
  highZone: 4,
  fixedHighZone: 5,
  /** The decision to stretch a rest is taken this close to its end (the voice says it before the next set). */
  decideBeforeEndMs: 5_000,
  /** "Recovered": this zone or below, held this long… */
  recoveredZone: 1,
  recoveredHoldMs: 5_000,
  /** …in a planned rest this long or longer, after half of it and at least 20 s: the next set in 10 s. */
  shortenMinRestS: 45,
  shortenMinElapsedS: 20,
  shortenToS: 10,
} as const;

export interface HeartNow {
  bpm: number;
  zone: HeartZone;
  source: CameraHeartSource;
  /** When it was read (ms). */
  at: number;
}

export interface CameraHeartStats {
  source: CameraHeartSource;
  avgBpm: number;
  maxBpm: number;
  /** Seconds in zones 0…5. */
  zoneS: [number, number, number, number, number, number];
  /** Readings counted. */
  readings: number;
}

export type HeartSignal = "live" | "lost" | "none";

const usable = (bpm: unknown): bpm is number =>
  typeof bpm === "number" && Number.isFinite(bpm) && bpm >= CAMERA_HEART.minBpm && bpm <= CAMERA_HEART.maxBpm;
const RANK: Record<CameraHeartSource, number> = { watch: 2, strap: 1 };

/** The heart rate now and over the session, from whichever source is best at the time. */
export class CameraHeart {
  private last: Partial<Record<CameraHeartSource, { bpm: number; at: number }>> = {};
  private acc: { at: number; bpm: number; zone: HeartZone } | null = null;
  private sumBpmMs = 0;
  private ms = 0;
  private max = 0;
  private n = 0;
  private zoneMs: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  private statSource: CameraHeartSource | null = null;

  constructor(private zoneOf: ZoneOf) {}

  /** Your zones changed (a sport's own zones, the profile arrived). */
  setZones(zoneOf: ZoneOf) {
    this.zoneOf = zoneOf;
  }

  private zone(bpm: number): HeartZone {
    return clampZone(this.zoneOf(bpm));
  }

  /** A reading from a source at `atMs`. False when it isn't a usable heart rate (0, a bad packet). */
  push(source: CameraHeartSource, bpm: number | undefined | null, atMs: number): boolean {
    if (!usable(bpm)) return false;
    const b = Math.round(bpm);
    this.last[source] = { bpm: b, at: atMs };
    // The session's effort follows the best source live (a strap reading doesn't count while the watch's is fresh).
    const best = this.now(atMs);
    if (!best || best.source !== source) return true;
    const zone = this.zone(b);
    if (this.acc && atMs > this.acc.at) {
      const dt = atMs - this.acc.at;
      if (dt <= CAMERA_HEART.maxGapMs) {
        this.zoneMs[this.acc.zone] += dt;
        this.sumBpmMs += this.acc.bpm * dt;
        this.ms += dt;
      }
    }
    this.acc = { at: atMs, bpm: b, zone };
    this.max = Math.max(this.max, b);
    this.n++;
    if (!this.statSource || RANK[source] > RANK[this.statSource]) this.statSource = source;
    return true;
  }

  /** The freshest best reading (watch first), or null when every source is quiet for 15 s. */
  now(nowMs: number): HeartNow | null {
    for (const source of ["watch", "strap"] as const) {
      const l = this.last[source];
      if (l && nowMs - l.at <= CAMERA_HEART.staleMs && l.at <= nowMs + 1000)
        return { bpm: l.bpm, zone: this.zone(l.bpm), source, at: l.at };
    }
    return null;
  }

  /** "live" (a fresh reading), "lost" (there were readings, none for 15 s), "none" (never one). */
  signal(nowMs: number): HeartSignal {
    if (this.now(nowMs)) return "live";
    return this.last.watch || this.last.strap ? "lost" : "none";
  }

  /** The session's heart effort (null without at least 2 readings). */
  stats(): CameraHeartStats | null {
    if (this.n < 2 || !this.statSource) return null;
    const avg = this.ms > 0 ? this.sumBpmMs / this.ms : (this.acc?.bpm ?? 0);
    return {
      source: this.statSource,
      avgBpm: Math.round(avg),
      maxBpm: this.max,
      zoneS: this.zoneMs.map((x) => Math.round(x / 1000)) as CameraHeartStats["zoneS"],
      readings: this.n,
    };
  }
}

/** How a routine's rests may follow the heart: "flex" (stretched and shortened) or "fixed" (intervals). */
export type RestRule = "flex" | "fixed";

export interface RestHeartInput {
  nowMs: number;
  restStartMs: number;
  restUntilMs: number;
  /** The rest the plan asked for (s). */
  plannedS: number;
  /** Seconds already added to this rest. */
  extraS: number;
  /** Already shortened once. */
  shortened: boolean;
  rule: RestRule;
  /** The heart now (null: no fresh reading: the rest stays as planned). */
  heart: { bpm: number; zone: number } | null;
  /** Since when the heart has been in the recovered zones (null: it isn't). */
  recoveredSince: number | null;
}

export type RestHeartDecision = { kind: "extend"; addS: number } | { kind: "shorten"; leftS: number } | null;

/** Whether the rest should follow the heart now. */
export function restHeartDecision(i: RestHeartInput): RestHeartDecision {
  if (!i.heart) return null;
  const left = i.restUntilMs - i.nowMs;
  const high = i.rule === "fixed" ? CAMERA_HEART.fixedHighZone : CAMERA_HEART.highZone;
  if (left <= CAMERA_HEART.decideBeforeEndMs && i.heart.zone >= high && i.extraS < CAMERA_HEART.maxExtraS) {
    return { kind: "extend", addS: Math.min(CAMERA_HEART.extendS, CAMERA_HEART.maxExtraS - i.extraS) };
  }
  if (i.rule !== "flex" || i.shortened || i.extraS > 0 || i.plannedS < CAMERA_HEART.shortenMinRestS) return null;
  const elapsedS = (i.nowMs - i.restStartMs) / 1000;
  if (elapsedS < Math.max(CAMERA_HEART.shortenMinElapsedS, i.plannedS / 2)) return null;
  if (left <= (CAMERA_HEART.shortenToS + 5) * 1000) return null;
  if (i.heart.zone > CAMERA_HEART.recoveredZone || i.recoveredSince === null || i.nowMs - i.recoveredSince < CAMERA_HEART.recoveredHoldMs)
    return null;
  return { kind: "shorten", leftS: CAMERA_HEART.shortenToS };
}

/** The coach's line when a rest follows the heart (both apps and the web say the same). */
export function restHeartLine(d: { kind: "extend"; addS: number } | { kind: "shorten"; leftS: number }, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  if (d.kind === "extend")
    return fr ? `Cœur encore haut : prends ${d.addS} secondes de plus.` : `Heart still high: take ${d.addS} more seconds.`;
  return fr ? `Ton cœur a récupéré : on reprend dans ${d.leftS} secondes.` : `Your heart has recovered: next set in ${d.leftS} seconds.`;
}

/** The zone's short name for the camera screen ("Zone 3 · Steady"). */
export const HEART_ZONE_NAMES: Readonly<Record<HeartZone, { en: string; fr: string }>> = {
  0: { en: "Resting", fr: "Repos" },
  1: { en: "Warm-up", fr: "Échauffement" },
  2: { en: "Easy", fr: "Facile" },
  3: { en: "Steady", fr: "Soutenu" },
  4: { en: "Hard", fr: "Intense" },
  5: { en: "Max", fr: "Max" },
};

export function heartZoneLabel(zone: number, lang: "en" | "fr"): string {
  const z = clampZone(zone);
  const name = HEART_ZONE_NAMES[z][lang];
  return z === 0 ? name : `Zone ${z} · ${name}`;
}

/** "No heart signal" / the source in use, for the camera screen's heart tile. */
export function heartSourceLabel(s: CameraHeartSource | null, signal: HeartSignal, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  if (signal === "lost") return fr ? "Pas de signal cardiaque" : "No heart signal";
  if (signal === "none" || !s) return fr ? "En attente du cœur…" : "Waiting for heart rate…";
  return s === "watch" ? (fr ? "Montre" : "Watch") : fr ? "Ceinture" : "Strap";
}

/** The big digits on the camera screens: one line always ("1:05", never "65" seconds wrapping). */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A hold's seconds as shown big: "45s" under a minute, then "1:05". */
export function holdText(s: number): string {
  const n = Math.max(0, Math.floor(s));
  return n < 60 ? `${n}s` : clockText(n * 1000);
}

/**
 * The font size that keeps a big number on one line in `width` px: about 0.8 em a digit in the wide display font
 * (Unbounded Bold; the colon and "s" narrower), capped at `max`, never below `min`. Used with numberOfLines=1 and the platform's shrink as
 * a second guard, so a wider glyph or large system text still never wraps.
 */
export function bigDigitSize(text: string, width: number, max: number, min = 40): number {
  let em = 0;
  for (const ch of text) em += ch === ":" || ch === "." ? 0.4 : ch === "s" ? 0.7 : 0.8;
  if (em <= 0 || !(width > 0)) return max;
  return Math.max(min, Math.min(max, Math.floor((width * 0.92) / em)));
}
