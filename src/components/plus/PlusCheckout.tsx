"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { SignIn } from "@/components/rewards/RewardsAccount";
import { buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { coachTierName, ownPlanTier } from "@/lib/coachPlus";
import { visitorDatePrefs } from "@/lib/dates";
import { formatDate } from "@/lib/datetime";
import {
  countdown,
  discountText,
  isHttpsUrl,
  isPayUri,
  isStripeUrl,
  paidByCard,
  plusActive,
  POLL_MS,
  rememberPlus,
  shortAddress,
  storedPlusTier,
  tokensText,
  usdText,
  type Billing,
  type VvakeInvoice,
  type VvakeQuote,
} from "@/lib/plusPay";
import { encodeQr, qrPath } from "@/lib/qr";
import { ApiError, errorKey, RewardsSession } from "@/lib/rewardsApi";

type Dict = Dictionary["plusPay"];

/**
 * vvake.com/plus: sign in (the rewards page's e-mail code or app link code), then a month of Plus paid with $VVAKE.
 * The API gives an exact amount; the visitor sends it from their own wallet (QR / EIP-681 link / copy), and the page
 * polls the invoice every 5 s until the transfer is confirmed. No wallet connection here (BRAND_GUARDRAILS: wallets
 * only on /rewards). Mirrors the phone's VvakePay.tsx.
 */
export function PlusCheckout({
  dict,
  rewards,
  lang,
  apiUrl,
  notice,
}: {
  dict: Dict;
  rewards: Dictionary["rewards"];
  lang: Locale;
  apiUrl: string;
  /** Back from Stripe's checkout (/plus/success/, /plus/cancel/, or /plans/success/, /plans/cancel/): a line at the top, and on success a short wait for Plus. */
  notice?: "success" | "cancel";
}) {
  const [session] = useState(() => new RewardsSession(apiUrl));
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [who, setWho] = useState("");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [quote, setQuote] = useState<VvakeQuote | null>(null);
  const [invoice, setInvoice] = useState<VvakeInvoice | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [copied, setCopied] = useState<"amount" | "address" | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardProblem, setCardProblem] = useState<string | null>(null);

  const explain = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 503) return dict.pay.priceDown;
      if (e instanceof ApiError && e.status === 409) return dict.pay.unavailable;
      if (e instanceof ApiError && e.status === 403) return dict.pay.signInFirst;
      if (e instanceof ApiError && e.code !== "network") return rewards.errors[errorKey(e)];
      return dict.pay.offline;
    },
    [dict.pay, rewards.errors],
  );

  const load = useCallback(async () => {
    setProblem(null);
    try {
      const b = await session.billing();
      setBilling(b);
      rememberPlus(b.plusUntil, b.tier ?? (b.earlyTester ? "premium" : undefined));
      setWho(session.user?.email || session.user?.name || "VVake");
      setNow(Date.now());
      setAuth("in");
      if (b.openInvoice) setInvoice((x) => x ?? b.openInvoice ?? null);
      if (b.vvakePay?.available) {
        session
          .vvakeQuote()
          .then(setQuote)
          .catch((e: unknown) => setProblem(explain(e)));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuth("out");
        return;
      }
      setAuth("in");
      setProblem(explain(e));
    }
  }, [session, explain]);

  // Back from a reload: a refresh token in this tab signs you in again.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!RewardsSession.hasStored()) setAuth("out");
      else void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // Poll the invoice while it isn't paid (an expired one still counts if the transfer arrives) and tick the countdown.
  const invoiceId = invoice?.id;
  const paid = invoice?.status === "paid";
  const polling = useRef(false);
  useEffect(() => {
    if (!invoiceId || paid) return;
    const poll = async () => {
      if (document.visibilityState !== "visible" || polling.current) return;
      polling.current = true;
      try {
        const r = await session.vvakeInvoiceStatus(invoiceId);
        setInvoice(r.invoice);
        if (r.invoice.status === "paid") {
          setBilling((b) => (b ? { ...b, plan: r.plan, plusUntil: r.plusUntil, plusSource: r.plusSource } : b));
          rememberPlus(r.plusUntil);
        }
      } catch {
        // offline for a moment: the next tick tries again
      } finally {
        polling.current = false;
      }
    };
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [invoiceId, paid, session]);

  // Back from a card checkout: Stripe tells the API a few seconds later (its webhook), so read Plus again for a minute.
  const signedIn = auth === "in";
  const hasPlusNow = plusActive(billing?.plusUntil, now);
  useEffect(() => {
    if (notice !== "success" || !signedIn || hasPlusNow) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (tries > 20) {
        window.clearInterval(timer);
        return;
      }
      void session
        .billing()
        .then((b) => {
          setBilling(b);
          rememberPlus(b.plusUntil);
          setNow(Date.now());
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [notice, signedIn, hasPlusNow, session]);

  /** Stripe's hosted checkout (subscribe) or its customer portal (manage): the API gives the link, the tab goes there. */
  const toStripe = async (what: "checkout" | "portal") => {
    setCardBusy(true);
    setCardProblem(null);
    try {
      const { url } = what === "checkout" ? await session.stripeCheckout(lang) : await session.stripePortal(lang);
      if (!isStripeUrl(url)) throw new ApiError(502, "bad_response", "");
      window.location.assign(url);
    } catch (e) {
      setCardBusy(false);
      if (e instanceof ApiError && e.status === 409) setCardProblem(dict.card.already);
      else if (e instanceof ApiError && (e.status === 503 || e.status === 404)) setCardProblem(dict.card.unavailable);
      else setCardProblem(explain(e));
    }
  };

  const create = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setInvoice(await session.vvakeInvoice());
      setNow(Date.now());
    } catch (e) {
      setProblem(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: "amount" | "address", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // no clipboard (permissions): the text is selectable
    }
  };

  const qr = useMemo(
    () => (invoice && invoice.status !== "paid" && isPayUri(invoice.payUri) ? encodeQr(invoice.payUri, { ecl: "M" }) : null),
    [invoice],
  );
  const date = (iso: string) =>
    Number.isFinite(Date.parse(iso)) ? formatDate(iso, { ...visitorDatePrefs(lang), timeZone: "UTC" }, "longDate") : iso;

  if (auth === "checking")
    return (
      <Section id="account" index={rewards.signIn.index} kicker={dict.signIn.kicker} title={dict.signIn.title}>
        <p className="mt-10 text-muted">{rewards.loading}</p>
      </Section>
    );
  if (auth === "out")
    return (
      <>
        <Notice notice={notice} dict={dict} plus={false} />
        <SignIn
          dict={{ ...rewards, signIn: { ...rewards.signIn, ...dict.signIn } }}
          session={session}
          onSignedIn={() => {
            setAuth("checking");
            void load();
          }}
        />
        <HowItWorks dict={dict} />
      </>
    );

  const plus = plusActive(billing?.plusUntil, now);
  // The account's own plan (Coach Premium for Premium and testers, else Coach Plus): from /v1/billing's tier when the
  // API sends it, else the tier the account page remembered for this tab.
  const tier = billing?.tier ?? (billing?.earlyTester ? "premium" : storedPlusTier());
  const plan = coachTierName(ownPlanTier(tier));
  const network = invoice?.network ?? quote?.network ?? billing?.vvakePay?.network;
  const testnet = network !== "mainnet";

  const byCard = billing?.subscription?.provider === "stripe" && billing.subscription.active;
  const cardShown = byCard || (!!billing?.stripe?.available && !(plus && billing?.plusSource === "apple"));

  return (
    <>
      <Notice notice={notice} dict={dict} plus={plus} />
      <Section
        id="account"
        index={dict.account.index}
        kicker={format(dict.account.kicker, { plan })}
        title={format(dict.account.title, { plan })}
      >
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-line bg-surface/60 p-6">
          <Logo plus={plus} plusLabel={plan} className="pr-4" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">
              {plus && billing?.plusUntil ? format(dict.account.active, { plan, date: date(billing.plusUntil) }) : dict.account.free}
            </p>
            {plus && billing?.plusSource === "apple" && <p className="mt-1 text-sm text-muted">{dict.account.appleSource}</p>}
            {plus && paidByCard(billing?.plusSource) && <p className="mt-1 text-sm text-muted">{dict.account.cardSource}</p>}
            <p className="mt-1 text-sm text-muted">
              {format(dict.account.signedInAs, { name: who })}{" "}
              <button
                type="button"
                className="text-faint underline underline-offset-4 hover:text-text"
                onClick={() => {
                  void session.signOut().then(() => {
                    rememberPlus(null);
                    setBilling(null);
                    setQuote(null);
                    setInvoice(null);
                    setAuth("out");
                  });
                }}
              >
                {dict.account.signOut}
              </button>
            </p>
          </div>
        </div>
      </Section>

      <Section id="pay" index={dict.pay.index} kicker={dict.pay.kicker} title={dict.pay.title}>
        <div className="mt-8 max-w-2xl rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
          {testnet && (
            <p className="mb-6 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{dict.testnet}</p>
          )}

          {billing && billing.vvakePay && !billing.vvakePay.available && !invoice && <p className="text-muted">{dict.pay.unavailable}</p>}

          {quote && !invoice && (
            <>
              <p className="font-display text-xl font-semibold">
                {format(dict.pay.price, {
                  list: usdText(quote.listUsd, lang),
                  usd: usdText(quote.usd, lang),
                  pct: discountText(quote.discountBps, lang),
                })}
              </p>
              <p className="mt-2 text-sm text-muted">{format(dict.pay.amount, { amount: tokensText(quote.amountTokens, lang) })}</p>
              <button type="button" className={cn(buttonClass("primary"), "mt-6")} disabled={busy} onClick={() => void create()}>
                {busy ? dict.pay.loading : plus ? dict.pay.addMonth : dict.pay.payMonth}
              </button>
            </>
          )}
          {!quote && !invoice && !problem && billing?.vvakePay?.available && <p className="text-muted">{dict.pay.loading}</p>}

          {invoice && paid && (
            <div className="space-y-3">
              <p className="font-display text-xl font-semibold text-volt-fg" role="status">
                {format(dict.pay.paid, { date: date(billing?.plusUntil ?? invoice.paidAt ?? invoice.expiresAt) })}
              </p>
              <p className="text-sm text-muted">{`${tokensText(invoice.amountTokens, lang)} VVAKE · ${usdText(invoice.usd, lang)}`}</p>
              <div className="flex flex-wrap gap-3">
                {isHttpsUrl(invoice.explorerUrl) && (
                  <a href={invoice.explorerUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}>
                    {dict.pay.receipt}
                  </a>
                )}
                <button type="button" className={buttonClass("ghost")} onClick={() => setInvoice(null)}>
                  {dict.pay.addMonth}
                </button>
              </div>
            </div>
          )}

          {invoice && !paid && (
            <div className="space-y-4">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                {qr && (
                  <div className="shrink-0 self-center rounded-xl bg-white p-2 sm:self-start">
                    <svg width={200} height={200} viewBox={`0 0 ${qr.size + 4} ${qr.size + 4}`} role="img" aria-label={dict.pay.qrLabel}>
                      <rect x={0} y={0} width={qr.size + 4} height={qr.size + 4} fill="#ffffff" />
                      <path d={qrPath(qr, 2)} fill="#000000" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <p className="font-display text-2xl font-semibold break-all tabular-nums select-all">{`${tokensText(invoice.amountTokens, lang)} VVAKE`}</p>
                  <p className="text-sm text-muted">
                    {`${usdText(invoice.listUsd, lang)} → ${usdText(invoice.usd, lang)} (${discountText(invoice.discountBps, lang)}) · `}
                    <span title={invoice.treasury}>{format(dict.pay.to, { address: shortAddress(invoice.treasury) })}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {format(dict.pay.network, { network: invoice.network ?? "", chainId: invoice.chainId })}
                  </p>
                  <p className="text-sm text-muted">{dict.pay.exact}</p>
                  {invoice.status === "open" && now > 0 ? (
                    <p
                      className="text-sm text-text"
                      role="status"
                    >{`${dict.pay.waiting} ${format(dict.pay.expiresIn, { time: countdown(invoice.expiresAt, now) })}`}</p>
                  ) : invoice.status === "expired" ? (
                    <p className="text-sm text-butter-fg">{dict.pay.expired}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {isPayUri(invoice.payUri) && (
                  <a href={invoice.payUri} className={buttonClass("primary")}>
                    {dict.pay.openWallet}
                  </a>
                )}
                <button type="button" className={buttonClass("ghost")} onClick={() => void copy("amount", invoice.amountTokens)}>
                  {copied === "amount" ? dict.pay.copied : dict.pay.copyAmount}
                </button>
                <button type="button" className={buttonClass("ghost")} onClick={() => void copy("address", invoice.treasury)}>
                  {copied === "address" ? dict.pay.copied : dict.pay.copyAddress}
                </button>
                {invoice.status === "expired" && (
                  <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={() => void create()}>
                    {dict.pay.newAmount}
                  </button>
                )}
              </div>
            </div>
          )}

          {problem && (
            <p className="mt-4 text-sm text-down-fg" role="alert">
              {problem}
            </p>
          )}
          <p className="mt-6 text-sm text-faint">{dict.safety}</p>
        </div>
      </Section>
      {cardShown && (
        <Section id="card" index={dict.card.index} kicker={dict.card.kicker} title={byCard ? dict.card.manageTitle : dict.card.title}>
          <div className="mt-8 max-w-2xl rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
            <p className="text-muted">{byCard ? dict.card.manageLead : dict.card.lead}</p>
            <button
              type="button"
              className={cn(buttonClass(byCard ? "ghost" : "primary"), "mt-6")}
              disabled={cardBusy}
              onClick={() => void toStripe(byCard ? "portal" : "checkout")}
            >
              {cardBusy ? dict.card.opening : byCard ? dict.card.manage : dict.card.subscribe}
            </button>
            {cardProblem && (
              <p className="mt-4 text-sm text-down-fg" role="alert">
                {cardProblem}
              </p>
            )}
            {!byCard && <p className="mt-6 text-sm text-faint">{dict.card.fine}</p>}
          </div>
        </Section>
      )}

      <HowItWorks dict={dict} />
    </>
  );
}

/** Back from Stripe's checkout: what happened, in one line (the page below shows Plus once the API has it). */
function Notice({ notice, dict, plus }: { notice?: "success" | "cancel"; dict: Dict; plus: boolean }) {
  if (!notice) return null;
  const text = notice === "cancel" ? dict.card.cancelled : plus ? dict.card.done : dict.card.finishing;
  return (
    <Section
      id="checkout"
      index="00"
      kicker={dict.card.kicker}
      title={notice === "cancel" ? dict.card.cancelledTitle : dict.card.doneTitle}
    >
      <p
        className={cn(
          "mt-8 max-w-2xl rounded-xl border px-4 py-3 text-sm",
          notice === "cancel" ? "border-line bg-surface/60 text-muted" : "border-volt-fg/30 bg-volt/10 text-volt-fg",
        )}
        role="status"
      >
        {text}
      </p>
    </Section>
  );
}

function HowItWorks({ dict }: { dict: Dict }) {
  return (
    <Section id="how" index="05" kicker={dict.pay.kicker} title={dict.pay.howTitle}>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {dict.pay.how.map((p, i) => (
          <li key={p} className="rounded-2xl border border-line bg-surface/60 p-6">
            <p className="font-mono text-xs text-pulse-fg">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
