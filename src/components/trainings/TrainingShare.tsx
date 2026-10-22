"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fmt } from "@/i18n/webapp";
import type { TrainingsDict } from "@/i18n/trainings";
import { countdown } from "@/lib/challengeLink";
import { RewardsSession } from "@/lib/rewardsApi";
import { publicTrainings, trainingsApi } from "@/lib/trainings/api";
import {
  challengeProgress,
  challengeStage,
  count,
  type ChallengeBoard,
  type ChallengeStage,
  type SharedTraining,
} from "@/lib/trainings/data";
import { cn } from "@/lib/cn";
import { creatorPageUrl, readShareLocation, trainingAppUrl, trainingShareUrl, trainingWebRunUrl } from "@/lib/trainings/link";
import { TrainingView } from "./TrainingView";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "offline" }
  | { kind: "ready"; shared: SharedTraining; code: string };

/**
 * A shared custom training (vvake.com/<lang>/t/#<CODE>, forwarded from /<lang>/t/<CODE> by the 404 page): fetched in
 * the browser from the public GET /v1/t/:code. Open in the app (its own scheme), or run it right here with the webcam
 * (the web app's camera workout). With ?c=<CHALLENGE>: the challenge's leaderboard and a join button for people
 * signed in on VVake web. Nothing personal: names only for members who chose to show theirs.
 */
export function TrainingShare({
  d,
  lang,
  apiUrl,
  appScheme,
  origin,
}: {
  d: TrainingsDict;
  lang: "en" | "fr";
  apiUrl: string;
  appScheme: string;
  origin: string;
}) {
  const s = d.share;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [challenge, setChallenge] = useState<string | null>(null);
  const [board, setBoard] = useState<ChallengeBoard | null | "missing">(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const loc = readShareLocation(window.location.hash, window.location.search);
    setChallenge(loc.challenge);
    if (!loc.code) return setState({ kind: "invalid" });
    setState({ kind: "loading" });
    const api = publicTrainings(apiUrl);
    const [r, b] = await Promise.all([api.shared(loc.code), loc.challenge ? api.board(loc.challenge) : Promise.resolve(null)]);
    if ("training" in r) setState({ kind: "ready", shared: r, code: r.code ?? loc.code });
    else setState({ kind: r.status === 0 ? "offline" : "missing" });
    if (loc.challenge) setBoard(b ?? "missing");
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

  // The challenge's countdown.
  useEffect(() => {
    if (!board || board === "missing") return;
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [board]);

  if (state.kind !== "ready")
    return (
      <div className="rounded-3xl border border-line bg-surface/60 p-6 text-center sm:p-10" aria-live="polite">
        <p className="font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">{s.kicker}</p>
        <p className="mt-4 text-muted">
          {state.kind === "loading" ? s.loading : state.kind === "invalid" ? s.invalid : state.kind === "missing" ? s.notFound : s.offline}
        </p>
        {state.kind === "offline" && (
          <button type="button" className={buttonClass("ghost", "mt-4")} onClick={() => void load()}>
            {s.retry}
          </button>
        )}
        <p className="mx-auto mt-6 max-w-md text-sm text-faint">{s.noApp}</p>
      </div>
    );

  const { shared, code } = state;
  const shareUrl = trainingShareUrl(origin, lang, code, challenge);
  const creator = shared.creator.handle ? (
    <a className="underline" href={creatorPageUrl(lang, shared.creator.handle)}>
      {fmt(s.by, { name: shared.creator.name })} · @{shared.creator.handle}
    </a>
  ) : (
    fmt(s.by, { name: shared.creator.name })
  );

  const stats = shared.stats;
  const context =
    stats.athletes > 0
      ? fmt(s.challenge.context, {
          people: fmt(stats.athletes === 1 ? s.challenge.person : s.challenge.people, { n: count(stats.athletes, lang) }),
          score: count(stats.coachScore, lang),
        })
      : s.challenge.first;

  return (
    <div className="space-y-6">
      {challenge && (
        <ChallengePanel
          d={s}
          code={challenge}
          board={board}
          apiUrl={apiUrl}
          appScheme={appScheme}
          lang={lang}
          trainingCode={code}
          trainingName={shared.training.name}
          context={context}
          now={now}
        />
      )}
      <div className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-10">
        <TrainingView training={shared.training} creator={creator} stats={stats} lang={lang} d={s} />
        {!challenge && <p className="mt-3 text-sm text-muted">{context}</p>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {/* With a challenge, its own button is the one clear call; these stay quiet. */}
          <a href={trainingWebRunUrl(lang, code, challenge)} className={buttonClass(challenge ? "ghost" : "primary")}>
            {s.run}
          </a>
          <a href={trainingAppUrl(appScheme, code, challenge)} className={buttonClass("ghost")}>
            {s.open}
          </a>
          <button
            type="button"
            className={buttonClass("ghost")}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(shareUrl)
                .then(() => setCopied(true))
                .catch(() => undefined);
            }}
          >
            {copied ? s.copied : s.copy}
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">{s.runNote}</p>
        <p className="mt-6 text-sm text-faint">{s.noApp}</p>
        <p className="mt-2 text-xs text-faint">{s.privacy}</p>
      </div>
    </div>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];

const STAGE_TONE: Record<ChallengeStage, string> = {
  live: "border-volt-fg/45 text-volt-fg",
  closing: "border-butter-fg/50 text-butter-fg",
  ended: "border-line text-muted",
};

/**
 * The challenge as the hero of the page (?c=<CODE>): live with its countdown and how much of the time is gone, its last
 * hours, then the result with whoever leads and a rematch. One clear call each time: join while it runs (signed in on
 * VVake web, or through the web app's sign-in), run it once joined, start a rematch once it's over. Only the API's
 * board is shown: an empty board says so instead of inventing anyone.
 */
function ChallengePanel({
  d,
  code,
  board,
  apiUrl,
  appScheme,
  lang,
  trainingCode,
  trainingName,
  context,
  now,
}: {
  d: TrainingsDict["share"];
  code: string;
  board: ChallengeBoard | null | "missing";
  apiUrl: string;
  appScheme: string;
  lang: "en" | "fr";
  trainingCode: string;
  trainingName: string;
  context: string;
  now: number;
}) {
  const c = d.challenge;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSignedIn(RewardsSession.hasStored("local")), 0);
    return () => window.clearTimeout(id);
  }, []);
  const [showName, setShowName] = useState(true);
  const [joined, setJoined] = useState<"no" | "busy" | "yes" | "error" | "signin">("no");

  const join = async () => {
    setJoined("busy");
    try {
      await trainingsApi(new RewardsSession(apiUrl, "local")).joinChallenge(code, showName);
      setJoined("yes");
    } catch (e) {
      setJoined((e as { status?: number }).status === 401 ? "signin" : "error");
    }
  };

  const shell = (body: ReactNode) => (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-night p-5 sm:p-8" aria-live="polite">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(255,61,110,0.28),transparent_60%)]"
      />
      <div className="relative">{body}</div>
    </section>
  );

  if (board === null || board === "missing")
    return shell(
      <>
        <p className="font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">{c.kicker}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold break-words">{trainingName}</h2>
        <p className="mt-2 text-sm text-muted">{board === null ? d.loading : c.notFound}</p>
      </>,
    );

  const stage = challengeStage(board, now);
  const left = board.endsAt && now ? Date.parse(board.endsAt) - now : null;
  const progress = challengeProgress(board, now);
  const top = board.leaderboard[0];
  const rows = board.leaderboard.slice(0, 20);
  const appJoin = `/${lang}/app/#/training/${trainingCode}/${code}`;

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border bg-surface/90 px-3 py-1 font-mono text-xs tracking-[0.16em] uppercase",
            STAGE_TONE[stage],
          )}
        >
          {stage !== "ended" && (
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
          )}
          {stage === "live" ? c.live : stage === "closing" ? c.closing : c.final}
        </span>
        <span className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{c.kicker}</span>
      </div>
      <h2 className="mt-3 font-display text-3xl leading-tight font-semibold break-words sm:text-4xl">
        {board.training.name || trainingName}
      </h2>
      <p className="mt-1 text-sm text-muted">{context}</p>

      {stage !== "ended" ? (
        <div className="mt-5">
          <p className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
            {left !== null ? countdown(left) : "--:--:--"}
            <span className="ml-2 font-sans text-sm font-normal text-muted">{c.left}</span>
          </p>
          {progress !== null && (
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label={c.timeGone}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className={cn("h-full rounded-full", stage === "closing" ? "bg-butter" : "bg-volt")}
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-sm text-muted tabular-nums">
            {fmt(c.members, { n: count(board.members, lang) })}
            {stage === "closing" ? ` · ${c.closingNote}` : ""}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-volt-fg/40 bg-surface/90 p-4">
          <p className="text-sm text-muted">{c.endedNote}</p>
          <p className="mt-2 font-display text-2xl font-semibold break-words">
            {top && top.score > 0 ? `🏆 ${fmt(c.winner, { name: top.name ?? c.someone, score: top.score })}` : c.noWinner}
          </p>
          <p className="mt-1 text-sm text-muted tabular-nums">{fmt(c.members, { n: count(board.members, lang) })}</p>
        </div>
      )}

      <h3 className="mt-6 font-mono text-xs tracking-[0.16em] text-faint uppercase">{c.board}</h3>
      {rows.length ? (
        <ol className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className={cn("rounded-2xl border bg-surface/90 px-3 py-2", i === 0 && r.score > 0 ? "border-volt-fg/40" : "border-line")}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 shrink-0 text-center tabular-nums">{r.score > 0 && i < 3 ? MEDAL[i] : i + 1}</span>
                  <span className="truncate font-semibold">{r.name ?? c.someone}</span>
                  {i === 0 && r.score > 0 && stage !== "ended" && (
                    <span className="shrink-0 rounded-full bg-volt/20 px-2 py-0.5 text-[11px] text-volt-fg">{c.leading}</span>
                  )}
                </span>
                <span className="shrink-0 text-muted tabular-nums">{fmt(c.score, { n: r.score })}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className={cn("h-full rounded-full", i === 0 ? "bg-volt" : "bg-pulse/70")} style={{ width: `${r.score / 10}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{c.empty}</p>
      )}

      <div className="mt-6">
        {stage === "ended" ? (
          <>
            <a href={`/${lang}/app/#/training/${trainingCode}`} className={buttonClass("primary", "w-full sm:w-auto")}>
              {c.rematch}
            </a>
            <p className="mt-2 text-sm text-muted">{c.rematchNote}</p>
          </>
        ) : joined === "yes" ? (
          <>
            <p className="text-sm text-volt-fg">{c.joined}</p>
            <a href={trainingWebRunUrl(lang, trainingCode, code)} className={buttonClass("primary", "mt-3 w-full sm:w-auto")}>
              {c.runNow}
            </a>
          </>
        ) : signedIn && joined !== "signin" ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-5 w-5" />
              {c.showName}
            </label>
            <button
              type="button"
              className={buttonClass("primary", "w-full sm:w-auto")}
              disabled={joined === "busy"}
              onClick={() => void join()}
            >
              {c.join}
            </button>
            {joined === "error" && <p className="text-sm text-down-fg">{c.error}</p>}
          </div>
        ) : (
          <>
            <a href={appJoin} className={buttonClass("primary", "w-full sm:w-auto")}>
              {c.join}
            </a>
            <p className="mt-2 text-sm">
              <a className="text-muted underline" href={trainingAppUrl(appScheme, trainingCode, code)}>
                {c.inApp}
              </a>
            </p>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-faint">{c.rule}</p>
    </>,
  );
}
