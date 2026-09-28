"use client";

import { MoneyText, useCurrency } from "@/components/ui/Money";
import { SportName } from "@/lib/sportNames";
import { VVaker } from "@/components/vvaker/VVaker";
import type { VVakerSport } from "@/components/vvaker/traits";
import { exampleAmount, formatMoney } from "@/lib/currency";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { pairedAsset, pairedSignals } from "@/lib/pulse";
import { useParams } from "next/navigation";

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
  const signals = pairedSignals(WEEK, { amountPerWorkout: 1, minEffort: 50, maxWorkoutsPerWeek: 5 });
  const count = signals.reduce((n, s) => n + s.workouts, 0);
  const money = formatMoney(exampleAmount(1, currency) * count, currency, lang ?? "en");

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
                {dict.session} → <MoneyText template="{money}" usd={1} />
              </p>
              <p className="rounded-md bg-mint px-2 py-0.5 font-mono text-xs font-semibold text-night">{asset?.symbol}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 inline-flex rounded-xl border border-mint/40 bg-mint/10 px-4 py-2 font-mono text-xs text-mint">
        📈 {format(dict.week, { count, money, pairs: signals.length })}
      </p>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.partner}</p>
    </div>
  );
}
