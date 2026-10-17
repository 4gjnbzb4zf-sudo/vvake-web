import type { Locale } from "@/i18n/config";

/** Display helpers of the web app (the phone's lib/units.ts and lib/dates.ts, as much as the web needs). Pure. */

export type Units = "metric" | "imperial";
export const MILE_M = 1609.344;

/** "32:10" or "1:02:05". */
export function clock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** "5.23 km" / "3.25 mi" (two decimals under 100, one above). */
export function distance(m: number, units: Units, lang: Locale): string {
  const v = units === "imperial" ? m / MILE_M : m / 1000;
  const n = new Intl.NumberFormat(lang, { minimumFractionDigits: v < 100 ? 2 : 1, maximumFractionDigits: v < 100 ? 2 : 1 }).format(v);
  return `${n} ${units === "imperial" ? "mi" : "km"}`;
}

/** The number only ("5.23"), for big live figures. */
export const distanceNumber = (m: number, units: Units, lang: Locale) =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(units === "imperial" ? m / MILE_M : m / 1000);

export const distanceUnit = (units: Units) => (units === "imperial" ? "mi" : "km");

/** "5:12 /km" from seconds per km (converted to /mi in imperial); "–" without one. */
export function pace(sPerKm: number | null, units: Units): string {
  if (sPerKm == null || !Number.isFinite(sPerKm)) return "–";
  const s = units === "imperial" ? sPerKm * (MILE_M / 1000) : sPerKm;
  return `${clock(s)} /${distanceUnit(units)}`;
}

/** "24.3 km/h" from seconds per km. */
export function speed(sPerKm: number | null, units: Units, lang: Locale): string {
  if (sPerKm == null || !(sPerKm > 0)) return "–";
  const kmh = 3600 / sPerKm;
  const v = units === "imperial" ? kmh / 1.609344 : kmh;
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(v)} ${units === "imperial" ? "mph" : "km/h"}`;
}

export const elevation = (m: number, units: Units, lang: Locale) =>
  units === "imperial"
    ? `${new Intl.NumberFormat(lang).format(Math.round(m * 3.28084))} ft`
    : `${new Intl.NumberFormat(lang).format(Math.round(m))} m`;

/** Sports where speed reads better than pace (the phone shows km/h on a bike). */
export const SPEED_SPORTS = new Set([
  "ride",
  "hand-cycling",
  "skate",
  "downhill-ski",
  "cross-country-ski",
  "snowboard",
  "snow-sports",
  "paddle",
  "rowing",
  "sailing",
]);

export const dayLabel = (iso: string, lang: Locale) => {
  try {
    return new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

export const timeLabel = (iso: string, lang: Locale) => {
  try {
    return new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
};

/** Minutes from midnight → "07:30" in the visitor's clock. */
export function minutesLabel(min: number, lang: Locale): string {
  const d = new Date(2000, 0, 1, Math.floor(min / 60) % 24, min % 60);
  return new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Local date "YYYY-MM-DD" of a time (the visitor's zone). */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The habit day (ends at 5 am, as in the app: bed at 00:30 counts for the evening before). */
export const habitDay = (ms: number) => localDay(ms - 5 * 3600 * 1000);

export const greetingKey = (h: number) => (h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
