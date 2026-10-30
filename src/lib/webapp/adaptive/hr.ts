// Copied from VVFit packages/game-core/src/hr.ts (81b7babd 2026-10-09) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
/**
 * Heart-rate zones, one rule everywhere (the phone, the API's own score, the watch's Zones.swift):
 * - **Max heart rate:** a measured max when you have one, else Gulati (206 − 0.88 × age) for women, else Tanaka
 *   (208 − 0.7 × age). Both are population formulas with a spread of about ±10 bpm: a guide, never a diagnosis.
 * - **Zones:** Karvonen on heart-rate reserve (resting to max): zone 1 from 50%, 2 from 60%, 3 from 70%, 4 from 80%,
 *   5 from 90%; or your own five thresholds in beats (custom zones, per sport), when you set them.
 */
export interface Profile {
  age: number;
  restingHr: number;
  /** Measured max HR if known; otherwise age-predicted. */
  maxHr?: number;
  /** Shared sex at birth is female: Gulati's max-HR formula instead of Tanaka's. */
  female?: boolean;
  /** Your own zones for this sport: the beats where zones 1…5 start (validZoneThresholds). */
  zones?: ZoneThresholds;
}

export type Zone = 0 | 1 | 2 | 3 | 4 | 5;

/** Where zones 1, 2, 3, 4 and 5 start, in bpm (strictly increasing). */
export type ZoneThresholds = [number, number, number, number, number];

/**
 * Credit per minute in each zone.
 * Z5 is deliberately weighted the same as Z4, so the game never rewards pushing to the limit.
 */
export const ZONE_WEIGHTS: Readonly<Record<Zone, number>> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };

/** Heart-rate reserve fractions where zones 1…5 start (Karvonen). */
export const ZONE_FRACTIONS: readonly number[] = [0.5, 0.6, 0.7, 0.8, 0.9];

/** Tanaka et al. (2001): HRmax ≈ 208 − 0.7 × age. */
export function predictedMaxHr(age: number): number {
  return 208 - 0.7 * age;
}

/** Gulati et al. (2010), women: HRmax ≈ 206 − 0.88 × age. */
export function predictedMaxHrFemale(age: number): number {
  return 206 - 0.88 * age;
}

/** The age-predicted max: Gulati for women, Tanaka otherwise. */
export function ageMaxHr(age: number, female = false): number {
  return female ? predictedMaxHrFemale(age) : predictedMaxHr(age);
}

/** Measured max > Gulati (women) > Tanaka. */
export function maxHr(p: Profile): number {
  return p.maxHr ?? ageMaxHr(p.age, !!p.female);
}

export function assertValidProfile(p: Profile): void {
  if (!(p.age >= 13 && p.age <= 100)) throw new RangeError(`age out of range: ${p.age}`);
  if (!(p.restingHr >= 30 && p.restingHr <= 120)) throw new RangeError(`restingHr out of range: ${p.restingHr}`);
  if (maxHr(p) <= p.restingHr) throw new RangeError("maxHr must exceed restingHr");
}

/** Karvonen: fraction of heart-rate reserve in use. */
export function hrReserveFraction(bpm: number, p: Profile): number {
  return (bpm - p.restingHr) / (maxHr(p) - p.restingHr);
}

export function zoneFor(fraction: number): Zone {
  if (fraction < 0.5) return 0;
  if (fraction < 0.6) return 1;
  if (fraction < 0.7) return 2;
  if (fraction < 0.8) return 3;
  if (fraction < 0.9) return 4;
  return 5;
}

// ── Your own zones ─────────────────────────────────────────────────────────────────────────────────────────

/** Custom thresholds: whole-ish beats between these, each at least this far above the one before. */
export const ZONE_THRESHOLD_MIN = 40;
export const ZONE_THRESHOLD_MAX = 230;
export const ZONE_THRESHOLD_GAP = 3;

/** Five finite thresholds, 40–230 bpm, each at least 3 bpm above the one before. */
export function validZoneThresholds(z: unknown): z is ZoneThresholds {
  if (!Array.isArray(z) || z.length !== 5) return false;
  for (let i = 0; i < 5; i++) {
    const x = z[i];
    if (typeof x !== "number" || !Number.isFinite(x) || x < ZONE_THRESHOLD_MIN || x > ZONE_THRESHOLD_MAX) return false;
    if (i > 0 && x - (z[i - 1] as number) < ZONE_THRESHOLD_GAP) return false;
  }
  return true;
}

/** The automatic thresholds (Karvonen on your resting and max), whole beats: what "reset to automatic" shows. */
export function autoZoneThresholds(p: Profile): ZoneThresholds {
  const rest = p.restingHr;
  const reserve = maxHr(p) - rest;
  return ZONE_FRACTIONS.map((f) => Math.ceil(rest + f * reserve - 1e-9)) as ZoneThresholds;
}

/** The zone of a heart rate: your own thresholds when the profile has valid ones, else Karvonen. */
export function zoneOfBpm(bpm: number, p: Profile): Zone {
  const z = p.zones;
  if (validZoneThresholds(z)) {
    let zone = 0;
    while (zone < 5 && bpm >= z[zone]!) zone++;
    return zone as Zone;
  }
  return zoneFor(hrReserveFraction(bpm, p));
}
