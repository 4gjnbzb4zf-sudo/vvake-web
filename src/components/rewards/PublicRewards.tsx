"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { poolTotals, prizeHoldings, recentPoolEvents, type DatedPoolEvent, type PoolTotals } from "@/lib/chain";
import { formatUnits } from "@/lib/eth";
import { epochOf, epochStart, explorerAddress, explorerTx, pickAddress, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { publicEpoch, type PublicEpoch } from "@/lib/rewardsApi";
import { NotDeployed } from "./RewardsAccount";
import { visitorDatePrefs } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/datetime";

type Dict = Dictionary["rewards"];

/** How many past weeks the public list section looks up (one GET each, 404 = not built). */
const WEEKS_SHOWN = 6;

type Load<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; value: T };

/**
 * The public half of vvake.com/rewards, no sign-in: the prize pool read straight from the chain (totals, recent
 * Funded / Bought events, next conversion, contract links) and the last weeks' public Merkle lists from the API.
 */
export function PublicRewards({ dict, lang, apiUrl }: { dict: Dict; lang: Locale; apiUrl: string }) {
  const pool = pickAddress(rewardsConfig.prizePool);
  const [totals, setTotals] = useState<Load<PoolTotals & { readAtMs: number }>>({ kind: "loading" });
  const [events, setEvents] = useState<Load<{ events: DatedPoolEvent[]; complete: boolean; readAtMs: number }>>({ kind: "loading" });
  const [weeks, setWeeks] = useState<Load<PublicEpoch[]>>({ kind: "loading" });
  const rewards = pickAddress(rewardsConfig.rewardsContract);
  const [holdings, setHoldings] = useState<Load<{ held: bigint; available: bigint; readAtMs: number }>>({ kind: "loading" });
  // Bumped by "Read the chain again": every figure is read afresh, each with its own time or its own failure.
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    if (!rewards) return;
    let live = true;
    prizeHoldings(rewards, rewardsConfig.token).then(
      (h) => live && setHoldings(h ? { kind: "ready", value: { ...h, readAtMs: Date.now() } } : { kind: "error" }),
    );
    return () => {
      live = false;
    };
  }, [rewards, readCount]);

  useEffect(() => {
    if (!pool) return;
    let live = true;
    poolTotals(pool)
      .then((value) => live && setTotals({ kind: "ready", value: { ...value, readAtMs: Date.now() } }))
      .catch(() => live && setTotals({ kind: "error" }));
    recentPoolEvents(pool, rewardsConfig.prizePoolFromBlock)
      .then((value) => live && setEvents({ kind: "ready", value: { ...value, readAtMs: Date.now() } }))
      .catch(() => live && setEvents({ kind: "error" }));
    return () => {
      live = false;
    };
  }, [pool, readCount]);

  const readAgain = () => {
    setHoldings({ kind: "loading" });
    setTotals({ kind: "loading" });
    setEvents({ kind: "loading" });
    setReadCount((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    const last = epochOf(Date.now()) - 1;
    const wanted = Array.from({ length: WEEKS_SHOWN }, (_, i) => last - i);
    // 404 = that week wasn't built (null); any other failure for every week = the API can't be reached.
    void Promise.all(wanted.map((n) => publicEpoch(apiUrl, n).catch(() => "error" as const))).then((list) => {
      if (!live) return;
      if (list.every((e) => e === "error")) setWeeks({ kind: "error" });
      else setWeeks({ kind: "ready", value: list.filter((e): e is PublicEpoch => e !== null && e !== "error") });
    });
    return () => {
      live = false;
    };
  }, [apiUrl]);

  const rewardsContract = pickAddress(rewardsConfig.rewardsContract, ...(weeks.kind === "ready" ? weeks.value.map((w) => w.contract) : []));
  // The visitor's date and time formats (browser region and clock; lib/dates.ts), the page's language.
  const dp = visitorDatePrefs(lang);
  const dateFmt = { format: (d: Date) => formatDate(d, { ...dp, timeZone: "UTC" }, "medium") };
  const timeFmt = { format: (d: Date) => formatDateTime(d, dp, "short") };
  const eth = (v: bigint) => formatUnits(v, 18, 4, lang);
  const vvake = (v: bigint) => formatUnits(v, rewardsConfig.decimals, 2, lang);
  const t = dict.pool;
  /** Each figure says when it was read, so a figure left on screen is never taken for a live one. */
  const fresh = (readAtMs: number) => format(t.readAt, { time: timeFmt.format(new Date(readAtMs)) });

  return (
    <>
      <Section id="pool" index={t.index} kicker={t.kicker} title={t.title} lead={t.lead}>
        <div className="mt-10">
          {!pool ? (
            <NotDeployed title={dict.notDeployed} body={t.notDeployedBody} />
          ) : (
            <>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rewards && (
                  <Figure
                    label={t.held}
                    state={holdings}
                    value={(h) => `${vvake(h.held)} VVAKE`}
                    note={(h) => format(t.available, { vvake: vvake(h.available) })}
                    fresh={fresh}
                    unreadable={t.unreadable}
                  />
                )}
                <Figure label={t.funded} state={totals} value={(v) => `${eth(v.funded)} ETH`} fresh={fresh} unreadable={t.unreadable} />
                <Figure
                  label={t.converted}
                  state={totals}
                  value={(v) => `${vvake(v.bought)} VVAKE`}
                  fresh={fresh}
                  unreadable={t.unreadable}
                />
                <Figure label={t.spent} state={totals} value={(v) => `${eth(v.spent)} ETH`} fresh={fresh} unreadable={t.unreadable} />
                <Figure
                  label={t.waiting}
                  state={totals}
                  value={(v) => `${eth(v.balance)} ETH`}
                  note={(v) =>
                    format(t.next, {
                      when: v.paused
                        ? t.paused
                        : v.nextBuyAt * 1000 <= v.readAtMs
                          ? t.nextNow
                          : format(t.nextAt, { date: timeFmt.format(new Date(v.nextBuyAt * 1000)) }),
                    })
                  }
                  fresh={fresh}
                  unreadable={t.unreadable}
                />
              </dl>
              <button type="button" onClick={readAgain} className="mt-4 text-sm text-muted underline underline-offset-4 hover:text-text">
                {t.readAgain}
              </button>
            </>
          )}

          {pool && (
            <>
              <h3 className="mt-12 font-display text-xl font-semibold">{t.recent}</h3>
              {events.kind === "loading" && <p className="mt-4 text-muted">{dict.loading}</p>}
              {events.kind === "error" && <p className="mt-4 text-muted">{t.chainError}</p>}
              {events.kind === "ready" && events.value.events.length === 0 && <p className="mt-4 text-muted">{t.noEvents}</p>}
              {events.kind === "ready" && events.value.events.length > 0 && (
                <ul className="mt-4 divide-y divide-line/60 rounded-2xl border border-line">
                  {events.value.events.map((e) => (
                    <li
                      key={`${e.tx}-${e.index}`}
                      className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        {e.kind === "funded"
                          ? format(t.fundedEvent, { eth: eth(e.amount) })
                          : format(t.boughtEvent, { eth: eth(e.ethIn), vvake: vvake(e.vvakeOut) })}
                      </span>
                      <a
                        href={explorerTx(e.tx)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-faint underline underline-offset-4 hover:text-text"
                      >
                        {e.time ? timeFmt.format(new Date(e.time * 1000)) : `#${e.block}`} · {shortHex(e.tx)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {events.kind === "ready" && !events.value.complete && <p className="mt-3 text-sm text-faint">{t.older}</p>}
              {events.kind === "ready" && <p className="mt-2 text-xs text-faint">{fresh(events.value.readAtMs)}</p>}
            </>
          )}

          <h3 className="mt-12 font-display text-xl font-semibold">{t.contracts}</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <ContractRow label={t.poolContract} address={pool} missing={dict.notDeployed} />
            <ContractRow label={t.rewardsContract} address={rewardsContract} missing={dict.notDeployed} />
            <ContractRow label={t.token} address={rewardsConfig.token} missing={dict.notDeployed} />
          </ul>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-faint">{t.contractsNote}</p>
        </div>
      </Section>

      <Section id="lists" index={dict.trees.index} kicker={dict.trees.kicker} title={dict.trees.title} lead={dict.trees.lead}>
        <div className="mt-10">
          {weeks.kind === "loading" && <p className="text-muted">{dict.loading}</p>}
          {weeks.kind === "error" && <p className="text-muted">{dict.apiDown}</p>}
          {weeks.kind === "ready" && weeks.value.length === 0 && <p className="text-muted">{dict.trees.none}</p>}
          {weeks.kind === "ready" && weeks.value.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {weeks.value.map((w) => (
                <li key={w.epoch} className="rounded-2xl border border-line bg-surface/60 p-5 text-sm">
                  <p className="font-display text-base font-semibold">
                    {format(dict.trees.week, { date: dateFmt.format(epochStart(w.epoch)) })}
                  </p>
                  <p className="mt-1 text-muted">
                    {format(dict.trees.claims, { count: w.claims.length })}
                    {w.total && <> · {format(dict.trees.total, { vvake: vvake(BigInt(w.total)) })}</>}
                  </p>
                  {w.root && (
                    <p className="mt-2 font-mono text-xs break-all text-faint">
                      {dict.trees.root}: {w.root}
                    </p>
                  )}
                  <a
                    href={`${apiUrl}/v1/rewards/epochs/${w.epoch}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs underline underline-offset-4 hover:text-text"
                  >
                    {dict.trees.json}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </>
  );
}

/**
 * One chain figure in its own state: "…" while it loads, "—" with "couldn't be read" when its read failed (never an
 * old value), else the value, its note and the time it was read.
 */
function Figure<T extends { readAtMs: number }>({
  label,
  state,
  value,
  note,
  fresh,
  unreadable,
}: {
  label: string;
  state: Load<T>;
  value: (v: T) => string;
  note?: (v: T) => string;
  fresh: (readAtMs: number) => string;
  unreadable: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <dt className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{label}</dt>
      <dd className="mt-2 font-display text-xl font-semibold tabular-nums">
        {state.kind === "ready" ? value(state.value) : state.kind === "error" ? "—" : "…"}
      </dd>
      {state.kind === "ready" && note && <dd className="mt-1 text-xs text-muted">{note(state.value)}</dd>}
      {state.kind === "ready" && <dd className="mt-1 text-xs text-faint">{fresh(state.value.readAtMs)}</dd>}
      {state.kind === "error" && <dd className="mt-1 text-xs text-down-fg">{unreadable}</dd>}
    </div>
  );
}

function ContractRow({ label, address, missing }: { label: string; address: string | null; missing: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-muted">{label}</span>
      {address ? (
        <a
          href={explorerAddress(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono break-all underline underline-offset-4 hover:text-text"
        >
          {address}
        </a>
      ) : (
        <span className="text-faint">{missing}</span>
      )}
    </li>
  );
}
