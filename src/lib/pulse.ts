// Mirrors packages/game-core/src/pulse.ts (keep in sync; shared vectors in pulse.test.ts).
/**
 * My Pulse (docs/02-product/market-pulse.md): market updates on the assets each player cares about,
 * and the Sweat & Invest signal pointed at their own picks.
 *
 * Rules (ADR-0003, C4–C6, C13, C25, C30):
 * - The player chooses. We may suggest gear brands linked to their sports; we never suggest crypto.
 * - Facts only: symbol, % move, period. No "buy/sell", no targets, no predictions, no ranking of assets.
 * - Challenges stay free and effort-scored; only the player's Brand Team opens Rally / Recover.
 * - Pushes are capped (they count toward the daily nudge cap) and never in quiet hours; the rest waits
 *   for the weekly digest.
 * - Sweat & Invest: VVake only sends "N verified workouts" to the licensed broker or regulated crypto
 *   provider the player connected; the player's money, account and rule, capped per week.
 */
import type { VVakerSport } from "@/components/vvaker/traits";

export type AssetKind = "stock" | "crypto";
export interface Asset {
  symbol: string;
  kind: AssetKind;
}

/** Listed makers of gear and wearables per sport: a starting point the player can edit, never advice. */
export const SPORT_BRANDS: Partial<Record<VVakerSport, readonly string[]>> = {
  runner: ["NKE", "ONON", "DECK"],
  walker: ["DECK", "NKE"],
  cyclist: ["GRMN", "SHMDF"],
  lifter: ["UAA", "LULU"],
  boxer: ["UAA", "NKE"],
  yogi: ["LULU"],
  baller: ["NKE", "UAA"],
  coder: ["AAPL", "GRMN"],
  paddler: ["GRMN"],
  roller: ["NKE"],
  skater: ["NKE"],
};
export const WEARABLES = ["GRMN", "AAPL"] as const;
export const MAX_WATCHLIST = 8;

/** Suggestions from the player's sports (plus their watch maker), deduplicated, stocks only. */
export function suggestWatchlist(sports: readonly VVakerSport[], watchMaker?: string): Asset[] {
  const out: string[] = [];
  for (const s of sports) for (const sym of SPORT_BRANDS[s] ?? []) if (!out.includes(sym)) out.push(sym);
  if (watchMaker && (WEARABLES as readonly string[]).includes(watchMaker) && !out.includes(watchMaker)) out.push(watchMaker);
  return out.slice(0, 5).map((symbol) => ({ symbol, kind: "stock" }));
}

/** Daily moves worth a heads-up: crypto moves more, so its bar is higher. */
export const MOVE_THRESHOLD_PCT: Record<AssetKind, number> = { stock: 3, crypto: 6 };

export interface Quote {
  symbol: string;
  kind: AssetKind;
  /** Change over the period, in percent. */
  changePct: number;
}

export type PulseSignal =
  { type: "rally" | "recover"; symbol: string; changePct: number } | { type: "move"; symbol: string; kind: AssetKind; changePct: number };

/**
 * Today's signals for one player: their Brand Team opens a free Rally (down) or Recover (up) moment;
 * other picks only produce an informational "move" when they cross the threshold. Biggest moves first.
 */
export function dailySignals(watchlist: readonly Asset[], quotes: readonly Quote[], brandTeam?: string): PulseSignal[] {
  const out: PulseSignal[] = [];
  for (const q of quotes) {
    if (!watchlist.some((a) => a.symbol === q.symbol && a.kind === q.kind)) continue;
    if (q.symbol === brandTeam && q.kind === "stock" && Math.abs(q.changePct) >= MOVE_THRESHOLD_PCT.stock) {
      out.push({ type: q.changePct < 0 ? "rally" : "recover", symbol: q.symbol, changePct: q.changePct });
    } else if (Math.abs(q.changePct) >= MOVE_THRESHOLD_PCT[q.kind]) {
      out.push({ type: "move", symbol: q.symbol, kind: q.kind, changePct: q.changePct });
    }
  }
  return out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/** At most one market push a day (the top signal), never in quiet hours; the rest goes to the digest. */
export function pushable(signals: readonly PulseSignal[], quietHour: boolean, pushesLeftToday: number): PulseSignal | null {
  if (quietHour || pushesLeftToday <= 0) return null;
  return signals[0] ?? null;
}

/** Neutral one-liner, e.g. "NKE −4.1% today". No adjectives, no advice. */
export function pulseLine(symbol: string, changePct: number, period: "today" | "this week"): string {
  const sign = changePct > 0 ? "+" : changePct < 0 ? "−" : "±";
  return `${symbol} ${sign}${Math.abs(changePct).toFixed(1)}% ${period}`;
}

export interface SweatInvestRule {
  asset: Asset;
  /** In the player's own currency, at their provider. */
  amountPerWorkout: number;
  /** Only workouts at or above this effort count. */
  minEffort: number;
  maxWorkoutsPerWeek: number;
}

/**
 * The only thing VVake sends to the provider: how many verified workouts count this week under the
 * player's rule. The amount is computed and executed by the provider on the player's account.
 */
export function sweatInvestSignal(
  weekEfforts: readonly number[],
  rule: SweatInvestRule,
): { asset: Asset; workouts: number; amount: number } {
  const workouts = Math.min(rule.maxWorkoutsPerWeek, weekEfforts.filter((e) => e >= rule.minEffort).length);
  return { asset: rule.asset, workouts, amount: workouts * rule.amountPerWorkout };
}
