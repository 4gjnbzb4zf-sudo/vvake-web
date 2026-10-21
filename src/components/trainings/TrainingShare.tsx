"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fmt } from "@/i18n/webapp";
import type { TrainingsDict } from "@/i18n/trainings";
import { countdown } from "@/lib/challengeLink";
import { RewardsSession } from "@/lib/rewardsApi";
import { publicTrainings, trainingsApi } from "@/lib/trainings/api";
import type { ChallengeBoard, SharedTraining } from "@/lib/trainings/data";
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

  return (
    <div className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-10">
      <TrainingView training={shared.training} creator={creator} stats={shared.stats} lang={lang} d={s} />

      {challenge && <ChallengePanel d={s} code={challenge} board={board} apiUrl={apiUrl} lang={lang} trainingCode={code} now={now} />}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a href={trainingWebRunUrl(lang, code, challenge)} className={buttonClass("primary")}>
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
  );
}

function ChallengePanel({
  d,
  code,
  board,
  apiUrl,
  lang,
  trainingCode,
  now,
}: {
  d: TrainingsDict["share"];
  code: string;
  board: ChallengeBoard | null | "missing";
  apiUrl: string;
  lang: "en" | "fr";
  trainingCode: string;
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
  const left = board && board !== "missing" && board.endsAt && now ? Date.parse(board.endsAt) - now : null;
  const over = left !== null && left <= 0;

  const join = async () => {
    setJoined("busy");
    try {
      await trainingsApi(new RewardsSession(apiUrl, "local")).joinChallenge(code, showName);
      setJoined("yes");
    } catch (e) {
      setJoined((e as { status?: number }).status === 401 ? "signin" : "error");
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-4" aria-live="polite">
      <h2 className="font-display text-xl font-semibold">{c.title}</h2>
      {board === null && <p className="mt-2 text-sm text-muted">{d.loading}</p>}
      {board === "missing" && <p className="mt-2 text-sm text-muted">{c.notFound}</p>}
      {board && board !== "missing" && (
        <>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {over ? c.ended : left !== null ? fmt(c.endsIn, { time: countdown(left) }) : ""}
            {` · ${fmt(c.members, { n: board.members })}`}
          </p>
          <h3 className="mt-3 font-mono text-xs tracking-[0.16em] text-faint uppercase">{c.board}</h3>
          {board.leaderboard.length ? (
            <ol className="mt-2 space-y-1">
              {board.leaderboard.slice(0, 20).map((r, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {i + 1}. {r.name ?? c.someone}
                  </span>
                  <span className="text-muted tabular-nums">{fmt(c.score, { n: r.score })}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">{c.empty}</p>
          )}
          {!over &&
            (joined === "yes" ? (
              <p className="mt-3 text-sm text-volt-fg">{c.joined}</p>
            ) : signedIn && joined !== "signin" ? (
              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="h-5 w-5" />
                  {c.showName}
                </label>
                <button type="button" className={buttonClass("primary")} disabled={joined === "busy"} onClick={() => void join()}>
                  {c.join}
                </button>
                {joined === "error" && <p className="text-sm text-down-fg">{c.error}</p>}
              </div>
            ) : (
              <a href={`/${lang}/app/#/training/${trainingCode}/${code}`} className={buttonClass("ghost", "mt-4")}>
                {c.signIn}
              </a>
            ))}
          <p className="mt-3 text-xs text-faint">{c.rule}</p>
        </>
      )}
    </section>
  );
}
