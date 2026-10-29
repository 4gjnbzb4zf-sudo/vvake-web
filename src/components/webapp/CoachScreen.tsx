"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { coachPlusActive, ownPlanName } from "@/lib/coachPlus";
import { upsellAllowed } from "@/lib/webapp/tailor/tailor";
import { cn } from "@/lib/cn";
import { localTz, type CoachContext, type Week } from "@/lib/webapp/api";
import { ApiError } from "@/lib/rewardsApi";
import { getLivingDict } from "@/i18n/living";
import { localDay } from "@/lib/webapp/format";
import { downloadText, livingApi } from "@/lib/webapp/livingApi";
import { isCatalogSport, LEGACY_SPORT_KEYS } from "@/lib/webapp/living/sportCatalog";
import { dayOf, logHabit, readDays, withDay, writeDays } from "@/lib/webapp/rhythm";
import { uuid } from "@/lib/webapp/workout";
import { spokenConfirm, type CoachActionFail } from "@/lib/webapp/coach/coachActions";
import {
  actionIcs,
  cameraRoutineOf,
  cardActionOf,
  localCardFor,
  pauseUntil,
  resultLine,
  webCardPlan,
  webHabitOf,
  workoutSport,
  type CardState,
  type CardTurn,
  type TodayPlan,
} from "@/lib/webapp/coach/webActions";
import { goalProgress } from "@/lib/webapp/goals";
import { hush, speakReply, unlockAudio } from "@/lib/webapp/coachAudio";
import { createConversationVoice } from "@/lib/webapp/speechQueue";
import { canListen, listen } from "@/lib/webapp/voice";
import { useApp, type Route } from "./AppContext";
import { GetTheApp } from "./GetTheApp";
import { COACH_DRAFT_KEY } from "./SeasonWeek";
import { goalTitle } from "./GoalsScreen";
import { Btn, H1, Kicker, Note, Small, Toggle } from "./ui";
import { OpenScreenButton, openScreenOf } from "./Suggest";
import { CoachActionCard } from "./CoachActionCard";
import { useWorkout } from "./WorkoutContext";
import { useNow } from "./useNow";

/**
 * Coach (apps/mobile app/(tabs)/coach.tsx): talk to your coach (POST /v1/coach/talk, the same coach as the app, with
 * your goals in the context so it follows up on them). Type, or speak where the browser can listen (Web Speech);
 * replies can be read aloud: in the coach's own voice for Plus (the reply's audio from the API, within its daily voice
 * quota, one voice for the whole conversation), else the browser's best voice. A plan change it proposes waits on Plan for your yes.
 *
 * The coach's app actions (ADR-0063, coach/webActions.ts): a card under its reply ("Start Run · 30 min · [Start]
 * [Not now]"); nothing runs before the tap, and the coach's next line says what really happened. A typed "yes" is
 * not the tap (the server answers with the card again); a "no" cancels the card on screen.
 */

interface Turn {
  role: "user" | "coach";
  text: string;
  proposal?: boolean;
  /** The coach's `open_screen` button (ADR-0062 §5): an app route the web has, and its label. */
  open?: { route: string; label: string };
  /** The coach's action card (ADR-0063) and where it stands. */
  act?: CardTurn;
  /** The card was made here: the coach couldn't be reached. */
  local?: boolean;
}

/** A card left pending (or running) when the page was left is never run after a reload: it shows as expired. */
const reloaded = (x: Turn): Turn =>
  x.act && (x.act.state === "pending" || x.act.state === "busy") ? { ...x, act: { ...x.act, state: "expired" } } : x;

const KEY = "vvake-app-coach";
/** When a card is tapped (read in the handler, not during render). */
const tapTime = () => Date.now();

export function CoachScreen() {
  const { t, lang, api, session, goals, sessions, prefs, setPrefs, go, me, profile, fmt, suggests, lastMoment, featureOn, online } =
    useApp();
  const wk = useWorkout();
  const L = lang === "fr" ? "fr" : "en";
  const la = useMemo(() => livingApi(session), [session]);
  const cameraOn = featureOn("camera");
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(`${KEY}:${me.id}`) ?? "[]") as Turn[];
      return Array.isArray(v) ? v.slice(-30).map(reloaded) : [];
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

  // Today's planned session, for the coach's "start today's session" card (the same week Today shows).
  const [week, setWeek] = useState<Week | null>(null);
  useEffect(() => {
    void api
      .week(localTz(), lang)
      .then(setWeek)
      .catch(() => setWeek(null));
  }, [api, lang]);
  const todayKey = localDay(now);
  const today = useMemo<TodayPlan | undefined>(() => {
    if (!week) return undefined;
    const d = week.days.find((x) => x.date === todayKey);
    if (!d) return week.days.length ? { rest: true } : undefined;
    const sport = LEGACY_SPORT_KEYS[d.sport] ?? d.sport;
    return isCatalogSport(sport) ? { sport, minutes: Math.max(0, Math.min(600, Math.round(d.minutes))) } : undefined;
  }, [week, todayKey]);

  const context = useMemo<CoachContext>(() => {
    const items = sessions.map((s) => ({ sport: s.sport, startMs: Date.parse(s.startedAt), distanceM: s.distanceM ?? undefined }));
    return {
      // Where the athlete is (ADR-0062 §5): the Coach tab, and the session finished this visit if any.
      where: { screen: "coach", ...(lastMoment ? { last: lastMoment } : {}) },
      ...(today ? { today } : {}),
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
  }, [goals, sessions, t, lang, now, lastMoment, today]);

  const say = (line: string, speak: boolean) => {
    setTurns((x) => [...x, { role: "coach", text: line }]);
    if (speak && prefs.speakReplies) {
      hush();
      conv.begin(cloudVoice);
      speakReply(line, null, conv);
    }
  };
  /** Done, and off to the workout: the chat is saved first (this screen unmounts before its effect would save it). */
  const leave = (i: number, line: string, to: Route) => {
    const next: Turn[] = [
      ...turns.map((y, j) => (j === i && y.act ? { ...y, act: { ...y.act, state: "done" as const } } : y)),
      { role: "coach", text: line },
    ];
    setTurns(next);
    try {
      sessionStorage.setItem(`${KEY}:${me.id}`, JSON.stringify(next.slice(-30)));
    } catch {
      // this visit only
    }
    go(to);
  };
  const setCard = (i: number, state: CardState) =>
    setTurns((x) => x.map((y, j) => (j === i && y.act ? { ...y, act: { ...y.act, state } } : y)));

  /** The card's tap: checked again (a workout may have started meanwhile), run, then the coach says what happened. */
  const confirmCard = async (i: number) => {
    const card = turns[i]?.act;
    if (!card || card.state !== "pending") return;
    const a = card.action;
    unlockAudio();
    const finish = (o: { ok: true } | { ok: false; reason: CoachActionFail }, speak = true) => {
      setCard(i, o.ok ? "done" : "failed");
      say(resultLine(a, o, L), speak);
    };
    const plan = webCardPlan(a, { inWorkout: !!wk.w, cameraOn });
    if (plan.kind === "line") return finish({ ok: false, reason: plan.reason });
    setCard(i, "busy");
    switch (a.type) {
      case "start_workout": {
        const s = workoutSport(a, today);
        if ("fail" in s) return finish({ ok: false, reason: s.fail });
        wk.start(s.sport);
        // The workout says its own start cue: the line is written, not said (one voice at a time).
        return leave(i, resultLine(a, { ok: true }, L), { name: "workout" });
      }
      case "start_camera_workout": {
        const routine = cameraRoutineOf(a);
        return leave(i, resultLine(a, { ok: true }, L), { name: "camera", ...(routine ? { routine } : {}) });
      }
      case "add_to_calendar": {
        const r = actionIcs(a, L, tapTime(), uuid());
        if ("fail" in r) return finish({ ok: false, reason: r.fail });
        downloadText(r.file, r.ics);
        return finish({ ok: true });
      }
      case "pause_streak": {
        if (!online) return finish({ ok: false, reason: "offline" });
        try {
          const r = await la.pause(a.pauseKind ?? "sick", localTz(), pauseUntil(localDay(tapTime()), a.days ?? 1));
          return finish(r.ignored ? { ok: false, reason: "failed" } : { ok: true });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            // No paused days left in the last 4 weeks: the pause card's own words, which say why.
            setCard(i, "failed");
            return say(getLivingDict(lang).pause.conflict, true);
          }
          return finish({ ok: false, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "failed" });
        }
      }
      case "log_habit": {
        const k = webHabitOf(a.habit);
        if (!k) return finish({ ok: false, reason: "not_here" });
        const at = tapTime();
        const latest = readDays(me.id);
        const next = logHabit(dayOf(latest, at), k, at);
        if (!next) return finish({ ok: false, reason: "no_such_habit" });
        writeDays(me.id, withDay(latest, next));
        return finish({ ok: true });
      }
      default:
        return finish({ ok: false, reason: "not_here" });
    }
  };
  const cancelCard = (i: number) => {
    const card = turns[i]?.act;
    if (!card || card.state !== "pending") return;
    unlockAudio();
    setCard(i, "cancelled");
    say(resultLine(card.action, { ok: false, reason: "cancelled" }, L), true);
  };

  const ask = async (message: string) => {
    const m = message.trim().slice(0, 500);
    if (!m || busy) return;
    unlockAudio();
    setError(false);
    // A "no" to the card on screen cancels it here; a typed "yes" is not the tap (the server shows the card again).
    const lastCard = turns.length - 1;
    if (turns[lastCard]?.act?.state === "pending" && spokenConfirm({ liveCall: false, cardOnScreen: true, text: m }) === "cancel") {
      setTurns((x) => [...x, { role: "user", text: m }]);
      setText("");
      cancelCard(lastCard);
      return;
    }
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
      const open = openScreenOf(r.action);
      const action = cardActionOf(r.action, L, today);
      setTurns((x) => [
        ...x,
        {
          role: "coach",
          text: r.reply,
          proposal,
          ...(open ? { open } : {}),
          ...(action ? { act: { action, state: "pending" as const } } : {}),
        },
      ]);
      if (prefs.speakReplies) {
        hush();
        conv.begin(cloudVoice);
        speakReply(r.reply, r.voice, conv);
      }
    } catch {
      // The coach can't be reached: a plain "start a run" still gets its card, made here, never a claim it started.
      const local = localCardFor(m, L, today);
      if (local) {
        setTurns((x) => [...x, { role: "coach", text: local.reply, act: { action: local.action, state: "pending" }, local: true }]);
        if (prefs.speakReplies) {
          hush();
          conv.begin(cloudVoice);
          speakReply(local.reply, null, conv);
        }
      } else setError(true);
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
            {x.open && (
              <div className="mt-1 ml-2">
                <OpenScreenButton route={x.open.route} label={x.open.label} />
              </div>
            )}
            {x.act && (
              <CoachActionCard
                act={x.act}
                plan={webCardPlan(x.act.action, { inWorkout: !!wk.w, cameraOn })}
                local={x.local}
                onConfirm={() => void confirmCard(i)}
                onCancel={() => cancelCard(i)}
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
