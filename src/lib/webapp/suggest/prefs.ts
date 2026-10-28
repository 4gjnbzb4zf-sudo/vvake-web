import { SUGGEST_LEVELS, type SuggestLevel, type SuggestPrefs } from "./suggest";

/**
 * Quiet on the web (ADR-0062 §4.4): how much VVake suggests, kept in this browser per account and with the account
 * as `prefs.suggest = { level, at }` (PATCH /v1/me, read from GET /v1/me; newest `at` wins, like the workout
 * settings in workoutPrefs.ts). An API that doesn't keep it yet simply never answers with it: this browser's choice
 * still holds here. The gate itself is game-core's suggestAllowed (suggest.ts, copied unchanged).
 */

export const suggestKey = (userId: string) => `vvake-app-suggest:${userId}`;

/** A stored or received `prefs.suggest`, or null when it isn't one (an unknown level is not adopted). Pure. */
export function parseSuggestPrefs(x: unknown): SuggestPrefs | null {
  const v = x as Partial<SuggestPrefs> | null | undefined;
  if (!v || typeof v !== "object" || typeof v.at !== "string" || !Number.isFinite(Date.parse(v.at))) return null;
  if (!(SUGGEST_LEVELS as readonly string[]).includes(v.level as string)) return null;
  return { level: v.level as SuggestLevel, at: v.at };
}

/** A new choice, stamped now and always after the previous one (newest wins). Pure but for the clock. */
export function nextSuggestPrefs(prev: SuggestPrefs | null, level: SuggestLevel, now = Date.now()): SuggestPrefs {
  return { level, at: new Date(Math.max(now, prev ? Date.parse(prev.at) + 1 : 0)).toISOString() };
}
