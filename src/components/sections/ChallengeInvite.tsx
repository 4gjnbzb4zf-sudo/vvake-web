"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";
import { format, type Dictionary } from "@/i18n/dictionaries";
import {
  challengeAppUrl,
  challengeLinkUrl,
  countdown,
  parseChallengeCode,
  prettyChallengeCode,
  readPreview,
  takeable,
  targetResult,
  targetTitle,
  type ChallengePreview,
} from "@/lib/challengeLink";
import { xShareUrl } from "@/lib/referral";

type Dict = Dictionary["challenge"];
type Metric = keyof Dict["metrics"];

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; code: string; preview: ChallengePreview | null };

/**
 * A challenge link for people without the app (or before it opens): who challenges you and on what. A 24-hour
 * challenge ("beat my mark") shows the mark, that the 24 h start at Accept in the app, a live countdown of the time
 * left to accept, and for an open one the board of who beat it. Open in VVake, get VVake (the public TestFlight / App
 * Store link from siteConfig, else early access), the code to type in the app. The API preview is a bonus: any
 * failure (offline, CORS, timeout) just leaves it out.
 */
export function ChallengeInvite({
  dict,
  lang,
  apiUrl,
  appScheme,
  getHref,
  origin,
}: {
  dict: Dict;
  lang: "en" | "fr";
  apiUrl: string;
  appScheme: string;
  /** Get VVake: the public TestFlight / App Store link, or early access. */
  getHref: string;
  origin: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const code = parseChallengeCode(window.location.hash);
    const controller = new AbortController();
    if (!code) {
      const id = window.setTimeout(() => setState({ kind: "invalid" }), 0);
      return () => window.clearTimeout(id);
    }
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    fetch(`${apiUrl}/v1/challenges/code/${code}`, { signal: controller.signal, headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((json) => setState({ kind: "ready", code, preview: readPreview(json) }))
      .finally(() => window.clearTimeout(timeout));
    return () => controller.abort();
  }, [apiUrl]);

  // The live countdown (time left to accept).
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const p = state.kind === "ready" ? state.preview : null;
  const code = state.kind === "ready" ? state.code : null;
  const t = p?.target ?? null;
  const open = p ? takeable(p, now) : true;
  const mark = t ? targetTitle(t, lang) : null;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const statusText = { won: dict.statusWon, accepted: dict.statusRacing, lost: dict.statusLost };

  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10">
      <LogoMark className="mx-auto h-14 text-text" />
      <h1 className="mt-6 font-display text-3xl leading-tight font-semibold sm:text-4xl">{t ? dict.targetTitle : dict.title}</h1>

      <div aria-live="polite" className="mt-4 min-h-14">
        {state.kind === "loading" && <p className="text-muted">{dict.loading}</p>}
        {state.kind === "invalid" && <p className="text-muted">{dict.invalid}</p>}
        {p && (
          <>
            <p className="font-display text-xl font-semibold text-pulse-fg">{format(t ? dict.challenges : dict.from, { name: p.name })}</p>
            {mark ? (
              <p className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{mark}</p>
            ) : (
              p.metric &&
              p.hours &&
              p.metric in dict.metrics && (
                <p className="mt-1 text-muted">{format(dict.metric, { metric: dict.metrics[p.metric as Metric], hours: p.hours })}</p>
              )
            )}
            {t?.kind === "ghost" && <p className="mt-1 text-sm text-muted">{dict.ghost}</p>}
          </>
        )}
      </div>

      {t && p && open && (
        <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-mono text-3xl font-semibold tabular-nums">24:00:00</p>
            <p className="mt-1 text-xs text-muted">{dict.clockLabel}</p>
          </div>
          {p.expiresAt && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-mono text-3xl font-semibold tabular-nums">{countdown(Date.parse(p.expiresAt) - now)}</p>
              <p className="mt-1 text-xs text-muted">
                {dict.acceptBy} · {format(dict.acceptByDate, { date: date(p.expiresAt) })}
              </p>
            </div>
          )}
        </div>
      )}
      {p && !open && (
        <p className="mx-auto mt-6 max-w-md text-muted">{dict.gone[(p.status ?? "expired") as keyof Dict["gone"]] ?? dict.gone.expired}</p>
      )}

      {t && p?.open && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-surface p-4 text-left">
          <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.openLabel}</p>
          {p.participants && (
            <p className="mt-1 text-text">{format(dict.openCounts, { accepted: p.participants.accepted, won: p.participants.won })}</p>
          )}
          {p.board.length ? (
            <ol className="mt-3 space-y-1">
              {p.board.map((b, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {b.status === "won" ? "🏆 " : ""}
                    {b.name}
                  </span>
                  <span className="text-muted tabular-nums">{targetResult(t, b.best, lang) ?? statusText[b.status]}</span>
                </li>
              ))}
            </ol>
          ) : (
            p.participants?.accepted === 0 && <p className="mt-2 text-sm text-muted">{dict.boardEmpty}</p>
          )}
          {p.hidden > 0 && <p className="mt-2 text-xs text-faint">{format(dict.openHidden, { n: p.hidden })}</p>}
        </div>
      )}

      <p className="mx-auto mt-6 max-w-md leading-relaxed text-muted">{t ? dict.wins : dict.lead}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {code && open && (
          <a href={challengeAppUrl(appScheme, code)} className={buttonClass("primary")}>
            {dict.open}
          </a>
        )}
        <a href={getHref} className={buttonClass(code && open ? "ghost" : "primary")}>
          {getHref.startsWith("http") ? dict.get : dict.join}
        </a>
        {code && p?.open && open && mark && (
          <a
            href={xShareUrl(format(dict.shareText, { name: p.name, mark }), challengeLinkUrl(origin, code))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost")}
          >
            {dict.shareX}
          </a>
        )}
      </div>

      {code && open && (
        <div className="mx-auto mt-8 max-w-md text-left">
          <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.steps}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
            <li>{dict.step1}</li>
            <li>{format(dict.step2, { code: prettyChallengeCode(code) })}</li>
            <li>{dict.step3}</li>
          </ol>
        </div>
      )}
      {code && (
        <p className="mt-4 font-mono text-xs tracking-[0.16em] text-faint uppercase">
          {dict.code} · {prettyChallengeCode(code)}
        </p>
      )}
      <p className="mx-auto mt-6 max-w-md text-sm text-faint">{dict.noApp}</p>
      {t && <p className="mx-auto mt-2 max-w-md text-xs text-faint">{dict.privacy}</p>}
    </div>
  );
}
