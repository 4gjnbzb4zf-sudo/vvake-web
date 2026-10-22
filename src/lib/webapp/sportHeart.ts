/**
 * Ported from VVFit packages/game-core/src/sportHeart.ts (ADR-0048, sport zones 2026-10-21): keep the numbers
 * identical. Checked against the monorepo's parity data (fixtures/sport-heart-fixtures.json, a byte-for-byte copy of
 * apps/watch-ios/VVakeWatchTests/sport-heart-fixtures.json) in sportHeart.test.ts.
 *
 * Heart-rate zones per sport. The intensity percentages stay the same for every sport, but the top of the scale does
 * not: each sport family moves the max (running 0, cycling −6, swimming −12, arms only −15 bpm; strength and mind & body
 * 0, where heart rate is only a rough guide). A max you set for that sport replaces the offset; your own five
 * thresholds replace the automatic ones. `rpe`: effort by feel instead of heart-rate targets.
 *
 * Kept on the account as user.prefs.heartZones (newest `at` wins, like the speed zones). Points and prizes are
 * unchanged: the server keeps any zones a device claims within its plausibility bounds.
 */
import { heartProfileOf, maxHrOf, validZones, zoneThresholds, type HeartProfile, type SharedHealth, type Zone } from "./heart";
import { WEB_SPORTS } from "./workout";

export type ZoneThresholds = [number, number, number, number, number];

export type HrFamily = "run" | "cycle" | "water" | "arms" | "strength" | "mind";

/** Max heart rate offset per family, bpm. */
export const HR_FAMILY_OFFSET: Readonly<Record<HrFamily, number>> = { run: 0, cycle: -6, water: -12, arms: -15, strength: 0, mind: 0 };

/** Sports with their own family; the others follow their category. */
const FAMILY_BY_SPORT: Readonly<Record<string, HrFamily>> = {
  ride: "cycle",
  elliptical: "cycle",
  skate: "cycle",
  "cross-country-ski": "run",
  "downhill-ski": "cycle",
  snowboard: "cycle",
  "snow-sports": "run",
  "hand-cycling": "arms",
  "wheelchair-walk": "arms",
  "wheelchair-run": "arms",
  paddle: "arms",
  rowing: "run",
  swim: "water",
  "open-water": "water",
  "water-polo": "water",
  "water-fitness": "water",
  surf: "water",
  "water-sports": "water",
  sailing: "arms",
  hiit: "run",
  "cross-training": "run",
  boxing: "run",
  kickboxing: "run",
  "martial-arts": "run",
  wrestling: "run",
  climbing: "strength",
  "swim-bike-run": "run",
};

const FAMILY_BY_CATEGORY: Readonly<Record<string, HrFamily>> = {
  endurance: "run",
  gym: "run",
  strength: "strength",
  mind: "mind",
  dance: "run",
  combat: "run",
  racket: "run",
  team: "run",
  water: "water",
  snow: "cycle",
  outdoor: "run",
  other: "run",
};

/** The family of a sport (unknown sports: running's). */
export function hrFamily(sport: string): HrFamily {
  const e = WEB_SPORTS.find((s) => s.key === sport);
  if (!e) return "run";
  return FAMILY_BY_SPORT[e.key] ?? FAMILY_BY_CATEGORY[e.category] ?? "run";
}

/** Heart rate is a poor effort measure in this sport (strength, mind & body): suggest effort by feel too. */
export const hrIsRoughGuide = (sport: string): boolean => {
  const f = hrFamily(sport);
  return f === "strength" || f === "mind";
};

/** One sport's heart settings: your own five thresholds, or your max in it (bpm). */
export interface SportHeartSetting {
  zones?: ZoneThresholds;
  maxHr?: number;
}

/** user.prefs.heartZones: every sport you set, effort by feel, and when (newest wins across devices). */
export interface HeartZonesPrefs {
  at: string;
  /** Effort by feel instead of heart-rate targets. */
  rpe?: boolean;
  sports: Record<string, SportHeartSetting>;
}

export const SPORT_MAX_MIN = 100;
export const SPORT_MAX_MAX = 230;
export const SPORT_MAX_OVER_REST = 20;
export const HEART_SPORTS_MAX = 60;

/** A sport's setting checked: valid thresholds and a plausible max kept, the rest dropped; undefined when empty. */
export function cleanHeartSetting(s: unknown): SportHeartSetting | undefined {
  const x = s as Partial<SportHeartSetting> | null | undefined;
  if (!x || typeof x !== "object") return undefined;
  const out: SportHeartSetting = {};
  if (validZones(x.zones)) out.zones = x.zones.map((v) => Math.round(v)) as ZoneThresholds;
  if (typeof x.maxHr === "number" && Number.isFinite(x.maxHr) && x.maxHr >= SPORT_MAX_MIN && x.maxHr <= SPORT_MAX_MAX)
    out.maxHr = Math.round(x.maxHr);
  return out.zones || out.maxHr ? out : undefined;
}

/** Heart zones as received (account, storage): each sport checked (bad ones dropped), else undefined. */
export function cleanHeartZones(x: unknown): HeartZonesPrefs | undefined {
  const v = x as Partial<HeartZonesPrefs> | null | undefined;
  if (!v || typeof v.at !== "string" || !Number.isFinite(Date.parse(v.at)) || !v.sports || typeof v.sports !== "object") return undefined;
  const sports: Record<string, SportHeartSetting> = {};
  for (const [k, s] of Object.entries(v.sports).slice(0, HEART_SPORTS_MAX)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    const c = cleanHeartSetting(s);
    if (c) sports[k] = c;
  }
  return { at: v.at, ...(v.rpe ? { rpe: true } : {}), sports };
}

const baseOf = (p: HeartProfile): HeartProfile => ({
  age: p.age,
  restingHr: p.restingHr,
  ...(p.maxHr ? { maxHr: p.maxHr } : {}),
  ...(p.female ? { female: true } : {}),
});

/**
 * The max heart rate for a sport: your own max in it when set, else your max (measured, else from your age) plus the
 * family offset; always at least 20 bpm above resting.
 */
export function sportMaxHr(p: HeartProfile, sport: string, prefs?: HeartZonesPrefs | null): number {
  const own = cleanHeartSetting(prefs?.sports?.[sport])?.maxHr;
  const base = own ?? maxHrOf(p) + HR_FAMILY_OFFSET[hrFamily(sport)];
  return Math.max(base, p.restingHr + SPORT_MAX_OVER_REST);
}

/** The automatic thresholds for a sport (Karvonen on resting and the sport's max): what "reset" brings back. */
export function sportAutoZones(p: HeartProfile, sport: string, prefs?: HeartZonesPrefs | null): ZoneThresholds {
  return zoneThresholds({ age: p.age, restingHr: p.restingHr, maxHr: sportMaxHr(p, sport, prefs) }) as ZoneThresholds;
}

/** The thresholds a session of this sport uses: your own five, else the sport's automatic ones. */
export function sportThresholds(p: HeartProfile, sport: string, prefs?: HeartZonesPrefs | null): ZoneThresholds {
  return cleanHeartSetting(prefs?.sports?.[sport])?.zones ?? sportAutoZones(p, sport, prefs);
}

/** Your own thresholds are set for this sport (not automatic). */
export const hasOwnZones = (sport: string, prefs?: HeartZonesPrefs | null): boolean => !!cleanHeartSetting(prefs?.sports?.[sport])?.zones;

/**
 * The profile a session of this sport scores and coaches with: your base numbers, the sport's max, its thresholds.
 * The session's hrProfile claim carries its `zones`, never the sport's max.
 */
export function sportProfile(
  p: HeartProfile,
  sport: string,
  prefs?: HeartZonesPrefs | null,
): HeartProfile & { maxHr: number; zones: ZoneThresholds } {
  return {
    age: p.age,
    restingHr: p.restingHr,
    ...(p.female ? { female: true } : {}),
    maxHr: sportMaxHr(p, sport, prefs),
    zones: sportThresholds(p, sport, prefs),
  };
}

/**
 * What a session of this sport uses on the web: your base max (never the sport's) and the sport's thresholds, so the
 * live zone, the time in zones and the uploaded hrProfile all agree.
 */
export function sessionHeart(p: HeartProfile, sport: string, prefs?: HeartZonesPrefs | null): HeartProfile {
  return { ...baseOf(p), zones: sportThresholds(p, sport, prefs) };
}

/** Set (or clear with null) one sport's own thresholds or max; `at` stamped now. Empty sports are removed. */
export function withSportHeart(
  prefs: HeartZonesPrefs | undefined | null,
  sport: string,
  patch: { zones?: ZoneThresholds | null; maxHr?: number | null },
  now = new Date(),
): HeartZonesPrefs {
  const sports = { ...(prefs?.sports ?? {}) };
  const cur: SportHeartSetting = { ...(sports[sport] ?? {}) };
  if (patch.zones === null) delete cur.zones;
  else if (patch.zones) cur.zones = patch.zones;
  if (patch.maxHr === null) delete cur.maxHr;
  else if (patch.maxHr !== undefined) cur.maxHr = patch.maxHr;
  const c = cleanHeartSetting(cur);
  if (c) sports[sport] = c;
  else delete sports[sport];
  return { at: now.toISOString(), ...(prefs?.rpe ? { rpe: true } : {}), sports };
}

/** Effort by feel on or off; `at` stamped now. */
export function withRpe(prefs: HeartZonesPrefs | undefined | null, on: boolean, now = new Date()): HeartZonesPrefs {
  return { at: now.toISOString(), ...(on ? { rpe: true } : {}), sports: { ...(prefs?.sports ?? {}) } };
}

/** The older per-sport zones shared from Health (GET /v1/athlete health.zones) as heart-zone prefs (at = 0). */
export function heartZonesFromHealth(zones: Record<string, readonly number[]> | null | undefined): HeartZonesPrefs | undefined {
  if (!zones) return undefined;
  const sports: Record<string, SportHeartSetting> = {};
  for (const [k, z] of Object.entries(zones)) if (validZones(z)) sports[k] = { zones: z.map((v) => Math.round(v)) as ZoneThresholds };
  return Object.keys(sports).length ? { at: new Date(0).toISOString(), sports } : undefined;
}

/**
 * The account's heart zones, with the older Health zones filling the sports it doesn't set (they were the only per-sport
 * zones before; a sport set on the account always wins).
 */
export function effectiveHeartZones(
  prefs: HeartZonesPrefs | null | undefined,
  healthZones: Record<string, readonly number[]> | null | undefined,
): HeartZonesPrefs | null {
  const legacy = heartZonesFromHealth(healthZones);
  if (!legacy) return prefs ?? null;
  if (!prefs) return legacy;
  return { ...prefs, sports: { ...legacy.sports, ...prefs.sports } };
}

/** A session's heart on the web for a sport: what you shared (else the stand-in), with the sport's thresholds. */
export function heartForSport(
  health: SharedHealth | null | undefined,
  sport: string,
  prefs: HeartZonesPrefs | null | undefined,
): HeartProfile {
  return sessionHeart(heartProfileOf(health), sport, effectiveHeartZones(prefs, health?.zones));
}

// ── Percent editing ─────────────────────────────────────────────────────────────────────────────────────────

/** A threshold as % of the sport's max (whole percent), for the "%" view of the editor. */
export const pctOfMax = (bpm: number, max: number): number => Math.round((bpm / max) * 100);
/** A % of the sport's max back to whole beats. */
export const bpmOfPct = (pct: number, max: number): number => Math.round((pct / 100) * max);

/** Five thresholds from five percentages of a max: each whole, kept 3 bpm above the one before; undefined when invalid. */
export function thresholdsFromPct(pcts: readonly number[], max: number): ZoneThresholds | undefined {
  if (pcts.length !== 5) return undefined;
  const t = pcts.map((x) => bpmOfPct(x, max));
  for (let i = 1; i < 5; i++) t[i] = Math.max(t[i]!, t[i - 1]! + 3);
  return validZones(t) ? (t as ZoneThresholds) : undefined;
}

// ── Effort by feel (RPE, talk test) ────────────────────────────────────────────────────────────────────────

export const RPE_ZONES: Readonly<
  Record<Exclude<Zone, 0>, { rpe: [number, number]; en: string; fr: string; talkEn: string; talkFr: string }>
> = {
  1: { rpe: [2, 3], en: "Very easy", fr: "Très facile", talkEn: "You could sing", talkFr: "Tu pourrais chanter" },
  2: { rpe: [3, 4], en: "Easy", fr: "Facile", talkEn: "You can chat in full sentences", talkFr: "Tu parles en phrases complètes" },
  3: { rpe: [5, 6], en: "Steady", fr: "Soutenu", talkEn: "Short sentences only", talkFr: "Phrases courtes seulement" },
  4: { rpe: [7, 8], en: "Hard", fr: "Difficile", talkEn: "A few words at a time", talkFr: "Quelques mots à la fois" },
  5: { rpe: [9, 10], en: "Very hard", fr: "Très difficile", talkEn: "No talking", talkFr: "Impossible de parler" },
};

/** "Easy · RPE 3–4" (or the French). */
export function rpeLabel(zone: number, lang: "en" | "fr" = "en"): string {
  const z = Math.min(5, Math.max(1, Math.round(zone))) as Exclude<Zone, 0>;
  const r = RPE_ZONES[z];
  return `${lang === "fr" ? r.fr : r.en} · RPE ${r.rpe[0]}–${r.rpe[1]}`;
}

/** The talk-test line of a zone ("You can chat in full sentences"). */
export function rpeTalk(zone: number, lang: "en" | "fr" = "en"): string {
  const z = Math.min(5, Math.max(1, Math.round(zone))) as Exclude<Zone, 0>;
  return lang === "fr" ? RPE_ZONES[z].talkFr : RPE_ZONES[z].talkEn;
}

// ── Learning from your workouts ────────────────────────────────────────────────────────────────────────────

export interface HeartSample {
  sport: string;
  maxBpm?: number;
  activeS?: number;
}

export const HEART_LEARN_LAST = 20;
export const HEART_LEARN_MIN = 3;
export const HEART_LEARN_STEP = 3;

/**
 * A max for a sport proposed from your own sessions of it: the second-highest session peak among the last 20 of 10
 * minutes or more, plausible (≤ 220 − age + 15 and ≤ 230). Only ever up: proposed when at least 3 bpm above the sport's
 * current max. Applied only when you approve it.
 */
export function learnSportMaxHr(
  sessions: readonly HeartSample[],
  sport: string,
  p: HeartProfile,
  prefs?: HeartZonesPrefs | null,
): number | undefined {
  const peaks = sessions
    .filter((s) => s.sport === sport && typeof s.maxBpm === "number" && Number.isFinite(s.maxBpm) && (s.activeS ?? 600) >= 600)
    .slice(0, HEART_LEARN_LAST)
    .map((s) => s.maxBpm!)
    .filter((b) => b >= SPORT_MAX_MIN && b <= Math.min(SPORT_MAX_MAX, 220 - p.age + 15))
    .sort((a, b) => b - a);
  if (peaks.length < HEART_LEARN_MIN) return undefined;
  const second = Math.round(peaks[1]!);
  return second >= sportMaxHr(p, sport, prefs) + HEART_LEARN_STEP ? second : undefined;
}

/** Every catalog sport's family and offset. */
export function hrFamilyTable(): Record<string, { family: HrFamily; offset: number }> {
  return Object.fromEntries(WEB_SPORTS.map((s) => [s.key, { family: hrFamily(s.key), offset: HR_FAMILY_OFFSET[hrFamily(s.key)] }]));
}
