"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmt } from "@/i18n/webapp";
import { localDay } from "@/lib/webapp/format";
import { downloadText } from "@/lib/webapp/livingApi";
import {
  bestShopSlot,
  fallbackMeals,
  filterSafeMeals,
  GROCERY_FLYERS,
  mealIdeaOf,
  savingTips,
  type NutritionProfile,
} from "@/lib/webapp/nutrition/core";
import type { FlyerLink, GroceryResult, MealIdea, MealKind, PlanResult, SavingTip } from "@/lib/webapp/nutrition/nutritionApi";
import {
  groceryIcs,
  groceryText,
  initialHave,
  localInput,
  mondayOf,
  qtyLabel,
  readPastShops,
  rememberShop,
} from "@/lib/webapp/nutrition/view";
import { uuid } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import type { NutritionState } from "./useNutrition";
import { Btn, Card, H2, inputCls, Note, Small } from "./ui";

/**
 * Nutrition's planning views on the web (VVFit ADR-0070): meal ideas (POST /v1/nutrition/suggest, else game-core's own
 * safe recipe list), the week plan by training day with a swap per meal (POST /v1/nutrition/plan, /plan/swap), and the
 * grocery list (GET /v1/nutrition/grocery: by aisle, pantry ticks remembered, servings, copy / share, the shopping
 * slot as an .ics, saving tips and the stores' own flyer links for a coarse region). Every meal shown has passed the
 * allergy filter twice (server, then game-core's filterSafeMeals here).
 */

/** game-core's own recipe ideas (no AI), for when the server can't help; already filtered by the profile. */
function localIdeas(p: NutritionProfile, lang: "en" | "fr", n: number, meal?: MealKind): MealIdea[] {
  const month = new Date().getMonth() + 1;
  return fallbackMeals(p, { load: "moderate", month, n, seed: new Date().getDate(), ...(meal ? { meal } : {}) }).map(
    (t) => mealIdeaOf(t, lang, "", p.servings, meal) as MealIdea,
  );
}

/** The ideas shown are the profile-safe ones only (game-core filterSafeMeals; the server filtered already). */
function safe(p: NutritionProfile, ideas: readonly MealIdea[]): MealIdea[] {
  return filterSafeMeals(
    ideas.map((i) => ({ ...i, ingredients: i.ingredients.map((x) => x.name), _idea: i })),
    p,
  ).map((x) => x._idea);
}

function IdeaCard({ idea, n, onSwap, swapping }: { idea: MealIdea; n: NutritionState; onSwap?: () => void; swapping?: boolean }) {
  const { tn, hidden } = n;
  const [open, setOpen] = useState(false);
  const i = tn.ideas;
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <button type="button" className="flex w-full items-start gap-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex-1">
          <span className="block font-medium">{idea.name}</span>
          <span className="block text-xs text-muted">
            {fmt(i.cookMin, { n: idea.cookMin })}
            {!hidden && typeof idea.kcal === "number" ? ` · ${Math.round(idea.kcal)} kcal` : ""}
            {!hidden && typeof idea.proteinG === "number" ? ` · P ${Math.round(idea.proteinG)} g` : ""}
          </span>
        </span>
        <span aria-hidden className="text-faint">
          {open ? "▾" : "›"}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-sm">
          {idea.why && (
            <p>
              <strong>{i.why}:</strong> {idea.why}
            </p>
          )}
          <div>
            <strong>{i.ingredients}</strong>
            <ul className="mt-1 list-disc pl-5">
              {idea.ingredients.map((x, k) => (
                <li key={k}>{x.qty ? `${x.name} (${x.qty})` : x.name}</li>
              ))}
            </ul>
          </div>
          {idea.steps.length > 0 && (
            <div>
              <strong>{i.steps}</strong>
              <ol className="mt-1 list-decimal pl-5">
                {idea.steps.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {onSwap && (
        <Btn variant="ghost" className="mt-2 h-10 w-full" disabled={swapping} onClick={onSwap}>
          {swapping ? tn.plan.swapping : tn.plan.swap}
        </Btn>
      )}
    </li>
  );
}

// ── Ideas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function IdeasView({ n }: { n: NutritionState }) {
  const { tn, api, profile } = n;
  const { lang } = useApp();
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meal, setMeal] = useState<MealKind | undefined>(undefined);
  const i = tn.ideas;

  const get = async () => {
    if (!profile) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api.suggest({ lang, day: localDay(Date.now()), n: 4, ...(meal ? { meal } : {}) });
      const ok = safe(profile, r.meals);
      if (!ok.length) throw new Error("none");
      setIdeas(ok);
      if (r.fallback) setNote(r.fallback === "limit" ? i.limit : i.local);
    } catch {
      setIdeas(localIdeas(profile, lang, 4, meal));
      setNote(i.local);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Small>{i.lead}</Small>
      <div className="flex flex-wrap gap-1">
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={meal === k}
            onClick={() => setMeal(meal === k ? undefined : k)}
            className={`min-h-10 rounded-full border px-3 text-sm ${meal === k ? "border-volt bg-volt text-ink" : "border-line text-muted"}`}
          >
            {tn.log.meals[k]}
          </button>
        ))}
      </div>
      <Btn className="w-full" disabled={busy} onClick={() => void get()}>
        {busy ? tn.loading : ideas ? i.more : i.get}
      </Btn>
      {note && <Note>{note}</Note>}
      {ideas && !ideas.length && <Small>{i.none}</Small>}
      {ideas && (
        <ul className="space-y-2">
          {ideas.map((x) => (
            <IdeaCard key={x.id} idea={x} n={n} />
          ))}
        </ul>
      )}
      <Small>{i.safe}</Small>
    </div>
  );
}

// ── The week plan ─────────────────────────────────────────────────────────────────────────────────────────────────

export function PlanView({ n }: { n: NutritionState }) {
  const { tn, api, profile } = n;
  const { lang, go } = useApp();
  const weekStart = mondayOf(localDay(Date.now()));
  const [plan, setPlan] = useState<PlanResult | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const p = tn.plan;

  useEffect(() => {
    let live = true;
    api
      .currentPlan(weekStart)
      .then((r) => live && setPlan(r))
      .catch(() => live && setPlan(null));
    return () => {
      live = false;
    };
  }, [api, weekStart]);

  const make = async () => {
    setBusy(true);
    setErr(null);
    try {
      setPlan(await api.plan(weekStart, lang));
    } catch (e) {
      setErr(e && typeof e === "object" && "status" in e && (e as { status: number }).status === 429 ? p.limit : tn.error);
    } finally {
      setBusy(false);
    }
  };
  const swap = async (day: string, meal: string) => {
    setSwapping(`${day}/${meal}`);
    try {
      setPlan(await api.swap(weekStart, day, meal, lang));
    } catch {
      setErr(tn.error);
    } finally {
      setSwapping(null);
    }
  };

  const days = plan?.plan?.days ?? [];
  const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="space-y-4">
      <Small>{p.lead}</Small>
      {plan === undefined && <Small>{tn.loading}</Small>}
      {plan !== undefined && !days.length && <Small>{p.none}</Small>}
      <Btn className="w-full" disabled={busy || !profile} onClick={() => void make()}>
        {busy ? p.making : days.length ? p.remake : p.make}
      </Btn>
      {err && <Note tone="butter">{err}</Note>}
      {days.map((d) => {
        const meals = profile ? safe(profile, d.meals) : [];
        return (
          <Card key={d.day}>
            <div className="flex items-baseline justify-between gap-2">
              <H2>{dayName(d.day)}</H2>
              {d.load && <Small>{(tn.today.load as Record<string, string>)[d.load] ?? ""}</Small>}
            </div>
            <ul className="mt-2 space-y-2">
              {meals.map((m) => (
                <IdeaCard
                  key={m.id}
                  idea={m}
                  n={n}
                  swapping={swapping === `${d.day}/${m.meal ?? m.id}`}
                  onSwap={() => void swap(d.day, m.meal ?? m.id)}
                />
              ))}
            </ul>
          </Card>
        );
      })}
      {days.length > 0 && (
        <Btn variant="volt" className="w-full" onClick={() => go({ name: "nutrition", view: "grocery" })}>
          {tn.grocery.title}
        </Btn>
      )}
      <Small>{tn.ideas.safe}</Small>
    </div>
  );
}

// ── Groceries ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function GroceryView({ n }: { n: NutritionState }) {
  const { tn, api, profile, save } = n;
  const { lang } = useApp();
  const g = tn.grocery;
  const weekStart = mondayOf(localDay(Date.now()));
  const [servings, setServings] = useState(() => profile?.servings ?? 1);
  const [list, setList] = useState<GroceryResult | null | undefined>(undefined);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .grocery(weekStart, servings, lang)
      .then((r) => {
        setList(r);
        setHave(initialHave(r.aisles));
      })
      .catch(() => setList(null));
  }, [api, weekStart, servings, lang]);
  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const aisleName = (k: string) => (g.aisles as Record<string, string>)[k] ?? g.aisles.other;
  const text = list ? groceryText(list.aisles, have, { title: g.title, aisle: aisleName }) : "";

  const toggle = (name: string) => {
    const k = name.toLowerCase();
    const next = new Set(have);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setHave(next);
    // "I have it" is remembered as pantry (≤ 60), so next week's list starts ticked.
    const pantry = [...new Set([...(profile?.pantry ?? []).filter((x) => x !== k), ...(next.has(k) ? [k] : [])])].slice(-60);
    void api.savePantry(pantry).catch(() => undefined);
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: g.title, text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg(g.copied);
      }
    } catch {
      // cancelled
    }
  };

  const tips: SavingTip[] = useMemo(() => {
    if (list?.tips.length) return list.tips;
    if (!profile) return [];
    try {
      return savingTips(profile.region ?? null, new Date().getMonth() + 1, lang, null) as SavingTip[];
    } catch {
      return [];
    }
  }, [list, profile, lang]);
  const flyers: FlyerLink[] = useMemo(() => {
    if (list?.flyers.length) return list.flyers;
    const r = profile?.region;
    if (!r) return [];
    const byRegion = GROCERY_FLYERS[r.country] as Record<string, { chain: string; url: string }[]> | undefined;
    return byRegion ? [...(r.region ? (byRegion[r.region] ?? []) : []), ...(byRegion["*"] ?? [])] : [];
  }, [list, profile]);

  return (
    <div className="space-y-4">
      <Small>{g.lead}</Small>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">{g.servings}</span>
            <Small>{g.servingsHint}</Small>
          </span>
          <div className="flex items-center gap-2">
            <Btn
              variant="ghost"
              className="h-10 w-10 px-0"
              aria-label="−"
              disabled={servings <= 1}
              onClick={() => setServings(servings - 1)}
            >
              −
            </Btn>
            <span className="w-6 text-center font-semibold" aria-live="polite">
              {servings}
            </span>
            <Btn
              variant="ghost"
              className="h-10 w-10 px-0"
              aria-label="+"
              disabled={servings >= 8}
              onClick={() => setServings(servings + 1)}
            >
              +
            </Btn>
          </div>
        </div>
        {profile && servings !== profile.servings && (
          <Btn variant="ghost" className="mt-2 h-10 w-full" onClick={() => void save({ servings })}>
            {tn.settings.save}
          </Btn>
        )}
      </Card>
      {list === undefined && <Small>{tn.loading}</Small>}
      {list === null && <Small>{tn.error}</Small>}
      {list && !list.aisles.length && <Note>{g.empty}</Note>}
      {list && list.aisles.length > 0 && (
        <>
          {list.aisles.map((a) => (
            <Card key={a.aisle}>
              <H2>{aisleName(a.aisle)}</H2>
              <ul className="mt-2 space-y-1">
                {a.items.map((i) => {
                  const on = have.has(i.name.toLowerCase());
                  return (
                    <li key={i.name}>
                      <label className="flex min-h-11 items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-volt"
                          checked={on}
                          onChange={() => toggle(i.name)}
                          aria-label={`${g.have}: ${i.name}`}
                        />
                        <span className={`flex-1 ${on ? "text-faint line-through" : ""}`}>{i.name}</span>
                        <span className="text-sm text-muted">{qtyLabel(i)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          <Small>{g.haveHint}</Small>
          {list.aisles.every((a) => a.items.every((i) => have.has(i.name.toLowerCase()))) && <Note>{g.allHave}</Note>}
          <div className="grid grid-cols-2 gap-2">
            <Btn
              variant="ghost"
              onClick={() =>
                void navigator.clipboard
                  .writeText(text)
                  .then(() => setMsg(g.copied))
                  .catch(() => undefined)
              }
            >
              {g.copy}
            </Btn>
            <Btn variant="ghost" onClick={() => void share()}>
              {g.share}
            </Btn>
          </div>
          {msg && (
            <p role="status" className="text-sm text-mint-fg">
              {msg}
            </p>
          )}
          <ShopSlot n={n} text={text} serverSlot={list.slot} />
        </>
      )}
      {tips.length > 0 && (
        <Card>
          <H2>{g.tips}</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {tips.map((t, k) => (
              <li key={k}>
                {t.title ? <strong>{t.title}: </strong> : null}
                {t.text ?? ""}
                {t.items?.length ? ` ${t.items.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <H2>{g.flyers}</H2>
        {flyers.length ? (
          <>
            <ul className="mt-2 space-y-1 text-sm">
              {flyers.map((f) => (
                <li key={f.url}>
                  <a className="underline" href={f.url} target="_blank" rel="noopener noreferrer nofollow">
                    {f.chain}
                  </a>
                </li>
              ))}
            </ul>
            <Small className="mt-2">{g.flyersNote}</Small>
          </>
        ) : (
          <Small className="mt-1">{g.regionNone}</Small>
        )}
      </Card>
    </div>
  );
}

/**
 * The shopping slot (game-core bestShopSlot: the slots you confirmed before, else a weekend morning; the server's when
 * it sends one), proposed, then changed or confirmed: an .ics the athlete opens (the web's add_to_calendar path). The
 * confirmed slot is remembered in this browser so the next proposal learns.
 */
function ShopSlot({
  n,
  text,
  serverSlot,
}: {
  n: NutritionState;
  text: string;
  serverSlot?: { start: number; durationMin: number; reason: string };
}) {
  const { tn } = n;
  const { lang } = useApp();
  const c = tn.grocery.calendar;
  const proposed = useMemo(() => {
    if (serverSlot && serverSlot.start > Date.now()) return serverSlot;
    try {
      return bestShopSlot({ pastShops: readPastShops(), now: Date.now() });
    } catch {
      return null;
    }
  }, [serverSlot]);
  const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!proposed) return null;
  const start = pick ? new Date(pick).getTime() : proposed.start;
  const when = new Date(start).toLocaleString(lang, { weekday: "long", hour: "2-digit", minute: "2-digit" });
  const reason = (c.reasons as Record<string, string>)[proposed.reason] ?? "";
  return (
    <Card>
      <H2>{c.title}</H2>
      <p className="mt-1">{fmt(c.propose, { when })}</p>
      {!pick && reason && <Small>{reason}</Small>}
      {pick !== null ? (
        <input
          type="datetime-local"
          className={`${inputCls} mt-2`}
          value={pick}
          aria-label={c.change}
          onChange={(e) => setPick(e.target.value)}
        />
      ) : (
        <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => setPick(localInput(proposed.start))}>
          {c.change}
        </button>
      )}
      <Btn
        variant="volt"
        className="mt-3 w-full"
        onClick={() => {
          const r = groceryIcs(
            { start, durationMin: proposed.durationMin },
            { summary: c.event, note: c.eventNote, list: text, nowMs: Date.now(), uid: uuid() },
          );
          if ("fail" in r) return setMsg(c.past);
          downloadText(r.file, r.ics);
          rememberShop(start);
          setMsg(c.done);
        }}
      >
        {c.add}
      </Btn>
      {msg && (
        <p role="status" className="mt-2 text-sm text-mint-fg">
          {msg}
        </p>
      )}
    </Card>
  );
}
