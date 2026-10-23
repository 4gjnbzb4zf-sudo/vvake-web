"use client";

import { useCallback, useEffect, useState } from "react";
import { COACH_VOICE_GENDERS, coachVoiceGender, previewPath, type CoachVoiceGender, type CoachVoices } from "@/lib/coachVoices";
import { Section } from "@/components/ui/Section";
import { format } from "@/i18n/dictionaries";
import {
  DEFAULT_CALL_WINDOWS,
  fromHhmm,
  liveMinutes,
  toHhmm,
  validWindows,
  type Athlete,
  type Integrations,
  type LiveStatus,
  type MemoryItem,
  type PlanChange,
  type SettingsChange,
  type Week,
} from "@/lib/accountApi";
import { formatClock, formatDate, formatDateTime, formatDay, resolveHour12 } from "@/lib/datetime";
import { sports } from "@/lib/sports";
import { ApiError } from "@/lib/rewardsApi";
import { Card, linkButton, Pill, Row, smallButton, smallInput, Toggle, useAction, Value } from "./AccountUi";
import { browserTz, mins, sectionIndex, type PanelProps } from "./shared";

/** A sport id as the app names it (catalog names in the page's language; your own sports keep their id). */
function sportName(id: string, lang: "en" | "fr"): string {
  const s = sports.sports.find((x) => x.key === id);
  return s ? s.name[lang] : id.startsWith("c_") ? (lang === "fr" ? "Ton sport" : "Your sport") : id;
}

type Status = keyof PanelProps["t"]["plan"]["statuses"];
const statusLabel = (t: PanelProps["t"], s: string) => (t.plan.statuses as Record<string, string>)[s] ?? s;
const statusTone = (s: string) => (s === "pending" ? "warn" : s === "accepted" ? "ok" : "muted") as "warn" | "ok" | "muted";

export function PlanSection(p: PanelProps) {
  const { t, api, lang, dates, errorMsg } = p;
  const [week, setWeek] = useState<Week | null | undefined>(undefined);
  const [changes, setChanges] = useState<PlanChange[] | null | undefined>(undefined);
  const [athlete, setAthlete] = useState<Athlete | null | undefined>(undefined);
  const [google, setGoogle] = useState<Integrations["google"] | undefined>(undefined);
  const decide = useAction(errorMsg);
  const blocks = useAction(errorMsg);

  const loadChanges = useCallback(() => {
    api
      .planChanges()
      .then(setChanges)
      .catch(() => setChanges(null));
  }, [api]);

  useEffect(() => {
    let live = true;
    const tz = browserTz();
    api
      .week(tz, lang)
      .then((w) => live && setWeek(w))
      .catch(() => live && setWeek(null));
    api
      .athlete()
      .then((a) => live && setAthlete(a))
      .catch(() => live && setAthlete(null));
    api
      .integrations()
      .then((i) => live && setGoogle(i.google ?? null))
      .catch(() => live && setGoogle(null));
    const id = window.setTimeout(loadChanges, 0);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [api, lang, loadChanges]);

  // The 7 days from today, with or without a session.
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + k);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const survey = athlete?.survey ?? null;
  const tz = browserTz();

  return (
    <Section id="plan" index={sectionIndex("plan")} kicker={t.sections.plan} title={t.sections.plan} lead={t.plan.lead}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.plan.agenda} lead={t.plan.agendaNote} className="lg:col-span-2">
          {week === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : week === null ? (
            <p className="mt-4 text-sm text-down-fg">{t.error}</p>
          ) : (
            <>
              {week.fromSurvey === false && <p className="mt-3 text-sm text-butter-fg">{t.plan.agendaDefault}</p>}
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                {days.map((day) => {
                  const s = week.days.find((x) => x.date === day);
                  return (
                    <li key={day} className="rounded-xl border border-line/80 bg-night/40 p-3">
                      <p className="font-mono text-[0.7rem] tracking-[0.12em] text-faint uppercase">
                        {formatDay(day, dates, "weekdayShort")}
                      </p>
                      {s ? (
                        <>
                          <p className="mt-1 font-display text-sm font-semibold">{sportName(s.sport, lang)}</p>
                          <p className="text-xs text-muted tabular-nums">
                            {formatClock(new Date(s.start).getHours(), new Date(s.start).getMinutes(), dates)} · {mins(t, s.minutes)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-faint">{t.plan.rest}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </Card>

        <Card title={t.plan.proposals}>
          {changes === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : !changes?.length ? (
            <p className="mt-4 text-sm text-faint">{t.plan.proposalsEmpty}</p>
          ) : (
            <ul className="mt-2">
              {changes.map((c) => (
                <li key={c.id} className="border-t border-line/60 py-3 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-text">{c.summary}</p>
                    <Pill tone={statusTone(c.status)}>{statusLabel(t, c.status as Status)}</Pill>
                  </div>
                  {c.createdAt && <p className="mt-1 text-xs text-faint">{formatDate(c.createdAt, dates, "short")}</p>}
                  {c.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className={smallButton("primary")}
                        disabled={decide.busy}
                        onClick={() => void decide.run(async () => (await api.decidePlan(c.id, "accept"), loadChanges()))}
                      >
                        {t.plan.accept}
                      </button>
                      <button
                        type="button"
                        className={smallButton()}
                        disabled={decide.busy}
                        onClick={() => void decide.run(async () => (await api.decidePlan(c.id, "reject"), loadChanges()))}
                      >
                        {t.plan.reject}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {decide.status}
        </Card>

        <Card title={t.plan.survey} lead={t.plan.surveyNote} badge={<Pill>{t.readOnly}</Pill>}>
          {athlete === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : !survey ? (
            <p className="mt-4 text-sm text-faint">{t.health.none}</p>
          ) : (
            <>
              <Row label={t.plan.aim}>
                <Value>{survey.aim ? ((t.plan.aims as Record<string, string>)[survey.aim] ?? survey.aim) : t.notSet}</Value>
              </Row>
              <Row label={t.plan.sports}>
                <Value>{(survey.sports ?? []).map((s) => sportName(s.sport, lang)).join(", ") || t.notSet}</Value>
              </Row>
              <Row label={t.plan.days}>
                <Value>{survey.daysPerWeek ?? t.notSet}</Value>
              </Row>
              <Row label={t.plan.perDay}>
                <Value>{survey.minutesPerDay ? mins(t, survey.minutesPerDay) : t.notSet}</Value>
              </Row>
              {survey.event && (
                <Row label={t.plan.event}>
                  <Value>
                    {sportName(survey.event.sport, lang)} · {formatDay(survey.event.date, dates, "medium")}
                  </Value>
                </Row>
              )}
              {survey.painOrInjury && <Row label={t.plan.pain} />}
            </>
          )}
        </Card>

        <Card title={t.plan.blocks} lead={t.plan.blocksNote} className="lg:col-span-2">
          {google?.connected ? (
            <>
              {google.blocks === false && <p className="mt-3 text-sm text-butter-fg">{t.plan.blocksReconnect}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={smallButton("primary")}
                  disabled={blocks.busy || google.blocks === false}
                  onClick={() =>
                    void blocks.run(async () => {
                      const r = await api.calendarSync(tz, lang, false);
                      if (r.ok === false) throw new ApiError(409, r.reason ?? "reconnect", "");
                    }, t.plan.blocksDone)
                  }
                >
                  {t.plan.syncNow}
                </button>
                <button
                  type="button"
                  className={smallButton()}
                  disabled={blocks.busy || google.blocks === false}
                  onClick={() => void blocks.run(() => api.calendarSync(tz, lang, true), t.plan.blocksDone)}
                >
                  {t.plan.removeBlocks}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-faint">{google === undefined ? t.loading : t.plan.needsGoogle}</p>
          )}
          {blocks.status}
        </Card>
      </div>
    </Section>
  );
}

/** The account page's one audio element: a "Hear it" preview at a time (this page speaks nothing else). */
let previewEl: HTMLAudioElement | null = null;
function stopPreview() {
  previewEl?.pause();
}
async function playPreview(blob: Blob): Promise<boolean> {
  try {
    const a = previewEl ?? new Audio();
    previewEl = a;
    if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
    a.src = URL.createObjectURL(blob);
    await a.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Coach voice: Woman / Man (ADR-0056), saved on the account (PATCH /v1/me coach.voiceGender; the phone, the watches and
 * the web app read it), each with "Hear it": the voice's recorded preview line (GET /v1/voice/voices).
 */
function VoiceGenderRow({ t, me, api, setMe, lang, session, errorMsg }: PanelProps) {
  const value = coachVoiceGender(me.coach?.voiceGender);
  const save = useAction(errorMsg);
  const [list, setList] = useState<CoachVoices | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .coachVoices(lang)
      .then((l) => live && setList(l))
      .catch(() => live && setList(null));
    return () => {
      live = false;
      stopPreview();
    };
  }, [api, lang]);
  const pick = (g: CoachVoiceGender) => {
    if (g === value) return;
    void save.run(async () => setMe(await api.patchMe({ coach: { voiceGender: g } })), t.saved);
  };
  const hear = async (g: CoachVoiceGender) => {
    setFailed(false);
    stopPreview();
    const path = previewPath(list, g);
    const blob = path ? await session.voiceAudio(path).catch(() => null) : null;
    if (!blob || !(await playPreview(blob))) setFailed(true);
  };
  return (
    <Row label={t.coach.voiceGender} hint={t.coach.voiceGenderHint}>
      <div className="flex flex-col gap-2 sm:items-end">
        <div role="radiogroup" aria-label={t.coach.voiceGender} className="flex flex-wrap gap-2">
          {COACH_VOICE_GENDERS.map((g) => (
            <span key={g} className="flex items-center gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={value === g}
                disabled={save.busy}
                className={smallButton(value === g ? "primary" : "ghost")}
                onClick={() => pick(g)}
              >
                {t.coach.voiceGenders[g]}
              </button>
              <button
                type="button"
                className={smallButton("ghost")}
                aria-label={`${t.coach.hearIt}: ${t.coach.voiceGenders[g]}`}
                onClick={() => void hear(g)}
              >
                ▶ {t.coach.hearIt}
              </button>
            </span>
          ))}
        </div>
        {failed && <p className="text-xs text-faint">{t.coach.hearFailed}</p>}
        {save.status}
      </div>
    </Row>
  );
}

export function CoachSection(p: PanelProps) {
  const { t, me, api, setMe, lang, dates, errorMsg } = p;
  const coach = me.coach ?? {};
  const plus = me.plan === "plus";
  const [callsOn, setCallsOn] = useState(!!coach.callsOn);
  const [windows, setWindows] = useState<[number, number][]>(() =>
    coach.callWindows?.length ? coach.callWindows.map(([a, b]) => [a, b]) : DEFAULT_CALL_WINDOWS.map(([a, b]) => [a, b]),
  );
  const [ringWatch, setRingWatch] = useState(coach.ringWatch !== false);
  const calls = useAction(errorMsg);
  const callNow = useAction((e) => (e instanceof ApiError && e.status === 429 ? t.coach.callNowLimit : errorMsg(e)));
  const [live, setLive] = useState<LiveStatus | null | undefined>(undefined);
  const [changes, setChanges] = useState<SettingsChange[] | null | undefined>(undefined);
  // When the changes were read: undo stays offered until undoUntil.
  const [readAt, setReadAt] = useState(0);
  const [memory, setMemory] = useState<MemoryItem[] | null | undefined>(undefined);
  const change = useAction(errorMsg);
  const mem = useAction(errorMsg);

  const units = coach.units === "imperial" ? "imperial" : "metric";
  const clock = resolveHour12(dates) ? "12h" : "24h";
  const loadChanges = useCallback(() => {
    api
      .settingsChanges(lang, units, clock)
      .then((c) => {
        setReadAt(Date.now());
        setChanges(c);
      })
      .catch(() => setChanges(null));
  }, [api, lang, units, clock]);

  useEffect(() => {
    let live = true;
    api
      .live(lang)
      .then((l) => live && setLive(l))
      .catch(() => live && setLive(null));
    api
      .memory()
      .then((m) => live && setMemory(m))
      .catch(() => live && setMemory(null));
    const id = window.setTimeout(loadChanges, 0);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [api, lang, loadChanges]);

  const okWindows = validWindows(windows);
  const saveCalls = () =>
    void calls.run(async () => setMe(await api.patchMe({ coach: { callsOn, callWindows: windows, ringWatch } })), t.saved);
  const lm = liveMinutes(live);
  const hhmm = (m: number) => formatClock(Math.floor((m % 1440) / 60), m % 60, dates);

  return (
    <Section id="coach" index={sectionIndex("coach")} kicker={t.sections.coach} title={t.sections.coach} lead={t.coach.lead}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.coach.voice} lead={t.coach.voiceNote} badge={<Pill>{t.appOnly}</Pill>}>
          <Row label={t.coach.voiceOn}>
            <Value>{coach.on === false ? t.off : t.on}</Value>
          </Row>
          <Row label={t.coach.chattiness}>
            <Value>{(t.coach.chat as Record<string, string>)[coach.chattiness ?? "normal"] ?? t.coach.chat.normal}</Value>
          </Row>
          <Row label={t.coach.voiceKind}>
            <Value>{coach.voice === "device" ? t.coach.voices.device : t.coach.voices.coach}</Value>
          </Row>
          <VoiceGenderRow {...p} />
          <Row label={t.coach.vibrate}>
            <Value>{coach.vibrateWithMusic ? t.on : t.off}</Value>
          </Row>
        </Card>

        <Card title={t.coach.calls} lead={t.coach.callsHint} badge={!plus && <Pill tone="volt">{t.plusSection.tierPlus}</Pill>}>
          {!plus && <p className="mt-3 text-sm text-faint">{t.plusNeeded}</p>}
          <Row label={t.coach.callsOn}>
            <Toggle label={t.coach.callsOn} checked={callsOn} disabled={!plus || me.guest === true} onChange={setCallsOn} />
          </Row>
          <Row label={t.coach.windows} hint={t.coach.windowRule}>
            <div className="flex flex-col gap-2">
              {windows.map(([a, b], i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    step={1800}
                    aria-label={`${t.coach.windows} ${i + 1}`}
                    className={`${smallInput} w-28`}
                    value={toHhmm(a)}
                    disabled={!plus}
                    onChange={(e) => {
                      const m = fromHhmm(e.target.value);
                      if (m !== null) setWindows((w) => w.map((x, j) => (j === i ? [m, x[1]] : x)));
                    }}
                  />
                  <span className="text-faint">–</span>
                  <input
                    type="time"
                    step={1800}
                    aria-label={`${t.coach.windows} ${i + 1}`}
                    className={`${smallInput} w-28`}
                    value={toHhmm(b === 1440 ? 1439 : b)}
                    disabled={!plus}
                    onChange={(e) => {
                      const m = fromHhmm(e.target.value);
                      if (m !== null) setWindows((w) => w.map((x, j) => (j === i ? [x[0], m] : x)));
                    }}
                  />
                  {windows.length > 1 && (
                    <button
                      type="button"
                      className={linkButton}
                      disabled={!plus}
                      onClick={() => setWindows((w) => w.filter((_, j) => j !== i))}
                    >
                      {t.remove}
                    </button>
                  )}
                </div>
              ))}
              {windows.length < 2 && (
                <button
                  type="button"
                  className={smallButton()}
                  disabled={!plus}
                  onClick={() => setWindows((w) => [...w, [18 * 60, 19 * 60]])}
                >
                  {t.coach.addWindow}
                </button>
              )}
            </div>
          </Row>
          {!okWindows && <p className="text-sm text-down-fg">{t.coach.windowRule}</p>}
          <Row label={t.coach.ringWatch}>
            <Toggle label={t.coach.ringWatch} checked={ringWatch} disabled={!plus} onChange={setRingWatch} />
          </Row>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={smallButton("primary")} disabled={!plus || calls.busy || !okWindows} onClick={saveCalls}>
              {calls.busy ? t.saving : t.save}
            </button>
            <button
              type="button"
              className={smallButton()}
              disabled={!plus || callNow.busy || !coach.callsOn}
              onClick={() => void callNow.run(() => api.callNow(), t.coach.callNowDone)}
            >
              {t.coach.callNow}
            </button>
          </div>
          {calls.status}
          {callNow.status}
          {coach.callWindows === undefined && callsOn && (
            <p className="mt-2 text-xs text-faint">
              {windows.map(([a, b]) => format(t.coach.window, { from: hhmm(a), to: hhmm(b) })).join(" · ")}
            </p>
          )}
        </Card>

        <Card title={t.coach.live} lead={t.coach.liveLead}>
          {live === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : live === null ? (
            <p className="mt-4 text-sm text-faint">{t.error}</p>
          ) : (
            <>
              {lm && (
                <p className="mt-4 font-display text-2xl font-semibold tabular-nums">
                  {[
                    lm.limit > 0 ? format(t.coach.liveLeft, { left: lm.left, limit: lm.limit }) : null,
                    lm.pack > 0 ? format(t.coach.livePack, { n: lm.pack }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-1 text-xs">
                <a className="underline" href={`/${lang}/plans/#plans`}>
                  {t.coach.livePlans}
                </a>
              </p>
              {live.resetsAt && (
                <p className="mt-1 text-xs text-faint">
                  {format(t.coach.liveResets, { date: formatDateTime(live.resetsAt, dates, "short") })}
                </p>
              )}
              {!live.on && live.reason && (
                <p className="mt-3 text-sm text-muted">{(t.coach.liveReasons as Record<string, string>)[live.reason] ?? ""}</p>
              )}
            </>
          )}
        </Card>

        <Card title={t.coach.changes} lead={t.coach.changesLead}>
          {changes === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : !changes?.length ? (
            <p className="mt-4 text-sm text-faint">{t.coach.changesEmpty}</p>
          ) : (
            <ul className="mt-2">
              {changes.map((c) => {
                const undoable = c.status === "accepted" && c.undoUntil && Date.parse(c.undoUntil) > readAt;
                return (
                  <li key={c.id} className="border-t border-line/60 py-3 first:border-t-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-text">{c.summary}</p>
                      <Pill tone={statusTone(c.status)}>{statusLabel(t, c.status)}</Pill>
                    </div>
                    {c.lines?.map((l, i) => (
                      <p key={i} className="mt-1 text-xs text-muted">
                        {l.label}: {l.from ? `${l.from} → ` : ""}
                        {l.to}
                      </p>
                    ))}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {c.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className={smallButton("primary")}
                            disabled={change.busy}
                            onClick={() => void change.run(async () => (await api.decideSettings(c.id, "accept"), loadChanges()))}
                          >
                            {t.plan.accept}
                          </button>
                          <button
                            type="button"
                            className={smallButton()}
                            disabled={change.busy}
                            onClick={() => void change.run(async () => (await api.decideSettings(c.id, "reject"), loadChanges()))}
                          >
                            {t.plan.reject}
                          </button>
                        </>
                      )}
                      {undoable && (
                        <>
                          <button
                            type="button"
                            className={smallButton()}
                            disabled={change.busy}
                            onClick={() => void change.run(async () => (await api.undoSettings(c.id), loadChanges()))}
                          >
                            {t.coach.undo}
                          </button>
                          <span className="text-xs text-faint">
                            {format(t.coach.undoUntil, { date: formatDate(c.undoUntil!, dates, "short") })}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {change.status}
        </Card>

        <Card title={t.coach.memory} lead={t.coach.memoryLead} className="lg:col-span-2">
          {memory === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : !memory?.length ? (
            <p className="mt-4 text-sm text-faint">{memory === null ? t.error : t.coach.memoryEmpty}</p>
          ) : (
            <>
              <ul className="mt-2">
                {memory.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 border-t border-line/60 py-3 first:border-t-0">
                    <div className="min-w-0">
                      <p className="text-sm text-text">{m.text}</p>
                      <p className="mt-1 text-xs text-faint">
                        {m.source ? ((t.coach.sources as Record<string, string>)[m.source] ?? "") : ""}
                        {m.createdAt ? ` · ${formatDate(m.createdAt, dates, "short")}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={linkButton}
                      disabled={mem.busy}
                      onClick={() =>
                        void mem.run(async () => (await api.forget(m.id), setMemory((list) => (list ?? []).filter((x) => x.id !== m.id))))
                      }
                    >
                      {t.coach.forget}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={smallButton("ghost", "mt-3")}
                disabled={mem.busy}
                onClick={() => {
                  if (window.confirm(t.coach.forgetAllConfirm)) void mem.run(async () => (await api.forgetAll(), setMemory([])));
                }}
              >
                {t.coach.forgetAll}
              </button>
            </>
          )}
          {mem.status}
        </Card>
      </div>
    </Section>
  );
}

export function HealthSection(p: PanelProps) {
  const { t, api, lang } = p;
  const [athlete, setAthlete] = useState<Athlete | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api
      .athlete()
      .then((a) => live && setAthlete(a))
      .catch(() => live && setAthlete(null));
    return () => {
      live = false;
    };
  }, [api]);
  const h = athlete?.health ?? null;
  const v = (x: number | null | undefined, unit: string) => (typeof x === "number" ? `${x} ${unit}` : t.notSet);
  const zones = Object.entries(h?.zones ?? {});

  return (
    <Section id="health" index={sectionIndex("health")} kicker={t.sections.health} title={t.sections.health} lead={t.health.lead}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.sections.health} lead={t.health.accountCopy} badge={<Pill>{t.readOnly}</Pill>}>
          {athlete === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : !h ? (
            <p className="mt-4 text-sm text-faint">{t.health.none}</p>
          ) : (
            <>
              <Row label={t.health.age}>
                <Value>{h.age ?? t.notSet}</Value>
              </Row>
              <Row label={t.health.sex}>
                <Value>{h.sex === "female" || h.sex === "male" ? t.health.sexes[h.sex] : t.notSet}</Value>
              </Row>
              <Row label={t.health.weight}>
                <Value>{v(h.weightKg, "kg")}</Value>
              </Row>
              <Row label={t.health.height}>
                <Value>{v(h.heightCm, "cm")}</Value>
              </Row>
              <Row label={t.health.restingHr}>
                <Value>{v(h.restingHr, "bpm")}</Value>
              </Row>
              <Row label={t.health.maxHr}>
                <Value>{v(h.maxHr, "bpm")}</Value>
              </Row>
              <Row label={t.health.sleep}>
                <Value>{v(h.sleepHours, "h")}</Value>
              </Row>
              <Row label={t.health.lowImpact}>
                <Value>{h.lowImpact ? t.on : t.off}</Value>
              </Row>
              <Row label={t.health.easyOnly}>
                <Value>{h.easyOnly ? t.on : t.off}</Value>
              </Row>
            </>
          )}
        </Card>
        <div className="grid content-start gap-4">
          <Card title={t.health.zones} badge={<Pill>{t.readOnly}</Pill>}>
            {zones.length ? (
              zones.map(([sport, list]) => (
                <Row key={sport} label={sportName(sport, lang)}>
                  <Value>{format(t.health.zoneLine, { list: list.join(" · ") })}</Value>
                </Row>
              ))
            ) : (
              <p className="mt-3 text-sm text-muted">{t.health.zonesAuto}</p>
            )}
          </Card>
          <Card title={t.health.sources} lead={t.health.sourcesNote} badge={<Pill>{t.appOnly}</Pill>} />
        </div>
      </div>
    </Section>
  );
}

export function GoalsSection({ t }: PanelProps) {
  return (
    <Section id="goals" index={sectionIndex("goals")} kicker={t.sections.goals} title={t.sections.goals} lead={t.goals.lead}>
      <div className="mt-8 max-w-3xl">
        <Card title={t.sections.goals} lead={t.goals.note} badge={<Pill>{t.appOnly}</Pill>} />
      </div>
    </Section>
  );
}
