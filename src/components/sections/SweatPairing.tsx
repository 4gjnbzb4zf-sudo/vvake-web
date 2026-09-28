"use client";

import { MoneyText, useCurrency } from "@/components/ui/Money";
import { SportName } from "@/lib/sportNames";
import { VVaker } from "@/components/vvaker/VVaker";
import type { VVakerSport } from "@/components/vvaker/traits";
import { exampleAmount, formatMoney } from "@/lib/currency";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { brandName } from "@/lib/brands";
import { cn } from "@/lib/cn";
import { pairedAsset, pairedSignals, projectedMonthly, withinBudget } from "@/lib/pulse";
import { useParams } from "next/navigation";
import { useState } from "react";

const SPORTS: readonly VVakerSport[] = ["runner", "yogi", "cyclist", "lifter", "baller", "swimmer"];
const COLORS = { runner: "candy", yogi: "lilac", cyclist: "slate", lifter: "butter", baller: "mint", swimmer: "sky" } as const;
/** An example week (verified sessions with their effort), paired by sport. */
const WEEK = [
  { sport: "runner", effort: 90 },
  { sport: "yogi", effort: 60 },
  { sport: "runner", effort: 75 },
  { sport: "lifter", effort: 110 },
] as const;

/** Training and investing, paired: every sport points at a stock; sessions feed the player's own rule. */
export function SweatPairing({
  dict,
  sportNames,
}: {
  dict: Dictionary["pulse"]["paired"];
  sportNames: Dictionary["multisport"]["sports"];
}) {
  const currency = useCurrency();
  const { lang } = useParams<{ lang: string }>();
  const [perWorkout, setPerWorkout] = useState<number>(1);
  const [monthly, setMonthly] = useState<number>(20);
  const fmt = (usd: number) => formatMoney(exampleAmount(usd, currency), currency, lang ?? "en");
  // Example: the budget is shared with 2 earlier weeks this month (8 sessions already counted).
  const spent = Math.min(monthly, 8 * perWorkout);
  const weekly = pairedSignals(WEEK, { amountPerWorkout: perWorkout, minEffort: 50, maxWorkoutsPerWeek: 5 });
  const { signals, left } = withinBudget(weekly, perWorkout, { monthly, spentThisMonth: spent });
  const count = signals.reduce((n, s) => n + s.workouts, 0);
  const money = fmt(count * perWorkout);
  const used = Math.min(monthly, spent + count * perWorkout);
  const pace = projectedMonthly(WEEK.length, perWorkout, monthly);

  return (
    <div className="mt-6 rounded-3xl border border-mint/40 bg-gradient-to-br from-mint/10 via-transparent to-volt/10 p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold">🤝 {dict.title}</h3>
      <p className="mt-2 max-w-3xl leading-relaxed text-muted">
        <MoneyText template={dict.body} usd={1} />
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SPORTS.map((sport) => {
          const asset = pairedAsset(sport);
          return (
            <li key={sport} className="flex flex-col items-center rounded-2xl border border-line bg-night/60 p-3 text-center">
              <VVaker sport={sport} color={COLORS[sport as keyof typeof COLORS]} className="h-24 w-auto" />
              <p className="mt-1 text-xs font-semibold">
                <SportName sport={sport} name={sportNames[sport]} />
              </p>
              <p className="my-1 font-mono text-[0.65rem] text-faint">
                {dict.session} → {fmt(perWorkout)}
              </p>
              <p className="rounded-md bg-mint px-2 py-0.5 text-xs font-semibold text-night">{asset ? brandName(asset.symbol) : ""}</p>
              <p className="mt-0.5 font-mono text-[0.6rem] text-faint">{asset?.symbol}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-night/60 p-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">{dict.budget.perWorkout}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={perWorkout === v}
                  onClick={() => setPerWorkout(v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    perWorkout === v ? "border-mint bg-mint text-night" : "border-line text-muted hover:text-text",
                  )}
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">{dict.budget.monthly}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[10, 20, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={monthly === v}
                  onClick={() => setMonthly(v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    monthly === v ? "border-mint bg-mint text-night" : "border-line text-muted hover:text-text",
                  )}
                >
                  {fmt(v)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div aria-live="polite">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">{dict.budget.thisMonth}</span>
            <span className="font-mono text-xs text-muted">
              {fmt(used)} / {fmt(monthly)}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-mint transition-all duration-500" style={{ width: `${(used / monthly) * 100}%` }} />
          </div>
          <p className="mt-3 font-mono text-xs text-mint">📈 {format(dict.week, { count, money, pairs: signals.length })}</p>
          <p className="mt-1 font-mono text-xs text-muted">{format(dict.budget.pace, { money: fmt(pace) })}</p>
          <p className="mt-1 font-mono text-xs text-faint">{format(dict.budget.left, { money: fmt(Math.max(0, left)) })}</p>
          <p className="mt-3 text-xs text-faint">{dict.budget.rule}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.partner}</p>
      <p className="mt-1 text-xs leading-relaxed text-faint">{dict.brands}</p>
    </div>
  );
}
