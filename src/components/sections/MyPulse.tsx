"use client";

import { useMemo, useState } from "react";
import { MoneyText } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { dailySignals, pulseLine, type Asset, type Quote } from "@/lib/pulse";

/** Illustrative daily moves for the demo (not market data). */
const QUOTES: readonly Quote[] = [
  { symbol: "NKE", kind: "stock", changePct: -4.1 },
  { symbol: "ONON", kind: "stock", changePct: 1.2 },
  { symbol: "LULU", kind: "stock", changePct: 3.4 },
  { symbol: "GRMN", kind: "stock", changePct: -0.8 },
  { symbol: "BTC", kind: "crypto", changePct: 7.5 },
  { symbol: "ETH", kind: "crypto", changePct: -2.3 },
];
const SUGGESTED = QUOTES.filter((q) => q.kind === "stock");
const CRYPTO = QUOTES.filter((q) => q.kind === "crypto");

export function MyPulse({ dict }: { dict: Dictionary["pulse"]["mine"] }) {
  const [picked, setPicked] = useState<string[]>(["NKE", "LULU", "GRMN", "BTC"]);
  const [brandTeam, setBrandTeam] = useState("NKE");

  const watchlist: Asset[] = QUOTES.filter((q) => picked.includes(q.symbol)).map(({ symbol, kind }) => ({ symbol, kind }));
  const signals = useMemo(() => dailySignals(watchlist, QUOTES, brandTeam), [picked, brandTeam]); // eslint-disable-line react-hooks/exhaustive-deps
  const quiet = QUOTES.filter((q) => picked.includes(q.symbol) && !signals.some((s) => s.symbol === q.symbol));
  const team = picked.includes(brandTeam) ? brandTeam : null;

  const toggle = (symbol: string) => setPicked((p) => (p.includes(symbol) ? p.filter((x) => x !== symbol) : [...p, symbol]));

  const chip = (q: Quote) => {
    const on = picked.includes(q.symbol);
    const starred = team === q.symbol;
    return (
      <span key={q.symbol} className={cn("inline-flex overflow-hidden rounded-full border", on ? "border-volt" : "border-line")}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => toggle(q.symbol)}
          className={cn("px-3 py-1.5 font-mono text-xs", on ? "bg-volt text-night" : "text-muted hover:text-text")}
        >
          {q.symbol}
        </button>
        {q.kind === "stock" && on && (
          <button
            type="button"
            aria-pressed={starred}
            aria-label={`${dict.star}: ${q.symbol}`}
            title={dict.star}
            onClick={() => setBrandTeam(q.symbol)}
            className={cn(
              "border-l border-night/30 px-2 text-xs",
              starred ? "bg-pulse text-night" : "bg-volt/80 text-night/60 hover:text-night",
            )}
          >
            ★
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-3xl border border-line bg-surface/60 p-6">
        <h3 className="font-display text-xl font-semibold">{dict.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{dict.body}</p>
        <p className="mt-5 font-mono text-[0.7rem] tracking-[0.14em] text-faint uppercase">{dict.suggested}</p>
        <div className="mt-2 flex flex-wrap gap-2">{SUGGESTED.map(chip)}</div>
        <p className="mt-4 font-mono text-[0.7rem] tracking-[0.14em] text-faint uppercase">{dict.cryptoHint}</p>
        <div className="mt-2 flex flex-wrap gap-2">{CRYPTO.map(chip)}</div>
        <ul className="mt-5 space-y-1.5 text-xs text-faint">
          {dict.rules.map((r) => (
            <li key={r}>✓ {r}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-line bg-night/60 p-6" aria-live="polite">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">{dict.today}</p>
          <p className="font-mono text-[0.65rem] text-faint">{dict.demo}</p>
        </div>
        <ul className="mt-4 space-y-2">
          {signals.map((s) => {
            const line = pulseLine(s.symbol, s.changePct, "today");
            const text = format(s.type === "rally" ? dict.rally : s.type === "recover" ? dict.recover : dict.move, { line });
            return (
              <li
                key={s.symbol}
                className={cn(
                  "rounded-2xl border p-3 text-sm",
                  s.type === "rally"
                    ? "border-down/50 bg-down/10"
                    : s.type === "recover"
                      ? "border-up/50 bg-up/10"
                      : "border-line bg-surface/60",
                )}
              >
                <span className={cn("font-mono", s.changePct < 0 ? "text-down" : "text-up")}>{s.type === "move" ? "•" : "⚡"}</span> {text}
              </li>
            );
          })}
          {quiet.length > 0 && (
            <li className="rounded-2xl border border-dashed border-line p-3 text-sm text-muted">
              📬 {dict.digest}: {quiet.map((q) => pulseLine(q.symbol, q.changePct, "today").replace(" today", "")).join(" · ")}
            </li>
          )}
          {team && (
            <li className="rounded-2xl border border-mint/40 bg-mint/10 p-3 text-sm">
              📈 <MoneyText template={format(dict.invest, { symbol: team, money: "{money}" })} usd={4} />
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
