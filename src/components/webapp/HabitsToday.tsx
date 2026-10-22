"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { minutesLabel } from "@/lib/webapp/format";
import {
  bedOpen,
  dayOf,
  habitsDone,
  logHabit,
  readDays,
  RHYTHM_EVENT,
  RHYTHM_TARGETS,
  withDay,
  writeDays,
  type HabitKey,
} from "@/lib/webapp/rhythm";
import { useApp } from "./AppContext";
import { Card, Kicker, Small } from "./ui";
import { useNow } from "./useNow";

/**
 * Today's habits in one tap (apps/mobile components/habits/HabitsToday.tsx): water +1, a meal, bedtime, checked off
 * right on Today, the same day as the rhythm screen (lib/webapp/rhythm.ts, kept in this browser and sent to the
 * account once the day is over). Self-contained: Today places it.
 */
/** When a chip is tapped (read in the handler, not during render). */
const tapTime = () => Date.now();

export function HabitsToday() {
  const { t, lang, me, go, fmt } = useApp();
  const now = useNow();
  const [days, setDays] = useState(() => readDays(me.id));
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setDays(readDays(me.id));
    window.addEventListener(RHYTHM_EVENT, f);
    return () => window.removeEventListener(RHYTHM_EVENT, f);
  }, [me.id]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(id);
  }, [note]);

  const day = dayOf(days, now);
  const { done, total } = habitsDone(day);
  const tap = (k: HabitKey) => {
    const latest = readDays(me.id);
    const at = tapTime();
    const next = logHabit(dayOf(latest, at), k, at);
    if (!next) return;
    const all = withDay(latest, next);
    setDays(all);
    writeDays(me.id, all);
    setNote(t.habits.logged);
    try {
      navigator.vibrate?.(15);
    } catch {
      // no vibration on this device
    }
  };

  const chip = (k: HabitKey, label: string, aria: string, on: boolean, tone: "sky" | "butter" | "lilac", disabled = false) => (
    <button
      key={k}
      type="button"
      onClick={() => tap(k)}
      disabled={disabled}
      aria-label={aria}
      aria-pressed={on}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed",
        on
          ? `border-current ${tone === "sky" ? "text-sky-fg" : tone === "butter" ? "text-butter-fg" : "text-lilac-fg"}`
          : "border-line bg-surface-2 text-text",
        disabled && !on && "opacity-55",
      )}
    >
      {label}
    </button>
  );

  return (
    <Card>
      <button type="button" onClick={() => go({ name: "rhythm" })} className="flex w-full items-center justify-between text-left">
        <Kicker tone="sky">{t.habits.title}</Kicker>
        <Small className={total && done === total ? "text-volt-fg" : undefined}>
          {total ? `${fmt(t.habits.count, { done, total })} ›` : "›"}
        </Small>
      </button>
      {total === 0 ? (
        <button type="button" onClick={() => go({ name: "rhythm" })} className="mt-2 text-left text-sm">
          {t.habits.none}
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {day.on.water &&
            chip(
              "water",
              fmt(t.habits.water, { n: day.glasses, target: RHYTHM_TARGETS.water }),
              fmt(t.habits.waterLabel, { n: day.glasses, target: RHYTHM_TARGETS.water }),
              day.glasses >= RHYTHM_TARGETS.water,
              "sky",
            )}
          {day.on.meals &&
            chip(
              "meal",
              fmt(t.habits.meals, { n: day.meals, target: RHYTHM_TARGETS.meals }),
              fmt(t.habits.mealsLabel, { n: day.meals, target: RHYTHM_TARGETS.meals }),
              day.meals >= RHYTHM_TARGETS.meals,
              "butter",
            )}
          {day.on.sleep &&
            chip(
              "bed",
              day.bedAt !== undefined
                ? fmt(t.habits.bedAt, { time: minutesLabel(day.bedAt, lang) })
                : bedOpen(now)
                  ? t.habits.bedNow
                  : fmt(t.habits.bedLater, { time: minutesLabel(RHYTHM_TARGETS.bed, lang) }),
              t.habits.bedLabel,
              day.bedAt !== undefined,
              "lilac",
              day.bedAt !== undefined || !bedOpen(now),
            )}
        </div>
      )}
      {note && (
        <p role="status" className="mt-2 text-sm font-semibold text-volt-fg">
          {note}
        </p>
      )}
    </Card>
  );
}
