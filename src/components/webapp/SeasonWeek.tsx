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
  weekDates,
  type EditDraft,
  type SeasonAnswer,
  type SeasonSessionView,
} from "@/lib/webapp/season";
import { sportLabel } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { EditToast, SessionSheet, useEditApply, WarningNotes } from "./PlanEdit";
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
 * This week from the season (apps/mobile plan tab, ADR-0050), or without a season the plain weekly plan (`basic`,
 * ADR-0052): each day's sessions with their purpose line, zone and key mark. Tap a session to change it in one sheet
 * (sport, time, type, zone or effort, day and time, a note, lock, duplicate, swap, remove), add one on any day, take a
 * day off or make the week easier: applied at once, with Undo, and a gentle coach note when the week loses its
 * balance. Or ask the coach in plain words ("I'm travelling Tuesday", "add a swim"): it proposes, you approve. Other
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
  const basic = !season?.plan && !!week?.basic;
  const today = localDay(useNow());
  const proposal = usePendingProposal(basic ? null : base.season, base.load);
  const [busyAsk, setBusyAsk] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "mint" | "down" | "sky" } | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ session: SeasonSessionView | null; date: string } | null>(null);
  const [ask, setAsk] = useState("");
  const seAdopt = se.adopt;
  const baseLoad = base.load;
  const adopt = useCallback(
    (a: SeasonAnswer) => {
      seAdopt(a);
      if (offset) void baseLoad();
    },
    [seAdopt, baseLoad, offset],
  );
  const h = useEditApply(adopt);
  const busy = busyAsk || h.busy;

  const reloadBoth = useCallback(async () => {
    await base.load();
    if (offset) await other.load();
  }, [base, other, offset]);

  const edit = async (e: EditDraft) => {
    setNote(null);
    if (await h.apply([e])) setOpenDay(null);
  };

  const undo = async () => {
    const u = season ? lastUndo(season.state.edits) : null;
    if (!u) return;
    setBusyAsk(true);
    h.clear();
    try {
      if (u.kind === "change") await api.undoPlanChange(u.id);
      else await api.undoSeasonEdit(u.id, localTz(), lang);
      await reloadBoth();
      setNote({ text: s.week.undone, tone: "mint" });
    } catch {
      setNote({ text: t.common.error, tone: "down" });
    } finally {
      setBusyAsk(false);
    }
  };

  const sendAsk = async (e: FormEvent) => {
    e.preventDefault();
    const text = ask.trim();
    if (text.length < 2) return;
    setBusyAsk(true);
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
      setBusyAsk(false);
    }
  };

  if (!season || !week || (!season.plan && !basic)) return null;
  const days = byDay(week.sessions, week.start);
  const canUndo = !!lastUndo(season.state.edits) && offset === 0;
  const lastWeek = (season.plan?.weeks.length || 1) - 1;
  const weekDate = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${week.start}T00:00:00Z`),
  );

  return (
    <div className="space-y-3">
      {!basic && <PendingProposal p={proposal} />}
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Kicker tone="sky">{basic ? s.basic.title : offset === 0 ? s.week.title : fmt(s.week.other, { date: weekDate })}</Kicker>
            {week.label && <p className="mt-1 font-display text-[17px] font-semibold">{week.label}</p>}
          </div>
          {!basic && (
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
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {week.targetMin > 0 && <Chip tone="volt">{fmt(s.week.planned, { time: duration(week.targetMin) })}</Chip>}
          {week.deload && <Chip tone="sky">{s.week.lighter}</Chip>}
          {week.races.length > 0 && <Chip tone="butter">{`🏁 ${s.race}`}</Chip>}
        </div>
        {basic && <Small className="mt-2">{s.basic.lead}</Small>}
        {week.why && <Small className="mt-2">{week.why}</Small>}
        {offset !== 0 && (
          <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-sky-fg" onClick={() => setOffset(0)}>
            {s.week.back}
          </button>
        )}
      </Card>

      {note && <Note tone={note.tone}>{note.text}</Note>}
      <EditToast h={h} />
      <WarningNotes warnings={week.warnings} h={h} />
      {se.state === "loading" && offset !== 0 && <Small>{t.common.loading}</Small>}

      <ol className="space-y-2">
        {days.map((d) => (
          <DayCard
            key={d.date}
            date={d.date}
            sessions={d.sessions}
            today={today}
            busy={busy}
            open={openDay === d.date}
            setOpen={(o) => setOpenDay(o ? d.date : null)}
            onEdit={(e) => void edit(e)}
            onSheet={(session) => setSheet({ session, date: d.date })}
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

      {!basic && (
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
      )}
      <Small>{s.week.past}</Small>
      {sheet && (
        <SessionSheet
          key={sheet.session?.id ?? `add-${sheet.date}`}
          session={sheet.session}
          date={sheet.date}
          days={weekDates(week.start)}
          others={week.sessions}
          today={today}
          busy={busy}
          onApply={(edits) => {
            setNote(null);
            return h.apply(edits);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function DayCard({
  date,
  sessions,
  today,
  busy,
  open,
  setOpen,
  onEdit,
  onSheet,
  onStart,
  startDisabled,
}: {
  date: string;
  sessions: SeasonSessionView[];
  today: string;
  busy: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  onEdit: (e: EditDraft) => void;
  onSheet: (session: SeasonSessionView | null) => void;
  onStart: (sport: string) => void;
  startDisabled: boolean;
}) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const isToday = date === today;
  const can = editable(date, today);
  const [offReason, setOffReason] = useState<"travel" | "busy" | "rest">("busy");
  const label = dayLabel(`${date}T12:00:00`, lang);
  const planned = sessions.filter((x) => !x.skipped);
  return (
    <li>
      <Card tone={isToday ? "pulse" : undefined} className={cn(!can && "opacity-70")}>
        <div className="flex flex-wrap items-center justify-between gap-x-2">
          <Kicker tone={isToday ? "pulse" : "faint"}>{isToday ? s.today : label}</Kicker>
          {can && (
            <div className="flex flex-wrap items-center">
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-semibold text-sky-fg"
                onClick={() => onSheet(null)}
                aria-label={`${s.sheet.add} · ${isToday ? s.today : label}`}
              >
                {`+ ${s.sheet.add}`}
              </button>
              {planned.length > 0 && (
                <button type="button" className="min-h-11 px-2 text-sm text-muted" aria-expanded={open} onClick={() => setOpen(!open)}>
                  {open ? s.week.cancel : s.week.dayOff}
                </button>
              )}
            </div>
          )}
        </div>
        {sessions.length === 0 && <p className="mt-1 text-sm text-muted">{s.week.rest}</p>}
        <ul className="mt-1 space-y-3">
          {sessions.map((x) => (
            <SessionItem
              key={x.id}
              x={x}
              can={can}
              isToday={isToday}
              onOpen={() => onSheet(x)}
              onStart={() => onStart(x.sport)}
              startDisabled={startDisabled}
            />
          ))}
        </ul>
        {open && planned.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface-2/60 p-3">
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
      </Card>
    </li>
  );
}

function SessionItem({
  x,
  can,
  isToday,
  onOpen,
  onStart,
  startDisabled,
}: {
  x: SeasonSessionView;
  can: boolean;
  isToday: boolean;
  onOpen: () => void;
  onStart: () => void;
  startDisabled: boolean;
}) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const name = x.title || sportLabel(x.sport, lang);
  const body = (
    <>
      <p className={cn("font-display text-[16px] font-semibold", x.skipped && "text-muted line-through")}>{name}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Chip tone="faint">{duration(x.minutes)}</Chip>
        {x.distanceKm ? <Chip tone="faint">{`${x.distanceKm} km`}</Chip> : null}
        {x.zone ? <Chip tone="sky">{fmt(s.week.zone, { n: x.zone })}</Chip> : null}
        {x.rpe ? <Chip tone="sky">{`${s.sheet.byEffort.replace("/10", "")}${x.rpe}/10`}</Chip> : null}
        {x.slot ? <Chip tone="faint">{x.slot}</Chip> : null}
        {x.key && <Chip tone="pulse">{s.week.key}</Chip>}
        {x.locked && <Chip tone="butter">{`🔒 ${s.sheet.locked}`}</Chip>}
        {x.skipped && <Chip tone="faint">{s.sheet.skippedChip}</Chip>}
        {x.edited === "postpone" || x.from ? (
          <Chip tone="lilac">{s.sheet.postponed}</Chip>
        ) : x.edited && x.edited !== "skip" ? (
          <Chip tone="lilac">{s.week.edited}</Chip>
        ) : null}
      </div>
      {x.line && <p className="mt-1.5 text-sm">{x.line}</p>}
      {x.memo && <Small className="mt-1 italic">{x.memo}</Small>}
      {x.recipe && <Small className="mt-1">{`${s.week.how}: ${x.recipe}`}</Small>}
    </>
  );
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        {can ? (
          <button
            type="button"
            onClick={onOpen}
            className="-m-1 min-w-0 flex-1 rounded-xl p-1 text-left hover:bg-surface-2/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-fg"
            aria-label={`${s.sheet.edit}: ${x.summary || name}`}
          >
            {body}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{body}</div>
        )}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isToday && !x.skipped && (
            <Btn className="h-11 px-4" disabled={startDisabled} onClick={onStart}>
              {s.week.start}
            </Btn>
          )}
          {can && (
            <button type="button" className="min-h-11 px-2 text-sm text-sky-fg" onClick={onOpen} tabIndex={-1} aria-hidden>
              ✎
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
