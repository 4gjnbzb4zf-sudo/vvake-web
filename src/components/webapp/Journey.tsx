"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getLivingDict, type LivingDict } from "@/i18n/living";
import { cn } from "@/lib/cn";
import { localTz } from "@/lib/webapp/api";
import { ApiError } from "@/lib/rewardsApi";
import { dayLabel } from "@/lib/webapp/format";
import {
  beforeOf,
  celebratedKey,
  livingApi,
  parseSnapshot,
  snapshotKey,
  snapshotOf,
  type JourneyView,
  type LeagueView,
  type PauseView,
} from "@/lib/webapp/livingApi";
import { celebrationFor, type MilestoneCelebration } from "@/lib/webapp/living/celebrations";
import { bestStreakText } from "@/lib/webapp/living/comeback";
import { PAUSE_KINDS, PAUSE_MAX_DAYS, type PauseKind } from "@/lib/webapp/living/streakCare";
import { useApp, type Route } from "./AppContext";
import { VVakerImg } from "./MyVVaker";
import { Bar, Btn, Card, Kicker, Small } from "./ui";

/**
 * The VVake journey on the web (VVFit living-app.md §10, docs/02-product/journey.md): "Your path" at the top of the
 * Train tab (chapters, the current stone, the road where rest days are benches), the weekly streak beside the daily
 * one, the sick / injured / time-off pause, the comeback card on Today, the weekly league card in Crew & City, and the
 * one celebration after a web session. The path comes from GET /v1/journey; the rules the browser runs itself are
 * game-core's (./living). Health first: no guilt words, rest never costs anything, nothing during a workout.
 */

export function useLiving() {
  const { session, lang } = useApp();
  const la = useMemo(() => livingApi(session), [session]);
  return { la, L: getLivingDict(lang) };
}

// ── The journey, shared by the screens for the visit ──────────────────────────────────────────────────────────────

let lastJourney: { userId: string; lang: string; answer: JourneyView } | null = null;
const journeyListeners = new Set<(j: JourneyView) => void>();

function readLocal<T>(key: string, parse: (v: unknown) => T): T {
  try {
    const raw = localStorage.getItem(key);
    return parse(raw ? JSON.parse(raw) : null);
  } catch {
    return parse(null);
  }
}
function writeLocal(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // private mode: this visit only
  }
}

/** GET /v1/journey, kept in memory for the visit (a screen shows it at once, then refreshes). */
export function useJourney(enabled = true) {
  const { me, lang, streak } = useApp();
  const { la } = useLiving();
  const cached = lastJourney && lastJourney.userId === me.id && lastJourney.lang === lang ? lastJourney.answer : null;
  const [journey, setJourney] = useState<JourneyView | null>(cached);
  const [state, setState] = useState<"loading" | "ok" | "error">(cached ? "ok" : "loading");
  const adopt = useCallback(
    (j: JourneyView) => {
      lastJourney = { userId: me.id, lang, answer: j };
      setJourney(j);
      setState("ok");
      for (const l of journeyListeners) l(j);
    },
    [me.id, lang],
  );
  const load = useCallback(async () => {
    try {
      adopt(await la.journey(localTz(), lang));
    } catch {
      setState((s) => (s === "ok" ? s : "error"));
    }
  }, [la, lang, adopt]);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, enabled]);
  useEffect(() => {
    const l = (j: JourneyView) => setJourney(j);
    journeyListeners.add(l);
    return () => void journeyListeners.delete(l);
  }, []);
  // The milestones as last seen here: what the next web session's celebration compares with. Only with the day streak
  // known (a missing one would read as a fresh streak), and never over a newer snapshot of the same counters.
  const streakDays = streak?.days ?? null;
  useEffect(() => {
    if (!journey || streakDays === null) return;
    const old = readLocal(snapshotKey(me.id), parseSnapshot);
    const snap = snapshotOf(journey, streakDays, null);
    if (snap) writeLocal(snapshotKey(me.id), old?.leagueTier ? { ...snap, leagueTier: old.leagueTier } : snap);
  }, [journey, streakDays, me.id]);
  return { journey, state, load, adopt };
}

// ── Your path (the Train tab) ─────────────────────────────────────────────────────────────────────────────────────

const MARK_STYLE: Record<string, string> = {
  session: "bg-volt",
  rest: "bg-mint/70",
  pause: "bg-sky/60",
  free: "bg-surface-2 ring-1 ring-line",
  today: "bg-pulse ring-2 ring-pulse-fg/40",
  ahead: "bg-transparent ring-1 ring-line border-dashed",
};

export function JourneyPath() {
  const { lang, fmt, streak } = useApp();
  const { L } = useLiving();
  const { journey, state, load } = useJourney();
  if (!journey) return state === "error" ? <Small className="text-butter-fg">{L.path.error}</Small> : null;
  const ch = journey.current;
  const prog = journey.progress;
  const stone = journey.currentStone;
  const later = journey.chapters.filter((c) => c.status === "next" || c.status === "later").slice(0, 2);
  const weekly = journey.weeklyStreak;
  const planFirst = !!weekly?.firstForPlan;
  const daily = streak?.days ?? 0;
  const weeklyLine = weekly ? (weekly.weeks === 1 ? L.weekly.streakOne : fmt(L.weekly.streak, { n: weekly.weeks })) : null;
  const dailyLine = fmt(L.weekly.daily, { n: daily });
  return (
    <section aria-label={L.path.title} className="space-y-3">
      <Card>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Kicker tone="volt">{L.path.title}</Kicker>
            {ch && <p className="mt-1 font-display text-lg leading-snug font-semibold">{ch.title}</p>}
            {prog && (prog.chapters ?? 0) > 0 && (
              <Small className="mt-0.5">
                {fmt(L.path.chapterOf, { n: prog.chapter ?? ch?.index ?? 1, total: prog.chapters ?? 1 })} ·{" "}
                {fmt(L.path.stones, { done: ch?.stonesDone ?? prog.stonesDone ?? 0, total: ch?.stones.length ?? prog.stones ?? 0 })}
              </Small>
            )}
          </div>
          <VVakerImg alt="" className="h-14 w-10 shrink-0" />
        </div>
        {ch && (
          <div className="mt-3">
            <Bar fraction={ch.stones.length ? (ch.stonesDone ?? 0) / ch.stones.length : 0} label={L.path.title} />
          </div>
        )}
        {ch && ch.stones.length > 0 && (
          <ol className="mt-3 space-y-2">
            {ch.stones.map((s) => {
              const isNext = stone?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-2", isNext ? "bg-surface-2 ring-1 ring-volt-fg/50" : "")}
                  aria-current={isNext ? "step" : undefined}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      s.done ? "bg-volt text-ink" : isNext ? "bg-night text-volt-fg ring-2 ring-volt-fg" : "bg-surface-2 text-faint",
                    )}
                  >
                    {s.done ? "✓" : "◆"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {isNext && <span className="block text-[11px] font-semibold tracking-wide text-volt-fg uppercase">{L.path.next}</span>}
                    <span className={cn("block text-sm", s.done ? "text-muted" : "font-medium")}>{s.title}</span>
                  </span>
                  {!s.done && (s.target ?? 0) > 1 && (
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {fmt(L.path.stoneProgress, { count: s.count ?? 0, target: s.target ?? 0 })}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {ch && !stone && ch.complete && later[0] && (
          <Small className="mt-2">{fmt(L.path.allDone, { date: dayLabel(`${later[0].start}T12:00:00`, lang) })}</Small>
        )}
        {journey.road.length > 0 && (
          <div className="mt-4">
            <Small>{L.path.road}</Small>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={L.path.road}>
              {journey.road.map((d) => {
                const label = `${dayLabel(`${d.day}T12:00:00`, lang)}: ${(L.path.mark as Record<string, string>)[d.mark] ?? d.mark}`;
                return (
                  <li key={d.day} title={label} className="flex h-5 w-5 items-center justify-center">
                    <span className="sr-only">{label}</span>
                    {d.mark === "rest" ? (
                      <span aria-hidden className="text-xs text-mint-fg">
                        ⌒
                      </span>
                    ) : (
                      <span aria-hidden className={cn("block h-3 w-3 rounded-full", MARK_STYLE[d.mark] ?? MARK_STYLE.free)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {planFirst && weeklyLine && <span className="font-semibold text-volt-fg">{weeklyLine}</span>}
          <span className={cn(planFirst ? "text-muted" : "font-semibold text-pulse-fg")}>{dailyLine}</span>
          {!planFirst && weeklyLine && <span className="text-muted">{weeklyLine}</span>}
        </div>
        {weekly && <Small className="mt-1">{weekLine(weekly, L, fmt)}</Small>}
        {later.length > 0 && (
          <Small className="mt-3">
            {L.path.later}: {later.map((c) => c.title).join(" · ")}
          </Small>
        )}
      </Card>
      <PauseCard pause={journey.pause ?? null} onChanged={() => void load()} />
    </section>
  );
}

function weekLine(
  w: NonNullable<JourneyView["weeklyStreak"]>,
  L: LivingDict,
  fmt: (s: string, v?: Record<string, string | number>) => string,
) {
  const best = (w.best ?? 0) > w.weeks ? ` · ${fmt(L.weekly.best, { n: w.best ?? 0 })}` : "";
  const n = w.needed ?? 0;
  const line =
    w.thisWeek === "kept"
      ? L.weekly.kept
      : w.thisWeek === "rest"
        ? L.weekly.rest
        : w.thisWeek === "held"
          ? L.weekly.held
          : w.thisWeek === "open" && n > 0
            ? fmt(n === 1 ? L.weekly.open : L.weekly.openMany, { n })
            : w.thisWeek === "missed"
              ? L.weekly.missed
              : "";
  return `${line}${best}`.replace(/^ · /, "");
}

// ── The pause ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The day `n` days after `day` (YYYY-MM-DD, calendar days). Pure. */
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Sick, injured or time off (journey.md §2): one tap pauses the streak up to 14 days (no freeze spent, no competition,
 * no comeback, the coach is told); "I'm back" ends it. While one is on, its line ("Get well: your streak waits for you
 * until …") and "I'm back".
 */
export function PauseCard({ pause, onChanged, compact }: { pause: PauseView | null; onChanged: () => void; compact?: boolean }) {
  const { fmt } = useApp();
  const { la, L } = useLiving();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PauseKind>("sick");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [until, setUntil] = useState(() => addDays(today, 6));
  const formId = useId();
  const active = !!pause?.active;
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setOpen(false);
      if (done) setMsg(done);
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 409 ? L.pause.conflict : L.pause.error);
    } finally {
      setBusy(false);
    }
  };
  if (active && pause) {
    const left = pause.daysLeft ?? 0;
    return (
      <Card>
        <p className="text-sm font-medium text-sky-fg">{pause.text}</p>
        {left > 0 && <Small className="mt-1">{left === 1 ? L.pause.leftOne : fmt(L.pause.left, { n: left })}</Small>}
        <Btn variant="ghost" className="mt-3 w-full" disabled={busy} onClick={() => void run(() => la.endPause(localTz()), L.pause.ending)}>
          {L.pause.end}
        </Btn>
        {msg && (
          <p role="status" className="mt-2 text-sm text-muted">
            {msg}
          </p>
        )}
      </Card>
    );
  }
  if (compact && !open) return msg ? <Small>{msg}</Small> : null;
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((x) => !x)}
        className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm"
      >
        <span aria-hidden className="text-sky-fg">
          ☾
        </span>
        <span className="flex-1 font-medium">{L.pause.title}</span>
        <span aria-hidden className="text-faint">
          {open ? "–" : "+"}
        </span>
      </button>
      {open && (
        <div id={formId} className="space-y-3 border-t border-line px-4 pt-3 pb-4">
          <Small>{L.pause.lead}</Small>
          <div role="radiogroup" aria-label={L.pause.title} className="flex flex-wrap gap-2">
            {PAUSE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-semibold",
                  kind === k ? "border-sky-fg bg-surface-2 text-sky-fg" : "border-line text-muted",
                )}
              >
                {L.pause.kinds[k]}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{L.pause.until}</span>
            <input
              type="date"
              className="h-12 w-full rounded-xl border border-line bg-night px-4 text-base text-text"
              min={today}
              max={addDays(today, PAUSE_MAX_DAYS - 1)}
              value={until}
              onChange={(e) => setUntil(e.target.value || addDays(today, 6))}
            />
          </label>
          <Btn variant="volt" className="w-full" disabled={busy} onClick={() => void run(() => la.pause(kind, localTz(), until))}>
            {L.pause.start}
          </Btn>
        </div>
      )}
      {msg && (
        <p role="status" className="px-4 pb-3 text-sm text-muted">
          {msg}
        </p>
      )}
    </div>
  );
}

// ── Comebacks (Today) ─────────────────────────────────────────────────────────────────────────────────────────────

const COMEBACK_ROUTE: Record<string, Route | null> = {
  ease_back: { name: "plan" },
  talk_coach: { name: "coach" },
  daily_move: { name: "rhythm" },
  short_session: { name: "plan" },
  fresh_start: null,
};

/**
 * After a break (journey.md §4): the easiest win first, and after 14 days a welcome back with three choices and the
 * best streak (never a zero). Never during a pause, never in Quiet (the API's `card`, and suggestAllowed here), never
 * during a workout. "Not now" hides it for the day in this browser.
 */
export function ComebackCard() {
  const { go, suggests, streak, me, lang } = useApp();
  const { L } = useLiving();
  const { journey, load } = useJourney();
  const day = new Date().toDateString();
  const hideKey = `vvake-app-comeback-hidden:${me.id}`;
  const [hidden, setHidden] = useState(() => readLocal(hideKey, (v) => v === day));
  const [note, setNote] = useState<string | null>(null);
  const cb = journey?.comeback;
  const paused = !!journey?.pause?.active;
  if (paused && journey?.pause) return <PauseCard pause={journey.pause} onChanged={() => void load()} compact />;
  if (!cb || cb.stage === "none" || !cb.card || !cb.text || hidden || !suggests("next_step")) return null;
  const choices = cb.choices.length ? cb.choices : cb.next ? [cb.next] : [];
  return (
    <Card>
      <Kicker tone="mint">{L.comeback.kicker}</Kicker>
      <p className="mt-2 font-display text-lg leading-snug font-semibold">{cb.text}</p>
      {cb.stage === "welcome_back" && (streak?.best ?? 0) > 0 && (
        <Small className="mt-1">{bestStreakText(streak?.best ?? 0, lang === "fr" ? "fr" : "en")}</Small>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {choices.map((c, i) => (
          <Btn
            key={c}
            variant={i === 0 ? "volt" : "ghost"}
            className="w-full"
            onClick={() => {
              const r = COMEBACK_ROUTE[c];
              if (r) go(r);
              else setNote(L.comeback.freshStartApp);
            }}
          >
            {(L.comeback.choices as Record<string, string>)[c] ?? c}
          </Btn>
        ))}
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-muted">
          {note}
        </p>
      )}
      <button
        type="button"
        className="mt-2 min-h-11 w-full text-sm text-muted underline"
        onClick={() => {
          writeLocal(hideKey, day);
          setHidden(true);
        }}
      >
        {L.comeback.close}
      </button>
    </Card>
  );
}

// ── The weekly league (Crew & City) ───────────────────────────────────────────────────────────────────────────────

/**
 * The weekly league (journey.md §5): cohorts of ~30 movers from your city (else your time zone), score = showing up +
 * beating your own usual, capped; promotion for the top third, no demotion for resting members. Social feature only;
 * others show as @handle or "a mover"; no $VVAKE. Last week's result reads "New week, new league" on a move down.
 */
export function LeagueCard() {
  const { featureOn, lang, fmt, me } = useApp();
  const { la, L } = useLiving();
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [error, setError] = useState(false);
  const social = featureOn("social");
  useEffect(() => {
    if (!social) return;
    let live = true;
    la.league(localTz(), lang)
      .then((l) => {
        if (!live) return;
        setLeague(l);
        // The tier joins the milestones snapshot (a promotion is a celebration).
        const old = readLocal(snapshotKey(me.id), parseSnapshot);
        if (old && l.on && l.tier) writeLocal(snapshotKey(me.id), { ...old, leagueTier: l.tier });
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [la, lang, social, me.id]);
  if (!social) return null;
  if (error) return <Small>{L.league.error}</Small>;
  if (!league?.on) return null;
  const members = league.cohort?.members ?? [];
  const meIdx = members.findIndex((m) => m.me);
  const around = meIdx < 0 ? members.slice(0, 5) : members.slice(Math.max(0, meIdx - 2), Math.max(0, meIdx - 2) + 5);
  const mine = meIdx >= 0 ? members[meIdx] : null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Kicker tone="pulse">{L.league.title}</Kicker>
          <p className="mt-1 font-display text-lg font-semibold">{league.tierName}</p>
          <Small>
            {league.region?.name
              ? fmt(L.league.region, { name: league.region.name })
              : league.region?.kind === "world"
                ? L.league.regionWorld
                : ""}
          </Small>
        </div>
        {mine && league.cohort && (
          <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold tabular-nums">
            {fmt(L.league.rank, { rank: mine.rank, size: league.cohort.size })}
          </span>
        )}
      </div>
      {league.last?.text && (
        <p className="mt-3 text-sm">
          <span className="text-muted">{L.league.lastWeek}: </span>
          {league.last.text}
        </p>
      )}
      {league.hint && !league.placed && <Small className="mt-2">{league.hint}</Small>}
      {league.resting && <Small className="mt-2 text-sky-fg">{L.league.resting}</Small>}
      {around.length > 0 && (
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
          {around.map((m) => (
            <li key={m.rank} className={cn("flex items-center gap-3 px-3 py-2 text-sm", m.me && "bg-surface-2 font-semibold")}>
              <span className="w-8 text-muted tabular-nums">{m.rank}</span>
              <span className="min-w-0 flex-1 truncate">{m.me ? L.league.you : m.label}</span>
              <span className="text-muted tabular-nums">{fmt(L.league.score, { n: Math.round(m.score ?? 0) })}</span>
            </li>
          ))}
        </ol>
      )}
      <Small className="mt-3">{fmt(L.league.rules, { promote: league.rules?.promote ?? 7 })}</Small>
    </Card>
  );
}

// ── Celebrations after a web session ────────────────────────────────────────────────────────────────────────────────

/**
 * Remembers the milestones as they are when a web workout starts, so the summary can tell what this session crossed:
 * the journey's counters, the day streak and the league tier, kept in this browser.
 */
export function usePrimeMilestones(workoutId: string | null) {
  const { me, api, lang, featureOn } = useApp();
  const { la } = useLiving();
  const social = featureOn("social");
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!workoutId || done.current === workoutId) return;
    done.current = workoutId;
    const tz = localTz();
    void Promise.allSettled([la.journey(tz, lang), api.streak(tz), social ? la.league(tz, lang) : Promise.reject(new Error("off"))]).then(
      ([j, s, l]) => {
        if (j.status !== "fulfilled" || s.status !== "fulfilled") return;
        const snap = snapshotOf(j.value, s.value.days, l.status === "fulfilled" ? l.value : null);
        if (snap) writeLocal(snapshotKey(me.id), snap);
      },
    );
  }, [workoutId, me.id, la, api, lang, social]);
}

const REACTION_ICON: Record<string, string> = { jump: "✨", flex: "💪", medal: "🏅", wave: "👋" };
const REACTION_MOTION: Record<string, string> = {
  jump: "motion-safe:animate-[float_0.9s_ease-in-out_2]",
  flex: "motion-safe:animate-pop",
  medal: "motion-safe:animate-[wiggle_0.8s_ease-in-out_2]",
  wave: "motion-safe:animate-[wiggle_0.8s_ease-in-out_2]",
};

/**
 * The session's one celebration (journey.md §3): once the session is saved, the counters after it are read and
 * compared with those remembered at the start (game-core celebrationFor: the highest milestone crossed; the others are
 * small inline wins). Full screen for a moment, the VVaker reacting, the coach's line; still with
 * prefers-reduced-motion. A result, not a suggestion: shown at every level, Quiet included; never during a workout;
 * one per session, never twice (remembered in this browser).
 */
export function SessionCelebration({ sessionId, ready }: { sessionId: string; ready: boolean }) {
  const { me, api, lang, featureOn, suggests } = useApp();
  const { la, L } = useLiving();
  const social = featureOn("social");
  const [cel, setCel] = useState<MilestoneCelebration | null>(null);
  const titleId = useId();
  const action = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ready || !suggests("celebration")) return;
    const seen = readLocal(celebratedKey(me.id), (v) => (Array.isArray(v) ? (v as unknown[]).filter((x) => typeof x === "string") : []));
    if (seen.includes(sessionId)) return;
    writeLocal(celebratedKey(me.id), [...seen.slice(-49), sessionId]);
    let live = true;
    const tz = localTz();
    void Promise.allSettled([la.journey(tz, lang), api.streak(tz), social ? la.league(tz, lang) : Promise.reject(new Error("off"))]).then(
      ([j, s, l]) => {
        if (j.status !== "fulfilled" || s.status !== "fulfilled") return;
        const after = snapshotOf(j.value, s.value.days, l.status === "fulfilled" ? l.value : null);
        if (!after) return;
        const before = beforeOf(readLocal(snapshotKey(me.id), parseSnapshot), after);
        writeLocal(snapshotKey(me.id), after);
        const c = before ? celebrationFor(before, after, lang === "fr" ? "fr" : "en") : null;
        if (live && c) setCel(c);
      },
    );
    return () => {
      live = false;
    };
  }, [ready, sessionId, me.id, la, api, lang, social, suggests]);
  useEffect(() => {
    if (!cel) return;
    action.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cel]);
  if (!cel) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-sm rounded-3xl border border-line bg-night-2 p-6 text-center shadow-2xl motion-safe:animate-pop">
        <Kicker tone="volt">{L.celebrate.label}</Kicker>
        <div className="relative mx-auto mt-3 h-36 w-28">
          <VVakerImg alt="" className={cn("h-36 w-28", REACTION_MOTION[cel.reaction])} />
          <span aria-hidden className="absolute -top-1 -right-3 text-3xl">
            {REACTION_ICON[cel.reaction]}
          </span>
        </div>
        <p className="mt-2 text-[11px] font-semibold tracking-[0.14em] text-volt-fg uppercase">
          {(L.celebrate.names as Record<string, string>)[cel.id]}
        </p>
        <p id={titleId} className="mt-2 font-display text-xl leading-snug font-bold" aria-live="polite">
          {cel.line}
        </p>
        {cel.also.length > 0 && (
          <div className="mt-4">
            <Small>{L.celebrate.also}</Small>
            <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
              {cel.also.map((m) => (
                <li key={m} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">
                  {(L.celebrate.names as Record<string, string>)[m]}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          ref={action}
          type="button"
          className="mt-6 h-12 w-full rounded-xl bg-volt font-display text-sm font-semibold text-ink"
          onClick={() => setCel(null)}
        >
          {L.celebrate.continue}
        </button>
      </div>
    </div>
  );
}
