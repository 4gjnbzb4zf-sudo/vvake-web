"use client";

import { useState } from "react";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { sampleWeek } from "@/lib/sampleWeek";

const START: readonly boolean[] = [true, false, true, false, false, true, false];

/** A small, clearly labelled sample: pick days and minutes, optionally a lighter week. Not the real plan engine. */
export function SampleWeek({ dict }: { dict: Dictionary["home"]["sample"] }) {
  const [days, setDays] = useState(START);
  const [minutes, setMinutes] = useState(30);
  const [lighter, setLighter] = useState(false);
  const week = sampleWeek(days, minutes, lighter);
  const summary =
    week.sessions === 0
      ? dict.none
      : format(week.sessions === 1 ? dict.summaryOne : dict.summary, { sessions: week.sessions, minutes: week.total });

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <form className="space-y-7 rounded-3xl border border-line bg-surface/60 p-6 sm:p-8" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="mb-3 font-display text-sm font-semibold">{dict.days}</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {dict.dayShort.map((d, i) => (
              <label key={d} className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={days[i]}
                  onChange={() => setDays(days.map((on, j) => (j === i ? !on : on)))}
                  aria-label={dict.dayLong[i]}
                />
                <span
                  aria-hidden="true"
                  className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-line text-xs font-semibold text-muted transition-colors peer-checked:border-pulse peer-checked:bg-pulse peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-volt-fg sm:text-sm"
                >
                  {d}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <label htmlFor="sample-minutes" className="font-display text-sm font-semibold">
              {dict.minutes}
            </label>
            <output htmlFor="sample-minutes" className="font-mono text-sm text-volt-fg">
              {format(dict.min, { n: minutes })}
            </output>
          </div>
          <input
            id="sample-minutes"
            type="range"
            min={15}
            max={90}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.currentTarget.value))}
            className="w-full accent-pulse-fg"
          />
        </div>

        <div>
          <label className="flex items-center gap-3 font-display text-sm font-semibold">
            <input
              type="checkbox"
              checked={lighter}
              onChange={(e) => setLighter(e.currentTarget.checked)}
              className="h-4 w-4 accent-pulse-fg"
            />
            {dict.lighter}
          </label>
          <p className="mt-2 text-sm text-faint">{dict.lighterHint}</p>
        </div>
      </form>

      <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <p className="inline-flex rounded-full border border-volt-fg/50 px-3 py-1 font-mono text-[0.68rem] tracking-[0.15em] text-volt-fg uppercase">
          {dict.badge}
        </p>
        <p aria-live="polite" className="mt-4 font-display text-2xl font-semibold">
          {summary}
        </p>
        <ol className="mt-6 grid grid-cols-7 gap-1.5">
          {dict.dayShort.map((d, i) => (
            <li
              key={d}
              className={cn(
                "flex min-h-24 flex-col items-center justify-between rounded-xl border px-0.5 py-2 text-center",
                days[i] ? "border-pulse-fg/50 bg-pulse/10" : "border-line",
              )}
            >
              <span className="text-[11px] font-semibold text-muted sm:text-xs">{d}</span>
              <span className={cn("font-mono text-[10px] leading-tight sm:text-xs", days[i] ? "text-text" : "text-faint")}>
                <span className="sr-only">{dict.dayLong[i]}: </span>
                {days[i] ? format(dict.min, { n: week.each }) : dict.rest}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs leading-relaxed text-faint">{dict.note}</p>
      </div>
    </div>
  );
}
