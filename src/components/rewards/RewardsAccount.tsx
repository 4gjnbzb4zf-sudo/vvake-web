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
  sendClaimTransaction,
  signMessage,
  switchToRewardsChain,
  waitForReceipt,
  walletChainId,
  type Eip1193,
} from "@/lib/chain";
import { ClaimRefusedError, planClaims } from "@/lib/claimTx";
import { formatUnits, utf8ToHex } from "@/lib/eth";
import { linkMessageProblems, readLinkMessage, type LinkMessageView, type LinkProblem } from "@/lib/linkMessage";
import { explorerAddress, explorerTx, pickAddress, rewardsConfig, shortHex } from "@/lib/rewards-config";
import { sendClaimWithVault, signLinkWithVault } from "@/lib/passkeyWallet";
import {
  ClaimNotOpenError,
  claimOpensAt,
  errorKey,
  isAppCode,
  isEmailCode,
  missingConditions,
  RewardsSession,
  type RewardEpoch,
  type Rewards,
  type SkillQuestion,
  type StoredVault,
} from "@/lib/rewardsApi";
import { isVaultBlob, passkeyRpId, type VaultBlob } from "@/lib/walletVault";
import { chainRpc, OwnWalletGuide, PasskeyWallet, passkeyApi } from "./PasskeyWallet";
import { ClaimItem, EntryChoice, SkillCard } from "./PrizeEntry";
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
  // Prizes are 18+: the visitor confirms it before linking; the link request carries `adult: true` (the API requires it).
  const [adult, setAdult] = useState(false);
  // The link message, shown to the visitor before the wallet is asked to sign it (VV-07).
  const [review, setReview] = useState<LinkReviewState | null>(null);
  // The passkey wallet: its encrypted blob from the API (undefined while loading), and this host's passkey rp.id.
  const [vault, setVault] = useState<StoredVault | null | undefined>(undefined);
  const [vaultError, setVaultError] = useState(false);
  const [rpId, setRpId] = useState<string | null>(null);

  // Claims sent from this page, per epoch (a claimMany marks every epoch it carries).
  const [txs, setTxs] = useState<Record<number, Tx>>({});
  const [claimedNow, setClaimedNow] = useState<Set<number>>(new Set());
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  // The free entry and the week's skill question (undefined while loading, null when it can't be loaded).
  const [entryMsg, setEntryMsg] = useState<string | null>(null);
  const [skill, setSkill] = useState<SkillQuestion | null | undefined>(undefined);
  const [skillMsg, setSkillMsg] = useState<string | null>(null);
  // Claims open at claimableAt (48 h after a week's root is posted): the clock the claim buttons follow.
  const [now, setNow] = useState(0);

  const err = (e: unknown) => dict.errors[errorKey(e)];

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await session.rewards();
      setNow(Date.now());
      setData(next);
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

  useEffect(() => {
    const id = window.setTimeout(() => setRpId(passkeyRpId(window.location.hostname)), 0);
    return () => window.clearTimeout(id);
  }, []);

  // The passkey wallet's locked copy, once signed in (an API without the vault route just means "none yet").
  useEffect(() => {
    if (auth !== "in" || vault !== undefined) return;
    let live = true;
    session
      .vault()
      .then((v) => live && setVault(v))
      .catch(() => {
        if (!live) return;
        setVault(null);
        setVaultError(true);
      });
    return () => {
      live = false;
    };
  }, [auth, vault, session]);

  const vaultBlob: VaultBlob | null = vault && isVaultBlob(vault) ? ({ ...vault, version: 1 } as VaultBlob) : null;
  const vaultSigner = () => {
    const api = passkeyApi();
    return api && rpId && vaultBlob ? { api, rpId, blob: vaultBlob } : null;
  };

  // The week's skill question, once signed in with rewards on (an API without the route just hides the card).
  const rewardsOn = auth === "in" && data?.enabled === true;
  useEffect(() => {
    if (!rewardsOn || skill !== undefined) return;
    let live = true;
    session
      .skill()
      .then((q) => live && setSkill(q))
      .catch(() => live && setSkill(null));
    return () => {
      live = false;
    };
  }, [rewardsOn, skill, session]);

  // A claim waiting for claimableAt turns on by itself.
  useEffect(() => {
    if (!data?.epochs?.some((e) => claimOpensAt(e, Date.now()))) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [data]);

  async function enterFree() {
    setBusy("entry");
    setEntryMsg(null);
    try {
      await session.enterFree();
      setEntryMsg(dict.entry.free.done);
      await load();
    } catch (e) {
      setEntryMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  async function withdrawFree() {
    if (!window.confirm(dict.entry.free.withdrawConfirm)) return;
    setBusy("entry");
    setEntryMsg(null);
    try {
      await session.withdrawFree();
      setEntryMsg(dict.entry.free.withdrawn);
      await load();
    } catch (e) {
      setEntryMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  async function answerSkill(answer: number) {
    if (!skill) return;
    setBusy("skill");
    setSkillMsg(null);
    try {
      const r = await session.answerSkill(answer, skill.epoch);
      setSkill({ epoch: r.epoch, answered: r.correct, answeredAt: r.answeredAt, attemptsLeft: r.attemptsLeft, question: r.question });
      if (!r.correct) setSkillMsg(r.attemptsLeft > 0 ? dict.skill.wrong : null);
      else void load();
    } catch (e) {
      setSkillMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

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

  // Only the contract pinned in this build: an address from the API is never used to read or to claim (VV-06).
  const contract = pickAddress(rewardsConfig.rewardsContract);

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

  /** Step 1: get the message to sign and show its key lines; nothing is signed yet. */
  async function prepareLink() {
    if (!wallet || !account) return;
    if (!adult) {
      setWalletMsg(dict.wallet.adultFirst);
      return;
    }
    setBusy("link");
    setWalletMsg(null);
    try {
      const challenge = await session.walletChallenge(account.toLowerCase());
      const view = readLinkMessage(challenge.message);
      const problems = linkMessageProblems(view, { account, chainId: rewardsConfig.chain.id, host: window.location.host });
      setReview({ message: challenge.message, nonce: challenge.nonce, account, view, problems, via: "injected" });
    } catch (e) {
      setWalletMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  /** Step 1 for the passkey wallet: the same challenge and the same review, for the vault's address. */
  async function preparePasskeyLink() {
    if (!vaultBlob) return;
    if (!adult) {
      setWalletMsg(dict.wallet.adultFirst);
      return;
    }
    setBusy("link");
    setWalletMsg(null);
    try {
      const challenge = await session.walletChallenge(vaultBlob.address.toLowerCase());
      const view = readLinkMessage(challenge.message);
      const problems = linkMessageProblems(view, {
        account: vaultBlob.address,
        chainId: rewardsConfig.chain.id,
        host: window.location.host,
      });
      setReview({ message: challenge.message, nonce: challenge.nonce, account: vaultBlob.address, view, problems, via: "passkey" });
    } catch (e) {
      setWalletMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  /** Step 2, after the visitor read it: the wallet (or the passkey wallet) signs exactly the message shown. */
  async function signLink() {
    if (!review || review.problems.length) return;
    const signer = review.via === "passkey" ? vaultSigner() : null;
    if (
      review.via === "passkey"
        ? !signer || !sameAddress(signer.blob.address, review.account)
        : !wallet || !sameAddress(account, review.account)
    )
      return;
    if (!adult) {
      setWalletMsg(dict.wallet.adultFirst);
      return;
    }
    setBusy("link");
    setWalletMsg(review.via === "passkey" ? dict.wallet.passkey.unlocking : dict.wallet.signing);
    try {
      // The passkey path re-checks the message with linkMessage.ts before the passkey is asked (passkeyWallet.ts).
      const signature = signer
        ? await signLinkWithVault(signer, review.message, window.location.host)
        : await signMessage(wallet!, review.account, utf8ToHex(review.message));
      await session.linkWallet(review.nonce, signature, adult);
      setReview(null);
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

  /**
   * Sends one claim (or one claimMany per address), then waits for the chain and reloads. From the connected browser
   * wallet when there is one, else from the passkey wallet (signed with the passkey, sent to the public RPC).
   */
  async function claim(epochs: RewardEpoch[]) {
    const signer = wallet && account ? null : vaultSigner();
    if ((!(wallet && account) && !signer) || !contract || !epochs.length) return;
    setBusy(epochs.length === 1 ? `claim-${epochs[0]!.epoch}` : "claim-all");
    setClaimMsg(null);
    try {
      if (!signer) await ensureChain(wallet!);
      const proofs = await Promise.all(epochs.map((e) => session.proof(e.epoch)));
      // Contracts v2 refuse a claim before claimableAt: don't make the visitor pay gas for a revert.
      const waiting = proofs.map((p) => claimOpensAt(p, Date.now())).find((d) => d !== null);
      if (waiting) throw new ClaimNotOpenError(waiting);
      // Target, calldata and value are decided locally (src/lib/claimTx.ts), never taken from the API (VV-06).
      const plan = planClaims(proofs);
      if (!plan.ok) throw new ClaimRefusedError(plan.reason);
      for (const tx of plan.txs) {
        const hash = signer ? await sendClaimWithVault(signer, chainRpc, tx) : await sendClaimTransaction(wallet!, account!, tx);
        const mark = (state: Tx["state"]) =>
          setTxs((prev) => ({ ...prev, ...Object.fromEntries(tx.epochs.map((n) => [n, { hash, state }])) }));
        mark("sent");
        const ok = await waitForReceipt(hash);
        mark(ok === null ? "slow" : ok ? "confirmed" : "failed");
        if (ok) setClaimedNow((prev) => new Set([...prev, ...tx.epochs]));
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
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface/60 p-6 lg:col-span-2">
              <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.wallet.passkey.title}</p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{dict.wallet.passkey.intro}</p>
            </div>
            <OwnWalletGuide dict={dict.wallet.own} />
          </div>
        </Section>
        <Section id="claim" index={dict.claim.index} kicker={dict.claim.kicker} title={dict.claim.title} lead={dict.claim.lead}>
          <EntryChoice
            dict={dict.entry}
            signedIn={false}
            plusActive={false}
            busy={false}
            msg={null}
            date={(iso) => iso.slice(0, 10)}
            onEnter={() => {}}
            onWithdraw={() => {}}
          />
          <Eligibility dict={dict.mine} />
          <p className="mt-8 text-sm text-faint">{dict.signIn.first}</p>
        </Section>
      </>
    );

  const dateFmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const date = (iso: string) => dateFmt.format(new Date(iso));
  // Claim opening times in the visitor's own time zone, with the zone shown.
  const dateTimeFmt = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  const opensText = (d: Date) => (Number.isFinite(d.getTime()) ? dateTimeFmt.format(d) : dict.status.opening);

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
  // Claimable now, and on chain but not open yet (claimableAt in the future).
  const open = epochs.filter((e) => e.status === "claimable" && !claimOpensAt(e, now));
  const opening = epochs.filter((e) => (e.status === "opening" || e.status === "claimable") && claimOpensAt(e, now));
  const toClaim = open.reduce((sum, e) => sum + BigInt(e.amountBase), 0n);
  const decimals = rewardsConfig.decimals;
  const onChain = chainId === rewardsConfig.chain.id;
  const linked = data.wallet ?? null;
  // Linked before 18+ was recorded: the same wallet can be linked again with the box ticked.
  const relinkForAdult = missingConditions(data.week?.missing).includes("adult");
  const pointCap = data.rules?.dailyPointCap ?? data.rate?.dailyPointCap ?? null;
  // A new or changed wallet counts from the next week.
  const walletFrom = linked?.countsFrom && Date.parse(linked.countsFrom) > now ? linked.countsFrom : null;

  return (
    <>
      <AccountSection
        dict={dict.signIn}
        body={
          <>
            {signedInBar}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Stat label={dict.mine.thisWeek} value={format(dict.mine.points, { points: data.week?.points ?? 0 })}>
                {data.week?.estimatedVvake && format(dict.mine.estimate, { vvake: data.week.estimatedVvake })}
              </Stat>
              <Stat label={dict.mine.toClaim} value={amountText(toClaim, decimals, lang)}>
                {!contract && dict.notDeployed}
              </Stat>
            </div>
            {pointCap !== null && <p className="mt-4 max-w-3xl text-sm text-faint">{format(dict.mine.estimateNote, { cap: pointCap })}</p>}

            <EntryChoice
              dict={dict.entry}
              signedIn
              entry={data.entry}
              plusActive={data.plus?.active ?? false}
              busy={busy !== null}
              msg={entryMsg}
              date={date}
              onEnter={() => void enterFree()}
              onWithdraw={() => void withdrawFree()}
            />
            {skill !== null && (
              <SkillCard
                dict={dict.skill}
                skill={skill}
                busy={busy !== null}
                msg={skillMsg}
                date={date}
                onAnswer={(n) => void answerSkill(n)}
              />
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
                          {e.status === "opening" && claimOpensAt(e, now) && (
                            <span className="block text-xs text-faint">
                              {format(dict.claim.opensAt, { date: opensText(claimOpensAt(e, now)!) })}
                            </span>
                          )}
                          {txs[e.epoch] && <TxLink tx={txs[e.epoch]!} dict={dict.claim} />}
                          {e.eligible === false && (
                            <span className="block text-xs text-faint">
                              {format(dict.mine.notEligibleWeek, { reasons: reasonsText(e.missing, dict.mine) })}
                            </span>
                          )}
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
                {walletFrom && <p className="mt-1 text-sm text-butter-fg">{format(dict.wallet.countsFrom, { date: date(walletFrom) })}</p>}
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
                {sameAddress(account, linked?.address) && !relinkForAdult ? (
                  <p className="mt-4 text-sm text-up-fg">{dict.wallet.sameAsLinked}</p>
                ) : (
                  <>
                    <label className="mt-5 flex items-start gap-3 text-sm text-muted">
                      <input
                        type="checkbox"
                        required
                        className="mt-0.5 size-4 shrink-0 accent-pulse"
                        checked={adult}
                        onChange={(e) => setAdult(e.target.checked)}
                      />
                      <span>{dict.wallet.adult}</span>
                    </label>
                    {review && review.via === "injected" && sameAddress(review.account, account) ? (
                      <LinkReview
                        dict={dict.wallet.review}
                        review={review}
                        who={who}
                        host={typeof window === "undefined" ? "" : window.location.host}
                        busy={busy !== null}
                        onSign={() => void signLink()}
                        onCancel={() => setReview(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        className={cn(buttonClass("primary"), "mt-4")}
                        disabled={busy !== null || !adult}
                        onClick={() => void prepareLink()}
                      >
                        {linked ? dict.wallet.relink : dict.wallet.link}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {walletMsg && (
              <p className="mt-4 text-sm text-muted" role="status">
                {walletMsg}
              </p>
            )}
          </div>

          <PasskeyWallet
            dict={dict.wallet}
            claimDict={dict.claim}
            errors={dict.errors}
            session={session}
            vault={vault}
            vaultError={vaultError}
            onVault={(v) => {
              setVault(v);
              setVaultError(false);
              if (review?.via === "passkey") setReview(null);
            }}
            rpId={rpId}
            linked={linked?.address ?? null}
            adult={adult}
            onAdult={setAdult}
            onLink={() => void preparePasskeyLink()}
            busy={busy !== null}
            lang={lang}
            review={
              review && review.via === "passkey" && vaultBlob && sameAddress(review.account, vaultBlob.address) ? (
                <LinkReview
                  dict={dict.wallet.review}
                  review={review}
                  who={who}
                  host={typeof window === "undefined" ? "" : window.location.host}
                  busy={busy !== null}
                  onSign={() => void signLink()}
                  onCancel={() => setReview(null)}
                />
              ) : null
            }
          />
          <OwnWalletGuide dict={dict.wallet.own} />
        </div>
      </Section>

      <Section id="claim" index={dict.claim.index} kicker={dict.claim.kicker} title={dict.claim.title} lead={dict.claim.lead}>
        <Eligibility dict={dict.mine} week={data.week} rules={data.rules} walletFrom={walletFrom ? date(walletFrom) : null} />
        <div className="mt-10">
          {!contract ? (
            <NotDeployed title={dict.notDeployed} body={dict.notDeployedBody} />
          ) : open.length === 0 && opening.length === 0 ? (
            <p className="text-muted">{dict.claim.nothing}</p>
          ) : (
            <>
              {open.length > 0 && !account && !vaultBlob && <p className="mb-4 text-sm text-butter-fg">{dict.claim.connectFirst}</p>}
              {open.length > 0 && !account && vaultBlob && <p className="mb-4 text-sm text-muted">{dict.wallet.passkey.claimNote}</p>}
              <ul className="space-y-3">
                {[...open, ...opening].map((e) => {
                  const opensAt = claimOpensAt(e, now);
                  return (
                    <ClaimItem
                      key={e.epoch}
                      dict={dict.claim}
                      e={e}
                      title={`${date(e.startsAt)} · ${e.amount} VVAKE`}
                      opensAt={opensAt ? opensText(opensAt) : null}
                      disabled={(!account && !vaultBlob) || busy !== null || txs[e.epoch]?.state === "sent"}
                      onClaim={() => void claim([e])}
                    >
                      {(account ?? vaultBlob?.address) && !sameAddress(account ?? vaultBlob?.address, e.address) && (
                        <p className="mt-1 text-sm text-faint">{format(dict.claim.otherAddress, { address: shortHex(e.address) })}</p>
                      )}
                      {txs[e.epoch] && <TxLink tx={txs[e.epoch]!} dict={dict.claim} />}
                    </ClaimItem>
                  );
                })}
              </ul>
              {opening.length > 0 && <p className="mt-4 text-sm text-faint">{dict.claim.opening}</p>}
              {open.length > 1 && (
                <button
                  type="button"
                  className={cn(buttonClass("ghost"), "mt-5")}
                  disabled={(!account && !vaultBlob) || busy !== null}
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

interface LinkReviewState {
  message: string;
  nonce: string;
  account: string;
  view: LinkMessageView;
  problems: LinkProblem[];
  /** Who signs: the connected browser wallet, or the passkey wallet. */
  via: "injected" | "passkey";
}

/** The link message's key lines and full text, before the wallet signs it (VV-07). */
export function LinkReview({
  dict,
  review,
  who,
  host,
  busy,
  onSign,
  onCancel,
}: {
  dict: Dict["wallet"]["review"];
  review: Pick<LinkReviewState, "message" | "view" | "problems">;
  who: string;
  host: string;
  busy: boolean;
  onSign: () => void;
  onCancel: () => void;
}) {
  const { view } = review;
  const chain = view.chainId === rewardsConfig.chain.id ? `${rewardsConfig.chain.name} (${view.chainId})` : String(view.chainId ?? "?");
  const rows: [string, string][] = [
    [dict.site, host],
    [dict.domain, view.domain ? (view.uri ? `${view.domain} · ${view.uri}` : view.domain) : dict.noDomain],
    [dict.account, view.account ?? who],
    [dict.wallet, view.wallet ?? "?"],
    [dict.chain, chain],
    ...(view.expires ? [[dict.expires, view.expires] as [string, string]] : []),
  ];
  return (
    <div className="mt-5 rounded-xl border border-line p-4 text-sm" data-testid="link-review">
      <p className="font-display font-semibold">{dict.title}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-faint">{k}</dt>
            <dd className="font-mono break-all">{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-faint">{dict.full}</summary>
        <pre className="mt-2 font-mono text-xs break-words whitespace-pre-wrap text-muted">{review.message}</pre>
      </details>
      {review.problems.length ? (
        <p className="mt-3 text-down-fg" role="alert">
          {dict.mismatch}
        </p>
      ) : (
        <p className="mt-3 text-muted">{dict.check}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {!review.problems.length && (
          <button type="button" className={buttonClass("primary")} disabled={busy} onClick={onSign}>
            {dict.sign}
          </button>
        )}
        <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={onCancel}>
          {dict.cancel}
        </button>
      </div>
    </div>
  );
}

/** The API's missing conditions as one readable list; an empty or absent list still says something is missing. */
function reasonsText(missing: readonly string[] | null | undefined, dict: Dict["mine"]) {
  const keys = missingConditions(missing);
  return (keys.length ? keys : (["other"] as const)).map((k) => dict.missing[k]).join(" · ");
}

/** The rule with the API's numbers when it sends them (`rules`), else the published defaults (ADR-0024). */
export function ruleText(dict: Dict["mine"], rules?: Rewards["rules"]) {
  return format(dict.rule, {
    sessions: rules?.minSessions ?? 3,
    minutes: rules?.minActiveMinutes ?? 90,
    grace: rules?.uploadGraceHours ?? 4,
    cap: rules?.dailyPointCap ?? 150,
  });
}

/** One missing condition's words; a wallet linked this week says from when it counts. */
export function missingText(dict: Dict["mine"], k: ReturnType<typeof missingConditions>[number], walletFrom?: string | null) {
  return k === "wallet" && walletFrom ? format(dict.missing.walletFrom, { date: walletFrom }) : dict.missing[k];
}

/**
 * Who gets prizes (Plus or the free entry, an account and a wallet from before the week, 18+, heart-rate effort, the
 * skill question), next to the claim area. When GET /v1/rewards says whether this week counts so far (`week.eligible`,
 * `week.missing`), it shows that too; older API versions don't, and then only the rule shows.
 */
export function Eligibility({
  dict,
  week,
  rules,
  walletFrom,
}: {
  dict: Dict["mine"];
  week?: Rewards["week"];
  rules?: Rewards["rules"];
  walletFrom?: string | null;
}) {
  const missing = missingConditions(week?.missing);
  const state = week?.eligible === true ? "yes" : week?.eligible === false || missing.length ? "no" : null;
  return (
    <div className="mt-10 rounded-2xl border border-line bg-surface/60 p-6">
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.ruleTitle}</p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{ruleText(dict, rules)}</p>
      {state === "yes" && (
        <p className="mt-4 text-sm text-up-fg" role="status">
          {dict.eligibleNow}
        </p>
      )}
      {state === "no" && (
        <div className="mt-4 text-sm text-butter-fg" role="status">
          <p>{dict.notEligibleNow}</p>
          <ul className="mt-1 list-disc pl-5">
            {(missing.length ? missing : (["other"] as const)).map((k) => (
              <li key={k}>{missingText(dict, k, walletFrom)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
  opening: "border-butter-fg/40 text-butter-fg",
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
export function SignIn({
  dict,
  session,
  onSignedIn,
  initialTab = "email",
}: {
  dict: Dict;
  session: RewardsSession;
  onSignedIn: () => void;
  initialTab?: "email" | "app";
}) {
  const t = dict.signIn;
  const [tab, setTab] = useState<"email" | "app">(initialTab);
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
              <p className="mt-2 rounded-lg border border-down-fg/40 px-3 py-2 text-sm text-down-fg" role="note">
                {t.appWarning}
              </p>
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
