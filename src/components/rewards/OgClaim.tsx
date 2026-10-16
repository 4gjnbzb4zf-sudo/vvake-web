"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  connectWallet,
  injectedWallet,
  switchToRewardsChain,
  waitForReceipt,
  walletChainId,
  walletErrorCode,
  type Eip1193,
} from "@/lib/chain";
import { formatUnits } from "@/lib/eth";
import { findOgEntry, isPinnedList, ogOnChain, parseOgList, planOgClaim, sendOgClaim, type OgList } from "@/lib/ogClaim";
import { ADDRESS, explorerAddress, explorerTx, ogClaimConfig, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { cn } from "@/lib/cn";

type Dict = Dictionary["ogClaim"];

interface Tx {
  hash: string;
  state: "sent" | "confirmed" | "failed" | "slow";
}

/**
 * vvake.com/rewards, "OG v1 holders": the published list (public/og-drop/og-drop-claims.json), the visitor's amount,
 * and the claim from VVakeOGClaim with their own wallet. While `ogClaimConfig.address` is null the section says
 * "opens soon" and only checks addresses. The list must match the pinned root (every proof is checked in the
 * browser) or nothing is sent.
 */
export function OgClaim({ dict, lang }: { dict: Dict; lang: Locale }) {
  const contract = ogClaimConfig.address;
  const [list, setList] = useState<OgList | null>(null);
  const [listState, setListState] = useState<"loading" | "ok" | "error" | "mismatch">("loading");
  const [wallet, setWallet] = useState<Eip1193 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<Tx | null>(null);
  const [chainState, setChainState] = useState<{ deadline: number; totalClaimed: bigint; claimed: boolean | null } | null>(null);

  const amountText = (wei: bigint) => formatUnits(wei, rewardsConfig.decimals, 2, lang);
  const dateText = (unix: number) =>
    new Intl.DateTimeFormat(lang, { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(unix * 1000)) + " UTC";

  useEffect(() => {
    let live = true;
    fetch(ogClaimConfig.listUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: unknown) => {
        if (!live) return;
        const parsed = parseOgList(json);
        if (!parsed) return setListState("error");
        if (!isPinnedList(parsed)) return setListState("mismatch");
        setList(parsed);
        setListState("ok");
      })
      .catch(() => live && setListState("error"));
    return () => {
      live = false;
    };
  }, []);

  const subject = account ?? checked;

  // What the contract says (deadline, Σ claimed, whether `subject` claimed); `reads` bumps after a claim.
  const [reads, setReads] = useState(0);
  const refresh = useCallback(() => setReads((n) => n + 1), []);
  useEffect(() => {
    if (!contract) return;
    let live = true;
    ogOnChain(contract, subject)
      .then((s) => live && setChainState(s))
      .catch(() => live && setChainState(null));
    return () => {
      live = false;
    };
  }, [contract, subject, reads]);

  // The clock for open / closed, refreshed every 30 s.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function connect() {
    const w = injectedWallet();
    if (!w) {
      setMsg(dict.noWallet);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      setWallet(w);
      setAccount(await connectWallet(w));
    } catch (e) {
      setMsg(walletErrorCode(e) === 4001 ? dict.rejected : dict.error);
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
    setChecked(a);
  }

  async function claim() {
    if (!wallet || !account || !list) return;
    const plan = planOgClaim(list, account);
    if (!plan.ok) {
      setMsg(
        plan.reason === "badList"
          ? dict.badList
          : plan.reason === "notListed"
            ? format(dict.notEligible, { address: shortHex(account) })
            : dict.soon,
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if ((await walletChainId(wallet)) !== rewardsConfig.chain.id) await switchToRewardsChain(wallet);
      const hash = await sendOgClaim(wallet, account, plan.tx);
      setTx({ hash, state: "sent" });
      const ok = await waitForReceipt(hash);
      setTx({ hash, state: ok === null ? "slow" : ok ? "confirmed" : "failed" });
      refresh();
    } catch (e) {
      setMsg(walletErrorCode(e) === 4001 ? dict.rejected : dict.error);
    } finally {
      setBusy(false);
    }
  }

  const deadline = chainState?.deadline ?? (ogClaimConfig.openedAt ? ogClaimConfig.openedAt + ogClaimConfig.windowDays * 86_400 : null);
  const isOpen = Boolean(contract) && deadline !== null && now < deadline;
  const found = list && subject ? findOgEntry(list, subject) : null;

  return (
    <Section id="og" kicker={dict.kicker} title={dict.title} lead={dict.lead} nav={dict.nav}>
      <p className="mt-8 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{dict.testnet}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface/60 p-6">
          <p className="font-display text-lg font-semibold">
            {!contract
              ? dict.soon
              : isOpen
                ? format(dict.open, { date: dateText(deadline!) })
                : deadline
                  ? format(dict.closed, { date: dateText(deadline) })
                  : dict.soon}
          </p>
          <p className="mt-2 text-sm text-muted">{dict.window}</p>
          {contract && chainState && (
            <p className="mt-2 text-sm text-muted">{format(dict.progress, { claimed: amountText(chainState.totalClaimed) })}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!account ? (
              <button type="button" className={buttonClass("primary")} disabled={busy} onClick={() => void connect()}>
                {dict.connect}
              </button>
            ) : (
              <p className="font-mono text-sm text-text">{format(dict.connected, { address: shortHex(account) })}</p>
            )}
          </div>

          <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={check}>
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
            <button type="submit" className={buttonClass("ghost")}>
              {dict.check}
            </button>
          </form>

          {listState === "loading" && <p className="mt-6 text-sm text-muted">{dict.loading}</p>}
          {listState === "error" && <p className="mt-6 text-sm text-pulse-fg">{dict.listError}</p>}
          {listState === "mismatch" && <p className="mt-6 text-sm text-pulse-fg">{dict.badList}</p>}

          {list && subject && (
            <div className="mt-6 rounded-xl border border-line bg-surface-2/60 p-4" aria-live="polite">
              {found ? (
                chainState?.claimed ? (
                  <p className="text-sm text-mint-fg">{format(dict.alreadyClaimed, { address: shortHex(found.address) })}</p>
                ) : (
                  <p className="text-sm text-text">
                    {format(dict.eligible, { address: shortHex(found.address), amount: amountText(BigInt(found.entry.amount)) })}
                  </p>
                )
              ) : (
                <p className="text-sm text-muted">{format(dict.notEligible, { address: shortHex(subject) })}</p>
              )}
              {found &&
                account &&
                found.address.toLowerCase() === account.toLowerCase() &&
                isOpen &&
                !chainState?.claimed &&
                tx?.state !== "confirmed" && (
                  <button type="button" className={cn(buttonClass("primary"), "mt-4")} disabled={busy} onClick={() => void claim()}>
                    {format(dict.claim, { amount: amountText(BigInt(found.entry.amount)) })}
                  </button>
                )}
            </div>
          )}

          {tx && (
            <p className="mt-4 text-sm" aria-live="polite">
              <span className={tx.state === "failed" ? "text-pulse-fg" : tx.state === "confirmed" ? "text-mint-fg" : "text-muted"}>
                {dict[tx.state]}
              </span>{" "}
              <a href={explorerTx(tx.hash)} target="_blank" rel="noopener noreferrer" className="font-mono underline underline-offset-4">
                {shortHex(tx.hash, 10, 6)}
              </a>
            </p>
          )}
          {msg && (
            <p className="mt-4 text-sm text-pulse-fg" role="alert">
              {msg}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface/40 p-6">
          <ul className="space-y-3 text-sm leading-relaxed text-muted">
            {dict.facts.map((f) => (
              <li key={f}>
                <span className="mr-2 text-volt-fg">→</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted">
            {dict.contract}:{" "}
            {contract ? (
              <a
                href={explorerAddress(contract)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-text underline underline-offset-4"
              >
                {shortHex(contract)}
              </a>
            ) : (
              <span className="text-faint">{dict.notDeployed}</span>
            )}
          </p>
          <a href={`/${lang}/og/`} className="mt-4 inline-block text-sm text-text underline underline-offset-4 hover:text-pulse-fg">
            {dict.list}
          </a>
          <p className="mt-5 text-xs text-faint">{dict.scam}</p>
        </div>
      </div>
    </Section>
  );
}
