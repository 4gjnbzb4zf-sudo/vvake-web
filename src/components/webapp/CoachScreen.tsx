"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { coachPlusActive, ownPlanName } from "@/lib/coachPlus";
import { upsellAllowed } from "@/lib/webapp/tailor/tailor";
import { cn } from "@/lib/cn";
import type { CoachContext } from "@/lib/webapp/api";
import { goalProgress } from "@/lib/webapp/goals";
import { hush, speakReply, unlockAudio } from "@/lib/webapp/coachAudio";
import { createConversationVoice } from "@/lib/webapp/speechQueue";
import { canListen, listen } from "@/lib/webapp/voice";
import { useApp } from "./AppContext";
import { GetTheApp } from "./GetTheApp";
import { COACH_DRAFT_KEY } from "./SeasonWeek";
import { goalTitle } from "./GoalsScreen";
import { Btn, H1, Kicker, Note, Small, Toggle } from "./ui";
import { useNow } from "./useNow";

/**
 * Coach (apps/mobile app/(tabs)/coach.tsx): talk to your coach (POST /v1/coach/talk, the same coach as the app, with
 * your goals in the context so it follows up on them). Type, or speak where the browser can listen (Web Speech);
 * replies can be read aloud: in the coach's own voice for Plus (the reply's audio from the API, within its daily voice
 * quota, one voice for the whole conversation), else the browser's best voice. A plan change it proposes waits on Plan for your yes.
 */

interface Turn {
  role: "user" | "coach";
  text: string;
  proposal?: boolean;
}

const KEY = "vvake-app-coach";

export function CoachScreen() {
  const { t, lang, api, goals, sessions, prefs, setPrefs, go, me, profile, fmt } = useApp();
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(`${KEY}:${me.id}`) ?? "[]") as Turn[];
      return Array.isArray(v) ? v.slice(-30) : [];
    } catch {
      return [];
    }
  });
  // A plain request the week editor couldn't read itself waits here, ready to send (SeasonWeek COACH_DRAFT_KEY).
  const [text, setText] = useState(() => {
    try {
      const d = sessionStorage.getItem(COACH_DRAFT_KEY) ?? "";
      sessionStorage.removeItem(COACH_DRAFT_KEY);
      return d.slice(0, 300);
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const stopper = useRef<{ stop(): void } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [micOk] = useState(() => canListen());
  const now = useNow();
  const conv = useMemo(() => createConversationVoice(), []);
  // Plus / Premium: always the coach's voice, whatever the device-voice choice (voiceGuarantee.ts).
  const cloudVoice = coachPlusActive(me) || me.coach?.voice !== "device";

  useEffect(() => {
    try {
      sessionStorage.setItem(`${KEY}:${me.id}`, JSON.stringify(turns.slice(-30)));
    } catch {
      // this visit only
    }
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, me.id]);
  useEffect(() => () => hush(), []);

  const context = useMemo<CoachContext>(() => {
    const items = sessions.map((s) => ({ sport: s.sport, startMs: Date.parse(s.startedAt), distanceM: s.distanceM ?? undefined }));
    return {
      ...(goals.length
        ? {
            goals: goals.slice(0, 8).map((g) => {
              const p = goalProgress(g, items, now);
              const weeksLeft = Math.max(1 / 7, p.daysLeft / 7);
              return {
                title: goalTitle(g, t, lang).slice(0, 80),
                kind: g.kind,
                ...(g.sport ? { sport: g.sport } : {}),
                done: p.done,
                target: p.target,
                daysLeft: p.daysLeft,
                onTrack: p.onTrack,
                perWeekNeeded: g.kind === "consistency" ? g.target : Math.round((Math.max(0, p.target - p.done) / weeksLeft) * 10) / 10,
                status: p.status,
              };
            }),
          }
        : {}),
    };
  }, [goals, sessions, t, lang, now]);

  const ask = async (message: string) => {
    const m = message.trim().slice(0, 500);
    if (!m || busy) return;
    unlockAudio();
    setError(false);
    setBusy(true);
    const history = turns.slice(-6).map(({ role, text: x }) => ({ role, text: x.slice(0, 300) }));
    setTurns((x) => [...x, { role: "user", text: m }]);
    setText("");
    try {
      const r = await api.coachTalk({
        message: m,
        history,
        context,
        lang,
        units: prefs.units,
        clock: new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 ? "12h" : "24h",
        voice: prefs.speakReplies && cloudVoice,
      });
      const proposal = r.action?.type === "propose_plan";
      setTurns((x) => [...x, { role: "coach", text: r.reply, proposal }]);
      if (prefs.speakReplies) {
        hush();
        conv.begin(cloudVoice);
        speakReply(r.reply, r.voice, conv);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };

  const mic = () => {
    if (listening) {
      stopper.current?.stop();
      return;
    }
    unlockAudio();
    hush();
    let last = "";
    const h = listen(
      lang,
      (words, final) => {
        last = words;
        setText(words);
        if (final) stopper.current?.stop();
      },
      () => {
        setListening(false);
        stopper.current = null;
        if (last) void ask(last);
      },
    );
    if (h) {
      stopper.current = h;
      setListening(true);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <H1>{t.coach.title}</H1>
      <Small className="mt-1">{t.coach.lead}</Small>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
        <span className="text-sm">{t.coach.speakReplies}</span>
        <Toggle label={t.coach.speakReplies} on={prefs.speakReplies} onChange={(v) => setPrefs({ speakReplies: v })} />
      </div>

      <div className="mt-4 flex-1 space-y-3" aria-live="polite">
        <Bubble role="coach" text={t.coach.hello} />
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {t.coach.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm"
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((x, i) => (
          <div key={i}>
            <Bubble role={x.role} text={x.text} />
            {x.proposal && (
              <button type="button" className="mt-1 ml-2 text-sm text-lilac-fg underline" onClick={() => go({ name: "plan" })}>
                {t.coach.proposal} ›
              </button>
            )}
          </div>
        ))}
        {busy && <Kicker tone="lilac">{t.coach.thinking}</Kicker>}
        {error && <p className="text-sm text-down-fg">{t.common.error}</p>}
        <div ref={end} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-20 mt-4 flex gap-2 bg-night pt-2">
        <input
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-lilac-fg"
          value={text}
          maxLength={500}
          placeholder={listening ? t.coach.listening : t.coach.placeholder}
          aria-label={t.coach.placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        {micOk && (
          <button
            type="button"
            onClick={mic}
            aria-pressed={listening}
            aria-label={listening ? t.coach.listening : t.coach.listen}
            className={cn(
              "h-12 w-12 shrink-0 rounded-xl border text-lg",
              listening ? "border-lilac-fg bg-lilac text-ink" : "border-line bg-surface",
            )}
          >
            🎙
          </button>
        )}
        <Btn type="submit" variant="volt" disabled={busy || !text.trim()} className="px-4">
          {t.coach.send}
        </Btn>
      </form>
      {!micOk && <Small className="mt-2">{t.coach.noMic}</Small>}
      {/* The account's plan (Coach Plus, or Premium for Premium and testers) is named here: never while Coach is off (ADR-0059 decision 8). */}
      {upsellAllowed(profile, "coach") && (
        <div className="mt-3">
          <Note>{fmt(t.coach.voiceNote, { plan: ownPlanName(me) })}</Note>
          <GetTheApp t={t} compact className="mt-2" />
        </div>
      )}
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "coach"; text: string }) {
  return (
    <p
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
        role === "coach" ? "rounded-tl-sm border border-lilac-fg/30 bg-surface" : "ml-auto rounded-tr-sm bg-volt text-ink",
      )}
    >
      {text}
    </p>
  );
}
