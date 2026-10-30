"use client";

import { useEffect, useMemo, useState } from "react";
import type { Week } from "@/lib/webapp/api";
import { localTz } from "@/lib/webapp/api";
import { dayLabel, greetingKey, localDay, timeLabel } from "@/lib/webapp/format";
import { goalProgress } from "@/lib/webapp/goals";
import { sportLabel, streakMultiplier, MINUTES_PER_ENERGY } from "@/lib/webapp/workout";
import { getSeasonDict } from "@/i18n/season";
import { countdown } from "@/lib/webapp/season";
import { useApp } from "./AppContext";
import { Chip, ReadinessRing } from "./SeasonParts";
import { SkippedCard } from "./PlanEdit";
import { useSeason } from "./useSeason";
import { goalTitle } from "./GoalsScreen";
import { VVakerImg } from "./MyVVaker";
import { rhythmToday } from "./RhythmScreen";
import { HabitsToday } from "./HabitsToday";
import { ComebackCard } from "./Journey";
import { useWorkout } from "./WorkoutContext";
import { ProgressLine } from "./ProgressScreen";
import { EntryChoice } from "./WorkoutScreen";
import { cameraSport } from "@/lib/webapp/camera/webSetup";
import { hasPlaces } from "@/lib/webapp/places";
import { habitsDoor, weekPoints } from "@/lib/webapp/points";
import { Bar, Btn, Card, Door, Kicker, List, Pill, Row, Small } from "./ui";
import { useNow } from "./useNow";

/**
 * Today (apps/mobile app/(tabs)/index.tsx), the intent hub: train now first (today's planned session with one Start,
 * another sport, the camera), then four quick doors (Challenge, Week plan, Coach, Habits), the goals and the week.
 * Streak, energy and this week's VV points stay small in the header (the points pill opens You → VV points).
 */
export function TodayScreen() {
  const { t, lang, me, streak, energy, energyMax, go, goals, sessions, stats, api, queue, flush, fmt } = useApp();
  const wk = useWorkout();
  const [energyInfo, setEnergyInfo] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  useEffect(() => {
    void api
      .week(localTz(), lang)
      .then(setWeek)
      .catch(() => setWeek(null));
  }, [api, lang]);
  const now = useNow();
  const today = localDay(now);
  const planned = week?.days.find((d) => d.date === today) ?? null;
  const nextPlanned = week?.days.find((d) => Date.parse(d.end) > now) ?? null;
  const items = useMemo(
    () => sessions.map((s) => ({ sport: s.sport, startMs: Date.parse(s.startedAt), distanceM: s.distanceM ?? undefined })),
    [sessions],
  );
  const views = goals.map((g) => ({ g, p: goalProgress(g, items, now) }));
  const running = views.filter((v) => v.p.status === "active");
  const days = streak?.days ?? stats?.streakDays ?? 0;
  const mult = streak?.multiplier ?? streakMultiplier(days);
  const habits = habitsDoor(rhythmToday(me.id));
  const vv = useMemo(() => weekPoints(sessions, now), [sessions, now]);
  const pending = queue.filter((q) => q.userId === me.id).length;
  // The season (ADR-0050): today's session purpose and phase, the goals the coach works toward.
  const { season } = useSeason();
  const ss = getSeasonDict(lang);
  const seasonToday = season?.today.find((x) => x.key) ?? season?.today[0] ?? null;
  const seasonGoals = season?.plan ? season.goals : [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 pt-1">
        <span className="font-display text-xl font-bold tracking-tight">VVake</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Pill tone="pulse" label={fmt(t.today.streak, { n: days })}>
            <span aria-hidden>🔥</span>
            {days}
            {mult > 1 ? ` · ×${mult}` : ""}
          </Pill>
          <button
            type="button"
            onClick={() => setEnergyInfo((x) => !x)}
            aria-expanded={energyInfo}
            aria-label={fmt(t.today.energy, { n: Math.floor(energy.current), max: energyMax })}
          >
            <Pill tone="volt">
              <span aria-hidden>⚡</span>
              {Math.floor(energy.current)}/{energyMax}
            </Pill>
          </button>
          <button type="button" onClick={() => go({ name: "points" })} aria-label={fmt(t.today.pointsPill, { n: vv.points })}>
            <Pill tone="mint">
              <span aria-hidden>✦</span>
              {`VV ${vv.points}`}
            </Pill>
          </button>
        </div>
      </header>
      {energyInfo && (
        <Card>
          <Kicker tone="volt">{fmt(t.today.energy, { n: Math.floor(energy.current), max: energyMax })}</Kicker>
          <div className="mt-2">
            <Bar fraction={energy.current / energyMax} />
          </div>
          <Small className="mt-2">{fmt(t.today.energyInfo, { n: Math.floor(energy.current * MINUTES_PER_ENERGY) })}</Small>
        </Card>
      )}
      <SkippedCard />
      {!wk.w && <ComebackCard />}

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Kicker>
            {me.city
              ? `${t.today.greeting[greetingKey(new Date(now).getHours())]} · ${me.city}`
              : t.today.greeting[greetingKey(new Date(now).getHours())]}
          </Kicker>
          <h1 className="mt-1 font-display text-[22px] leading-tight font-bold">
            {me.name ? fmt(t.today.hello, { name: me.name }) : t.today.helloNoName}
          </h1>
        </div>
        <button type="button" onClick={() => go({ name: "vvaker" })} aria-label={t.today.vvakerRow} className="shrink-0">
          <VVakerImg alt="" className="h-16 w-11" />
        </button>
      </div>

      {wk.w && !wk.summary && (
        <Card tone="pulse">
          <Kicker tone="pulse">{t.today.resume}</Kicker>
          <Btn className="mt-3 w-full" onClick={() => go({ name: "workout" })}>
            {t.today.resumeOpen}
          </Btn>
        </Card>
      )}

      {/* How ready you are today (ADR-0069): one line, Your progress a tap away. */}
      {!wk.w && <ProgressLine />}

      {/* Train now: today's session with one Start, or another sport. */}
      <Card>
        <Kicker tone="volt">{t.today.todayPlan}</Kicker>
        <p className="mt-2 font-display text-lg font-semibold">
          {planned
            ? fmt(t.today.planned, {
                sport: sportLabel(planned.sport, lang),
                minutes: planned.minutes,
                start: timeLabel(planned.start, lang),
              })
            : week?.days.length
              ? t.today.rest
              : t.today.noPlan}
        </p>
        {season?.plan && (season.week?.label || seasonToday?.line) && (
          <div className="mt-2 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {season.week?.label && <Chip tone="sky">{season.week.label}</Chip>}
              {seasonToday?.key && <Chip tone="pulse">{ss.week.key}</Chip>}
              {seasonToday?.zone ? <Chip tone="faint">{fmt(ss.week.zone, { n: seasonToday.zone })}</Chip> : null}
            </div>
            {seasonToday?.line && <p className="text-sm">{seasonToday.line}</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {planned ? (
            <>
              <Btn
                big
                className="flex-1"
                disabled={!!wk.w}
                onClick={() => {
                  // A sport the camera counts asks "With the camera" or "Heart only" first (the phone's Today ask=1).
                  if (cameraSport(planned.sport)) return setAsking(planned.sport);
                  wk.start(planned.sport);
                  go({ name: "workout" });
                }}
              >
                {`${t.today.trainNow} · ${sportLabel(planned.sport, lang)}`}
              </Btn>
              <Btn big variant="ghost" onClick={() => go({ name: "workout" })} disabled={!!wk.w}>
                {t.today.another}
              </Btn>
            </>
          ) : (
            <Btn big className="flex-1" onClick={() => go({ name: "workout" })} disabled={!!wk.w}>
              {t.today.trainNow}
            </Btn>
          )}
        </div>
        <button
          type="button"
          className="mt-3 min-h-11 text-sm font-semibold text-sky-fg"
          onClick={() => go({ name: "camera" })}
          disabled={!!wk.w}
        >
          {t.camera.todayButton}
        </button>
        {asking && (
          <EntryChoice
            sport={asking}
            onClose={() => setAsking(null)}
            onHeart={() => {
              wk.start(asking);
              go({ name: "workout" });
            }}
          />
        )}
      </Card>

      {pending > 0 && (
        <Card tone="butter">
          <p className="text-sm text-butter-fg">{fmt(t.today.upload, { n: pending })}</p>
          <Btn variant="ghost" className="mt-2" onClick={() => void flush()}>
            {t.today.uploadNow}
          </Btn>
        </Card>
      )}

      {/* The quick doors: one tap to each intent, the same four as the phone. */}
      <nav aria-label={t.today.doors} className="grid grid-cols-2 gap-3">
        <Door
          tone="pulse"
          icon="⚑"
          title={t.today.doorChallenge}
          detail={t.today.doorChallengeDetail}
          onClick={() => go({ name: "crew" })}
        />
        <Door
          tone="sky"
          icon="▦"
          title={t.today.doorPlan}
          detail={
            nextPlanned
              ? `${dayLabel(nextPlanned.start, lang)} · ${sportLabel(nextPlanned.sport, lang)} · ${fmt(t.common.minutes, { n: nextPlanned.minutes })}`
              : t.today.doorPlanEmpty
          }
          onClick={() => go({ name: "plan" })}
        />
        <Door tone="lilac" icon="◉" title={t.today.doorCoach} detail={t.today.doorCoachDetail} onClick={() => go({ name: "coach" })} />
        <Door
          tone="mint"
          icon="💧"
          title={t.today.doorHabits}
          detail={
            habits.kind === "both"
              ? fmt(t.today.doorHabitsBoth, { glasses: habits.glasses, meals: habits.meals })
              : habits.kind === "water"
                ? fmt(t.today.doorHabitsWater, { n: habits.glasses })
                : habits.kind === "meals"
                  ? fmt(t.today.doorHabitsMeals, { n: habits.meals })
                  : t.today.doorHabitsDetail
          }
          onClick={() => go({ name: "rhythm" })}
        />
      </nav>

      {/* The season's goals: the coach toward one or several of them; or an invitation to plan one. */}
      {seasonGoals.length > 0 ? (
        <button type="button" className="block w-full text-left" onClick={() => go({ name: "season" })}>
          <Card tone="volt">
            <div className="flex items-center justify-between">
              <Kicker tone="volt">{seasonGoals.length === 1 ? ss.coachFor.one : fmt(ss.coachFor.many, { n: seasonGoals.length })}</Kicker>
              <span aria-hidden className="text-faint">
                ›
              </span>
            </div>
            <ul className="mt-2 space-y-3">
              {seasonGoals.slice(0, 3).map((g) => (
                <li key={g.goalId} className="flex items-center gap-3">
                  <ReadinessRing value={g.readiness ?? 0} size={40} label={ss.readiness} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{g.name}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5">
                      <Chip tone="volt">{fmt(ss.goalDays, { days: countdown(g.days, lang) })}</Chip>
                      {g.phaseLabel && <Chip tone="sky">{g.phaseLabel}</Chip>}
                      {g.onTrack === false && <Chip tone="butter">{ss.behind}</Chip>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Small className="mt-2">{ss.todayCard.open} ›</Small>
          </Card>
        </button>
      ) : season?.plan ? (
        <List>
          <Row tone="volt" icon="⚑" title={ss.todayCard.open} detail={ss.coachFor.free} onClick={() => go({ name: "season" })} />
        </List>
      ) : (
        <List>
          <Row tone="volt" icon="⚑" title={ss.todayCard.plan} detail={ss.todayCard.planDetail} onClick={() => go({ name: "season" })} />
        </List>
      )}

      {/* Goals at a glance (this browser's simple goals). */}
      {(views.length > 0 || seasonGoals.length === 0) && (
        <button type="button" className="block w-full text-left" onClick={() => go({ name: "goals" })}>
          <Card>
            <div className="flex items-center justify-between">
              <Kicker tone={views.length ? "volt" : "faint"}>
                {views.length
                  ? `${t.today.goalsKicker} · ${!running[0] || running[0].p.onTrack ? t.today.onTrack : t.today.push}`
                  : t.today.setGoal}
              </Kicker>
              <span aria-hidden className="text-faint">
                ›
              </span>
            </div>
            {views.length === 0 && <p className="mt-2 text-sm">{t.today.goalHint}</p>}
            <div className="mt-2 space-y-3">
              {views.slice(0, 3).map(({ g, p }) => (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-medium">{goalTitle(g, t, lang)}</span>
                    <Small>{`${p.done} / ${p.target}`}</Small>
                  </div>
                  <Bar
                    fraction={p.fraction}
                    tone={p.status === "reached" ? "mint" : p.status === "ended" || !p.onTrack ? "butter" : "volt"}
                  />
                </div>
              ))}
            </div>
            {running[0] && <Small className="mt-2">{fmt(t.today.daysLeft, { n: running[0].p.daysLeft })}</Small>}
          </Card>
        </button>
      )}

      {stats && (
        <Card>
          <Kicker>{t.today.week}</Kicker>
          <p className="mt-1 font-display text-lg font-semibold">
            {fmt(t.today.weekLine, { sessions: stats.week.sessions, minutes: stats.week.activeMin })}
          </p>
        </Card>
      )}

      {/* Today's habits, one tap each (water, meals, bedtime). */}
      <HabitsToday />

      <h2 className="pt-2 font-display text-[17px] font-semibold">{t.today.moreToday}</h2>
      <List>
        <Row
          tone="mint"
          icon="⌖"
          title={t.places.entry}
          detail={t.places.entryDetail}
          onClick={() => go(planned && hasPlaces(planned.sport) ? { name: "places", sport: planned.sport } : { name: "places" })}
        />
        <Row tone="mint" icon="♥" title={t.sensor.title} onClick={() => go({ name: "sensor" })} />
        <Row tone="volt" icon="✦" title={t.you.pointsTitle} value={vv.points} onClick={() => go({ name: "points" })} />
      </List>
    </div>
  );
}
