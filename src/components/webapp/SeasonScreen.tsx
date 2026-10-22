"use client";

import { useEffect, useMemo, useState } from "react";
import { getSeasonDict } from "@/i18n/season";
import { fmt } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import { localTz } from "@/lib/webapp/api";
import { localDay } from "@/lib/webapp/format";
import {
  addDays,
  applyAlternative,
  cleanHealth,
  cleanPrefs,
  countdown,
  daysBetween,
  draftOf,
  emptyDraft,
  EVENT_KINDS,
  EVENTS,
  finishTime,
  fitScale,
  goalOf,
  goalProblems,
  HEALTH_FOCUS,
  HORIZONS,
  MAX_SEASON_GOALS,
  newGoalId,
  parseTime,
  passedRaces,
  SCALE_WEEKS,
  SCALES,
  SEASON_MAX_WEEKS,
  storedGoals,
  windowPlan,
  type AuditEntry,
  type FeasibilityText,
  type FeasibilityView,
  type GoalDraft,
  type GoalType,
  type HealthFlags,
  type Priority,
  type Scale,
  type SeasonAnswer,
  type SeasonGoal,
  type SeasonPrefs,
} from "@/lib/webapp/season";
import { sportLabel, WEB_SPORTS } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { Chip, GoalLine, ReadinessRing, ReviewCard, ShareSeason, VerdictChip } from "./SeasonParts";
import { SeasonTimeline } from "./SeasonTimeline";
import { PendingProposal, usePendingProposal } from "./SeasonWeek";
import { useSeason } from "./useSeason";
import { Btn, Card, Field, H1, inputCls, Kicker, List, Note, Row, Segmented, Small, Toggle } from "./ui";
import { useNow } from "./useNow";

const nowIso = () => new Date().toISOString();

/** Loading and error states every season screen shares. */
function Loading({ state, retry }: { state: "loading" | "ok" | "error"; retry: () => void }) {
  const { t, lang } = useApp();
  if (state === "loading") return <p className="text-muted">{t.common.loading}</p>;
  return (
    <div className="space-y-2">
      <p className="text-muted">{getSeasonDict(lang).loadError}</p>
      <Btn variant="ghost" onClick={retry}>
        {t.common.retry}
      </Btn>
    </div>
  );
}

function Back({ to = "season" as const }: { to?: "season" }) {
  const { go, lang } = useApp();
  return (
    <button type="button" onClick={() => go({ name: to })} className="min-h-11 text-sm font-semibold text-muted">
      ‹ {getSeasonDict(lang).title}
    </button>
  );
}

/**
 * Your season (apps/mobile app/season.tsx, ADR-0050): the coach working toward your goals. The main goal with its
 * countdown, phase and readiness; the plan as a timeline you zoom (a month, a quarter, six months, a year); every goal
 * with the coach's verdict; race week; the coach's proposals and how you feel this week; your weekly sports and days,
 * your health context, the history of changes, and the season card to share.
 */
export function SeasonScreen() {
  const { lang, go, t } = useApp();
  const s = getSeasonDict(lang);
  const { season, state, load, adopt } = useSeason();
  const proposal = usePendingProposal(season, load);
  const [sharing, setSharing] = useState(false);
  const today = localDay(useNow());

  if (!season) return <Loading state={state} retry={() => void load()} />;
  const plan = season.plan;
  const goals = storedGoals(season);
  const active = goals.filter((g) => !g.doneAt);
  const done = goals.filter((g) => g.doneAt);
  const passed = passedRaces(goals, today);
  const prio = (id: string) => goals.find((g) => g.id === id)?.priority;
  const mainId = plan?.mainGoalId ?? season.goals[0]?.goalId;
  const main = season.goals.find((g) => g.goalId === mainId) ?? null;
  const mainF = main ? season.feasibility.find((f) => f.goalId === main.goalId) : undefined;
  const prefs = season.state.prefs;
  const healthTicks = Object.entries(cleanHealth(season.health)).filter(([k]) => k !== "age").length;

  if (!plan)
    return (
      <div className="space-y-4">
        <H1>{s.title}</H1>
        <Card tone="volt">
          <Kicker tone="volt">{s.kicker}</Kicker>
          <p className="mt-2 font-display text-[19px] leading-snug font-semibold">{s.emptyTitle}</p>
          <p className="mt-2 text-sm">{s.emptyLead}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Btn variant="volt" onClick={() => go({ name: "season-goal" })}>
              {s.setGoal}
            </Btn>
            <Btn variant="ghost" onClick={() => go({ name: "season-sports" })}>
              {s.pickSports}
            </Btn>
          </div>
        </Card>
        <List>
          <Row
            tone="mint"
            icon="♥"
            title={s.healthRow}
            detail={healthTicks ? fmt(s.healthSome, { n: healthTicks }) : s.healthNone}
            onClick={() => go({ name: "season-health" })}
          />
        </List>
        <Small>{season.notMedical || s.notMedical}</Small>
      </div>
    );

  const coachLine =
    active.length === 0 ? s.coachFor.free : active.length === 1 ? s.coachFor.one : fmt(s.coachFor.many, { n: active.length });

  return (
    <div className="space-y-4">
      <H1>{s.title}</H1>
      <Small>{s.lead}</Small>

      {/* The coach, toward one or several goals: the main one first. */}
      <Card tone="volt">
        <Kicker tone="volt">{coachLine}</Kicker>
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">{main ? s.mainGoal : s.goal.free}</p>
            <p className="font-display text-[20px] leading-tight font-bold">{main ? main.name : s.freeTitle}</p>
            {main && <p className="mt-1 text-sm">{fmt(s.goalDays, { days: countdown(main.days, lang) })}</p>}
          </div>
          {main && typeof main.readiness === "number" && <ReadinessRing value={main.readiness} size={60} label={s.readiness} />}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {season.week?.label && <Chip tone="sky">{season.week.label}</Chip>}
          {season.week?.deload && <Chip tone="sky">{s.lighter}</Chip>}
          {main?.verdict && <VerdictChip verdict={main.verdict} />}
          {main?.onTrack === false && <Chip tone="butter">{s.behind}</Chip>}
        </div>
        {season.week?.why && <p className="mt-2 text-sm text-muted">{season.week.why}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => go({ name: "plan" })}>{s.weekPlan}</Btn>
          {season.card && (
            <Btn variant="ghost" onClick={() => setSharing(true)}>
              {s.share}
            </Btn>
          )}
        </div>
      </Card>

      <PendingProposal p={proposal} />

      {season.raceSoon && (
        <Card tone="pulse">
          <Kicker tone="pulse">{fmt(s.raceWeek, { days: countdown(season.raceSoon.days, lang) })}</Kicker>
          <p className="mt-1 font-display text-[17px] font-semibold">
            {season.goals.find((g) => g.goalId === season.raceSoon!.goalId)?.name ?? s.race}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {season.raceSoon.tips.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </Card>
      )}

      {passed.map((g) => (
        <RaceDone key={g.id} goal={g} name={season.goals.find((x) => x.goalId === g.id)?.name ?? ""} onSaved={adopt} />
      ))}

      {/* The plan, zoomed: a month, a quarter, six months, a year. */}
      <TimelineCard season={season} />

      {/* The main goal's review when it isn't realistic. */}
      {main && mainF?.text && mainF.verdict !== "realistic" && (
        <ReviewCard
          verdict={mainF.verdict}
          text={mainF.text}
          readiness={mainF.readiness}
          notMedical={season.notMedical}
          footer={
            <Btn variant="ghost" className="mt-3" onClick={() => go({ name: "season-goal", id: main.goalId })}>
              {s.goal.editTitle}
            </Btn>
          }
        />
      )}

      {/* Every goal: A, B, C. */}
      <section aria-labelledby="season-goals" className="space-y-2">
        <h2 id="season-goals" className="font-display text-[17px] font-semibold">
          {s.goals}
        </h2>
        {season.goals.length > 0 && (
          <List>
            {season.goals.map((g) => (
              <GoalLine key={g.goalId} g={g} priority={prio(g.goalId)} onClick={() => go({ name: "season-goal", id: g.goalId })} />
            ))}
          </List>
        )}
        {active.length < MAX_SEASON_GOALS ? (
          <Btn variant="ghost" className="w-full" onClick={() => go({ name: "season-goal" })}>
            + {s.addGoal}
          </Btn>
        ) : (
          <Small>{s.maxGoals}</Small>
        )}
        <Small>{s.goal.priorityHelp}</Small>
        {done.length > 0 && (
          <>
            <Kicker className="pt-2">{s.doneGoals}</Kicker>
            <ul className="space-y-1 text-sm text-muted">
              {done.map((g) => (
                <li key={g.id}>
                  {`✓ ${g.title || (g.event ? EVENTS[g.event.kind].name[lang] : s.goal.free)}`}
                  {g.result?.timeS ? ` · ${finishTime(g.result.timeS)}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <AdaptCard onProposal={proposal.show} />

      <List>
        <Row
          tone="sky"
          icon="▦"
          title={s.sportsRow}
          detail={
            prefs.sports.length
              ? prefs.sports.map((x) => `${sportLabel(x.sport, lang)} ×${x.perWeek}`).join(" · ")
              : plan.sports.length
                ? plan.sports.map((x) => `${sportLabel(x.sport, lang)} ×${x.perWeek}`).join(" · ")
                : s.sportsNone
          }
          onClick={() => go({ name: "season-sports" })}
        />
        <Row
          tone="mint"
          icon="♥"
          title={s.healthRow}
          detail={healthTicks ? fmt(s.healthSome, { n: healthTicks }) : s.healthNone}
          onClick={() => go({ name: "season-health" })}
        />
        <Row tone="lilac" icon="↶" title={s.historyRow} onClick={() => go({ name: "season-history" })} />
      </List>

      <Small>{season.notMedical || s.notMedical}</Small>
      {sharing && season.card && <ShareSeason card={season.card} onClose={() => setSharing(false)} />}
      {state === "error" && <Note tone="down">{t.common.error}</Note>}
    </div>
  );
}

function TimelineCard({ season }: { season: SeasonAnswer }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const plan = season.plan!;
  const [scale, setScale] = useState<Scale>(() => fitScale(plan.weeks.length));
  const shown = useMemo(() => windowPlan(plan, SCALE_WEEKS[scale]), [plan, scale]);
  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Kicker tone="sky">{s.plan}</Kicker>
        <Small>{fmt(s.planSpan, { weeks: plan.weeks.length, from: dateFmt(plan.start), to: dateFmt(plan.end) })}</Small>
      </div>
      <div className="mt-3">
        <Segmented
          label={s.scale.label!}
          value={scale}
          options={SCALES.map((k) => ({ value: k, label: s.scale[k]! }))}
          onChange={setScale}
        />
      </div>
      <div className="mt-3">
        <SeasonTimeline key={`${scale}-${shown.offset}`} plan={shown} />
      </div>
    </Card>
  );
}

/** "How are you this week?": sick, hurt, tired, or just check: the coach proposes a change when the plan needs one. */
function AdaptCard({
  onProposal,
}: {
  onProposal: (c: NonNullable<Awaited<ReturnType<ReturnType<typeof useApp>["api"]["seasonAdapt"]>>["proposal"]>) => void;
}) {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (signals?: { sick?: boolean; injured?: boolean; sleepHours?: number }) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.seasonAdapt(signals, lang);
      if (r.proposal) onProposal(r.proposal);
      else setMsg(r.waiting ? s.adapt.waiting : r.raceDone?.summary || s.adapt.none);
    } catch {
      setMsg(t.common.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Kicker tone="lilac">{s.adapt.title}</Kicker>
      <Small className="mt-1">{s.adapt.lead}</Small>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn variant="ghost" disabled={busy} onClick={() => void run({ sick: true })}>
          {s.adapt.sick}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => void run({ injured: true })}>
          {s.adapt.injured}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => void run({ sleepHours: 5 })}>
          {s.adapt.tired}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => void run()}>
          {s.adapt.check}
        </Btn>
      </div>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </Card>
  );
}

/** "How did it go?": the race passed; its time, then it's marked done and recovery starts. */
function RaceDone({ goal, name, onSaved }: { goal: SeasonGoal; name: string; onSaved: (a: SeasonAnswer) => void }) {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const timeS = parseTime(time);
  return (
    <Card tone="mint">
      <Kicker tone="mint">{s.raceDone.title}</Kicker>
      <p className="mt-1 font-display text-[17px] font-semibold">{name}</p>
      <Small className="mt-1">{s.raceDone.lead}</Small>
      <div className="mt-3 flex gap-2">
        <input
          className={inputCls}
          value={time}
          placeholder="1:52:30"
          aria-label={s.raceDone.time}
          onChange={(e) => setTime(e.target.value.slice(0, 10))}
        />
        <Btn
          variant="volt"
          className="shrink-0"
          disabled={busy || (time.trim() !== "" && !timeS)}
          onClick={() => {
            setBusy(true);
            setErr(false);
            const g: SeasonGoal = { ...goal, doneAt: nowIso(), updatedAt: nowIso(), ...(timeS ? { result: { timeS } } : {}) };
            void api
              .putSeason({ goals: [g] }, localTz(), lang)
              .then(onSaved)
              .catch(() => setErr(true))
              .finally(() => setBusy(false));
          }}
        >
          {s.raceDone.mark}
        </Btn>
      </div>
      {err && <p className="mt-2 text-sm text-down-fg">{t.common.error}</p>}
    </Card>
  );
}

// ── A goal: create, edit, review ────────────────────────────────────────────────────────────────────────────────────

const SPANS = [4, 8, 13, 26, 52] as const;

/**
 * A goal (apps/mobile app/season-goal.tsx): what you train for (a race, a time, your health, free training), its day or
 * span, A/B/C priority; the coach's verdict as you type (realistic, stretch, too risky), why, other ways there and a
 * safety note; the what-if sliders (race day, hours a week); the coach's own review once saved.
 */
export function SeasonGoalScreen({ id }: { id?: string }) {
  const { api, lang, go, t } = useApp();
  const s = getSeasonDict(lang);
  const { season, state, load, adopt } = useSeason();
  const today = localDay(useNow());
  const saved = season && id ? (storedGoals(season).find((g) => g.id === id) ?? null) : null;
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "mint" | "down" } | null>(null);
  const [shift, setShift] = useState(0);
  const [hours, setHours] = useState<number | null>(null);
  const [review, setReview] = useState<{ f: FeasibilityView; text: FeasibilityText; notMedical?: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  // The form starts from the saved goal, or a new one.
  useEffect(() => {
    if (draft || !season) return;
    const t0 = window.setTimeout(() => setDraft(saved ? draftOf(saved, today) : emptyDraft(today, newGoalId())), 0);
    return () => window.clearTimeout(t0);
  }, [draft, season, saved, today]);

  const goal = useMemo(() => (draft ? goalOf(draft, today, nowIso()) : null), [draft, today]);
  const problems = goal ? goalProblems(goal, today) : [];
  const dated = draft?.type === "event" || draft?.type === "performance";
  const whatIfDate = goal && shift ? addDays(goal.date, shift * 7) : undefined;
  const key = goal ? JSON.stringify({ ...goal, updatedAt: "" }) + `|${shift}|${hours}` : "";

  // The verdict follows the form and the sliders (POST /v1/season/feasibility: nothing stored).
  useEffect(() => {
    if (!goal || problems.length) return;
    let gone = false;
    const tm = window.setTimeout(() => {
      setChecking(true);
      void api
        .feasibility({ goal, ...(whatIfDate ? { date: whatIfDate } : {}), ...(hours ? { hoursPerWeek: hours } : {}) }, localTz(), lang)
        .then((r) => !gone && setReview({ f: r.feasibility, text: r.text, notMedical: r.notMedical }))
        .catch(() => !gone && setReview(null))
        .finally(() => !gone && setChecking(false));
    }, 450);
    return () => {
      gone = true;
      window.clearTimeout(tm);
    };
    // `key` stands for the goal, the date shift and the hours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, api, lang]);

  if (!season || !draft || !goal) return <Loading state={state === "ok" ? "loading" : state} retry={() => void load()} />;
  const prefs = cleanPrefs(season.state.prefs);
  const health = cleanHealth(season.health);
  const set = (p: Partial<GoalDraft>) => {
    setDraft({ ...draft, ...p });
    setMsg(null);
  };

  const save = async (goals: SeasonGoal[], extra: { prefs?: SeasonPrefs; health?: HealthFlags } = {}, text = s.goal.saved) => {
    setBusy(true);
    setMsg(null);
    try {
      const a = await api.putSeason({ goals, ...extra }, localTz(), lang);
      adopt(a);
      setMsg({ text, tone: "mint" });
      const mine = goals.find((g) => g.id === draft.id);
      if (mine) setDraft(draftOf(mine, today));
      setShift(0);
      setHours(null);
      if (!id && goals.some((g) => g.id === draft.id)) go({ name: "season-goal", id: draft.id });
    } catch {
      setMsg({ text: t.common.error, tone: "down" });
    } finally {
      setBusy(false);
    }
  };

  const keepWhatIf = () => {
    const g = { ...goal, ...(whatIfDate ? { date: whatIfDate } : {}) };
    void save([g], hours ? { prefs: { ...prefs, hoursPerWeek: hours } } : {}, s.review.applied);
  };

  const apply = (i: number) => {
    const alt = review?.f.alternatives[i];
    if (!alt) return;
    const r = applyAlternative(goal, alt, { prefs, health, nowIso: nowIso(), today, newId: newGoalId() });
    if (!r) return;
    const goals = r.goals.some((g) => g.id === goal.id) ? r.goals : [goal, ...r.goals];
    void save(goals, { ...(r.prefs ? { prefs: r.prefs } : {}), ...(r.health ? { health: r.health } : {}) }, s.review.applied);
  };

  const remove = async () => {
    if (!id || !window.confirm(s.goal.confirmRemove)) return;
    setBusy(true);
    try {
      adopt(await api.deleteSeasonGoal(id, localTz(), lang));
      go({ name: "season" });
    } catch {
      setMsg({ text: t.common.error, tone: "down" });
      setBusy(false);
    }
  };

  const askCoach = async () => {
    if (!id) return;
    setCoachBusy(true);
    try {
      const r = await api.reviewGoal(id, localTz(), lang);
      setCoach(r.explanation ?? r.text.headline);
      setReview({ f: r.feasibility, text: r.text, notMedical: r.notMedical });
    } catch {
      setCoach(s.review.unavailable);
    } finally {
      setCoachBusy(false);
    }
  };

  const maxDate = addDays(today, SEASON_MAX_WEEKS * 7);
  const weeksToGo = Math.max(0, Math.round(daysBetween(today, goal.date) / 7));
  const preset = EVENTS[draft.kind];

  return (
    <div className="space-y-4">
      <Back />
      <H1>{id ? s.goal.editTitle : s.goal.newTitle}</H1>

      <Card>
        <div className="space-y-4">
          <Field label={s.goal.type}>
            <Segmented
              label={s.goal.type}
              value={draft.type}
              options={(["event", "performance", "health", "free"] as GoalType[]).map((k) => ({ value: k, label: s.goal.types[k] }))}
              onChange={(type) => set({ type })}
            />
          </Field>

          {dated && (
            <>
              <Field label={s.goal.event}>
                <select
                  className={inputCls}
                  value={draft.kind}
                  onChange={(e) => {
                    const kind = e.target.value as GoalDraft["kind"];
                    set({ kind, distanceKm: EVENTS[kind].distanceM / 1000, elevationM: EVENTS[kind].elevationM ?? 0 });
                  }}
                >
                  {EVENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {EVENTS[k].name[lang]}
                    </option>
                  ))}
                </select>
              </Field>
              {preset.custom && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={s.goal.distance}>
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      value={draft.distanceKm}
                      onChange={(e) =>
                        set({
                          distanceKm:
                            Number(
                              e.target.value
                                .replace(",", ".")
                                .replace(/[^\d.]/g, "")
                                .slice(0, 6),
                            ) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label={s.goal.elevation}>
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={draft.elevationM}
                      onChange={(e) => set({ elevationM: Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 0 })}
                    />
                  </Field>
                </div>
              )}
              <Field label={s.goal.date} hint={fmt(s.goalDays, { days: countdown(daysBetween(today, goal.date), lang) })}>
                <input
                  type="date"
                  className={inputCls}
                  min={addDays(today, 7)}
                  max={maxDate}
                  value={draft.date}
                  onChange={(e) => set({ date: e.target.value })}
                />
              </Field>
              <Field label={draft.type === "performance" ? s.goal.targetTimeNeeded : s.goal.targetTime}>
                <div className="flex items-center gap-2">
                  <input
                    className={cn(inputCls, "w-20")}
                    inputMode="numeric"
                    aria-label={s.goal.hours}
                    value={draft.targetH || ""}
                    placeholder="0"
                    onChange={(e) => set({ targetH: Math.min(72, Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0) })}
                  />
                  <span className="text-sm text-muted">{s.goal.hours}</span>
                  <input
                    className={cn(inputCls, "w-20")}
                    inputMode="numeric"
                    aria-label={s.goal.minutes}
                    value={draft.targetM || ""}
                    placeholder="0"
                    onChange={(e) => set({ targetM: Math.min(59, Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0) })}
                  />
                  <span className="text-sm text-muted">{s.goal.minutes}</span>
                </div>
              </Field>
            </>
          )}

          {draft.type === "health" && (
            <Field label={s.goal.type}>
              <Segmented
                label={s.goal.type}
                value={draft.health}
                options={HEALTH_FOCUS.map((k) => ({ value: k, label: s.goal.healthFocus[k] }))}
                onChange={(health) => set({ health })}
              />
            </Field>
          )}

          {!dated && (
            <Field label={s.goal.span}>
              <Segmented
                label={s.goal.span}
                value={String(SPANS.includes(draft.spanWeeks as (typeof SPANS)[number]) ? draft.spanWeeks : 13)}
                options={SPANS.map((n) => ({ value: String(n), label: s.sports.horizons[n] ?? fmt(s.goal.spanWeeks, { n }) }))}
                onChange={(v) => set({ spanWeeks: Number(v) })}
              />
            </Field>
          )}

          <Field label={s.goal.priority} hint={s.goal.priorityHelp}>
            <Segmented
              label={s.goal.priority}
              value={draft.priority}
              options={(["A", "B", "C"] as Priority[]).map((k) => ({ value: k, label: s.goal.priorities[k] }))}
              onChange={(priority) => set({ priority })}
            />
          </Field>

          <Field label={s.goal.name} hint={s.goal.nameHint}>
            <input
              className={inputCls}
              maxLength={60}
              value={draft.title}
              placeholder={s.goal.namePlaceholder}
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>

          {problems.length > 0 && (
            <ul className="space-y-1 text-sm text-butter-fg">
              {problems.map((p) => (
                <li key={p}>{s.goal.problems[p]}</li>
              ))}
            </ul>
          )}

          <Btn variant="volt" className="w-full" disabled={busy || problems.length > 0} onClick={() => void save([goal])}>
            {id ? s.goal.save : s.goal.add}
          </Btn>
          {msg && <Note tone={msg.tone}>{msg.text}</Note>}
        </div>
      </Card>

      {/* The review, live. */}
      {problems.length === 0 &&
        (review ? (
          <ReviewCard
            verdict={review.f.verdict}
            text={review.text}
            readiness={review.f.readiness}
            notMedical={review.notMedical ?? season.notMedical}
            busy={busy}
            onApply={(i) => apply(i)}
            footer={checking ? <Small className="mt-2">{s.review.checking}</Small> : null}
          />
        ) : (
          <Small>{checking ? s.review.checking : s.review.unavailable}</Small>
        ))}

      {/* What if: the race day and the weekly hours. */}
      {problems.length === 0 && (
        <Card>
          <Kicker tone="sky">{s.whatIf.title}</Kicker>
          <Small className="mt-1">{s.whatIf.lead}</Small>
          <label className="mt-3 block">
            <span className="flex justify-between text-sm font-medium">
              <span>{dated ? s.whatIf.date : s.whatIf.end}</span>
              <span className="text-muted">
                {shift
                  ? fmt(s.whatIf.weeks, { sign: shift > 0 ? "+" : "−", n: Math.abs(shift), date: whatIfDate ?? goal.date })
                  : s.whatIf.asPlanned}
              </span>
            </span>
            <input
              type="range"
              className="mt-2 w-full accent-[var(--color-volt)]"
              min={-Math.min(12, Math.max(0, weeksToGo - 2))}
              max={Math.min(26, Math.max(0, SEASON_MAX_WEEKS - weeksToGo))}
              step={1}
              value={shift}
              onChange={(e) => setShift(Number(e.target.value))}
            />
          </label>
          <label className="mt-3 block">
            <span className="flex justify-between text-sm font-medium">
              <span>{s.whatIf.hours}</span>
              <span className="text-muted">
                {hours
                  ? fmt(s.whatIf.hoursValue, { n: hours })
                  : prefs.hoursPerWeek
                    ? `${fmt(s.whatIf.hoursValue, { n: prefs.hoursPerWeek })} · ${s.whatIf.hoursUsual}`
                    : s.whatIf.hoursUsual}
              </span>
            </span>
            <input
              type="range"
              className="mt-2 w-full accent-[var(--color-volt)]"
              min={1}
              max={20}
              step={0.5}
              value={hours ?? prefs.hoursPerWeek ?? 5}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
          {review && (shift !== 0 || hours) && (
            <p className="mt-3 text-sm">{fmt(s.whatIf.then, { verdict: s.verdict[review.f.verdict] ?? review.f.verdict })}</p>
          )}
          {(shift !== 0 || hours) && (
            <div className="mt-3 flex gap-2">
              <Btn variant="volt" disabled={busy} onClick={keepWhatIf}>
                {s.whatIf.keep}
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  setShift(0);
                  setHours(null);
                }}
              >
                {s.whatIf.reset}
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* The coach's own words, once the goal is saved. */}
      <Card>
        <Kicker tone="lilac">{s.review.coachKicker}</Kicker>
        {saved ? (
          <>
            {coach && <p className="mt-2 text-[15px]">{coach}</p>}
            <Btn variant="ghost" className="mt-3" disabled={coachBusy} onClick={() => void askCoach()}>
              {coachBusy ? s.review.coachBusy : s.review.coach}
            </Btn>
          </>
        ) : (
          <Small className="mt-1">{s.review.saveFirst}</Small>
        )}
      </Card>

      <List>
        <Row tone="mint" icon="♥" title={s.healthRow} detail={s.health.lead} onClick={() => go({ name: "season-health" })} />
      </List>

      {id && (
        <Btn variant="danger" className="w-full" disabled={busy} onClick={() => void remove()}>
          {s.goal.remove}
        </Btn>
      )}
    </div>
  );
}

// ── Weekly sports and days ──────────────────────────────────────────────────────────────────────────────────────────

const DAY_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;
const dayShort = (d: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + d)));

/**
 * Your weekly sports (apps/mobile app/season-sports.tsx): the sports you want each week and how often, the days you can
 * train and when, your hours a week, the long-session day, and how far ahead free training plans (a month to a year).
 */
export function SeasonSportsScreen() {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const { season, state, load, adopt } = useSeason();
  const [p, setP] = useState<SeasonPrefs | null>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "mint" | "down" } | null>(null);

  useEffect(() => {
    if (p || !season) return;
    const base = cleanPrefs(season.state.prefs);
    // Nothing picked yet: start from the sports the plan already uses.
    const start = base.sports.length || !season.plan ? base : { ...base, sports: season.plan.sports.slice(0, 10) };
    const id = window.setTimeout(() => setP(start.days.length ? start : { ...start, days: [0, 2, 4, 5] }), 0);
    return () => window.clearTimeout(id);
  }, [p, season]);

  if (!season || !p) return <Loading state={state === "ok" ? "loading" : state} retry={() => void load()} />;
  const set = (x: Partial<SeasonPrefs>) => {
    setP({ ...p, ...x });
    setMsg(null);
  };
  const perWeek = (sport: string, d: number) =>
    set({ sports: p.sports.map((x) => (x.sport === sport ? { ...x, perWeek: Math.min(7, Math.max(1, x.perWeek + d)) } : x)) });
  const toggleDay = (d: number) => {
    const days = p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort();
    const slots = { ...(p.slots ?? {}) };
    if (!days.includes(d)) delete slots[String(d)];
    set({ days, slots });
  };
  const slot = (d: number, k: "start" | "end", v: string) => {
    const cur = p.slots?.[String(d)] ?? { start: "07:00", end: "08:00" };
    set({ slots: { ...(p.slots ?? {}), [String(d)]: { ...cur, [k]: v } } });
  };
  const free = WEB_SPORTS.filter((w) => !p.sports.some((x) => x.sport === w.key));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      adopt(await api.putSeason({ prefs: cleanPrefs(p) }, localTz(), lang));
      setMsg({ text: s.sports.saved, tone: "mint" });
    } catch {
      setMsg({ text: t.common.error, tone: "down" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Back />
      <H1>{s.sports.title}</H1>
      <Small>{s.sports.lead}</Small>

      <Card>
        {p.sports.length === 0 && <Small>{s.sports.none}</Small>}
        <ul className="divide-y divide-line">
          {p.sports.map((x) => (
            <li key={x.sport} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 text-[15px] font-medium">{sportLabel(x.sport, lang)}</span>
              <button
                type="button"
                aria-label={`${s.sports.less} · ${sportLabel(x.sport, lang)}`}
                disabled={x.perWeek <= 1}
                onClick={() => perWeek(x.sport, -1)}
                className="h-11 w-11 rounded-xl border border-line bg-surface-2 text-lg disabled:opacity-40"
              >
                −
              </button>
              <span className="w-20 text-center text-sm font-semibold">{fmt(s.sports.perWeek, { n: x.perWeek })}</span>
              <button
                type="button"
                aria-label={`${s.sports.more} · ${sportLabel(x.sport, lang)}`}
                disabled={x.perWeek >= 7}
                onClick={() => perWeek(x.sport, 1)}
                className="h-11 w-11 rounded-xl border border-line bg-surface-2 text-lg disabled:opacity-40"
              >
                +
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-down-fg"
                onClick={() => set({ sports: p.sports.filter((y) => y.sport !== x.sport) })}
              >
                {s.sports.remove}
              </button>
            </li>
          ))}
        </ul>
        {p.sports.length < 10 ? (
          <div className="mt-3 flex gap-2">
            <select className={inputCls} value={adding} aria-label={s.sports.add} onChange={(e) => setAdding(e.target.value)}>
              <option value="">{s.sports.addPick}</option>
              {free.map((w) => (
                <option key={w.key} value={w.key}>
                  {sportLabel(w.key, lang)}
                </option>
              ))}
            </select>
            <Btn
              variant="ghost"
              className="shrink-0"
              disabled={!adding}
              onClick={() => {
                set({ sports: [...p.sports, { sport: adding, perWeek: 2 }] });
                setAdding("");
              }}
            >
              {s.sports.add}
            </Btn>
          </div>
        ) : (
          <Small className="mt-2">{s.sports.max}</Small>
        )}
      </Card>

      <Card>
        <Kicker>{s.sports.days}</Kicker>
        <div role="group" aria-label={s.sports.days} className="mt-2 grid grid-cols-7 gap-1">
          {DAY_KEYS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={p.days.includes(d)}
              onClick={() => toggleDay(d)}
              className={cn(
                "h-11 rounded-lg text-xs font-semibold",
                p.days.includes(d) ? "bg-volt text-ink" : "border border-line bg-surface-2 text-muted",
              )}
            >
              {dayShort(d, lang)}
            </button>
          ))}
        </div>
        {p.days.length === 0 && <p className="mt-2 text-sm text-butter-fg">{s.sports.noDays}</p>}
        {p.days.length > 0 && (
          <>
            <p className="mt-4 text-sm font-medium">{s.sports.slots}</p>
            <Small>{s.sports.slotsLead}</Small>
            <ul className="mt-2 space-y-2">
              {p.days.map((d) => {
                const v = p.slots?.[String(d)];
                return (
                  <li key={d} className="flex flex-wrap items-center gap-2">
                    <span className="w-12 text-sm font-semibold">{dayShort(d, lang)}</span>
                    <input
                      type="time"
                      aria-label={`${dayShort(d, lang)} ${s.sports.from}`}
                      className={cn(inputCls, "h-11 w-28 px-2")}
                      value={v?.start ?? ""}
                      onChange={(e) => slot(d, "start", e.target.value)}
                    />
                    <span className="text-sm text-muted">{s.sports.to}</span>
                    <input
                      type="time"
                      aria-label={`${dayShort(d, lang)} ${s.sports.to}`}
                      className={cn(inputCls, "h-11 w-28 px-2")}
                      value={v?.end ?? ""}
                      onChange={(e) => slot(d, "end", e.target.value)}
                    />
                    {v && (
                      <button
                        type="button"
                        className="min-h-11 px-2 text-xs text-muted underline"
                        onClick={() => {
                          const slots = { ...(p.slots ?? {}) };
                          delete slots[String(d)];
                          set({ slots });
                        }}
                      >
                        {s.sports.clear}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label={s.sports.hours}>
            <select
              className={inputCls}
              value={p.hoursPerWeek ?? ""}
              onChange={(e) => set({ hoursPerWeek: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">{s.sports.hoursAny}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25].map((h) => (
                <option key={h} value={h}>
                  {fmt(s.sports.hoursValue, { n: h })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.sports.longDay}>
            <select
              className={inputCls}
              value={p.longDay ?? ""}
              onChange={(e) => set({ longDay: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              <option value="">{s.sports.longAny}</option>
              {DAY_KEYS.map((d) => (
                <option key={d} value={d}>
                  {dayShort(d, lang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.sports.horizon} hint={s.sports.horizonLead}>
            <Segmented
              label={s.sports.horizon}
              value={String(p.horizonWeeks && (HORIZONS as readonly number[]).includes(p.horizonWeeks) ? p.horizonWeeks : 13)}
              options={HORIZONS.map((n) => ({ value: String(n), label: s.sports.horizons[n]! }))}
              onChange={(v) => set({ horizonWeeks: Number(v) })}
            />
          </Field>
        </div>
      </Card>

      <Btn variant="volt" className="w-full" disabled={busy || p.days.length === 0} onClick={() => void save()}>
        {s.sports.save}
      </Btn>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </div>
  );
}

// ── Health context ──────────────────────────────────────────────────────────────────────────────────────────────────

const FLAGS = ["condition", "cleared", "injury", "lowImpact", "easyOnly", "effortByFeel"] as const;

/** Health context: ticks only (never a condition's name); the plan gets safer from them. */
export function SeasonHealthScreen() {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const { season, state, load, adopt } = useSeason();
  const [h, setH] = useState<HealthFlags | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "mint" | "down" } | null>(null);
  useEffect(() => {
    if (h || !season) return;
    const id = window.setTimeout(() => setH(cleanHealth(season.health)), 0);
    return () => window.clearTimeout(id);
  }, [h, season]);
  if (!season || !h) return <Loading state={state === "ok" ? "loading" : state} retry={() => void load()} />;
  return (
    <div className="space-y-4">
      <Back />
      <H1>{s.health.title}</H1>
      <Small>{s.health.lead}</Small>
      <Card>
        <ul className="divide-y divide-line">
          {FLAGS.filter((k) => k !== "cleared" || h.condition).map((k) => (
            <li key={k} className="flex items-center justify-between gap-3 py-3">
              <span className="text-[15px]">{s.health[k]}</span>
              <Toggle
                label={s.health[k]}
                on={!!h[k]}
                onChange={(v) => {
                  setH(cleanHealth({ ...h, [k]: v }));
                  setMsg(null);
                }}
              />
            </li>
          ))}
        </ul>
      </Card>
      <Btn
        variant="volt"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void api
            .putSeason({ health: cleanHealth(h) }, localTz(), lang)
            .then((a) => {
              adopt(a);
              setMsg({ text: s.health.saved, tone: "mint" });
            })
            .catch(() => setMsg({ text: t.common.error, tone: "down" }))
            .finally(() => setBusy(false));
        }}
      >
        {s.health.save}
      </Btn>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <Small>{season.notMedical || s.notMedical}</Small>
    </div>
  );
}

// ── History ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every change to the season (GET /v1/season/audit): who, from which device, when. */
export function SeasonHistoryScreen() {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let gone = false;
    void api
      .seasonAudit()
      .then((r) => !gone && setEntries(r.entries))
      .catch(() => !gone && setError(true));
    return () => {
      gone = true;
    };
  }, [api]);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return (
    <div className="space-y-4">
      <Back />
      <H1>{s.history.title}</H1>
      <Small>{s.history.lead}</Small>
      {!entries && !error && <p className="text-muted">{t.common.loading}</p>}
      {error && <p className="text-muted">{t.common.error}</p>}
      {entries && entries.length === 0 && <Small>{s.history.empty}</Small>}
      {entries && entries.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {entries.map((e, i) => (
            <li key={e.id ?? `${e.at}-${i}`} className="px-4 py-3">
              <p className="text-[15px] font-medium">{s.history.kinds[e.kind] ?? e.kind}</p>
              {e.summary && <p className="text-sm text-muted">{e.summary}</p>}
              <p className="mt-0.5 text-xs text-faint">
                {[s.history.actor[e.actor] ?? e.actor, e.device ? (s.history.device[e.device] ?? e.device) : null, when(e.at)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
