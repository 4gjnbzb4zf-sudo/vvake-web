"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { claudeAppUrl, parseClaudeCode } from "@/lib/claudeLink";

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; code: string };

/** Hands a Claude Code link code over to the VVake app (custom scheme), with early access for people without it. */
export function ClaudeLink({ dict, appScheme, joinHref }: { dict: Dictionary["claude"]; appScheme: string; joinHref: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const code = parseClaudeCode(window.location.hash);
    const id = window.setTimeout(() => setState(code ? { kind: "ready", code } : { kind: "invalid" }), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10">
      <LogoMark className="mx-auto h-14 text-text" />
      <h1 className="mt-6 font-display text-3xl leading-tight font-semibold sm:text-4xl">{dict.title}</h1>

      <div aria-live="polite" className="mt-4 min-h-14">
        {state.kind === "invalid" && <p className="text-muted">{dict.invalid}</p>}
        {state.kind === "ready" && (
          <>
            <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.code}</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.12em] text-pulse-fg sm:text-5xl">{state.code}</p>
          </>
        )}
      </div>

      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">{dict.lead}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {state.kind === "ready" && (
          <a href={claudeAppUrl(appScheme, state.code)} className={buttonClass("primary")}>
            {dict.open}
          </a>
        )}
        <a href={joinHref} className={buttonClass(state.kind === "ready" ? "ghost" : "primary")}>
          {dict.join}
        </a>
      </div>
      <p className="mx-auto mt-6 max-w-md text-sm text-faint">{dict.noApp}</p>
    </div>
  );
}
