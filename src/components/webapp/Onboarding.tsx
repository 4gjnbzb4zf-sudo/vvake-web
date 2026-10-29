"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { AppMe, SurveyPut } from "@/lib/webapp/api";
import { DISCLAIMER_SHORT, DISCLAIMER_VERSION } from "@/lib/webapp/disclaimer";
import { QUICK_SPORTS, sportLabel, uuid } from "@/lib/webapp/workout";
import { tapSport } from "@/lib/webapp/tailor/tailor";
import { ownPlanName } from "@/lib/coachPlus";
import { useApp } from "./AppContext";
import { CAST_IDS, castSrc, resetVVakerCache, VVakerImg } from "./MyVVaker";
import { CoachVoicePicker } from "./CoachVoicePicker";
import { coachVoiceGender, type CoachVoiceGender } from "@/lib/coachVoices";
import { GoalForm } from "./GoalsScreen";
import { Btn, Field, inputCls, Kicker, Segmented, Small } from "./ui";
import { CustomValueDialog, type CustomNumber } from "./CustomValueDialog";
import { MINUTES_BOUNDS } from "@/lib/webapp/survey/customValue";

const MINUTE_CHOICES = [15, 20, 30, 45, 60, 90];

/**
 * The phone's first run (apps/mobile app/onboarding.tsx), as far as the API goes: your name and city, your VVaker
 * from the cast, how you move (the survey the planner and the coach use: PUT /v1/athlete), your heart for zones
 * (optional), the health & safety disclaimer (ADR-0032, kept on the account like the apps do), and a goal.
 */

/** A new account (no name yet) or one that never accepted this version of the disclaimer. */
export const needsOnboarding = (me: AppMe) => !me.name?.trim() || (me.consents?.disclaimer?.version ?? 0) < DISCLAIMER_VERSION;

type Step = "welcome" | "name" | "vvaker" | "voice" | "moves" | "heart" | "safety" | "goal";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t, lang, me, setMe, api, athlete, setAthlete, goals, setGoals, fmt } = useApp();
  const o = t.onboarding;
  const hasSurvey = !!athlete?.survey?.sports?.length;
  const steps: Step[] = ["welcome", "name", "vvaker", "voice", ...(hasSurvey ? [] : (["moves", "heart"] as Step[])), "safety", "goal"];
  const [i, setI] = useState(0);
  const step = steps[i]!;
  const [name, setName] = useState(me.name ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const [cast, setCast] = useState<string>(me.castId && (CAST_IDS as readonly string[]).includes(me.castId) ? me.castId : "runner");
  // The account's VVaker (a custom render, or one picked on a phone) is kept unless another one is tapped here: the
  // default shown on this step is never sent over it (a reinstall overwrote a rendered VVaker this way, build 53).
  const hasVVaker = !!me.vvakerCode || !!me.castId;
  const [picked, setPicked] = useState(false);
  const pickCast = (id: string) => {
    setCast(id);
    setPicked(true);
  };
  // The coach's voice (ADR-0056): a light choice, Next keeps the one shown (a woman's unless chosen before).
  const [voiceGender, setVoiceGender] = useState<CoachVoiceGender>(coachVoiceGender(me.coach?.voiceGender));
  const [sports, setSports] = useState<string[]>(["run"]);
  // Tap order (build 56): the first sport tapped is the main one; the preselected Run never outranks it.
  const [sportsTouched, setSportsTouched] = useState(false);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(30);
  const [minutesPick, setMinutesPick] = useState<CustomNumber | null>(null);
  const [aim, setAim] = useState<SurveyPut["aim"]>("health");
  const [level, setLevel] = useState<SurveyPut["sports"][number]["experience"]>("regular");
  const [pain, setPain] = useState(false);
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "">("");
  const [resting, setResting] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const next = () => setI((x) => Math.min(steps.length - 1, x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  const finish = async () => {
    setBusy(true);
    setError(false);
    try {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        name: name.trim().slice(0, 80),
        city: city.trim() ? city.trim().slice(0, 80) : null,
        consents: { disclaimer: { version: DISCLAIMER_VERSION, acceptedAt: now } },
      };
      // Absent is a woman's voice: only a change is sent.
      if (voiceGender !== coachVoiceGender(me.coach?.voiceGender)) Object.assign(patch, { coach: { voiceGender } });
      if ((picked || !hasVVaker) && cast !== me.castId) Object.assign(patch, { castId: cast, vvakerUpdatedAt: now });
      const m = await api.patchMe(patch);
      setMe(m);
      resetVVakerCache();
      if (!hasSurvey) {
        const a = Number(age);
        const r = Number(resting);
        const health = {
          ...(a >= 13 && a <= 110 ? { age: Math.round(a) } : {}),
          ...(sex ? { sex } : {}),
          ...(r >= 25 && r <= 130 ? { restingHr: Math.round(r) } : {}),
        };
        const survey: SurveyPut = {
          sports: sports.slice(0, 3).map((s) => ({
            sport: s,
            experience: level,
            sessionsPerWeek: Math.max(1, Math.round(days / Math.max(1, sports.length))),
            usualMin: minutes,
          })),
          aim,
          daysPerWeek: days,
          minutesPerDay: minutes,
          painOrInjury: pain,
        };
        await api
          .putAthlete({ survey, ...(Object.keys(health).length ? { health } : {}) })
          .then(setAthlete)
          .catch(() => undefined);
      }
      onDone();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const canNext = step === "name" ? name.trim().length > 0 : step === "moves" ? sports.length > 0 : step === "safety" ? accepted : true;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-32 pl-[max(env(safe-area-inset-left),1rem)]">
      <div className="flex items-center justify-between">
        <Small>{fmt(o.step, { n: i + 1, total: steps.length })}</Small>
        {i > 0 && (
          <button type="button" className="h-11 px-2 text-sm text-muted" onClick={back}>
            ‹ {t.common.back}
          </button>
        )}
      </div>

      {step === "welcome" && (
        <div className="mt-10 text-center">
          {hasVVaker && !picked ? (
            <VVakerImg alt="" className="mx-auto h-56 w-auto" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={castSrc(cast)} alt="" className="mx-auto h-56 w-auto object-contain" />
          )}
          <h1 className="mt-6 font-display text-4xl font-bold">{o.welcome.title}</h1>
          <p className="mt-3 text-muted">{o.welcome.lead}</p>
        </div>
      )}

      {step === "name" && (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">{o.name.title}</h1>
          <Field label={o.name.name}>
            <input className={inputCls} value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={o.name.city} hint={o.name.cityHint}>
            <input
              className={inputCls}
              value={city}
              maxLength={80}
              autoComplete="address-level2"
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
        </div>
      )}

      {step === "vvaker" && (
        <div className="mt-6">
          <h1 className="font-display text-2xl font-bold">{o.vvaker.title}</h1>
          <p className="mt-2 text-sm text-muted">{fmt(o.vvaker.lead, { plan: ownPlanName(me) })}</p>
          {hasVVaker && !picked && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
              <VVakerImg alt="" className="h-32 w-24" />
              <div>
                <p className="font-display text-lg font-bold">{o.vvaker.backTitle}</p>
                <p className="mt-1 text-sm text-muted">{o.vvaker.backLead}</p>
              </div>
            </div>
          )}
          <CastGrid value={hasVVaker && !picked ? "" : cast} onChange={pickCast} />
        </div>
      )}

      {step === "voice" && (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">{o.voice.title}</h1>
          <p className="text-sm text-muted">{o.voice.lead}</p>
          <CoachVoicePicker value={voiceGender} onChange={setVoiceGender} />
        </div>
      )}

      {step === "moves" && (
        <div className="mt-6 space-y-5">
          <h1 className="font-display text-2xl font-bold">{o.moves.title}</h1>
          <div>
            <p className="mb-2 text-sm font-medium">{o.moves.sports}</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SPORTS.map((s) => {
                const on = sports.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setSports((x) => tapSport(x, s, { max: 3, preset: !sportsTouched }));
                      setSportsTouched(true);
                    }}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-sm font-semibold",
                      on ? "border-volt-fg bg-volt text-ink" : "border-line bg-surface text-text",
                    )}
                  >
                    {sportLabel(s, lang)}
                    {sports.length > 1 && sports[0] === s && (
                      <span className="ml-2 rounded-full border border-ink/40 px-2 py-0.5 text-[11px] leading-none text-ink">
                        {o.moves.main}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={o.moves.days}>
            <Segmented
              label={o.moves.days}
              value={String(days)}
              options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => setDays(Number(v))}
            />
          </Field>
          <Field label={o.moves.minutes}>
            <Segmented
              label={o.moves.minutes}
              value={MINUTE_CHOICES.includes(minutes) ? String(minutes) : "custom"}
              options={[
                ...MINUTE_CHOICES.map((n) => ({ value: String(n), label: String(n) })),
                // "Custom…" (build 54): any minutes inside the survey's bounds; the picked value shows here.
                { value: "custom", label: MINUTE_CHOICES.includes(minutes) ? t.common.custom : String(minutes) },
              ]}
              onChange={(v) =>
                v === "custom"
                  ? setMinutesPick({
                      title: o.moves.minutes,
                      value: minutes,
                      min: MINUTES_BOUNDS.min,
                      max: MINUTES_BOUNDS.max,
                      step: 1,
                      bigStep: 5,
                      unit: "min",
                    })
                  : setMinutes(Number(v))
              }
            />
            <CustomValueDialog
              pick={minutesPick}
              onClose={() => setMinutesPick(null)}
              onDone={(v) => {
                setMinutes(v);
                setMinutesPick(null);
              }}
            />
          </Field>
          <Field label={o.moves.aim}>
            <select className={inputCls} value={aim} onChange={(e) => setAim(e.target.value as SurveyPut["aim"])}>
              {(Object.keys(o.moves.aims) as (keyof typeof o.moves.aims)[]).map((k) => (
                <option key={k} value={k}>
                  {o.moves.aims[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={o.moves.experience}>
            <Segmented
              label={o.moves.experience}
              value={level}
              options={(Object.keys(o.moves.levels) as (keyof typeof o.moves.levels)[]).map((k) => ({
                value: k,
                label: o.moves.levels[k],
              }))}
              onChange={(v) => setLevel(v)}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-volt)]"
              checked={pain}
              onChange={(e) => setPain(e.target.checked)}
            />
            {o.moves.pain}
          </label>
        </div>
      )}

      {step === "heart" && (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">{o.heart.title}</h1>
          <p className="text-sm text-muted">{o.heart.lead}</p>
          <Field label={o.heart.age}>
            <input
              className={inputCls}
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </Field>
          <Field label={o.heart.sex}>
            <Segmented
              label={o.heart.sex}
              value={sex || "none"}
              options={[
                { value: "female", label: o.heart.female },
                { value: "male", label: o.heart.male },
                { value: "none", label: o.heart.unsaid },
              ]}
              onChange={(v) => setSex(v === "none" ? "" : (v as "female" | "male"))}
            />
          </Field>
          <Field label={o.heart.resting}>
            <input
              className={inputCls}
              inputMode="numeric"
              value={resting}
              onChange={(e) => setResting(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </Field>
        </div>
      )}

      {step === "safety" && (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">{o.safety.title}</h1>
          <ul className="space-y-2 text-sm">
            {DISCLAIMER_SHORT[lang].map((line) => (
              <li key={line} className="rounded-xl border border-line bg-surface p-3">
                {line}
              </li>
            ))}
          </ul>
          <a className="text-sm underline" href={`/${lang}/terms/`} target="_blank" rel="noopener">
            {o.safety.full}
          </a>
          <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-[var(--color-volt)]"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            {o.safety.accept}
          </label>
        </div>
      )}

      {step === "goal" && (
        <div className="mt-6 space-y-4">
          <h1 className="font-display text-2xl font-bold">{o.goal.title}</h1>
          <p className="text-sm text-muted">{o.goal.lead}</p>
          {goals.length > 0 ? (
            <Kicker tone="volt">
              {t.goals.title} · {goals.length}
            </Kicker>
          ) : (
            <GoalForm
              onAdd={(g) => {
                setGoals([...goals, { ...g, id: uuid(), startMs: Date.now() }]);
              }}
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-down-fg">
          {t.common.error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-night/95 pt-3 pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),1rem)] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-3">
          {step === "goal" ? (
            <Btn big variant="volt" className="flex-1" disabled={busy} onClick={() => void finish()}>
              {busy ? t.common.saving : o.finish}
            </Btn>
          ) : (
            <Btn big variant="volt" className="flex-1" disabled={!canNext} onClick={next}>
              {step === "welcome" ? o.welcome.start : t.common.next}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

export function CastGrid({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {CAST_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          aria-label={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex h-32 items-end justify-center rounded-2xl border bg-surface p-1",
            value === id ? "border-volt-fg ring-2 ring-volt-fg" : "border-line",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={castSrc(id)} alt="" loading="lazy" className="h-full w-auto object-contain" />
        </button>
      ))}
    </div>
  );
}
