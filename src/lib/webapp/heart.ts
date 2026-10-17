/**
 * Heart rate in the browser: the Bluetooth Heart Rate Measurement packet (GATT 0x2A37 of the standard Heart Rate
 * Service 0x180D, any chest strap or arm band that follows the spec) and the zones, by the same rule as the apps
 * (VVFit packages/game-core hr.ts): Karvonen on heart-rate reserve, Tanaka max (Gulati for women), or your own five
 * thresholds per sport when you set them (Health › Your zones, kept on the account: GET /v1/athlete health.zones).
 * Pure: tested in heart.test.ts.
 */

export interface HeartPacket {
  bpm: number;
  /** Whether the strap says it touches skin; null when it can't tell. */
  contact: boolean | null;
  /** Energy expended (kJ, cumulative) when the strap sends it. */
  energyKj?: number;
  /** RR intervals in milliseconds (beat to beat). */
  rr: number[];
}

/**
 * Parses a Heart Rate Measurement value. Flags (byte 0): bit 0 = bpm is uint16, bits 1–2 = sensor contact
 * (bit 2 supported, bit 1 detected), bit 3 = energy expended present (uint16), bit 4 = RR intervals present (uint16
 * each, 1/1024 s). Little-endian. Null when the packet is too short to hold a heart rate.
 */
export function parseHeartRate(view: DataView): HeartPacket | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  let i = 1;
  let bpm: number;
  if (flags & 0x01) {
    if (view.byteLength < 3) return null;
    bpm = view.getUint16(i, true);
    i += 2;
  } else {
    bpm = view.getUint8(i);
    i += 1;
  }
  const contactSupported = (flags & 0x04) !== 0;
  const contact = contactSupported ? (flags & 0x02) !== 0 : null;
  let energyKj: number | undefined;
  if (flags & 0x08) {
    if (view.byteLength >= i + 2) energyKj = view.getUint16(i, true);
    i += 2;
  }
  const rr: number[] = [];
  if (flags & 0x10) {
    for (; i + 1 < view.byteLength; i += 2) rr.push(Math.round((view.getUint16(i, true) / 1024) * 1000));
  }
  return { bpm, contact, ...(energyKj !== undefined ? { energyKj } : {}), rr };
}

/** A heart rate a person can have, from a strap that touches skin (0 or no contact: not a reading). */
export const usableBpm = (p: HeartPacket | null): p is HeartPacket => !!p && p.contact !== false && p.bpm >= 30 && p.bpm <= 230;

// ── Zones (game-core hr.ts, the same numbers) ────────────────────────────────────────────────────────────────

export interface HeartProfile {
  age: number;
  restingHr: number;
  maxHr?: number;
  female?: boolean;
  /** Your own zones for this sport: where zones 1…5 start, in bpm. */
  zones?: number[];
}

export type Zone = 0 | 1 | 2 | 3 | 4 | 5;

/** The apps' stand-in before you share your age and resting heart rate (apps/mobile lib/heartProfile.ts DEMO_HEART). */
export const DEFAULT_HEART: HeartProfile = { age: 32, restingHr: 58 };

export const maxHrOf = (p: HeartProfile) => p.maxHr ?? (p.female ? 206 - 0.88 * p.age : 208 - 0.7 * p.age);

/** Five finite thresholds, 40–230 bpm, each at least 3 bpm above the one before. */
export function validZones(z: unknown): z is [number, number, number, number, number] {
  if (!Array.isArray(z) || z.length !== 5) return false;
  for (let i = 0; i < 5; i++) {
    const x = z[i];
    if (typeof x !== "number" || !Number.isFinite(x) || x < 40 || x > 230) return false;
    if (i > 0 && x - (z[i - 1] as number) < 3) return false;
  }
  return true;
}

/** Where zones 1…5 start for this heart (your own thresholds, else Karvonen at 50/60/70/80/90 % of reserve). */
export function zoneThresholds(p: HeartProfile): number[] {
  if (validZones(p.zones)) return [...p.zones];
  const reserve = maxHrOf(p) - p.restingHr;
  return [0.5, 0.6, 0.7, 0.8, 0.9].map((f) => Math.ceil(p.restingHr + f * reserve - 1e-9));
}

export function zoneOf(bpm: number, p: HeartProfile): Zone {
  if (validZones(p.zones)) {
    let z = 0;
    while (z < 5 && bpm >= p.zones[z]!) z++;
    return z as Zone;
  }
  const f = (bpm - p.restingHr) / (maxHrOf(p) - p.restingHr);
  if (f < 0.5) return 0;
  if (f < 0.6) return 1;
  if (f < 0.7) return 2;
  if (f < 0.8) return 3;
  if (f < 0.9) return 4;
  return 5;
}

/** What the account's athlete health holds (GET /v1/athlete): only the fields shared. */
export interface SharedHealth {
  age?: number | null;
  sex?: string | null;
  restingHr?: number | null;
  maxHr?: number | null;
  zones?: Record<string, number[]> | null;
}

/** Your heart for zones in a sport: what you shared on the account, the apps' stand-in for the rest. */
export function heartProfileOf(h: SharedHealth | null | undefined, sport?: string): HeartProfile {
  const age = h?.age && h.age >= 13 && h.age <= 100 ? h.age : DEFAULT_HEART.age;
  const restingHr = h?.restingHr && h.restingHr >= 30 && h.restingHr <= 120 ? h.restingHr : DEFAULT_HEART.restingHr;
  const zones = sport ? h?.zones?.[sport] : undefined;
  const maxHr = h?.maxHr && h.maxHr > restingHr && h.maxHr <= 230 ? h.maxHr : undefined;
  return {
    age,
    restingHr,
    ...(maxHr ? { maxHr } : {}),
    ...(h?.sex === "female" ? { female: true } : {}),
    ...(validZones(zones) ? { zones } : {}),
  };
}

/** Seconds in each zone (index 0 = zone 1 … 4 = zone 5) from 10-s samples; gaps over 30 s count nothing. */
export function zoneSeconds(samples: readonly { t: number; bpm?: number }[], p: HeartProfile): [number, number, number, number, number] {
  const out: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const hr = samples.filter((s) => s.bpm !== undefined);
  for (let i = 0; i + 1 < hr.length; i++) {
    const dt = hr[i + 1]!.t - hr[i]!.t;
    if (dt <= 0 || dt > 30) continue;
    const z = zoneOf(hr[i]!.bpm!, p);
    if (z > 0) out[z - 1] += dt;
  }
  return out;
}

/** Credit per minute in each zone (game-core ZONE_WEIGHTS: zone 5 never pays more than zone 4). */
const ZONE_WEIGHTS = [0, 1, 2, 3, 4, 4];

/** The effort the apps compute from heart rate (game-core sessionEffort), within the energy budget in minutes. */
export function heartEffort(
  samples: readonly { t: number; bpm?: number }[],
  p: HeartProfile,
  budgetMin = Infinity,
): { effort: number; activeMin: number } {
  const hr = samples.filter((s) => s.bpm !== undefined && s.bpm >= 30 && s.bpm <= 230);
  let effort = 0;
  let activeMin = 0;
  for (let i = 0; i + 1 < hr.length && activeMin < budgetMin; i++) {
    const dt = hr[i + 1]!.t - hr[i]!.t;
    if (dt <= 0 || dt > 30) continue;
    const z = zoneOf(hr[i]!.bpm!, p);
    if (z === 0) continue;
    const m = Math.min(dt / 60, budgetMin - activeMin);
    activeMin += m;
    effort += m * ZONE_WEIGHTS[z]!;
  }
  return { effort: Math.round(effort * 10) / 10, activeMin };
}

/** Bluetooth GATT identifiers of the standard services this page reads. */
export const HEART_RATE_SERVICE = 0x180d;
export const HEART_RATE_MEASUREMENT = 0x2a37;
export const BATTERY_SERVICE = 0x180f;
export const BATTERY_LEVEL = 0x2a19;
