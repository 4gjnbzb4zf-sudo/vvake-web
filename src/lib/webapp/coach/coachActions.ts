// Copied from VVFit packages/game-core/src/coachActions.ts (2d942b08 2026-10-29) by scripts/sync-coach-core.ts. Do not edit: re-sync.
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
];

export const coachActionSpec = (kind: unknown): CoachActionSpec | undefined => COACH_ACTIONS.find((a) => a.kind === kind);
export const isCoachActionKind = (kind: unknown): kind is CoachActionKind => !!coachActionSpec(kind);

export type WorkoutIntensity = "easy" | "moderate" | "hard";
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
        detail: L(
          `${days} day${days > 1 ? "s" : ""}, from today. Rest is training too.`,
          `${days} jour${days > 1 ? "s" : ""}, dès aujourd’hui. Le repos, c’est aussi de l’entraînement.`,
        ),
        confirm: W.pause[lang],
        cancel,
      };
    }
    case "open_screen":
      return { title: a.label ?? W.open[lang], confirm: W.open[lang], cancel };
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
      a = { type, pauseKind, days };
      break;
    }
    case "open_screen": {
      const s = coachScreen(r.route);
      if (!s) return null;
      a = { type, route: s.route, label: s.label[lang] };
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
  | "failed";

export interface GateState {
  device: ActionDevice;
  /** A workout (or camera workout, or daily move) is running on this device or a linked one. */
  inWorkout: boolean;
  /** The Camera & trainings feature (Your VVake). */
  cameraOn?: boolean;
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
  if (s.inWorkout && spec.confirm) return { ok: false, reason: "in_workout" };
  if (a.type === "start_camera_workout" && s.cameraOn === false) return { ok: false, reason: "camera_off" };
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
  /\b(i|we)('ve| have|'ll have| just)?\s+(just\s+)?(started|launched|kicked off|scheduled|booked|logged|paused|set up|set|added|turned on|turned off|switched on|switched|opened|created|activated|begun|began|changed|updated|moved|swapped)\b/,
  /\b(your|the|today's)\s+([a-z-]+\s+){0,2}(run|ride|walk|hike|swim|workout|session|training|move|timer)\s+(is|has been|'s)\s+(now\s+)?(started|running|underway|launched|on its way)\b/,
  /\b(your|the|a)\s+([a-z-]+\s+){0,2}(reminder|alarm|event|habit|calendar entry)\s+(is|has been|'s)\s+(now\s+)?(set|scheduled|added|logged|booked|on)\b/,
  /\b(your|the)\s+streak\s+(is|has been|'s)\s+(now\s+)?paused\b/,
  /\b(it's|it is|that's|that is|you're all)\s+(now\s+)?(started|underway|launched|scheduled|logged|paused|added|booked|done|set)\b/,
  /^(done|all set|started|it's started)\b/,
  /\b(starting|launching|opening) (it|your|the|a|an)\b[^?]*\bnow\b/,
];
const CLAIM_FR = [
  /\b(j'ai|je t'ai|on a|je viens de)\s+(bien\s+)?(lancé|lancer|démarré|démarrer|commencé|ajouté|ajouter|programmé|programmer|activé|réglé|régler|ouvert|planifié|créé|mis en pause)(?![\p{L}\p{N}])/u,
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
  if (action && coachActionSpec(action.type)?.confirm) return { reply: offerLine(action, lang, units), rewritten: true };
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
  days: { type: "integer", minimum: 1, maximum: PAUSE_MAX_DAYS, description: "pause_streak: how many days from today." },
} as const;
