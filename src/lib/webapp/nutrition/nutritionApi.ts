import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import type { MealIdea as CoreMealIdea } from "./nutrition";
import { AISLES, type Aisle, type FlyerLink, type GroceryItem, type GroceryList, type SavingTip } from "./nutritionGrocery";

/**
 * Nutrition's endpoints on the web (VVFit ADR-0070, docs/05-tech/api-v1.md "Nutrition"): the same /v1/nutrition calls
 * the phone makes, parsed leniently (a field a newer API renames reads as missing, never as a broken screen). The rules
 * (allergen matching, status words, the food table, scaling) are game-core's, copied in ./core. Photos go up once,
 * already shrunk (image.ts), and are never kept: not here, not on the server.
 */

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const q = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))).toString();
/** An array whose bad rows are dropped, never failing the whole answer. */
const rows = <T extends z.ZodMiniType>(t: T) =>
  z.pipe(
    z.catch(z.array(z.catch(z.nullable(t), null)), []),
    z.transform((a) => a.filter((x): x is NonNullable<typeof x> => x != null)),
  );

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_KINDS: readonly MealKind[] = ["breakfast", "lunch", "dinner", "snack"];
/** The meal for an hour of the day (the review sheet's starting pick). Pure. */
export const mealForHour = (h: number): MealKind =>
  h < 10.5 ? "breakfast" : h < 15 ? "lunch" : h >= 17.5 && h < 22.5 ? "dinner" : "snack";

const itemSchema = z.object({
  name: z.string(),
  grams: z.number(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.catch(z.number(), 0.5),
  family: str,
});
export type ApiMealItem = {
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: number;
  family?: string;
};
const cleanItem = (i: z.infer<typeof itemSchema>): ApiMealItem => ({
  name: i.name.slice(0, 80),
  grams: i.grams,
  kcal: i.kcal,
  proteinG: i.proteinG,
  carbsG: i.carbsG,
  fatG: i.fatG,
  confidence: Math.max(0, Math.min(1, i.confidence)),
  ...(i.family ? { family: i.family } : {}),
});

const totalsSchema = z.object({ kcal: z.number(), proteinG: z.number(), carbsG: z.number(), fatG: z.number() });
export type ApiTotals = z.infer<typeof totalsSchema>;
const ZERO: ApiTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

const hitSchema = z.object({ term: z.string(), kind: z.string(), ingredient: str });
export type ApiHit = { term: string; kind: string; ingredient?: string };
const cleanHits = (h: readonly z.infer<typeof hitSchema>[]): ApiHit[] =>
  h.map((x) => ({ term: x.term, kind: x.kind, ...(x.ingredient ? { ingredient: x.ingredient } : {}) }));

const estimateSchema = z.object({
  items: rows(itemSchema),
  totals: z.catch(totalsSchema, ZERO),
  confidence: z.catch(z.number(), 0.5),
  portionHint: str,
  notes: opt(z.array(z.string())),
  hits: rows(hitSchema),
  source: z.catch(z.string(), "photo"),
});
export interface ApiEstimate {
  items: ApiMealItem[];
  totals: ApiTotals;
  confidence: number;
  portionHint?: string;
  notes?: string[];
  hits: ApiHit[];
  source: "photo" | "text" | "manual" | "table";
}
const SOURCES = new Set(["photo", "text", "manual", "table"]);
const cleanEstimate = (e: z.infer<typeof estimateSchema>): ApiEstimate => ({
  items: e.items.map(cleanItem),
  totals: e.totals,
  confidence: e.confidence,
  ...(e.portionHint ? { portionHint: e.portionHint } : {}),
  ...(e.notes?.length ? { notes: e.notes } : {}),
  hits: cleanHits(e.hits),
  source: (SOURCES.has(e.source) ? e.source : "photo") as ApiEstimate["source"],
});

const limitsSchema = z.object({
  tier: str,
  photosLeft: num,
  textLeft: num,
  suggestLeft: num,
  plansLeft: num,
  model: str,
});
export type NutritionLimits = z.infer<typeof limitsSchema>;

const analyzeSchema = z.object({
  estimate: z.catch(z.nullable(estimateSchema), null),
  limits: opt(z.object({ photosLeft: num, textLeft: num })),
  fallback: str,
});
export type AnalyzeFallback = "limit" | "unavailable" | "unreadable";
export interface AnalyzeResult {
  estimate: ApiEstimate | null;
  photosLeft?: number;
  textLeft?: number;
  fallback?: AnalyzeFallback;
}
const FALLBACKS = new Set(["limit", "unavailable", "unreadable"]);

const mealSchema = z.object({
  id: z.string(),
  at: z.number(),
  meal: z.catch(z.string(), "snack"),
  source: z.catch(z.string(), "manual"),
  items: rows(itemSchema),
  totals: opt(totalsSchema),
  note: str,
  hits: opt(z.array(hitSchema)),
});
export interface ApiMeal {
  id: string;
  at: number;
  meal: MealKind;
  source: ApiEstimate["source"];
  items: ApiMealItem[];
  totals: ApiTotals;
  note?: string;
  hits: ApiHit[];
}
const sumOf = (items: readonly ApiMealItem[]): ApiTotals =>
  items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, proteinG: t.proteinG + i.proteinG, carbsG: t.carbsG + i.carbsG, fatG: t.fatG + i.fatG }),
    ZERO,
  );
const cleanMeal = (m: z.infer<typeof mealSchema>): ApiMeal => {
  const items = m.items.map(cleanItem);
  return {
    id: m.id,
    at: m.at,
    meal: (MEAL_KINDS as readonly string[]).includes(m.meal) ? (m.meal as MealKind) : "snack",
    source: (SOURCES.has(m.source) ? m.source : "manual") as ApiMeal["source"],
    items,
    totals: m.totals ?? sumOf(items),
    ...(m.note ? { note: m.note } : {}),
    hits: cleanHits(m.hits ?? []),
  };
};

const rangeSchema = opt(z.object({ min: z.number(), max: z.number() }));
const targetsSchema = z.object({
  kcal: rangeSchema,
  proteinG: rangeSchema,
  carbsG: rangeSchema,
  fatG: rangeSchema,
  waterMl: num,
  carbTiming: str,
});
export type ApiTargets = z.infer<typeof targetsSchema>;
const statusSchema = z.object({ energy: str, protein: str, lineKey: z.catch(z.string(), "fallback") });
export type ApiStatus = z.infer<typeof statusSchema>;

const daySchema = z.object({
  day: str,
  totals: z.catch(totalsSchema, ZERO),
  targets: z.catch(z.nullable(targetsSchema), null),
  status: z.catch(statusSchema, { lineKey: "fallback" }),
  load: str,
  waterMl: num,
  carbTiming: str,
  tip: str,
  hideNumbers: opt(z.boolean()),
});
export type NutritionDay = z.infer<typeof daySchema>;

const weekSchema = z.object({
  days: rows(daySchema),
  averages: opt(totalsSchema),
  proteinDaysOk: num,
  proteinDays: num,
});
export type NutritionWeek = z.infer<typeof weekSchema>;

const ideaRaw = z.object({
  id: z.string(),
  name: z.string(),
  ingredients: rows(z.object({ name: z.string(), qty: str })),
  steps: z.catch(z.array(z.string()), []),
  cookMin: z.catch(z.number(), 20),
  kcal: num,
  proteinG: num,
  carbsG: num,
  fatG: num,
  allergens: z.catch(z.array(z.string()), []),
  tags: z.catch(z.array(z.string()), []),
  why: z.catch(z.string(), ""),
  meal: str,
});
export type MealIdea = CoreMealIdea;
/** An idea as game-core's MealIdea: optional numbers only when they are numbers, a known meal kind only. Pure. */
const ideaOf = (i: z.infer<typeof ideaRaw>): MealIdea => ({
  id: i.id,
  name: i.name,
  ingredients: i.ingredients.map((x) => ({ name: x.name, qty: x.qty ?? "" })),
  steps: i.steps,
  cookMin: i.cookMin,
  ...(typeof i.kcal === "number" ? { kcal: i.kcal } : {}),
  ...(typeof i.proteinG === "number" ? { proteinG: i.proteinG } : {}),
  ...(typeof i.carbsG === "number" ? { carbsG: i.carbsG } : {}),
  ...(typeof i.fatG === "number" ? { fatG: i.fatG } : {}),
  allergens: i.allergens,
  tags: i.tags,
  why: i.why,
  ...(i.meal && (MEAL_KINDS as readonly string[]).includes(i.meal) ? { meal: i.meal as MealKind } : {}),
});
const ideaSchema = z.pipe(ideaRaw, z.transform(ideaOf));
const suggestSchema = z.object({ meals: rows(ideaSchema), fallback: str, source: str });

const groceryItemSchema = z.object({
  name: z.string(),
  qty: z.catch(z.union([z.number(), z.string()]), 0),
  unit: str,
  note: str,
  have: z.catch(z.boolean(), false),
  fromMeals: z.catch(z.array(z.string()), []),
});
const aisleSchema = z.object({ aisle: z.string(), items: rows(groceryItemSchema) });
const UNITS = new Set(["g", "kg", "ml", "l", "pc", ""]);
/** The API's aisles as game-core's GroceryList (unknown aisles → other, a text quantity kept as the note). Pure. */
export function groceryListOf(a: readonly z.infer<typeof aisleSchema>[]): GroceryList {
  const aisles = a
    .map((x) => ({
      aisle: ((AISLES as readonly string[]).includes(x.aisle) ? x.aisle : "other") as Aisle,
      items: x.items.map((i): GroceryItem => {
        const n = typeof i.qty === "number" ? i.qty : Number(i.qty);
        const textQty = typeof i.qty === "string" && i.qty.trim() && !Number.isFinite(n) ? i.qty.trim() : "";
        const note = [i.note ?? "", textQty].filter(Boolean).join(" + ");
        return {
          name: i.name,
          qty: Number.isFinite(n) && n > 0 ? n : 0,
          unit: (UNITS.has(i.unit ?? "") ? (i.unit ?? "") : "") as GroceryItem["unit"],
          ...(note ? { note } : {}),
          have: i.have,
          fromMeals: i.fromMeals,
        };
      }),
    }))
    .filter((x) => x.items.length);
  return { aisles, dropped: 0 };
}
const groceryField = opt(z.union([rows(aisleSchema), z.object({ aisles: rows(aisleSchema) })]));
const aislesOf = (g: z.infer<typeof groceryField>): GroceryList => groceryListOf(!g ? [] : Array.isArray(g) ? g : g.aisles);

const tipSchema = z.object({
  kind: z.string(),
  text: z.string(),
  links: opt(z.array(z.object({ chain: z.string(), url: z.string(), urlFr: str }))),
});
const flyerSchema = z.object({ chain: z.string(), url: z.string(), urlFr: str });

const planDaySchema = z.object({ day: z.string(), load: str, meals: rows(ideaSchema) });
const planSchema = z.object({
  plan: z.catch(z.nullable(z.object({ weekStart: str, days: rows(planDaySchema) })), null),
  shopping: rows(z.object({ name: z.string(), qty: z.catch(z.string(), "") })),
  grocery: groceryField,
  fallback: str,
});
export type MealPlanView = {
  weekStart?: string;
  days: { day: string; load?: string | null; meals: MealIdea[] }[];
};
export interface PlanResult {
  plan: MealPlanView | null;
  shopping: { name: string; qty: string }[];
  grocery: GroceryList;
  fallback?: string;
}
const cleanPlan = (p: z.infer<typeof planSchema>): PlanResult => ({
  plan: p.plan ? { ...(p.plan.weekStart ? { weekStart: p.plan.weekStart } : {}), days: p.plan.days } : null,
  shopping: p.shopping,
  grocery: aislesOf(p.grocery),
  ...(p.fallback ? { fallback: p.fallback } : {}),
});

const grocerySchema = z.object({
  aisles: z.optional(rows(aisleSchema)),
  grocery: groceryField,
  servings: num,
  tips: z.optional(rows(tipSchema)),
  flyers: z.optional(rows(flyerSchema)),
  slot: opt(z.object({ start: z.number(), durationMin: z.catch(z.number(), 45), reason: z.catch(z.string(), "weekend_default") })),
});
export interface GroceryResult {
  list: GroceryList;
  servings?: number;
  tips: SavingTip[];
  flyers: FlyerLink[];
  slot?: { start: number; durationMin: number; reason: string };
}
const https = (l: { url: string }) => /^https:\/\//.test(l.url);
const cleanLink = (l: { chain: string; url: string; urlFr?: string | null }): FlyerLink => ({
  chain: l.chain,
  url: l.url,
  ...(l.urlFr && /^https:\/\//.test(l.urlFr) ? { urlFr: l.urlFr } : {}),
});
const TIP_KINDS = new Set(["seasonal", "store_brand", "bulk", "freeze", "batch", "leftovers", "flyer"]);

/** The account's nutrition profile as the API sends it; checked with game-core's cleanNutritionProfile by the caller. */
const profileSchema = z.object({ profile: z.optional(z.unknown()) });

export class NutritionUnavailable extends Error {}

export function nutritionApi(s: RewardsSession) {
  const call = async <T>(path: string, init: RequestInit, schema: z.ZodMiniType<T> | null) => {
    try {
      return await s.call(path, init, schema);
    } catch (e) {
      // An API without Nutrition yet (an older server) answers 404: the page says it isn't available, nothing breaks.
      if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) throw new NutritionUnavailable();
      throw e;
    }
  };
  return {
    async profile(): Promise<unknown> {
      return (await call("/v1/nutrition/profile", GET, profileSchema)).profile ?? null;
    },
    async saveProfile(profile: unknown): Promise<unknown> {
      return (await call("/v1/nutrition/profile", send("PUT", { profile }), profileSchema)).profile ?? null;
    },
    async limits(): Promise<NutritionLimits> {
      return call("/v1/nutrition/limits", GET, limitsSchema);
    },
    async analyze(body: {
      image?: { mediaType: "image/jpeg"; data: string };
      text?: string;
      lang: "en" | "fr";
      meal?: MealKind;
      hour?: number;
    }): Promise<AnalyzeResult> {
      const r = await call("/v1/nutrition/analyze", send("POST", body), analyzeSchema);
      return {
        estimate: r.estimate ? cleanEstimate(r.estimate) : null,
        ...(typeof r.limits?.photosLeft === "number" ? { photosLeft: r.limits.photosLeft } : {}),
        ...(typeof r.limits?.textLeft === "number" ? { textLeft: r.limits.textLeft } : {}),
        ...(r.fallback && FALLBACKS.has(r.fallback) ? { fallback: r.fallback as AnalyzeFallback } : {}),
      };
    },
    async saveMeal(body: {
      at: number;
      meal: MealKind;
      source: ApiEstimate["source"];
      items: ApiMealItem[];
      aiItems?: ApiMealItem[];
      note?: string;
      estimateConfidence?: number;
    }): Promise<ApiMeal> {
      return cleanMeal((await call("/v1/nutrition/meals", send("POST", body), z.object({ meal: mealSchema }))).meal);
    },
    async meals(from: number, to: number): Promise<ApiMeal[]> {
      return (await call(`/v1/nutrition/meals?${q({ from, to })}`, GET, z.object({ meals: rows(mealSchema) }))).meals.map(cleanMeal);
    },
    async editMeal(id: string, patch: { meal?: MealKind; items?: ApiMealItem[]; note?: string; at?: number }): Promise<ApiMeal | null> {
      const r = await call(`/v1/nutrition/meals/${encodeURIComponent(id)}`, send("PATCH", patch), z.object({ meal: opt(mealSchema) }));
      return r.meal ? cleanMeal(r.meal) : null;
    },
    async deleteMeal(id: string): Promise<void> {
      await call(`/v1/nutrition/meals/${encodeURIComponent(id)}`, send("DELETE"), null);
    },
    async day(day: string, tz?: string): Promise<NutritionDay> {
      return call(`/v1/nutrition/day?${q({ day, tz })}`, GET, daySchema);
    },
    async week(start: string, tz?: string): Promise<NutritionWeek> {
      return call(`/v1/nutrition/week?${q({ start, tz })}`, GET, weekSchema);
    },
    async suggest(body: {
      meal?: MealKind;
      day?: string;
      n?: number;
      lang: "en" | "fr";
    }): Promise<{ meals: MealIdea[]; fallback?: string }> {
      const r = await call("/v1/nutrition/suggest", send("POST", body), suggestSchema);
      return { meals: r.meals, ...(r.fallback || r.source === "local" ? { fallback: r.fallback ?? "unavailable" } : {}) };
    },
    async plan(weekStart: string, lang: "en" | "fr", days?: number): Promise<PlanResult> {
      return cleanPlan(await call("/v1/nutrition/plan", send("POST", { weekStart, lang, ...(days ? { days } : {}) }), planSchema));
    },
    async currentPlan(weekStart: string): Promise<PlanResult | null> {
      try {
        return cleanPlan(await call(`/v1/nutrition/plan?${q({ weekStart })}`, GET, planSchema));
      } catch (e) {
        if (e instanceof NutritionUnavailable) return null;
        throw e;
      }
    },
    async swap(weekStart: string, day: string, meal: string, lang: "en" | "fr"): Promise<PlanResult> {
      return cleanPlan(await call("/v1/nutrition/plan/swap", send("POST", { weekStart, day, meal, lang }), planSchema));
    },
    async grocery(weekStart: string, servings: number, lang: "en" | "fr"): Promise<GroceryResult> {
      const r = await call(`/v1/nutrition/grocery?${q({ weekStart, servings, lang })}`, GET, grocerySchema);
      return {
        list: r.aisles?.length ? groceryListOf(r.aisles) : aislesOf(r.grocery),
        ...(typeof r.servings === "number" ? { servings: r.servings } : {}),
        tips: (r.tips ?? [])
          .filter((t) => TIP_KINDS.has(t.kind))
          .map((t) => ({
            kind: t.kind as SavingTip["kind"],
            text: t.text,
            ...(t.links?.length ? { links: t.links.filter(https).map(cleanLink) } : {}),
          })),
        flyers: (r.flyers ?? []).filter(https).map(cleanLink),
        ...(r.slot ? { slot: r.slot } : {}),
      };
    },
    async savePantry(pantry: string[]): Promise<void> {
      await call("/v1/nutrition/pantry", send("PUT", { pantry }), null);
    },
  };
}
export type NutritionApi = ReturnType<typeof nutritionApi>;
