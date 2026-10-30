"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/rewardsApi";
import { accountTier, coachPlusActive } from "@/lib/coachPlus";
import { coachVoiceGender } from "@/lib/coachVoices";
import { getTalkDict } from "@/i18n/talk";
import { getLiveCallDict } from "@/i18n/liveCall";
import { hush, speakReply, unlockAudio } from "@/lib/webapp/coachAudio";
import { createConversationVoice } from "@/lib/webapp/speechQueue";
import { canListen, listen } from "@/lib/webapp/voice";
import { localDay } from "@/lib/webapp/format";
import { pttHint, toPttLine } from "@/lib/webapp/coach/coachTalk";
import { talkApi, type TalkStatus } from "@/lib/webapp/coach/talkApi";
import { cardIdOf, placesForCoach, pttNext, webTalkMode, type PttPhase, type WebTalkPick } from "@/lib/webapp/coach/talkFlow";
import { LiveCallClient, liveSocketUrl, type LiveState } from "@/lib/webapp/live/liveCallClient";
import { blobPlayer, canHear, cloudStt, openLiveSocket } from "@/lib/webapp/live/liveCallBrowser";
import { useApp } from "./AppContext";
import { CoachActionCard } from "./CoachActionCard";
import { OpenScreenButton } from "./Suggest";
import { useCoachChat, type ChatTurn } from "./useCoachChat";
import { useWorkout } from "./WorkoutContext";
import { Btn, Small } from "./ui";

/**
 * "Talk to your coach" on every web-app screen (VVFit ADR-0068, build 60): the coach button (in the tab bar, and on
 * the workout screen) opens this sheet over the screen the athlete is on (or #/talk, /<lang>/app/talk/).
 *
 * - live (VVake Coach Plus / Premium, the server's `talk.live`, minutes left, a microphone): a hands-free
 *   conversation through the live call (mode `talk`): the socket is pre-warmed (hello.wait) when the Coach tab or the
 *   sheet opens, the microphone streams 16 kHz PCM to the server's speech-to-text, the browser's echo cancellation
 *   and a local voice detector let the athlete cut the coach by talking, captions and the coach's cards show inline,
 *   a said yes / no answers the card. Minutes used up (`to_ptt`) or any failure: the same sheet goes on in push-to-talk.
 * - ptt (Free, live off, no minutes, offline, during a web workout): tap the mic, talk, the browser's speech
 *   recognition ends the turn by itself, POST /v1/coach/talk, the answer is spoken (coach voice rules), tap while it
 *   speaks to cut in. Without speech recognition in this browser: typing.
 * - text: always there, the same brain.
 * Nothing is suggested from here; opening it is always the athlete's tap.
 */

interface TalkCtx {
  open: (o?: { forcePtt?: boolean }) => void;
  close: () => void;
  isOpen: boolean;
  /** Get the live talk's socket ready (the Coach tab, the button's first touch): no mic, no meter, no greeting. */
  prewarm: () => void;
}

const Ctx = createContext<TalkCtx | null>(null);
const noop: TalkCtx = { open: () => undefined, close: () => undefined, isOpen: false, prewarm: () => undefined };
export const useTalk = (): TalkCtx => useContext(Ctx) ?? noop;
/** The Coach tab's pre-warm (a stable callback). */
export const useTalkPrewarm = () => useTalk().prewarm;

/** Handlers the open sheet gives the live client (the client may be made before the sheet, by a pre-warm). */
interface LiveHandlers {
  onTool: (name: string, args: Record<string, unknown>, id: string) => unknown;
  onState: (s: LiveState) => void;
  answer: (text: string) => boolean;
}

const STATUS_TTL_MS = 60_000;
const PREWARM_KEEP_MS = 80_000;

export function TalkProvider({ children }: { children: ReactNode }) {
  const { session, api, lang, me, online, route, go, prefs } = useApp();
  const wk = useWorkout();
  const [isOpen, setOpen] = useState(false);
  const [forcePtt, setForcePtt] = useState(false);
  const [status, setStatus] = useState<TalkStatus | null>(null);
  const statusAt = useRef(0);
  const ta = useMemo(() => talkApi(session), [session]);
  const warm = useRef<{ client: LiveCallClient; at: number } | null>(null);
  const handlers = useRef<LiveHandlers | null>(null);

  const refreshStatus = useCallback(async (): Promise<TalkStatus> => {
    if (status && Date.now() - statusAt.current < STATUS_TTL_MS) return status;
    let s: TalkStatus = { live: false, why: "off" };
    try {
      s = await ta.talkStatus(lang);
    } catch {
      // unknown: push-to-talk
    }
    statusAt.current = Date.now();
    setStatus(s);
    return s;
  }, [ta, lang, status]);

  const pickNow = useCallback(
    (s: TalkStatus | null, o: { forcePtt?: boolean } = {}): WebTalkPick =>
      webTalkMode({
        tier: accountTier(me),
        liveOn: !!s?.live && !wk.w,
        ...(s?.leftS !== undefined ? { leftS: s.leftS } : {}),
        online,
        canHear: canHear(),
        canListen: canListen(),
        forcePtt: o.forcePtt || !!wk.w,
      }),
    [me, online, wk.w],
  );

  /** A new live talk client (mode talk), its handlers routed to the open sheet. */
  const makeClient = useCallback((): LiveCallClient => {
    const L = lang === "fr" ? "fr" : "en";
    const now = new Date();
    let player: ReturnType<typeof blobPlayer> | null = null;
    player = blobPlayer(session, L);
    const p = player;
    return new LiveCallClient({
      mode: "talk",
      hello: {
        lang: L,
        stt: "cloud",
        audioFormat: "mp3",
        speak: true,
        healthAloud: false,
        voice: coachVoiceGender(me.coach?.voiceGender),
        units: prefs.units,
        device: "web",
        localHour: now.getHours(),
        localDay: localDay(now.getTime()),
        screen: route.name,
      },
      online: () => typeof navigator === "undefined" || navigator.onLine !== false,
      ticket: () =>
        api.liveCallTicket({ mode: "talk", lang: L }).then(
          (t) => ({ ticket: t.ticket, ...(t.url ? { url: t.url } : {}) }),
          (e: unknown) => {
            if (e instanceof ApiError && e.status === 409) return { off: String(e.extra.reason ?? "off") };
            throw e;
          },
        ),
      socketUrl: (t) => liveSocketUrl(session.base, t),
      openSocket: openLiveSocket,
      stt: cloudStt(() => p.busy()),
      player: p,
      onTool: (name, args, id) => handlers.current?.onTool(name, args, id),
      answer: (text) => handlers.current?.answer(text) ?? false,
      onState: (s) => handlers.current?.onState(s),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      // A computer's speakers: two words over the coach (or the voice detector) cut it.
      bargeWords: 2,
    });
  }, [api, lang, me.coach?.voiceGender, prefs.units, route.name, session]);

  const prewarm = useCallback(() => {
    void (async () => {
      const s = await refreshStatus();
      if (pickNow(s).mode !== "live") return;
      const w = warm.current;
      if (w && Date.now() - w.at < PREWARM_KEEP_MS && w.client.state.phase !== "ended") return;
      const client = makeClient();
      warm.current = { client, at: Date.now() };
      void client.prewarm();
    })();
  }, [refreshStatus, pickNow, makeClient]);

  /** The sheet takes the pre-warmed client (fresh enough) or makes one. */
  const takeClient = useCallback((): LiveCallClient => {
    const w = warm.current;
    warm.current = null;
    if (w && Date.now() - w.at < PREWARM_KEEP_MS && w.client.state.phase !== "ended") return w.client;
    w?.client.hangUp();
    return makeClient();
  }, [makeClient]);

  // An unused pre-warm is hung up when the page goes (the server closes it for free after 90 s anyway).
  useEffect(() => () => warm.current?.client.hangUp(), []);

  const open = useCallback((o: { forcePtt?: boolean } = {}) => {
    unlockAudio();
    setForcePtt(!!o.forcePtt);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    if (route.name === "talk") go({ name: "today" });
  }, [route.name, go]);

  // #/talk (and /<lang>/app/talk/, `?live=0` for push-to-talk) opens the sheet over Today.
  useEffect(() => {
    if (route.name !== "talk") return;
    let force = false;
    try {
      force = new URLSearchParams(window.location.search).get("live") === "0";
    } catch {
      // no query
    }
    const id = window.setTimeout(() => open({ forcePtt: force }), 0);
    return () => window.clearTimeout(id);
  }, [route.name, open]);

  const value = useMemo<TalkCtx>(() => ({ open, close, isOpen, prewarm }), [open, close, isOpen, prewarm]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen && (
        <TalkSheet
          onClose={close}
          refreshStatus={refreshStatus}
          pickNow={(s) => pickNow(s, { forcePtt })}
          takeClient={takeClient}
          setHandlers={(h) => void (handlers.current = h)}
        />
      )}
    </Ctx.Provider>
  );
}

/** The coach button: one tap, never over the screen's controls (it lives in the tab bar and the workout's bar). */
export function TalkButton({ className, compact }: { className?: string; compact?: boolean }) {
  const { lang } = useApp();
  const talk = useTalk();
  const tk = getTalkDict(lang);
  return (
    <button
      type="button"
      onClick={() => talk.open()}
      onPointerEnter={(e) => e.pointerType === "mouse" && talk.prewarm()}
      aria-label={tk.button}
      aria-haspopup="dialog"
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-lilac-fg hover:text-text",
        compact ? "h-11 min-w-11 rounded-full border border-lilac-fg/50 px-3" : "h-16 w-full",
        className,
      )}
    >
      <span aria-hidden className="text-lg leading-none">
        🎙
      </span>
      {!compact && <span className="max-w-full truncate px-0.5">{tk.buttonShort}</span>}
    </button>
  );
}

function TalkSheet({
  onClose,
  refreshStatus,
  pickNow,
  takeClient,
  setHandlers,
}: {
  onClose: () => void;
  refreshStatus: () => Promise<TalkStatus>;
  pickNow: (s: TalkStatus | null) => WebTalkPick;
  takeClient: () => LiveCallClient;
  setHandlers: (h: LiveHandlers | null) => void;
}) {
  const { lang, me, prefs, route } = useApp();
  const wk = useWorkout();
  const tk = getTalkDict(lang);
  const ld = getLiveCallDict(lang);
  const L = lang === "fr" ? "fr" : "en";
  const [pick, setPick] = useState<WebTalkPick | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const client = useRef<LiveCallClient | null>(null);
  const [phase, setPhase] = useState<PttPhase>("idle");
  const phaseRef = useRef<PttPhase>("idle");
  const [partial, setPartial] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const stopper = useRef<{ stop(): void } | null>(null);
  const conv = useMemo(() => createConversationVoice(), []);
  const cloudVoice = coachPlusActive(me) || me.coach?.voice !== "device";
  const end = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const setPtt = (p: PttPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const chat = useCoachChat({
    storeKey: "vvake-app-talk",
    screen: route.name,
    wantVoice: cloudVoice,
    speak: (line, voice, onDone) => {
      // Live: the coach speaks through the call; a card's result line is shown, said by the call's coach.
      if (client.current && client.current.state.phase !== "ended") return void onDone?.();
      const aloud = pick?.mode === "ptt" || prefs.speakReplies;
      if (!aloud || !line) return void onDone?.();
      hush();
      conv.begin(cloudVoice);
      speakReply(line, voice, conv, onDone);
    },
    onCardState: (id, state, reason) => client.current?.card(id, state, reason),
    onLeave: onClose,
  });
  const chatRef = useRef(chat);
  useEffect(() => {
    chatRef.current = chat;
  });

  const fellBackRef = useRef<(s: LiveState) => void>(() => undefined);
  // The live client's tools and answers, routed here.
  useEffect(() => {
    setHandlers({
      onState: (s) => {
        setLive({ ...s });
        if (s.phase === "ended") fellBackRef.current(s);
      },
      answer: (t) => chatRef.current.answerCard(t, "voice"),
      onTool: async (name, args, id) => {
        const c = chatRef.current;
        const cid = cardIdOf(args, id);
        // Where the card sits among the captions (cards inline).
        const at = client.current?.state.captions.length ?? 0;
        switch (name) {
          case "app_action": {
            const r = await c.liveCard(args, cid, at);
            return { status: r.status, ...(r.reason ? { reason: r.reason } : {}), line: r.line };
          }
          case "answer_card":
            c.answerLive(String(args.id ?? ""), String(args.decision ?? ""));
            return undefined;
          case "find_places": {
            // The card asks for the location (unless allowed); the coach waits a minute at most.
            const timeout = new Promise<{ status: "failed"; line: string }>((res) =>
              setTimeout(() => res({ status: "failed", line: "" }), 60_000),
            );
            const r = await Promise.race([c.liveCard({ ...args, type: "show_places" }, cid, at), timeout]);
            return "places" in r && r.places ? placesForCoach(r.places) : { error: "no_location" };
          }
          case "show_summary":
            void c.liveCard({ ...args, type: "show_summary" }, cid, at);
            return undefined;
          case "workout_control": {
            const op = args.type === "end_workout" ? "stop" : args.type;
            if (op === "pause" || op === "resume" || op === "stop") void c.liveCard({ type: "control_workout", op }, cid, at);
            return undefined;
          }
          case "open_screen":
            if (typeof args.route === "string")
              c.setTurns((x: ChatTurn[]) => [
                ...x,
                { role: "coach", text: "", open: { route: args.route as string, label: String(args.label ?? "") } },
              ]);
            return undefined;
          case "propose_plan":
          case "propose_settings":
            c.setTurns((x: ChatTurn[]) => [...x, { role: "coach", text: "", proposal: true }]);
            return undefined;
          default:
            return undefined;
        }
      },
    });
    return () => setHandlers(null);
  }, [setHandlers]);

  /** The live talk stopped: push-to-talk (or typing) on the same sheet, with one honest line. */
  const fellBack = useCallback(
    (st: LiveState) => {
      client.current = null;
      chatRef.current.dropWaiting();
      const why = st.fallback;
      if (why === "unused" || st.endReason === "hangup") return;
      const next = pickNow({ live: false, why: why === "to_ptt" || why === "cap" ? "no_minutes" : "off" });
      setPick(why === "no_mic" ? { mode: "text", why: "no_mic" } : next);
      setNote(why === "no_mic" ? tk.micDenied : why === "to_ptt" || why === "cap" ? toPttLine(L) : tk.live.fellBack);
    },
    [pickNow, tk, L],
  );

  useEffect(() => {
    fellBackRef.current = fellBack;
  }, [fellBack]);

  // Open: the mode, then (live) the talk starts at once: the athlete tapped the button.
  useEffect(() => {
    let gone = false;
    void (async () => {
      const s = await refreshStatus();
      if (gone) return;
      const p = pickNow(s);
      setPick(p);
      if (p.mode === "live") {
        const c = takeClient();
        client.current = c;
        setLive({ ...c.state });
        await c.start();
      }
    })();
    return () => {
      gone = true;
    };
  }, [refreshStatus, pickNow, takeClient]);

  // Closing hangs up, stops listening and the voice; a card still waiting counts as "not now".
  useEffect(
    () => () => {
      client.current?.hangUp();
      client.current = null;
      stopper.current?.stop();
      chatRef.current.dropWaiting();
      hush();
    },
    [],
  );

  // Escape closes; focus goes into the sheet.
  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.turns.length, live?.captions.length, partial]);

  // ── Push-to-talk ──
  const step = (ev: Parameters<typeof pttNext>[1]) => {
    const r = pttNext(phaseRef.current, ev);
    setPtt(r.phase);
    if (r.stopVoice) hush();
    if (r.stopListening) stopper.current?.stop();
    if (r.send) {
      // The reply may be said (and done) before ask() resolves (no voice, a card's answer): never stuck "speaking".
      let said = false;
      void chat
        .ask(r.send, "voice", () => {
          said = true;
          step({ type: "spoken" });
        })
        .then(() => step({ type: "reply", spoken: !said }));
    }
    if (r.listen) startListening();
  };
  const startListening = () => {
    unlockAudio();
    let last = "";
    setPartial("");
    const h = listen(
      lang,
      (words, final) => {
        last = words;
        setPartial(words);
        if (final) stopper.current?.stop();
      },
      (err) => {
        stopper.current = null;
        setPartial("");
        if (err === "not-allowed" || err === "service-not-allowed") {
          setPick({ mode: "text", why: "no_mic" });
          setNote(tk.micDenied);
          return step({ type: "error" });
        }
        if (phaseRef.current !== "listening") return;
        step(last ? { type: "heard", text: last } : { type: "silence" });
      },
    );
    if (!h) {
      setPick({ mode: "text", why: "no_mic", noSpeech: true });
      return step({ type: "error" });
    }
    stopper.current = h;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const m = text.trim();
    if (!m) return;
    setText("");
    const c = client.current;
    if (c && c.state.phase !== "ended" && pick?.mode === "live") {
      if (chat.answerCard(m, "chat")) return;
      c.sendText(m);
      return;
    }
    if (phaseRef.current === "speaking") hush();
    void chat.ask(m, "chat");
  };

  const mode = pick?.mode ?? null;
  const liveOn = mode === "live" && !!live && live.phase !== "ended";
  const hint = mode === "ptt" ? pttHint(pick?.why, L, { inWorkout: !!wk.w }) : null;
  const pttLine =
    phase === "listening"
      ? partial || tk.ptt.listening
      : phase === "thinking"
        ? tk.ptt.thinking
        : phase === "speaking"
          ? tk.ptt.speaking
          : tk.ptt.idle;

  // Live captions with the cards inline (each card after the captions said before it).
  const liveCards = chat.turns.filter((x) => x.act?.id);
  const others = chat.turns.filter((x) => !x.act?.id && (x.text || x.open || x.proposal));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={tk.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-night-2 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] outline-none sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-2 pt-4">
          <div>
            <p className="font-display text-lg font-semibold">{tk.title}</p>
            {mode && (
              <p className="flex items-center gap-2 text-xs text-lilac-fg">
                {liveOn && !live?.muted && <span className="inline-block size-2 rounded-full bg-down" role="img" aria-label={ld.micOn} />}
                {tk.mode[mode]}
                {wk.w ? ` · ${tk.inWorkout}` : ""}
              </p>
            )}
          </div>
          <Btn variant="ghost" onClick={onClose} aria-label={tk.close}>
            ✕
          </Btn>
        </div>

        <div className="mt-3 min-h-40 flex-1 space-y-2 overflow-y-auto" aria-live="polite">
          {others.length === 0 && !liveOn && <Bubble who="coach" text={tk.hello} />}
          {others.map((x, i) => (
            <Turn key={`o${i}`} x={x} i={chat.turns.indexOf(x)} chat={chat} />
          ))}
          {live &&
            live.captions.map((c, i) => (
              <div key={`c${i}-${c.turn}`}>
                <Bubble who={c.who === "me" ? "me" : "coach"} text={c.text} dim={c.cut} />
                {liveCards
                  .filter((x) => (x.at ?? 0) === i + 1)
                  .map((x) => (
                    <Turn key={x.act!.id} x={x} i={chat.turns.indexOf(x)} chat={chat} />
                  ))}
              </div>
            ))}
          {liveCards
            .filter((x) => (x.at ?? 0) === 0 || (x.at ?? 0) > (live?.captions.length ?? 0))
            .map((x) => (
              <Turn key={x.act!.id} x={x} i={chat.turns.indexOf(x)} chat={chat} />
            ))}
          {liveOn && live?.partial && <p className="text-right text-sm text-lilac-fg">{live.partial}</p>}
          {chat.busy && <Small className="text-lilac-fg">{tk.ptt.thinking}</Small>}
          {chat.error && <p className="text-sm text-down-fg">{tk.error}</p>}
          {note && <Small className="text-butter-fg">{note}</Small>}
          <div ref={end} />
        </div>

        {mode === "live" && live && (
          <div className="mt-3 space-y-2">
            <p className="text-center text-sm text-lilac-fg" role="status">
              {live.muted ? ld.phase.muted : live.phase === "ended" ? "" : (ld.phase[live.phase as keyof typeof ld.phase] ?? "")}
              {live.meter && live.phase !== "ended"
                ? ` · ${ld.left.replace("{m}", String(Math.floor(live.meter.leftS / 60))).replace("{s}", String(Math.floor(live.meter.leftS % 60)).padStart(2, "0"))}`
                : ""}
            </p>
            <Wave active={liveOn && !live.muted && (live.phase === "listening" || live.phase === "speaking")} />
            <div className="flex justify-center gap-2">
              <Btn variant="ghost" aria-pressed={live.muted} onClick={() => client.current?.setMuted(!live.muted)}>
                {live.muted ? ld.unmute : ld.mute}
              </Btn>
              <Btn variant="ghost" onClick={onClose}>
                {tk.live.end}
              </Btn>
            </div>
          </div>
        )}

        {mode === "ptt" && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => step({ type: "tap" })}
              aria-pressed={phase === "listening"}
              aria-label={phase === "listening" ? tk.ptt.stop : tk.ptt.mic}
              disabled={phase === "thinking"}
              className={cn(
                "flex size-20 items-center justify-center rounded-full border-2 text-3xl transition",
                phase === "listening" ? "animate-pulse border-lilac-fg bg-lilac text-ink" : "border-lilac-fg/60 bg-surface",
                phase === "thinking" && "opacity-60",
              )}
            >
              🎙
            </button>
            <p className="min-h-5 text-center text-sm text-lilac-fg" role="status">
              {pttLine}
            </p>
            {hint && <Small className="text-center">{hint}</Small>}
          </div>
        )}

        {mode === "text" && pick?.noSpeech && <Small className="mt-2">{tk.noSpeech}</Small>}

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <input
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-lilac-fg"
            value={text}
            maxLength={500}
            placeholder={tk.placeholder}
            aria-label={tk.placeholder}
            onChange={(e) => setText(e.target.value)}
          />
          <Btn type="submit" variant="volt" disabled={!text.trim()} className="px-4">
            {tk.send}
          </Btn>
        </form>
      </div>
    </div>
  );
}

function Turn({ x, i, chat }: { x: ChatTurn; i: number; chat: ReturnType<typeof useCoachChat> }) {
  const { t, go } = useApp();
  return (
    <div>
      {x.text && <Bubble who={x.role === "user" ? "me" : "coach"} text={x.text} />}
      {x.proposal && (
        <button type="button" className="mt-1 ml-2 text-sm text-lilac-fg underline" onClick={() => go({ name: "plan" })}>
          {t.coach.proposal} ›
        </button>
      )}
      {x.open && (
        <div className="mt-1 ml-2">
          <OpenScreenButton route={x.open.route} label={x.open.label || t.coach.openScreen} />
        </div>
      )}
      {x.act && (
        <CoachActionCard
          act={x.act}
          plan={chat.runner.plan(x.act.action)}
          local={x.local}
          onConfirm={() => void chat.confirm(i)}
          onCancel={() => chat.cancel(i)}
          onAllowPlaces={() => chat.allowPlaces(i)}
        />
      )}
    </div>
  );
}

function Bubble({ who, text, dim }: { who: "me" | "coach"; text: string; dim?: boolean }) {
  return (
    <p
      className={cn(
        "max-w-[88%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap",
        who === "coach" ? "rounded-tl-sm border border-lilac-fg/30 bg-surface" : "ml-auto rounded-tr-sm bg-lilac text-ink",
        dim && "opacity-55",
      )}
    >
      {text}
    </p>
  );
}

/** A quiet waveform while the conversation is open (the mic is on). */
function Wave({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="flex h-8 items-center justify-center gap-1">
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <span
          key={k}
          className={cn("w-1.5 rounded-full bg-lilac-fg/70", active ? "animate-pulse" : "opacity-30")}
          style={{ height: `${active ? 10 + ((k * 7) % 5) * 5 : 6}px`, animationDelay: `${k * 90}ms` }}
        />
      ))}
    </div>
  );
}
