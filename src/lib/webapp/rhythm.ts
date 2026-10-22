/**
 * Daily rhythm on the web (apps/mobile lib/habitsToday.ts): water, meals and bedtime check-ins for the habit day
 * (it ends at 5 am), kept in this browser per account, and the one-tap check-offs shared by the rhythm screen and
 * Today's habits card. The finished day goes to the account once (POST /v1/habits/days), as the phone does.
 */
import { habitDay } from "./format";

export interface RhythmDay {
  day: string;
  on: { water: boolean; meals: boolean; sleep: boolean };
  glasses: number;
  meals: number;
  bedAt?: number;
  sent?: boolean;
}

/** The apps' defaults: 8 glasses, 3 meals, in bed by 23:00 (8 hours before a 7:00 wake-up). */
export const RHYTHM_TARGETS = { water: 8, meals: 3, bed: 23 * 60 } as const;
/** "Going to bed" opens 2 hours before bedtime (a tap at noon is never a bedtime), until 5 am. */
export const BED_OPENS_MIN = 120;
export const RHYTHM_EVENT = "vvake-rhythm";

const key = (userId: string) => `vvake-app-rhythm:${userId}`;

export function readDays(userId: string): RhythmDay[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
    return Array.isArray(v) ? (v as RhythmDay[]).filter((d) => d && typeof d.day === "string").slice(-10) : [];
  } catch {
    return [];
  }
}

export function writeDays(userId: string, days: RhythmDay[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(days.slice(-10)));
  } catch {
    // kept for this visit only
  }
  try {
    window.dispatchEvent(new Event(RHYTHM_EVENT)); // the other card on screen follows
  } catch {
    // no window (tests)
  }
}

/** Today's day (the habit day), or a fresh one with yesterday's switches. */
export function dayOf(days: readonly RhythmDay[], now: number): RhythmDay {
  const today = habitDay(now);
  return (
    days.find((d) => d.day === today) ?? {
      day: today,
      on: days.at(-1)?.on ?? { water: true, meals: true, sleep: false },
      glasses: 0,
      meals: 0,
    }
  );
}

/** The days with one day replaced, in order. */
export const withDay = (days: readonly RhythmDay[], d: RhythmDay): RhythmDay[] =>
  [...days.filter((x) => x.day !== d.day), d].sort((a, b) => a.day.localeCompare(b.day));

export const glassesToday = (userId: string, now = Date.now()) => dayOf(readDays(userId), now).glasses;

/** Today's logged rhythm day in this browser, or null (Today's Habits door). */
export const rhythmToday = (userId: string, now = Date.now()): RhythmDay | null =>
  readDays(userId).find((d) => d.day === habitDay(now)) ?? null;

const minuteOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/** Whether "Going to bed" can be tapped now. */
export const bedOpen = (now: number) => new Date(now).getHours() < 5 || minuteOf(now) >= RHYTHM_TARGETS.bed - BED_OPENS_MIN;

export type HabitKey = "water" | "meal" | "bed";

/** One tap on Today's habits: the day after it, or null when it changes nothing (off, full, closed, done). */
export function logHabit(d: RhythmDay, k: HabitKey, now: number, undo = false): RhythmDay | null {
  if (k === "water") {
    if (!d.on.water) return null;
    const glasses = undo ? Math.max(0, d.glasses - 1) : Math.min(24, d.glasses + 1);
    return glasses === d.glasses ? null : { ...d, glasses };
  }
  if (k === "meal") {
    if (!d.on.meals) return null;
    const meals = undo ? Math.max(0, d.meals - 1) : Math.min(6, d.meals + 1);
    return meals === d.meals ? null : { ...d, meals };
  }
  if (!d.on.sleep || d.bedAt !== undefined || !bedOpen(now)) return null;
  return { ...d, bedAt: minuteOf(now) };
}

/** How many of the day's habits are done: water and meals at their goal, bedtime logged. */
export function habitsDone(d: RhythmDay): { done: number; total: number } {
  const on = [d.on.water, d.on.meals, d.on.sleep].filter(Boolean).length;
  const done =
    (d.on.water && d.glasses >= RHYTHM_TARGETS.water ? 1 : 0) +
    (d.on.meals && d.meals >= RHYTHM_TARGETS.meals ? 1 : 0) +
    (d.on.sleep && d.bedAt !== undefined ? 1 : 0);
  return { done, total: on };
}

/** The API's habit day from a logged day (only the habits that were on). */
export function habitSend(d: RhythmDay) {
  return {
    day: d.day,
    ...(d.on.water ? { water: { glasses: Math.min(24, d.glasses), target: RHYTHM_TARGETS.water } } : {}),
    ...(d.on.meals ? { meals: { done: Math.min(6, d.meals), target: RHYTHM_TARGETS.meals } } : {}),
    ...(d.on.sleep ? { sleep: { ...(d.bedAt !== undefined ? { bedAt: d.bedAt } : {}), target: RHYTHM_TARGETS.bed } } : {}),
  };
}
