"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { connectWallet, injectedWallet, walletErrorCode } from "@/lib/chain";
import { formatUnits } from "@/lib/eth";
import { findOgEntry, isPinnedList, ogOnChain, parseOgList, type OgList } from "@/lib/ogClaim";
import { ADDRESS, explorerAddress, explorerTx, holdersDropConfig, ogClaimConfig, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { cn } from "@/lib/cn";
import paidTxs from "../../../public/og-drop/og-drop-paid.json";

type Dict = Dictionary["ogClaim"];

const PAID_TX: Record<string, string> = Object.fromEntries(
  Object.entries(paidTxs as Record<string, string>).map(([a, h]) => [a.toLowerCase(), h]),
);

type ListState = "idle" | "loading" | "ok" | "error" | "mismatch";

/** Loads a published list and checks it against its pinned root and total (every proof, in the browser). */
async function loadList(url: string, root: string, total: string): Promise<{ list: OgList } | { state: "error" | "mismatch" }> {
  try {
    const r = await fetch(url);
    if (!r.ok) return { state: "error" };
    const parsed = parseOgList(await r.json());
    if (!parsed) return { state: "error" };
    if (!isPinnedList(parsed, root, total)) return { state: "mismatch" };
    return { list: parsed };
  } catch {
    return { state: "error" };
  }
}

const linkClass = "font-mono text-text underline underline-offset-4 hover:text-pulse-fg";

/**
 * vvake.com/rewards#og: the two $VVAKE v2 drops for the v1 holders. Nothing to claim: the team pushes every claim
 * (VVakeOGClaim pays the listed wallet whoever sends it) and pays the gas.
 * Drop 1 (74 v1 buyers) is paid; drop 2 (3,199 free v1 holders) reads "being sent" until
 * `holdersDropConfig.status` is "sent". The lookup checks an address on both lists (read-only, no transaction).
 */
export function OgClaim({ dict, lang }: { dict: Dict; lang: Locale }) {
  const [lists, setLists] = useState<{ og: OgList; holders: OgList } | null>(null);
  const [listState, setListState] = useState<ListState>("idle");
  const [account, setAccount] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [d2, setD2] = useState<{ totalClaimed: bigint; claimed: boolean | null } | null>(null);

  const amountText = (wei: bigint) => formatUnits(wei, rewardsConfig.decimals, 2, lang);
  const dateText = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${ogClaimConfig.paidAt}T12:00:00Z`),
  );
  const subject = account ?? checked;
  const sent = holdersDropConfig.status === "sent";

  // The lists are fetched on the first lookup (drop 2's is 3.4 MB), from the event handlers.
  function ensureLists() {
    if (listState !== "idle" && listState !== "error") return;
    setListState("loading");
    void Promise.all([
      loadList(ogClaimConfig.listUrl, ogClaimConfig.root, ogClaimConfig.total),
      loadList(holdersDropConfig.listUrl, holdersDropConfig.root, holdersDropConfig.total),
    ]).then(([og, holders]) => {
      if ("list" in og && "list" in holders) {
        setLists({ og: og.list, holders: holders.list });
        setListState("ok");
      } else
        setListState(
          ("state" in og && og.state === "mismatch") || ("state" in holders && holders.state === "mismatch") ? "mismatch" : "error",
        );
    });
  }

  // Drop 2 on chain: Σ sent so far, and whether `subject` is paid.
  useEffect(() => {
    let live = true;
    ogOnChain(holdersDropConfig.address, subject)
      .then((s) => live && setD2({ totalClaimed: s.totalClaimed, claimed: s.claimed }))
      .catch(() => live && setD2(null));
    return () => {
      live = false;
    };
  }, [subject]);

  async function connect() {
    const w = injectedWallet();
    if (!w) {
      setMsg(dict.noWallet);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      setAccount(await connectWallet(w));
      ensureLists();
    } catch (e) {
      setMsg(walletErrorCode(e) === 4001 ? null : dict.noWallet);
    } finally {
      setBusy(false);
    }
  }

  function check(e: FormEvent) {
    e.preventDefault();
    const a = input.trim();
    if (!ADDRESS.test(a)) {
      setMsg(dict.badAddress);
      return;
    }
    setMsg(null);
    setAccount(null);
    setChecked(a);
    ensureLists();
  }

  const f1 = lists && subject ? findOgEntry(lists.og, subject) : null;
  const f2 = lists && subject ? findOgEntry(lists.holders, subject) : null;
  const tx1 = f1 ? PAID_TX[f1.address.toLowerCase()] : undefined;
  const [txBefore, txRest] = dict.drop1.txs.replace("{count}", String(ogClaimConfig.txCount)).split("{first}");
  const [txMiddle, txAfter] = (txRest ?? "").split("{last}");

  return (
    <Section id="og" kicker={dict.kicker} title={dict.title} lead={dict.lead} nav={dict.nav}>
      <p className="mt-8 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{dict.testnet}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface/60 p-6">
          <p className="font-mono text-xs text-pulse-fg">{dict.drop1.kicker}</p>
          <h3 className="mt-2 font-display text-lg font-semibold">{dict.drop1.title}</h3>
          <p className="mt-3 text-sm font-semibold text-mint-fg">{format(dict.drop1.status, { date: dateText })}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{dict.drop1.body}</p>
          <p className="mt-3 text-sm text-muted">
            {dict.contract}:{" "}
            <a href={explorerAddress(ogClaimConfig.address!)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortHex(ogClaimConfig.address!)}
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            {txBefore}
            <a href={explorerTx(ogClaimConfig.firstTx)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortHex(ogClaimConfig.firstTx, 10, 6)}
            </a>
            {txMiddle}
            <a href={explorerTx(ogClaimConfig.lastTx)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortHex(ogClaimConfig.lastTx, 10, 6)}
            </a>
            {txAfter}
          </p>
          <a
            href={ogClaimConfig.paidCsvUrl}
            className="mt-3 inline-block text-sm text-text underline underline-offset-4 hover:text-pulse-fg"
          >
            {dict.drop1.paidCsv}
          </a>
        </article>

        <article className="rounded-2xl border border-line bg-surface/60 p-6">
          <p className="font-mono text-xs text-pulse-fg">{dict.drop2.kicker}</p>
          <h3 className="mt-2 font-display text-lg font-semibold">{dict.drop2.title}</h3>
          <p className={cn("mt-3 text-sm font-semibold", sent ? "text-mint-fg" : "text-text")}>
            {sent ? dict.drop2.sent : dict.drop2.sending}
          </p>
          {d2 && (
            <p className="mt-2 text-sm text-muted">
              {format(dict.drop2.progress, { claimed: amountText(d2.totalClaimed), total: amountText(BigInt(holdersDropConfig.total)) })}
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            {dict.drop2.why.map((w) => (
              <li key={w}>
                <span className="mr-2 text-volt-fg">→</span>
                {w}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            {format(dict.drop2.reserve, { reserve: new Intl.NumberFormat(lang).format(holdersDropConfig.reserveLeft) })}
          </p>
          <p className="mt-3 text-sm text-muted">
            {dict.contract}:{" "}
            <a href={explorerAddress(holdersDropConfig.address)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortHex(holdersDropConfig.address)}
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            {dict.drop2.fundingTx}:{" "}
            <a href={explorerTx(holdersDropConfig.fundingTx)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {shortHex(holdersDropConfig.fundingTx, 10, 6)}
            </a>
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a href={holdersDropConfig.csvUrl} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {dict.drop2.csv}
            </a>
            <a href={holdersDropConfig.listUrl} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {dict.drop2.json}
            </a>
          </p>
        </article>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface/40 p-6">
        <h3 className="font-display text-lg font-semibold">{dict.checkTitle}</h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!account ? (
            <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={() => void connect()}>
              {dict.connect}
            </button>
          ) : (
            <p className="font-mono text-sm text-text">{format(dict.connected, { address: shortHex(account) })}</p>
          )}
        </div>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={check}>
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-muted">
            {dict.checkLabel}
            <input
              className={cn(inputClass, "font-mono")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button type="submit" className={buttonClass("primary")}>
            {dict.check}
          </button>
        </form>

        {listState === "loading" && <p className="mt-6 text-sm text-muted">{dict.loading}</p>}
        {listState === "error" && <p className="mt-6 text-sm text-pulse-fg">{dict.listError}</p>}
        {listState === "mismatch" && <p className="mt-6 text-sm text-pulse-fg">{dict.badList}</p>}

        {lists && subject && (
          <div className="mt-6 space-y-2 rounded-xl border border-line bg-surface-2/60 p-4 text-sm" aria-live="polite">
            {f1 ? (
              <p className="text-mint-fg">
                {format(dict.d1Paid, { address: shortHex(f1.address), amount: amountText(BigInt(f1.entry.amount)) })}{" "}
                {tx1 && (
                  <a href={explorerTx(tx1)} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {dict.tx} {shortHex(tx1, 10, 6)}
                  </a>
                )}
              </p>
            ) : (
              <p className="text-muted">{dict.d1Not}</p>
            )}
            {f2 ? (
              sent || d2?.claimed ? (
                <p className="text-mint-fg">
                  {format(dict.d2Paid, { address: shortHex(f2.address), amount: amountText(BigInt(f2.entry.amount)) })}
                </p>
              ) : (
                <p className="text-text">
                  {format(dict.d2Sending, { address: shortHex(f2.address), amount: amountText(BigInt(f2.entry.amount)) })}
                </p>
              )
            ) : (
              <p className="text-muted">{dict.d2Not}</p>
            )}
          </div>
        )}
        {msg && (
          <p className="mt-4 text-sm text-pulse-fg" role="alert">
            {msg}
          </p>
        )}
        <a href={`/${lang}/og/`} className="mt-5 inline-block text-sm text-text underline underline-offset-4 hover:text-pulse-fg">
          {dict.list}
        </a>
        <p className="mt-4 text-xs text-faint">{dict.scam}</p>
      </div>
    </Section>
  );
}
