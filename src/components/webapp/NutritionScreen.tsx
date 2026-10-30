"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { fmt } from "@/i18n/webapp";
import type { NutritionDict } from "@/i18n/nutrition";
import { cn } from "@/lib/cn";
import { localTz } from "@/lib/webapp/api";
import { localDay } from "@/lib/webapp/format";
import { shrinkPhoto } from "@/lib/webapp/nutrition/image";
import {
  foodItem,
  ingredientHits,
  NUTRITION_TEXT,
  nutritionText,
  scaleItem,
  searchFoods,
  totalsOf,
  type ConstraintHit,
  type MealItem,
  type NutritionProfile,
} from "@/lib/webapp/nutrition/core";
import {
  mealForHour,
  MEAL_KINDS,
  type AnalyzeFallback,
  type ApiMeal,
  type MealKind,
  type NutritionDay,
  type NutritionWeek,
} from "@/lib/webapp/nutrition/nutritionApi";
import { addDays, dayBounds, gramsAt, mondayOf, PORTION_MAX, PORTION_MIN, PORTION_STEP } from "@/lib/webapp/nutrition/view";
import { dayOf, logHabit, readDays, withDay, writeDays } from "@/lib/webapp/rhythm";
import { useApp, type NutritionView } from "./AppContext";
import { GroceryView, IdeasView, PlanView } from "./NutritionPlan";
import { NutritionSettings } from "./NutritionSettings";
import { useNutrition, type NutritionState } from "./useNutrition";
import { Bar, Btn, Card, H1, H2, inputCls, Kicker, Note, Small } from "./ui";

/**
 * Nutrition in the web app (VVFit ADR-0070, optional: the Tailor feature `nutrition`, off by default): today (numbers
 * or words), logging a meal (a photo shrunk here, typing, the food list), the review sheet (portion per food,
 * rename, remove, add), the week, meal ideas, the weekly plan, the grocery list and Settings › Nutrition. "Hide numbers"
 * is one tap from every view. Never a shaming word; estimates are called estimates.
 */
export function NutritionScreen({ view = "today", photo }: { view?: NutritionView; photo?: boolean }) {
  const { go, t } = useApp();
  const n = useNutrition();
  const { tn, profile, state } = n;

  if (!n.on)
    return (
      <div className="space-y-4">
        <Kicker tone="mint">{tn.kicker}</Kicker>
        <H1>{tn.title}</H1>
        <Note>{tn.off}</Note>
        <Small>{tn.settings.disclaimer}</Small>
        <Btn disabled={state !== "ready"} onClick={() => void n.setOn(true).then(() => go({ name: "nutrition", view: "settings" }))}>
          {tn.turnOn}
        </Btn>
      </div>
    );
  if (state === "loading" || (state === "ready" && !profile))
    return (
      <p role="status" className="mt-16 text-center text-muted">
        {tn.loading}
      </p>
    );
  if (state !== "ready" || !profile)
    return (
      <div className="mt-16 space-y-4 text-center">
        <p role="status" className="text-muted">
          {state === "unavailable" ? t.common.error : tn.error}
        </p>
        <Btn variant="ghost" onClick={() => void n.load()}>
          {tn.retry}
        </Btn>
      </div>
    );

  const views: NutritionView[] = ["today", "week", "ideas", "plan", "grocery", "settings"];
  const shown = view === "log" ? "today" : view;
  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Kicker tone="mint">{tn.kicker}</Kicker>
          <H1>{tn.title}</H1>
          <Small className="mt-1">{tn.lead}</Small>
        </div>
        <HideToggle n={n} />
      </header>
      <nav aria-label={tn.title} className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            aria-current={shown === v ? "page" : undefined}
            onClick={() => go({ name: "nutrition", view: v })}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold",
              shown === v ? "border-volt bg-volt text-ink" : "border-line bg-surface-2 text-muted hover:text-text",
            )}
          >
            {tn.tabs[v as keyof NutritionDict["tabs"]]}
          </button>
        ))}
      </nav>
      {profile.adult === null && <AdultQuestion n={n} />}
      {shown === "today" && <TodayView n={n} openLog={view === "log"} photo={photo} />}
      {shown === "week" && <WeekView n={n} />}
      {shown === "ideas" && <IdeasView n={n} />}
      {shown === "plan" && <PlanView n={n} />}
      {shown === "grocery" && <GroceryView n={n} />}
      {shown === "settings" && <NutritionSettings n={n} />}
    </div>
  );
}

/** Hide / show numbers, one tap (ADR-0070 rule 3); in calm mode or under 18 numbers stay hidden: no button. */
function HideToggle({ n }: { n: NutritionState }) {
  if (!n.profile || !n.canShow) return null;
  return (
    <button
      type="button"
      aria-pressed={n.hidden}
      onClick={() => void n.save({ hideNumbers: !n.hidden })}
      className="min-h-10 shrink-0 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-muted hover:text-text"
    >
      {n.hidden ? n.tn.show : n.tn.hide}
    </button>
  );
}

/** "Are you 18 or older?", asked once (ADR-0070 rule 3): until answered, numbers stay hidden and nothing suggests less. */
function AdultQuestion({ n }: { n: NutritionState }) {
  const s = n.tn.settings;
  return (
    <Card>
      <H2>{s.adult}</H2>
      <Small className="mt-1">{s.adultNote}</Small>
      <div className="mt-3 flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={() => void n.save({ adult: true })}>
          {s.adultYes}
        </Btn>
        <Btn variant="ghost" className="flex-1" onClick={() => void n.save({ adult: false })}>
          {s.adultNo}
        </Btn>
      </div>
    </Card>
  );
}

/** game-core's calm status line for a key (NUTRITION_TEXT), else ours; never a number, never a judgement. */
const statusLine = (tn: NutritionDict, key: string, lang: "en" | "fr") =>
  NUTRITION_TEXT[key] ? nutritionText(key, lang) : ((tn.status as Record<string, string>)[key] ?? tn.status.fallback);

// ── Today ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function TodayView({ n, openLog, photo }: { n: NutritionState; openLog: boolean; photo?: boolean }) {
  const { tn, api, hidden } = n;
  const { lang } = useApp();
  const [today] = useState(() => localDay(Date.now()));
  const [day, setDay] = useState<NutritionDay | null | undefined>(undefined);
  const [meals, setMeals] = useState<ApiMeal[] | null | undefined>(undefined);
  const [logging, setLogging] = useState(openLog);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const { from, to } = dayBounds(today);
    api
      .day(today, localTz())
      .then(setDay)
      .catch(() => setDay(null));
    api
      .meals(from, to)
      .then(setMeals)
      .catch(() => setMeals(null));
  }, [api, today]);
  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const t = tn.today;
  const num = (v: number) => Math.round(v).toLocaleString(lang);
  const rows: { label: string; v: number; target?: { min: number; max: number } | null; unit: "kcal" | "g" }[] = day
    ? [
        { label: t.energy, v: day.totals.kcal, target: day.targets?.kcal, unit: "kcal" },
        { label: t.protein, v: day.totals.proteinG, target: day.targets?.proteinG, unit: "g" },
        { label: t.carbs, v: day.totals.carbsG, target: day.targets?.carbsG, unit: "g" },
        { label: t.fat, v: day.totals.fatG, target: day.targets?.fatG, unit: "g" },
      ]
    : [];
  const timing = day?.carbTiming ?? day?.targets?.carbTiming;
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <H2>{t.title}</H2>
          {day?.load && <Small>{(t.load as Record<string, string>)[day.load] ?? ""}</Small>}
        </div>
        {day === undefined && <Small className="mt-2">{tn.loading}</Small>}
        {day === null && <Small className="mt-2">{tn.error}</Small>}
        {day && (
          <>
            <p className="mt-2 text-[15px]">{statusLine(tn, day.status.lineKey, lang)}</p>
            {!hidden && day.targets && (
              <ul className="mt-4 space-y-3">
                {rows.map((r) => (
                  <li key={r.label}>
                    <div className="flex justify-between text-sm">
                      <span>{r.label}</span>
                      <span className="text-muted">
                        {r.target
                          ? fmt(t.of, {
                              v: fmt(r.unit === "kcal" ? t.kcal : t.g, { n: num(r.v) }),
                              t: fmt(t.range, { min: num(r.target.min), max: num(r.target.max) }),
                            })
                          : fmt(r.unit === "kcal" ? t.kcal : t.g, { n: num(r.v) })}
                      </span>
                    </div>
                    {r.target && <Bar fraction={r.target.max ? r.v / r.target.max : 0} tone="mint" label={r.label} />}
                  </li>
                ))}
                {typeof (day.waterMl ?? day.targets.waterMl) === "number" && (
                  <li className="flex justify-between text-sm">
                    <span>{t.water}</span>
                    <span className="text-muted">{fmt(t.ml, { n: num(day.waterMl ?? day.targets.waterMl ?? 0) })}</span>
                  </li>
                )}
              </ul>
            )}
            {!hidden && !day.targets && <Small className="mt-2">{t.noTargets}</Small>}
            {timing && timing !== "normal" && <Small className="mt-3">{(t.carbTiming as Record<string, string>)[timing] ?? ""}</Small>}
            {!hidden && <Small className="mt-3 text-faint">{tn.estimate}</Small>}
          </>
        )}
      </Card>

      {msg && (
        <p role="status" className="text-sm text-mint-fg">
          {msg}
        </p>
      )}
      {logging ? (
        <LogMeal
          n={n}
          photo={photo}
          onDone={(saved) => {
            setLogging(false);
            if (saved) {
              setMsg(tn.review.saved);
              load();
            }
          }}
        />
      ) : (
        <Btn big variant="volt" className="w-full" onClick={() => (setMsg(null), setLogging(true))}>
          {tn.log.title}
        </Btn>
      )}

      <section className="space-y-2">
        <H2>{t.meals}</H2>
        {meals === undefined && <Small>{tn.loading}</Small>}
        {meals === null && <Small>{tn.error}</Small>}
        {meals && !meals.length && <Small>{t.noMeals}</Small>}
        {meals?.map((m) => (
          <MealRow
            key={m.id}
            n={n}
            meal={m}
            onChanged={(line) => {
              if (line) setMsg(line);
              load();
            }}
          />
        ))}
      </section>
      <Small>{tn.settings.disclaimer}</Small>
    </div>
  );
}

/** A logged meal: its name line, its foods, edit (the review sheet) and delete. */
function MealRow({ n, meal, onChanged }: { n: NutritionState; meal: ApiMeal; onChanged: (line?: string) => void }) {
  const { tn, api, hidden } = n;
  const { lang } = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const time = new Date(meal.at).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  if (editing)
    return (
      <Review
        n={n}
        initial={{ items: meal.items, meal: meal.meal, source: meal.source, note: meal.note }}
        onCancel={() => setEditing(false)}
        onSave={async (items, kind, note) => {
          await api.editMeal(meal.id, { items, meal: kind, ...(note ? { note } : {}) });
          setEditing(false);
          onChanged(tn.review.saved);
        }}
      />
    );
  return (
    <Card className="p-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">
            {tn.log.meals[meal.meal]} · {time}
          </span>
          <span className="block truncate text-xs text-muted">{meal.items.map((i) => i.name).join(", ")}</span>
        </span>
        {!hidden && <span className="text-sm text-muted">{fmt(tn.today.kcal, { n: Math.round(meal.totals.kcal) })}</span>}
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          {meal.hits.length > 0 && <HitsNote tn={tn} hits={meal.hits} />}
          <ul className="space-y-1 text-sm">
            {meal.items.map((i, k) => (
              <li key={k} className="flex justify-between gap-2">
                <span>{i.name}</span>
                <span className="text-muted">
                  {hidden ? `${Math.round(i.grams)} g` : `${Math.round(i.grams)} g · ${Math.round(i.kcal)} kcal`}
                </span>
              </li>
            ))}
          </ul>
          {meal.note && <Small>{meal.note}</Small>}
          <Small>{tn.meal.sources[meal.source]}</Small>
          <div className="flex gap-2">
            <Btn variant="ghost" className="flex-1" onClick={() => setEditing(true)}>
              {tn.meal.edit}
            </Btn>
            <Btn
              variant="danger"
              className="flex-1"
              onClick={() => {
                if (!window.confirm(tn.meal.deleteConfirm)) return;
                void api
                  .deleteMeal(meal.id)
                  .then(() => onChanged(tn.meal.deleted))
                  .catch(() => onChanged(tn.error));
              }}
            >
              {tn.meal.delete}
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

/** "Contains X, which you listed." – calm, never a warning sign: it's what they ate. */
function HitsNote({ tn, hits }: { tn: NutritionDict; hits: readonly { term: string }[] }) {
  const terms = [...new Set(hits.map((h) => h.term))];
  if (!terms.length) return null;
  return <Note tone="butter">{fmt(tn.review.contains, { x: terms.join(", ") })}</Note>;
}

// ── Logging a meal ────────────────────────────────────────────────────────────────────────────────────────────────

type Draft = {
  items: MealItem[];
  aiItems?: MealItem[];
  meal: MealKind;
  source: ApiMeal["source"];
  confidence?: number;
  hint?: string;
  note?: string;
};

/**
 * Log a meal: a photo (the camera on a phone, a file on a computer; shrunk here, never kept), typed words, or the food
 * list. The estimate opens the review sheet; when the estimate can't be made (the week's limit, the AI unavailable, an
 * unreadable plate) the food search opens with the reason, never a dead end.
 */
function LogMeal({ n, photo, onDone }: { n: NutritionState; photo?: boolean; onDone: (saved: boolean) => void }) {
  const { tn, api, profile } = n;
  const { lang, me } = useApp();
  const l = tn.log;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"pick" | "type" | "search" | "busy">("pick");
  const [busyLine, setBusyLine] = useState("");
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState<AnalyzeFallback | "bad" | null>(null);
  const [left, setLeft] = useState<{ photos?: number; text?: number }>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const meal = mealForHour(new Date().getHours() + new Date().getMinutes() / 60);

  // The coach's "log a meal with a photo" (log_meal photo): open the camera right away (a tap already happened).
  const askedPhoto = useRef(false);
  useEffect(() => {
    if (photo && !askedPhoto.current) {
      askedPhoto.current = true;
      cameraRef.current?.click();
    }
  }, [photo]);

  const analyze = async (body: { image?: { mediaType: "image/jpeg"; data: string }; text?: string }) => {
    setMode("busy");
    setBusyLine(l.analysing);
    setFallback(null);
    try {
      const r = await api.analyze({ ...body, lang, meal, hour: new Date().getHours() });
      setLeft({ photos: r.photosLeft, text: r.textLeft });
      if (r.fallback || !r.estimate || !r.estimate.items.length) {
        setFallback(r.fallback ?? "unreadable");
        setMode("search");
        return;
      }
      const items = r.estimate.items as MealItem[];
      setDraft({
        items,
        aiItems: items,
        meal,
        source: body.image ? "photo" : "text",
        confidence: r.estimate.confidence,
        ...(r.estimate.portionHint ? { hint: r.estimate.portionHint } : {}),
      });
    } catch {
      setFallback("unavailable");
      setMode("search");
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMode("busy");
    setBusyLine(l.shrinking);
    const shrunk = await shrinkPhoto(f);
    if (!shrunk) {
      setFallback("bad");
      setMode("pick");
      return;
    }
    await analyze({ image: { mediaType: shrunk.mediaType, data: shrunk.data } });
  };

  if (draft)
    return (
      <Review
        n={n}
        initial={draft}
        onCancel={() => onDone(false)}
        onSave={async (items, kind, note) => {
          await api.saveMeal({
            at: Date.now(),
            meal: kind,
            source: draft.source,
            items,
            ...(draft.aiItems ? { aiItems: draft.aiItems } : {}),
            ...(note ? { note } : {}),
            ...(draft.confidence !== undefined ? { estimateConfidence: draft.confidence } : {}),
          });
          // The meals habit ticks either way (log_meal), in this browser's habits like the coach's card.
          const at = Date.now();
          const days = readDays(me.id);
          const next = logHabit(dayOf(days, at), "meal", at);
          if (next) writeDays(me.id, withDay(days, next));
          onDone(true);
        }}
      />
    );

  return (
    <Card>
      <div className="flex items-center justify-between">
        <H2>{l.title}</H2>
        <button type="button" className="text-sm text-muted underline" onClick={() => onDone(false)}>
          {tn.review.cancel}
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e)} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
      {fallback && (
        <div className="mt-3">
          <Note tone="butter">{fallback === "bad" ? l.badPhoto : l.fallback[fallback]}</Note>
        </div>
      )}
      {mode === "busy" && (
        <p role="status" className="mt-4 text-muted">
          {busyLine}
        </p>
      )}
      {mode === "pick" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn onClick={() => cameraRef.current?.click()}>{l.photo}</Btn>
          <Btn variant="ghost" onClick={() => galleryRef.current?.click()}>
            {l.gallery}
          </Btn>
          <Btn variant="ghost" onClick={() => setMode("type")}>
            {l.type}
          </Btn>
          <Btn variant="ghost" onClick={() => setMode("search")}>
            {l.search}
          </Btn>
        </div>
      )}
      {mode === "type" && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void analyze({ text: text.trim().slice(0, 500) });
          }}
        >
          <textarea
            className={cn(inputCls, "h-24 py-3")}
            value={text}
            maxLength={500}
            placeholder={l.typePlaceholder}
            onChange={(e) => setText(e.target.value)}
            aria-label={l.type}
          />
          <Btn type="submit" className="w-full" disabled={!text.trim()}>
            {l.estimate}
          </Btn>
        </form>
      )}
      {mode === "search" && profile && (
        <div className="mt-3">
          <FoodSearch n={n} onPick={(item) => setDraft({ items: [item], meal, source: "table" })} autoFocus />
        </div>
      )}
      {mode === "pick" && (
        <>
          <Small className="mt-3">{l.hint}</Small>
          <Small className="mt-1">{l.photoPrivacy}</Small>
        </>
      )}
      {(typeof left.photos === "number" || typeof left.text === "number") && (
        <Small className="mt-2 text-faint">
          {[
            typeof left.photos === "number" ? fmt(l.left, { n: left.photos }) : "",
            typeof left.text === "number" ? fmt(l.textLeft, { n: left.text }) : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Small>
      )}
    </Card>
  );
}

/** The local food list (game-core FOOD_TABLE, USDA FoodData Central): type, pick, it becomes a 100 g item to adjust. */
function FoodSearch({ n, onPick, autoFocus }: { n: NutritionState; onPick: (item: MealItem) => void; autoFocus?: boolean }) {
  const { tn } = n;
  const { lang } = useApp();
  const [q, setQ] = useState("");
  const found = useMemo(() => (q.trim().length >= 2 ? searchFoods(q, lang, 8) : []), [q, lang]);
  return (
    <div className="space-y-2">
      <input
        className={inputCls}
        value={q}
        autoFocus={autoFocus}
        placeholder={tn.search.placeholder}
        aria-label={tn.search.placeholder}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && !found.length && <Small>{tn.search.none}</Small>}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {found.map((f) => {
          const item = foodItem(f, lang);
          return (
            <li key={item.name}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm hover:bg-surface-2/60"
                onClick={() => onPick(item)}
              >
                <span className="flex-1">{item.name}</span>
                {!n.hidden && (
                  <span className="text-xs text-muted">
                    {Math.round((item.kcal * 100) / Math.max(1, item.grams))} kcal {tn.search.per100}
                  </span>
                )}
                <span className="text-volt-fg">{tn.search.add}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Small className="text-faint">{tn.search.source}</Small>
    </div>
  );
}

/**
 * The review sheet: the meal, then each food with a portion slider (0.25×–3× of the first guess, in grams), rename,
 * remove, add one from the food list; the hint to put a fork or a hand next to the plate; a calm note when a food hits
 * the athlete's allergies (logging is allowed: it's what they ate). Corrections go up with the AI's own guess
 * (`aiItems`), which teaches the portion model.
 */
function Review({
  n,
  initial,
  onCancel,
  onSave,
}: {
  n: NutritionState;
  initial: Pick<Draft, "items" | "meal" | "source" | "confidence" | "hint" | "note">;
  onCancel: () => void;
  onSave: (items: MealItem[], meal: MealKind, note?: string) => Promise<void>;
}) {
  const { tn, profile, hidden } = n;
  const r = tn.review;
  const [rows, setRows] = useState<{ item: MealItem; base: MealItem; factor: number }[]>(() =>
    initial.items.map((i) => ({ item: i, base: i, factor: 1 })),
  );
  const [meal, setMeal] = useState<MealKind>(initial.meal);
  const [note, setNote] = useState(initial.note ?? "");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const items = rows.map((x) => x.item);
  const totals = totalsOf(items);
  const hits: ConstraintHit[] = profile
    ? ingredientHits(
        items.map((i) => i.name),
        profile as NutritionProfile,
      )
    : [];
  const conf = initial.confidence;
  const confKey = conf === undefined ? null : conf < 0.45 ? "low" : conf < 0.75 ? "medium" : "high";

  const save = async () => {
    if (!items.length) return setErr(r.empty);
    setBusy(true);
    setErr(null);
    try {
      await onSave(items, meal, note.trim() || undefined);
    } catch {
      setErr(tn.error);
      setBusy(false);
    }
  };

  return (
    <Card>
      <H2>{r.title}</H2>
      <Small className="mt-1">{r.lead}</Small>
      <div className="mt-3 flex flex-wrap gap-1" role="radiogroup" aria-label={tn.log.meal}>
        {MEAL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={meal === k}
            onClick={() => setMeal(k)}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm",
              meal === k ? "border-volt bg-volt text-ink" : "border-line text-muted",
            )}
          >
            {tn.log.meals[k]}
          </button>
        ))}
      </div>
      {confKey && <Small className="mt-2">{`${tn.estimate} · ${r.confidence[confKey]}`}</Small>}
      {initial.hint && <Small className="mt-1">{`${r.portionHint}: ${initial.hint}`}</Small>}
      {hits.length > 0 && (
        <div className="mt-3">
          <HitsNote tn={tn} hits={hits} />
        </div>
      )}
      <ul className="mt-3 space-y-3">
        {rows.map((x, k) => (
          <li key={k} className="rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              {renaming === k ? (
                <input
                  className={cn(inputCls, "h-10 flex-1")}
                  autoFocus
                  aria-label={r.rename}
                  defaultValue={x.item.name}
                  maxLength={80}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name) setRows(rows.map((y, j) => (j === k ? { ...y, item: { ...y.item, name }, base: { ...y.base, name } } : y)));
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              ) : (
                <span className="flex-1 font-medium">{x.item.name}</span>
              )}
              <button type="button" className="text-xs text-muted underline" onClick={() => setRenaming(k)}>
                {r.edit}
              </button>
              <button type="button" className="text-xs text-down-fg underline" onClick={() => setRows(rows.filter((_, j) => j !== k))}>
                {r.delete}
              </button>
            </div>
            <label className="mt-2 block text-sm">
              <span className="flex justify-between text-muted">
                <span>{r.portion}</span>
                <span>
                  {Math.round(x.item.grams)} g{!hidden ? ` · ${Math.round(x.item.kcal)} kcal` : ""}
                </span>
              </span>
              <input
                type="range"
                className="mt-1 w-full accent-volt"
                min={PORTION_MIN}
                max={PORTION_MAX}
                step={PORTION_STEP}
                value={x.factor}
                aria-label={`${r.portion} ${x.item.name}`}
                aria-valuetext={`${Math.round(x.item.grams)} g`}
                onChange={(e) => {
                  const f = Number(e.target.value);
                  setRows(rows.map((y, j) => (j === k ? { ...y, factor: f, item: scaleItem(y.base, gramsAt(y.base.grams, f)) } : y)));
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-3">
          <FoodSearch
            n={n}
            autoFocus
            onPick={(item) => {
              setRows([...rows, { item, base: item, factor: 1 }]);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <Btn variant="ghost" className="mt-3 w-full" onClick={() => setAdding(true)}>
          {r.add}
        </Btn>
      )}
      <Small className="mt-3">{tn.log.hint}</Small>
      {!hidden && items.length > 0 && (
        <p className="mt-3 text-sm">
          <strong>{r.total}</strong>: {Math.round(totals.kcal)} kcal · P {Math.round(totals.proteinG)} g · G {Math.round(totals.carbsG)} g ·
          L {Math.round(totals.fatG)} g
        </p>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-sm">{r.note}</span>
        <input className={inputCls} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </label>
      {err && (
        <p role="alert" className="mt-2 text-sm text-down-fg">
          {err}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={onCancel} disabled={busy}>
          {r.cancel}
        </Btn>
        <Btn variant="volt" className="flex-1" onClick={() => void save()} disabled={busy}>
          {busy ? r.saving : r.save}
        </Btn>
      </div>
    </Card>
  );
}

// ── The week ──────────────────────────────────────────────────────────────────────────────────────────────────────

function WeekView({ n }: { n: NutritionState }) {
  const { tn, api, hidden } = n;
  const { lang } = useApp();
  const [thisWeek] = useState(() => mondayOf(localDay(Date.now())));
  const [start, setStart] = useState(thisWeek);
  const [week, setWeek] = useState<NutritionWeek | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api
      .week(start, localTz())
      .then((w) => live && setWeek(w))
      .catch(() => live && setWeek(null));
    return () => {
      live = false;
    };
  }, [api, start]);
  const w = tn.week;
  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Btn variant="ghost" aria-label={w.prev} onClick={() => (setWeek(undefined), setStart(addDays(start, -7)))}>
          ‹
        </Btn>
        <H2>{`${fmtDay(start)} – ${fmtDay(addDays(start, 6))}`}</H2>
        <Btn
          variant="ghost"
          aria-label={w.next}
          disabled={start >= thisWeek}
          onClick={() => (setWeek(undefined), setStart(addDays(start, 7)))}
        >
          ›
        </Btn>
      </div>
      {week === undefined && <Small>{tn.loading}</Small>}
      {week === null && <Small>{tn.error}</Small>}
      {week && !week.days.some((d) => d.totals.kcal > 0) && <Small>{w.none}</Small>}
      {week && (
        <>
          {typeof week.proteinDaysOk === "number" && (
            <Card>
              <p>{fmt(w.proteinDays, { n: week.proteinDaysOk, d: week.proteinDays ?? week.days.length })}</p>
              {!hidden && week.averages && (
                <Small className="mt-1">
                  {w.average}: {Math.round(week.averages.kcal)} kcal · P {Math.round(week.averages.proteinG)} g
                </Small>
              )}
            </Card>
          )}
          <ul className="space-y-2">
            {week.days.map((d, i) => (
              <WeekDay key={d.day ?? i} tn={tn} d={d} label={fmtDay(d.day ?? addDays(start, i))} hidden={hidden} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function WeekDay({ tn, d, label, hidden }: { tn: NutritionDict; d: NutritionDay; label: string; hidden: boolean }): ReactNode {
  const { lang } = useApp();
  const pct = d.targets?.kcal?.max ? d.totals.kcal / d.targets.kcal.max : 0;
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">{d.load ? ((tn.today.load as Record<string, string>)[d.load] ?? "") : ""}</span>
      </div>
      <Small className="mt-1">{statusLine(tn, d.status.lineKey, lang)}</Small>
      {!hidden && d.targets?.kcal && (
        <div className="mt-2">
          <Bar fraction={pct} tone="mint" label={tn.today.energy} />
        </div>
      )}
    </li>
  );
}
