"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { xShareUrl } from "@/lib/referral";
import { parseReferralCode, referralAppUrl, referralLinkUrl } from "@/lib/referralLink";

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; code: string };

/** A friend's invite for people without the app: the code to enter at sign-up, open-in-app and early access. */
export function ReferralInvite({
  dict,
  appScheme,
  joinHref,
  origin,
}: {
  dict: Dictionary["referral"];
  appScheme: string;
  joinHref: string;
  /** The site's origin, for the invite link shared on X (vvake.com/r/<code>). */
  origin: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = parseReferralCode(window.location.hash);
    const id = window.setTimeout(() => setState(code ? { kind: "ready", code } : { kind: "invalid" }), 0);
    return () => window.clearTimeout(id);
  }, []);

  const copy = (code: string) => {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10">
      <LogoMark className="mx-auto h-14 text-text" />
      <h1 className="mt-6 font-display text-3xl leading-tight font-semibold sm:text-4xl">{dict.title}</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">{dict.about}</p>

      <div aria-live="polite" className="mt-6 min-h-14">
        {state.kind === "invalid" && <p className="text-muted">{dict.invalid}</p>}
        {state.kind === "ready" && (
          <>
            <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.code}</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.12em] text-pulse-fg select-all sm:text-5xl">{state.code}</p>
            <button type="button" onClick={() => copy(state.code)} className={`mt-3 ${buttonClass("ghost")}`}>
              {copied ? dict.copied : dict.copy}
            </button>
          </>
        )}
      </div>

      {state.kind === "ready" && <p className="mx-auto mt-6 max-w-md leading-relaxed text-text">{dict.steps}</p>}
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">{dict.bonus}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {state.kind === "ready" && (
          <a href={referralAppUrl(appScheme, state.code)} className={buttonClass("primary")}>
            {dict.open}
          </a>
        )}
        <a href={joinHref} className={buttonClass(state.kind === "ready" ? "ghost" : "primary")}>
          {dict.join}
        </a>
        {state.kind === "ready" && (
          // Pass the invite on: the same post the app writes, with this code's link.
          <a
            href={xShareUrl(dict.shareText, referralLinkUrl(origin, state.code))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost")}
          >
            {dict.shareX}
          </a>
        )}
      </div>
      <p className="mx-auto mt-6 max-w-md text-sm text-faint">{dict.noApp}</p>
    </div>
  );
}
