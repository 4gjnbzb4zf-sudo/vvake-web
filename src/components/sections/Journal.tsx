"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Dictionary } from "@/i18n/dictionaries";
import { DEMO_ROUTE_PATH } from "./routeDemo";

type Kind = "workout" | "crew" | "challenge" | "clash";
type Filter = "all" | Kind;
const FILTERS: readonly Filter[] = ["all", "workout", "crew", "challenge", "clash"];

const KIND_STYLE: Record<Kind, { icon: string; ring: string }> = {
  workout: { icon: "🏃", ring: "border-pulse-fg/40" },
  crew: { icon: "👥", ring: "border-lilac-fg/50" },
  challenge: { icon: "🎯", ring: "border-butter-fg/40" },
  clash: { icon: "⚔️", ring: "border-volt-fg/40" },
};

/** Deterministic 12-week heatmap (84 days) for the showcase: rest days included, a busier recent month. */
const HEAT: readonly number[] = Array.from({ length: 84 }, (_, i) => {
  const weekday = i % 7;
  if (weekday === 2 || weekday === 6) return 0; // planned rest days
  const wave = Math.sin(i * 1.7) + Math.sin(i * 0.45) + i / 40;
  return wave < -0.4 ? 0 : wave < 0.3 ? 1 : wave < 1 ? 2 : wave < 1.6 ? 3 : 4;
});
const HEAT_COLORS = ["bg-line", "bg-pulse/25", "bg-pulse/50", "bg-pulse/80", "bg-volt"] as const;

export function Journal({ dict }: { dict: Dictionary["journal"] }) {
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.35fr]">
      <div className="space-y-4">
        <div className="rounded-3xl border border-line bg-surface/70 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.heatmap}</p>
            <p className="font-mono text-[0.65rem] text-faint">{dict.example}</p>
          </div>
          <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label={dict.heatmap}>
            {HEAT.map((level, i) => (
              <span key={i} className={`aspect-square rounded-[3px] ${HEAT_COLORS[level]}`} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[0.6rem] text-faint">
            {dict.less}
            {HEAT_COLORS.map((c) => (
              <span key={c} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
            ))}
            {dict.more}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dict.summary.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface/60 p-3">
              <dt className="font-mono text-[0.6rem] tracking-[0.14em] text-faint uppercase">{s.label}</dt>
              <dd className="font-display text-xl font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-3xl border border-calm-fg/40 bg-calm/10 p-5">
          <p className="font-mono text-[0.7rem] tracking-[0.16em] text-calm-fg uppercase">📅 {dict.onThisDay.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-text">{dict.onThisDay.text}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface/40 p-4 sm:p-5">
        <div role="toolbar" aria-label={dict.kicker} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-xl border px-3.5 py-2 text-sm transition-colors",
                filter === f ? "border-pulse-fg bg-pulse/15 text-text" : "border-line bg-night text-muted hover:text-text",
              )}
            >
              {f !== "all" && <span aria-hidden="true">{KIND_STYLE[f].icon} </span>}
              {dict.filters[f]}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-6" aria-live="polite">
          {dict.months.map((month) => {
            const visible = month.items.filter((it) => filter === "all" || it.kind === filter);
            if (visible.length === 0) return null;
            return (
              <section key={month.name}>
                <h4 className="sticky top-16 z-10 bg-night/80 py-1 font-display text-sm font-semibold text-muted backdrop-blur">
                  {month.name}
                </h4>
                <ul className="mt-2 space-y-2">
                  {visible.map((it) => {
                    const style = KIND_STYLE[it.kind as Kind];
                    return (
                      <li
                        key={`${month.name}-${it.date}`}
                        className={`flex items-center gap-3 rounded-2xl border ${style.ring} bg-surface p-3 transition-transform duration-200 hover:-translate-y-0.5`}
                      >
                        <span className="w-12 shrink-0 text-center font-mono text-[0.65rem] leading-tight text-faint">{it.date}</span>
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-night-2 text-lg"
                        >
                          {style.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-semibold">{it.title}</p>
                          <p className="truncate text-xs text-muted">{it.meta}</p>
                        </div>
                        {it.kind === "workout" && it.title.length > 0 && it.meta.includes("km") && (
                          <svg viewBox="0 0 320 180" className="hidden h-10 w-16 shrink-0 sm:block" aria-hidden="true">
                            <path
                              d={DEMO_ROUTE_PATH}
                              fill="none"
                              stroke="#ff3d6e"
                              strokeWidth="10"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {it.badge && (
                          <span className="shrink-0 rounded-full border border-volt-fg/40 bg-volt/10 px-2 py-0.5 font-mono text-[0.6rem] text-volt-fg">
                            🏅 {it.badge}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
