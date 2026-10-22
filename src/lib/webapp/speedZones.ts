/**
 * Ported from VVFit packages/game-core/src/speedZones.ts (ADR-0044): keep the numbers identical. Checked against the
 * monorepo's parity data (fixtures/speed-zone-fixtures.json, a byte-for-byte copy of
 * apps/watch-ios/VVakeWatchTests/speed-zone-fixtures.json) in speedZones.test.ts.
 *
 * Speed zones: when a session has no heart rate (GPS only, the web without a strap), the live zone comes from your
 * speed instead, against thresholds you can set per sport, because paces differ from one person to the next.
 * Guidance and voice cues only: a session without a heart rate still earns 0 points (ADR-0024 §4, ADR-0043), whatever
 * its speed zones say, and speed zones never go into the uploaded session's heart-rate fields.
 *
 * Same shape as heart-rate zones (heart.ts): five thresholds where zones 1…5 start, here in km/h; below zone 1 is
 * zone 0. Stored in km/h on the account (user.prefs.speedZones); shown as a pace (min/km, min/mi) for walk, run and
 * hike-like sports, a speed (km/h, mph) for the fast ones.
 *
 * The easy editor asks two numbers per sport: my easy pace (inside zone 2) and my hard pace (inside zone 4):
 *   zone 1 from 60% of easy, zone 2 from 85% of easy, zones 3 and 4 split easy → hard in thirds, zone 5 from 108% of hard.
 * Or your own five values (`custom`), checked by `validSpeedThresholds`.
 *
 * The web app's sport catalog (workout.ts WEB_SPORTS: `gps` and the speed cap from sportLive.json) is the monorepo's
 * catalog exported; the web has no custom sports.
 */
import type { Units } from "./format";
import { MILE_M, SPEED_SPORTS } from "./format";
import { WEB_SPORTS, type WebSport } from "./workout";

export type Zone = 0 | 1 | 2 | 3 | 4 | 5;

/** Where zones 1, 2, 3, 4 and 5 start, in km/h (strictly increasing). */
export type SpeedThresholds = [number, number, number, number, number];

/** One sport's setting on the account: easy and hard (km/h), or five values of your own over them. */
export interface SportSpeedSetting {
  easy: number;
  hard: number;
  /** Your own five thresholds (km/h); when valid they win over easy / hard. */
  custom?: SpeedThresholds;
}

/** user.prefs.speedZones: every sport you set, and when (newest wins across devices). */
export interface SpeedZonesPrefs {
  /** ISO time of the last change on any device. */
  at: string;
  sports: Record<string, SportSpeedSetting>;
}

export const SPEED_MIN_KMH = 0.5;
export const SPEED_MAX_KMH = 150;
export const SPEED_GAP_KMH = 0.1;
export const HARD_OVER_EASY = 1.1;
export const SPEED_SPORTS_MAX = 40;
export const SPEED_ZONE_RULE = { z1: 0.6, z2: 0.85, z5: 1.08 } as const;

const DEFAULTS: Readonly<Record<string, { easy: number; hard: number }>> = {
  walk: { easy: 4.5, hard: 6.5 },
  hike: { easy: 3.5, hard: 5 },
  run: { easy: 9, hard: 12 },
  ride: { easy: 18, hard: 27 },
  "wheelchair-walk": { easy: 4, hard: 6 },
  "wheelchair-run": { easy: 10, hard: 16 },
  "hand-cycling": { easy: 12, hard: 20 },
  skate: { easy: 12, hard: 20 },
  "swim-bike-run": { easy: 9, hard: 12 },
  // Swimming: easy 2:30 /100 m, hard 1:55 /100 m (a regular lap swimmer). Rowing: easy 2:30 /500 m, hard 2:05 /500 m.
  swim: { easy: 2.4, hard: 3.1 },
  "open-water": { easy: 2.4, hard: 3.1 },
  rowing: { easy: 12, hard: 14.4 },
};
/** Speed caps (km/h) for sports with pace zones but no catalog speed cap (indoor rowing: no GPS distance). */
const PACE_CAPS: Readonly<Record<string, number>> = { rowing: 25 };
const capShare = { easy: 0.35, hard: 0.55 } as const;

const r1 = (x: number) => Math.round(x * 10) / 10;

const sportInfo = (sport: string): WebSport | undefined => WEB_SPORTS.find((s) => s.key === sport);

/**
 * How a sport's speed reads (sport-zones, 2026-10-21): `pace` per km or mile (walking, running, hiking speeds),
 * `speed` in km/h or mph (riding, skating, skiing), `swim` per 100 m or 100 yd, `row` per 500 m, or `none`: pace
 * makes no sense there (strength, yoga, team sports, machines without a distance) and the apps say "not used".
 */
export type PaceKind = "pace" | "speed" | "swim" | "row" | "none";

const SWIM_SPORTS = new Set(["swim", "open-water"]);

export function paceKind(sport: string): PaceKind {
  const e = sportInfo(sport);
  if (!e) return "none";
  if (SWIM_SPORTS.has(e.key)) return "swim";
  if (e.key === "rowing") return "row";
  if (!e.gps || !e.capKmh) return "none";
  return e.capKmh <= 35 && e.key !== "skate" ? "pace" : "speed";
}

/** Speed zones apply to sports with a pace or a speed (GPS sports, pool swimming, the rower). */
export function hasSpeedZones(sport: string): boolean {
  return paceKind(sport) !== "none";
}

/** Show a pace per km or mile rather than a speed (walking, running, hiking speeds). Swim and row: see paceKind. */
export function speedShownAsPace(sport: string): boolean {
  return paceKind(sport) === "pace";
}

/** Metres a swim / row pace is given for: 100 m (or 100 yd in imperial) for swimming, 500 m for rowing. */
export const SWIM_PACE_M = 100;
export const ROW_PACE_M = 500;
export const M_PER_YD = 0.9144;

const paceMetres = (kind: PaceKind, units: Units): number | undefined =>
  kind === "pace"
    ? units === "imperial"
      ? 1609.344
      : 1000
    : kind === "swim"
      ? units === "imperial"
        ? SWIM_PACE_M * M_PER_YD
        : SWIM_PACE_M
      : kind === "row"
        ? ROW_PACE_M
        : undefined;

/**
 * The seconds shown for a speed in its sport's pace (pace: per km / mi, swim: per 100 m / 100 yd, row: per 500 m), or
 * undefined for `speed` and `none` (shown as km/h, mph, or not at all).
 */
export function paceSeconds(kmh: number, kind: PaceKind, units: Units = "metric"): number | undefined {
  if (!(kmh > 0)) return undefined;
  const m = paceMetres(kind, units);
  return m === undefined ? undefined : m / (kmh / 3.6);
}

/** The inverse of paceSeconds: km/h from the seconds of a pace in that kind and units. */
export function kmhOfPaceSeconds(seconds: number, kind: PaceKind, units: Units = "metric"): number | undefined {
  if (!(seconds > 0)) return undefined;
  const m = paceMetres(kind, units);
  return m === undefined ? undefined : (m / seconds) * 3.6;
}

/** The unit suffix of a kind: "/km", "/mi", "/100 m", "/100 yd", "/500 m", "km/h", "mph"; "" for none. */
export function paceKindUnit(kind: PaceKind, units: Units = "metric"): string {
  if (kind === "pace") return units === "imperial" ? "/mi" : "/km";
  if (kind === "swim") return units === "imperial" ? "/100 yd" : "/100 m";
  if (kind === "row") return "/500 m";
  if (kind === "speed") return units === "imperial" ? "mph" : "km/h";
  return "";
}

/** A speed in its sport's terms: "6:40 /km", "2:05 /100 m", "2:10 /500 m", "18 km/h", "11.2 mph". */
export function paceKindText(kmh: number, kind: PaceKind, units: Units = "metric"): string {
  const sec = paceSeconds(kmh, kind, units);
  if (sec !== undefined) {
    const r = Math.round(sec);
    return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")} ${paceKindUnit(kind, units)}`;
  }
  if (kind === "none") return "";
  const v = Math.round((units === "imperial" ? kmh / 1.609344 : kmh) * 10) / 10;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)} ${paceKindUnit(kind, units)}`;
}

/** Your level (athlete survey experience) scales the default easy / hard until your own sessions say more. */
export type SpeedLevel = "new" | "returning" | "regular" | "trained" | "competitive";
export const LEVEL_SPEED_SCALE: Readonly<Record<SpeedLevel, number>> = {
  new: 0.85,
  returning: 0.92,
  regular: 1,
  trained: 1.12,
  competitive: 1.25,
};

/**
 * Speed (km/h, mph) rather than pace on the live screen and session summaries: the spec's rule for GPS sports (the
 * opposite of `speedShownAsPace`, so the editor and the live screen agree); the older list for anything else.
 */
export const showsSpeed = (sport: string) => {
  const k = paceKind(sport);
  return k === "speed" ? true : k === "none" ? SPEED_SPORTS.has(sport) : false;
};

/** The default easy / hard for a sport (km/h), or undefined for a sport without speed zones. */
export function defaultSpeedSetting(sport: string): { easy: number; hard: number } | undefined {
  const e = sportInfo(sport);
  if (!e || !hasSpeedZones(sport)) return undefined;
  const own = DEFAULTS[e.key];
  if (own) return { ...own };
  const cap = e.capKmh ?? PACE_CAPS[e.key] ?? 20;
  return { easy: r1(cap * capShare.easy), hard: r1(cap * capShare.hard) };
}

/** The default for your level (survey experience): easy and hard scaled, then normalised; undefined without speed zones. */
export function levelSpeedSetting(sport: string, level?: SpeedLevel | string | null): { easy: number; hard: number } | undefined {
  const d = defaultSpeedSetting(sport);
  if (!d) return undefined;
  const k = level ? (LEVEL_SPEED_SCALE[level as SpeedLevel] ?? 1) : 1;
  return k === 1 ? d : normalizeEasyHard(d.easy * k, d.hard * k);
}

/** Five finite thresholds, 0.5–150 km/h, each at least 0.1 km/h above the one before. */
export function validSpeedThresholds(z: unknown): z is SpeedThresholds {
  if (!Array.isArray(z) || z.length !== 5) return false;
  for (let i = 0; i < 5; i++) {
    const x = z[i];
    if (typeof x !== "number" || !Number.isFinite(x) || x < SPEED_MIN_KMH || x > SPEED_MAX_KMH) return false;
    if (i > 0 && x - (z[i - 1] as number) < SPEED_GAP_KMH - 1e-9) return false;
  }
  return true;
}

/** Easy and hard made usable: within the limits, hard at least 10% above easy (rounded to 0.1 km/h). */
export function normalizeEasyHard(easy: number, hard: number): { easy: number; hard: number } {
  const e = r1(Math.min(Math.max(easy, 1), SPEED_MAX_KMH / (HARD_OVER_EASY * SPEED_ZONE_RULE.z5)));
  const h = r1(Math.min(Math.max(hard, e * HARD_OVER_EASY), SPEED_MAX_KMH / SPEED_ZONE_RULE.z5));
  return { easy: e, hard: Math.max(h, r1(e * HARD_OVER_EASY)) };
}

/** The five thresholds from easy and hard, 0.1 km/h steps. */
export function speedThresholdsFrom(easy: number, hard: number): SpeedThresholds {
  const n = normalizeEasyHard(easy, hard);
  const d = n.hard - n.easy;
  const t = [
    n.easy * SPEED_ZONE_RULE.z1,
    n.easy * SPEED_ZONE_RULE.z2,
    n.easy + d / 3,
    n.easy + (2 * d) / 3,
    n.hard * SPEED_ZONE_RULE.z5,
  ].map(r1);
  for (let i = 1; i < 5; i++) if (t[i]! < t[i - 1]! + SPEED_GAP_KMH) t[i] = r1(t[i - 1]! + SPEED_GAP_KMH);
  return t as SpeedThresholds;
}

/** A sport's setting checked: your own valid values, else easy / hard normalised, else undefined. */
export function cleanSpeedSetting(s: unknown): SportSpeedSetting | undefined {
  const x = s as Partial<SportSpeedSetting> | null | undefined;
  if (!x || typeof x.easy !== "number" || typeof x.hard !== "number" || !Number.isFinite(x.easy) || !Number.isFinite(x.hard))
    return undefined;
  if (x.easy <= 0 || x.hard <= 0) return undefined;
  const n = normalizeEasyHard(x.easy, x.hard);
  return validSpeedThresholds(x.custom) ? { ...n, custom: x.custom.map(r1) as SpeedThresholds } : n;
}

/** The thresholds a session uses for a sport: your own values, else your easy / hard, else the sport's default. */
export function speedThresholdsFor(
  sport: string,
  prefs?: SpeedZonesPrefs | null,
  level?: SpeedLevel | string | null,
): SpeedThresholds | undefined {
  const s = cleanSpeedSetting(prefs?.sports?.[sport]);
  if (s?.custom) return s.custom;
  if (s) return speedThresholdsFrom(s.easy, s.hard);
  const d = levelSpeedSetting(sport, level);
  return d ? speedThresholdsFrom(d.easy, d.hard) : undefined;
}

/** The zone of a speed (km/h) against thresholds: 0 below zone 1's start. */
export function zoneOfSpeed(kmh: number, t: SpeedThresholds): Zone {
  if (!Number.isFinite(kmh) || kmh <= 0) return 0;
  let zone = 0;
  while (zone < 5 && kmh >= t[zone]!) zone++;
  return zone as Zone;
}

/** Live speed for the zone: the distance over the last `windowS` seconds (default 30 s). Samples are [t s, metres]. */
export const SPEED_WINDOW_S = 30;
export function windowSpeedKmh(samples: readonly (readonly [number, number])[], windowS = SPEED_WINDOW_S): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  let i = samples.length - 2;
  while (i > 0 && last[0] - samples[i]![0] < windowS) i--;
  const first = samples[i]!;
  const dt = last[0] - first[0];
  if (dt < Math.min(10, windowS)) return 0;
  return Math.max(0, ((last[1] - first[1]) / dt) * 3.6);
}

/** A past session for learning: its distance (m) and moving time (s). */
export interface SpeedSample {
  distanceM: number;
  durationS: number;
}
export const LEARN_MIN_SESSIONS = 3;
export const LEARN_LAST = 12;

/**
 * Easy and hard proposed from your own sessions of the sport: easy = the median average speed, hard = the fastest
 * quarter's average, at least 15% over easy. Undefined with fewer than 3 usable sessions (5 min and 500 m or more,
 * under the sport's speed cap).
 */
export function learnSpeedZones(sessions: readonly SpeedSample[], sport: string): { easy: number; hard: number } | undefined {
  const cap = sportInfo(sport)?.capKmh ?? PACE_CAPS[sport] ?? SPEED_MAX_KMH;
  const v = sessions
    .filter((s) => s.durationS >= 300 && s.distanceM >= 500)
    .slice(0, LEARN_LAST)
    .map((s) => (s.distanceM / s.durationS) * 3.6)
    .filter((k) => k > 0 && k <= cap)
    .sort((a, b) => a - b);
  if (v.length < LEARN_MIN_SESSIONS) return undefined;
  const mid = v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2;
  const top = v.slice(Math.floor(v.length * 0.75));
  const fast = top.reduce((a, b) => a + b, 0) / top.length;
  return normalizeEasyHard(mid, Math.max(fast, mid * 1.15));
}

/** Newest wins: the incoming value when it is at least as new as the stored one. */
export function newerPref<T extends { at: string }>(stored: T | undefined | null, incoming: T | undefined | null): T | undefined {
  if (!incoming) return stored ?? undefined;
  if (!stored) return incoming;
  return Date.parse(incoming.at) >= Date.parse(stored.at) ? incoming : stored;
}

/** Every GPS sport's default thresholds (the editor's list). */
export function speedZonesTable(): Record<
  string,
  { easy: number; hard: number; thresholds: SpeedThresholds; pace: boolean; kind: PaceKind }
> {
  return Object.fromEntries(
    WEB_SPORTS.filter((s) => hasSpeedZones(s.key)).map((s) => {
      const d = defaultSpeedSetting(s.key)!;
      return [s.key, { ...d, thresholds: speedThresholdsFrom(d.easy, d.hard), pace: speedShownAsPace(s.key), kind: paceKind(s.key) }];
    }),
  );
}

/** The editor's sport order: walk, run, hike, ride first, then every other GPS sport in catalog order. */
export function speedZoneSports(): string[] {
  const first = ["walk", "run", "hike", "ride"];
  return [...first, ...WEB_SPORTS.filter((s) => hasSpeedZones(s.key) && !first.includes(s.key)).map((s) => s.key)];
}

// ── Voice during workouts ──────────────────────────────────────────────────────────────────────────────────

/** The workout voice switch (ADR-0044): on, essential (quiet chattiness for the session), off (no voice). */
export type WorkoutVoiceMode = "on" | "essential" | "off";
export interface WorkoutVoicePref {
  mode: WorkoutVoiceMode;
  /** ISO time of the change. */
  at: string;
}
export const WORKOUT_VOICE_MODES: readonly WorkoutVoiceMode[] = ["on", "essential", "off"];

/** The one-tap button: speaking (on or essential) → off; off → back to on. */
export const toggleWorkoutVoice = (m: WorkoutVoiceMode): WorkoutVoiceMode => (m === "off" ? "on" : "off");

/** The chattiness a session speaks at: off → none (null), essential → quiet, on → yours. */
export function workoutChattiness<C extends string>(mode: WorkoutVoiceMode, mine: C): C | "quiet" | null {
  return mode === "off" ? null : mode === "essential" ? "quiet" : mine;
}

// ── Web display (pace or speed in the app's units) ──────────────────────────────────────────────────────────

const KM_PER_MI = MILE_M / 1000;

/** km/h → seconds per km (or per mile in imperial). */
export const kmhToPaceS = (kmh: number, units: Units) => (units === "imperial" ? (3600 / kmh) * KM_PER_MI : 3600 / kmh);
/** km/h → the speed shown (km/h or mph). */
export const kmhToShown = (kmh: number, units: Units) => (units === "imperial" ? kmh / KM_PER_MI : kmh);

/** "6:40" (pace per km or mile) or "18.0" (km/h or mph), the value the editor shows for a speed. */
export function speedValue(kmh: number, pace: boolean, units: Units, lang: string): string {
  if (!(kmh > 0)) return "–";
  if (pace) {
    const s = Math.round(kmhToPaceS(kmh, units));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kmhToShown(kmh, units));
}

/** The unit next to a value: "/km", "/mi", "km/h", "mph". */
export const speedUnit = (pace: boolean, units: Units) =>
  pace ? (units === "imperial" ? "/mi" : "/km") : units === "imperial" ? "mph" : "km/h";

/**
 * What the visitor typed back to km/h: a pace "6:40" or "6" (minutes) per km or mile, or a speed "18.5" / "18,5" in
 * km/h or mph. Null when it isn't a usable number (0.5–150 km/h).
 */
export function parseSpeedInput(text: string, pace: boolean, units: Units): number | null {
  const s = text.trim().replace(",", ".");
  if (!s) return null;
  let kmh: number;
  if (pace) {
    // "6:40" or whole minutes "7" ("6.5" is ambiguous for a pace: refused).
    const m = /^(\d{1,3})(?::(\d{2}))?$/.exec(s);
    if (!m) return null;
    if (m[2] !== undefined && Number(m[2]) >= 60) return null;
    const sec = Number(m[1]) * 60 + (m[2] !== undefined ? Number(m[2]) : 0);
    if (!(sec > 0)) return null;
    const perKm = units === "imperial" ? sec / KM_PER_MI : sec;
    kmh = 3600 / perKm;
  } else {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
    const v = Number(s);
    kmh = units === "imperial" ? v * KM_PER_MI : v;
  }
  if (!Number.isFinite(kmh) || kmh < SPEED_MIN_KMH || kmh > SPEED_MAX_KMH) return null;
  return Math.round(kmh * 100) / 100;
}

/** The five zones as ranges (km/h): zone n from t[n-1] up to t[n] (zone 5 open-ended). */
export function zoneRanges(t: SpeedThresholds): { zone: Zone; from: number; to: number | null }[] {
  return t.map((from, i) => ({ zone: (i + 1) as Zone, from, to: i < 4 ? t[i + 1]! : null }));
}

// ── Per-sport units (sport zones: pace per km/mi, speed, /100 m, /500 m) ────────────────────────────────────────

/** The value shown for a speed in its kind, without the unit: "6:40", "2:30", "18.0"; "–" when there is none. */
export function kindValue(kmh: number, kind: PaceKind, units: Units, lang: string): string {
  if (!(kmh > 0) || kind === "none") return "–";
  const sec = paceSeconds(kmh, kind, units);
  if (sec !== undefined) {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(kmhToShown(kmh, units));
}

/** Seconds per step of a pace kind's stepper (5 s per km, mile, 100 m or 500 m), or the speed step (0.5 km/h or mph). */
export const PACE_STEP_S = 5;
export const SPEED_STEP = 0.5;

/**
 * One stepper click on a speed (km/h), in the sport's unit: `dir` +1 = faster (5 s less per km / 100 m / 500 m, or
 * 0.5 km/h or mph more), −1 = slower. The value snaps to the step first, so the shown value always moves by one step.
 * Kept within 0.5–150 km/h.
 */
export function stepKmh(kmh: number, kind: PaceKind, units: Units, dir: 1 | -1): number {
  let out: number | undefined;
  const sec = paceSeconds(kmh, kind, units);
  if (sec !== undefined) {
    const snapped = Math.round(sec / PACE_STEP_S) * PACE_STEP_S;
    const next = Math.max(PACE_STEP_S, snapped - dir * PACE_STEP_S);
    out = kmhOfPaceSeconds(next, kind, units);
  } else if (kind === "speed") {
    const shown = kmhToShown(kmh, units);
    const next = Math.max(SPEED_STEP, Math.round(shown / SPEED_STEP) * SPEED_STEP + dir * SPEED_STEP);
    out = units === "imperial" ? next * KM_PER_MI : next;
  }
  if (out === undefined || !Number.isFinite(out)) return kmh;
  return Math.round(Math.min(SPEED_MAX_KMH, Math.max(SPEED_MIN_KMH, out)) * 100) / 100;
}

/** What the visitor typed back to km/h in a sport's unit ("2:30" per 100 m, "18.5" km/h…); null when unusable. */
export function parseKindInput(text: string, kind: PaceKind, units: Units): number | null {
  if (kind === "none") return null;
  if (kind === "pace" || kind === "speed") return parseSpeedInput(text, kind === "pace", units);
  const m = /^(\d{1,3})(?::(\d{2}))?$/.exec(text.trim());
  if (!m || (m[2] !== undefined && Number(m[2]) >= 60)) return null;
  const sec = Number(m[1]) * 60 + (m[2] !== undefined ? Number(m[2]) : 0);
  const kmh = kmhOfPaceSeconds(sec, kind, units);
  if (kmh === undefined || !Number.isFinite(kmh) || kmh < SPEED_MIN_KMH || kmh > SPEED_MAX_KMH) return null;
  return Math.round(kmh * 100) / 100;
}

/** Every catalog sport in the Sports & zones list: the speed-zone order first, then the rest in catalog order. */
export function zoneSports(): string[] {
  const first = speedZoneSports();
  return [...first, ...WEB_SPORTS.map((s) => s.key).filter((k) => !first.includes(k))];
}
