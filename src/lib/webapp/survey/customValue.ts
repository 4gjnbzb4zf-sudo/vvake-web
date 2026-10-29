/**
 * "Custom…" answers in the first-run questions (build 54, the phone's apps/mobile/src/lib/customValue.ts): a value of
 * your own inside the same bounds the survey's validation uses, and a custom event distance as an event type
 * ("15k", "21-1k", "12mi"; a copy of game-core tailor.ts eventDistanceSlug / parseEventDistance). Pure, tested.
 */

/** Minutes a session (onboarding): as the phone's survey clamps minutes a day. */
export const MINUTES_BOUNDS = { min: 10, max: 300 } as const;

export const EVENT_DISTANCE_BOUNDS = { km: { min: 1, max: 1000 }, mi: { min: 1, max: 620 } } as const;
export type DistanceUnit = keyof typeof EVENT_DISTANCE_BOUNDS;

/** n within [min, max], rounded to `step`. Pure. */
export function clampStep(n: number, min: number, max: number, step = 1): number {
  if (!Number.isFinite(n)) return min;
  const r = Math.round(n / step) * step;
  return Math.round(Math.min(max, Math.max(min, r)) * 1000) / 1000;
}

export function eventDistanceSlug(value: number, unit: DistanceUnit): string | undefined {
  if (!Number.isFinite(value)) return undefined;
  const b = EVENT_DISTANCE_BOUNDS[unit];
  const v = Math.round(Math.min(b.max, Math.max(b.min, value)) * 10) / 10;
  const [whole, dec] = v.toFixed(1).split(".") as [string, string];
  return `${whole}${dec === "0" ? "" : `-${dec}`}${unit === "km" ? "k" : "mi"}`;
}

export function parseEventDistance(type: string | null | undefined): { value: number; unit: DistanceUnit } | null {
  const m = typeof type === "string" ? /^(\d{1,4})(?:-(\d))?(k|mi)$/.exec(type) : null;
  if (!m) return null;
  const unit: DistanceUnit = m[3] === "k" ? "km" : "mi";
  const value = Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0);
  const b = EVENT_DISTANCE_BOUNDS[unit];
  return value >= b.min && value <= b.max ? { value, unit } : null;
}

/** One decimal at most, French comma in French. Pure. */
export const numText = (v: number, lang: "en" | "fr") => {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === "fr" ? s.replace(".", ",") : s;
};

/** "21.1 km" / "21,1 km", "12 mi" for a custom distance, else null. Pure. */
export function eventDistanceText(type: string | null | undefined, lang: "en" | "fr"): string | null {
  const d = parseEventDistance(type);
  return d ? `${numText(d.value, lang)} ${d.unit}` : null;
}
