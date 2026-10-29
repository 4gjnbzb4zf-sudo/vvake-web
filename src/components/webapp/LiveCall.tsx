"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/rewardsApi";
import { getLiveCallDict, type LiveCallDict } from "@/i18n/liveCall";
import { LiveCallClient, liveSocketUrl, onboardingCallOffered, type LiveState } from "@/lib/webapp/live/liveCallClient";
import { blobPlayer, canHear, cloudStt, liveFlags, openLiveSocket, type LiveFlags } from "@/lib/webapp/live/liveCallBrowser";
import { mergeCallAnswers, stepForField, webPermissionAnswer } from "@/lib/webapp/live/liveOnboarding";
import type { LiveCallMode } from "@/lib/webapp/live/liveCallProtocol";
import type { TailorAnswers, TailorStep } from "@/lib/webapp/tailor/tailor";
import { coachVoiceGender } from "@/lib/coachVoices";
import { useApp } from "./AppContext";
import { useWorkout } from "./WorkoutContext";
import { Btn, Card, H1, Kicker, Small } from "./ui";

/**
 * Live coach calls on the web (monorepo docs/05-tech/live-call.md, phase L3): the shared client
 * (lib/webapp/live/liveCallClient.ts, a copy of the phone's) with the browser's socket, microphone and player. Only
 * from the athlete's own tap; never during a workout; any failure goes on the old way (the survey cards).
 */
function useLiveCall(o: { mode: LiveCallMode; onTool: (name: string, args: Record<string, unknown>) => unknown }) {
  const { session, api, lang, me } = useApp();
  const [state, setState] = useState<LiveState | null>(null);
  const client = useRef<LiveCallClient | null>(null);
  const tool = useRef(o.onTool);
  useEffect(() => {
    tool.current = o.onTool;
  });

  const start = useCallback(async () => {
    if (client.current && client.current.state.phase !== "ended") return;
    const L = lang === "fr" ? "fr" : "en";
    const c = new LiveCallClient({
      mode: o.mode,
      hello: { lang: L, stt: "cloud", audioFormat: "mp3", speak: true, healthAloud: false, voice: coachVoiceGender(me.coach?.voiceGender) },
      online: () => typeof navigator === "undefined" || navigator.onLine !== false,
      ticket: () =>
        api.liveCallTicket({ mode: o.mode, lang: L }).then(
          (t) => ({ ticket: t.ticket, ...(t.url ? { url: t.url } : {}) }),
          (e: unknown) => {
            // 409 { reason }: the server says no (off, scripted, used, quiet, day_cap…): the cards go on.
            if (e instanceof ApiError && e.status === 409) return { off: String(e.extra.reason ?? "off") };
            throw e;
          },
        ),
      socketUrl: (t) => liveSocketUrl(session.base, t),
      openSocket: openLiveSocket,
      stt: cloudStt(),
      player: blobPlayer(session, L),
      onTool: (name, args) => tool.current(name, args),
      onState: setState,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      // The server hears the athlete (cloud STT) and stops the coach itself; the button is the local way.
      bargeWords: 2,
    });
    client.current = c;
    await c.start();
  }, [api, lang, me.coach?.voiceGender, o.mode, session]);

  // Leaving the screen hangs up.
  useEffect(() => () => client.current?.hangUp(), []);

  return {
    state,
    start,
    hangUp: (f: Parameters<LiveCallClient["hangUp"]>[0] = null) => client.current?.hangUp(f),
    setMuted: (m: boolean) => client.current?.setMuted(m),
    interrupt: () => client.current?.bargeIn(),
  };
}

const phaseLine = (d: LiveCallDict, st: LiveState) =>
  st.muted ? d.phase.muted : st.phase === "ended" ? "" : (d.phase[st.phase as keyof LiveCallDict["phase"]] ?? "");

const leftLine = (d: LiveCallDict, s: number) =>
  d.left.replace("{m}", String(Math.floor(Math.max(0, s) / 60))).replace("{s}", String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0"));

/** The call on screen: captions as they come (cut ones dimmed), the words heard, who has the floor, minutes, Mute. */
export function LivePanel({ state, onMute, onInterrupt }: { state: LiveState; onMute: (m: boolean) => void; onInterrupt: () => void }) {
  const { lang } = useApp();
  const d = getLiveCallDict(lang);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [state.captions.length, state.partial]);
  const hearing = !state.muted && (state.phase === "listening" || state.phase === "speaking" || state.phase === "thinking");
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-lilac-fg" aria-live="polite">
          {hearing && <span className="inline-block size-2 rounded-full bg-down" role="img" aria-label={d.micOn} />}
          {phaseLine(d, state)}
        </p>
        {state.meter && <Small className={cn(state.meter.warn && "text-down-fg")}>{leftLine(d, state.meter.leftS)}</Small>}
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {state.captions.map((x, i) => (
          <p
            key={`${i}-${x.turn}`}
            className={cn(
              "max-w-[92%] rounded-2xl px-3 py-2 text-sm",
              x.who === "me" ? "ml-auto bg-lilac text-ink" : "bg-surface-2",
              x.cut && "opacity-55",
            )}
          >
            {x.text}
          </p>
        ))}
        {state.partial && <p className="text-right text-sm text-lilac-fg">{state.partial}</p>}
        <div ref={end} />
      </div>
      <div className="flex justify-center gap-2">
        <Btn variant="ghost" aria-pressed={state.muted} onClick={() => onMute(!state.muted)}>
          {state.muted ? d.unmute : d.mute}
        </Btn>
        {state.phase === "speaking" && (
          <Btn variant="ghost" onClick={onInterrupt}>
            {d.interrupt}
          </Btn>
        )}
      </div>
    </Card>
  );
}

/**
 * Day one on the web (the first "Your VVake" survey): "Talk it through with your coach" or "Tap through", offered only
 * when the server has the call on (GET /v1/health features.onboardingCall), online, a microphone is possible, not in
 * Quiet and not during a workout. Talking fills the same cards (`onAnswer`) and ends on the summary (`onSummary`).
 */
export function useDayOneCall(o: {
  first: boolean;
  onAnswer: (patch: (a: TailorAnswers) => TailorAnswers, step: TailorStep | null) => void;
  onSummary: (note: string | null) => void;
}) {
  const { session, lang, online, suggestLevel } = useApp();
  const wk = useWorkout();
  const d = getLiveCallDict(lang);
  const [flags, setFlags] = useState<LiveFlags | null>(null);
  const [how, setHow] = useState<"talk" | "tap" | null>(null);
  const [healthNote, setHealthNote] = useState(false);
  const cb = useRef(o);
  useEffect(() => {
    cb.current = o;
  });

  useEffect(() => {
    if (!o.first) return;
    let live = true;
    void liveFlags(session.base).then((f) => live && setFlags(f));
    // A slow server never holds the cards back.
    const timer = setTimeout(() => live && setFlags((f) => f ?? { call: false, onboarding: false }), 2000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [o.first, session.base]);

  const call = useLiveCall({
    mode: "onboarding",
    onTool: (name, args) => {
      if (name === "set_survey_answer") {
        cb.current.onAnswer((a) => mergeCallAnswers(a, { id: args.id, value: args.value }), stepForField(args.id));
        return undefined;
      }
      if (name === "show_summary") {
        const w = (args.week ?? {}) as { daysPerWeek?: number; minutes?: number };
        cb.current.onSummary(
          w.daysPerWeek && w.minutes ? d.firstWeek.replace("{d}", String(w.daysPerWeek)).replace("{m}", String(w.minutes)) : null,
        );
        return undefined;
      }
      if (name === "show_permission") {
        if (args.kind === "health") setHealthNote(true);
        return webPermissionAnswer(args.kind);
      }
      return undefined;
    },
  });

  const offered =
    o.first &&
    !!flags &&
    canHear() &&
    onboardingCallOffered({ serverOn: flags.onboarding, online, inWorkout: !!wk.w, quiet: suggestLevel === "quiet" });
  const view: "ask" | "talk" | "cards" | "wait" =
    how === "talk" ? "talk" : how === "tap" || (flags && !offered) || !o.first ? "cards" : flags ? "ask" : "wait";

  const st = call.state;
  const on = !!st && st.phase !== "ended";
  const offer = (
    <div className="space-y-4 pt-4">
      <Kicker tone="volt">VVake</Kicker>
      <H1>{d.offer.title}</H1>
      <Small className="text-sm">{d.offer.lead}</Small>
      <Btn
        big
        className="w-full"
        onClick={() => {
          setHow("talk");
          void call.start();
        }}
      >
        {d.offer.talk}
      </Btn>
      <Btn variant="ghost" className="w-full" onClick={() => setHow("tap")}>
        {d.offer.tap}
      </Btn>
    </div>
  );
  const header =
    view === "talk" ? (
      <div className="space-y-2">
        {on && st && <LivePanel state={st} onMute={(m) => call.setMuted(m)} onInterrupt={() => call.interrupt()} />}
        {on && (
          <button
            type="button"
            className="mx-auto block text-sm text-sky-fg underline-offset-2 hover:underline"
            onClick={() => call.hangUp("cards")}
          >
            {d.ratherTap}
          </button>
        )}
        {st?.fallback && <Small className="text-center">{d.onScreen}</Small>}
        {healthNote && <Small className="text-center">{d.healthOnPhone}</Small>}
      </div>
    ) : null;
  return { view, offer, header, hangUp: () => call.hangUp() };
}
