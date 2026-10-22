"use client";

import { useCallback, useEffect, useState } from "react";
import { localTz, type PlanChange, type Week } from "@/lib/webapp/api";
import { dayLabel, localDay, timeLabel } from "@/lib/webapp/format";
import { sportLabel } from "@/lib/webapp/workout";
import { getSeasonDict } from "@/i18n/season";
import { useApp } from "./AppContext";
import { SeasonWeekEditor } from "./SeasonWeek";
import { useSeason } from "./useSeason";
import { useWorkout } from "./WorkoutContext";
import { Btn, Card, H1, Kicker, List, Note, Row, Small } from "./ui";
import { useNow } from "./useNow";

/**
 * Plan (apps/mobile app/(tabs)/plan.tsx). With a season plan (ADR-0050): the coach's week toward your goals, edited
 * with the coach (SeasonWeek), and the season a tap away. Without one: an invitation to plan a season, then the week
 * as before.
 */
export function PlanScreen() {
  const { lang, go, t } = useApp();
  const s = getSeasonDict(lang);
  const { season, state } = useSeason();
  if (season?.plan)
    return (
      <div className="space-y-4">
        <H1>{t.plan.title}</H1>
        <List>
          <Row
            tone="volt"
            icon="⚑"
            title={s.title}
            detail={season.goals[0] ? `${season.goals[0].name}${season.week?.label ? ` · ${season.week.label}` : ""}` : s.lead}
            onClick={() => go({ name: "season" })}
          />
        </List>
        <SeasonWeekEditor />
        <List>
          <Row tone="sky" icon="▦" title={s.sportsRow} onClick={() => go({ name: "season-sports" })} />
          <Row tone="mint" icon="♥" title={s.healthRow} onClick={() => go({ name: "season-health" })} />
        </List>
        <Small>{season.notMedical || s.notMedical}</Small>
      </div>
    );
  if (!season && state === "loading") return <p className="text-muted">{t.common.loading}</p>;
  return <WeekPlan seasonInvite={!!season} />;
}

/**
 * The week without a season (apps/mobile app/(tabs)/plan.tsx): the next 7 days from the account's plan (GET /v1/plan/week: the survey, the
 * coach's approved changes, Google Calendar's busy times when connected), today's session with Start, and the coach's
 * pending proposals to accept or turn down (the same ones the phone and the watch show).
 */
function WeekPlan({ seasonInvite }: { seasonInvite: boolean }) {
  const { t, lang, api, go } = useApp();
  const se = getSeasonDict(lang);
  const wk = useWorkout();
  const [week, setWeek] = useState<Week | null>(null);
  const [changes, setChanges] = useState<PlanChange[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([api.week(localTz(), lang), api.planChanges().catch(() => [] as PlanChange[])]);
      setWeek(w);
      setChanges(c.filter((x) => x.status === "pending"));
      setState("ok");
    } catch {
      setState("error");
    }
  }, [api, lang]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const decide = async (id: string, d: "accept" | "reject") => {
    try {
      await api.decidePlan(id, d);
      setChanges((x) => x.filter((c) => c.id !== id));
      if (d === "accept") setNote(t.plan.accepted);
      void load();
    } catch {
      setNote(t.common.error);
    }
  };

  const today = localDay(useNow());
  return (
    <div className="space-y-4">
      <H1>{t.plan.title}</H1>
      <Small>{t.plan.lead}</Small>
      {seasonInvite && (
        <Card tone="volt">
          <Kicker tone="volt">{se.kicker}</Kicker>
          <p className="mt-2 font-display text-[17px] font-semibold">{se.emptyTitle}</p>
          <Small className="mt-1">{se.todayCard.planDetail}</Small>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="volt" onClick={() => go({ name: "season-goal" })}>
              {se.setGoal}
            </Btn>
            <Btn variant="ghost" onClick={() => go({ name: "season-sports" })}>
              {se.pickSports}
            </Btn>
          </div>
        </Card>
      )}
      {note && <Note tone="mint">{note}</Note>}
      {changes.map((c) => (
        <Card key={c.id} tone="butter">
          <Kicker tone="lilac">{t.plan.proposals}</Kicker>
          <p className="mt-2 text-[15px]">{c.summary}</p>
          <div className="mt-3 flex gap-2">
            <Btn variant="volt" onClick={() => void decide(c.id, "accept")}>
              {t.plan.accept}
            </Btn>
            <Btn variant="ghost" onClick={() => void decide(c.id, "reject")}>
              {t.plan.reject}
            </Btn>
          </div>
        </Card>
      ))}
      {state === "loading" && <p className="text-muted">{t.common.loading}</p>}
      {state === "error" && (
        <div className="space-y-2">
          <p className="text-muted">{t.common.error}</p>
          <Btn
            variant="ghost"
            onClick={() => {
              setState("loading");
              void load();
            }}
          >
            {t.common.retry}
          </Btn>
        </div>
      )}
      {state === "ok" && week && week.days.length === 0 && (
        <Card>
          <p className="text-[15px]">{t.plan.empty}</p>
          <Btn variant="ghost" className="mt-3" onClick={() => go({ name: "coach" })}>
            {t.today.coachRow}
          </Btn>
        </Card>
      )}
      {week?.days.map((d) => {
        const isToday = d.date === today;
        return (
          <Card key={`${d.date}-${d.start}`} tone={isToday ? "pulse" : undefined}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Kicker tone={isToday ? "pulse" : "faint"}>{isToday ? t.plan.today : dayLabel(d.date + "T12:00:00", lang)}</Kicker>
                <p className="mt-1 font-display text-[17px] font-semibold">{sportLabel(d.sport, lang)}</p>
                <Small>{`${timeLabel(d.start, lang)} · ${t.common.minutes.replace("{n}", String(d.minutes))}`}</Small>
              </div>
              {isToday && (
                <Btn
                  disabled={!!wk.w}
                  onClick={() => {
                    wk.start(d.sport);
                    go({ name: "workout" });
                  }}
                >
                  {t.plan.start}
                </Btn>
              )}
            </div>
          </Card>
        );
      })}
      <Note>{t.plan.calendarNote}</Note>
    </div>
  );
}
