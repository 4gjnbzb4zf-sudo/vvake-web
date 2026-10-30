// Copied from VVFit packages/game-core/src/coachTalk.ts (c525a71a 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
/**
 * "Talk to your coach" everywhere (build 60, ADR-0068, founder ask 2026-10-30 "super coach").
 *
 * One entry on every main screen of every device (phone tab bar mic, watch coach page and complication, Siri /
 * Assistant shortcut, the workout's lock screen / Live Activity, the web app's coach button). What it opens depends on
 * the plan and on what the server allows right now:
 * - `live`: VVake Coach Plus / Premium: a real hands-free conversation (LiveCallDO mode `talk`, or `workout` in a
 *   workout): continuous listening, end of turn detected, barge-in, no buttons.
 * - `ptt`: Free, or a paid plan with no live minutes left, or live off: tap to talk, the end of speech is detected,
 *   the coach answers aloud (stitched / cloud / device voice by the existing rules) with the same understanding and
 *   the same actions (POST /v1/coach/talk, actions 2).
 * - `text`: no microphone (denied, VoiceOver users who chose typing, web without a mic): type, same brain.
 * Running out of minutes is never a dead end: the live call ends with `to_ptt` and the same screen goes on in `ptt`.
 *
 * Pure.
 */
import type { CoachTier } from "./coachPlans";

type Lang = "en" | "fr";

export type TalkMode = "live" | "ptt" | "text";
export type TalkDevice = "iphone" | "android" | "watch" | "wear" | "web";

/** Where the entry lives on each device (the apps' checklist; nothing here is shown as text). */
export const COACH_ENTRY_SURFACES: Readonly<Record<TalkDevice, readonly string[]>> = {
  iphone: ["tab_bar_mic", "workout_coach_button", "live_activity", "siri_shortcut", "notification"],
  android: ["tab_bar_mic", "workout_coach_button", "ongoing_notification", "app_shortcut", "notification"],
  watch: ["main_page", "workout_page", "complication", "siri_shortcut"],
  wear: ["main_page", "workout_page", "tile", "complication"],
  web: ["coach_button"],
};

/** Deep link every entry opens (phone + web): vvake://talk and /<lang>/app/talk; `?live=0` forces push-to-talk. */
export const TALK_ROUTE = "/talk";

export interface TalkModeInput {
  tier: CoachTier;
  /** Server switch for live talk (GET /v1/health features.liveTalk), already narrowed to this account (testers). */
  liveOn: boolean;
  /** Live seconds left this week (pool + packs), as the server last said; undefined = unknown (try live). */
  leftS?: number;
  online: boolean;
  micAllowed: boolean;
  /** The athlete chose typing (Settings) or the device has no mic. */
  prefersText?: boolean;
}

export interface TalkModePick {
  mode: TalkMode;
  /** Why it is not live (for the one quiet line under the mic; never an upsell during a workout). */
  why?: "free" | "off" | "no_minutes" | "offline" | "no_mic" | "typing";
}

/** Below this many seconds a new live conversation isn't worth opening: push-to-talk with the "minutes" line. */
export const LIVE_MIN_START_S = 20;

/** Which way the coach entry opens now. Pure. */
export function talkMode(i: TalkModeInput): TalkModePick {
  if (i.prefersText) return { mode: "text", why: "typing" };
  if (!i.micAllowed) return { mode: "text", why: "no_mic" };
  if (!i.online) return { mode: "ptt", why: "offline" };
  if (i.tier === "free") return { mode: "ptt", why: "free" };
  if (!i.liveOn) return { mode: "ptt", why: "off" };
  if (i.leftS !== undefined && i.leftS < LIVE_MIN_START_S) return { mode: "ptt", why: "no_minutes" };
  return { mode: "live" };
}

/** The one line when the live minutes run out mid-conversation (the screen goes on in push-to-talk). Pure. */
export function toPttLine(lang: Lang): string {
  return lang === "fr"
    ? "C’est tout pour tes minutes en direct cette semaine. On continue : touche le micro et je te réponds."
    : "That's your live minutes for this week. Let's keep going: tap the mic and I'll answer.";
}

/** The quiet hint under the push-to-talk mic, by reason (null = nothing). Never shown in a workout. Pure. */
export function pttHint(why: TalkModePick["why"], lang: Lang, o: { inWorkout?: boolean } = {}): string | null {
  if (o.inWorkout) return null;
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  switch (why) {
    case "free":
      return L(
        "Tap, talk, and I answer. Hands-free conversations come with VVake Coach Plus.",
        "Touche, parle, je réponds. Les conversations mains libres viennent avec VVake Coach Plus.",
      );
    case "no_minutes":
      return L(
        "Live minutes used for this week. Tap to talk still works.",
        "Minutes en direct utilisées cette semaine. Touche pour parler marche toujours.",
      );
    case "offline":
      return L("You're offline: I'll answer what I can.", "Tu es hors ligne : je réponds à ce que je peux.");
    default:
      return null;
  }
}

// ── Latency ────────────────────────────────────────────────────────────────────────────────────────────────

/** The q-th quantile (0–1) of the samples, nearest rank; null when empty. Pure. */
export function quantile(samples: readonly number[], q: number): number | null {
  const v = samples.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = Math.min(v.length - 1, Math.max(0, Math.ceil(q * v.length) - 1));
  return v[i]!;
}

export interface LatencyStats {
  n: number;
  p50: number | null;
  p90: number | null;
}

/** p50 / p90 of a list of millisecond timings. Pure. */
export const latencyStats = (ms: readonly number[]): LatencyStats => ({
  n: ms.filter((x) => Number.isFinite(x) && x >= 0).length,
  p50: quantile(ms, 0.5),
  p90: quantile(ms, 0.9),
});

/** Target: end of the athlete's speech → the coach's first sound (phone, on-device STT). */
export const LATENCY_TARGET_MS = { p50: 1000, p90: 1600 } as const;

// ── Plan minutes (server config; the public copy changes only with the founder) ─────────────────────────────

/** Live minutes a MONTH per plan, as proposed (ADR-0068 §5): the server keeps a weekly pool = month × 12 / 52. */
export const PROPOSED_LIVE_MINUTES_PER_MONTH: Readonly<Record<CoachTier, number>> = { free: 0, plus: 60, premium: 180 };

/** A monthly allowance as the weekly pool the server meters (rounded to whole minutes, at least 1 when > 0). Pure. */
export function weeklyFromMonthly(minutesPerMonth: number): number {
  if (minutesPerMonth <= 0) return 0;
  return Math.max(1, Math.round((minutesPerMonth * 12) / 52));
}
