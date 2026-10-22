import * as z from "zod/mini";

/**
 * Season plans on the web (VVFit ADR-0050, packages/game-core seasonGoals / feasibility / periodisation / seasonWeek):
 * the athlete's goals (event, performance, health, free; priority A/B/C), the periodised plan the API computes from them
 * (base, build, peak, taper, race, recovery; lighter weeks), this week's sessions with a purpose line and a zone, and the
 * edits made with the coach. The plan is the API's (GET /v1/season): the web shows it and sends goals, prefs and edits.
 *
 * The answers are parsed leniently: a field a newer API renames shows as missing, never as a broken screen. Health:
 * only flags (`condition`, `cleared`, `injury`, …) ever leave the browser, never a condition's name. Pure: season.test.ts.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());
/** A list whose bad entries are dropped instead of failing the whole answer. */
const list = <T extends z.ZodMiniType>(t: T) =>
  z.pipe(
    z.catch(z.array(z.unknown()), []),
    z.transform((xs: unknown[]) =>
      xs.flatMap((x) => {
        const r = z.safeParse(t, x);
        return r.success ? [r.data as z.infer<T>] : [];
      }),
    ),
  );
const strings = list(z.string());

export type GoalType = "event" | "performance" | "health" | "free";
export type Priority = "A" | "B" | "C";
export type HealthFocus = "healthy" | "weight" | "move-daily" | "strength";
export type Phase = "base" | "build" | "peak" | "taper" | "race" | "recovery";
export type Verdict = "realistic" | "stretch" | "too-risky";
export type Intensity = "easy" | "moderate" | "hard" | "mindful";
export type SeasonLang = "en" | "fr";

export const PHASES: readonly Phase[] = ["base", "build", "peak", "taper", "race", "recovery"];
export const HEALTH_FOCUS: readonly HealthFocus[] = ["healthy", "weight", "move-daily", "strength"];
export const MAX_SEASON_GOALS = 8;
/** The plan reaches at most 60 weeks ahead (game-core SEASON_MAX_WEEKS). */
export const SEASON_MAX_WEEKS = 60;
export const HORIZONS = [4, 13, 26, 52] as const;

// ── Events (game-core EVENT_PRESETS: the sport, the usual distance and elevation, the names) ─────────────────────────

export type EventKind =
  | "5k"
  | "10k"
  | "half"
  | "marathon"
  | "trail"
  | "ultra"
  | "tri-sprint"
  | "tri-olympic"
  | "tri-70.3"
  | "tri-ironman"
  | "metric-century"
  | "century"
  | "swim-crossing"
  | "hike";

export interface EventPreset {
  sport: string;
  distanceM: number;
  elevationM?: number;
  name: { en: string; fr: string };
  /** The distance and elevation can be changed (trail, ultra, hike, swim crossing). */
  custom?: boolean;
}

export const EVENTS: Readonly<Record<EventKind, EventPreset>> = {
  "5k": { sport: "run", distanceM: 5000, name: { en: "5K", fr: "5 km" } },
  "10k": { sport: "run", distanceM: 10_000, name: { en: "10K", fr: "10 km" } },
  half: { sport: "run", distanceM: 21_097, name: { en: "Half marathon", fr: "Semi-marathon" } },
  marathon: { sport: "run", distanceM: 42_195, name: { en: "Marathon", fr: "Marathon" } },
  trail: { sport: "run", distanceM: 25_000, elevationM: 1000, name: { en: "Trail race", fr: "Trail" }, custom: true },
  ultra: { sport: "run", distanceM: 80_000, elevationM: 3000, name: { en: "Ultra trail", fr: "Ultra-trail" }, custom: true },
  "tri-sprint": { sport: "swim-bike-run", distanceM: 25_750, name: { en: "Sprint triathlon", fr: "Triathlon S" } },
  "tri-olympic": { sport: "swim-bike-run", distanceM: 51_500, name: { en: "Olympic triathlon", fr: "Triathlon M" } },
  "tri-70.3": { sport: "swim-bike-run", distanceM: 113_000, name: { en: "70.3 (half Ironman)", fr: "70.3 (half Ironman)" } },
  "tri-ironman": { sport: "swim-bike-run", distanceM: 226_000, name: { en: "Ironman", fr: "Ironman" } },
  "metric-century": { sport: "ride", distanceM: 100_000, name: { en: "100 km ride", fr: "Sortie de 100 km" } },
  century: { sport: "ride", distanceM: 160_934, name: { en: "Century ride (160 km)", fr: "Sortie de 160 km" } },
  "swim-crossing": { sport: "open-water", distanceM: 5000, name: { en: "Swim crossing", fr: "Traversée à la nage" }, custom: true },
  hike: { sport: "hike", distanceM: 25_000, elevationM: 1200, name: { en: "Big day hike", fr: "Grande rando" }, custom: true },
};
export const EVENT_KINDS = Object.keys(EVENTS) as EventKind[];
export const isEventKind = (k: unknown): k is EventKind => typeof k === "string" && k in EVENTS;

// ── What the API keeps and sends ────────────────────────────────────────────────────────────────────────────────────

export interface SeasonGoal {
  id: string;
  type: GoalType;
  priority: Priority;
  title?: string;
  sport?: string;
  event?: { kind: EventKind; distanceM: number; elevationM?: number };
  targetTimeS?: number;
  health?: HealthFocus;
  date: string;
  start: string;
  updatedAt?: string;
  doneAt?: string;
  /** The race's result once done (its time, how it felt 1–5). */
  result?: { timeS?: number; feel?: number };
}

export interface SeasonPrefs {
  sports: { sport: string; perWeek: number }[];
  days: number[];
  slots?: Record<string, { start: string; end: string }>;
  minutesPerDay?: number;
  hoursPerWeek?: number;
  longDay?: number;
  horizonWeeks?: number;
}

/** Health flags only: never a condition's name. */
export interface HealthFlags {
  age?: number;
  condition?: boolean;
  cleared?: boolean;
  injury?: boolean;
  effortByFeel?: boolean;
  easyOnly?: boolean;
  lowImpact?: boolean;
}

const goalSchema = z.object({
  id: z.string(),
  type: z.enum(["event", "performance", "health", "free"]),
  priority: z.catch(z.enum(["A", "B", "C"]), "B"),
  title: str,
  sport: str,
  event: opt(z.object({ kind: z.string(), distanceM: z.number(), elevationM: num })),
  targetTimeS: num,
  health: opt(z.enum(["healthy", "weight", "move-daily", "strength"])),
  date: z.string(),
  start: z.string(),
  updatedAt: str,
  doneAt: str,
  result: opt(z.object({ timeS: num, feel: num })),
});

const prefsSchema = z.object({
  sports: list(z.object({ sport: z.string(), perWeek: z.number() })),
  days: list(z.number()),
  slots: opt(z.record(z.string(), z.object({ start: z.string(), end: z.string() }))),
  minutesPerDay: num,
  hoursPerWeek: num,
  longDay: num,
  horizonWeeks: num,
});

const editRowSchema = z.object({ id: z.string(), kind: z.string(), source: str, changeId: str, createdAt: str });

const sessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  day: z.catch(z.number(), 0),
  sport: z.string(),
  minutes: z.number(),
  intensity: z.catch(z.string(), "easy"),
  purpose: str,
  zone: num,
  key: bool,
  phase: str,
  week: num,
  goalId: str,
  raceGoalId: str,
  trainingId: str,
  title: str,
  line: str,
  recipe: str,
  edited: bool,
  note: str,
});
export type SeasonSessionView = z.infer<typeof sessionSchema>;

const weekSchema = z.object({
  index: z.number(),
  start: z.string(),
  phase: z.string(),
  weekInPhase: z.catch(z.number(), 1),
  phaseWeeks: z.catch(z.number(), 1),
  deload: z.catch(z.boolean(), false),
  targetMin: z.catch(z.number(), 0),
  longMin: z.catch(z.number(), 0),
  hard: z.catch(z.number(), 0),
  goalId: str,
  races: list(z.object({ goalId: z.string(), date: z.string(), priority: z.catch(z.string(), "B") })),
  benchmark: z.catch(z.boolean(), false),
  focus: str,
});
export type PlanWeek = z.infer<typeof weekSchema>;

const planSchema = z.object({
  start: z.string(),
  end: z.string(),
  current: z.catch(z.number(), 0),
  free: bool,
  level: str,
  deloadEvery: num,
  mainGoalId: str,
  sports: list(z.object({ sport: z.string(), perWeek: z.number() })),
  phases: list(z.object({ phase: z.string(), startWeek: z.number(), endWeek: z.number(), goalId: str, label: z.catch(z.string(), "") })),
  weeks: list(weekSchema),
});
export type SeasonPlan = z.infer<typeof planSchema>;

const feasibilityTextSchema = z.object({
  headline: z.catch(z.string(), ""),
  reasoning: strings,
  reasons: strings,
  alternatives: strings,
  safety: strings,
});
export type FeasibilityText = z.infer<typeof feasibilityTextSchema>;

/** One alternative the review offers (game-core Alternative); `kind` unknown to this web: shown, not applied. */
const alternativeSchema = z.object({
  kind: z.string(),
  date: str,
  event: str,
  timeS: num,
  hoursPerWeek: num,
});
export type Alternative = z.infer<typeof alternativeSchema>;

const feasibilitySchema = z.object({
  goalId: z.string(),
  verdict: z.catch(z.enum(["realistic", "stretch", "too-risky"]), "stretch"),
  weeksAvailable: num,
  weeksNeeded: num,
  weeksMinimum: num,
  reasoning: opt(z.object({ weeklyHoursNeeded: num, hoursAvailable: num, peakLongMin: num, currentWeeklyMin: num, peakWeeklyMin: num })),
  reasons: strings,
  alternatives: list(alternativeSchema),
  safety: strings,
  readiness: z.catch(z.number(), 0),
});
export type FeasibilityView = z.infer<typeof feasibilitySchema> & { text?: FeasibilityText | null };

const cardSchema = z.object({
  title: z.string(),
  subtitle: str,
  countdown: num,
  phases: list(z.object({ phase: z.string(), label: z.string(), weeks: z.number(), current: z.catch(z.boolean(), false) })),
  progress: z.catch(z.number(), 0),
  readiness: num,
  verdict: str,
  lines: strings,
});
export type SeasonCard = z.infer<typeof cardSchema>;

export const seasonSchema = z.object({
  state: z.object({
    goals: list(goalSchema),
    prefs: z.catch(prefsSchema, { sports: [], days: [] }),
    edits: list(editRowSchema),
    start: str,
    updatedAt: str,
  }),
  health: z.catch(
    z.object({ age: num, condition: bool, cleared: bool, injury: bool, effortByFeel: bool, easyOnly: bool, lowImpact: bool }),
    {},
  ),
  notMedical: str,
  pendingChangeId: str,
  plan: opt(planSchema),
  feasibility: list(z.extend(feasibilitySchema, { text: opt(feasibilityTextSchema) })),
  week: opt(z.extend(weekSchema, { label: str, why: str, sessions: list(sessionSchema) })),
  today: list(sessionSchema),
  goals: list(
    z.object({
      goalId: z.string(),
      name: z.string(),
      days: z.number(),
      phase: str,
      phaseLabel: str,
      readiness: num,
      verdict: str,
      onTrack: bool,
    }),
  ),
  completion: num,
  raceSoon: opt(z.object({ goalId: z.string(), days: z.number(), tips: strings })),
  card: opt(cardSchema),
  recap: str,
});
export type SeasonAnswer = z.infer<typeof seasonSchema>;
export type GoalStatus = SeasonAnswer["goals"][number];
export type SeasonWeekView = NonNullable<SeasonAnswer["week"]>;

export const editReplySchema = z.extend(seasonSchema, { editId: str, line: str });
export const feasibilityReplySchema = z.object({ feasibility: feasibilitySchema, text: feasibilityTextSchema, notMedical: str });
export const reviewReplySchema = z.object({
  feasibility: feasibilitySchema,
  text: feasibilityTextSchema,
  explanation: str,
  source: str,
  notMedical: str,
});
export const auditSchema = z.object({
  entries: list(z.object({ id: str, at: z.string(), actor: z.catch(z.string(), "user"), device: str, kind: z.string(), summary: str })),
});
export type AuditEntry = z.infer<typeof auditSchema>["entries"][number];

/** POST /v1/plan/today's season words (ADR-0050); every field optional: an older API sends none. */
export const todaySchema = z.object({
  suggestion: opt(
    z.object({
      sport: z.string(),
      minutes: num,
      zoneTarget: num,
      purpose: str,
      line: str,
      title: str,
      recipe: str,
      phase: str,
      phaseLabel: str,
      key: bool,
      sessionId: str,
      goal: opt(z.object({ id: str, name: z.string(), days: z.number() })),
    }),
  ),
  reason: str,
  season: opt(z.object({ phase: str, phaseLabel: str, goal: opt(z.object({ id: str, name: z.string(), days: z.number() })) })),
});
export type TodayAnswer = z.infer<typeof todaySchema>;

/** Parse an answer leniently (null when it isn't a season answer at all). */
export function parseSeason(raw: unknown): SeasonAnswer | null {
  const r = z.safeParse(seasonSchema, raw);
  return r.success ? r.data : null;
}

/** The goals as the API keeps them (unknown event kinds dropped from the event). */
export function storedGoals(a: SeasonAnswer): SeasonGoal[] {
  return a.state.goals.map((g) => {
    const out: SeasonGoal = { id: g.id, type: g.type, priority: g.priority, date: g.date, start: g.start };
    if (g.title) out.title = g.title;
    if (g.sport) out.sport = g.sport;
    if (g.event && isEventKind(g.event.kind))
      out.event = { kind: g.event.kind, distanceM: g.event.distanceM, ...(g.event.elevationM ? { elevationM: g.event.elevationM } : {}) };
    if (g.targetTimeS) out.targetTimeS = g.targetTimeS;
    if (g.health) out.health = g.health;
    if (g.updatedAt) out.updatedAt = g.updatedAt;
    if (g.doneAt) out.doneAt = g.doneAt;
    if (g.result && (g.result.timeS || g.result.feel))
      out.result = { ...(g.result.timeS ? { timeS: g.result.timeS } : {}), ...(g.result.feel ? { feel: g.result.feel } : {}) };
    return out;
  });
}

/** The prefs to send back (only the API's fields, nulls dropped). */
export function cleanPrefs(p: SeasonAnswer["state"]["prefs"] | SeasonPrefs): SeasonPrefs {
  const out: SeasonPrefs = {
    sports: p.sports
      .filter((s) => /^[a-z][a-z0-9_-]{1,23}$/.test(s.sport))
      .map((s) => ({ sport: s.sport, perWeek: clampInt(s.perWeek, 1, 7) }))
      .slice(0, 10),
    days: [...new Set(p.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
  };
  if (p.slots) {
    const slots: Record<string, { start: string; end: string }> = {};
    for (const [k, v] of Object.entries(p.slots))
      if (/^[0-6]$/.test(k) && HHMM.test(v.start) && HHMM.test(v.end) && v.start < v.end) slots[k] = v;
    if (Object.keys(slots).length) out.slots = slots;
  }
  if (p.minutesPerDay) out.minutesPerDay = clampInt(p.minutesPerDay, 10, 600);
  if (p.hoursPerWeek) out.hoursPerWeek = Math.min(35, Math.max(1, Math.round(p.hoursPerWeek * 2) / 2));
  if (p.longDay !== undefined && p.longDay !== null && p.longDay >= 0 && p.longDay <= 6) out.longDay = Math.round(p.longDay);
  if (p.horizonWeeks) out.horizonWeeks = clampInt(p.horizonWeeks, 4, 60);
  return out;
}

/** The flags to send (booleans and the age only). */
export function cleanHealth(h: SeasonAnswer["health"] | HealthFlags): HealthFlags {
  const out: HealthFlags = {};
  if (typeof h.age === "number" && h.age >= 13 && h.age <= 100) out.age = Math.round(h.age);
  for (const k of ["condition", "cleared", "injury", "effortByFeel", "easyOnly", "lowImpact"] as const) if (h[k] === true) out[k] = true;
  if (!out.condition) delete out.cleared;
  return out;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

// ── Days ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
/** UTC day number of a `YYYY-MM-DD` (NaN when it isn't one). */
export function dayNum(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : NaN;
}
export const isoOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => isoOf(dayNum(iso) + days);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = (iso: string) => (new Date(dayNum(iso) * DAY_MS).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -weekdayOf(iso));
export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** "171 d" / "171 j", "today", "tomorrow". */
export function countdown(days: number, lang: SeasonLang): string {
  const d = Math.max(0, Math.round(days));
  if (d === 0) return lang === "fr" ? "aujourd’hui" : "today";
  if (d === 1) return lang === "fr" ? "demain" : "tomorrow";
  return lang === "fr" ? `${d} j` : `${d} d`;
}

/** "1 h 10 min", "45 min", "2 h". */
export function duration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

/** "3:45:00" / "52:30" from seconds. */
export function finishTime(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Goals ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A new goal id (`sg` + 10 letters and digits, the API's ^sg[a-z0-9]{4,24}$). */
export function newGoalId(rand: () => number = Math.random): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "sg";
  for (let i = 0; i < 10; i++) s += a[Math.floor(rand() * a.length) % a.length];
  return s;
}

/** What the goal form holds (strings and numbers as typed). */
export interface GoalDraft {
  id: string;
  type: GoalType;
  priority: Priority;
  title: string;
  kind: EventKind;
  distanceKm: number;
  elevationM: number;
  date: string;
  /** Target time, hours and minutes (0 and 0: none). */
  targetH: number;
  targetM: number;
  health: HealthFocus;
  /** Health and free goals: the span in weeks from today. */
  spanWeeks: number;
  start: string;
}

export function emptyDraft(today: string, id: string): GoalDraft {
  return {
    id,
    type: "event",
    priority: "A",
    title: "",
    kind: "10k",
    distanceKm: 10,
    elevationM: 0,
    date: addDays(today, 16 * 7),
    targetH: 0,
    targetM: 0,
    health: "healthy",
    spanWeeks: 13,
    start: today,
  };
}

export function draftOf(g: SeasonGoal, today: string): GoalDraft {
  const kind = g.event?.kind ?? "10k";
  const t = g.targetTimeS ?? 0;
  return {
    id: g.id,
    type: g.type,
    priority: g.priority,
    title: g.title ?? "",
    kind,
    distanceKm: Math.round((g.event?.distanceM ?? EVENTS[kind].distanceM) / 100) / 10,
    elevationM: g.event?.elevationM ?? EVENTS[kind].elevationM ?? 0,
    date: g.date,
    targetH: Math.floor(t / 3600),
    targetM: Math.round((t % 3600) / 60),
    health: g.health ?? "healthy",
    spanWeeks: Math.max(2, Math.round(daysBetween(today, g.date) / 7)),
    start: g.start,
  };
}

/** The goal a draft makes (the API's shape). */
export function goalOf(d: GoalDraft, today: string, nowIso: string): SeasonGoal {
  const g: SeasonGoal = { id: d.id, type: d.type, priority: d.priority, date: d.date, start: d.start || today, updatedAt: nowIso };
  const title = d.title.trim().slice(0, 60);
  if (title) g.title = title;
  if (d.type === "event" || d.type === "performance") {
    const p = EVENTS[d.kind];
    g.sport = p.sport;
    const distanceM = p.custom ? Math.round(d.distanceKm * 1000) : p.distanceM;
    g.event = { kind: d.kind, distanceM, ...(p.custom && d.elevationM > 0 ? { elevationM: Math.round(d.elevationM) } : {}) };
    const t = Math.round(d.targetH) * 3600 + Math.round(d.targetM) * 60;
    if (t >= 60) g.targetTimeS = t;
  } else {
    g.date = addDays(today, Math.round(d.spanWeeks) * 7);
    if (dayNum(g.start) > dayNum(today)) g.start = today;
    if (d.type === "health") g.health = d.health;
  }
  return g;
}

export type GoalProblem = "no-date" | "date-past" | "too-far" | "bad-distance" | "bad-time" | "bad-span";

/** What's wrong with a goal before it's sent (game-core seasonGoalProblems). */
export function goalProblems(g: SeasonGoal, today: string): GoalProblem[] {
  const d = dayNum(g.date);
  if (!Number.isFinite(d)) return ["no-date"];
  const out: GoalProblem[] = [];
  if (d < dayNum(today) && !g.doneAt) out.push("date-past");
  if (d - dayNum(today) > SEASON_MAX_WEEKS * 7 + 6) out.push("too-far");
  if (g.type === "event" || g.type === "performance") {
    const e = g.event;
    if (
      !e ||
      !(e.distanceM >= 100 && e.distanceM <= 400_000) ||
      (e.elevationM !== undefined && !(e.elevationM >= 0 && e.elevationM <= 15_000))
    )
      out.push("bad-distance");
    if (g.type === "performance" && !(g.targetTimeS && g.targetTimeS >= 60 && g.targetTimeS <= 72 * 3600)) out.push("bad-time");
  }
  if ((g.type === "health" || g.type === "free") && daysBetween(g.start, g.date) < 13) out.push("bad-span");
  return out;
}

/** The goal's name when the API's answer doesn't have it yet (a draft): its title, else the event or the focus. */
export function goalName(
  g: Pick<SeasonGoal, "title" | "type" | "event" | "health">,
  lang: SeasonLang,
  words: { free: string; health: Record<HealthFocus, string> },
) {
  if (g.title) return g.title;
  if (g.event) return EVENTS[g.event.kind].name[lang];
  if (g.type === "health") return words.health[g.health ?? "healthy"];
  return words.free;
}

/**
 * What applying a review's alternative changes: the goal (a later date, a shorter distance, a time, B priority), a new
 * goal first (the intermediate step), the weekly hours, or the doctor's go-ahead flag. Null: nothing this web applies.
 */
export function applyAlternative(
  goal: SeasonGoal,
  alt: Alternative,
  o: { prefs: SeasonPrefs; health: HealthFlags; nowIso: string; today: string; newId: string },
): { goals: SeasonGoal[]; prefs?: SeasonPrefs; health?: HealthFlags } | null {
  const changed = (g: SeasonGoal) => ({ ...g, updatedAt: o.nowIso });
  switch (alt.kind) {
    case "later-date":
      return alt.date && Number.isFinite(dayNum(alt.date)) ? { goals: [changed({ ...goal, date: alt.date })] } : null;
    case "shorter": {
      if (!isEventKind(alt.event)) return null;
      const p = EVENTS[alt.event];
      const g: SeasonGoal = {
        ...goal,
        sport: p.sport,
        event: { kind: alt.event, distanceM: p.distanceM, ...(p.elevationM ? { elevationM: p.elevationM } : {}) },
      };
      // The athlete's own name was for the longer race; a time for it no longer holds.
      delete g.title;
      delete g.targetTimeS;
      if (g.type === "performance") g.type = "event";
      return { goals: [changed(g)] };
    }
    case "intermediate": {
      if (!isEventKind(alt.event) || !alt.date) return null;
      const p = EVENTS[alt.event];
      const step: SeasonGoal = {
        id: o.newId,
        type: "event",
        priority: "B",
        sport: p.sport,
        event: { kind: alt.event, distanceM: p.distanceM, ...(p.elevationM ? { elevationM: p.elevationM } : {}) },
        date: alt.date,
        start: o.today,
        updatedAt: o.nowIso,
      };
      return { goals: [step] };
    }
    case "target-time":
      return alt.timeS ? { goals: [changed({ ...goal, targetTimeS: Math.round(alt.timeS) })] } : null;
    case "finish-goal": {
      const g = { ...goal };
      delete g.targetTimeS;
      if (g.type === "performance") g.type = "event";
      return { goals: [changed(g)] };
    }
    case "more-hours":
      return alt.hoursPerWeek ? { goals: [], prefs: { ...o.prefs, hoursPerWeek: Math.min(35, Math.max(1, alt.hoursPerWeek)) } } : null;
    case "make-b":
      return { goals: [changed({ ...goal, priority: "B" })] };
    case "clearance":
      return { goals: [], health: { ...o.health, condition: true, cleared: true } };
    default:
      return null;
  }
}

// ── The week and its edits ──────────────────────────────────────────────────────────────────────────────────────────

/** The week's sessions by day, Monday first (sessions of another week dropped). */
export function byDay(sessions: readonly SeasonSessionView[], monday: string): { date: string; sessions: SeasonSessionView[] }[] {
  return weekDates(monday).map((date) => ({ date, sessions: sessions.filter((s) => s.date === date) }));
}

/** The change "Undo" takes back: the newest one (an approved coach change undoes all its edits at once). */
export function lastUndo(edits: SeasonAnswer["state"]["edits"]): { kind: "edit" | "change"; id: string } | null {
  if (!edits.length) return null;
  const newest = [...edits].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || 0).at(-1)!;
  return newest.changeId ? { kind: "change", id: newest.changeId } : { kind: "edit", id: newest.id };
}

export type EditDraft =
  | { kind: "move"; session: string; to: string }
  | { kind: "swap"; a: string; b: string }
  | { kind: "off"; date: string; reason?: "travel" | "busy" | "rest" }
  | { kind: "easier"; week: string }
  | { kind: "add"; date: string; sport: string; minutes: number; intensity?: Intensity }
  | { kind: "remove"; session: string }
  | { kind: "change"; session: string; sport?: string; minutes?: number; intensity?: Intensity };

/** Can this day still be changed? (today and later; the API refuses days over a week old). */
export const editable = (date: string, today: string) => dayNum(date) >= dayNum(today);

// ── The timeline ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Timeline {
  weeks: number;
  /** Fractions of the whole width (0–1). */
  segments: { phase: string; label: string; left: number; width: number; from: string; to: string; weeks: number; current: boolean }[];
  races: { goalId: string; date: string; priority: string; at: number }[];
  benchmarks: { index: number; at: number; start: string }[];
  /** Each week's planned minutes against the biggest week (the volume bars). */
  bars: { index: number; phase: string; value: number; minutes: number; deload: boolean; current: boolean; start: string }[];
  today: number;
  current: number;
  /** First days of months inside the plan, for the axis. */
  months: { date: string; at: number }[];
}

export function timeline(plan: SeasonPlan, today: string, maxMonths = 7): Timeline {
  const n = Math.max(1, plan.weeks.length, ...plan.phases.map((p) => p.endWeek + 1));
  const days = n * 7;
  const at = (iso: string) => Math.min(1, Math.max(0, daysBetween(plan.start, iso) / days));
  const weekStart = (i: number) => addDays(plan.start, i * 7);
  const segments = plan.phases.map((p) => ({
    phase: p.phase,
    label: p.label,
    left: p.startWeek / n,
    width: (p.endWeek - p.startWeek + 1) / n,
    from: weekStart(p.startWeek),
    to: addDays(weekStart(p.endWeek), 6),
    weeks: p.endWeek - p.startWeek + 1,
    current: plan.current >= p.startWeek && plan.current <= p.endWeek,
  }));
  const races = plan.weeks.flatMap((w) => w.races.map((r) => ({ goalId: r.goalId, date: r.date, priority: r.priority, at: at(r.date) })));
  const benchmarks = plan.weeks.filter((w) => w.benchmark).map((w) => ({ index: w.index, at: (w.index + 0.5) / n, start: w.start }));
  const top = Math.max(1, ...plan.weeks.map((w) => w.targetMin));
  const bars = plan.weeks.map((w) => ({
    index: w.index,
    phase: w.phase,
    value: w.targetMin / top,
    minutes: w.targetMin,
    deload: w.deload,
    current: w.index === plan.current,
    start: w.start,
  }));
  let months: { date: string; at: number }[] = [];
  const s = dayNum(plan.start);
  const first = new Date(s * DAY_MS);
  for (let k = 1; ; k++) {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + k, 1));
    const iso = d.toISOString().slice(0, 10);
    if (dayNum(iso) - s >= days) break;
    months.push({ date: iso, at: at(iso) });
  }
  if (months.length > maxMonths) {
    const step = Math.ceil(months.length / maxMonths);
    months = months.filter((_, i) => i % step === 0);
  }
  return { weeks: n, segments, races, benchmarks, bars, today: at(today), current: plan.current, months };
}

/** The phase colour (the app's tones): base sky, build volt, peak pulse, taper lilac, race butter, recovery mint. */
export const PHASE_TONE: Record<Phase, "sky" | "volt" | "pulse" | "lilac" | "butter" | "mint"> = {
  base: "sky",
  build: "volt",
  peak: "pulse",
  taper: "lilac",
  race: "butter",
  recovery: "mint",
};
export const phaseTone = (p: string) => PHASE_TONE[(PHASES as readonly string[]).includes(p) ? (p as Phase) : "base"];
/** The same colours as hex, for the share image (globals.css @theme). */
export const PHASE_HEX: Record<Phase, string> = {
  base: "#7fb6f5",
  build: "#ccff00",
  peak: "#ff3d6e",
  taper: "#b9a7f5",
  race: "#f5e27a",
  recovery: "#7fe0c8",
};

export const verdictTone = (v: string | null | undefined) => (v === "realistic" ? "mint" : v === "too-risky" ? "down" : "butter");

/** The text of the shared season card (no health data: the goal, the countdown, the phases, readiness). */
export function shareText(card: SeasonCard, words: { daysToGo: string; readiness: string }, url: string): string {
  const parts = [card.title];
  if (card.subtitle) parts.push(card.subtitle);
  if (card.countdown !== null && card.countdown !== undefined) parts.push(words.daysToGo.replace("{n}", String(card.countdown)));
  const now = card.phases.find((p) => p.current);
  if (now) parts.push(now.label);
  if (typeof card.readiness === "number") parts.push(words.readiness.replace("{n}", String(card.readiness)));
  return `${parts.join(" · ")}\n${url}`;
}

// ── Zoom: a month, a quarter, half a year or a year of the plan ─────────────────────────────────────────────────────

export type Scale = "month" | "quarter" | "half" | "year";
export const SCALES: readonly Scale[] = ["month", "quarter", "half", "year"];
export const SCALE_WEEKS: Record<Scale, number> = { month: 5, quarter: 13, half: 26, year: 52 };

/** The scale that shows the whole plan (the smallest one it fits in). */
export function fitScale(weeks: number): Scale {
  return SCALES.find((s) => SCALE_WEEKS[s] >= weeks) ?? "year";
}

/**
 * The plan seen through a window of `weeks` weeks: from the week before this one (so the past shows a little), moved
 * back when the window would run past the plan's end. Weeks and phases are cut to the window and numbered from it; the
 * whole plan when it fits.
 */
export function windowPlan(plan: SeasonPlan, weeks: number): SeasonPlan & { offset: number } {
  const n = plan.weeks.length;
  if (n <= weeks) return { ...plan, offset: 0 };
  const from = Math.max(0, Math.min(n - weeks, plan.current - 1));
  const to = from + weeks - 1;
  const inside = plan.weeks.filter((w) => w.index >= from && w.index <= to).map((w) => ({ ...w, index: w.index - from }));
  const phases = plan.phases
    .filter((p) => p.endWeek >= from && p.startWeek <= to)
    .map((p) => ({ ...p, startWeek: Math.max(p.startWeek, from) - from, endWeek: Math.min(p.endWeek, to) - from }));
  return {
    ...plan,
    start: addDays(plan.start, from * 7),
    end: addDays(plan.start, (to + 1) * 7 - 1),
    current: plan.current - from,
    weeks: inside,
    phases,
    offset: from,
  };
}

/** "1:52:30", "52:30" or "3h45" → seconds (null when it isn't a time). */
export function parseTime(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const h = /^(\d{1,2})h(\d{1,2})?$/.exec(t);
  if (h) return Number(h[1]) * 3600 + Number(h[2] ?? 0) * 60 || null;
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const n = parts.map(Number);
  const [a, b, c] = n.length === 3 ? n : [0, n[0]!, n[1]!];
  if (b! > 59 || c! > 59) return null;
  const sec = a! * 3600 + b! * 60 + c!;
  return sec >= 1 && sec <= 72 * 3600 ? sec : null;
}

/** The goals whose race day has passed and that aren't marked done yet (the "how did it go?" card). */
export function passedRaces(goals: readonly SeasonGoal[], today: string): SeasonGoal[] {
  return goals.filter((g) => !g.doneAt && g.event && (g.type === "event" || g.type === "performance") && dayNum(g.date) < dayNum(today));
}
