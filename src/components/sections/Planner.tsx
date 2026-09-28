"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { placeSessions, toIcs } from "@/lib/calendar";
import { planWeeks, type PlanGoal, type PlannedSession, type SessionIntensity, type Weekday } from "@/lib/plan";

type SportKey = keyof Dictionary["multisport"]["sports"];

const GOALS: readonly PlanGoal[] = ["start", "consistency", "endurance", "strength", "calm", "event"];
const SPORTS: readonly SportKey[] = [
  "runner",
  "walker",
  "cyclist",
  "lifter",
  "yogi",
  "boxer",
  "martial",
  "paddler",
  "baller",
  "roller",
  "skater",
  "meditator",
];
const EMOJI: Record<string, string> = {
  runner: "🏃",
  walker: "🚶",
  cyclist: "🚴",
  lifter: "🏋️",
  yogi: "🧘‍♀️",
  boxer: "🥊",
  martial: "🥋",
  paddler: "🛶",
  baller: "⛹️",
  meditator: "🧘",
  roller: "🛼",
  skater: "⛸️",
  coder: "💻",
};
const INTENSITY: Record<SessionIntensity, string> = {
  easy: "border-mint/50 bg-mint/10",
  moderate: "border-sky/50 bg-sky/10",
  hard: "border-pulse/60 bg-pulse/15",
  mindful: "border-calm/50 bg-calm/10",
};
const DOT: Record<SessionIntensity, string> = { easy: "bg-mint", moderate: "bg-sky", hard: "bg-pulse", mindful: "bg-calm" };
const DONE_RATES = [1, 0.7, 0.4] as const;
const WEEK: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        on ? "border-volt bg-volt text-night" : "border-line text-muted hover:border-volt/50 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function SessionCard({ s, dict, sportName }: { s: PlannedSession; dict: Dictionary["plan"]; sportName: string }) {
  return (
    <div className={cn("rounded-xl border p-2 text-left", INTENSITY[s.intensity])}>
      <p className="text-lg leading-none" aria-hidden="true">
        {EMOJI[s.sport] ?? "✨"}
      </p>
      <p className="mt-1 text-xs font-semibold text-text">{sportName}</p>
      <p className="font-mono text-[0.65rem] text-muted">
        {s.durationMin} min · {dict.intensity[s.intensity]}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[0.6rem]">
        <span className={cn("rounded px-1.5 py-0.5", s.with === "crew" ? "bg-lilac text-night" : "bg-night/70 text-muted")}>
          {s.with === "crew" ? `👥 ${dict.crew}` : dict.solo}
        </span>
        {s.recurrence === "weekly" && <span className="rounded bg-night/70 px-1.5 py-0.5 text-muted">↻</span>}
        {s.long && <span className="rounded bg-butter px-1.5 py-0.5 text-night">{dict.long}</span>}
      </div>
    </div>
  );
}

/** Next Monday as a local "YYYY-MM-DD" (today if it is Monday). */
function nextMonday(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarSync({
  dict,
  sessions,
  name,
}: {
  dict: Dictionary["plan"]["calendar"];
  sessions: PlannedSession[];
  name: (s: string) => string;
}) {
  // Built in the visitor's browser only: nothing is uploaded.
  const download = () => {
    const withTimes = sessions.map((s) => (s.with === "crew" ? { ...s, start: 19 * 60 } : s));
    const ics = toIcs(placeSessions(withTimes, []), {
      weekStart: nextMonday(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      title: (s) => format(s.with === "crew" ? dict.crewEvent : dict.event, { sport: name(s.sport) }),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vvake-plan.ics";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-3xl border border-sky/40 bg-gradient-to-br from-sky/10 to-transparent p-5 sm:p-6">
      <p className="font-display text-lg font-semibold">📅 {dict.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{dict.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[dict.google, dict.microsoft].map((provider) => (
          <span
            key={provider}
            aria-disabled="true"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-night/60 px-3 py-2 text-sm text-muted"
          >
            {provider}
            <span className="rounded bg-line px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase">{dict.soon}</span>
          </span>
        ))}
        <button
          type="button"
          onClick={download}
          className="rounded-xl bg-sky px-3 py-2 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
        >
          ⬇ {dict.download}
        </button>
      </div>
      <ul className="mt-4 space-y-1 text-xs text-faint">
        {dict.privacy.map((p) => (
          <li key={p}>🔒 {p}</li>
        ))}
      </ul>
    </div>
  );
}

export function Planner({ dict, sportNames }: { dict: Dictionary["plan"]; sportNames: Dictionary["multisport"]["sports"] }) {
  const [goal, setGoal] = useState<PlanGoal>("consistency");
  const [days, setDays] = useState<Weekday[]>([0, 2, 3, 5, 6]);
  const [minutes, setMinutes] = useState(40);
  const [sports, setSports] = useState<SportKey[]>(["runner", "lifter", "yogi"]);
  const [crew, setCrew] = useState(true);
  const [recent, setRecent] = useState(90);
  const [done, setDone] = useState(0);

  const weeks = useMemo(
    () =>
      planWeeks(
        {
          goal,
          availableDays: days,
          minutesPerDay: minutes,
          sports,
          recentWeeklyMinutes: recent,
          completionRate: DONE_RATES[done],
          fixed: crew ? [{ day: 2, sport: "runner", durationMin: 45, intensity: "moderate", with: "crew", crewId: "wednesday-run" }] : [],
        },
        4,
      ),
    [goal, days, minutes, sports, recent, done, crew],
  );
  const week = weeks[0]!;
  const maxTarget = Math.max(...weeks.map((w) => w.targetMinutes), 1);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const name = (sport: string) => sportNames[sport as SportKey] ?? sport;

  return (
    <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.5fr]">
      <form className="space-y-6 rounded-3xl border border-line bg-surface/70 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()}>
        <p className="font-mono text-[0.7rem] tracking-[0.16em] text-volt uppercase">{dict.example}</p>
        <fieldset>
          <legend className="text-sm font-semibold">{dict.labels.goal}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g} on={goal === g} onClick={() => setGoal(g)}>
                {dict.goals[g]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">{dict.labels.days}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEK.map((d) => (
              <Chip key={d} on={days.includes(d)} onClick={() => setDays(toggle(days, d))}>
                {dict.weekdays[d]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-sm font-semibold">{format(dict.labels.minutes, { minutes })}</span>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-2 w-full accent-volt"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">{dict.labels.sports}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SPORTS.map((s) => (
              <Chip key={s} on={sports.includes(s)} onClick={() => setSports(toggle(sports, s))}>
                <span aria-hidden="true">{EMOJI[s]}</span> {sportNames[s]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-lilac/40 bg-lilac/10 p-3">
          <input type="checkbox" checked={crew} onChange={(e) => setCrew(e.target.checked)} className="h-4 w-4 accent-lilac" />
          <span className="text-sm">👥 {dict.labels.crew}</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">{format(dict.labels.recent, { minutes: recent })}</span>
          <input
            type="range"
            min={0}
            max={360}
            step={10}
            value={recent}
            onChange={(e) => setRecent(Number(e.target.value))}
            className="mt-2 w-full accent-volt"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">{dict.labels.done}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {dict.done.map((label, i) => (
              <Chip key={label} on={done === i} onClick={() => setDone(i)}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="space-y-4" aria-live="polite">
        <div className="rounded-3xl border border-line bg-surface/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-xl font-semibold">{dict.thisWeek}</p>
            <p className="font-mono text-sm text-volt">{format(dict.planned, { minutes: week.plannedMinutes })}</p>
          </div>
          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-7">
            {WEEK.map((d) => {
              const list = week.sessions.filter((s) => s.day === d);
              return (
                <li key={d} className="flex gap-3 sm:flex-col sm:gap-2">
                  <p className="w-10 shrink-0 pt-2 font-mono text-xs text-faint sm:w-auto sm:pt-0 sm:text-center">{dict.weekdays[d]}</p>
                  <div className="flex flex-1 flex-col gap-2">
                    {list.length ? (
                      list.map((s) => <SessionCard key={`${s.day}-${s.sport}-${s.with}`} s={s} dict={dict} sportName={name(s.sport)} />)
                    ) : (
                      <p className="rounded-xl border border-dashed border-line p-2 text-center font-mono text-[0.65rem] text-faint">
                        💤 {dict.rest}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {week.notes.map((n) => (
              <li key={n}>
                <span className="mr-2 text-volt" aria-hidden="true">
                  →
                </span>
                {dict.notes[n]}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 font-mono text-[0.65rem] text-faint">
            {(Object.keys(DOT) as SessionIntensity[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", DOT[k])} aria-hidden="true" />
                {dict.intensity[k]}
              </span>
            ))}
            <span>↻ {dict.weekly}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-line bg-surface/70 p-5">
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.nextWeeks}</p>
            <div className="mt-4 flex h-28 items-end gap-3">
              {weeks.map((w) => (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[0.65rem] text-muted tabular-nums">{w.targetMinutes}</span>
                  <div
                    className={cn(
                      "w-full rounded-t-lg transition-all duration-500",
                      w.notes.includes("deload") ? "bg-calm/60" : "bg-volt/80",
                    )}
                    style={{ height: `${(w.targetMinutes / maxTarget) * 72}px` }}
                  />
                  <span className="font-mono text-[0.65rem] text-faint">{format(dict.week, { n: w.week + 1 })}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="space-y-2 rounded-3xl border border-line bg-surface/70 p-5 text-sm text-muted">
            {dict.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-volt" aria-hidden="true">
                  ✦
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <CalendarSync dict={dict.calendar} sessions={week.sessions} name={name} />
        <p className="text-xs leading-relaxed text-faint">{dict.disclaimer}</p>
      </div>
    </div>
  );
}
