"use client";

import { useParams } from "next/navigation";
import { useCurrency } from "@/components/ui/Money";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { brandName } from "@/lib/brands";
import { exampleAmount, formatMoney } from "@/lib/currency";
import { monthlyInvestPlan } from "@/lib/pulse";

const BAR = { pairs: "bg-mint", side: "bg-butter", home: "bg-sky" } as const;
/** Example month: budget 20, goal reached, city won the clash; side pocket and home tilt at 10%. */
const PLAN = monthlyInvestPlan(
  {
    monthlyBudget: 20,
    monthlyGoalSessions: 12,
    sidePocket: { asset: { symbol: "BTC", kind: "crypto" }, pct: 0.1 },
    homeTilt: { asset: { symbol: "COLM", kind: "stock" }, pct: 0.1 },
  },
  { sessions: { runner: 8, yogi: 4 }, cityWonClash: true },
);

/** Plus + Invest: the subscription and the player's own invest plan, set up together (ADR-0019). */
export function PlusInvest({ dict }: { dict: Dictionary["plus"]["invest"] }) {
  const currency = useCurrency();
  const { lang } = useParams<{ lang: string }>();
  // Scale the USD example to a round local budget, keeping proportions.
  const scale = exampleAmount(20, currency) / 20;
  const fmt = (usd: number) => formatMoney(Math.round(usd * scale * 100) / 100, currency, lang ?? "en");

  return (
    <div className="mt-6 rounded-3xl border border-mint-fg/40 bg-gradient-to-br from-mint/10 via-transparent to-volt/10 p-6 sm:p-8">
      <p className="font-mono text-xs tracking-[0.18em] text-mint-fg uppercase">{dict.kicker}</p>
      <h3 className="mt-2 font-display text-2xl font-semibold">{dict.title}</h3>
      <p className="mt-2 max-w-3xl leading-relaxed text-muted">{dict.body}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <ul className="grid gap-3 sm:grid-cols-2">
          {dict.rules.map((r) => (
            <li key={r.title} className="flex gap-3 rounded-2xl border border-line bg-night/60 p-4">
              <span aria-hidden="true" className="text-2xl">
                {r.icon}
              </span>
              <div>
                <p className="font-display font-semibold">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-line bg-night/60 p-5">
          <p className="font-mono text-[0.7rem] text-faint">{format(dict.example, { budget: fmt(20) })}</p>
          <ul className="mt-4 space-y-3">
            {PLAN.buys.map((b) => (
              <li key={`${b.why}-${b.asset.symbol}`}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">
                    {brandName(b.asset.symbol)} <span className="font-mono text-xs text-faint">{b.asset.symbol}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {fmt(b.amount)} · {dict.why[b.why]}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full ${BAR[b.why]}`} style={{ width: `${(b.amount / 20) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-xs text-faint">{format(dict.cash, { money: fmt(PLAN.keptAsCash) })}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.note}</p>
    </div>
  );
}
