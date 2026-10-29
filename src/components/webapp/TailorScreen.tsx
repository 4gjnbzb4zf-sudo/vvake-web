"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { sports as catalog } from "@/lib/sports";
import { getTailorDict } from "@/i18n/tailor";
import {
  cleanAnswers,
  defaultAnswers,
  previewChanges,
  suggestedAnswer,
  tailorFromAnswers,
  tailorText,
  visibleSteps,
  TAILOR_FEATURE_NAMES,
  TAILOR_FEATURES,
  TAILOR_PRESET_TEXT,
  TAILOR_QUESTIONS,
  TAILOR_SPORTS_MAX,
  type TailorAnswers,
  type TailorFeature,
  type TailorFeatures,
  type TailorQuestion,
  type TailorQuestionId,
  type TailorStep,
} from "@/lib/webapp/tailor/tailor";
import { cleanOverrides, FEATURE_TARGET, nextTailorPrefs, webTabs } from "@/lib/webapp/tailor/prefs";
import { coachVoiceGender } from "@/lib/coachVoices";
import { useApp } from "./AppContext";
import { CoachVoicePicker } from "./CoachVoicePicker";
import { useDayOneCall } from "./LiveCall";
import { SuggestPicker } from "./Suggest";
import { CustomValueDialog, type CustomNumber } from "./CustomValueDialog";
import { EVENT_DISTANCE_BOUNDS, eventDistanceSlug, eventDistanceText, parseEventDistance } from "@/lib/webapp/survey/customValue";
import { Btn, Card, H1, H2, inputCls, Kicker, List, Row, Segmented, Small, Toggle } from "./ui";

/**
 * "Your VVake" on the web (ADR-0059, the founders' survey): ten one-tap cards with answers preselected, then the
 * summary (every feature on or off with its switch, "Show rewards & $VVAKE", the tabs it gives, what changes) and
 * Start. Taken again from You: every answer on one screen, tap to change, the preview, Save; or Retake the survey.
 * The questions come from game-core's TAILOR_QUESTIONS and their words from TAILOR_TEXT, so a new answer there shows
 * up here. Saving sends prefs.tailor (newest `at` wins) with the switch on.
 */
export function TailorScreen() {
  const { t, lang, api, go, me, setMe, sessions, tailor, profile, saveTailor, tailorDev, deskLinked } = useApp();
  const x = getTailorDict(lang).survey;
  const L = lang === "fr" ? "fr" : "en";
  const allowed = tailorDev || !!profile;
  const recent = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of sessions) n.set(s.sport, (n.get(s.sport) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [sessions]);
  const [answers, setAnswers] = useState<TailorAnswers>(() => tailor?.answers ?? defaultAnswers({ sports: recent.slice(0, 1) }));
  const [overrides, setOverrides] = useState<Partial<TailorFeatures>>(() => tailor?.overrides ?? {});
  const [touched, setTouched] = useState<ReadonlySet<TailorStep>>(() => new Set(tailor ? visibleSteps(tailor.answers) : []));
  const [mode, setMode] = useState<"steps" | "edit">(tailor ? "edit" : "steps");
  const [step, setStep] = useState<TailorStep>("goals");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  /** A card was answered here: the answers inferred from use no longer replace them. */
  const answered = useRef(!!tailor);
  /** The first week the coach proposed in the day-one call (shown above the summary). */
  const [weekNote, setWeekNote] = useState<string | null>(null);
  // Day one by voice (behind the server's switch): the call fills these same cards and ends on the summary.
  const day = useDayOneCall({
    first: !tailor,
    onAnswer: (patch, s) => {
      answered.current = true;
      setAnswers(patch);
      if (s) {
        setTouched((t) => new Set([...t, s]));
        setStep(s);
      }
    },
    onSummary: (note) => {
      setWeekNote(note);
      setStep("summary");
    },
  });

  // An account without answers yet: the survey starts from 30 days of use (decision 2), until a card is answered.
  useEffect(() => {
    if (tailor) return;
    let live = true;
    api
      .usage30()
      .then((r) => {
        if (!live || !r.inferred?.answers || answered.current) return;
        const inferred = cleanAnswers(r.inferred.answers);
        setAnswers(inferred);
        setOverrides(cleanOverrides(r.inferred.overrides) ?? {});
        // Answers from use stand as given: the cards' preselections don't replace them.
        setTouched(new Set(visibleSteps(inferred)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api, tailor]);

  if (!allowed)
    return (
      <div className="space-y-4 pt-6">
        <H1>{tailorText("tailor.title", L)}</H1>
        <Btn onClick={() => go({ name: "today" })}>{getTailorDict(lang).today.next}</Btn>
      </div>
    );

  const set = (id: TailorStep, patch: Partial<TailorAnswers>) => {
    answered.current = true;
    setAnswers((a) => cleanAnswers({ ...a, ...patch }));
    setTouched((t) => new Set([...t, id]));
  };
  const steps = visibleSteps(answers);
  const questions = steps.filter((s): s is TailorQuestionId | "eventDetails" => s !== "summary");
  const at = Math.max(0, steps.indexOf(step));
  const goTo = (s: TailorStep) => {
    // A card not answered yet takes its preselection from the answers so far (the cards adapt).
    if (s !== "summary" && s !== "eventDetails" && !touched.has(s)) setAnswers((a) => cleanAnswers({ ...a, ...suggestedAnswer(s, a) }));
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const save = async () => {
    setState("saving");
    try {
      await saveTailor(nextTailorPrefs(tailor, { answers, overrides, tailorOn: true, source: "picked" }));
      // Question 7 is the coach's voice on every device (ADR-0056).
      if (coachVoiceGender(me.coach?.voiceGender) !== answers.voice)
        await api
          .patchMe({ coach: { voiceGender: answers.voice } })
          .then(setMe)
          .catch(() => undefined);
      setState("idle");
      go({ name: "today" });
    } catch {
      setState("error");
    }
  };
  const summary = (
    <Summary
      answers={answers}
      overrides={overrides}
      setOverrides={setOverrides}
      deskLinked={deskLinked}
      state={state}
      onSave={() => void save()}
      first={!tailor}
    />
  );

  if (mode === "edit")
    return (
      <div className="space-y-5">
        <div>
          <Kicker tone="volt">{tailorText("tailor.title", L)}</Kicker>
          <H1>{x.edit}</H1>
          <Small className="mt-1">{x.editLead}</Small>
        </div>
        {questions.map((s) => (
          <Card key={s}>
            <Question step={s} answers={answers} set={set} recent={recent} />
          </Card>
        ))}
        {summary}
        <Btn
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMode("steps");
            setTouched(new Set());
            goTo("goals");
          }}
        >
          {tailorText("tailor.summary.retake", L)}
        </Btn>
      </div>
    );

  const total = questions.length;
  if (day.view === "wait") return null;
  if (day.view === "ask") return day.offer;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Kicker tone="volt">{tailorText("tailor.title", L)}</Kicker>
        {step !== "summary" && <Small>{x.step.replace("{n}", String(at + 1)).replace("{total}", String(total))}</Small>}
      </div>
      {day.header}
      {step === "summary" && weekNote && <p className="text-sm text-sky-fg">{weekNote}</p>}
      {step === "summary" ? (
        summary
      ) : (
        <Card>
          <Question step={step as TailorQuestionId | "eventDetails"} answers={answers} set={set} recent={recent} big />
        </Card>
      )}
      <div className="flex gap-2">
        {at > 0 && (
          <Btn variant="ghost" onClick={() => goTo(steps[at - 1]!)}>
            {t.common.back}
          </Btn>
        )}
        {step !== "summary" && (
          <Btn
            big
            className="flex-1"
            onClick={() => {
              setTouched((t) => new Set([...t, step]));
              goTo(steps[at + 1] ?? "summary");
            }}
          >
            {t.common.next}
          </Btn>
        )}
      </div>
    </div>
  );
}

/** The words for an answer: `tailor.<question>.<answer>`. */
const answerText = (q: TailorQuestionId, a: string, l: "en" | "fr") => tailorText(`tailor.${q}.${a}`, l);

const EVENTS = ["5k", "10k", "half", "marathon", "triathlon", "ironman"] as const;

/** One card of the survey: its title, its answers as one-tap chips (multi) or a list (one), adaptive sub-parts. */
function Question({
  step,
  answers,
  set,
  recent,
  big,
}: {
  step: TailorQuestionId | "eventDetails";
  answers: TailorAnswers;
  set: (id: TailorStep, patch: Partial<TailorAnswers>) => void;
  recent: string[];
  big?: boolean;
}) {
  const { lang, prefs } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const x = getTailorDict(lang).survey;
  // "Custom distance…" (build 54): any event distance in km or mi (your units), stored as "15k", "21-1k", "12mi".
  const [distancePick, setDistancePick] = useState<CustomNumber | null>(null);
  const title = <h2 className={cn("font-display font-semibold", big ? "text-2xl" : "text-lg")}>{tailorText(`tailor.${step}.title`, L)}</h2>;

  if (step === "eventDetails")
    return (
      <div>
        {title}
        <p className="mt-3 mb-1 text-sm font-medium">{tailorText("tailor.eventDetails.type", L)}</p>
        <Chips
          options={[
            ...[...EVENTS, "other" as const].map((e) => ({ value: e, label: x.events[e] })),
            { value: "custom", label: eventDistanceText(answers.eventType, L) ?? x.customDistance },
          ]}
          selected={[
            answers.eventType && (EVENTS as readonly string[]).includes(answers.eventType)
              ? answers.eventType
              : parseEventDistance(answers.eventType)
                ? "custom"
                : answers.eventType
                  ? "other"
                  : "",
          ]}
          onTap={(v) => {
            if (v !== "custom") return set("eventDetails", { eventType: v === "other" ? undefined : v });
            const own = parseEventDistance(answers.eventType);
            const unit = own?.unit ?? (prefs.units === "imperial" ? "mi" : "km");
            const b = EVENT_DISTANCE_BOUNDS[unit];
            setDistancePick({
              title: x.customDistance,
              value: own?.value ?? (unit === "mi" ? 6 : 15),
              min: b.min,
              max: b.max,
              step: 0.1,
              bigStep: 1,
              unit,
            });
          }}
        />
        <CustomValueDialog
          pick={distancePick}
          onClose={() => setDistancePick(null)}
          onDone={(v) => {
            const slug = distancePick ? eventDistanceSlug(v, distancePick.unit === "mi" ? "mi" : "km") : undefined;
            if (slug) set("eventDetails", { eventType: slug });
            setDistancePick(null);
          }}
        />
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium">{tailorText("tailor.eventDetails.date", L)}</span>
          <input
            type="date"
            className={inputCls}
            value={answers.eventDate ?? ""}
            onChange={(e) => set("eventDetails", { eventDate: e.target.value || undefined })}
          />
        </label>
      </div>
    );

  const q = TAILOR_QUESTIONS.find((k) => k.id === step) as TailorQuestion;
  if (q.id === "sports") return <SportsQuestion title={title} answers={answers} set={set} recent={recent} />;
  if (q.id === "voice")
    return (
      <div>
        {title}
        <div className="mt-3">
          <CoachVoicePicker value={coachVoiceGender(answers.voice)} onChange={(g) => set("voice", { voice: g })} />
        </div>
        <div className="mt-4">
          <Segmented
            label={tailorText("tailor.voice.title", L)}
            value={answers.style}
            options={(q.answers2 ?? []).map((s) => ({ value: s as TailorAnswers["style"], label: answerText("voice", s, L) }))}
            onChange={(v) => set("voice", { style: v })}
          />
        </div>
      </div>
    );

  const value = (answers as unknown as Record<string, unknown>)[q.id];
  const picked = Array.isArray(value) ? (value as string[]) : [String(value)];
  const tap = (a: string) => {
    if (!q.multi) return set(q.id, { [q.id]: a } as Partial<TailorAnswers>);
    const has = picked.includes(a);
    // At least one answer; past the limit the oldest pick makes room.
    const next = has ? picked.filter((v) => v !== a) : [...picked, a].slice(-(q.max ?? q.answers.length));
    if (next.length) set(q.id, { [q.id]: next } as Partial<TailorAnswers>);
  };
  return (
    <div>
      {title}
      {q.id === "goals" && <Small className="mt-1">{tailorText("tailor.goals.hint", L)}</Small>}
      <div className="mt-3">
        {q.multi ? (
          <Chips options={q.answers.map((a) => ({ value: a, label: answerText(q.id, a, L) }))} selected={picked} onTap={tap} />
        ) : (
          <div role="radiogroup" aria-label={tailorText(`tailor.${q.id}.title`, L)} className="space-y-2">
            {q.answers.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={picked.includes(a)}
                onClick={() => tap(a)}
                className={cn(
                  "flex min-h-12 w-full items-center rounded-xl border px-4 text-left text-[15px] font-medium",
                  picked.includes(a) ? "border-volt bg-volt/15 text-text" : "border-line bg-surface-2 text-muted hover:text-text",
                )}
              >
                {answerText(q.id, a, L)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chips({
  options,
  selected,
  onTap,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onTap: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={selected.includes(o.value)}
          onClick={() => onTap(o.value)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-semibold",
            selected.includes(o.value) ? "border-volt bg-volt text-ink" : "border-line bg-surface-2 text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Question 2: just one or a few, your sports first, six more to tap, and a search over the whole catalog. */
function SportsQuestion({
  title,
  answers,
  set,
  recent,
}: {
  title: ReactNode;
  answers: TailorAnswers;
  set: (id: TailorStep, patch: Partial<TailorAnswers>) => void;
  recent: string[];
}) {
  const { lang } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const x = getTailorDict(lang).survey;
  const [query, setQuery] = useState("");
  const name = (k: string) => catalog.sports.find((s) => s.key === k)?.name[L] ?? k;
  const max = answers.sportMode === "one" ? 1 : TAILOR_SPORTS_MAX;
  const shown = query.trim()
    ? catalog.sports.filter((s) => fold(s.name[L]).includes(fold(query.trim()))).map((s) => s.key)
    : [...new Set([...answers.sports, ...recent, ...catalog.sports.map((s) => s.key)])].slice(0, Math.max(6, answers.sports.length));
  const tap = (k: string) => {
    const has = answers.sports.includes(k);
    const next = has ? answers.sports.filter((s) => s !== k) : max === 1 ? [k] : [...answers.sports, k].slice(0, max);
    set("sports", { sports: next });
  };
  return (
    <div>
      {title}
      <div className="mt-3">
        <Segmented
          label={tailorText("tailor.sports.title", L)}
          value={answers.sportMode}
          options={(["one", "few"] as const).map((m) => ({ value: m, label: tailorText(`tailor.sports.${m}`, L) }))}
          onChange={(m) => set("sports", { sportMode: m, sports: m === "one" ? answers.sports.slice(0, 1) : answers.sports })}
        />
      </div>
      <Small className="mt-2">{max === 1 ? x.sportsHint : `${x.sportsHint} · ${x.sportsMax.replace("{n}", String(max))}`}</Small>
      <input
        className={cn(inputCls, "mt-3")}
        type="search"
        value={query}
        placeholder={tailorText("tailor.sports.search", L)}
        aria-label={tailorText("tailor.sports.search", L)}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3">
        {shown.length ? (
          <Chips options={shown.slice(0, 24).map((k) => ({ value: k, label: name(k) }))} selected={answers.sports} onTap={tap} />
        ) : (
          <Small>{x.noSport}</Small>
        )}
      </div>
    </div>
  );
}

/**
 * The summary: the preset's name, every feature with its switch (the switches win over the answers), "Show rewards
 * & $VVAKE" (off by default; points count either way), the tabs it gives, what changes from today, and Start / Save.
 */
function Summary({
  answers,
  overrides,
  setOverrides,
  deskLinked,
  state,
  onSave,
  first,
}: {
  answers: TailorAnswers;
  overrides: Partial<TailorFeatures>;
  setOverrides: (o: Partial<TailorFeatures>) => void;
  deskLinked: boolean;
  state: "idle" | "saving" | "error";
  onSave: () => void;
  first: boolean;
}) {
  const { lang, t, profile } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const x = getTailorDict(lang).survey;
  const after = tailorFromAnswers(answers, { overrides, deskLinked });
  const base = tailorFromAnswers(answers, { deskLinked });
  const change = previewChanges(profile, after).text[L];
  const flip = (k: TailorFeature, v: boolean) => {
    const next = { ...overrides };
    if (v === base.features[k]) delete next[k];
    else next[k] = v;
    setOverrides(next);
  };
  return (
    <div className="space-y-4">
      <div>
        <H2>{tailorText("tailor.summary.title", L)}</H2>
        <p className="mt-1 font-display text-2xl font-bold text-volt-fg">{TAILOR_PRESET_TEXT[after.preset][L]}</p>
        <Small className="mt-1">{x.summaryLead}</Small>
      </div>
      <Card>
        <ul className="divide-y divide-line">
          {TAILOR_FEATURES.filter((k) => k !== "rewards").map((k) => (
            <li key={k} className="flex min-h-12 items-center justify-between gap-3 py-1.5">
              <span className="text-[15px] font-medium">{TAILOR_FEATURE_NAMES[k][L]}</span>
              <Toggle on={after.features[k]} onChange={(v) => flip(k, v)} label={TAILOR_FEATURE_NAMES[k][L]} />
            </li>
          ))}
          <li className="flex min-h-12 items-center justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="block text-[15px] font-medium">{tailorText("tailor.summary.rewards", L)}</span>
              <span className="block text-xs text-muted">{tailorText("tailor.summary.rewardsHint", L)}</span>
            </span>
            <Toggle on={after.features.rewards} onChange={(v) => flip("rewards", v)} label={tailorText("tailor.summary.rewards", L)} />
          </li>
        </ul>
      </Card>
      <Small>{`${x.tabs}: ${webTabs(after.tabs)
        .map((k) => t.tabs[k])
        .join(" · ")}`}</Small>
      <p className="text-sm font-medium">{change || x.unchanged}</p>
      <Card>
        <SuggestPicker />
      </Card>
      <Btn big className="w-full" disabled={state === "saving"} onClick={onSave}>
        {state === "saving" ? x.saving : first ? tailorText("tailor.summary.start", L) : x.save}
      </Btn>
      {state === "error" && (
        <p role="alert" className="text-sm text-down-fg">
          {x.error}
        </p>
      )}
    </div>
  );
}

/**
 * All features (lean doc §4.1): the nine features, on or off. Tap opens the feature (even when off: nothing is
 * removed); the switch turns it on or off for every device (the summary's toggles, prefs.tailor.overrides).
 */
export function FeaturesScreen() {
  const { t, lang, go, tailor, profile, saveTailor, deskLinked } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const x = getTailorDict(lang).features;
  const [msg, setMsg] = useState<string | null>(null);
  const base = tailor ? tailorFromAnswers(tailor.answers, { deskLinked }) : null;
  const flip = async (k: TailorFeature, v: boolean) => {
    if (!tailor || !base) return;
    const o = { ...tailor.overrides };
    if (v === base.features[k]) delete o[k];
    else o[k] = v;
    setMsg(null);
    try {
      await saveTailor(nextTailorPrefs(tailor, { overrides: o }));
      setMsg(x.turned);
    } catch {
      setMsg(getTailorDict(lang).survey.error);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <H1>{x.title}</H1>
        <Small className="mt-1">{x.lead}</Small>
      </div>
      <List>
        {TAILOR_FEATURES.map((k) => {
          const on = profile ? profile.features[k] : true;
          const to = FEATURE_TARGET[k];
          return (
            <div key={k} className="flex items-center gap-2 pr-4">
              <div className="min-w-0 flex-1">
                <Row
                  tone={on ? "volt" : "faint"}
                  icon={on ? "●" : "○"}
                  title={TAILOR_FEATURE_NAMES[k][L]}
                  detail={on ? t.common.on : tailorText("tailor.off.turnOn", L).replace("{feature}", TAILOR_FEATURE_NAMES[k][L])}
                  onClick={"route" in to ? () => go({ name: to.route }) : undefined}
                  href={"page" in to ? `/${lang}/${to.page}` : undefined}
                />
              </div>
              {profile && <Toggle on={on} onChange={(v) => void flip(k, v)} label={TAILOR_FEATURE_NAMES[k][L]} />}
            </div>
          );
        })}
      </List>
      {msg && (
        <p role="status" className="text-sm text-muted">
          {msg}
        </p>
      )}
      <Btn variant="ghost" className="w-full" onClick={() => go({ name: "your-vvake" })}>
        {tailorText("tailor.title", L)}
      </Btn>
    </div>
  );
}

/**
 * The Developer switch on the web (decision 12: one test build behind a switch): shown to early testers and in a
 * browser opened once with ?tailor=1. On without answers yet opens the survey (Start turns it on).
 */
export function TailorDevCard() {
  const { lang, go, tailor, profile, saveTailor, tailorDev } = useApp();
  const x = getTailorDict(lang).dev;
  const [error, setError] = useState(false);
  if (!tailorDev) return null;
  const turn = (on: boolean) => {
    setError(false);
    if (on && !tailor) return go({ name: "your-vvake" });
    void saveTailor(nextTailorPrefs(tailor, { tailorOn: on })).catch(() => setError(true));
  };
  return (
    <Card>
      <Kicker>{x.title}</Kicker>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium">{x.toggle}</span>
        <Toggle on={!!profile} onChange={turn} label={x.toggle} />
      </div>
      <Small className="mt-1">{x.lead}</Small>
      <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-sky-fg" onClick={() => go({ name: "your-vvake" })}>
        {x.survey}
      </button>
      {error && (
        <p role="alert" className="text-sm text-down-fg">
          {getTailorDict(lang).survey.error}
        </p>
      )}
    </Card>
  );
}
