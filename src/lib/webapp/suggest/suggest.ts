// Copied from VVFit packages/game-core/src/suggest.ts (4692261d 2026-10-28) by scripts/sync-suggest-core.ts. Do not edit: re-sync.
/**
 * How much VVake suggests (living app, ADR-0062 §4.4): one level per account, on every device, whether the tailored
 * app (ADR-0059) is on or not. Synced as `prefs.suggest = { level, at }` (newest `at` wins, ADR-0044's rule).
 *
 * - `guide`: next steps (1 primary + 2 secondary), first-time tips and tours, feature intros.
 * - `essentials` (default): one next step per moment, tips and tours once.
 * - `quiet`: nothing unless asked. No next steps, tips, tours, "you might like", review card, voice tip, moment prompt,
 *   upsell after a workout, coach-started topics, or suggestion pushes. Kept: celebrations (they are results), safety,
 *   reminders and calls the athlete set, challenge results, proposals the athlete asked for.
 *
 * Never during a workout, whatever the level (only safety, and what the athlete asked for, are said then).
 * Pure; mirrored in Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/suggest-golden.json.
 */

export const SUGGEST_LEVELS = ["guide", "essentials", "quiet"] as const;
export type SuggestLevel = (typeof SUGGEST_LEVELS)[number];
export const DEFAULT_SUGGEST_LEVEL: SuggestLevel = "essentials";

/** Every kind of thing the apps, the coach or the server may offer without being asked. */
export const SUGGEST_KINDS = [
  "next_step", // the primary chip after an activity
  "next_step_more", // the 1–2 secondary chips
  "tip", // a one-line first-time tip
  "tour", // a short feature tour the first time an activity is used
  "you_might_like", // a feature that is off (ADR-0059 §4.2)
  "review_card", // "Still the right VVake?"
  "voice_tip", // the better-voice tip
  "moment_prompt", // the selfie/view prompt after a session
  "upsell_after_workout", // a Plus offer under a workout's Done
  "coach_nudge", // the coach starting a topic on its own (proposals, check-ins, offers)
  "push_suggestion", // a push that suggests something (next step, coach check-in, referral, comeback)
  "celebration", // a milestone moment: a result, not a suggestion
] as const;
export type SuggestionKind = (typeof SUGGEST_KINDS)[number];

/** A level from anything stored (an unknown or missing value is the default). Pure. */
export function suggestLevelOf(v: unknown): SuggestLevel {
  return typeof v === "string" && (SUGGEST_LEVELS as readonly string[]).includes(v) ? (v as SuggestLevel) : DEFAULT_SUGGEST_LEVEL;
}

export interface SuggestPrefs {
  level: SuggestLevel;
  /** When it was chosen (ISO), for newest-wins sync. */
  at: string;
}

/** The newer of two stored prefs (either may be missing). Pure. */
export function newerSuggestPrefs(a: SuggestPrefs | null | undefined, b: SuggestPrefs | null | undefined): SuggestPrefs | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

/**
 * May this be offered now? `inWorkout`: a workout is live on this device or a linked one (then nothing is offered,
 * not even a celebration: it waits for the summary). Pure.
 */
export function suggestAllowed(kind: SuggestionKind, level: SuggestLevel, ctx: { inWorkout?: boolean } = {}): boolean {
  if (ctx.inWorkout) return false;
  if (kind === "celebration") return true;
  if (level === "quiet") return false;
  if (level === "essentials") return kind !== "next_step_more";
  return true;
}

/** How many next-step chips a moment may show (primary included). Pure. */
export function nextStepLimit(level: SuggestLevel): number {
  return level === "guide" ? 3 : level === "essentials" ? 1 : 0;
}

/** The coach prompt's line for the level (EN; the coach answers in the athlete's language). Pure. */
export function suggestCoachLine(level: SuggestLevel): string {
  if (level === "quiet")
    return "Suggestions: QUIET. Never suggest features, plans, sessions or settings on your own and never start a topic; only answer what is asked (a proposal is fine when the athlete asks for a change).";
  if (level === "essentials")
    return "Suggestions: essentials. At most one short suggestion, only when it clearly helps the athlete's goal.";
  return "Suggestions: guide me. The athlete welcomes tips about VVake features that fit what they just did; keep each to one line.";
}
