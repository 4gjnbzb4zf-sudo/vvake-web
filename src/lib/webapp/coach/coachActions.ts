// Copied from VVFit packages/game-core/src/coachActions.ts (bcd38837 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
/**
 * The coach's app actions (build 55, founder bug: the coach said "I started your workout" and nothing started).
 *
 * One typed catalog shared by the API, the phone, the web and the watches (as COACH_SCREENS is). The coach never does
 * anything itself: it returns ONE action from this catalog, the app shows a one-tap confirm card ("Start Run · 30 min
 * easy · [Start] [Not now]"), runs it, and only then says what really happened ("Run started." or why it could not).
 *
 * Rules (ADR-0063):
 * - Every action that starts or changes something waits for the athlete's tap on the card. A spoken "yes" counts only
 *   in a live call, with the card on screen (`spokenConfirm`).
 * - Nothing auto-starts during a workout (`gateCoachAction` says `in_workout`).
 * - Quiet (ADR-0062) never blocks an action the athlete asked for: these are answers, not suggestions.
 * - The coach never claims an action the app did not confirm (`claimsDone`, `honestReply`), on the server and in the
 *   apps' scripted fallbacks.
 *
 * Pure. The watches don't copy the words: the server sends the card and the result lines with each action (`lines`).
 */
import { CAMERA_ROUTINES } from "../camera/cameraSession";
import { COACH_SCREENS, coachScreen } from "./coachScreens";
import { SPORT_KEYS, sportName } from "../living/sportCatalog";
import { PAUSE_KINDS, PAUSE_MAX_DAYS, type PauseKind } from "../living/streakCare";
import {
  cleanMealItem,
  cleanTerms,
  DIET_NAMES,
  DIET_STYLES,
  NUTRITION_GOAL_NAMES,
  NUTRITION_GOALS,
  type DietStyle,
  type MealItem,
  type NutritionGoal,
} from "../nutrition/nutrition";

/**
 * The catalog version an app speaks (POST /v1/coach/talk and /live/turn `actions`): 2 = the build-55 kinds, 3 = the
 * build-60 kinds (ADR-0068), 4 = the Nutrition kinds (review_meal, suggest_meals, plan_meals, update_nutrition, and
 * log_meal's photo / items; ADR-0070). The API offers a kind only to apps that speak its version.
 */
export const COACH_ACTIONS_VERSION = 4;
/** The kinds of version 4 (Nutrition): offered only when Nutrition is on for the account. */
export const NUTRITION_ACTION_KINDS = ["review_meal", "suggest_meals", "plan_meals", "update_nutrition"] as const;

type Lang = "en" | "fr";

/** Every action the coach may return, by name. */
export const COACH_ACTION_KINDS = [
  "start_workout",
  "start_camera_workout",
  "start_daily_move",
  "log_habit",
  "set_reminder",
  "add_to_calendar",
  "pause_streak",
  "open_screen",
  // Super coach (build 60, ADR-0068): voice-first actions.
  "log_meal",
  "correct_data",
  "control_workout",
  "music",
  "show_places",
  "show_summary",
  // Nutrition (build 62, ADR-0070): only when Nutrition is on.
  "review_meal",
  "suggest_meals",
  "plan_meals",
  "update_nutrition",
] as const;
export type CoachActionKind = (typeof COACH_ACTION_KINDS)[number];

/** Where an action runs: `run` on this device, `handoff` = "Open on your phone", `none` = not offered there. */
export type ActionSupport = "run" | "handoff" | "none";
export type ActionDevice = "phone" | "web" | "watch";

export interface CoachActionSpec {
  kind: CoachActionKind;
  /** Starts or changes something: a one-tap confirm card first. open_screen is only a button (nothing changes). */
  confirm: boolean;
  /** Per device. The phone runs everything; the web and the watches run what they can and hand off the rest. */
  devices: Readonly<Record<ActionDevice, ActionSupport>>;
  /** What an app of build 54 or older gets instead (it does not know this kind): a screen it has, else nothing. */
  legacyRoute?: string;
}

export const COACH_ACTIONS: readonly CoachActionSpec[] = [
  { kind: "start_workout", confirm: true, devices: { phone: "run", web: "run", watch: "run" } },
  { kind: "start_camera_workout", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" }, legacyRoute: "/camera-workout" },
  { kind: "start_daily_move", confirm: true, devices: { phone: "run", web: "handoff", watch: "handoff" } },
  { kind: "log_habit", confirm: true, devices: { phone: "run", web: "handoff", watch: "handoff" }, legacyRoute: "/habits" },
  { kind: "set_reminder", confirm: true, devices: { phone: "run", web: "handoff", watch: "handoff" } },
  { kind: "add_to_calendar", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" } },
  { kind: "pause_streak", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" } },
  { kind: "open_screen", confirm: false, devices: { phone: "run", web: "run", watch: "handoff" } },
  // Build 60 (ADR-0068). log_meal = the meals habit of the day (habitScore.ts), the watch relays it to the phone/API.
  { kind: "log_meal", confirm: true, devices: { phone: "run", web: "run", watch: "run" }, legacyRoute: "/habits" },
  // A correction the athlete states ("I slept 8 h, not 6"): stored next to the Health value, never over it (dataCorrections.ts).
  { kind: "correct_data", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" }, legacyRoute: "/health" },
  // Pause / resume run at once (the athlete asked, mid-workout); stop asks first (`needsConfirm`). Allowed in a workout.
  { kind: "control_workout", confirm: false, devices: { phone: "run", web: "run", watch: "run" } },
  // Music where VVake already controls it (Spotify direct, the system's now playing). Allowed in a workout.
  { kind: "music", confirm: false, devices: { phone: "run", web: "none", watch: "run" } },
  // Nearby places for an outing (Spots / OSM places): the app looks them up with its own location and shows a card.
  { kind: "show_places", confirm: false, devices: { phone: "run", web: "run", watch: "handoff" }, legacyRoute: "/places" },
  // A spoken summary's card (the week, the next days, the next hours): the server computed it, nothing changes.
  { kind: "show_summary", confirm: false, devices: { phone: "run", web: "run", watch: "run" } },
  // ADR-0070. review_meal opens the meal with the coach's note; suggest_meals shows ideas (nothing changes);
  // plan_meals makes this week's plan (replaces one); update_nutrition adds what the athlete said (always confirmed).
  { kind: "review_meal", confirm: false, devices: { phone: "run", web: "run", watch: "handoff" } },
  { kind: "suggest_meals", confirm: false, devices: { phone: "run", web: "run", watch: "handoff" } },
  { kind: "plan_meals", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" } },
  { kind: "update_nutrition", confirm: true, devices: { phone: "run", web: "run", watch: "handoff" } },
];

/** Actions that answer, not start: allowed during a workout (the athlete asked). */
export const IN_WORKOUT_OK: readonly CoachActionKind[] = ["control_workout", "music", "show_summary", "open_screen"];

/** Whether this action waits for a yes (a tap, or a clear spoken yes with the card on screen). Pure. */
export function needsConfirm(a: Pick<CoachAppAction, "type" | "op">): boolean {
  if (a.type === "control_workout") return a.op === "stop";
  return coachActionSpec(a.type)?.confirm ?? true;
}

export const coachActionSpec = (kind: unknown): CoachActionSpec | undefined => COACH_ACTIONS.find((a) => a.kind === kind);
export const isCoachActionKind = (kind: unknown): kind is CoachActionKind => !!coachActionSpec(kind);

export type WorkoutIntensity = "easy" | "moderate" | "hard";

export const MEAL_KINDS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealKind = (typeof MEAL_KINDS)[number];
/** What an athlete may correct by voice (dataCorrections.ts holds the bounds). */
export const CORRECTION_METRICS = ["sleep_h", "steps", "resting_hr", "active_min"] as const;
export type CorrectionMetric = (typeof CORRECTION_METRICS)[number];
export const WORKOUT_OPS = ["pause", "resume", "stop"] as const;
export type WorkoutOp = (typeof WORKOUT_OPS)[number];
export const MUSIC_OPS = ["play", "pause", "next", "previous"] as const;
export type MusicOp = (typeof MUSIC_OPS)[number];
export const SUMMARY_SPANS = ["today", "week", "last_week", "next_days", "next_hours"] as const;
export type SummarySpan = (typeof SUMMARY_SPANS)[number];
/** Bounds of a correction: [min, max] in the metric's unit (hours, steps, bpm, minutes). */
export const CORRECTION_BOUNDS: Readonly<Record<CorrectionMetric, readonly [number, number]>> = {
  sleep_h: [0, 16],
  steps: [0, 100_000],
  resting_hr: [30, 120],
  active_min: [0, 600],
};
const INTENSITIES: readonly WorkoutIntensity[] = ["easy", "moderate", "hard"];

/** An action as sent to the app: the kind, its bounded fields, and the confirm card in the athlete's language. */
export interface CoachAppAction {
  type: CoachActionKind;
  /** start_workout: today's planned session (sport, minutes and intensity are the plan's). */
  planned?: boolean;
  /** start_workout / add_to_calendar: a sport id of the catalogue (sportCatalog.ts). */
  sport?: string;
  /** start_workout / start_camera_workout / add_to_calendar: 5 to 180. */
  minutes?: number;
  /** start_workout: a distance target, 0.5 to 100 km (always km on the wire; the card says it in the app's units). */
  distanceKm?: number;
  /** start_workout: the heart zone to hold, 1 to 4 (never a zone 5 target). */
  zone?: number;
  intensity?: WorkoutIntensity;
  /** start_camera_workout: a catalogue routine id, or `last` (the last pick, startWays.ts). */
  routine?: string;
  /** log_habit: the habit's id or name as the athlete said it; the app matches it to one of theirs. */
  habit?: string;
  /** set_reminder / add_to_calendar: local time HH:MM. */
  at?: string;
  /** add_to_calendar (and set_reminder on another day): YYYY-MM-DD. */
  date?: string;
  /** set_reminder: what to remind ("stretch"), ≤ 60 characters. */
  what?: string;
  /** pause_streak: sick | injured | off, 1 to 14 days from today. */
  pauseKind?: PauseKind;
  days?: number;
  /** open_screen: an allow-listed route (coachScreens.ts) and its label. */
  route?: string;
  label?: string;
  /** log_meal: which meal (the meals habit counts one per meal); `note` what they ate, ≤ 60 characters (kept on the phone). */
  meal?: MealKind;
  note?: string;
  /** log_meal (v4): open the camera to log it; `items` = a text estimate already made (the confirm card lists them). */
  photo?: boolean;
  items?: MealItem[];
  /** review_meal: the logged meal's id (GET /v1/nutrition/meals). */
  mealId?: string;
  /** plan_meals: the week's Monday, YYYY-MM-DD (default this week). suggest_meals: `meal`, `count` 1–5. */
  weekStart?: string;
  /** suggest_meals: the ideas' names when the server already has them (the watch shows names only). */
  ideas?: string[];
  /** update_nutrition: what the athlete said, added to the profile once they confirm. */
  nutrition?: { allergies?: string[]; intolerances?: string[]; dislikes?: string[]; diet?: DietStyle; goal?: NutritionGoal };
  /** correct_data: what the athlete says is right; `date` = the day it is about (default today). */
  metric?: CorrectionMetric;
  value?: number;
  /** correct_data: what the app showed (for the card: "6 h → 8 h"), when known. */
  shown?: number;
  /** pause_streak: the first day (default today), and whether the plan moves back by the paused days (time off). */
  from?: string;
  shiftPlan?: boolean;
  /** control_workout: pause | resume | stop (stop asks first). music: play | pause | next | previous. */
  op?: WorkoutOp | MusicOp;
  /** show_places: how long the outing lasts (minutes) or how far (km), the sport (hike, run, ride…), how far away at most. */
  maxTravelKm?: number;
  /** show_summary: which span, and how many days or hours; `lines` the server's summary lines, `title` its header. */
  span?: SummarySpan;
  count?: number;
  summary?: { title: string; lines: string[] };
  /** The confirm card (open_screen: the button only). */
  card: { title: string; detail?: string; confirm: string; cancel: string };
  /** The result lines in the athlete's language (`actionLines`), so a watch says the truth without its own copy. */
  lines?: Partial<Record<ActionLineKey, string>>;
}

export type ActionLineKey = "done" | "done_watch" | "cancelled" | CoachActionFail;

/** What the server knows when it cleans an action: the language, today's planned session, the account's switches. */
export interface CoachActionCtx {
  lang: Lang;
  units?: "metric" | "imperial";
  today?: { rest?: boolean; sport?: string; minutes?: number; intensity?: string };
  /** The Camera & trainings feature (Your VVake); undefined = unknown (on). */
  cameraOn?: boolean;
  /** The athlete's local hour (0–23): a meal said without its name is the one of that hour. */
  nowHour?: number;
  /** Nutrition (ADR-0070) on for the account; false: the nutrition kinds are dropped and log_meal is the habit only. */
  nutritionOn?: boolean;
}

/** The meal of the hour: before 10:30 breakfast, 11–15 lunch, 18–22 dinner, else a snack. Pure. */
export function mealAt(hour: number | undefined): MealKind {
  if (hour === undefined) return "snack";
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const int = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
};
const num = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : undefined;
};
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : undefined;
};
const sportOf = (v: unknown): string | undefined => (typeof v === "string" && SPORT_KEYS.includes(v) ? v : undefined);
const routineOf = (v: unknown): string | undefined => (v === "last" || CAMERA_ROUTINES.some((r) => r.id === v) ? (v as string) : undefined);

// ── Words ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const W = {
  start: { en: "Start", fr: "Démarrer" },
  notNow: { en: "Not now", fr: "Pas maintenant" },
  open: { en: "Open", fr: "Ouvrir" },
  log: { en: "Log it", fr: "Noter" },
  set: { en: "Set it", fr: "Régler" },
  add: { en: "Add it", fr: "Ajouter" },
  pause: { en: "Pause it", fr: "Mettre en pause" },
  min: { en: "min", fr: "min" },
  intensity: { easy: { en: "easy", fr: "facile" }, moderate: { en: "steady", fr: "modéré" }, hard: { en: "hard", fr: "soutenu" } },
} as const;

const fmtKm = (km: number, lang: Lang, units: "metric" | "imperial" = "metric") => {
  const v = units === "imperial" ? Math.round((km / 1.609344) * 10) / 10 : km;
  const s = lang === "fr" ? String(v).replace(".", ",") : String(v);
  return `${s} ${units === "imperial" ? "mi" : "km"}`;
};

const routineName = (id: string | undefined, lang: Lang): string => {
  if (!id || id === "last") return lang === "fr" ? "ta dernière séance caméra" : "your last camera workout";
  return CAMERA_ROUTINES.find((r) => r.id === id)?.name[lang] ?? id;
};

const MEAL_WORD: Record<MealKind, { en: string; fr: string }> = {
  breakfast: { en: "breakfast", fr: "petit-déjeuner" },
  lunch: { en: "lunch", fr: "déjeuner" },
  dinner: { en: "dinner", fr: "dîner" },
  snack: { en: "snack", fr: "en-cas" },
};
export const mealWord = (m: MealKind, lang: Lang) => MEAL_WORD[m][lang];

const METRIC_WORD: Record<CorrectionMetric, { en: string; fr: string }> = {
  sleep_h: { en: "Sleep", fr: "Sommeil" },
  steps: { en: "Steps", fr: "Pas" },
  resting_hr: { en: "Resting heart rate", fr: "Fréquence cardiaque au repos" },
  active_min: { en: "Active minutes", fr: "Minutes actives" },
};
export const metricWord = (m: CorrectionMetric, lang: Lang) => METRIC_WORD[m][lang];

/** "8 h", "7 h 30", "9,500 steps" / « 9 500 pas », "52 bpm", "45 min". Pure. */
export function metricValue(m: CorrectionMetric, v: number, lang: Lang): string {
  switch (m) {
    case "sleep_h": {
      const h = Math.floor(v);
      const min = Math.round((v - h) * 60);
      return min ? `${h} h ${String(min).padStart(2, "0")}` : `${h} h`;
    }
    case "steps": {
      const n = Math.round(v).toLocaleString("en-US");
      return lang === "fr" ? `${n.replace(/,/g, "\u202f")} pas` : `${n} steps`;
    }
    case "resting_hr":
      return `${Math.round(v)} bpm`;
    case "active_min":
      return `${Math.round(v)} min`;
  }
}

const OP_WORD: Record<WorkoutOp | MusicOp, { en: string; fr: string }> = {
  pause: { en: "Pause", fr: "Pause" },
  resume: { en: "Resume", fr: "Reprendre" },
  stop: { en: "End workout", fr: "Terminer la séance" },
  play: { en: "Play music", fr: "Lancer la musique" },
  next: { en: "Next song", fr: "Morceau suivant" },
  previous: { en: "Previous song", fr: "Morceau précédent" },
};

const PAUSE_WORD: Record<PauseKind, { en: string; fr: string }> = {
  sick: { en: "sick", fr: "malade" },
  injured: { en: "injured", fr: "blessé·e" },
  off: { en: "a break", fr: "une pause" },
};

/** "Run" / "Course à pied", capitalised. */
const titleSport = (sport: string, lang: Lang) => {
  const n = sportName(sport, lang);
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** The card's detail line for a workout: "30 min · easy · zone 2 · 5 km". */
function workoutDetail(
  a: Pick<CoachAppAction, "minutes" | "intensity" | "zone" | "distanceKm">,
  lang: Lang,
  units?: "metric" | "imperial",
): string | undefined {
  const parts = [
    a.minutes ? `${a.minutes} ${W.min[lang]}` : "",
    a.intensity ? W.intensity[a.intensity][lang] : "",
    a.zone ? `zone ${a.zone}` : "",
    a.distanceKm ? fmtKm(a.distanceKm, lang, units) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** The confirm card for an action, in the athlete's language. Pure. */
export function coachActionCard(a: Omit<CoachAppAction, "card">, lang: Lang, units?: "metric" | "imperial"): CoachAppAction["card"] {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const cancel = W.notNow[lang];
  switch (a.type) {
    case "start_workout": {
      const title = a.sport
        ? L(`Start ${titleSport(a.sport, "en")}`, `Démarrer : ${titleSport(a.sport, "fr")}`)
        : L("Start today's session", "Démarrer la séance du jour");
      const detail = workoutDetail(a, lang, units);
      return { title, ...(detail ? { detail } : {}), confirm: W.start[lang], cancel };
    }
    case "start_camera_workout": {
      const detail = [routineName(a.routine, lang), a.minutes ? `${a.minutes} ${W.min[lang]}` : ""].filter(Boolean).join(" · ");
      return { title: L("Start a camera workout", "Démarrer une séance caméra"), detail, confirm: W.start[lang], cancel };
    }
    case "start_daily_move":
      return {
        title: L("Start your daily move", "Démarrer ton mouvement du jour"),
        detail: L("Stretches, then a short walk", "Étirements, puis une courte marche"),
        confirm: W.start[lang],
        cancel,
      };
    case "log_habit":
      return {
        title: L(`Log ${a.habit ?? "a habit"} for today`, `Noter ${a.habit ?? "une habitude"} pour aujourd’hui`),
        confirm: W.log[lang],
        cancel,
      };
    case "set_reminder":
      return {
        title: L(`Remind me at ${a.at}`, `Me le rappeler à ${a.at}`),
        ...(a.what || a.date ? { detail: [a.what, a.date].filter(Boolean).join(" · ") } : {}),
        confirm: W.set[lang],
        cancel,
      };
    case "add_to_calendar": {
      const what = a.sport ? titleSport(a.sport, lang) : L("Workout", "Séance");
      const detail = [a.date, a.at, a.minutes ? `${a.minutes} ${W.min[lang]}` : ""].filter(Boolean).join(" · ");
      return {
        title: L(`Add ${what} to your calendar`, `Ajouter ${what} à ton agenda`),
        ...(detail ? { detail } : {}),
        confirm: W.add[lang],
        cancel,
      };
    }
    case "pause_streak": {
      const days = a.days ?? 1;
      return {
        title: L(
          `Pause your streak: ${PAUSE_WORD[a.pauseKind ?? "sick"].en}`,
          `Mettre ta série en pause : ${PAUSE_WORD[a.pauseKind ?? "sick"].fr}`,
        ),
        detail: [
          a.from
            ? L(`${days} day${days > 1 ? "s" : ""}, from ${a.from}.`, `${days} jour${days > 1 ? "s" : ""}, à partir du ${a.from}.`)
            : L(`${days} day${days > 1 ? "s" : ""}, from today.`, `${days} jour${days > 1 ? "s" : ""}, dès aujourd’hui.`),
          a.shiftPlan ? L("Your plan moves back to match.", "Ton plan se décale d’autant.") : "",
          L("Rest is training too.", "Le repos, c’est aussi de l’entraînement."),
        ]
          .filter(Boolean)
          .join(" "),
        confirm: W.pause[lang],
        cancel,
      };
    }
    case "open_screen":
      return { title: a.label ?? W.open[lang], confirm: W.open[lang], cancel };
    case "log_meal": {
      const m = a.meal ?? "snack";
      if (a.photo)
        return {
          title: L(`Snap your ${MEAL_WORD[m].en}`, `Prends ton ${MEAL_WORD[m].fr} en photo`),
          ...(a.note ? { detail: a.note } : {}),
          confirm: L("Open camera", "Ouvrir l’appareil photo"),
          cancel,
        };
      const detail = a.items?.length ? a.items.map((i) => `${i.name} ${i.grams} g`).join(" · ") : a.note;
      return {
        title: L(`Log ${MEAL_WORD[m].en}`, `Noter : ${MEAL_WORD[m].fr}`),
        ...(detail ? { detail } : {}),
        confirm: W.log[lang],
        cancel,
      };
    }
    case "correct_data": {
      const m = a.metric ?? "sleep_h";
      const v = a.value ?? 0;
      const shown = a.shown !== undefined ? `${metricValue(m, a.shown, lang)} → ` : "";
      const when = a.date ? ` · ${a.date}` : "";
      return {
        title: L(
          `Correct ${METRIC_WORD[m].en.toLowerCase()}: ${shown}${metricValue(m, v, lang)}`,
          `Corriger ${METRIC_WORD[m].fr.toLowerCase()} : ${shown}${metricValue(m, v, lang)}`,
        ),
        detail: L(`Your correction${when}. Health keeps its own value.`, `Ta correction${when}. Santé garde sa propre valeur.`),
        confirm: L("Correct it", "Corriger"),
        cancel,
      };
    }
    case "control_workout": {
      const op = (a.op as WorkoutOp) ?? "pause";
      return {
        title: OP_WORD[op][lang],
        confirm: op === "stop" ? L("End it", "Terminer") : OP_WORD[op][lang],
        cancel: op === "stop" ? L("Keep going", "Continuer") : cancel,
      };
    }
    case "music": {
      const op = (a.op as MusicOp) ?? "play";
      return { title: OP_WORD[op][lang], confirm: OP_WORD[op][lang], cancel };
    }
    case "show_places": {
      const what = a.sport ? titleSport(a.sport, lang) : L("Outing", "Sortie");
      const detail = [
        a.minutes
          ? a.minutes >= 60
            ? `${Math.floor(a.minutes / 60)} h${a.minutes % 60 ? ` ${String(a.minutes % 60).padStart(2, "0")}` : ""}`
            : `${a.minutes} ${W.min[lang]}`
          : "",
        a.distanceKm ? fmtKm(a.distanceKm, lang, units) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        title: L(`Places near you: ${what}`, `Lieux près de toi : ${what}`),
        ...(detail ? { detail } : {}),
        confirm: W.open[lang],
        cancel: L("Close", "Fermer"),
      };
    }
    case "show_summary":
      return {
        title: a.summary?.title ?? L("Summary", "Résumé"),
        ...(a.summary?.lines?.length ? { detail: a.summary.lines.join("\n") } : {}),
        confirm: "OK",
        cancel: L("Close", "Fermer"),
      };
    case "review_meal":
      return {
        title: L("Look at this meal together", "Revoir ce repas ensemble"),
        ...(a.note ? { detail: a.note } : {}),
        confirm: W.open[lang],
        cancel,
      };
    case "suggest_meals": {
      const m = a.meal ? MEAL_WORD[a.meal][lang] : "";
      return {
        title: m ? L(`Ideas for ${m}`, `Des idées pour le ${m}`) : L("Meal ideas", "Idées de repas"),
        ...(a.ideas?.length ? { detail: a.ideas.join(" · ") } : {}),
        confirm: L("Show me", "Voir"),
        cancel,
      };
    }
    case "plan_meals":
      return {
        title: L("Plan my meals this week", "Planifier mes repas de la semaine"),
        detail: L("Around your training, with a grocery list", "Selon ton entraînement, avec une liste de courses"),
        confirm: L("Plan it", "Planifier"),
        cancel,
      };
    case "update_nutrition": {
      const n = a.nutrition ?? {};
      const parts = [
        ...(n.allergies ?? []).map((x) => L(`Allergy: ${x}`, `Allergie : ${x}`)),
        ...(n.intolerances ?? []).map((x) => L(`Intolerance: ${x}`, `Intolérance : ${x}`)),
        ...(n.dislikes ?? []).map((x) => L(`Leave out: ${x}`, `Sans : ${x}`)),
        ...(n.diet ? [L(`Diet: ${DIET_NAMES[n.diet].en}`, `Régime : ${DIET_NAMES[n.diet].fr}`)] : []),
        ...(n.goal ? [L(`Goal: ${NUTRITION_GOAL_NAMES[n.goal].en}`, `Objectif : ${NUTRITION_GOAL_NAMES[n.goal].fr}`)] : []),
      ];
      return {
        title: L("Update your food settings", "Mettre à jour tes préférences alimentaires"),
        detail: parts.join(" · "),
        confirm: L("Save it", "Enregistrer"),
        cancel,
      };
    }
  }
}

/**
 * The action the model (or a client) sent, checked and bounded, with today's planned session filled in and the card
 * written by us (never the model's words); null when it is unusable. Pure.
 */
export function cleanCoachAction(raw: unknown, ctx: CoachActionCtx): CoachAppAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (!isCoachActionKind(type)) return null;
  const lang = ctx.lang;
  let a: Omit<CoachAppAction, "card">;
  switch (type) {
    case "start_workout": {
      const sport = sportOf(r.sport);
      const today = ctx.today && !ctx.today.rest && sportOf(ctx.today.sport) ? ctx.today : undefined;
      // "Start today's session": the plan's sport, minutes and intensity; a sport named that is not today's is a new session.
      const planned = (r.planned === true || !sport) && !!today && (!sport || sport === today.sport);
      const intensity =
        INTENSITIES.find((i) => i === r.intensity) ?? (planned ? INTENSITIES.find((i) => i === today!.intensity) : undefined);
      const minutes = int(r.minutes, 5, 180) ?? (planned ? int(today!.minutes, 5, 180) : undefined);
      const distanceKm = num(r.distanceKm, 0.5, 100);
      const zone = int(r.zone, 1, 4);
      const s = sport ?? (planned ? today!.sport : undefined);
      a = {
        type,
        ...(planned ? { planned: true } : {}),
        ...(s ? { sport: s } : {}),
        ...(minutes ? { minutes } : {}),
        ...(intensity ? { intensity } : {}),
        ...(zone ? { zone } : {}),
        ...(distanceKm ? { distanceKm } : {}),
      };
      break;
    }
    case "start_camera_workout": {
      if (ctx.cameraOn === false) return null;
      const routine = routineOf(r.routine) ?? "last";
      const minutes = int(r.minutes, 5, 60);
      a = { type, routine, ...(minutes ? { minutes } : {}) };
      break;
    }
    case "start_daily_move":
      a = { type };
      break;
    case "log_habit": {
      const habit = text(r.habit, 40);
      if (!habit) return null;
      a = { type, habit };
      break;
    }
    case "set_reminder": {
      const at = typeof r.at === "string" && HHMM.test(r.at) ? r.at : undefined;
      if (!at) return null;
      const what = text(r.what, 60);
      const date = typeof r.date === "string" && DAY.test(r.date) ? r.date : undefined;
      a = { type, at, ...(what ? { what } : {}), ...(date ? { date } : {}) };
      break;
    }
    case "add_to_calendar": {
      const date = typeof r.date === "string" && DAY.test(r.date) ? r.date : undefined;
      const at = typeof r.at === "string" && HHMM.test(r.at) ? r.at : undefined;
      if (!date || !at) return null;
      const sport = sportOf(r.sport);
      const minutes = int(r.minutes, 5, 180);
      a = { type, date, at, ...(sport ? { sport } : {}), ...(minutes ? { minutes } : {}) };
      break;
    }
    case "pause_streak": {
      const pauseKind = PAUSE_KINDS.find((k) => k === r.pauseKind) ?? "sick";
      const days = int(r.days, 1, PAUSE_MAX_DAYS) ?? (pauseKind === "sick" ? 2 : 3);
      const from = typeof r.from === "string" && DAY.test(r.from) ? r.from : undefined;
      a = { type, pauseKind, days, ...(from ? { from } : {}), ...(r.shiftPlan === true ? { shiftPlan: true } : {}) };
      break;
    }
    case "open_screen": {
      const s = coachScreen(r.route);
      if (!s) return null;
      a = { type, route: s.route, label: s.label[lang] };
      break;
    }
    case "log_meal": {
      const meal = MEAL_KINDS.find((m) => m === r.meal) ?? mealAt(ctx.nowHour);
      const note = text(r.note, 60);
      // Photo and items need Nutrition on; without it, log_meal is the meals habit as before.
      const nOn = ctx.nutritionOn === true;
      const items =
        nOn && Array.isArray(r.items)
          ? (r.items as unknown[])
              .map(cleanMealItem)
              .filter((i): i is MealItem => !!i)
              .slice(0, 12)
          : [];
      a = {
        type,
        meal,
        ...(note ? { note } : {}),
        ...(nOn && r.photo === true ? { photo: true } : {}),
        ...(items.length ? { items } : {}),
      };
      break;
    }
    case "review_meal": {
      if (ctx.nutritionOn !== true) return null;
      const mealId = typeof r.mealId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(r.mealId) ? r.mealId : undefined;
      const note = text(r.note, 120);
      a = { type, ...(mealId ? { mealId } : {}), ...(note ? { note } : {}) };
      break;
    }
    case "suggest_meals": {
      if (ctx.nutritionOn !== true) return null;
      const meal = MEAL_KINDS.find((m) => m === r.meal);
      const count = int(r.count, 1, 5);
      const ideas = Array.isArray(r.ideas)
        ? (r.ideas as unknown[])
            .map((x) => text(x, 60))
            .filter((x): x is string => !!x)
            .slice(0, 5)
        : [];
      a = { type, ...(meal ? { meal } : {}), ...(count ? { count } : {}), ...(ideas.length ? { ideas } : {}) };
      break;
    }
    case "plan_meals": {
      if (ctx.nutritionOn !== true) return null;
      const weekStart = typeof r.weekStart === "string" && DAY.test(r.weekStart) ? r.weekStart : undefined;
      a = { type, ...(weekStart ? { weekStart } : {}) };
      break;
    }
    case "update_nutrition": {
      if (ctx.nutritionOn !== true) return null;
      const n = r.nutrition && typeof r.nutrition === "object" ? (r.nutrition as Record<string, unknown>) : r;
      const allergies = cleanTerms(n.allergies, 5);
      const intolerances = cleanTerms(n.intolerances, 5);
      const dislikes = cleanTerms(n.dislikes, 5);
      const diet = DIET_STYLES.find((d) => d === n.diet);
      // 'lean' is never proposed by the coach (minors / ED-safe rules decide it in Settings only).
      const goal = NUTRITION_GOALS.find((g) => g === n.goal && g !== "lean");
      if (!allergies.length && !intolerances.length && !dislikes.length && !diet && !goal) return null;
      a = {
        type,
        nutrition: {
          ...(allergies.length ? { allergies } : {}),
          ...(intolerances.length ? { intolerances } : {}),
          ...(dislikes.length ? { dislikes } : {}),
          ...(diet ? { diet } : {}),
          ...(goal ? { goal } : {}),
        },
      };
      break;
    }
    case "correct_data": {
      const metric = CORRECTION_METRICS.find((m) => m === r.metric);
      if (!metric) return null;
      const [lo, hi] = CORRECTION_BOUNDS[metric];
      const value = metric === "sleep_h" ? num(r.value, lo, hi) : int(r.value, lo, hi);
      if (value === undefined) return null;
      const shown = metric === "sleep_h" ? num(r.shown, lo, hi) : int(r.shown, lo, hi);
      const date = typeof r.date === "string" && DAY.test(r.date) ? r.date : undefined;
      a = { type, metric, value, ...(shown !== undefined ? { shown } : {}), ...(date ? { date } : {}) };
      break;
    }
    case "control_workout": {
      const op = WORKOUT_OPS.find((o) => o === r.op);
      if (!op) return null;
      a = { type, op };
      break;
    }
    case "music": {
      const op = MUSIC_OPS.find((o) => o === r.op);
      if (!op) return null;
      a = { type, op };
      break;
    }
    case "show_places": {
      const sport = sportOf(r.sport);
      const minutes = int(r.minutes, 10, 720);
      const distanceKm = num(r.distanceKm, 0.5, 200);
      const maxTravelKm = num(r.maxTravelKm, 1, 150);
      a = {
        type,
        ...(sport ? { sport } : {}),
        ...(minutes ? { minutes } : {}),
        ...(distanceKm ? { distanceKm } : {}),
        ...(maxTravelKm ? { maxTravelKm } : {}),
      };
      break;
    }
    case "show_summary": {
      const span = SUMMARY_SPANS.find((x) => x === r.span) ?? "week";
      const count = int(r.count, 1, span === "next_hours" ? 24 : 14);
      const sum = r.summary && typeof r.summary === "object" ? (r.summary as Record<string, unknown>) : undefined;
      const title = text(sum?.title, 60);
      const lines = Array.isArray(sum?.lines)
        ? (sum!.lines as unknown[])
            .map((l) => text(l, 120))
            .filter((l): l is string => !!l)
            .slice(0, 8)
        : [];
      a = { type, span, ...(count ? { count } : {}), ...(title || lines.length ? { summary: { title: title ?? "", lines } } : {}) };
      break;
    }
  }
  return { ...a, card: coachActionCard(a, lang, ctx.units), lines: actionLines(a, lang) };
}

// ── The gate: may this device run it now? ─────────────────────────────────────────────────────────────────────────

export type CoachActionFail =
  | "in_workout"
  | "camera_off"
  | "not_here"
  | "watch_unreachable"
  | "permission"
  | "offline"
  | "no_plan_today"
  | "no_such_habit"
  | "past_time"
  | "no_workout"
  | "no_music"
  | "no_location"
  | "nutrition_off"
  | "failed";

export interface GateState {
  device: ActionDevice;
  /** A workout (or camera workout, or daily move) is running on this device or a linked one. */
  inWorkout: boolean;
  /** The Camera & trainings feature (Your VVake). */
  cameraOn?: boolean;
  /** Nutrition on for the account (ADR-0070); false: its kinds can't run. */
  nutritionOn?: boolean;
}

/**
 * Whether this device may run the action now: ok, a handoff to the phone, or the reason it can't. Quiet never blocks
 * (the athlete asked); Show on Home never blocks (hidden is not gone, build 54). Pure.
 */
export function gateCoachAction(
  a: Pick<CoachAppAction, "type">,
  s: GateState,
): { ok: true; handoff?: boolean } | { ok: false; reason: CoachActionFail } {
  const spec = coachActionSpec(a.type);
  if (!spec) return { ok: false, reason: "failed" };
  if (s.inWorkout && spec.confirm && !IN_WORKOUT_OK.includes(a.type)) return { ok: false, reason: "in_workout" };
  if (a.type === "control_workout" && !s.inWorkout) return { ok: false, reason: "no_workout" };
  if (a.type === "start_camera_workout" && s.cameraOn === false) return { ok: false, reason: "camera_off" };
  if ((NUTRITION_ACTION_KINDS as readonly string[]).includes(a.type) && s.nutritionOn === false)
    return { ok: false, reason: "nutrition_off" };
  const sup = spec.devices[s.device];
  if (sup === "none") return { ok: false, reason: "not_here" };
  return sup === "handoff" ? { ok: true, handoff: true } : { ok: true };
}

// ── What the app says after it ran it (the only "done" line there is) ────────────────────────────────────────────

export type ActionOutcome =
  { ok: true; on?: "watch" | "phone" | "web" } | { ok: false; reason: CoachActionFail } | { ok: false; reason: "cancelled" };

/** The coach's line once the app ran (or could not run) the action: the truth, never a guess. Pure. */
export function coachActionResult(a: Omit<CoachAppAction, "card">, outcome: ActionOutcome, lang: Lang): string {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  if (!outcome.ok) return failLine(outcome.reason, lang);
  const on = outcome.on === "watch" ? L(" on your watch", " sur ta montre") : "";
  switch (a.type) {
    case "start_workout":
      return a.sport
        ? L(
            `${titleSport(a.sport, "en")} started${on}. Easy for the first few minutes.`,
            `${titleSport(a.sport, "fr")} : c’est lancé${on}. Tranquille les premières minutes.`,
          )
        : L(`Started${on}.`, `C’est lancé${on}.`);
    case "start_camera_workout":
      return L("Camera workout open. Set your phone down and step back.", "Séance caméra ouverte. Pose ton téléphone et recule un peu.");
    case "start_daily_move":
      return L("Daily move started.", "Mouvement du jour lancé.");
    case "log_habit":
      return L(`Logged: ${a.habit ?? "habit"}, today.`, `Noté : ${a.habit ?? "habitude"}, aujourd’hui.`);
    case "set_reminder":
      return L(`Reminder set for ${a.at}.`, `Rappel réglé à ${a.at}.`);
    case "add_to_calendar":
      return L("Added to your calendar.", "Ajouté à ton agenda.");
    case "pause_streak":
      return L(
        `Streak paused for ${a.days ?? 1} day${(a.days ?? 1) > 1 ? "s" : ""}. Rest well.`,
        `Série en pause pour ${a.days ?? 1} jour${(a.days ?? 1) > 1 ? "s" : ""}. Repose-toi bien.`,
      );
    case "open_screen":
      return a.label ?? "";
    case "log_meal":
      if (a.photo) return L("Camera open: snap your plate.", "Appareil photo ouvert : prends ton assiette.");
      return L(`Logged: ${MEAL_WORD[a.meal ?? "snack"].en}.`, `Noté : ${MEAL_WORD[a.meal ?? "snack"].fr}.`);
    case "correct_data":
      return a.metric && a.value !== undefined
        ? L(
            `Corrected: ${METRIC_WORD[a.metric].en.toLowerCase()} ${metricValue(a.metric, a.value, "en")}. I'll use your number.`,
            `Corrigé : ${METRIC_WORD[a.metric].fr.toLowerCase()} ${metricValue(a.metric, a.value, "fr")}. Je prends ton chiffre.`,
          )
        : L("Corrected.", "Corrigé.");
    case "control_workout":
      return a.op === "stop"
        ? L("Workout ended. Nice work.", "Séance terminée. Beau travail.")
        : a.op === "resume"
          ? L("Resumed.", "C’est reparti.")
          : L("Paused.", "En pause.");
    case "music":
      return a.op === "pause"
        ? L("Music paused.", "Musique en pause.")
        : a.op === "next"
          ? L("Next song.", "Morceau suivant.")
          : a.op === "previous"
            ? L("Previous song.", "Morceau précédent.")
            : L("Music on.", "Musique lancée.");
    case "show_places":
      return L("Here's what's near you.", "Voici ce qu’il y a près de toi.");
    case "show_summary":
      return a.summary?.title ?? L("Here it is.", "Voilà.");
    case "review_meal":
      return L("Here’s your meal.", "Voici ton repas.");
    case "suggest_meals":
      return L("Here are a few ideas.", "Voici quelques idées.");
    case "plan_meals":
      return L("Your week of meals is ready, with the grocery list.", "Ta semaine de repas est prête, avec la liste de courses.");
    case "update_nutrition":
      return L("Saved. I’ll keep that out of every idea and plan.", "Enregistré. Je l’écarte de toutes les idées et de tous les plans.");
  }
}

/** Why it didn't happen, in one honest line. Pure. */
export function failLine(reason: CoachActionFail | "cancelled", lang: Lang): string {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  switch (reason) {
    case "cancelled":
      return L("No problem, nothing started.", "Pas de souci, rien n’a été lancé.");
    case "in_workout":
      return L("Not during a workout: finish this one first.", "Pas pendant une séance : termine celle-ci d’abord.");
    case "camera_off":
      return L(
        "Camera workouts are off in Your VVake. Turn on Camera & trainings to start one.",
        "Les séances caméra sont désactivées dans Ton VVake. Active Caméra et entraînements pour en lancer une.",
      );
    case "not_here":
      return L("That starts on your phone: open VVake there.", "Ça se lance sur ton téléphone : ouvre VVake dessus.");
    case "watch_unreachable":
      return L(
        "Your watch didn't answer, so nothing started. Try again, or start it on the phone.",
        "Ta montre n’a pas répondu, donc rien n’a été lancé. Réessaie, ou lance-la sur le téléphone.",
      );
    case "permission":
      return L(
        "VVake needs your permission for that first. Nothing changed.",
        "VVake a d’abord besoin de ton autorisation. Rien n’a changé.",
      );
    case "offline":
      return L(
        "You're offline, so nothing changed. Try again in a moment.",
        "Tu es hors ligne, donc rien n’a changé. Réessaie dans un instant.",
      );
    case "no_plan_today":
      return L(
        "No session is planned today. Pick a sport and I can start that.",
        "Aucune séance prévue aujourd’hui. Choisis un sport et je peux le lancer.",
      );
    case "no_such_habit":
      return L("I couldn't find that habit. Nothing was logged.", "Je n’ai pas trouvé cette habitude. Rien n’a été noté.");
    case "past_time":
      return L("That time has passed. Pick a later one.", "Cette heure est passée. Choisis-en une plus tard.");
    case "no_workout":
      return L("No workout is running right now.", "Aucune séance n’est en cours.");
    case "no_music":
      return L("I can't reach your music from here. Nothing changed.", "Je n’arrive pas à joindre ta musique d’ici. Rien n’a changé.");
    case "no_location":
      return L(
        "I need your location to find places near you. Nothing was searched.",
        "J’ai besoin de ta position pour trouver des lieux près de toi. Rien n’a été cherché.",
      );
    case "nutrition_off":
      return L(
        "Nutrition is off. Turn it on in Settings › Tailor my app to use it.",
        "La nutrition est désactivée. Active-la dans Réglages › Personnaliser mon app pour l’utiliser.",
      );
    case "failed":
      return L(
        "That didn't work, so nothing changed. Try again from the app.",
        "Ça n’a pas marché, donc rien n’a changé. Réessaie depuis l’app.",
      );
  }
}

const LINE_KEYS: readonly ActionLineKey[] = [
  "done",
  "done_watch",
  "cancelled",
  "in_workout",
  "camera_off",
  "not_here",
  "watch_unreachable",
  "permission",
  "offline",
  "no_plan_today",
  "no_such_habit",
  "past_time",
  "no_workout",
  "no_music",
  "no_location",
  "nutrition_off",
  "failed",
];

/** Every result line of an action, for the apps that don't hold the catalog's words (the watches). Pure. */
export function actionLines(a: Omit<CoachAppAction, "card" | "lines">, lang: Lang): Record<ActionLineKey, string> {
  const out = {} as Record<ActionLineKey, string>;
  for (const k of LINE_KEYS) {
    out[k] =
      k === "done"
        ? coachActionResult(a, { ok: true }, lang)
        : k === "done_watch"
          ? coachActionResult(a, { ok: true, on: "watch" }, lang)
          : failLine(k, lang);
  }
  return out;
}

// ── Honesty: the coach never says it did something the app did not confirm ──────────────────────────────────────

const norm = (t: string) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

/** "I started", "I've set your reminder", "your run is started", « j'ai lancé », « c'est lancé », « ta séance est démarrée ». */
const CLAIM_EN = [
  /\b(i|we)('ve| have|'ll have| just)?\s+(just\s+)?(started|launched|kicked off|scheduled|booked|logged|paused|set up|set|added|turned on|turned off|switched on|switched|opened|created|activated|begun|began|changed|updated|moved|swapped|ended|stopped|finished|corrected|fixed|saved|recorded|noted|resumed|skipped|played)\b/,
  /\b(your|the|today's)\s+([a-z-]+\s+){0,2}(run|ride|walk|hike|swim|workout|session|training|move|timer)\s+(is|has been|'s)\s+(now\s+)?(started|running|underway|launched|on its way)\b/,
  /\b(your|the|a)\s+([a-z-]+\s+){0,2}(reminder|alarm|event|habit|calendar entry)\s+(is|has been|'s)\s+(now\s+)?(set|scheduled|added|logged|booked|on)\b/,
  /\b(your|the)\s+streak\s+(is|has been|'s)\s+(now\s+)?paused\b/,
  /\b(it's|it is|that's|that is|you're all)\s+(now\s+)?(started|underway|launched|scheduled|logged|paused|added|booked|done|set)\b/,
  /^(done|all set|started|it's started)\b/,
  /\b(starting|launching|opening) (it|your|the|a|an)\b[^?]*\bnow\b/,
];
const CLAIM_FR = [
  /\b(j'ai|je t'ai|on a|je viens de)\s+(bien\s+)?(lancé|lancer|démarré|démarrer|commencé|ajouté|ajouter|programmé|programmer|activé|réglé|régler|ouvert|planifié|créé|mis en pause|terminé|arrêté|corrigé|noté|enregistré|repris)(?![\p{L}\p{N}])/u,
  /\bc'est\s+(bien\s+)?(lancé|démarré|fait|réglé|programmé|ajouté|activé|en route)(?![\p{L}\p{N}])/u,
  /\b(ta|ton|la|le)\s+([a-zàâçéèêëîïôûùüÿœ'-]+\s+){0,2}(séance|course|marche|sortie|entraînement|rappel|alarme|habitude|série|événement|mouvement)\s+(est|a été)\s+(maintenant\s+)?(lancée?|démarrée?|en cours|programmée?|ajoutée?|notée?|en pause|réglée?|activée?)(?![\p{L}\p{N}])/u,
  /^(fait|voilà, c'est fait|c'est fait)(?![\p{L}\p{N}])/u,
];

/** Does the reply say an action was done (started, set, added, logged…)? Questions and offers are not claims. Pure. */
export function claimsDone(reply: string): boolean {
  const sentences = norm(reply)
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => s && !s.endsWith("?"));
  return sentences.some((s) => CLAIM_EN.some((re) => re.test(s)) || CLAIM_FR.some((re) => re.test(s)));
}

/** The coach's offer line for an action it returned: the card does the rest. Pure. */
export function offerLine(
  a: Omit<CoachAppAction, "card"> & { card?: CoachAppAction["card"] },
  lang: Lang,
  units?: "metric" | "imperial",
): string {
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const card = a.card ?? coachActionCard(a, lang, units);
  const what = [card.title, card.detail].filter(Boolean).join(", ");
  switch (a.type) {
    case "open_screen":
      return L(
        `It's in ${a.label ?? card.title}. Tap the button to go there.`,
        `C’est dans ${a.label ?? card.title}. Touche le bouton pour y aller.`,
      );
    case "start_workout":
    case "start_camera_workout":
    case "start_daily_move":
      return L(
        `Ready when you are: ${what}. Tap ${card.confirm} to begin.`,
        `Prêt quand tu veux : ${what}. Touche ${card.confirm} pour commencer.`,
      );
    default:
      return L(`${what}. Tap ${card.confirm} to confirm.`, `${what}. Touche ${card.confirm} pour confirmer.`);
  }
}

/** The honest line when the coach claimed something with no action to back it. Pure. */
export function noActionLine(lang: Lang): string {
  return lang === "fr"
    ? "Je ne peux rien lancer moi-même d’ici. Dis-moi ce que tu veux démarrer ou régler, et je te mets un bouton ici."
    : "I can't start that myself from here. Tell me what you'd like to start or set, and I'll put a button right here.";
}

/**
 * The reply as it may be said: unchanged when it claims nothing; with an action that waits for a tap, the offer line
 * (the claim was false until the app confirms); with no action, the honest "I can't do that myself" line. Workout
 * controls the app runs at once (pause, resume, end) are not this function's business. Pure.
 */
export function honestReply(
  reply: string,
  action: (Omit<CoachAppAction, "card"> & { card?: CoachAppAction["card"] }) | null,
  lang: Lang,
  units?: "metric" | "imperial",
): { reply: string; rewritten: boolean } {
  if (!claimsDone(reply)) return { reply, rewritten: false };
  if (action && needsConfirm(action)) return { reply: offerLine(action, lang, units), rewritten: true };
  if (action?.type === "open_screen") return { reply: offerLine(action, lang, units), rewritten: true };
  return { reply: noActionLine(lang), rewritten: true };
}

// ── Confirming ─────────────────────────────────────────────────────────────────────────────────────────────────────

const YES =
  /^(yes|yeah|yep|yup|sure|ok|okay|go|go ahead|do it|start|start it|let's go|lets go|please|yes please|oui|ouais|vas-y|vas y|d'accord|ok vas-y|go go|c'est parti|lance|lance-la|lance-le|démarre|on y va|allez)$/;
const NO = /^(no|nope|not now|cancel|stop|later|no thanks|non|pas maintenant|annule|plus tard|non merci|laisse tomber)$/;

/** A short yes or no (typed or said), without punctuation and polite filler; null when it is anything else. Pure. */
export function yesNo(text: string): "yes" | "no" | null {
  const t = norm(text)
    .replace(/[.!,;:¡¿?]+/g, " ")
    .replace(/\b(coach|vvake|please|merci|thanks|s'il te plait|s'il te plaît|stp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.split(" ").length > 4) return null;
  if (YES.test(t)) return "yes";
  if (NO.test(t)) return "no";
  return null;
}

/**
 * A spoken answer to the card: confirms only in a live call AND with the card on screen (anything else needs the
 * tap); a no cancels anywhere the card is shown. Pure.
 */
export function spokenConfirm(s: { liveCall: boolean; cardOnScreen: boolean; text: string }): "confirm" | "cancel" | null {
  if (!s.cardOnScreen) return null;
  const a = yesNo(s.text);
  if (a === "no") return "cancel";
  if (a === "yes" && s.liveCall) return "confirm";
  return null;
}

// ── Older apps (build 54 and before) ──────────────────────────────────────────────────────────────────────────────

/** "no, rather Thursday", "yes but at 7", « non, plutôt jeudi », « oui mais à 7 h »: an answer that changes the offer. */
const CHANGE_EN =
  /^(no|nope|yes|yeah|ok|okay)?[ ,]*(but |rather |instead |actually |make it |how about |what about |can we |could we |let's do |change |move it )/;
const CHANGE_FR =
  /^(non|oui|ok|ouais)?[ ,]*(mais |plutôt |plutot |plutôt que |en fait |et si |on peut |on pourrait |change |décale |mets-le |mets-la |fais-le )/;

/**
 * The athlete's answer to a card on screen, in ANY mode (live call, push-to-talk, typed: founder ask 2026-10-30,
 * ADR-0068 amends ADR-0063's "spoken yes only in a live call"): a clear yes confirms, a clear no cancels, "no, rather
 * Thursday" / "yes but at 7" is a change (the card is cancelled and the coach makes a new offer from `rest`), anything
 * else is not an answer to the card (the conversation goes on, the card stays). The app still runs the action and
 * only the app says it is done (honesty guard). Pure.
 */
export function cardDecision(textIn: string): { decision: "confirm" | "cancel" | "change"; rest?: string } | null {
  const t = norm(textIn)
    .replace(/[.!¡¿?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  const m = CHANGE_EN.exec(t) ?? CHANGE_FR.exec(t);
  if (m && m[2]) {
    const rest = t.slice(m[0].length).trim();
    if (rest) return { decision: "change", rest };
  }
  const yn = yesNo(t) ?? yesNoPair(t);
  if (yn === "yes") return { decision: "confirm" };
  if (yn === "no") return { decision: "cancel" };
  return null;
}

/** Two short answers in a row ("yes, do it", « oui vas-y », "no, not now"): the same answer. Pure. */
function yesNoPair(t: string): "yes" | "no" | null {
  const c = t
    .replace(/[,;:]+/g, " ")
    .replace(/\b(please|coach|merci|thanks|stp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = c.split(" ");
  if (words.length < 2 || words.length > 5) return null;
  for (let i = 1; i < words.length; i++) {
    const a = yesNo(words.slice(0, i).join(" "));
    const b = yesNo(words.slice(i).join(" "));
    if (a && a === b) return a;
  }
  return null;
}

/** A voiced or typed answer to the card on screen confirms in every mode (ADR-0068). Pure. */
export function voiceConfirm(s: { cardOnScreen: boolean; text: string }): "confirm" | "cancel" | "change" | null {
  if (!s.cardOnScreen) return null;
  return cardDecision(s.text)?.decision ?? null;
}

/**
 * What an app that does not know the catalog gets: start_workout as it always was (it opens the workout screen),
 * a screen it has for the others, else nothing; the reply then says where to do it. Pure.
 */
export function legacyAction(
  a: CoachAppAction,
  lang: Lang,
): {
  action:
    { type: "start_workout"; sport?: string; minutes?: number } | { type: "open_screen"; route: string; label: string } | { type: "none" };
  note?: string;
} {
  if (a.type === "start_workout")
    return { action: { type: "start_workout", ...(a.sport ? { sport: a.sport } : {}), ...(a.minutes ? { minutes: a.minutes } : {}) } };
  if (a.type === "open_screen" && a.route) return { action: { type: "open_screen", route: a.route, label: a.label ?? "" } };
  const route = coachActionSpec(a.type)?.legacyRoute;
  const s = route ? COACH_SCREENS.find((x) => x.route === route) : undefined;
  if (s) return { action: { type: "open_screen", route: s.route, label: s.label[lang] } };
  return {
    action: { type: "none" },
    note:
      lang === "fr"
        ? "Fais-le depuis l’accueil de l’app, ou mets VVake à jour pour le lancer d’ici."
        : "Do it from the app’s Home, or update VVake to start it from here.",
  };
}

/** The tool schema of an action, for the model (the coach_reply tool and the live call's app_action tool). */
export const COACH_ACTION_SCHEMA_PROPS = {
  planned: { type: "boolean", description: "start_workout: today's planned session (its sport, minutes and intensity)." },
  distanceKm: { type: "number", minimum: 0.5, maximum: 100, description: "start_workout: a distance target in km." },
  zone: { type: "integer", minimum: 1, maximum: 4, description: "start_workout: the heart zone to hold." },
  intensity: { type: "string", enum: [...INTENSITIES] },
  routine: {
    type: "string",
    enum: ["last", ...CAMERA_ROUTINES.map((r) => r.id)],
    description: "start_camera_workout: a routine, or last (their last pick).",
  },
  habit: { type: "string", description: "log_habit: the habit as they named it (water, stretch, meditate…)." },
  at: { type: "string", description: "set_reminder / add_to_calendar: local time HH:MM (24 h)." },
  date: { type: "string", description: "add_to_calendar (or a reminder on another day): YYYY-MM-DD." },
  what: { type: "string", description: "set_reminder: what to remind, a few words." },
  pauseKind: { type: "string", enum: [...PAUSE_KINDS], description: "pause_streak: sick, injured or off." },
  days: { type: "integer", minimum: 1, maximum: PAUSE_MAX_DAYS, description: "pause_streak: how many days from today (or from `from`)." },
  from: { type: "string", description: "pause_streak: the first day off, YYYY-MM-DD (default today)." },
  shiftPlan: { type: "boolean", description: "pause_streak: move the plan back by the days off (sick, injured, time off)." },
  meal: { type: "string", enum: [...MEAL_KINDS], description: "log_meal: which meal (default: the one of the hour)." },
  note: { type: "string", description: "log_meal: what they ate, a few words, only if they said it." },
  metric: { type: "string", enum: [...CORRECTION_METRICS], description: "correct_data: what the athlete says the app has wrong." },
  value: { type: "number", description: "correct_data: the right value they said (sleep in hours, e.g. 8 or 7.5)." },
  shown: { type: "number", description: "correct_data: what the app showed, if you know it." },
  op: {
    type: "string",
    enum: [...new Set([...WORKOUT_OPS, ...MUSIC_OPS])],
    description: "control_workout: pause | resume | stop. music: play | pause | next | previous.",
  },
  maxTravelKm: { type: "number", description: "show_places: how far they will travel to start, km." },
  span: { type: "string", enum: [...SUMMARY_SPANS], description: "show_summary: which span to summarise." },
  count: {
    type: "integer",
    description: "show_summary: how many days (next_days) or hours (next_hours). suggest_meals: how many ideas (1–5).",
  },
} as const;

/** The Nutrition fields of the action schema (ADR-0070): added to the tool only when Nutrition is on. */
export const COACH_NUTRITION_SCHEMA_PROPS = {
  photo: { type: "boolean", description: "log_meal: open the camera to log it with a photo." },
  mealId: { type: "string", description: "review_meal: the logged meal id." },
  weekStart: { type: "string", description: "plan_meals: the Monday of the week, YYYY-MM-DD." },
  nutrition: {
    type: "object",
    description: "update_nutrition: only what the athlete said just now (an allergy, intolerance, food to leave out, diet style).",
    properties: {
      allergies: { type: "array", items: { type: "string" } },
      intolerances: { type: "array", items: { type: "string" } },
      dislikes: { type: "array", items: { type: "string" } },
      diet: { type: "string", enum: [...DIET_STYLES] },
      goal: { type: "string", enum: NUTRITION_GOALS.filter((g) => g !== "lean") },
    },
  },
} as const;
