"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLivingDict } from "@/i18n/living";
import { getTalkDict } from "@/i18n/talk";
import type { CoachContext } from "@/lib/webapp/api";
import { localDay } from "@/lib/webapp/format";
import { goalProgress } from "@/lib/webapp/goals";
import { unlockAudio } from "@/lib/webapp/coachAudio";
import type { CoachActionFail, CoachAppAction } from "@/lib/webapp/coach/coachActions";
import { cardAnswer, runsOnArrival } from "@/lib/webapp/coach/talkFlow";
import { cardActionOf, localCardFor, resultLine, type CardState, type CardTurn, type PlacesView } from "@/lib/webapp/coach/webActions";
import { useApp, type Route } from "./AppContext";
import { goalTitle } from "./GoalsScreen";
import { openScreenOf } from "./Suggest";
import { locationGranted, useCoachRunner, useTodayPlan } from "./useCoachRunner";
import { useNow } from "./useNow";

/**
 * One coach conversation on the web (the Coach tab and the talk sheet): the turns, POST /v1/coach/talk with the
 * athlete's context, the action cards and their answers (a tap, or a said / typed yes / no / "no, rather Thursday" in
 * every mode, ADR-0068), and the live call's app_action cards (`liveCard`: resolved with what really happened).
 * Speaking is the caller's (`speak`): the Coach tab reads aloud when asked to, the talk sheet always in push-to-talk.
 */

export interface ChatTurn {
  role: "user" | "coach";
  text: string;
  proposal?: boolean;
  /** The coach's `open_screen` button (ADR-0062 §5): an app route the web has, and its label. */
  open?: { route: string; label: string };
  /** The coach's action card (ADR-0063) and where it stands. */
  act?: CardTurn;
  /** The card was made here: the coach couldn't be reached. */
  local?: boolean;
  /** A live card: how many captions were on screen when it came (it shows after them). */
  at?: number;
}

/** A card left pending (or running) when the page was left is never run after a reload: it shows as expired. */
const reloaded = (x: ChatTurn): ChatTurn =>
  x.act && (x.act.state === "pending" || x.act.state === "busy") ? { ...x, act: { ...x.act, state: "expired" } } : x;

export type CardResult = {
  status: "done" | "cancelled" | "failed";
  reason?: CoachActionFail;
  line: string;
  /** show_places: what was found (the live coach's find_places answer). */
  places?: import("@/lib/webapp/coach/talkFlow").OutingPlace[];
};

export interface ChatOptions {
  /** sessionStorage key (per account): the Coach tab and the talk sheet keep their own. */
  storeKey: string;
  /** The screen the athlete talks from (the coach's context.where.screen). */
  screen: string;
  /** Says a coach line (`voice`: the reply's audio from the API); `onDone` when it finished. */
  speak: (text: string, voice: { url: string; tag?: string | null } | null | undefined, onDone?: () => void) => void;
  /** Ask the API for the reply's audio (Plus, voice on). */
  wantVoice: boolean;
  /** A card's state for the live server (shown, confirmed, cancelled, done, failed). */
  onCardState?: (id: string, state: "shown" | "confirmed" | "cancelled" | "done" | "failed", reason?: string) => void;
  /** Leaving for a workout / camera screen (the talk sheet closes first). */
  onLeave?: () => void;
}

export function useCoachChat(o: ChatOptions) {
  const { t, lang, api, goals, sessions, prefs, go, me, lastMoment } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const today = useTodayPlan();
  const runner = useCoachRunner(today);
  const now = useNow();
  const key = `${o.storeKey}:${me.id}`;
  const [turns, setTurns] = useState<ChatTurn[]>(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(key) ?? "[]") as ChatTurn[];
      return Array.isArray(v) ? v.slice(-30).map(reloaded) : [];
    } catch {
      return [];
    }
  });
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
    try {
      sessionStorage.setItem(key, JSON.stringify(turns.slice(-30)));
    } catch {
      // this visit only
    }
  }, [turns, key]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const opts = useRef(o);
  useEffect(() => {
    opts.current = o;
  });
  /** Live app_action cards waiting for the athlete: resolved with the outcome (the coach hears the truth). */
  const waiting = useRef(new Map<string, (r: CardResult) => void>());

  const context = useMemo<CoachContext>(() => {
    const items = sessions.map((s) => ({ sport: s.sport, startMs: Date.parse(s.startedAt), distanceM: s.distanceM ?? undefined }));
    return {
      where: { screen: o.screen, ...(lastMoment ? { last: lastMoment } : {}) },
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
  }, [goals, sessions, t, lang, now, lastMoment, today, o.screen]);

  const say = useCallback((line: string, speak = true) => {
    setTurns((x) => [...x, { role: "coach", text: line }]);
    if (speak) opts.current.speak(line, null);
  }, []);

  const patchCard = useCallback((i: number, p: Partial<CardTurn>) => {
    setTurns((x) => x.map((y, j) => (j === i && y.act ? { ...y, act: { ...y.act, ...p } } : y)));
  }, []);

  /** A card's end: its state, the line said, the live server told, a waiting live tool resolved. */
  const settle = useCallback(
    (
      i: number,
      card: CardTurn,
      outcome: { ok: true } | { ok: false; reason: CoachActionFail | "cancelled" },
      line: string,
      speak = true,
    ) => {
      const state: CardState = outcome.ok ? "done" : outcome.reason === "cancelled" ? "cancelled" : "failed";
      patchCard(i, { state });
      if (card.id) {
        opts.current.onCardState?.(
          card.id,
          state === "done" ? "done" : state === "cancelled" ? "cancelled" : "failed",
          outcome.ok ? undefined : outcome.reason,
        );
        const w = waiting.current.get(card.id);
        if (w) {
          waiting.current.delete(card.id);
          w({
            status: state === "done" ? "done" : state === "cancelled" ? "cancelled" : "failed",
            ...(outcome.ok || outcome.reason === "cancelled" ? {} : { reason: outcome.reason }),
            line,
          });
          // In a live talk the coach hears it through the tool and goes on: the line is shown, said once by the app.
        }
      }
      say(line, speak);
    },
    [patchCard, say],
  );

  const leave = useCallback(
    (i: number, line: string, to: Route) => {
      const next: ChatTurn[] = [
        ...turnsRef.current.map((y, j) => (j === i && y.act ? { ...y, act: { ...y.act, state: "done" as const } } : y)),
        { role: "coach", text: line },
      ];
      setTurns(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next.slice(-30)));
      } catch {
        // this visit only
      }
      const card = turnsRef.current[i]?.act;
      if (card?.id) {
        opts.current.onCardState?.(card.id, "done");
        waiting.current.get(card.id)?.({ status: "done", line });
        waiting.current.delete(card.id);
      }
      opts.current.onLeave?.();
      go(to);
    },
    [go, key],
  );

  /** Runs card `i` (the tap, a said / typed yes, or on arrival). */
  const confirm = useCallback(
    async (i: number, source: "voice" | "chat" | "tap" = "tap") => {
      const card = turnsRef.current[i]?.act;
      if (!card || card.state !== "pending") return;
      unlockAudio();
      const a = card.action;
      if (runner.plan(a).kind === "line") return;
      patchCard(i, { state: "busy", ...(a.type === "show_places" ? { places: { kind: "searching" } as PlacesView } : {}) });
      if (card.id) opts.current.onCardState?.(card.id, "confirmed");
      const r = await runner.run(a, { lang: L, source });
      if (r.ok && r.go) return leave(i, resultLine(a, { ok: true }, L), r.go);
      if (a.type === "show_places") {
        const places: PlacesView = r.ok ? (r.places?.length ? { kind: "list", items: r.places } : { kind: "none" }) : { kind: "none" };
        patchCard(i, { places });
        if (card.id) {
          const w = waiting.current.get(card.id);
          waiting.current.delete(card.id);
          w?.(r.ok ? { status: "done", line: "", places: r.places ?? [] } : { status: "failed", reason: r.reason, line: "" });
        }
        if (r.ok && !r.places?.length) return settle(i, card, { ok: false, reason: "failed" }, getTalkDict(lang).places.none);
      }
      if (!r.ok && r.line === "pause_conflict") {
        // No paused days left in the last 4 weeks: the pause card's own words, which say why.
        return settle(i, card, { ok: false, reason: "failed" }, getLivingDict(lang).pause.conflict);
      }
      // The workout says its own cues; a summary's card is its answer (no extra line).
      if (r.ok && a.type === "show_summary") {
        patchCard(i, { state: "done" });
        if (card.id) opts.current.onCardState?.(card.id, "done");
        waiting.current.get(card.id ?? "")?.({ status: "done", line: "" });
        return;
      }
      settle(
        i,
        card,
        r.ok ? { ok: true } : { ok: false, reason: r.reason },
        resultLine(a, r.ok ? { ok: true } : { ok: false, reason: r.reason }, L),
      );
    },
    [runner, patchCard, leave, settle, L, lang],
  );

  const cancel = useCallback(
    (i: number) => {
      const card = turnsRef.current[i]?.act;
      if (!card || (card.state !== "pending" && card.state !== "busy")) return;
      unlockAudio();
      settle(i, card, { ok: false, reason: "cancelled" }, resultLine(card.action, { ok: false, reason: "cancelled" }, L));
    },
    [settle, L],
  );

  /** A new card on screen: shown, run at once when it only answers (places wait for the location ask if needed). */
  const showCard = useCallback(
    (turn: ChatTurn, id?: string) => {
      const act = turn.act;
      setTurns((x) => [...x, turn]);
      if (!act) return;
      if (id) opts.current.onCardState?.(id, "shown");
      if (!runsOnArrival(act.action) || runner.plan(act.action).kind !== "run") return;
      void (async () => {
        // Let the turn land first (its index), then run it.
        await new Promise((r) => setTimeout(r, 0));
        const i = turnsRef.current.findIndex((y) => y.act === act);
        if (i < 0) return;
        if (act.action.type === "show_places" && !(await locationGranted())) return patchCard(i, { places: { kind: "ask" } });
        void confirm(i, "chat");
      })();
    },
    [runner, confirm, patchCard],
  );

  /** The card the athlete may be answering: the last pending one. */
  const pendingIndex = useCallback((): number => {
    const ts = turnsRef.current;
    for (let i = ts.length - 1; i >= 0; i--) if (ts[i]?.act?.state === "pending") return i;
    return -1;
  }, []);

  /** A said or typed answer to the card on screen; true when it was one (then nothing goes to the coach). */
  const answerCard = useCallback(
    (text: string, source: "voice" | "chat"): boolean => {
      const i = pendingIndex();
      const card = i >= 0 ? turnsRef.current[i]?.act : undefined;
      if (!card) return false;
      const ans = cardAnswer(text, { pending: true, runnable: runner.plan(card.action).kind === "run" });
      if (!ans || ans.kind === "change") return false;
      setTurns((x) => [...x, { role: "user", text }]);
      if (ans.kind === "confirm") void confirm(i, source);
      else cancel(i);
      return true;
    },
    [pendingIndex, runner, confirm, cancel],
  );

  /** Sends the athlete's words to the coach (push-to-talk and typing); resolves with the reply said or null. */
  const ask = useCallback(
    async (message: string, source: "voice" | "chat" = "chat", onSpoken?: () => void): Promise<boolean> => {
      const m = message.trim().slice(0, 500);
      if (!m) return false;
      unlockAudio();
      setError(false);
      if (answerCard(m, source)) {
        onSpoken?.();
        return true;
      }
      // "No, rather Thursday": the card on screen is cancelled quietly and the coach makes a new offer.
      const pi = pendingIndex();
      const pend = pi >= 0 ? turnsRef.current[pi]?.act : undefined;
      const change = pend ? cardAnswer(m, { pending: true, runnable: true }) : null;
      if (pend && change?.kind === "change") patchCard(pi, { state: "cancelled" });
      setBusy(true);
      const history = turnsRef.current.slice(-6).map(({ role, text: x }) => ({ role, text: x.slice(0, 300) }));
      setTurns((x) => [...x, { role: "user", text: m }]);
      const at = new Date();
      try {
        const r = await api.coachTalk({
          message: m,
          history,
          context,
          lang,
          units: prefs.units,
          clock: new Intl.DateTimeFormat(lang, { hour: "numeric" }).resolvedOptions().hour12 ? "12h" : "24h",
          voice: opts.current.wantVoice,
          localHour: at.getHours(),
          localDay: localDay(at.getTime()),
          ...(pend ? { card: { id: pend.id ?? `c${pi}`, type: pend.action.type } } : {}),
        });
        const proposal = r.action?.type === "propose_plan";
        const open = openScreenOf(r.action);
        const action = cardActionOf(r.action, L, today);
        showCard({
          role: "coach",
          text: r.reply,
          proposal,
          ...(open ? { open } : {}),
          ...(action ? { act: { action, state: "pending" as const } } : {}),
        });
        opts.current.speak(r.reply, r.voice, onSpoken);
        return true;
      } catch {
        // The coach can't be reached: a plain "start a run" still gets its card, made here, never a claim it started.
        const local = localCardFor(m, L, today);
        if (local) {
          setTurns((x) => [...x, { role: "coach", text: local.reply, act: { action: local.action, state: "pending" }, local: true }]);
          opts.current.speak(local.reply, null, onSpoken);
          return true;
        }
        setError(true);
        onSpoken?.();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [answerCard, pendingIndex, patchCard, api, context, lang, prefs.units, L, today, showCard],
  );

  /** The live coach's app_action: its card on screen; resolves with what really happened (tap, yes, no, or gone). */
  const liveCard = useCallback(
    (args: Record<string, unknown>, id: string, at?: number): Promise<CardResult> => {
      const action: CoachAppAction | null = cardActionOf(args, L, today);
      if (!action) return Promise.resolve({ status: "failed", reason: "failed", line: "" });
      return new Promise((resolve) => {
        waiting.current.set(id, resolve);
        showCard({ role: "coach", text: "", act: { action, state: "pending", id }, ...(at !== undefined ? { at } : {}) }, id);
      });
    },
    [L, today, showCard],
  );

  /** The live server read a yes / no to card `id` (answer_card): the same as the tap. */
  const answerLive = useCallback(
    (id: string, decision: string) => {
      const i = turnsRef.current.findIndex((x) => x.act?.id === id);
      const idx = i >= 0 ? i : pendingIndex();
      if (idx < 0) return;
      if (decision === "confirm") void confirm(idx, "voice");
      else if (decision === "cancel" || decision === "change") cancel(idx);
    },
    [confirm, cancel, pendingIndex],
  );

  /** Cards still waiting when the talk ends: they count as "not now" for the coach (never run later). */
  const dropWaiting = useCallback(() => {
    for (const [, w] of waiting.current) w({ status: "cancelled", line: "" });
    waiting.current.clear();
  }, []);

  /** Places: the athlete allowed the location on the card. */
  const allowPlaces = useCallback((i: number) => void confirm(i, "tap"), [confirm]);

  return {
    turns,
    setTurns,
    busy,
    error,
    today,
    runner,
    ask,
    confirm,
    cancel,
    say,
    answerCard,
    liveCard,
    answerLive,
    dropWaiting,
    allowPlaces,
  };
}
