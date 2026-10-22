"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { TrainingsDict } from "@/i18n/trainings";
import { publicTrainings } from "@/lib/trainings/api";
import { fmt } from "@/i18n/webapp";
import { count, type CreatorCard, type TrainingCard } from "@/lib/trainings/data";
import { parseHandle } from "@/lib/trainings/link";
import { TrainingCardRow } from "./TrainingView";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "offline" }
  | { kind: "ready"; creator: CreatorCard; trainings: TrainingCard[]; weekAthletes: number | null };

/**
 * A creator's public page (vvake.com/<lang>/coach/#<handle>): their name, bio, followers, joins and coach score, and
 * their public trainings, from the public GET /v1/creators/:handle. Profiles are opt-in: a private one is a 404.
 */
export function CreatorPage({ d, lang, apiUrl }: { d: TrainingsDict; lang: "en" | "fr"; apiUrl: string }) {
  const c = d.creator;
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    const handle = parseHandle(window.location.hash);
    if (!handle) return setState({ kind: "invalid" });
    setState({ kind: "loading" });
    const r = await publicTrainings(apiUrl).creator(handle);
    if ("creator" in r) setState({ kind: "ready", creator: r.creator, trainings: r.trainings, weekAthletes: r.weekAthletes });
    else setState({ kind: r.status === 0 ? "offline" : "missing" });
  }, [apiUrl]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    const onHash = () => void load();
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("hashchange", onHash);
    };
  }, [load]);

  if (state.kind !== "ready")
    return (
      <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10" aria-live="polite">
        <p className="font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">{c.kicker}</p>
        <p className="mt-4 text-muted">
          {state.kind === "loading"
            ? c.loading
            : state.kind === "invalid"
              ? c.invalid
              : state.kind === "missing"
                ? c.notFound
                : d.share.offline}
        </p>
        {state.kind === "offline" && (
          <button type="button" className={buttonClass("ghost", "mt-4")} onClick={() => void load()}>
            {d.share.retry}
          </button>
        )}
      </div>
    );

  const { creator: p, trainings, weekAthletes } = state;
  // Most trained first: what people come back to leads the list.
  const sorted = [...trainings].sort((a, b) => b.athletes - a.athletes);
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface/60">
      <div className="relative bg-night p-5 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(255,61,110,0.28),transparent_60%)]"
        />
        <div className="relative">
          <p className="inline-flex rounded-full border border-volt-fg/45 bg-surface/90 px-3 py-1 font-mono text-xs tracking-[0.16em] text-volt-fg uppercase">
            {c.kicker}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold break-words sm:text-4xl">{p.name}</h1>
          <p className="mt-1 text-muted">
            @{p.handle}
            {p.city ? ` · ${p.city}` : ""}
          </p>
          {weekAthletes !== null && (
            <p className="mt-3 font-display text-lg font-semibold text-volt-fg">
              {fmt(weekAthletes === 0 ? c.weekNone : weekAthletes === 1 ? c.weekOne : c.week, {
                n: count(weekAthletes, lang),
                handle: p.handle,
              })}
            </p>
          )}
          {p.bio && <p className="mt-4 leading-relaxed break-words">{p.bio}</p>}
        </div>
      </div>
      <div className="p-5 sm:p-10 sm:pt-6">
        <dl className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              [c.followers, p.followers],
              [c.joins, p.joins],
              [c.coachScore, p.coachScore],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-2xl border border-line bg-surface p-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{count(v, lang)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-faint">{c.scoreNote}</p>
        <h2 className="mt-6 font-mono text-xs tracking-[0.16em] text-faint uppercase">{c.trainings}</h2>
        <div className="mt-2 space-y-2">
          {sorted.length ? (
            sorted.map((t) => (
              <TrainingCardRow
                key={t.id}
                name={t.name}
                minutes={t.minutes}
                level={t.level}
                athletes={t.athletes}
                d={d}
                lang={lang}
                href={t.code ? `/${lang}/t/#${t.code}` : undefined}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{c.none}</p>
          )}
        </div>
        <a href={`/${lang}/app/#/creator/${p.handle}`} className={buttonClass("ghost", "mt-6")}>
          {c.follow}
        </a>
        <p className="mt-2 text-xs text-faint">{c.followHint}</p>
      </div>
    </div>
  );
}
