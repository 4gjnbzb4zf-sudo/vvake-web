/**
 * Moment share pages (/<lang>/m/<kind>/, optionally #<CODE>): what the app links to when it shares a brag card, a
 * ghost-race win, a trophy, your VVaker or your week. Each kind is a static 200 page with its own preview image
 * (public/og/<lang>-m-<kind>.png, scripts/generate-og.tsx), so a post on X shows a real card instead of a bare link.
 * The page never shows anything personal: no name, no numbers; the invite code in the hash is read in the browser.
 */
import type { Locale } from "@/i18n/config";

export const MOMENT_KINDS = ["move", "ghost", "trophy", "vvaker", "week"] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

export const isMomentKind = (k: string): k is MomentKind => (MOMENT_KINDS as readonly string[]).includes(k);

/** The cast duo on each kind's preview image (public/personas/<id>.webp): each card looks different. */
export const MOMENT_CAST: Readonly<Record<MomentKind, readonly [string, string]>> = {
  move: ["runner-f", "cyclist"],
  ghost: ["climber", "walker-f"],
  trophy: ["boxer-f", "lifter"],
  vvaker: ["skater-f", "racket"],
  week: ["hiker-f", "swimmer"],
};

/** The preview image's path for a kind (served next to the page). */
export const momentOgPath = (locale: Locale, kind: MomentKind) => `/og/${locale}-m-${kind}.png`;

/** https://vvake.com/<lang>/m/<kind>/ (+ #<CODE> when the sharer has an invite code). */
export function momentUrl(origin: string, locale: Locale, kind: MomentKind, code?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}/${locale}/m/${kind}/`;
  return code ? `${base}#${encodeURIComponent(code.toUpperCase())}` : base;
}

/** Shared custom trainings (/<lang>/t/) and creator pages (/<lang>/coach/): one preview card per language, nothing personal. */
export const TRAINING_CAST: readonly [string, string] = ["lifter-f", "boxer"];
export const trainingOgPath = (locale: Locale) => `/og/${locale}-t.png`;
