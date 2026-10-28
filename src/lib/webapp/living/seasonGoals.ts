// Copied from VVFit packages/game-core/src/seasonGoals.ts (8e89c1f3 2026-10-22) by scripts/sync-living-core.ts. Do not edit: re-sync.
/**
 * Season goals (ADR-0050, docs/02-product/season-plans.md): what the athlete trains toward, one or several, each with a
 * priority. Four types:
 * - `event`: a race or a distance on a date (10K, half, marathon, ultra trail with distance and elevation, sprint /
 *   olympic / 70.3 / Ironman triathlon, century ride, swim crossing, a big hike);
 * - `performance`: a time on a distance by a date ("10 km in 50 min by June");
 * - `health`: stay healthy, lose weight safely, move daily, get stronger, over a span;
 * - `free`: free training over a span (no race): healthy, varied, progressing.
 * Priority A drives the periodisation (peak and taper for it); B races get a short taper and count as training races;
 * C races are hard sessions in the plan.
 *
 * Dates are local calendar days, `YYYY-MM-DD`; every computation here works on whole days (UTC day numbers), so the
 * phone, the Worker, the web and the watches agree whatever their time zone. Pure.
 */

export type SeasonGoalType = "event" | "performance" | "health" | "free";
export type GoalPriority = "A" | "B" | "C";
export type HealthFocus = "healthy" | "weight" | "move-daily" | "strength";
export type SeasonLang = "en" | "fr";

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

export interface EventSpec {
  kind: EventKind;
  /** Total distance (a triathlon: the three legs together). */
  distanceM: number;
  /** Positive elevation (trail, ultra, hike), metres. */
  elevationM?: number;
}

export interface SeasonGoal {
  /** Stable id (`sg…`), the same on every device. */
  id: string;
  type: SeasonGoalType;
  priority: GoalPriority;
  /** The athlete's own name for it ("Paris Marathon"). Never a health condition (the API refuses one). */
  title?: string;
  /** The goal's sport (catalog id: run, ride, swim, open-water, hike, swim-bike-run), event and performance goals. */
  sport?: string;
  event?: EventSpec;
  /** performance (or an event with a time in mind): the finish time aimed for, seconds. */
  targetTimeS?: number;
  /** health goals. */
  health?: HealthFocus;
  /** Event and performance: the day. Health and free: the last day of the span. */
  date: string;
  /** When the goal was set (the start of its span). */
  start: string;
  /** Last change (ISO), newest wins across devices. */
  updatedAt?: string;
  /** The race is done (or the goal finished): the plan moves on to recovery. */
  doneAt?: string;
  /** How it went, typed by the athlete after the race. */
  result?: { timeS?: number; feel?: 1 | 2 | 3 | 4 | 5 };
}

/** What a coach knows about each event (see the principles in docs/02-product/season-plans.md §3). */
export interface EventPreset {
  kind: EventKind;
  sport: string;
  distanceM: number;
  elevationM?: number;
  /** Triathlon legs (m). */
  legs?: { swim: number; bike: number; run: number };
  name: { en: string; fr: string };
  /** Weekly training at the peak to finish it well, minutes: [first-timer, competitive]. */
  peakWeekly: [number, number];
  /** Longest session at the peak, minutes: [first-timer, competitive] (the long run, the long ride, the long swim). */
  peakLong: [number, number];
  /** Shortest specific build (build + peak), weeks, even when the volume is already there. */
  specificWeeks: number;
  /** A sensible full preparation for a beginner with no base, weeks (floor for "realistic" from zero). */
  fromZeroWeeks: number;
  /** The fewest weeks a from-zero beginner can do it in with the fastest safe ramp ("stretch"). */
  fromZeroMinWeeks: number;
  taperDays: number;
  recoveryDays: number;
  /** A shorter event of the same kind, for an intermediate goal or a shorter distance. */
  shorter?: EventKind;
  /** Needs a shorter one done first (or a long base) to be realistic at all. */
  prerequisite?: EventKind;
}

const P = (p: EventPreset) => p;

/**
 * The presets. Peak volumes and long sessions are the middle of what mainstream plans prescribe (Higdon, Pfitzinger,
 * Daniels for running; Friel for triathlon and cycling; Koop for ultra), shown as time so every sport compares.
 */
export const EVENT_PRESETS: Readonly<Record<EventKind, EventPreset>> = {
  "5k": P({
    kind: "5k",
    sport: "run",
    distanceM: 5000,
    name: { en: "5K", fr: "5 km" },
    peakWeekly: [100, 240],
    peakLong: [40, 70],
    specificWeeks: 4,
    fromZeroWeeks: 9,
    fromZeroMinWeeks: 6,
    taperDays: 7,
    recoveryDays: 4,
  }),
  "10k": P({
    kind: "10k",
    sport: "run",
    distanceM: 10_000,
    name: { en: "10K", fr: "10 km" },
    peakWeekly: [140, 300],
    peakLong: [65, 90],
    specificWeeks: 6,
    fromZeroWeeks: 14,
    fromZeroMinWeeks: 10,
    taperDays: 7,
    recoveryDays: 7,
    shorter: "5k",
  }),
  half: P({
    kind: "half",
    sport: "run",
    distanceM: 21_097,
    name: { en: "half marathon", fr: "semi-marathon" },
    peakWeekly: [210, 400],
    peakLong: [110, 130],
    specificWeeks: 8,
    fromZeroWeeks: 24,
    fromZeroMinWeeks: 18,
    taperDays: 10,
    recoveryDays: 14,
    shorter: "10k",
  }),
  marathon: P({
    kind: "marathon",
    sport: "run",
    distanceM: 42_195,
    name: { en: "marathon", fr: "marathon" },
    peakWeekly: [300, 540],
    peakLong: [165, 180],
    specificWeeks: 12,
    fromZeroWeeks: 40,
    fromZeroMinWeeks: 30,
    taperDays: 21,
    recoveryDays: 28,
    shorter: "half",
    prerequisite: "half",
  }),
  trail: P({
    kind: "trail",
    sport: "run",
    distanceM: 25_000,
    elevationM: 1000,
    name: { en: "trail race", fr: "trail" },
    peakWeekly: [240, 480],
    peakLong: [150, 180],
    specificWeeks: 10,
    fromZeroWeeks: 28,
    fromZeroMinWeeks: 20,
    taperDays: 10,
    recoveryDays: 14,
    shorter: "10k",
  }),
  ultra: P({
    kind: "ultra",
    sport: "run",
    distanceM: 80_000,
    elevationM: 3000,
    name: { en: "ultra trail", fr: "ultra-trail" },
    peakWeekly: [420, 720],
    peakLong: [300, 360],
    specificWeeks: 16,
    fromZeroWeeks: 60,
    fromZeroMinWeeks: 44,
    taperDays: 21,
    recoveryDays: 42,
    shorter: "marathon",
    prerequisite: "marathon",
  }),
  "tri-sprint": P({
    kind: "tri-sprint",
    sport: "swim-bike-run",
    distanceM: 25_750,
    legs: { swim: 750, bike: 20_000, run: 5000 },
    name: { en: "sprint triathlon", fr: "triathlon S" },
    peakWeekly: [210, 420],
    peakLong: [70, 90],
    specificWeeks: 6,
    fromZeroWeeks: 14,
    fromZeroMinWeeks: 10,
    taperDays: 7,
    recoveryDays: 5,
  }),
  "tri-olympic": P({
    kind: "tri-olympic",
    sport: "swim-bike-run",
    distanceM: 51_500,
    legs: { swim: 1500, bike: 40_000, run: 10_000 },
    name: { en: "olympic triathlon", fr: "triathlon M" },
    peakWeekly: [330, 600],
    peakLong: [120, 150],
    specificWeeks: 8,
    fromZeroWeeks: 24,
    fromZeroMinWeeks: 18,
    taperDays: 10,
    recoveryDays: 10,
    shorter: "tri-sprint",
  }),
  "tri-70.3": P({
    kind: "tri-70.3",
    sport: "swim-bike-run",
    distanceM: 113_000,
    legs: { swim: 1900, bike: 90_000, run: 21_100 },
    name: { en: "70.3 (half Ironman)", fr: "70.3 (half Ironman)" },
    peakWeekly: [540, 780],
    peakLong: [210, 240],
    specificWeeks: 12,
    fromZeroWeeks: 40,
    fromZeroMinWeeks: 32,
    taperDays: 14,
    recoveryDays: 21,
    shorter: "tri-olympic",
    prerequisite: "tri-olympic",
  }),
  "tri-ironman": P({
    kind: "tri-ironman",
    sport: "swim-bike-run",
    distanceM: 226_000,
    legs: { swim: 3800, bike: 180_000, run: 42_200 },
    name: { en: "Ironman", fr: "Ironman" },
    peakWeekly: [720, 1080],
    peakLong: [330, 390],
    specificWeeks: 16,
    fromZeroWeeks: 60,
    fromZeroMinWeeks: 44,
    taperDays: 21,
    recoveryDays: 42,
    shorter: "tri-70.3",
    prerequisite: "tri-70.3",
  }),
  "metric-century": P({
    kind: "metric-century",
    sport: "ride",
    distanceM: 100_000,
    name: { en: "100 km ride", fr: "sortie de 100 km" },
    peakWeekly: [240, 480],
    peakLong: [210, 240],
    specificWeeks: 6,
    fromZeroWeeks: 14,
    fromZeroMinWeeks: 10,
    taperDays: 7,
    recoveryDays: 5,
  }),
  century: P({
    kind: "century",
    sport: "ride",
    distanceM: 160_934,
    name: { en: "century ride (160 km)", fr: "sortie de 160 km" },
    peakWeekly: [360, 600],
    peakLong: [330, 390],
    specificWeeks: 8,
    fromZeroWeeks: 20,
    fromZeroMinWeeks: 14,
    taperDays: 7,
    recoveryDays: 7,
    shorter: "metric-century",
  }),
  "swim-crossing": P({
    kind: "swim-crossing",
    sport: "open-water",
    distanceM: 5000,
    name: { en: "swim crossing", fr: "traversée à la nage" },
    peakWeekly: [200, 420],
    peakLong: [100, 120],
    specificWeeks: 8,
    fromZeroWeeks: 24,
    fromZeroMinWeeks: 16,
    taperDays: 7,
    recoveryDays: 7,
  }),
  hike: P({
    kind: "hike",
    sport: "hike",
    distanceM: 25_000,
    elevationM: 1200,
    name: { en: "big day hike", fr: "grande rando" },
    peakWeekly: [240, 420],
    peakLong: [300, 420],
    specificWeeks: 6,
    fromZeroWeeks: 12,
    fromZeroMinWeeks: 8,
    taperDays: 7,
    recoveryDays: 4,
  }),
};

export const EVENT_KINDS = Object.keys(EVENT_PRESETS) as EventKind[];

/**
 * An event's "effort distance": km plus elevation (ITRA's km-effort, 100 m up = 1 km), so a 50 km trail with 3000 m
 * up weighs like 80 flat km. Swims weigh 4× (a 5 km swim is a long day), rides a third.
 */
export function effortKm(e: Pick<EventSpec, "distanceM" | "elevationM">, sport: string): number {
  const km = e.distanceM / 1000 + (e.elevationM ?? 0) / 100;
  if (sport === "swim" || sport === "open-water") return km * 4;
  if (sport === "ride") return km / 3;
  return km;
}

/**
 * The preset, scaled to the real distance and elevation for trail, ultra, hike and swim crossings (a 120 km ultra is
 * not an 80 km one): volume and the shortest preparation grow with the square root of the effort distance, the long
 * session with it up to its cap.
 */
export function presetFor(e: EventSpec): EventPreset {
  const base = EVENT_PRESETS[e.kind];
  if (!["trail", "ultra", "hike", "swim-crossing"].includes(e.kind)) return base;
  const ref = effortKm(base, base.sport);
  const mine = effortKm(e, base.sport);
  if (!(mine > 0) || !(ref > 0)) return base;
  const f = Math.sqrt(mine / ref);
  const clampF = Math.min(1.6, Math.max(0.6, f));
  const scale2 = (x: [number, number], cap: number): [number, number] => [
    Math.min(cap, Math.round(x[0] * clampF)),
    Math.min(cap, Math.round(x[1] * clampF)),
  ];
  return {
    ...base,
    distanceM: e.distanceM,
    ...(e.elevationM !== undefined ? { elevationM: e.elevationM } : {}),
    peakWeekly: scale2(base.peakWeekly, 1200),
    peakLong: scale2(base.peakLong, e.kind === "hike" ? 540 : 420),
    specificWeeks: Math.round(base.specificWeeks * Math.min(1.3, Math.max(0.8, clampF))),
    fromZeroWeeks: Math.round(base.fromZeroWeeks * Math.min(1.4, Math.max(0.8, clampF))),
    fromZeroMinWeeks: Math.round(base.fromZeroMinWeeks * Math.min(1.4, Math.max(0.8, clampF))),
  };
}

/** The nearest preset for a sport and a distance (custom distances): runs by distance, rides, swims, hikes. */
export function eventKindFor(sport: string, distanceM: number, elevationM = 0): EventKind {
  if (sport === "swim-bike-run")
    return distanceM <= 30_000 ? "tri-sprint" : distanceM <= 60_000 ? "tri-olympic" : distanceM <= 130_000 ? "tri-70.3" : "tri-ironman";
  if (sport === "ride") return distanceM <= 120_000 ? "metric-century" : "century";
  if (sport === "swim" || sport === "open-water") return "swim-crossing";
  if (sport === "hike" || sport === "walk") return "hike";
  if (distanceM > 43_000) return "ultra";
  if (elevationM >= 500 && distanceM >= 12_000) return "trail";
  if (distanceM > 22_000) return "marathon";
  if (distanceM > 11_000) return "half";
  if (distanceM > 5_500) return "10k";
  return "5k";
}

// ── Days ────────────────────────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` → days since 1970-01-01 (NaN when malformed). */
export function dayNum(iso: string): number {
  const m = ISO.exec(iso);
  if (!m) return NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** Days since 1970-01-01 → `YYYY-MM-DD`. */
export function isoOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const addDays = (iso: string, n: number) => isoOf(dayNum(iso) + n);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);

/** 0 = Monday … 6 = Sunday (plan.ts Weekday). */
export const weekdayOf = (iso: string) => (((dayNum(iso) + 3) % 7) + 7) % 7;

/** The Monday of the week holding `iso`. */
export const mondayOf = (iso: string) => addDays(iso, -weekdayOf(iso));

/** A local `YYYY-MM-DD` from a time in ms and an offset (minutes east of UTC), or the device's own zone. */
export function localIso(ms: number, tzOffsetMin?: number): string {
  if (tzOffsetMin !== undefined) return new Date(ms + tzOffsetMin * 60_000).toISOString().slice(0, 10);
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS: Record<SeasonLang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
};

export const monthName = (iso: string, lang: SeasonLang) => MONTHS[lang][Number(iso.slice(5, 7)) - 1] ?? "";

/** "12 August 2027" / "12 août 2027". */
export function longDate(iso: string, lang: SeasonLang): string {
  const d = Number(iso.slice(8, 10));
  return lang === "fr"
    ? `${d === 1 ? "1er" : d} ${monthName(iso, "fr")} ${iso.slice(0, 4)}`
    : `${d} ${monthName(iso, "en")} ${iso.slice(0, 4)}`;
}

const HEALTH_NAME: Record<HealthFocus, { en: string; fr: string }> = {
  healthy: { en: "Stay healthy", fr: "Rester en forme" },
  weight: { en: "Lose weight safely", fr: "Perdre du poids en douceur" },
  "move-daily": { en: "Move every day", fr: "Bouger chaque jour" },
  strength: { en: "Get stronger", fr: "Devenir plus fort" },
};

export const eventName = (k: EventKind, lang: SeasonLang) => EVENT_PRESETS[k].name[lang];

/** Seconds → "1:45:00" or "48:30". */
export function finishTime(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

const kmText = (m: number, lang: SeasonLang) => {
  const k = m / 1000;
  const v = Number.isInteger(k) ? String(k) : k.toFixed(1);
  return lang === "fr" ? `${v.replace(".", ",")} km` : `${v} km`;
};

/** The goal's name as the app shows it: the athlete's title, else "Marathon · 12 April 2027", "Stay healthy". */
export function seasonGoalName(g: SeasonGoal, lang: SeasonLang): string {
  if (g.title?.trim()) return g.title.trim();
  if (g.type === "health") return HEALTH_NAME[g.health ?? "healthy"][lang];
  if (g.type === "free") return lang === "fr" ? "Entraînement libre" : "Free training";
  const e = g.event;
  const base = e
    ? e.kind === "ultra" || e.kind === "trail"
      ? `${eventName(e.kind, lang)} ${kmText(e.distanceM, lang)}`
      : eventName(e.kind, lang)
    : lang === "fr"
      ? "Objectif"
      : "Goal";
  const time = g.targetTimeS ? (lang === "fr" ? ` en ${finishTime(g.targetTimeS)}` : ` in ${finishTime(g.targetTimeS)}`) : "";
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  return `${cap}${time}`;
}

/** "your August 10K" / "ton 10 km d'août", for the purpose line of a session. */
export function goalShortRef(g: SeasonGoal, lang: SeasonLang): string {
  if (g.type === "health" || g.type === "free")
    return lang === "fr"
      ? `ton objectif « ${seasonGoalName(g, "fr").toLowerCase()} »`
      : `your goal to ${seasonGoalName(g, "en").toLowerCase()}`;
  const month = monthName(g.date, lang);
  const name = g.title?.trim() || (g.event ? eventName(g.event.kind, lang) : lang === "fr" ? "objectif" : "goal");
  if (lang === "fr") {
    const vowel = /^[aeiouyéèêàâîôûh]/i.test(month);
    return `ton ${name} ${vowel ? "d'" : "de "}${month}`;
  }
  return `your ${month} ${name}`;
}

/** A fresh goal id. */
export const newSeasonGoalId = (nowMs = Date.now(), rand = Math.random()) =>
  `sg${nowMs.toString(36)}${Math.floor(rand * 1e8).toString(36)}`;

export type SeasonGoalProblem = "no-date" | "date-past" | "too-far" | "no-event" | "bad-distance" | "bad-time" | "no-health" | "bad-span";

/** The most a plan looks ahead (a year and a little). */
export const SEASON_MAX_WEEKS = 60;

/** What's wrong with a goal before it's saved (none: an empty list). `today` is the athlete's local day. Pure. */
export function seasonGoalProblems(g: SeasonGoal, today: string): SeasonGoalProblem[] {
  const out: SeasonGoalProblem[] = [];
  const d = dayNum(g.date);
  if (!Number.isFinite(d)) return ["no-date"];
  if (d < dayNum(today) && !g.doneAt) out.push("date-past");
  if (d - dayNum(today) > SEASON_MAX_WEEKS * 7 + 6) out.push("too-far");
  if (g.type === "event" || g.type === "performance") {
    if (!g.event) out.push("no-event");
    else if (
      !(g.event.distanceM >= 100 && g.event.distanceM <= 400_000) ||
      (g.event.elevationM !== undefined && !(g.event.elevationM >= 0 && g.event.elevationM <= 15_000))
    )
      out.push("bad-distance");
    if (g.type === "performance" && !(g.targetTimeS && g.targetTimeS >= 60 && g.targetTimeS <= 72 * 3600)) out.push("bad-time");
  }
  if (g.type === "health" && !g.health) out.push("no-health");
  if ((g.type === "health" || g.type === "free") && daysBetween(g.start, g.date) < 13) out.push("bad-span");
  return out;
}

/** Goals in date order, A before B before C on the same day; finished ones last. */
export function sortSeasonGoals(goals: readonly SeasonGoal[]): SeasonGoal[] {
  return [...goals].sort(
    (a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || dayNum(a.date) - dayNum(b.date) || a.priority.localeCompare(b.priority),
  );
}

/** Newest wins, per goal id (sync between devices): deleted ids stay deleted. Pure. */
export function mergeSeasonGoals(
  local: readonly SeasonGoal[],
  remote: readonly SeasonGoal[],
  deleted: readonly string[] = [],
): SeasonGoal[] {
  const by = new Map<string, SeasonGoal>();
  for (const g of [...remote, ...local]) {
    if (deleted.includes(g.id)) continue;
    const had = by.get(g.id);
    if (!had || (g.updatedAt ?? "") > (had.updatedAt ?? "")) by.set(g.id, g);
  }
  return sortSeasonGoals([...by.values()]);
}
