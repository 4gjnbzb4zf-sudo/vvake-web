"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Week } from "@/lib/webapp/api";
import { localTz } from "@/lib/webapp/api";
import { clock, distance, greetingKey, localDay, timeLabel } from "@/lib/webapp/format";
import { sportLabel } from "@/lib/webapp/workout";
import { weekPoints } from "@/lib/webapp/points";
import { countdown } from "@/lib/webapp/season";
import { cameraSport } from "@/lib/webapp/camera/webSetup";
import { todayNextAction, type TailorProfile } from "@/lib/webapp/tailor/tailor";
import { getTailorDict } from "@/i18n/tailor";
import { useApp } from "./AppContext";
import { SkippedCard } from "./PlanEdit";
import { HabitsToday } from "./HabitsToday";
import { ComebackCard } from "./Journey";
import { VVakerImg } from "./MyVVaker";
import { useSeason } from "./useSeason";
import { useWorkout } from "./WorkoutContext";
import { ProgressLine } from "./ProgressScreen";
import { plannedOf } from "@/lib/webapp/adaptive/workoutAdaptive";
import { EntryChoice } from "./WorkoutScreen";
import { Btn, Card, Kicker, Small } from "./ui";
import { useNow } from "./useNow";

const DAY_MS = 86_400_000;

/**
 * Today with "Your VVake" on (ADR-0059, lean doc §5): results and one next action, at most four cards. 1. Next: the
 * day's one action (todayNextAction: the planned session, a one-tap start of the last sport, the camera, the daily
 * move, Train now, or a rest day) with at most one text link. 2. This week: sessions, streak, VV points. 3. One result:
 * the last session (24 h) or the next season goal (Plan). 4. The one thing waiting: habits (Habits) or a skipped
 * session (Plan). Then a single All features link. Everything else moved to its tab or All features, nothing removed.
 */
export function TodayLean() {
  const app = useApp();
  const { t, lang, me, streak, stats, go, sessions, api, queue, flush, fmt, profile, prefs } = app;
  const p = profile as TailorProfile;
  const x = getTailorDict(lang).today;
  const wk = useWorkout();
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
  const restDay = !planned && !!week?.days.length;
  const picked = todayNextAction(p, { planned: !!planned, restDay });
  // Show on Home (build 54): GPS & sensor workouts hidden make the camera the day's action (not on a rest day).
  const action = !app.ways.gps && picked !== "rest_day" ? "camera_workout" : picked;
  const days = streak?.days ?? stats?.streakDays ?? 0;
  const vv = useMemo(() => weekPoints(sessions, now), [sessions, now]);
  const pending = queue.filter((q) => q.userId === me.id).length;
  const { season } = useSeason(undefined, p.features.plan);
  const goal = p.features.plan && season?.plan ? (season.goals[0] ?? null) : null;
  const last = sessions[0] && now - Date.parse(sessions[0].endedAt) < DAY_MS ? sessions[0] : null;
  const lastSport = sessions[0]?.sport ?? p.sports[0] ?? null;
  const busy = !!wk.w;

  const startSport = (sport: string) => {
    // A sport the camera counts asks "With the camera" or "Heart only" first (as on the full Today).
    if (cameraSport(sport)) return setAsking(sport);
    // The season's session for today (ADR-0069): run adaptively when it is the one planned.
    const sx = planned && planned.sport === sport ? season?.today.find((x) => x.sport === sport) : undefined;
    const plan = sx ? plannedOf(sx) : undefined;
    wk.start(sport, plan ? { ...plan, health: season?.health } : undefined);
    go({ name: "workout" });
  };
  const pickAnother = (
    <button
      type="button"
      className="mt-3 min-h-11 text-sm font-semibold text-sky-fg"
      onClick={() => go({ name: "workout" })}
      disabled={busy}
    >
      {x.pickAnother}
    </button>
  );
  // Camera & trainings on: the camera workout one tap from Today, under the day's action (not when it is the action,
  // not on a rest day). Plain navigation, not a suggestion: Quiet keeps it (build 54).
  const cameraLink =
    app.ways.camera && app.ways.gps ? (
      <button
        type="button"
        className="mt-1 block min-h-11 text-sm font-semibold text-volt-fg"
        onClick={() => go({ name: "camera" })}
        disabled={busy}
      >
        {t.camera.todayButton}
      </button>
    ) : null;

  let next: ReactNode;
  if (wk.w && !wk.summary)
    next = (
      <>
        <Kicker tone="pulse">{t.today.resume}</Kicker>
        <Btn big className="mt-3 w-full" onClick={() => go({ name: "workout" })}>
          {t.today.resumeOpen}
        </Btn>
      </>
    );
  else if (action === "planned_session" && planned)
    next = (
      <>
        <Kicker tone="volt">{x.next}</Kicker>
        <p className="mt-2 font-display text-lg font-semibold">
          {fmt(t.today.planned, {
            sport: sportLabel(planned.sport, lang),
            minutes: planned.minutes,
            start: timeLabel(planned.start, lang),
          })}
        </p>
        <Btn big className="mt-3 w-full" disabled={busy} onClick={() => startSport(planned.sport)}>
          {`${t.today.trainNow} · ${sportLabel(planned.sport, lang)}`}
        </Btn>
        {pickAnother}
        {cameraLink}
      </>
    );
  else if (action === "rest_day")
    next = (
      <>
        <Kicker tone="mint">{x.next}</Kicker>
        <p className="mt-2 font-display text-lg font-semibold">{x.rest}</p>
        <button
          type="button"
          className="mt-3 min-h-11 text-sm font-semibold text-sky-fg"
          onClick={() => go({ name: "workout" })}
          disabled={busy}
        >
          {x.trainAnyway}
        </button>
      </>
    );
  else {
    const one =
      action === "quick_start" && lastSport
        ? { label: fmt(x.quick, { sport: sportLabel(lastSport, lang) }), run: () => startSport(lastSport) }
        : action === "camera_workout"
          ? { label: x.camera, run: () => go({ name: "camera" }) }
          : action === "daily_move"
            ? {
                label: x.dailyMove,
                run: () => {
                  wk.start("walk");
                  go({ name: "workout" });
                },
              }
            : null;
    next = (
      <>
        <Kicker tone="volt">{x.next}</Kicker>
        <Btn big className="mt-3 w-full" disabled={busy} onClick={one ? one.run : () => go({ name: "workout" })}>
          {one ? one.label : t.today.trainNow}
        </Btn>
        {one && pickAnother}
        {action !== "camera_workout" && cameraLink}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <Kicker>{t.today.greeting[greetingKey(new Date(now).getHours())]}</Kicker>
          <h1 className="mt-1 font-display text-[22px] leading-tight font-bold">
            {me.name ? fmt(t.today.hello, { name: me.name }) : t.today.helloNoName}
          </h1>
        </div>
        <span className="font-display text-lg font-bold" aria-label={fmt(t.today.streak, { n: days })}>
          <span aria-hidden>🔥</span> {days}
        </span>
        <button type="button" onClick={() => go({ name: "you" })} aria-label={t.tabs.you} className="shrink-0">
          <VVakerImg alt="" className="h-16 w-11" />
        </button>
      </header>
      {!wk.w && <ComebackCard />}
      {/* How ready you are today (ADR-0069): one line, Your progress a tap away. */}
      {!wk.w && <ProgressLine />}

      {/* 1. Next: the one action. */}
      <Card>
        {next}
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

      {/* Show on Home (build 54): one tap each, never both hidden; only while the camera feature is on. */}
      {p.features.camera && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={x.showOnHome}>
          <span className="text-sm text-muted">{x.showOnHome}</span>
          {(["gps", "camera"] as const).map((w) => {
            const on = app.ways[w];
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                disabled={on && !app.canHideWay(w)}
                onClick={() => app.setWay(w, !on)}
                className={`min-h-9 rounded-full border px-3 text-sm font-semibold disabled:opacity-60 ${on ? "border-volt-fg text-volt-fg" : "border-line text-muted"}`}
              >
                {w === "gps" ? x.waysGps : x.waysCamera}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. This week: three numbers. */}
      <button type="button" className="block w-full text-left" onClick={() => go({ name: "points" })}>
        <Card>
          <Kicker>{x.week}</Kicker>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            {(
              [
                [stats?.week.sessions ?? 0, x.sessions],
                [days, x.streak],
                [vv.points, x.points],
              ] as const
            ).map(([n, label]) => (
              <div key={label} className="rounded-xl bg-surface-2 p-2">
                <dd className="font-display text-xl font-bold tabular-nums">{n}</dd>
                <dt className="text-[11px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </Card>
      </button>
      {pending > 0 && (
        <button type="button" className="min-h-11 text-sm text-butter-fg underline" onClick={() => void flush()}>
          {fmt(t.today.upload, { n: pending })}
        </button>
      )}

      {/* 3. One result: the last session (a day), else the season goal (Plan). */}
      {last ? (
        <button type="button" className="block w-full text-left" onClick={() => go({ name: "session", id: last.id })}>
          <Card>
            <Kicker tone="sky">{x.last}</Kicker>
            <p className="mt-1 font-display text-lg font-semibold">
              {`${sportLabel(last.sport, lang)} · ${clock(last.activeS)}${last.distanceM ? ` · ${distance(last.distanceM, prefs.units, lang)}` : ""}`}
            </p>
          </Card>
        </button>
      ) : goal ? (
        <button type="button" className="block w-full text-left" onClick={() => go({ name: "season" })}>
          <Card tone="volt">
            <p className="font-display text-lg font-semibold">{fmt(x.goal, { name: goal.name, days: countdown(goal.days, lang) })}</p>
          </Card>
        </button>
      ) : sessions.length === 0 ? (
        <Small>{x.first}</Small>
      ) : null}

      {/* 4. The one thing waiting for an answer. */}
      {p.habits.rhythm ? <HabitsToday /> : p.features.plan ? <SkippedCard /> : null}

      <p className="pt-2 text-center">
        <button type="button" className="min-h-11 text-sm font-semibold text-sky-fg" onClick={() => go({ name: "features" })}>
          {x.allFeatures} ›
        </button>
      </p>
    </div>
  );
}
