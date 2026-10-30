"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { coachPlusActive, ownPlanName } from "@/lib/coachPlus";
import { upsellAllowed } from "@/lib/webapp/tailor/tailor";
import { cn } from "@/lib/cn";
import { hush, speakReply, unlockAudio } from "@/lib/webapp/coachAudio";
import { createConversationVoice } from "@/lib/webapp/speechQueue";
import { canListen, listen } from "@/lib/webapp/voice";
import { useApp } from "./AppContext";
import { GetTheApp } from "./GetTheApp";
import { COACH_DRAFT_KEY } from "./SeasonWeek";
import { Btn, H1, Kicker, Note, Small, Toggle } from "./ui";
import { OpenScreenButton } from "./Suggest";
import { CoachActionCard } from "./CoachActionCard";
import { useCoachChat } from "./useCoachChat";
import { useTalkPrewarm } from "./TalkSheet";

/**
 * Coach (apps/mobile app/(tabs)/coach.tsx): talk to your coach (POST /v1/coach/talk, the same coach as the app, with
 * your goals in the context so it follows up on them). Type, or speak where the browser can listen (Web Speech);
 * replies can be read aloud: in the coach's own voice for Plus (the reply's audio from the API, within its daily voice
 * quota, one voice for the whole conversation), else the browser's best voice. A plan change it proposes waits on Plan for your yes.
 *
 * The coach's app actions (ADR-0063, ADR-0068; useCoachChat.ts / useCoachRunner.ts): a card under its reply ("Start
 * Run · 30 min · [Start] [Not now]"); nothing runs before the athlete's yes (the tap, or a said or typed "yes" with the
 * card on screen), and the coach's next line says what really happened. "No" cancels; "no, rather Thursday" asks for
 * a new offer. Pausing a workout, summaries and places answer at once. The talk sheet (TalkSheet.tsx) is the hands-free
 * way; this tab stays the written conversation.
 */

const KEY = "vvake-app-coach";

export function CoachScreen() {
  const { t, lang, prefs, setPrefs, go, me, profile, fmt, suggests } = useApp();
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
  const [listening, setListening] = useState(false);
  const stopper = useRef<{ stop(): void } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [micOk] = useState(() => canListen());
  const conv = useMemo(() => createConversationVoice(), []);
  // Plus / Premium: always the coach's voice, whatever the device-voice choice (voiceGuarantee.ts).
  const cloudVoice = coachPlusActive(me) || me.coach?.voice !== "device";
  const chat = useCoachChat({
    storeKey: KEY,
    screen: "coach",
    wantVoice: prefs.speakReplies && cloudVoice,
    speak: (line, voice, onDone) => {
      if (!prefs.speakReplies) return void onDone?.();
      hush();
      conv.begin(cloudVoice);
      speakReply(line, voice, conv, onDone);
    },
  });
  const { turns, busy, error } = chat;
  const prewarm = useTalkPrewarm();

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);
  useEffect(() => () => hush(), []);
  // The Coach tab is one tap from talking: the live talk's socket gets ready here (ADR-0068 pre-warm).
  useEffect(() => prewarm(), [prewarm]);

  const ask = (message: string, source: "voice" | "chat" = "chat") => {
    if (!message.trim() || busy) return;
    setText("");
    void chat.ask(message, source);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
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
        if (last) ask(last, "voice");
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
                onClick={() => ask(s)}
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
            {x.open && (
              <div className="mt-1 ml-2">
                <OpenScreenButton route={x.open.route} label={x.open.label} />
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
      {upsellAllowed(profile, "coach") && suggests("you_might_like") && (
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
