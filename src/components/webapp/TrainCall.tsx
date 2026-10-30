"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/rewardsApi";
import type { CallBeat, CallBoardView } from "@/lib/webapp/livingApi";
import {
  callCoachLine,
  callCountdown,
  CALL_CHEER_EMOJI,
  CALL_CHEER_KINDS,
  CALL_CHEER_LABEL,
  dueCallCoachEvent,
  TRAIN_CALL_TEXT,
  type CallCheerKind,
  type CallCoachEvent,
} from "@/lib/webapp/living/trainCall";
import { browserRtc, CallAudio, type CallAudioState } from "@/lib/webapp/trainCall/callAudio";
import { sayLine } from "@/lib/webapp/coachAudio";
import { elapsedS } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { useLiving } from "./Journey";
import { useWorkout } from "./WorkoutContext";
import { Btn, Card, Kicker, Note, Pill, Small } from "./ui";

/**
 * Train together over a call on the web (VVFit ADR-0071 §A; rules in game-core trainCall.ts, copied to
 * src/lib/webapp/living/trainCall.ts): the shared board on a call meetup's page. Every 10 s this page sends its own
 * workout's numbers (the web workout running now: clock, GPS distance, zone; never a position) and gets the board back.
 * The host starts the countdown; a tap on someone cheers them; "Leave quietly" tells nobody. Group audio through the
 * browser's WebRTC when the server allows it (TRAIN_CALL_AUDIO, off by default): never recorded. The coach (off by
 * default) only says scripted lines. Health first: join order, no ranking.
 */

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h ? `${h}:` : ""}${h ? String(m).padStart(2, "0") : m}:${String(sec).padStart(2, "0")}`;
};

export function TrainCallBoard({ meetupId, onLeft }: { meetupId: string; onLeft: () => void }) {
  const { lang } = useApp();
  const { la } = useLiving();
  const l = lang === "fr" ? "fr" : "en";
  const work = useWorkout();
  const workRef = useRef(work);
  useEffect(() => {
    workRef.current = work;
  }, [work]);
  const [board, setBoard] = useState<CallBoardView | null>(null);
  const [boardAt, setBoardAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [err, setErr] = useState<string | null>(null);
  const [cheerTo, setCheerTo] = useState<string | null>(null);
  const [cheerLine, setCheerLine] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<CallAudioState>("idle");
  const [muted, setMuted] = useState(false);
  const audio = useRef<CallAudio | null>(null);
  // Cheers from before this page opened aren't announced.
  const seen = useRef(0);
  useEffect(() => {
    seen.current = Date.now();
  }, []);
  const fired = useRef<CallCoachEvent[]>([]);
  const left = useRef(false);

  const show = useCallback((b: CallBoardView) => {
    setBoard(b);
    setBoardAt(Date.now());
    setErr(null);
    const fresh = b.cheers.filter((c) => c.atMs > seen.current);
    if (fresh.length) {
      seen.current = Math.max(...fresh.map((c) => c.atMs));
      const last = fresh[fresh.length - 1]!;
      setCheerLine(`${last.from} ${CALL_CHEER_EMOJI[last.kind as CallCheerKind] ?? ""}`);
      if ("vibrate" in navigator) navigator.vibrate?.(30);
      setTimeout(() => setCheerLine(null), 4000);
    }
    const a = audio.current;
    if (a && a.state === "on") {
      if (b.audio.state !== "ok") void a.stop();
      else void a.sync(b.board.filter((r) => r.audio && !r.me && !r.stale).map((r) => r.userId)).catch(() => undefined);
    }
  }, []);

  const errText = (e: unknown) => {
    const reason = e instanceof ApiError ? (e.extra.reason as string | undefined) : undefined;
    if (reason === "not_open") return TRAIN_CALL_TEXT.notOpen[l];
    if (e instanceof ApiError && e.message) return e.message;
    return l === "fr" ? "Pas de connexion. On réessaie." : "No connection. Trying again.";
  };

  const beat = useCallback(async () => {
    if (left.current) return;
    const w = workRef.current;
    const t = Date.now();
    const snap = w.w;
    const body: CallBeat = !snap
      ? { state: "waiting" }
      : {
          state: snap.endedAt ? "done" : snap.pausedAt ? "paused" : "running",
          elapsedS: elapsedS(snap, t),
          ...(snap.track.metres > 0 ? { distanceM: Math.round(snap.track.metres) } : {}),
          ...(w.zone >= 1 && w.zone <= 5 ? { zone: w.zone } : {}),
        };
    try {
      show(await la.callBeat(meetupId, { ...body, audio: audio.current?.state === "on" }, l));
    } catch (e) {
      setErr(errText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [la, meetupId, l, show]);

  const beatS = board?.beatS ?? 10;
  useEffect(() => {
    void beat();
    const timer = setInterval(() => void beat(), beatS * 1000);
    return () => clearInterval(timer);
  }, [beat, beatS]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => void audio.current?.stop(), []);

  const goAtMs = board?.goAt ? Date.parse(board.goAt) + (boardAt - board.serverMs) : null;
  useEffect(() => {
    if (!board?.coach || !goAtMs) return;
    const e = dueCallCoachEvent(goAtMs, board.durationMin, now, fired.current);
    if (!e) return;
    fired.current = [...fired.current, e];
    sayLine({ text: callCoachLine(e, l, Math.floor(goAtMs / 1000)) });
  }, [board?.coach, board?.durationMin, goAtMs, now, l]);
  const cd = callCountdown(goAtMs, now);

  const cheer = async (to: string, kind: CallCheerKind) => {
    setCheerTo(null);
    try {
      show(await la.callCheer(meetupId, to, kind, l));
    } catch (e) {
      setErr(errText(e));
    }
  };

  const leave = async () => {
    left.current = true;
    await audio.current?.stop();
    await la.callLeave(meetupId, l).catch(() => undefined);
    onLeft();
  };

  const rtc = browserRtc();
  const joinAudio = async () => {
    if (!rtc) return;
    const a = new CallAudio(
      rtc,
      {
        join: (offer, mid) => la.callAudioJoin(meetupId, offer, mid),
        pull: (sid, ids) => la.callAudioPull(meetupId, sid, ids),
        renegotiate: async (sid, answer) => void (await la.callAudioRenegotiate(meetupId, sid, answer)),
        leave: async () => void (await la.callAudioLeave(meetupId)),
      },
      setAudioState,
    );
    audio.current = a;
    try {
      await a.start();
      void beat();
    } catch (e) {
      setErr(errText(e));
    }
  };

  const zoneWord = (z: number) => `Z${z}`;
  const stat = (r: { distanceM?: number | null; reps?: number | null }) =>
    typeof r.distanceM === "number" && r.distanceM > 0
      ? `${(r.distanceM / 1000).toFixed(1).replace(".", l === "fr" ? "," : ".")} km`
      : typeof r.reps === "number" && r.reps > 0
        ? l === "fr"
          ? `${r.reps} répétitions`
          : `${r.reps} reps`
        : null;

  return (
    <div className="space-y-3">
      {cd.phase === "counting" && (
        <Card tone="volt">
          <p className="text-center font-display text-6xl font-bold tabular-nums" aria-live="assertive">
            {cd.secondsLeft}
          </p>
        </Card>
      )}
      {cd.phase === "go" && (
        <Card tone="volt">
          <p className="text-center font-display text-3xl font-bold" aria-live="assertive">
            {TRAIN_CALL_TEXT.go[l]}
          </p>
        </Card>
      )}
      {cheerLine && <Pill tone="mint">{cheerLine}</Pill>}
      {err && (
        <p role="alert" className="text-sm text-butter-fg">
          {err}
        </p>
      )}
      <Card className="space-y-2">
        <Kicker tone="lilac">{TRAIN_CALL_TEXT.board[l]}</Kicker>
        {!work.w && board && (
          <Small>
            {l === "fr"
              ? "Lance ta séance quand tu veux : ton temps s’affiche ici."
              : "Start your workout whenever you like: your time shows here."}
          </Small>
        )}
        <ul className="space-y-1">
          {board?.board.map((r) => {
            const elapsed =
              r.state === "running" && !r.stale ? r.elapsedNowS + Math.max(0, Math.floor((now - boardAt) / 1000)) : r.elapsedNowS;
            const state = r.stale
              ? TRAIN_CALL_TEXT.stale[l]
              : r.state === "waiting"
                ? TRAIN_CALL_TEXT.waiting[l]
                : r.state === "paused"
                  ? TRAIN_CALL_TEXT.paused[l]
                  : r.state === "done"
                    ? TRAIN_CALL_TEXT.done[l]
                    : null;
            const s = stat(r);
            return (
              <li key={r.userId}>
                <button
                  type="button"
                  disabled={r.me}
                  onClick={() => setCheerTo(cheerTo === r.userId ? null : r.userId)}
                  aria-label={r.me ? r.name : `${TRAIN_CALL_TEXT.cheer[l]} ${r.name}`}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {r.me ? TRAIN_CALL_TEXT.you[l] : r.name}
                    {r.audio ? " · 🎧" : ""}
                  </span>
                  {r.state !== "waiting" && <span className="text-sm tabular-nums">{clock(elapsed)}</span>}
                  {s && <span className="text-xs text-muted">{s}</span>}
                  {typeof r.zone === "number" && <Pill tone="sky">{zoneWord(r.zone)}</Pill>}
                  {state && <span className="text-xs text-muted">{state}</span>}
                </button>
                {cheerTo === r.userId && (
                  <div className="flex flex-wrap gap-2 px-2 pb-2">
                    {CALL_CHEER_KINDS.map((k) => (
                      <Btn key={k} variant="ghost" className="h-10" onClick={() => void cheer(r.userId, k)}>
                        {CALL_CHEER_EMOJI[k]} {CALL_CHEER_LABEL[k][l]}
                      </Btn>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Small>{TRAIN_CALL_TEXT.noPressure[l]}</Small>
      </Card>

      {board?.host && cd.phase === "none" && (
        <Btn
          variant="volt"
          className="w-full"
          onClick={() =>
            void la
              .callGo(meetupId, l)
              .then(show)
              .catch((e) => setErr(errText(e)))
          }
        >
          {TRAIN_CALL_TEXT.start[l]}
        </Btn>
      )}

      {board && board.audio.state !== "ok" && board.audio.text && <Note>{board.audio.text}</Note>}
      {board?.audio.state === "ok" && !rtc && (
        <Note>
          {l === "fr"
            ? "Ce navigateur ne peut pas rejoindre l’audio. Le tableau marche toujours."
            : "This browser can’t join the audio. The board still works."}
        </Note>
      )}
      {board?.audio.state === "ok" && rtc && (audioState === "on" || audioState === "connecting") ? (
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="ghost"
            onClick={() => {
              audio.current?.setMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? TRAIN_CALL_TEXT.unmute[l] : TRAIN_CALL_TEXT.mute[l]}
          </Btn>
          <Btn variant="ghost" onClick={() => void audio.current?.stop()}>
            {TRAIN_CALL_TEXT.audioOff[l]}
          </Btn>
        </div>
      ) : board?.audio.state === "ok" && rtc ? (
        <Btn variant="volt" className="w-full" onClick={() => void joinAudio()}>
          🎧 {TRAIN_CALL_TEXT.audioOn[l]}
        </Btn>
      ) : null}

      <Btn variant="ghost" className="w-full" onClick={() => void leave()}>
        {TRAIN_CALL_TEXT.leave[l]}
      </Btn>
      <Small>{TRAIN_CALL_TEXT.leaveHint[l]}</Small>
      <Small>{TRAIN_CALL_TEXT.privacy[l]}</Small>
    </div>
  );
}
