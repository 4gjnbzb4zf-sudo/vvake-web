"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { challengeAppUrl, parseChallengeCode } from "@/lib/challengeLink";

type Dict = Dictionary["challenge"];
type Metric = keyof Dict["metrics"];

interface Preview {
  name: string;
  metric: Metric | null;
  hours: number | null;
}

/** Reads only the fields the page shows; anything unexpected means "no preview". */
function readPreview(json: unknown, metrics: Dict["metrics"]): Preview | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { from?: { name?: unknown } | null; metric?: unknown; windowHours?: unknown };
  const name = typeof j.from?.name === "string" ? j.from.name.slice(0, 40) : null;
  if (!name) return null;
  const metric = typeof j.metric === "string" && j.metric in metrics ? (j.metric as Metric) : null;
  const hours = typeof j.windowHours === "number" && j.windowHours > 0 ? j.windowHours : null;
  return { name, metric, hours };
}

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; code: string; preview: Preview | null };

/**
 * The invite for people without the app: open-in-app (custom scheme) and early access. The API preview (who sent it,
 * on what) is a bonus: any failure (not deployed, signed-in only, CORS, timeout) just leaves it out.
 */
export function ChallengeInvite({
  dict,
  apiUrl,
  appScheme,
  joinHref,
}: {
  dict: Dict;
  apiUrl: string;
  appScheme: string;
  joinHref: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

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
      .then((json) => setState({ kind: "ready", code, preview: readPreview(json, dict.metrics) }))
      .finally(() => window.clearTimeout(timeout));
    return () => controller.abort();
  }, [apiUrl, dict.metrics]);

  const preview = state.kind === "ready" ? state.preview : null;
  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10">
      <LogoMark className="mx-auto h-14 text-text" />
      <h1 className="mt-6 font-display text-3xl leading-tight font-semibold sm:text-4xl">{dict.title}</h1>

      <div aria-live="polite" className="mt-4 min-h-14">
        {state.kind === "loading" && <p className="text-muted">{dict.loading}</p>}
        {state.kind === "invalid" && <p className="text-muted">{dict.invalid}</p>}
        {preview && (
          <>
            <p className="font-display text-xl font-semibold text-pulse-fg">{format(dict.from, { name: preview.name })}</p>
            {preview.metric && preview.hours && (
              <p className="mt-1 text-muted">{format(dict.metric, { metric: dict.metrics[preview.metric], hours: preview.hours })}</p>
            )}
          </>
        )}
        {state.kind === "ready" && (
          <p className="mt-2 font-mono text-xs tracking-[0.16em] text-faint uppercase">
            {dict.code} · {state.code}
          </p>
        )}
      </div>

      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">{dict.lead}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {state.kind === "ready" && (
          <a href={challengeAppUrl(appScheme, state.code)} className={buttonClass("primary")}>
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
