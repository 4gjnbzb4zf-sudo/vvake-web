// Copied from VVFit packages/game-core/src/comeback.ts (52bdd17f 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Comebacks after a break (living app §10.6, decision 16, docs/02-product/journey.md): what Today offers, and the one
 * push allowed, after a gap. No guilt words, no "you lost", no counters going red: the path waits where it was.
 *
 * | Gap                                   | Stage          | What happens                                                    |
 * | 3 days (no plan) / 2 planned missed   | easy_win       | Today's next action is the easiest win (daily move / 15 min)    |
 * | 7 days                                | nudge          | one push (budget and Quiet permitting), the plan gets lighter   |
 * | 14 days                               | welcome_back   | a card: Ease back in · Fresh start · Talk to my coach           |
 * | 30 days +                             | monthly        | at most one push or e-mail a month, then silence                |
 * | pause on (sick / injured / off)       | none           | nothing at all until it's over                                  |
 *
 * Gated by suggest.ts: the cards are `next_step`, the pushes `push_suggestion` (none in Quiet). Pure.
 */
import { dayNum } from "./seasonGoals";
import { suggestAllowed, type SuggestLevel } from "../suggest/suggest";

export const COMEBACK_STAGES = ["none", "easy_win", "nudge", "welcome_back", "monthly"] as const;
export type ComebackStage = (typeof COMEBACK_STAGES)[number];

export const COMEBACK_DAYS = { easyWin: 3, nudge: 7, welcomeBack: 14, monthly: 30 } as const;
/** Planned sessions missed in a row that also make an easy win. */
export const COMEBACK_PLANNED_MISSED = 2;

/**
 * The stage for a gap. `lastActiveDay`: the last counted day (`YYYY-MM-DD`), null for someone who never started (no
 * comeback: onboarding handles them). `paused`: a pause is on (nothing). `plannedMissed`: planned sessions missed in a
 * row since then. Pure.
 */
export function comebackStage(lastActiveDay: string | null, today: string, paused: boolean, plannedMissed = 0): ComebackStage {
  if (paused || !lastActiveDay) return "none";
  const gap = dayNum(today) - dayNum(lastActiveDay);
  if (!Number.isFinite(gap) || gap <= 0) return "none";
  if (gap >= COMEBACK_DAYS.monthly) return "monthly";
  if (gap >= COMEBACK_DAYS.welcomeBack) return "welcome_back";
  if (gap >= COMEBACK_DAYS.nudge) return "nudge";
  if (gap >= COMEBACK_DAYS.easyWin || plannedMissed >= COMEBACK_PLANNED_MISSED) return "easy_win";
  return "none";
}

export type ComebackAction = "daily_move" | "short_session" | "ease_back" | "fresh_start" | "talk_coach";

export interface ComebackOffer {
  stage: ComebackStage;
  /** Today's primary action (the easiest win first). */
  next: ComebackAction | null;
  /** The welcome-back card's three choices. */
  choices: ComebackAction[];
  /** The Today line (EN/FR). */
  text: string;
  /** The push for this stage, if one may go (see comebackPushAllowed). */
  push: { title: string; body: string } | null;
  /** The plan gets lighter (the existing "lighter" rule): from the nudge on. */
  lighter: boolean;
}

const T = {
  easy_win: { en: "Short one today? 15 easy minutes count.", fr: "Une courte aujourd’hui ? 15 minutes faciles, ça compte." },
  nudge: { en: "Your VVaker misses the trail. 10 easy minutes?", fr: "Ton VVaker a envie de bouger. 10 minutes tranquilles ?" },
  welcome_back: { en: "Welcome back. Pick how you want to restart.", fr: "Content de te revoir. Choisis comment tu reprends." },
  monthly: {
    en: "Your path is right where you left it. Start with 10 easy minutes.",
    fr: "Ton chemin t’attend là où tu l’as laissé. Commence par 10 minutes faciles.",
  },
  pushTitle: { en: "VVake", fr: "VVake" },
} as const;

/** The best streak shown on the welcome-back card ("best 23 days"), never a zero. */
export const bestStreakText = (best: number, lang: "en" | "fr"): string =>
  lang === "fr" ? `Ta meilleure série : ${best} jour${best > 1 ? "s" : ""}` : `Your best streak: ${best} day${best === 1 ? "" : "s"}`;

/**
 * What a stage offers. `hasPlan`: a planned session exists today (the easy win is its 15-min version), else the daily
 * move. Pure.
 */
export function comebackOffer(stage: ComebackStage, lang: "en" | "fr", hasPlan = false): ComebackOffer {
  const none: ComebackOffer = { stage, next: null, choices: [], text: "", push: null, lighter: false };
  if (stage === "none") return none;
  const easy: ComebackAction = hasPlan ? "short_session" : "daily_move";
  if (stage === "easy_win") return { ...none, next: easy, text: T.easy_win[lang] };
  if (stage === "nudge")
    return { ...none, next: easy, text: T.nudge[lang], push: { title: T.pushTitle[lang], body: T.nudge[lang] }, lighter: true };
  if (stage === "welcome_back")
    return { ...none, next: "ease_back", choices: ["ease_back", "fresh_start", "talk_coach"], text: T.welcome_back[lang], lighter: true };
  return { ...none, next: easy, text: T.monthly[lang], push: { title: T.pushTitle[lang], body: T.monthly[lang] }, lighter: true };
}

/** Show the comeback card on Today? Never during a pause (stage is none then), never in Quiet. Pure. */
export const comebackCardAllowed = (stage: ComebackStage, level: SuggestLevel): boolean =>
  stage !== "none" && suggestAllowed("next_step", level);

/**
 * May the stage's push go? Only the nudge (once per gap) and the monthly one (at most every 30 days), never in Quiet,
 * never during a pause (stage none). `lastPushDay`: the last comeback push sent (`YYYY-MM-DD`), `lastActiveDay` the
 * gap's start. The daily push budget (ADR-0059) still applies on top. Pure.
 */
export function comebackPushAllowed(
  stage: ComebackStage,
  level: SuggestLevel,
  today: string,
  lastActiveDay: string | null,
  lastPushDay: string | null,
): boolean {
  if ((stage !== "nudge" && stage !== "monthly") || !suggestAllowed("push_suggestion", level)) return false;
  if (!lastPushDay || !lastActiveDay) return true;
  // One per gap: a push already sent after the last active day covers the nudge.
  if (stage === "nudge") return dayNum(lastPushDay) <= dayNum(lastActiveDay);
  return dayNum(lastPushDay) <= dayNum(lastActiveDay) || dayNum(today) - dayNum(lastPushDay) >= COMEBACK_DAYS.monthly;
}
