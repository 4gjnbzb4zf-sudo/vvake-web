"use client";

import { useCallback, useEffect, useState } from "react";
import { localTz, type Habits } from "@/lib/webapp/api";
import { habitDay, minutesLabel } from "@/lib/webapp/format";
import { useApp } from "./AppContext";
import { Btn, Card, H1, Kicker, Note, Small, Toggle } from "./ui";
import { useNow } from "./useNow";

/**
 * Daily rhythm (apps/mobile app/rhythm.tsx): water, meals and bedtime check-ins for today, kept in this browser, and
 * the finished day sent once to the account (POST /v1/habits/days) for habit points, as the phone does. The habit
 * day ends at 5 am. Reminders stay in the app (a closed browser can't ring).
 */

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

const key = (userId: string) => `vvake-app-rhythm:${userId}`;

function readDays(userId: string): RhythmDay[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? "[]");
    return Array.isArray(v) ? (v as RhythmDay[]).filter((d) => d && typeof d.day === "string").slice(-10) : [];
  } catch {
    return [];
  }
}
function writeDays(userId: string, days: RhythmDay[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(days.slice(-10)));
  } catch {
    // kept for this visit only
  }
}

export const glassesToday = (userId: string) => readDays(userId).find((d) => d.day === habitDay(Date.now()))?.glasses ?? 0;
/** Today's logged rhythm day in this browser, or null (Today's Habits door). */
export const rhythmToday = (userId: string): RhythmDay | null => readDays(userId).find((d) => d.day === habitDay(Date.now())) ?? null;

/** The API's habit day from a logged day (only the habits that were on). */
export function habitSend(d: RhythmDay) {
  return {
    day: d.day,
    ...(d.on.water ? { water: { glasses: Math.min(24, d.glasses), target: RHYTHM_TARGETS.water } } : {}),
    ...(d.on.meals ? { meals: { done: Math.min(6, d.meals), target: RHYTHM_TARGETS.meals } } : {}),
    ...(d.on.sleep ? { sleep: { ...(d.bedAt !== undefined ? { bedAt: d.bedAt } : {}), target: RHYTHM_TARGETS.bed } } : {}),
  };
}

export function RhythmScreen() {
  const { t, lang, me, api, fmt } = useApp();
  const today = habitDay(useNow());
  const [days, setDays] = useState<RhythmDay[]>(() => readDays(me.id));
  const [habits, setHabits] = useState<Habits | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const day: RhythmDay = days.find((d) => d.day === today) ?? {
    day: today,
    on: days.at(-1)?.on ?? { water: true, meals: true, sleep: false },
    glasses: 0,
    meals: 0,
  };
  const save = useCallback(
    (d: RhythmDay) => {
      const next = [...days.filter((x) => x.day !== d.day), d].sort((a, b) => a.day.localeCompare(b.day));
      setDays(next);
      writeDays(me.id, next);
    },
    [days, me.id],
  );

  // Finished days logged here and not sent yet go to the account (once; the first device to send a day counts it).
  useEffect(() => {
    const tz = localTz();
    void api
      .habits(tz)
      .then(setHabits)
      .catch(() => undefined);
    const due = readDays(me.id).filter((d) => d.day < today && !d.sent && (d.on.water || d.on.meals || d.on.sleep));
    for (const d of due) {
      void api
        .sendHabitDay(habitSend(d), tz)
        .then((h) => {
          setHabits(h);
          const pts = h.days?.find((x) => x.day === d.day)?.points ?? 0;
          setSentNote(fmt(t.rhythm.sent, { points: pts }));
        })
        .catch(() => undefined)
        .finally(() => {
          const all = readDays(me.id).map((x) => (x.day === d.day ? { ...x, sent: true } : x));
          writeDays(me.id, all);
          setDays(all);
        });
    }
  }, [api, me.id, today, fmt, t.rhythm.sent]);

  return (
    <div className="space-y-4">
      <H1>{t.rhythm.title}</H1>
      <Small>{t.rhythm.lead}</Small>
      {habits?.streak && (
        <Card>
          <Kicker tone="mint">{fmt(t.rhythm.streak, { n: habits.streak.current })}</Kicker>
          {typeof habits.points === "number" && <p className="mt-1 text-sm">{fmt(t.rhythm.points, { n: habits.points })}</p>}
        </Card>
      )}
      {sentNote && <Note tone="mint">{sentNote}</Note>}

      <Card>
        <div className="flex items-center justify-between">
          <Kicker tone="sky">{t.rhythm.water}</Kicker>
          <Toggle label={t.rhythm.on} on={day.on.water} onChange={(v) => save({ ...day, on: { ...day.on, water: v } })} />
        </div>
        <p className="mt-2 font-display text-lg font-semibold">{fmt(t.rhythm.glasses, { n: day.glasses, target: RHYTHM_TARGETS.water })}</p>
        <Btn
          variant="ghost"
          className="mt-3"
          disabled={!day.on.water || day.glasses >= 24}
          onClick={() => save({ ...day, glasses: day.glasses + 1 })}
        >
          💧 {t.rhythm.add}
        </Btn>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <Kicker tone="mint">{t.rhythm.meals}</Kicker>
          <Toggle label={t.rhythm.on} on={day.on.meals} onChange={(v) => save({ ...day, on: { ...day.on, meals: v } })} />
        </div>
        <p className="mt-2 font-display text-lg font-semibold">{fmt(t.rhythm.mealsDone, { n: day.meals, target: RHYTHM_TARGETS.meals })}</p>
        <Btn
          variant="ghost"
          className="mt-3"
          disabled={!day.on.meals || day.meals >= 6}
          onClick={() => save({ ...day, meals: day.meals + 1 })}
        >
          {t.rhythm.mealDone}
        </Btn>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <Kicker tone="lilac">{t.rhythm.sleep}</Kicker>
          <Toggle label={t.rhythm.on} on={day.on.sleep} onChange={(v) => save({ ...day, on: { ...day.on, sleep: v } })} />
        </div>
        {day.bedAt !== undefined ? (
          <p className="mt-2 font-display text-lg font-semibold">{fmt(t.rhythm.bedAt, { time: minutesLabel(day.bedAt, lang) })}</p>
        ) : (
          <Btn
            variant="ghost"
            className="mt-3"
            disabled={!day.on.sleep}
            onClick={() => {
              const d = new Date();
              save({ ...day, bedAt: d.getHours() * 60 + d.getMinutes() });
            }}
          >
            {t.rhythm.bedNow}
          </Btn>
        )}
      </Card>
      <Note>{t.rhythm.remindersNote}</Note>
    </div>
  );
}
