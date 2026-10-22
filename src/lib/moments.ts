/**
 * Moment share pages (/<lang>/m/<kind>/, optionally #<CODE>): what the app links to when it shares a brag card, a
 * ghost-race win, a trophy, your VVaker, your week, a challenge taken ("Think you can beat me?") or a city rank. Each kind is a static 200 page with its own preview image
 * (public/og/<lang>-m-<kind>.png, scripts/generate-og.tsx), so a post on X shows a real card instead of a bare link.
 * The page never shows anything personal: no name; the invite code in the hash is read in the browser. A city share may
 * add ?city=<slug>&rank=<n>, shown only for a known city and a plausible rank (never free text from the link).
 */
import type { Locale } from "@/i18n/config";
import { getCity } from "@/lib/cities";

export const MOMENT_KINDS = ["move", "ghost", "trophy", "vvaker", "week", "challenge", "city"] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

export const isMomentKind = (k: string): k is MomentKind => (MOMENT_KINDS as readonly string[]).includes(k);

/** The cast duo on each kind's preview image (public/personas/<id>.webp): each card looks different. */
export const MOMENT_CAST: Readonly<Record<MomentKind, readonly [string, string]>> = {
  move: ["runner-f", "cyclist"],
  ghost: ["climber", "walker-f"],
  trophy: ["boxer-f", "lifter"],
  vvaker: ["skater-f", "racket"],
  week: ["hiker-f", "swimmer"],
  challenge: ["boxer-f", "runner-m"],
  city: ["footballer-f", "roller"],
};

/** The preview image's path for a kind (served next to the page). */
export const momentOgPath = (locale: Locale, kind: MomentKind) => `/og/${locale}-m-${kind}.png`;

/** https://vvake.com/<lang>/m/<kind>/ (+ #<CODE> when the sharer has an invite code). */
export function momentUrl(origin: string, locale: Locale, kind: MomentKind, code?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/${locale}/m/${kind}/`;
  return code ? `${base}#${encodeURIComponent(code.toUpperCase())}` : base;
}

/** A city rank from the link's query (?city=<slug>&rank=<n>): a known city and a rank from 1 to 999, else null. */
export function readCityRank(search: string): { city: string; rank: number } | null {
  const q = new URLSearchParams(search);
  const city = getCity((q.get("city") ?? "").trim().toLowerCase());
  const raw = (q.get("rank") ?? "").trim();
  const rank = /^\d{1,3}$/.test(raw) ? Number(raw) : 0;
  return city && rank >= 1 ? { city: city.name, rank } : null;
}

/** "1st", "2nd", "3rd", "11th" / "1er", "2e". */
export function ordinal(n: number, locale: Locale): string {
  if (locale === "fr") return n === 1 ? "1er" : `${n}e`;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** Shared custom trainings (/<lang>/t/) and creator pages (/<lang>/coach/): one preview card per language, nothing personal. */
export const TRAINING_CAST: readonly [string, string] = ["lifter-f", "boxer"];
export const trainingOgPath = (locale: Locale) => `/og/${locale}-t.png`;
