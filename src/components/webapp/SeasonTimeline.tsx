"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { getSeasonDict } from "@/i18n/season";
import { fmt } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import { duration, phaseTone, timeline, type SeasonPlan } from "@/lib/webapp/season";
import { useApp } from "./AppContext";
import type { Tone } from "./ui";

const FILL: Record<Tone, string> = {
  volt: "bg-volt",
  pulse: "bg-pulse",
  lilac: "bg-lilac",
  mint: "bg-mint",
  sky: "bg-sky",
  butter: "bg-butter",
  down: "bg-down",
  up: "bg-up",
  faint: "bg-faint",
};
export const phaseFill = (phase: string) => FILL[phaseTone(phase)];

/** Where a label sits on the axis: centred, but kept inside the box at both ends. */
const anchor = (at: number) => (at < 0.08 ? "translate-x-0" : at > 0.92 ? "-translate-x-full" : "-translate-x-1/2");

/**
 * The season at a glance: each week's planned time as thin bars (lighter weeks paler, this week ringed), the phases as
 * coloured bands with their names, races as flags (A, B, C), check-in tests as dots, and today as a line. Fits a 360 px
 * phone without scrolling sideways (60 weeks are 5 px each). Tap or drag across it (or use the arrow keys) to read a
 * week; the phase list under it says the same in words (dates, weeks, now).
 */
export function SeasonTimeline({ plan, compact = false }: { plan: SeasonPlan; compact?: boolean }) {
  const { lang, now } = useTimelineContext();
  const s = getSeasonDict(lang);
  const today = useMemo(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [now]);
  const t = useMemo(() => timeline(plan, today, compact ? 4 : 7), [plan, today, compact]);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? t.current;
  const week = plan.weeks[shown];
  const dateFmt = (iso: string, withYear = false) =>
    new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const monthFmt = (iso: string) => new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const phaseLabel = (p: string) => plan.phases.find((x) => x.phase === p)?.label ?? p;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * t.weeks);
    setPicked(Math.max(0, Math.min(t.weeks - 1, i)));
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setPicked(Math.max(0, Math.min(t.weeks - 1, shown + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const detail = week
    ? [
        fmt(s.weekN, { n: week.index + 1 }),
        `${phaseLabel(week.phase)} ${week.weekInPhase}/${week.phaseWeeks}`,
        dateFmt(week.start),
        week.targetMin ? duration(week.targetMin) : null,
        week.deload ? s.lighter : null,
        week.benchmark ? s.benchmark : null,
        ...week.races.map((r) => `${s.race} ${r.priority} · ${dateFmt(r.date)}`),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <figure className="min-w-0">
      <div
        role="slider"
        tabIndex={0}
        aria-label={s.plan}
        aria-valuemin={1}
        aria-valuemax={t.weeks}
        aria-valuenow={shown + 1}
        aria-valuetext={detail}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "mouse") pick(e);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setPicked(null);
        }}
        onKeyDown={keys}
        className="relative touch-pan-y rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-sky-fg"
      >
        {/* Race flags, above everything. */}
        <div className="relative h-6" aria-hidden>
          {t.races.map((r) => (
            <span
              key={`${r.goalId}-${r.date}`}
              className={cn("absolute bottom-0 flex flex-col items-center", anchor(r.at))}
              style={{ left: `${r.at * 100}%` }}
            >
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface px-1 text-[10px] leading-none font-bold text-ink",
                  r.priority === "A" ? "bg-butter" : r.priority === "B" ? "bg-candy" : "bg-faint",
                )}
              >
                {r.priority}
              </span>
            </span>
          ))}
        </div>

        {/* The volume bars, one a week. */}
        {!compact && (
          <div className="mt-1 flex h-14 items-end gap-px" aria-hidden>
            {t.bars.map((b) => (
              <span
                key={b.index}
                className={cn(
                  "min-w-0 flex-1 rounded-t-[2px]",
                  phaseFill(b.phase),
                  b.deload && "opacity-45",
                  b.current && "ring-2 ring-text ring-offset-1 ring-offset-surface",
                  b.index === shown && picked !== null && "outline outline-1 outline-text brightness-110",
                )}
                style={{ height: `${Math.max(6, b.value * 100)}%` }}
              />
            ))}
          </div>
        )}

        {/* The phases, with their names where they fit. */}
        <div className="relative mt-1 h-8" aria-hidden>
          {t.segments.map((seg) => (
            <span
              key={`${seg.phase}-${seg.from}`}
              className="absolute inset-y-0 px-px"
              style={{ left: `${seg.left * 100}%`, width: `${seg.width * 100}%` }}
            >
              <span
                className={cn(
                  "flex h-full items-center justify-center overflow-hidden rounded-md text-[11px] font-semibold whitespace-nowrap text-ink",
                  phaseFill(seg.phase),
                  !seg.current && "opacity-80",
                )}
              >
                {seg.width >= (compact ? 0.16 : 0.13) ? seg.label : ""}
              </span>
            </span>
          ))}
          {/* Check-in tests, small dots on the band. */}
          {t.benchmarks.map((b) => (
            <span
              key={b.index}
              className="absolute bottom-0.5 h-2 w-2 -translate-x-1/2 rounded-full border border-ink/60 bg-surface"
              style={{ left: `${b.at * 100}%` }}
            />
          ))}
        </div>

        {/* Today. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-5 bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-text"
          style={{ left: `${t.today * 100}%` }}
        />
        <span
          aria-hidden
          className={cn("pointer-events-none absolute top-0 text-[10px] font-bold tracking-wide text-text uppercase", anchor(t.today))}
          style={{ left: `${t.today * 100}%`, display: t.races.some((r) => Math.abs(r.at - t.today) < 0.08) ? "none" : undefined }}
        >
          {s.today}
        </span>
      </div>

      {/* The months. */}
      <div className="relative mt-1 h-4 text-[11px] text-muted" aria-hidden>
        {t.months.map((m) => (
          <span key={m.date} className={cn("absolute top-0", anchor(m.at))} style={{ left: `${m.at * 100}%` }}>
            {monthFmt(m.date)}
          </span>
        ))}
      </div>

      <figcaption className="mt-2 min-h-8 text-xs leading-4 text-muted" aria-live="polite">
        {detail}
      </figcaption>

      {!compact && (
        <>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-3 rounded-full bg-butter" />
              {s.legendRace}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full border border-text bg-surface" />
              {s.legendTest}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-0.5 rounded-full bg-text" />
              {s.legendToday}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-2 rounded-sm bg-sky opacity-45" />
              {s.lighter}
            </li>
          </ul>
          <h3 className="sr-only">{s.phaseList}</h3>
          <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
            {t.segments.map((seg) => (
              <li key={`${seg.phase}-${seg.from}`} className={cn("flex items-center gap-3 px-3 py-2", seg.current && "bg-surface-2/70")}>
                <span aria-hidden className={cn("h-3 w-3 shrink-0 rounded-sm", phaseFill(seg.phase))} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {seg.label}
                    {seg.current && <span className="ml-2 text-xs font-semibold text-volt-fg">{s.now}</span>}
                  </span>
                  <span className="block text-xs text-muted">{`${dateFmt(seg.from)} → ${dateFmt(seg.to)}`}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{fmt(s.phaseWeeks, { n: seg.weeks })}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </figure>
  );
}

function useTimelineContext() {
  const { lang } = useApp();
  // The day only matters here: read once per mount (the plan reloads when the day changes anyway).
  const [now] = useState(() => Date.now());
  return { lang, now };
}
