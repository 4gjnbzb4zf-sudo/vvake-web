// Copied from VVFit packages/game-core/src/streakCare.ts (52bdd17f 2026-10-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Streaks that respect recovery (living app §10.3, ADR-0062, docs/02-product/journey.md): the weekly streak beside the
 * daily one, and the sick / injured / time-off pause.
 *
 * - Weekly streak: weeks meeting the plan's minimum (active days), or 2 active days a week without a plan. Recovery
 *   weeks of the season (recovery, taper, race, deload) and planned rest count as kept weeks; a paused week holds the
 *   streak (no gain, no loss); the week in progress never breaks it.
 * - Pause: one tap (Today or by voice), up to 14 days, no freeze spent (the paused days are treated like planned rest
 *   days by the daily streak: habit.ts `advanceStreak`), competitive offers muted (the care rule), comeback pushes off,
 *   the coach told. At most 14 paused days in any 28 (no endless shield). Synced as `prefs.pause` (newest `at` wins).
 *
 * Health-first: rest, illness and recovery never cost a streak. Nothing here is ever bought (ADR-0002). Pure.
 */
import { addDays, dayNum, isoOf, mondayOf } from "./seasonGoals";

// ── Pause ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const PAUSE_KINDS = ["sick", "injured", "off"] as const;
export type PauseKind = (typeof PAUSE_KINDS)[number];

/** Longest single pause, days (first and last day included). */
export const PAUSE_MAX_DAYS = 14;
/** At most PAUSE_MAX_DAYS paused days inside any window this long. */
export const PAUSE_WINDOW_DAYS = 28;
/** A pause may start this many days back (yesterday's fever), never more. */
export const PAUSE_BACKDATE_DAYS = 2;

export interface StreakPause {
  kind: PauseKind;
  /** First and last paused local day, `YYYY-MM-DD`, both included. */
  from: string;
  until: string;
  /** When it was set (ISO), for newest-wins sync. */
  at: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === "string" && ISO_DAY.test(v) && Number.isFinite(dayNum(v));

/** Paused days already used inside the window that ends on `day` (from the stored past pauses). */
function usedInWindow(past: readonly StreakPause[], from: string, until: string): number {
  const lo = dayNum(until) - PAUSE_WINDOW_DAYS + 1;
  const hi = dayNum(until);
  const used = new Set<number>();
  for (const p of past) {
    for (let d = Math.max(dayNum(p.from), lo); d <= Math.min(dayNum(p.until), hi); d++) if (d < dayNum(from)) used.add(d);
  }
  return used.size;
}

/**
 * A pause as the athlete asked for it, made safe: kind checked, start no earlier than 2 days back (default today),
 * end at most 14 days after the start and never before it, and no more than 14 paused days in any 28 (counting
 * `past` pauses). Null when nothing valid is left (the athlete has used their pause days: the app says so kindly).
 */
export function cleanPause(
  raw: { kind?: unknown; from?: unknown; until?: unknown },
  today: string,
  at: string,
  past: readonly StreakPause[] = [],
): StreakPause | null {
  if (typeof raw.kind !== "string" || !(PAUSE_KINDS as readonly string[]).includes(raw.kind)) return null;
  const kind = raw.kind as PauseKind;
  let from = isDay(raw.from) ? raw.from : today;
  if (dayNum(from) < dayNum(today) - PAUSE_BACKDATE_DAYS) from = addDays(today, -PAUSE_BACKDATE_DAYS);
  if (dayNum(from) > dayNum(today)) from = today;
  let until = isDay(raw.until) ? raw.until : addDays(from, PAUSE_MAX_DAYS - 1);
  if (dayNum(until) < dayNum(from)) return null;
  if (dayNum(until) - dayNum(from) + 1 > PAUSE_MAX_DAYS) until = addDays(from, PAUSE_MAX_DAYS - 1);
  // Over the 28-day budget: shorten until it fits (each step re-checks the window ending on the new last day).
  while (dayNum(until) >= dayNum(from) && usedInWindow(past, from, until) + dayNum(until) - dayNum(from) + 1 > PAUSE_MAX_DAYS)
    until = addDays(until, -1);
  if (dayNum(until) < dayNum(from)) return null;
  return { kind, from, until, at };
}

/** A stored pause read back (anything malformed is no pause). Pure. */
export function pauseOf(v: unknown): StreakPause | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<StreakPause>;
  if (typeof p.kind !== "string" || !(PAUSE_KINDS as readonly string[]).includes(p.kind)) return null;
  if (!isDay(p.from) || !isDay(p.until) || typeof p.at !== "string" || dayNum(p.until) < dayNum(p.from)) return null;
  return { kind: p.kind, from: p.from, until: p.until, at: p.at };
}

/** The newer of two pauses (newest `at` wins; either may be missing). Pure. */
export function newerPause(a: StreakPause | null | undefined, b: StreakPause | null | undefined): StreakPause | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) >= Date.parse(a.at) ? b : a;
}

/** Is `day` inside the pause? */
export const pauseCovers = (p: StreakPause | null | undefined, day: string): boolean =>
  !!p && dayNum(day) >= dayNum(p.from) && dayNum(day) <= dayNum(p.until);

/** Is the pause on today? */
export const pauseActive = (p: StreakPause | null | undefined, today: string): boolean => pauseCovers(p, today);

/** Days left in the pause, today included (0 when it isn't on). */
export const pauseDaysLeft = (p: StreakPause | null | undefined, today: string): number =>
  pauseActive(p, today) ? dayNum(p!.until) - dayNum(today) + 1 : 0;

/**
 * The paused days as local day numbers (days since 1970-01-01, the habit engine's days), to add to the planned rest
 * days `advanceStreak` skips: a paused day never breaks the daily streak and never spends a freeze.
 */
export function pausedDayNumbers(pauses: readonly (StreakPause | null | undefined)[]): Set<number> {
  const out = new Set<number>();
  for (const p of pauses) if (p) for (let d = dayNum(p.from); d <= dayNum(p.until); d++) out.add(d);
  return out;
}

/**
 * Mute competitive offers (challenges, leagues' pushes, clash calls, pokes)? While a pause is on, and for anyone the
 * care rule already rests (pain, easy only). Pure.
 */
export const pauseMutesCompetition = (p: StreakPause | null | undefined, today: string): boolean => pauseActive(p, today);

const PAUSE_TEXT: Record<PauseKind, { en: string; fr: string }> = {
  sick: { en: "Get well: your streak waits for you until {until}.", fr: "Soigne-toi : ta série t’attend jusqu’au {until}." },
  injured: { en: "Heal first: your streak waits for you until {until}.", fr: "Guéris d’abord : ta série t’attend jusqu’au {until}." },
  off: { en: "Enjoy the break: your streak waits for you until {until}.", fr: "Profite de la pause : ta série t’attend jusqu’au {until}." },
};

/** The Today line while a pause is on (EN/FR, the date as given). */
export const pauseText = (p: StreakPause, lang: "en" | "fr", untilText = p.until): string =>
  PAUSE_TEXT[p.kind][lang].replace("{until}", untilText);

/** The coach's line about a pause (EN; the coach answers in the athlete's language), or '' when none is on. */
export function pauseCoachLine(p: StreakPause | null | undefined, today: string): string {
  if (!pauseActive(p, today)) return "";
  const what = p!.kind === "sick" ? "sick" : p!.kind === "injured" ? "injured" : "taking time off";
  return `- Pause: they said they are ${what} until ${p!.until} (${pauseDaysLeft(p, today)} day(s) left). Their streak is safe. Never suggest training, challenges or competition; ask how they feel, rest and sleep first${p!.kind === "off" ? "" : ", and see a professional if it doesn’t get better"}.`;
}

// ── Weekly streak ──────────────────────────────────────────────────────────────────────────────────────────────

/** Without a plan, a week is kept with this many active days. */
export const WEEK_MIN_ACTIVE_DAYS = 2;

/** The plan's minimum for a week: two thirds of its planned sessions, rounded up (at least 1). */
export const planWeekMinimum = (plannedSessions: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Math.floor(plannedSessions)) * 2) / 3));

export interface StreakWeek {
  /** The week's Monday. */
  monday: string;
  /** Days with a counted session (habit.ts dayCounts). */
  activeDays: number;
  /** The plan's minimum this week (planWeekMinimum); absent: no plan (WEEK_MIN_ACTIVE_DAYS). */
  minimum?: number;
  /** A recovery, taper, race or deload week of the season, or a planned rest week: kept as it is. */
  recovery?: boolean;
  /** Days of the week inside a pause (0–7). */
  pausedDays?: number;
}

export type WeekVerdict = "kept" | "rest" | "held" | "open" | "missed";

/**
 * One week's verdict. `kept`: the minimum was met. `rest`: a recovery week (counts as kept). `held`: a pause covered
 * part of it and the minimum wasn't met (the streak waits). `open`: the week in progress, not met yet (never breaks).
 * `missed`: over and not met.
 */
export function weekVerdict(w: StreakWeek, currentMonday: string): WeekVerdict {
  const min = w.minimum ?? WEEK_MIN_ACTIVE_DAYS;
  if (w.activeDays >= min) return "kept";
  if (w.recovery) return "rest";
  // A pause shrinks the week's minimum by its share of the week (at least 1 day); fully paused: held.
  const paused = Math.min(7, Math.max(0, w.pausedDays ?? 0));
  if (paused > 0) {
    const need = paused >= 7 ? Infinity : Math.max(1, Math.ceil((min * (7 - paused)) / 7));
    return w.activeDays >= need ? "kept" : "held";
  }
  if (dayNum(w.monday) >= dayNum(currentMonday)) return "open";
  return "missed";
}

export interface WeeklyStreakView {
  /** Weeks in a row kept (this one included once met). */
  weeks: number;
  best: number;
  thisWeek: WeekVerdict;
  /** Active days still needed this week (0 when met, a recovery week or paused). */
  needed: number;
}

/**
 * The weekly streak from the weeks' tallies (any order; weeks with nothing may be left out: a missing past week is a
 * missed one unless it is the current week). Pure.
 */
export function weeklyStreak(weeks: readonly StreakWeek[], today: string): WeeklyStreakView {
  const current = mondayOf(today);
  const byMonday = new Map(weeks.map((w) => [w.monday, w]));
  const mondays = weeks.map((w) => dayNum(w.monday)).filter((n) => n <= dayNum(current));
  if (!mondays.length) return { weeks: 0, best: 0, thisWeek: "open", needed: WEEK_MIN_ACTIVE_DAYS };
  const first = Math.min(...mondays);
  let run = 0;
  let best = 0;
  let verdict: WeekVerdict = "open";
  for (let m = first; m <= dayNum(current); m += 7) {
    const iso = isoOf(m);
    const w = byMonday.get(iso) ?? { monday: iso, activeDays: 0 };
    verdict = weekVerdict(w, current);
    if (verdict === "kept" || verdict === "rest") run++;
    else if (verdict === "missed") run = 0;
    best = Math.max(best, run);
  }
  const cur = byMonday.get(current);
  const needed = verdict === "open" ? Math.max(0, (cur?.minimum ?? WEEK_MIN_ACTIVE_DAYS) - (cur?.activeDays ?? 0)) : 0;
  return { weeks: run, best, thisWeek: verdict, needed };
}

/**
 * The tallies `weeklyStreak` reads, from counted local days (`YYYY-MM-DD`, one per active day), the plan's minimum per
 * Monday (absent: no plan), the season's recovery Mondays and the pauses. Covers every week from the first active day
 * (or `from`) to this week. Pure.
 */
export function streakWeeks(
  activeDays: readonly string[],
  today: string,
  opts: {
    minimum?: (monday: string) => number | undefined;
    recoveryMondays?: ReadonlySet<string>;
    pauses?: readonly (StreakPause | null | undefined)[];
    from?: string;
  } = {},
): StreakWeek[] {
  const days = [...new Set(activeDays)].filter(isDay).sort();
  const startIso = opts.from ?? days[0];
  if (!startIso) return [];
  const paused = pausedDayNumbers(opts.pauses ?? []);
  const out: StreakWeek[] = [];
  for (let m = dayNum(mondayOf(startIso)); m <= dayNum(mondayOf(today)); m += 7) {
    const monday = isoOf(m);
    const active = days.filter((d) => dayNum(d) >= m && dayNum(d) < m + 7).length;
    let pausedDays = 0;
    for (let d = m; d < m + 7; d++) if (paused.has(d)) pausedDays++;
    const min = opts.minimum?.(monday);
    out.push({
      monday,
      activeDays: active,
      ...(min !== undefined ? { minimum: min } : {}),
      ...(opts.recoveryMondays?.has(monday) ? { recovery: true } : {}),
      ...(pausedDays ? { pausedDays } : {}),
    });
  }
  return out;
}
