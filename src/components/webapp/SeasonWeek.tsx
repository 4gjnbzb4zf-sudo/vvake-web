"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSeasonDict } from "@/i18n/season";
import { fmt } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import { localTz, type PlanChange } from "@/lib/webapp/api";
import { dayLabel, localDay } from "@/lib/webapp/format";
import {
  byDay,
  duration,
  editable,
  lastUndo,
  type EditDraft,
  type SeasonAnswer,
  type SeasonSessionView,
  type SeasonWeekView,
} from "@/lib/webapp/season";
import { QUICK_SPORTS, sportLabel, WEB_SPORTS } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { ProposalCard, Chip } from "./SeasonParts";
import { useSeason } from "./useSeason";
import { useWorkout } from "./WorkoutContext";
import { Btn, Card, inputCls, Kicker, Note, Small } from "./ui";
import { useNow } from "./useNow";

/** Where the coach chat picks up a request the week editor didn't understand (CoachScreen reads it once). */
export const COACH_DRAFT_KEY = "vvake-app-coach-draft";

/**
 * The coach's pending season proposal (GET /v1/plan/changes, the one GET /v1/season names), decided here: approve
 * (then Undo for a while) or keep the plan. Every decision reloads the season.
 */
export function usePendingProposal(season: SeasonAnswer | null, reload: () => Promise<void>) {
  const { api } = useApp();
  const [change, setChange] = useState<PlanChange | null>(null);
  const [approved, setApproved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pendingId = season?.pendingChangeId ?? null;
  const loaded = !!season;

  // The season's own proposal first, else any other one the coach made (a chat change), one at a time.
  useEffect(() => {
    if (!loaded) return;
    let gone = false;
    void api
      .planChanges()
      .then((cs) => {
        if (gone) return;
        const pending = cs.filter((c) => c.status === "pending");
        setChange(pending.find((c) => c.id === pendingId) ?? pending[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [api, pendingId, loaded]);

  const show = (c: PlanChange) => setChange(c);
  const decide = async (d: "accept" | "reject") => {
    if (!change) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.decidePlan(change.id, d);
      setApproved(d === "accept" ? change.id : null);
      setMsg(d === "accept" ? "approved" : "kept");
      setChange(null);
      await reload();
    } catch {
      setMsg("error");
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (!approved) return;
    setBusy(true);
    try {
      await api.undoPlanChange(approved);
      setApproved(null);
      setMsg("undone");
      await reload();
    } catch {
      setMsg("error");
    } finally {
      setBusy(false);
    }
  };
  return { change, show, decide, undo, approved, busy, msg };
}

/** The proposal card and what happened to the last one (approved → Undo). */
export function PendingProposal({ p }: { p: ReturnType<typeof usePendingProposal> }) {
  const { lang, t } = useApp();
  const s = getSeasonDict(lang);
  return (
    <>
      {p.change && <ProposalCard c={p.change} busy={p.busy} onDecide={(d) => void p.decide(d)} />}
      {p.msg && (
        <Note tone={p.msg === "error" ? "down" : "mint"}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {p.msg === "approved"
                ? s.proposal.approved
                : p.msg === "kept"
                  ? s.proposal.kept
                  : p.msg === "undone"
                    ? s.week.undone
                    : t.common.error}
            </span>
            {p.msg === "approved" && p.approved && (
              <button type="button" className="min-h-11 px-2 font-semibold underline" disabled={p.busy} onClick={() => void p.undo()}>
                {s.proposal.undo}
              </button>
            )}
          </span>
        </Note>
      )}
    </>
  );
}

/**
 * This week from the season (apps/mobile plan tab, ADR-0050): each day's sessions with their purpose line, zone and
 * key mark; change them yourself (move, swap, remove, a day off, add a sport, an easier week: applied at once, with
 * Undo), or ask the coach in plain words ("I'm travelling Tuesday", "add a swim"): it proposes, you approve. Other
 * weeks of the plan are a tap away; days gone by stay as they were.
 */
export function SeasonWeekEditor() {
  const { api, lang, t, go } = useApp();
  const wk = useWorkout();
  const s = getSeasonDict(lang);
  const base = useSeason();
  const [offset, setOffset] = useState(0);
  const current = base.season?.plan?.current ?? 0;
  const other = useSeason(offset ? current + offset : undefined, offset !== 0);
  const se = offset ? other : base;
  const season = se.season;
  const week = season?.week ?? null;
  const today = localDay(useNow());
  const proposal = usePendingProposal(base.season, base.load);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "mint" | "down" | "sky" } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [ask, setAsk] = useState("");

  const reloadBoth = useCallback(async () => {
    await base.load();
    if (offset) await other.load();
  }, [base, other, offset]);

  const edit = async (e: EditDraft) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.seasonEdit(e, localTz(), lang);
      se.adopt(r);
      if (offset) void base.load();
      setOpen(null);
      setNote({ text: r.line ? fmt(s.week.changedTo, { line: r.line }) : s.proposal.approved, tone: "mint" });
    } catch {
      setNote({ text: t.common.error, tone: "down" });
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    const u = season ? lastUndo(season.state.edits) : null;
    if (!u) return;
    setBusy(true);
    try {
      if (u.kind === "change") await api.undoPlanChange(u.id);
      else await api.undoSeasonEdit(u.id, localTz(), lang);
      await reloadBoth();
      setNote({ text: s.week.undone, tone: "mint" });
    } catch {
      setNote({ text: t.common.error, tone: "down" });
    } finally {
      setBusy(false);
    }
  };

  const sendAsk = async (e: FormEvent) => {
    e.preventDefault();
    const text = ask.trim();
    if (text.length < 2) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api.seasonAsk(text, localTz(), lang);
      if (r.understood && r.proposal) {
        proposal.show(r.proposal);
        setAsk("");
      } else {
        try {
          sessionStorage.setItem(COACH_DRAFT_KEY, text);
        } catch {
          // the chat opens empty
        }
        setNote({ text: s.ask.chat, tone: "sky" });
        go({ name: "coach" });
      }
    } catch {
      setNote({ text: t.common.error, tone: "down" });
    } finally {
      setBusy(false);
    }
  };

  if (!season?.plan || !week) return null;
  const days = byDay(week.sessions, week.start);
  const canUndo = !!lastUndo(season.state.edits) && offset === 0;
  const lastWeek = (season.plan.weeks.length || 1) - 1;
  const weekDate = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${week.start}T00:00:00Z`),
  );

  return (
    <div className="space-y-3">
      <PendingProposal p={proposal} />
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Kicker tone="sky">{offset === 0 ? s.week.title : fmt(s.week.other, { date: weekDate })}</Kicker>
            {week.label && <p className="mt-1 font-display text-[17px] font-semibold">{week.label}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={s.week.prev}
              disabled={current + offset <= 0 || busy}
              onClick={() => setOffset((o) => o - 1)}
              className="h-11 w-11 rounded-xl border border-line bg-surface-2 text-lg disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={s.week.next}
              disabled={current + offset >= lastWeek || busy}
              onClick={() => setOffset((o) => o + 1)}
              className="h-11 w-11 rounded-xl border border-line bg-surface-2 text-lg disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {week.targetMin > 0 && <Chip tone="volt">{fmt(s.week.planned, { time: duration(week.targetMin) })}</Chip>}
          {week.deload && <Chip tone="sky">{s.week.lighter}</Chip>}
          {week.races.length > 0 && <Chip tone="butter">{`🏁 ${s.race}`}</Chip>}
        </div>
        {week.why && <Small className="mt-2">{week.why}</Small>}
        {offset !== 0 && (
          <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-sky-fg" onClick={() => setOffset(0)}>
            {s.week.back}
          </button>
        )}
      </Card>

      {note && <Note tone={note.tone}>{note.text}</Note>}
      {se.state === "loading" && offset !== 0 && <Small>{t.common.loading}</Small>}

      <ol className="space-y-2">
        {days.map((d) => (
          <DayCard
            key={d.date}
            date={d.date}
            sessions={d.sessions}
            week={week}
            today={today}
            busy={busy}
            open={open}
            setOpen={setOpen}
            onEdit={(e) => void edit(e)}
            onStart={(sport) => {
              wk.start(sport);
              go({ name: "workout" });
            }}
            startDisabled={!!wk.w}
          />
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {week.sessions.some((x) => editable(x.date, today)) && (
          <Btn variant="ghost" disabled={busy} onClick={() => void edit({ kind: "easier", week: week.start })}>
            {s.week.easier}
          </Btn>
        )}
        {canUndo && (
          <Btn variant="ghost" disabled={busy} onClick={() => void undo()}>
            ↶ {s.week.undo}
          </Btn>
        )}
        <Btn variant="ghost" onClick={() => go({ name: "season-history" })}>
          {s.week.history}
        </Btn>
      </div>

      <Card>
        <Kicker tone="lilac">{s.ask.title}</Kicker>
        <form className="mt-2 flex gap-2" onSubmit={(e) => void sendAsk(e)}>
          <input
            className={inputCls}
            value={ask}
            maxLength={300}
            placeholder={s.ask.placeholder}
            aria-label={s.ask.title}
            onChange={(e) => setAsk(e.target.value)}
          />
          <Btn type="submit" variant="volt" disabled={busy || ask.trim().length < 2} className="shrink-0">
            {s.ask.send}
          </Btn>
        </form>
      </Card>
      <Small>{s.week.past}</Small>
    </div>
  );
}

function DayCard({
  date,
  sessions,
  week,
  today,
  busy,
  open,
  setOpen,
  onEdit,
  onStart,
  startDisabled,
}: {
  date: string;
  sessions: SeasonSessionView[];
  week: SeasonWeekView;
  today: string;
  busy: boolean;
  open: string | null;
  setOpen: (k: string | null) => void;
  onEdit: (e: EditDraft) => void;
  onStart: (sport: string) => void;
  startDisabled: boolean;
}) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const isToday = date === today;
  const can = editable(date, today);
  const dayKey = `day:${date}`;
  const [offReason, setOffReason] = useState<"travel" | "busy" | "rest">("busy");
  const [sport, setSport] = useState(QUICK_SPORTS[0]!);
  const [minutes, setMinutes] = useState(30);
  const label = dayLabel(`${date}T12:00:00`, lang);
  return (
    <li>
      <Card tone={isToday ? "pulse" : undefined} className={cn(!can && "opacity-70")}>
        <div className="flex items-center justify-between gap-2">
          <Kicker tone={isToday ? "pulse" : "faint"}>{isToday ? s.today : label}</Kicker>
          {can && (
            <button
              type="button"
              className="min-h-11 px-2 text-sm font-semibold text-sky-fg"
              aria-expanded={open === dayKey}
              onClick={() => setOpen(open === dayKey ? null : dayKey)}
            >
              {open === dayKey ? s.week.cancel : `+ ${s.week.add} · ${s.week.dayOff}`}
            </button>
          )}
        </div>
        {sessions.length === 0 && <p className="mt-1 text-sm text-muted">{s.week.rest}</p>}
        <ul className="mt-1 space-y-3">
          {sessions.map((x) => (
            <SessionItem
              key={x.id}
              x={x}
              week={week}
              can={can}
              isToday={isToday}
              busy={busy}
              open={open === x.id}
              toggle={() => setOpen(open === x.id ? null : x.id)}
              onEdit={onEdit}
              onStart={() => onStart(x.sport)}
              startDisabled={startDisabled}
              today={today}
            />
          ))}
        </ul>
        {open === dayKey && (
          <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-muted">{s.week.addSport}</span>
                <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
                  {WEB_SPORTS.map((w) => (
                    <option key={w.key} value={w.key}>
                      {sportLabel(w.key, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-24">
                <span className="mb-1 block text-xs font-semibold text-muted">{s.week.addMinutes}</span>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.min(300, Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0))}
                />
              </label>
              <Btn
                variant="volt"
                disabled={busy || minutes < 5}
                onClick={() => onEdit({ kind: "add", date, sport, minutes: Math.max(5, minutes) })}
              >
                {s.week.addSave}
              </Btn>
            </div>
            {sessions.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-semibold text-muted">{s.week.dayOff}</span>
                  <select className={inputCls} value={offReason} onChange={(e) => setOffReason(e.target.value as typeof offReason)}>
                    {(["busy", "travel", "rest"] as const).map((r) => (
                      <option key={r} value={r}>
                        {s.week.offReasons[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <Btn variant="ghost" disabled={busy} onClick={() => onEdit({ kind: "off", date, reason: offReason })}>
                  {s.week.dayOff}
                </Btn>
              </div>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

function SessionItem({
  x,
  week,
  can,
  isToday,
  busy,
  open,
  toggle,
  onEdit,
  onStart,
  startDisabled,
  today,
}: {
  x: SeasonSessionView;
  week: SeasonWeekView;
  can: boolean;
  isToday: boolean;
  busy: boolean;
  open: boolean;
  toggle: () => void;
  onEdit: (e: EditDraft) => void;
  onStart: () => void;
  startDisabled: boolean;
  today: string;
}) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const otherDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${week.start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  }).filter((d) => d !== x.date && editable(d, today));
  const others = week.sessions.filter((o) => o.id !== x.id && editable(o.date, today));
  const [to, setTo] = useState(otherDays[0] ?? "");
  const [swap, setSwap] = useState(others[0]?.id ?? "");
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[16px] font-semibold">{x.title || sportLabel(x.sport, lang)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip tone="faint">{duration(x.minutes)}</Chip>
            {x.zone ? <Chip tone="sky">{fmt(s.week.zone, { n: x.zone })}</Chip> : null}
            {x.key && <Chip tone="pulse">{s.week.key}</Chip>}
            {x.edited && <Chip tone="lilac">{s.week.edited}</Chip>}
          </div>
          {x.line && <p className="mt-1.5 text-sm">{x.line}</p>}
          {x.recipe && <Small className="mt-1">{`${s.week.how}: ${x.recipe}`}</Small>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isToday && (
            <Btn className="h-11 px-4" disabled={startDisabled} onClick={onStart}>
              {s.week.start}
            </Btn>
          )}
          {can && (
            <button type="button" className="min-h-11 px-2 text-sm text-sky-fg" aria-expanded={open} onClick={toggle}>
              {open ? s.week.cancel : "✎"}
              <span className="sr-only">{` ${x.title || sportLabel(x.sport, lang)}`}</span>
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
          {otherDays.length > 0 && (
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-muted">{s.week.move}</span>
                <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
                  {otherDays.map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(`${d}T12:00:00`, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <Btn variant="ghost" disabled={busy || !to} onClick={() => onEdit({ kind: "move", session: x.id, to })}>
                {s.week.move}
              </Btn>
            </div>
          )}
          {others.length > 0 && (
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-muted">{s.week.swap}</span>
                <select className={inputCls} value={swap} onChange={(e) => setSwap(e.target.value)}>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {`${dayLabel(`${o.date}T12:00:00`, lang)} · ${o.title || sportLabel(o.sport, lang)}`}
                    </option>
                  ))}
                </select>
              </label>
              <Btn variant="ghost" disabled={busy || !swap} onClick={() => onEdit({ kind: "swap", a: x.id, b: swap })}>
                {s.week.swap}
              </Btn>
            </div>
          )}
          <Btn variant="danger" disabled={busy} onClick={() => onEdit({ kind: "remove", session: x.id })}>
            {s.week.remove}
          </Btn>
        </div>
      )}
    </li>
  );
}
