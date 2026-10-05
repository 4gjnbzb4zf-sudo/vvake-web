"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  connectWallet,
  injectedWallet,
  isClaimedOnChain,
  sendTransaction,
  signMessage,
  switchToRewardsChain,
  waitForReceipt,
  walletChainId,
  type Eip1193,
} from "@/lib/chain";
import { claimManyCalldata, formatUnits, utf8ToHex } from "@/lib/eth";
import { explorerAddress, explorerTx, pickAddress, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { errorKey, isAppCode, isEmailCode, RewardsSession, type RewardEpoch, type Rewards } from "@/lib/rewardsApi";
import { cn } from "@/lib/cn";

type Dict = Dictionary["rewards"];

/** A claim on its way: the tx hash and what the chain said. */
interface Tx {
  hash: string;
  state: "sent" | "confirmed" | "failed" | "slow";
}

const sameAddress = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/**
 * The signed-in part of vvake.com/rewards: sign in (e-mail code or the app's link code), your weeks, link a wallet,
 * claim. Everything that moves tokens is a transaction the visitor's own wallet shows and sends; the API only gives
 * the proof (GET /v1/rewards/proof) and keeps the wallet link (signed challenge).
 */
export function RewardsAccount({ dict, lang, apiUrl }: { dict: Dict; lang: Locale; apiUrl: string }) {
  const [session] = useState(() => new RewardsSession(apiUrl));
  const [who, setWho] = useState("");
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [data, setData] = useState<Rewards | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The visitor's wallet (injected), once they connect it.
  const [wallet, setWallet] = useState<Eip1193 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Claims sent from this page, per epoch (a claimMany marks every epoch it carries).
  const [txs, setTxs] = useState<Record<number, Tx>>({});
  const [claimedNow, setClaimedNow] = useState<Set<number>>(new Set());
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const err = (e: unknown) => dict.errors[errorKey(e)];

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await session.rewards());
      setWho(session.user?.email || session.user?.name || "VVake");
      setAuth("in");
    } catch (e) {
      if (errorKey(e) === "expired") {
        setAuth("out");
        return;
      }
      setLoadError(dict.errors[errorKey(e)]);
    }
  }, [session, dict.errors]);

  // Back from a reload: a refresh token in this tab signs you in again.
  useEffect(() => {
    let live = true;
    const id = window.setTimeout(() => {
      if (!RewardsSession.hasStored()) {
        setAuth("out");
        return;
      }
      void load().then(() => live && setAuth((a) => (a === "checking" ? "out" : a)));
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [load]);

  // Follow account / network changes in the wallet.
  useEffect(() => {
    if (!wallet?.on) return;
    const onAccounts = (...args: unknown[]) => setAccount(((args[0] as string[] | undefined) ?? [])[0] ?? null);
    const onChain = (...args: unknown[]) => setChainId(Number(BigInt(String(args[0]))));
    wallet.on("accountsChanged", onAccounts);
    wallet.on("chainChanged", onChain);
    return () => {
      wallet.removeListener?.("accountsChanged", onAccounts);
      wallet.removeListener?.("chainChanged", onChain);
    };
  }, [wallet]);

  const contract = pickAddress(rewardsConfig.rewardsContract, data?.contract);

  // The API reads claims from the chain a few at a time (cached): check the open weeks ourselves too.
  useEffect(() => {
    if (!contract || !data?.epochs) return;
    let live = true;
    const open = data.epochs.filter((e) => e.status === "claimable").slice(0, 12);
    void Promise.all(open.map(async (e) => ((await isClaimedOnChain(contract, e.epoch, e.address)) ? e.epoch : null))).then((done) => {
      if (!live) return;
      const set = new Set(done.filter((n): n is number => n !== null));
      if (set.size) setClaimedNow((prev) => new Set([...prev, ...set]));
    });
    return () => {
      live = false;
    };
  }, [contract, data]);

  async function connect() {
    const w = injectedWallet();
    if (!w) {
      setWalletMsg(dict.wallet.noWallet);
      return;
    }
    setBusy("connect");
    setWalletMsg(null);
    try {
      setWallet(w);
      setAccount(await connectWallet(w));
      setChainId(await walletChainId(w));
    } catch (e) {
      setWalletMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  async function ensureChain(w: Eip1193) {
    if ((await walletChainId(w)) === rewardsConfig.chain.id) return;
    await switchToRewardsChain(w);
    setChainId(await walletChainId(w));
  }

  async function linkWallet() {
    if (!wallet || !account) return;
    setBusy("link");
    setWalletMsg(dict.wallet.signing);
    try {
      const challenge = await session.walletChallenge(account.toLowerCase());
      const signature = await signMessage(wallet, account, utf8ToHex(challenge.message));
      await session.linkWallet(challenge.nonce, signature);
      setWalletMsg(dict.wallet.done);
      await load();
    } catch (e) {
      setWalletMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  async function unlinkWallet() {
    if (!window.confirm(dict.wallet.unlinkConfirm)) return;
    setBusy("unlink");
    setWalletMsg(null);
    try {
      await session.unlinkWallet();
      await load();
    } catch (e) {
      setWalletMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  /** Sends one claim (or one claimMany per address), then waits for the chain and reloads. */
  async function claim(epochs: RewardEpoch[]) {
    if (!wallet || !account || !contract || !epochs.length) return;
    setBusy(epochs.length === 1 ? `claim-${epochs[0]!.epoch}` : "claim-all");
    setClaimMsg(null);
    try {
      await ensureChain(wallet);
      const proofs = await Promise.all(epochs.map((e) => session.proof(e.epoch)));
      const byAccount = new Map<string, typeof proofs>();
      for (const p of proofs) byAccount.set(p.account.toLowerCase(), [...(byAccount.get(p.account.toLowerCase()) ?? []), p]);
      for (const [to, group] of byAccount) {
        const data =
          group.length === 1
            ? group[0]!.calldata
            : claimManyCalldata(
                to,
                group.map((p) => ({ epoch: p.epoch, amount: BigInt(p.amountBase), proof: p.proof })),
              );
        const hash = await sendTransaction(wallet, account, pickAddress(group[0]!.contract) ?? contract, data);
        const mark = (state: Tx["state"]) =>
          setTxs((prev) => ({ ...prev, ...Object.fromEntries(group.map((p) => [p.epoch, { hash, state }])) }));
        mark("sent");
        const ok = await waitForReceipt(hash);
        mark(ok === null ? "slow" : ok ? "confirmed" : "failed");
        if (ok) setClaimedNow((prev) => new Set([...prev, ...group.map((p) => p.epoch)]));
      }
      void load();
    } catch (e) {
      setClaimMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  if (auth === "checking") return <AccountSection dict={dict.signIn} body={<p className="mt-10 text-muted">{dict.loading}</p>} />;
  if (auth === "out")
    return (
      <>
        <SignIn
          dict={dict}
          session={session}
          onSignedIn={() => {
            setAuth("in");
            void load();
          }}
        />
        {/* Same numbered sections as when signed in, so the page reads the same; they open after sign-in. */}
        <Section id="wallet" index={dict.wallet.index} kicker={dict.wallet.kicker} title={dict.wallet.title} lead={dict.wallet.lead}>
          <p className="mt-8 text-sm text-faint">{dict.signIn.first}</p>
        </Section>
        <Section id="claim" index={dict.claim.index} kicker={dict.claim.kicker} title={dict.claim.title} lead={dict.claim.lead}>
          <p className="mt-8 text-sm text-faint">{dict.signIn.first}</p>
        </Section>
      </>
    );

  const dateFmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const date = (iso: string) => dateFmt.format(new Date(iso));

  const signedInBar = (
    <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted">
      <span>{format(dict.signIn.signedInAs, { name: who })}</span>
      <button
        type="button"
        className="text-faint underline underline-offset-4 hover:text-text"
        onClick={() => {
          void session.signOut().then(() => {
            setData(null);
            setAuth("out");
          });
        }}
      >
        {dict.signIn.signOut}
      </button>
    </div>
  );

  if (!data)
    return (
      <AccountSection
        dict={dict.signIn}
        body={
          <>
            {signedInBar}
            <p className="mt-6 text-muted" role="status">
              {loadError ?? dict.loading}
            </p>
            {loadError && (
              <button type="button" className={cn(buttonClass("ghost"), "mt-4")} onClick={() => void load()}>
                {dict.retry}
              </button>
            )}
          </>
        }
      />
    );

  if (!data.enabled)
    return (
      <AccountSection
        dict={dict.signIn}
        body={
          <>
            {signedInBar}
            <p className="mt-6 text-muted">{dict.off}</p>
          </>
        }
      />
    );

  const epochs = (data.epochs ?? []).map((e) =>
    claimedNow.has(e.epoch) && e.status === "claimable" ? { ...e, status: "claimed" as const } : e,
  );
  const open = epochs.filter((e) => e.status === "claimable");
  const toClaim = open.reduce((sum, e) => sum + BigInt(e.amountBase), 0n);
  const decimals = rewardsConfig.decimals;
  const onChain = chainId === rewardsConfig.chain.id;
  const linked = data.wallet ?? null;

  return (
    <>
      <AccountSection
        dict={dict.signIn}
        body={
          <>
            {signedInBar}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Stat label={dict.mine.thisWeek} value={format(dict.mine.points, { points: data.week?.points ?? 0 })}>
                {data.week && format(dict.mine.estimate, { vvake: data.week.estimatedVvake })}
              </Stat>
              <Stat label={dict.mine.toClaim} value={amountText(toClaim, decimals, lang)}>
                {!contract && dict.notDeployed}
              </Stat>
            </div>
            {data.rate && (
              <p className="mt-4 max-w-3xl text-sm text-faint">{format(dict.mine.estimateNote, { cap: data.rate.dailyPointCap })}</p>
            )}

            <h3 className="mt-12 font-display text-xl font-semibold">{dict.mine.weeks}</h3>
            {epochs.length === 0 ? (
              <div className="mt-4 text-muted">
                <p>{dict.mine.empty}</p>
                <p className="mt-2 text-sm text-faint">{dict.mine.emptyHint}</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-surface/60 font-mono text-xs tracking-[0.12em] text-faint uppercase">
                    <tr>
                      <th className="px-4 py-3 font-normal">{dict.mine.week}</th>
                      <th className="px-4 py-3 text-right font-normal">{dict.mine.pointsCol}</th>
                      <th className="px-4 py-3 text-right font-normal">{dict.mine.vvakeCol}</th>
                      <th className="px-4 py-3 font-normal">{dict.mine.statusCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epochs.map((e) => (
                      <tr key={e.epoch} className="border-t border-line/60">
                        <td className="px-4 py-3">
                          {date(e.startsAt)}
                          <span className="block text-xs text-faint">{format(dict.mine.wallet, { address: shortHex(e.address) })}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.points}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.amount}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={e.status} label={dict.status[e.status]} />
                          {e.status === "claimable" && e.deadline && (
                            <span className="block text-xs text-faint">{format(dict.mine.until, { date: date(e.deadline) })}</span>
                          )}
                          {txs[e.epoch] && <TxLink tx={txs[e.epoch]!} dict={dict.claim} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        }
      />

      <Section id="wallet" index={dict.wallet.index} kicker={dict.wallet.kicker} title={dict.wallet.title} lead={dict.wallet.lead}>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface/60 p-6">
            <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.wallet.linked}</p>
            {linked ? (
              <>
                <a
                  href={explorerAddress(linked.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block font-mono text-sm break-all text-text hover:text-pulse-fg"
                >
                  {linked.address}
                </a>
                <p className="mt-1 text-sm text-faint">{format(dict.wallet.linkedAt, { date: date(linked.linkedAt) })}</p>
                <button
                  type="button"
                  className={cn(buttonClass("ghost"), "mt-5")}
                  disabled={busy !== null}
                  onClick={() => void unlinkWallet()}
                >
                  {dict.wallet.unlink}
                </button>
              </>
            ) : (
              <p className="mt-3 text-muted">{dict.wallet.none}</p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface/60 p-6">
            {!account ? (
              <button type="button" className={buttonClass("primary")} disabled={busy !== null} onClick={() => void connect()}>
                {dict.wallet.connect}
              </button>
            ) : (
              <>
                <p className="font-mono text-sm break-all">{format(dict.wallet.connected, { address: account })}</p>
                {!onChain && (
                  <div className="mt-4">
                    <p className="text-sm text-butter-fg">{dict.wallet.wrongChain}</p>
                    <button
                      type="button"
                      className={cn(buttonClass("ghost"), "mt-3")}
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy("chain");
                        void ensureChain(wallet!)
                          .catch((e: unknown) => setWalletMsg(err(e)))
                          .finally(() => setBusy(null));
                      }}
                    >
                      {dict.wallet.switchChain}
                    </button>
                  </div>
                )}
                {sameAddress(account, linked?.address) ? (
                  <p className="mt-4 text-sm text-up-fg">{dict.wallet.sameAsLinked}</p>
                ) : (
                  <button
                    type="button"
                    className={cn(buttonClass("primary"), "mt-5")}
                    disabled={busy !== null}
                    onClick={() => void linkWallet()}
                  >
                    {linked ? dict.wallet.relink : dict.wallet.link}
                  </button>
                )}
              </>
            )}
            {walletMsg && (
              <p className="mt-4 text-sm text-muted" role="status">
                {walletMsg}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section id="claim" index={dict.claim.index} kicker={dict.claim.kicker} title={dict.claim.title} lead={dict.claim.lead}>
        <div className="mt-10">
          {!contract ? (
            <NotDeployed title={dict.notDeployed} body={dict.notDeployedBody} />
          ) : open.length === 0 ? (
            <p className="text-muted">{dict.claim.nothing}</p>
          ) : (
            <>
              {!account && <p className="mb-4 text-sm text-butter-fg">{dict.claim.connectFirst}</p>}
              <ul className="space-y-3">
                {open.map((e) => (
                  <li
                    key={e.epoch}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-display font-semibold">
                        {date(e.startsAt)} · {e.amount} VVAKE
                      </p>
                      {account && !sameAddress(account, e.address) && (
                        <p className="mt-1 text-sm text-faint">{format(dict.claim.otherAddress, { address: shortHex(e.address) })}</p>
                      )}
                      {txs[e.epoch] && <TxLink tx={txs[e.epoch]!} dict={dict.claim} />}
                    </div>
                    <button
                      type="button"
                      className={buttonClass("primary")}
                      disabled={!account || busy !== null || txs[e.epoch]?.state === "sent"}
                      onClick={() => void claim([e])}
                    >
                      {dict.claim.one}
                    </button>
                  </li>
                ))}
              </ul>
              {open.length > 1 && (
                <button
                  type="button"
                  className={cn(buttonClass("ghost"), "mt-5")}
                  disabled={!account || busy !== null}
                  onClick={() => void claim(open)}
                >
                  {format(dict.claim.all, { count: open.length })}
                </button>
              )}
            </>
          )}
          {claimMsg && (
            <p className="mt-4 text-sm text-down-fg" role="alert">
              {claimMsg}
            </p>
          )}
          {contract && (
            <p className="mt-8 text-sm text-faint">
              {dict.claim.contract}:{" "}
              <a
                href={explorerAddress(contract)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono underline underline-offset-4 hover:text-text"
              >
                {shortHex(contract)}
              </a>
            </p>
          )}
        </div>
      </Section>
    </>
  );
}

const amountText = (base: bigint, decimals: number, lang: string) => `${formatUnits(base, decimals, 6, lang)} VVAKE`;

function AccountSection({ dict, body }: { dict: Dict["signIn"]; body: ReactNode }) {
  return (
    <Section id="mine" index={dict.index} kicker={dict.kicker} title={dict.title} lead={dict.lead}>
      {body}
    </Section>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6">
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}

const PILL: Record<RewardEpoch["status"], string> = {
  pending: "border-line text-muted",
  claimable: "border-volt-fg/40 text-volt-fg",
  claimed: "border-up-fg/40 text-up-fg",
  expired: "border-line text-faint",
  closed: "border-line text-faint",
};

function StatusPill({ status, label }: { status: RewardEpoch["status"]; label: string }) {
  return <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs", PILL[status])}>{label}</span>;
}

function TxLink({ tx, dict }: { tx: Tx; dict: Dict["claim"] }) {
  const text = { sent: dict.sent, confirmed: dict.confirmed, failed: dict.failed, slow: dict.slow }[tx.state];
  return (
    <span className="mt-1 block text-xs text-muted" role="status">
      {text}{" "}
      <a href={explorerTx(tx.hash)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-text">
        {dict.viewTx}
      </a>
    </span>
  );
}

export function NotDeployed({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6">
      <p className="font-display font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

/** Sign in: an e-mail code, or the 8-character link code the app shows. */
function SignIn({ dict, session, onSignedIn }: { dict: Dict; session: RewardsSession; onSignedIn: () => void }) {
  const t = dict.signIn;
  const [tab, setTab] = useState<"email" | "app">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [appCode, setAppCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(dict.errors[errorKey(e)]);
    } finally {
      setBusy(false);
    }
  }

  const onEmail = (ev: FormEvent) => {
    ev.preventDefault();
    if (!sentTo) {
      const to = email.trim();
      void run(async () => {
        await session.startEmail(to);
        setSentTo(to);
      });
    } else
      void run(async () => {
        await session.verifyEmail(sentTo, code.trim());
        onSignedIn();
      });
  };

  const onApp = (ev: FormEvent) => {
    ev.preventDefault();
    void run(async () => {
      await session.redeemAppCode(appCode);
      onSignedIn();
    });
  };

  const tabClass = (on: boolean) =>
    cn(
      "rounded-lg px-4 py-2 font-display text-sm font-semibold transition-colors",
      on ? "bg-surface-2 text-text" : "text-muted hover:text-text",
    );

  return (
    <AccountSection
      dict={t}
      body={
        <div className="mt-10 max-w-xl rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
          <div role="tablist" className="inline-flex gap-1 rounded-xl border border-line p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "email"}
              className={tabClass(tab === "email")}
              onClick={() => setTab("email")}
            >
              {t.emailTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "app"}
              className={tabClass(tab === "app")}
              onClick={() => setTab("app")}
            >
              {t.appTab}
            </button>
          </div>

          {tab === "email" ? (
            <form className="mt-6" onSubmit={onEmail}>
              {!sentTo ? (
                <>
                  <label htmlFor="rewards-email" className="text-sm text-muted">
                    {t.email}
                  </label>
                  <input
                    id="rewards-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    placeholder={t.emailPlaceholder}
                    className={cn(inputClass, "mt-2")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="mt-2 text-sm text-faint">{t.emailHint}</p>
                  <button type="submit" className={cn(buttonClass("primary"), "mt-5")} disabled={busy || !email.includes("@")}>
                    {t.sendCode}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">{format(t.codeSent, { email: sentTo })}</p>
                  <label htmlFor="rewards-code" className="mt-4 block text-sm text-muted">
                    {t.code}
                  </label>
                  <input
                    id="rewards-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={cn(inputClass, "mt-2 font-mono tracking-[0.3em]")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="submit" className={buttonClass("primary")} disabled={busy || !isEmailCode(code)}>
                      {t.verify}
                    </button>
                    <button
                      type="button"
                      className={buttonClass("ghost")}
                      onClick={() => {
                        setSentTo(null);
                        setCode("");
                        setMsg(null);
                      }}
                    >
                      {t.otherEmail}
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form className="mt-6" onSubmit={onApp}>
              <label htmlFor="rewards-app-code" className="text-sm text-muted">
                {t.appCode}
              </label>
              <input
                id="rewards-app-code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={9}
                placeholder={t.appCodePlaceholder}
                className={cn(inputClass, "mt-2 font-mono tracking-[0.3em] uppercase")}
                value={appCode}
                onChange={(e) => setAppCode(e.target.value)}
              />
              <p className="mt-2 text-sm text-faint">{t.appHint}</p>
              <button type="submit" className={cn(buttonClass("primary"), "mt-5")} disabled={busy || !isAppCode(appCode)}>
                {t.redeem}
              </button>
            </form>
          )}

          {msg && (
            <p className="mt-4 text-sm text-down-fg" role="alert">
              {msg}
            </p>
          )}
          <p className="mt-6 text-xs text-faint">{t.tabNote}</p>
        </div>
      }
    />
  );
}
