"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { clashClock, formatCountdown, formatScore, readClashFeed, REFRESH_MS, tugShare, type Clash, type ClashStatus } from "@/lib/clashes";

type Dict = Dictionary["clashes"];
type Lang = "en" | "fr";

export type FeedState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; clashes: Clash[] };

/**
 * The public clash feed, fetched in the browser (static site): refreshed every minute while the tab is visible, and
 * right away when it becomes visible again. `now` ticks every second on the server's clock (Date.now() + the offset
 * measured at the last fetch). A failed refresh keeps the last good list; a failed first fetch is an error state.
 */
export function useClashFeed(apiUrl: string): { state: FeedState; now: number } {
  const [state, setState] = useState<FeedState>({ kind: "loading" });
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!apiUrl) {
      const id = window.setTimeout(() => setState({ kind: "error" }), 0);
      return () => window.clearTimeout(id);
    }
    let alive = true;
    let lastFetch = 0;
    let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort();
      const c = new AbortController();
      controller = c;
      const timeout = window.setTimeout(() => c.abort(), 8000);
      lastFetch = Date.now();
      try {
        const res = await fetch(`${apiUrl}/v1/public/clashes`, { signal: c.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        const feed = readClashFeed(await res.json(), Date.now());
        if (!alive) return;
        setOffset(feed.offsetMs);
        setState({ kind: "ready", clashes: feed.clashes });
      } catch {
        if (alive) setState((s) => (s.kind === "ready" ? s : { kind: "error" }));
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastFetch >= REFRESH_MS) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apiUrl]);

  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offset]);

  return { state, now };
}

const CHIP: Record<ClashStatus, string> = {
  live: "border-pulse-fg/60 text-pulse-fg",
  buildup: "border-sky-fg/50 text-sky-fg",
  provisional: "border-butter-fg/50 text-butter-fg",
};

/** One clash: the two cities and their scores, the tug bar, the status and its clock. */
export function ClashCard({ clash, now, dict, lang }: { clash: Clash; now: number; dict: Dict; lang: Lang }) {
  const { a, b } = clash;
  const share = tugShare(a.score, b.score);
  const sa = formatScore(a.score, lang);
  const sb = formatScore(b.score, lang);
  const clock = clashClock(clash, now);
  const time = clock.kind === "resultsSoon" ? "" : formatCountdown(clock.ms);
  return (
    <article
      aria-label={format(dict.cardLabel, { a: a.city, b: b.city })}
      className="min-w-0 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-[0.15em] uppercase",
            CHIP[clash.status],
          )}
        >
          {clash.status === "live" && <span aria-hidden="true" className="h-2 w-2 animate-pulse-glow rounded-full bg-pulse" />}
          {dict.status[clash.status]}
        </span>
        {clock.kind === "resultsSoon" ? (
          <span className="font-mono text-sm text-muted">{dict.resultsSoon}</span>
        ) : (
          <span
            role="timer"
            aria-label={format(clock.kind === "endsIn" ? dict.timerEnds : dict.timerStarts, { time })}
            className="font-mono text-sm text-text tabular-nums"
          >
            {format(clock.kind === "endsIn" ? dict.endsIn : dict.startsIn, { time })}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <p className="min-w-0">
          <span className="sr-only">{format(dict.sideLabel, { city: a.city, score: sa })}</span>
          <span aria-hidden="true" className="block font-display text-lg leading-tight font-semibold break-words sm:text-xl">
            {a.city}
          </span>
          <span aria-hidden="true" className="mt-1 block font-mono text-2xl font-semibold text-pulse-fg tabular-nums">
            {sa} <span className="text-xs text-faint">{dict.points}</span>
          </span>
        </p>
        <span aria-hidden="true" className="pb-1 font-display text-base font-bold text-faint italic">
          {dict.vs}
        </span>
        <p className="min-w-0 text-right">
          <span className="sr-only">{format(dict.sideLabel, { city: b.city, score: sb })}</span>
          <span aria-hidden="true" className="block font-display text-lg leading-tight font-semibold break-words sm:text-xl">
            {b.city}
          </span>
          <span aria-hidden="true" className="mt-1 block font-mono text-2xl font-semibold text-calm-fg tabular-nums">
            {sb} <span className="text-xs text-faint">{dict.points}</span>
          </span>
        </p>
      </div>

      <div
        role="img"
        aria-label={format(dict.barLabel, { a: a.city, sa, b: b.city, sb })}
        className="relative mt-4 flex h-3 overflow-hidden rounded-full bg-calm"
      >
        <div className="h-full bg-pulse transition-[width] duration-700 ease-out" style={{ width: `${(share * 100).toFixed(1)}%` }} />
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-night/60" />
      </div>
    </article>
  );
}

export function ClashList({ clashes, now, dict, lang }: { clashes: Clash[]; now: number; dict: Dict; lang: Lang }) {
  return (
    <ul aria-label={dict.list} className="grid gap-4 md:grid-cols-2">
      {clashes.map((c) => (
        <li key={c.id} className="min-w-0">
          <ClashCard clash={c} now={now} dict={dict} lang={lang} />
        </li>
      ))}
    </ul>
  );
}

/** The /clashes page body: loading, a short error line, the empty state, or the list. */
export function ClashBoardView({ state, now, dict, lang }: { state: FeedState; now: number; dict: Dict; lang: Lang }) {
  if (state.kind === "loading") return <p className="text-muted">{dict.loading}</p>;
  if (state.kind === "error") return <p className="text-muted">{dict.error}</p>;
  if (state.clashes.length === 0)
    return (
      <div className="rounded-3xl border border-dashed border-line p-8 text-center sm:p-12">
        <p className="font-display text-lg font-semibold">{dict.empty}</p>
      </div>
    );
  return (
    <>
      <ClashList clashes={state.clashes} now={now} dict={dict} lang={lang} />
      <p className="mt-6 text-sm text-faint">{dict.note}</p>
    </>
  );
}

export function ClashBoard({ apiUrl, dict, lang }: { apiUrl: string; dict: Dict; lang: Lang }) {
  const { state, now } = useClashFeed(apiUrl);
  return (
    <div aria-busy={state.kind === "loading"}>
      <ClashBoardView state={state} now={now} dict={dict} lang={lang} />
    </div>
  );
}

/** Home page: up to four clashes and a link to the rest; nothing at all unless a clash is on (or loading fails). */
export function HomeLiveClashesView({
  state,
  now,
  dict,
  lang,
  href,
}: {
  state: FeedState;
  now: number;
  dict: Dict;
  lang: Lang;
  href: string;
}) {
  if (state.kind !== "ready" || state.clashes.length === 0) return null;
  const shown = state.clashes.slice(0, 4);
  return (
    <Section id="live-clashes" kicker={dict.kicker} title={dict.title} lead={dict.lead} layout="split" nav={dict.kicker}>
      <div className="mt-10">
        <ClashList clashes={shown} now={now} dict={dict} lang={lang} />
        <p className="mt-6">
          <a href={href} className="font-display text-sm font-semibold text-pulse-fg underline-offset-4 hover:underline">
            {dict.seeAll} <span aria-hidden="true">→</span>
          </a>
        </p>
      </div>
    </Section>
  );
}

export function HomeLiveClashes({ apiUrl, dict, lang, href }: { apiUrl: string; dict: Dict; lang: Lang; href: string }) {
  const { state, now } = useClashFeed(apiUrl);
  return <HomeLiveClashesView state={state} now={now} dict={dict} lang={lang} href={href} />;
}
