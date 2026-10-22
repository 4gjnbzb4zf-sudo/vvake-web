"use client";

import { useCallback, useEffect, useState } from "react";
import { localTz, type Habits } from "@/lib/webapp/api";
import { habitDay, minutesLabel } from "@/lib/webapp/format";
import { dayOf, habitSend, readDays, RHYTHM_EVENT, RHYTHM_TARGETS, withDay, writeDays, type RhythmDay } from "@/lib/webapp/rhythm";
import { useApp } from "./AppContext";
import { Btn, Card, H1, Kicker, Note, Small, Toggle } from "./ui";
import { useNow } from "./useNow";

/**
 * Daily rhythm (apps/mobile app/rhythm.tsx): water, meals and bedtime check-ins for today, kept in this browser, and
 * the finished day sent once to the account (POST /v1/habits/days) for habit points, as the phone does. The habit
 * day ends at 5 am. Reminders stay in the app (a closed browser can't ring).
 */

export { glassesToday, habitSend, RHYTHM_TARGETS, type RhythmDay } from "@/lib/webapp/rhythm";

export function RhythmScreen() {
  const { t, lang, me, api, fmt } = useApp();
  const now = useNow();
  const today = habitDay(now);
  const [days, setDays] = useState<RhythmDay[]>(() => readDays(me.id));
  const [habits, setHabits] = useState<Habits | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const day: RhythmDay = days.find((d) => d.day === today) ?? { ...dayOf(days, now), day: today };
  const save = useCallback(
    (d: RhythmDay) => {
      const next = withDay(readDays(me.id), d);
      setDays(next);
      writeDays(me.id, next);
    },
    [me.id],
  );
  // Checked off on Today's habits: the same day here.
  useEffect(() => {
    const f = () => setDays(readDays(me.id));
    window.addEventListener(RHYTHM_EVENT, f);
    return () => window.removeEventListener(RHYTHM_EVENT, f);
  }, [me.id]);

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
