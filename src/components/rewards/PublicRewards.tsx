"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { poolTotals, recentPoolEvents, type DatedPoolEvent, type PoolTotals } from "@/lib/chain";
import { formatUnits } from "@/lib/eth";
import { epochOf, epochStart, explorerAddress, explorerTx, pickAddress, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { publicEpoch, type PublicEpoch } from "@/lib/rewardsApi";
import { NotDeployed } from "./RewardsAccount";

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
  const [events, setEvents] = useState<Load<{ events: DatedPoolEvent[]; complete: boolean }>>({ kind: "loading" });
  const [weeks, setWeeks] = useState<Load<PublicEpoch[]>>({ kind: "loading" });

  useEffect(() => {
    if (!pool) return;
    let live = true;
    poolTotals(pool)
      .then((value) => live && setTotals({ kind: "ready", value: { ...value, readAtMs: Date.now() } }))
      .catch(() => live && setTotals({ kind: "error" }));
    recentPoolEvents(pool, rewardsConfig.prizePoolFromBlock)
      .then((value) => live && setEvents({ kind: "ready", value }))
      .catch(() => live && setEvents({ kind: "error" }));
    return () => {
      live = false;
    };
  }, [pool]);

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
  const dateFmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const eth = (v: bigint) => formatUnits(v, 18, 4, lang);
  const vvake = (v: bigint) => formatUnits(v, rewardsConfig.decimals, 2, lang);
  const t = dict.pool;

  return (
    <>
      <Section id="pool" index={t.index} kicker={t.kicker} title={t.title} lead={t.lead}>
        <div className="mt-10">
          {!pool ? (
            <NotDeployed title={dict.notDeployed} body={t.notDeployedBody} />
          ) : totals.kind === "error" ? (
            <p className="text-muted">{t.chainError}</p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label={t.funded} value={totals.kind === "ready" ? `${eth(totals.value.funded)} ETH` : "…"} />
              <Figure label={t.converted} value={totals.kind === "ready" ? `${vvake(totals.value.bought)} VVAKE` : "…"} />
              <Figure label={t.spent} value={totals.kind === "ready" ? `${eth(totals.value.spent)} ETH` : "…"} />
              <Figure label={t.waiting} value={totals.kind === "ready" ? `${eth(totals.value.balance)} ETH` : "…"}>
                {totals.kind === "ready" &&
                  format(t.next, {
                    when: totals.value.paused
                      ? t.paused
                      : totals.value.nextBuyAt * 1000 <= totals.value.readAtMs
                        ? t.nextNow
                        : format(t.nextAt, { date: timeFmt.format(new Date(totals.value.nextBuyAt * 1000)) }),
                  })}
              </Figure>
            </dl>
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
            </>
          )}

          <h3 className="mt-12 font-display text-xl font-semibold">{t.contracts}</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <ContractRow label={t.poolContract} address={pool} missing={dict.notDeployed} />
            <ContractRow label={t.rewardsContract} address={rewardsContract} missing={dict.notDeployed} />
            <ContractRow label={t.token} address={rewardsConfig.token} missing={dict.notDeployed} />
          </ul>
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

function Figure({ label, value, children }: { label: string; value: string; children?: string | false }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <dt className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{label}</dt>
      <dd className="mt-2 font-display text-xl font-semibold tabular-nums">{value}</dd>
      {children && <dd className="mt-1 text-xs text-muted">{children}</dd>}
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
