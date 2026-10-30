"use client";

import { useCallback, useEffect, useState } from "react";
import { getAdaptiveDict, type AdaptiveDict } from "@/i18n/adaptive";
import { cn } from "@/lib/cn";
import {
  adaptiveOn,
  goalChart,
  questionRef,
  undoable,
  type AnswerValue,
  type GoalProgressView,
  type ProgressApi,
  type ProposalView,
  type QuestionView,
  type ReadinessLevel,
  type Trend,
} from "@/lib/webapp/adaptive/progressApi";
import { dayLabel } from "@/lib/webapp/format";
import { useApp } from "./AppContext";
import { useProgress } from "./useProgress";
import { Chip } from "./SeasonParts";
import { Btn, Card, H1, H2, Kicker, List, Note, Row, Small, type Tone } from "./ui";

/**
 * Your progress (VVFit ADR-0069, the phone's Your progress screen): how ready you are today and why, each season goal's
 * trend with its projection to the day (a simple chart: fitness so far, the projection dashed, the level the event
 * needs), the proposals waiting (why, from → to, Accept / Not now, Undo for 30 days, through the coach settings changes
 * endpoints), the one question of the day (POST /v1/athlete/answer), what changed and why, and "still learning" while
 * the model has too little to say. Opened from Plan and You; Today shows one line.
 */

export const READINESS_TONE: Record<ReadinessLevel, Tone> = { fresh: "mint", ok: "sky", tired: "butter", strained: "down" };
const TREND_TONE: Record<Trend, Tone> = { ahead: "mint", on_track: "volt", behind: "butter", at_risk: "down", learning: "faint" };

export function ProgressScreen() {
  const { lang, go, t } = useApp();
  const x = getAdaptiveDict(lang);
  const { progress, state, reload, api, on } = useProgress();
  const [note, setNote] = useState<{ text: string; tone: Tone } | null>(null);

  return (
    <div className="space-y-5">
      <button type="button" className="min-h-11 text-sm text-muted" onClick={() => go({ name: "plan" })}>
        ‹ {t.tabs.plan}
      </button>
      <H1>{x.progress.title}</H1>
      {note && <Note tone={note.tone}>{note.text}</Note>}
      {(state === "loading" || (on && state === "off")) && !progress && <Small>{x.progress.loading}</Small>}
      {(state === "error" || state === "off") && !progress && (
        <Card>
          <p className="text-[15px]">{x.progress.error}</p>
          {state === "error" && (
            <Btn variant="ghost" className="mt-3" onClick={() => void reload()}>
              {x.progress.retry}
            </Btn>
          )}
        </Card>
      )}
      {progress && (
        <>
          {progress.readiness && (
            <Card tone={progress.readiness.level === "strained" ? "butter" : undefined}>
              <Kicker tone={READINESS_TONE[progress.readiness.level]}>{x.progress.readiness}</Kicker>
              <p className="mt-2 font-display text-xl font-semibold">{progress.readiness.word}</p>
              {progress.readiness.lines.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {progress.readiness.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              {progress.model?.load?.weekMinutes ? (
                <Small className="mt-2">{x.progress.weekMinutes.replace("{n}", String(Math.round(progress.model.load.weekMinutes)))}</Small>
              ) : null}
            </Card>
          )}

          {progress.learning && (
            <Card>
              <Kicker tone="faint">{x.progress.learningTitle}</Kicker>
              <p className="mt-2 text-[15px]">{x.progress.learning}</p>
            </Card>
          )}

          {progress.question && (
            <QuestionCard
              q={progress.question}
              x={x}
              api={api}
              onDone={(ok) => {
                setNote({ text: ok ? x.progress.answered : x.progress.failed, tone: ok ? "mint" : "butter" });
                if (ok) void reload();
              }}
            />
          )}

          <Proposals proposals={progress.proposals} x={x} api={api} onChange={() => void reload()} setNote={setNote} />

          <section className="space-y-3">
            <H2>{x.progress.goals}</H2>
            {progress.goals.length === 0 ? (
              <Card>
                <p className="text-[15px]">{x.progress.noGoals}</p>
                <Btn variant="volt" className="mt-3" onClick={() => go({ name: "season-goal" })}>
                  {x.progress.setGoal}
                </Btn>
              </Card>
            ) : (
              progress.goals.map((g) => <GoalCard key={g.goalId || g.name} g={g} x={x} />)
            )}
          </section>

          {progress.model && progress.model.trace.length > 1 && <TraceCard trace={progress.model.trace} x={x} />}

          <section className="space-y-3">
            <H2>{x.progress.changesTitle}</H2>
            {progress.changes.length === 0 ? (
              <Small>{x.progress.noChanges}</Small>
            ) : (
              <List>
                {progress.changes.map((c) => (
                  <Row key={`${c.at}-${c.param ?? ""}`} tone="sky" icon="↻" title={c.line} detail={dayLabel(c.at, lang)} />
                ))}
              </List>
            )}
          </section>

          <a className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-fg underline" href={`/${lang}/privacy/#health`}>
            {x.progress.privacy}
          </a>
        </>
      )}
    </div>
  );
}

function QuestionCard({ q, x, api, onDone }: { q: QuestionView; x: AdaptiveDict; api: ProgressApi; onDone: (ok: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const answers = (q.answers.length ? q.answers : q.key === "max_hr" ? ["yes", "no"] : ["easy", "moderate", "hard"]).filter(
    (a): a is AnswerValue => a in x.progress.answers,
  );
  const answer = async (value: AnswerValue) => {
    setBusy(true);
    try {
      const ref = questionRef(q);
      await api.answer({ key: q.key, value, ...(ref ? { ref } : {}) });
      onDone(true);
    } catch {
      onDone(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card tone="butter">
      <Kicker tone="lilac">{x.progress.questionTitle}</Kicker>
      <p className="mt-2 text-[15px] font-medium">{q.text}</p>
      <Small className="mt-1">{x.progress.questionLead}</Small>
      <div className="mt-3 flex flex-wrap gap-2">
        {answers.map((a) => (
          <Btn key={a} variant={a === "yes" ? "volt" : "ghost"} disabled={busy} onClick={() => void answer(a)}>
            {x.progress.answers[a]}
          </Btn>
        ))}
      </div>
    </Card>
  );
}

function Proposals({
  proposals,
  x,
  api,
  onChange,
  setNote,
}: {
  proposals: ProposalView[];
  x: AdaptiveDict;
  api: ProgressApi;
  onChange: () => void;
  setNote: (n: { text: string; tone: Tone } | null) => void;
}) {
  const { lang, prefs, me } = useApp();
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<ProposalView[]>([]);
  const clock = me.prefs?.timeFormat === "12h" ? "12h" : "24h";
  const loadRecent = useCallback(() => {
    api
      .changes(lang, prefs.units, clock)
      .then((c) => setRecent(undoable(c, Date.now())))
      .catch(() => setRecent([]));
  }, [api, lang, prefs.units, clock]);
  useEffect(() => {
    const id = window.setTimeout(loadRecent, 0);
    return () => window.clearTimeout(id);
  }, [loadRecent]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setNote({ text: ok, tone: "mint" });
      onChange();
      loadRecent();
    } catch {
      setNote({ text: x.progress.failed, tone: "butter" });
    } finally {
      setBusy(false);
    }
  };
  const pending = proposals.filter((p) => p.status === "pending");
  if (!pending.length && !recent.length) return null;
  return (
    <section className="space-y-3">
      {pending.length > 0 && (
        <>
          <H2>{x.progress.proposalsTitle}</H2>
          <Small>{x.progress.proposalsLead}</Small>
          {pending.map((p) => (
            <Card key={p.id} tone="butter">
              <Kicker tone="lilac">{x.progress.proposalsTitle}</Kicker>
              <p className="mt-2 text-[15px] font-semibold">{p.summary}</p>
              {p.why.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">{x.progress.why}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {p.why.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
              {p.lines.length > 0 && (
                <dl className="mt-2 space-y-1 text-sm">
                  {p.lines.map((l) => (
                    <div key={l.label} className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">{l.label}</dt>
                      <dd>{l.from ? `${l.from} → ${l.to}` : l.to}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn variant="volt" disabled={busy} onClick={() => void run(() => api.decide(p.id, "accept"), x.progress.accepted)}>
                  {x.progress.accept}
                </Btn>
                <Btn variant="ghost" disabled={busy} onClick={() => void run(() => api.decide(p.id, "reject"), x.progress.declined)}>
                  {x.progress.notNow}
                </Btn>
              </div>
            </Card>
          ))}
        </>
      )}
      {recent.length > 0 && (
        <>
          <H2>{x.progress.recentTitle}</H2>
          <List>
            {recent.map((c) => (
              <div key={c.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 text-[15px]">{c.summary}</span>
                <Btn
                  variant="ghost"
                  className="h-11 shrink-0"
                  disabled={busy}
                  onClick={() => void run(() => api.undo(c.id), x.progress.undone)}
                >
                  {x.progress.undo}
                </Btn>
              </div>
            ))}
          </List>
        </>
      )}
    </section>
  );
}

const W = 320;
const H = 120;

function GoalCard({ g, x }: { g: GoalProgressView; x: AdaptiveDict }) {
  const chart = goalChart(g, W, H);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-display text-[17px] font-semibold">{g.name}</p>
        {g.trendWord && <Chip tone={TREND_TONE[g.trend]}>{g.trendWord}</Chip>}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
        {g.readiness !== undefined && g.readiness !== null && (
          <span>{x.progress.ready.replace("{n}", String(Math.round(g.readiness)))}</span>
        )}
        {g.daysLeft !== undefined && g.daysLeft !== null && g.daysLeft >= 0 && (
          <span>{x.progress.daysLeft.replace("{n}", String(g.daysLeft))}</span>
        )}
      </div>
      {chart && (
        <figure className="mt-3">
          <svg
            viewBox={`-4 -4 ${W + 8} ${H + 8}`}
            className="h-auto w-full"
            role="img"
            aria-label={x.progress.chartLabel.replace("{name}", g.name)}
          >
            {chart.neededY !== null && (
              <line x1={0} x2={W} y1={chart.neededY} y2={chart.neededY} className="stroke-faint" strokeWidth={1} strokeDasharray="2 4" />
            )}
            {chart.solid && <path d={chart.solid} fill="none" className="stroke-volt" strokeWidth={2.5} strokeLinejoin="round" />}
            {chart.dashed && <path d={chart.dashed} fill="none" className="stroke-sky" strokeWidth={2} strokeDasharray="5 5" />}
            <circle cx={chart.nowPoint.x} cy={chart.nowPoint.y} r={4} className="fill-volt" />
          </svg>
          <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
            <span>
              <span aria-hidden className="mr-1 inline-block h-0.5 w-4 bg-volt align-middle" />
              {x.progress.chartNow}
            </span>
            <span>
              <span aria-hidden className="mr-1 inline-block w-4 border-t-2 border-dashed border-sky align-middle" />
              {x.progress.chartProjected}
            </span>
            {chart.neededY !== null && (
              <span>
                <span aria-hidden className="mr-1 inline-block w-4 border-t border-dotted border-faint align-middle" />
                {x.progress.chartNeeded}
              </span>
            )}
          </figcaption>
        </figure>
      )}
      {g.lines.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {g.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TraceCard({ trace, x }: { trace: { week: string; fitness: number }[]; x: AdaptiveDict }) {
  const last = trace.slice(-12);
  const top = Math.max(1, ...last.map((p) => p.fitness));
  return (
    <Card>
      <Kicker tone="sky">{x.progress.trace}</Kicker>
      <Small className="mt-1">{x.progress.traceLead}</Small>
      <div className="mt-3 flex h-20 items-end gap-1" aria-hidden>
        {last.map((p) => (
          <div key={p.week} className="flex-1 rounded-t bg-volt/70" style={{ height: `${Math.max(4, (p.fitness / top) * 100)}%` }} />
        ))}
      </div>
    </Card>
  );
}

/** The way in from Plan and You (only when the API has adaptive coaching). */
export function ProgressRow() {
  const { lang, go, me } = useApp();
  if (!adaptiveOn(me)) return null;
  const x = getAdaptiveDict(lang);
  return <Row tone="volt" icon="↗" title={x.progress.row} detail={x.progress.rowDetail} onClick={() => go({ name: "progress" })} />;
}

/**
 * Today's one line: the day's readiness and its first reason (or the first goal's trend), a tap from Your progress.
 * Nothing while it loads, fails, or has nothing to say.
 */
export function ProgressLine({ className }: { className?: string }) {
  const { lang, go } = useApp();
  const { progress } = useProgress();
  const r = progress?.readiness;
  if (!progress || !r?.word || progress.learning) return null;
  const x = getAdaptiveDict(lang);
  const goal = progress.goals.find((g) => g.trend !== "learning");
  const line = r.lines[0] ?? (goal ? `${goal.name}: ${goal.trendWord ?? ""}` : "");
  return (
    <button
      type="button"
      onClick={() => go({ name: "progress" })}
      aria-label={`${x.progress.todayOpen}: ${r.word}`}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm",
        className,
      )}
    >
      <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-full", READINESS_DOT[r.level])} />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{r.word}</span>
        {line ? <span className="text-muted">{` · ${line}`}</span> : null}
      </span>
      <span aria-hidden className="text-faint">
        ›
      </span>
    </button>
  );
}

const READINESS_DOT: Record<ReadinessLevel, string> = { fresh: "bg-mint", ok: "bg-sky", tired: "bg-butter", strained: "bg-down" };
