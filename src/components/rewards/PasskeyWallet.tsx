"use client";

import { useEffect, useState, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { rpc, waitForReceipt } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { formatUnits } from "@/lib/eth";
import { parseUnits, planTransfer, sendTransferWithVault, walletBalances, type ChainRpc, type TransferPlan } from "@/lib/passkeyWallet";
import { explorerAddress, explorerTx, rewardsConfig } from "@/lib/rewards-config";
import { ApiError, errorKey, type RewardsSession, type StoredVault } from "@/lib/rewardsApi";
import { createVault, EXPORT_WARNING_MS, exportPrivateKey, isVaultBlob, PrfUnsupportedError, type VaultBlob } from "@/lib/walletVault";

type Dict = Dictionary["rewards"];

export const chainRpc: ChainRpc = { rpc };

/** Below this much testnet ETH, the card says "needs gas" (a claim costs about 1e5 gas). The real check is prepareTx. */
const GAS_HINT_WEI = 10n ** 13n;

const sameAddress = (a?: string | null, b?: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** navigator.credentials when this page can use passkeys at all. */
export const passkeyApi = () =>
  typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && navigator.credentials ? navigator.credentials : null;

/**
 * The passkey wallet card on vvake.com/rewards: create it (Face ID / passkey), see its address, balances and gas,
 * link it (the parent runs the same link review as for a browser wallet), export the key behind a 10 s warning and a
 * fresh passkey prompt, move the VVAKE to your own wallet, delete the locked copy. Signing logic: src/lib/walletVault.ts
 * and src/lib/passkeyWallet.ts; nothing secret is kept in React state except the exported key while it's shown.
 */
export function PasskeyWallet({
  dict,
  claimDict,
  errors,
  session,
  vault,
  vaultError,
  onVault,
  rpId,
  linked,
  adult,
  onAdult,
  onLink,
  review,
  busy: parentBusy,
  lang,
}: {
  dict: Dict["wallet"];
  claimDict: Dict["claim"];
  errors: Dict["errors"];
  session: RewardsSession;
  vault: StoredVault | null | undefined;
  vaultError: boolean;
  onVault: (v: StoredVault | null) => void;
  rpId: string | null;
  linked: string | null;
  adult: boolean;
  onAdult: (v: boolean) => void;
  onLink: () => void;
  review: ReactNode;
  busy: boolean;
  lang: string;
}) {
  const t = dict.passkey;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [prfMissing, setPrfMissing] = useState(false);
  const [pending, setPending] = useState<VaultBlob | null>(null);
  const [balances, setBalances] = useState<{ eth: bigint; vvake: bigint } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ shownAt: number; key: string | null } | null>(null);
  const [now, setNow] = useState(0);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [movePlan, setMovePlan] = useState<(Extract<TransferPlan, { ok: true }> & { amount: bigint }) | null>(null);
  const [moveTx, setMoveTx] = useState<{ hash: string; state: "sent" | "confirmed" | "failed" | "slow" } | null>(null);
  const [deleteAck, setDeleteAck] = useState(false);

  const api = passkeyApi();
  const available = Boolean(api && rpId);
  const blob = vault && isVaultBlob(vault) ? ({ ...vault, version: 1 } as VaultBlob) : null;
  const err = (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) return errors.vaultTaken;
    return errors[errorKey(e)];
  };

  // Ask the browser up front whether passkeys here can do PRF (when it can tell: getClientCapabilities).
  useEffect(() => {
    const caps = (window.PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> } | undefined)
      ?.getClientCapabilities;
    if (!caps) return;
    let live = true;
    caps
      .call(window.PublicKeyCredential)
      .then((c) => live && c["extension:prf"] === false && setPrfMissing(true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const address = blob?.address ?? null;
  useEffect(() => {
    if (!address) return;
    let live = true;
    const read = () =>
      walletBalances(chainRpc, address)
        .then((b) => live && setBalances(b))
        .catch(() => live && setBalances(null));
    void read();
    const id = window.setInterval(read, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [address, moveTx?.state]);

  // The export countdown; the shown key is dropped when the card goes away.
  useEffect(() => {
    if (!exporting || exporting.key) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [exporting]);

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof PrfUnsupportedError) setPrfMissing(true);
      setMsg(err(e));
    } finally {
      setBusy(null);
    }
  }

  const save = (b: VaultBlob) =>
    run("save", async () => {
      onVault(await session.saveVault(b));
      setPending(null);
      setMsg(t.created);
    });

  const create = () =>
    run("create", async () => {
      if (!api || !rpId) {
        setMsg(t.unavailable);
        return;
      }
      setMsg(t.creating);
      const user = session.user;
      const { blob: made } = await createVault(api, {
        rpId,
        user: { id: user?.id ?? "vvake", name: user?.email || user?.name || "VVake", displayName: "VVake wallet" },
      });
      // Kept (it's only the locked copy) until the server has it, so a failed upload can be retried.
      setPending(made);
      onVault(await session.saveVault(made));
      setPending(null);
      setMsg(t.created);
    });

  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    });
  };

  const reveal = () =>
    run("export", async () => {
      if (!api || !rpId || !blob || !exporting) return;
      const key = await exportPrivateKey(api, rpId, blob, { warningShownAt: exporting.shownAt, now: Date.now() });
      setExporting({ shownAt: exporting.shownAt, key });
    });

  const reviewMove = () => {
    setMsg(null);
    if (!blob) return;
    const amount = parseUnits(moveAmount);
    if (amount === null || (balances && amount > balances.vvake)) {
      setMsg(t.move.errors.amount);
      return;
    }
    const plan = planTransfer({ to: moveTo, amountBase: amount, from: blob.address });
    if (!plan.ok) {
      setMsg(t.move.errors[plan.reason]);
      return;
    }
    setMovePlan({ ...plan, amount });
  };

  const sendMove = () =>
    run("move", async () => {
      if (!api || !rpId || !blob || !movePlan) return;
      const hash = await sendTransferWithVault({ api, rpId, blob }, chainRpc, movePlan.call);
      setMovePlan(null);
      setMoveTx({ hash, state: "sent" });
      const ok = await waitForReceipt(hash);
      setMoveTx({ hash, state: ok === null ? "slow" : ok ? "confirmed" : "failed" });
    });

  const remove = () =>
    run("delete", async () => {
      if (!deleteAck || !window.confirm(t.delete.confirm)) return;
      const wasLinked = sameAddress(linked, blob?.address);
      await session.deleteVault();
      onVault(null);
      setExporting(null);
      setMoveOpen(false);
      setDeleteAck(false);
      setMsg(wasLinked ? `${t.delete.done} ${t.delete.stillLinked}` : t.delete.done);
    });

  const working = busy !== null || parentBusy;
  const secondsLeft = exporting && !exporting.key ? Math.max(0, Math.ceil((exporting.shownAt + EXPORT_WARNING_MS - now) / 1000)) : 0;
  const needsGas = balances !== null && balances.eth < GAS_HINT_WEI;
  const isLinked = sameAddress(linked, blob?.address);

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6 lg:col-span-2" data-testid="passkey-wallet">
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{t.title}</p>

      {vault === undefined && !vaultError ? (
        <p className="mt-3 text-muted">…</p>
      ) : !blob ? (
        <>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{t.intro}</p>
          {vaultError && <p className="mt-3 text-sm text-butter-fg">{t.loadError}</p>}
          {!available ? (
            <p className="mt-4 text-sm text-butter-fg">
              {t.unavailable}{" "}
              <a href="#own-wallet" className="underline underline-offset-4 hover:text-text">
                {dict.own.title}
              </a>
            </p>
          ) : prfMissing ? (
            <p className="mt-4 text-sm text-butter-fg" role="status">
              {t.prfUnsupported}{" "}
              <a href="#own-wallet" className="underline underline-offset-4 hover:text-text">
                {dict.own.title}
              </a>
            </p>
          ) : pending ? (
            <button type="button" className={cn(buttonClass("primary"), "mt-5")} disabled={working} onClick={() => void save(pending)}>
              {/* The passkey and the locked copy exist; only the upload failed. */}
              {t.retrySave}
            </button>
          ) : (
            <button
              type="button"
              className={cn(buttonClass("primary"), "mt-5")}
              disabled={working || vaultError}
              onClick={() => void create()}
            >
              {t.create}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-faint">{t.address}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <a
              href={explorerAddress(blob.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm break-all text-text hover:text-pulse-fg"
            >
              {blob.address}
            </a>
            <button
              type="button"
              className="text-sm text-faint underline underline-offset-4 hover:text-text"
              onClick={() => copy(blob.address, "address")}
            >
              {copied === "address" ? t.copied : t.copy}
            </button>
          </div>
          {balances && (
            <p className="mt-2 text-sm text-muted">
              {format(t.balances, {
                eth: formatUnits(balances.eth, 18, 6, lang),
                vvake: formatUnits(balances.vvake, rewardsConfig.decimals, 4, lang),
              })}
            </p>
          )}
          {needsGas ? (
            <p className="mt-2 text-sm text-butter-fg" role="status">
              {t.needsGas}
            </p>
          ) : (
            balances && <p className="mt-2 text-sm text-up-fg">{t.gasOk}</p>
          )}

          {isLinked ? (
            <p className="mt-4 text-sm text-up-fg">{t.linked}</p>
          ) : (
            <>
              <label className="mt-5 flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-pulse"
                  checked={adult}
                  onChange={(e) => onAdult(e.target.checked)}
                />
                <span>{dict.adult}</span>
              </label>
              {review ?? (
                <button
                  type="button"
                  className={cn(buttonClass("primary"), "mt-4")}
                  disabled={working || !adult || !available}
                  onClick={onLink}
                >
                  {t.link}
                </button>
              )}
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass("ghost")}
              disabled={working || !available}
              onClick={() => {
                setNow(Date.now());
                setExporting({ shownAt: Date.now(), key: null });
              }}
            >
              {t.export.button}
            </button>
            <button type="button" className={buttonClass("ghost")} disabled={working} onClick={() => setMoveOpen((o) => !o)}>
              {t.move.button}
            </button>
          </div>

          {exporting && (
            <div className="mt-5 rounded-xl border border-down-fg/40 bg-down-fg/5 p-4 text-sm" role="alert" data-testid="export-warning">
              <p className="font-display font-semibold text-down-fg">{t.export.title}</p>
              <p className="mt-2 text-muted">{t.export.warning}</p>
              {exporting.key ? (
                <>
                  <p className="mt-4 text-muted">{t.export.shown}</p>
                  <code className="mt-2 block font-mono text-xs break-all text-text select-all">{exporting.key}</code>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" className={buttonClass("ghost")} onClick={() => copy(exporting.key!, "key")}>
                      {copied === "key" ? t.copied : t.export.copy}
                    </button>
                    <button type="button" className={buttonClass("ghost")} onClick={() => setExporting(null)}>
                      {t.export.hide}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {secondsLeft > 0 && <p className="mt-3 text-faint">{format(t.export.wait, { s: secondsLeft })}</p>}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={buttonClass("primary")}
                      disabled={working || secondsLeft > 0}
                      onClick={() => void reveal()}
                    >
                      {t.export.reveal}
                    </button>
                    <button type="button" className={buttonClass("ghost")} onClick={() => setExporting(null)}>
                      {t.export.cancel}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {moveOpen && (
            <div className="mt-5 rounded-xl border border-line p-4 text-sm">
              <p className="font-display font-semibold">{t.move.title}</p>
              <p className="mt-2 text-muted">{t.move.intro}</p>
              {movePlan ? (
                <div className="mt-4" data-testid="move-confirm">
                  <p className="font-display font-semibold">{t.move.confirmTitle}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <dt className="text-faint">{t.move.from}</dt>
                    <dd className="font-mono break-all">{blob.address}</dd>
                    <dt className="text-faint">{t.move.toLabel}</dt>
                    <dd className="font-mono break-all">{movePlan.to}</dd>
                    <dt className="text-faint">{t.move.amountLabel}</dt>
                    <dd className="font-mono">{formatUnits(movePlan.amount, rewardsConfig.decimals, 18, lang)} VVAKE</dd>
                  </dl>
                  <p className="mt-3 text-faint">{t.move.gas}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" className={buttonClass("primary")} disabled={working} onClick={() => void sendMove()}>
                      {t.move.send}
                    </button>
                    <button type="button" className={buttonClass("ghost")} disabled={working} onClick={() => setMovePlan(null)}>
                      {t.move.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  <label className="text-muted" htmlFor="move-to">
                    {t.move.to}
                  </label>
                  <input
                    id="move-to"
                    className={cn(inputClass, "font-mono")}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={42}
                    placeholder="0x…"
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value.trim())}
                  />
                  <label className="text-muted" htmlFor="move-amount">
                    {t.move.amount}
                  </label>
                  <div className="flex gap-3">
                    <input
                      id="move-amount"
                      inputMode="decimal"
                      className={cn(inputClass, "font-mono")}
                      value={moveAmount}
                      onChange={(e) => setMoveAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      className={buttonClass("ghost")}
                      disabled={!balances}
                      onClick={() =>
                        balances && setMoveAmount(formatUnits(balances.vvake, rewardsConfig.decimals, 18, "en").replace(/,/g, ""))
                      }
                    >
                      {t.move.max}
                    </button>
                  </div>
                  <button
                    type="button"
                    className={cn(buttonClass("primary"), "justify-self-start")}
                    disabled={working}
                    onClick={reviewMove}
                  >
                    {t.move.review}
                  </button>
                </div>
              )}
              {moveTx && (
                <p className="mt-3 text-xs text-muted" role="status">
                  {{ sent: claimDict.sent, confirmed: t.move.sent, failed: claimDict.failed, slow: claimDict.slow }[moveTx.state]}{" "}
                  <a
                    href={explorerTx(moveTx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-text"
                  >
                    {claimDict.viewTx}
                  </a>
                </p>
              )}
            </div>
          )}

          <div className="mt-8 border-t border-line/60 pt-5">
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-pulse"
                checked={deleteAck}
                onChange={(e) => setDeleteAck(e.target.checked)}
              />
              <span>{t.delete.ack}</span>
            </label>
            <button
              type="button"
              className={cn(buttonClass("ghost"), "mt-3")}
              disabled={working || !deleteAck}
              onClick={() => void remove()}
            >
              {t.delete.button}
            </button>
          </div>
        </>
      )}

      {(msg || busy === "export" || busy === "move") && (
        <p className="mt-4 text-sm text-muted" role="status">
          {msg ?? t.unlocking}
        </p>
      )}
    </div>
  );
}

/** "Use my own wallet": Rabby / MetaMask / a hardware wallet, the testnet's settings, and the recovery phrase rules. */
export function OwnWalletGuide({ dict }: { dict: Dict["wallet"]["own"] }) {
  return (
    <div id="own-wallet" className="rounded-2xl border border-line bg-surface/60 p-6 lg:col-span-2" data-testid="own-wallet">
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.title}</p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{dict.intro}</p>
      <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
        {dict.steps.map((s) => (
          <li key={s} className="break-words">
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm font-semibold text-down-fg">{dict.never}</p>
    </div>
  );
}
