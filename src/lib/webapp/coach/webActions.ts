/**
 * The coach's app actions in the web app (VVFit ADR-0063, build 55): what the browser does with an action the coach
 * returns (game-core coachActions.ts, copied beside this file). The coach never runs anything: the chat shows a
 * confirm card, nothing starts before the tap, and only then the coach's line says what really happened.
 *
 * The web runs: start_workout (the browser's GPS / heart-strap workout, the sport given or today's plan),
 * start_camera_workout (the webcam workout, the routine given or the last pick), add_to_calendar (an .ics file),
 * pause_streak (POST /v1/me/pause, as Journey's pause card) and log_habit for the habits the web keeps (water, a meal,
 * bedtime; rhythm.ts). Everything else (the daily move, a reminder, another habit) says plainly that it starts on the
 * phone, with no button. Nothing starts while a workout runs in this browser. Pure.
 */
import { icsEscape, icsFold } from "../living/icsCore";
import { normalizeSportWord, sportName, sportWords } from "../living/sportCatalog";
import {
  cleanCoachAction,
  coachActionResult,
  gateCoachAction,
  isCoachActionKind,
  offerLine,
  type ActionLineKey,
  type CoachActionFail,
  type CoachAppAction,
} from "./coachActions";

export type Lang = "en" | "fr";

/** Today's planned session as the web knows it (GET /v1/plan/week), or a rest day; undefined = unknown. */
export interface TodayPlan {
  rest?: boolean;
  sport?: string;
  minutes?: number;
}

/** A turn's card and where it stands. `expired`: a card from an earlier visit (never run after a reload). */
export type CardState = "pending" | "busy" | "done" | "cancelled" | "failed" | "expired";
export interface CardTurn {
  action: CoachAppAction;
  state: CardState;
  /** The live call's id for this card (app_action's tool call): `card{id,state}` and answer_card use it. */
  id?: string;
  /** show_places: where the search stands, then the places found (ADR-0068). */
  places?: PlacesView;
}

/** A places card: the location ask, the search, the places, or why there are none. */
export type PlacesView =
  | { kind: "ask" }
  | { kind: "searching" }
  | { kind: "busy" }
  | { kind: "none" }
  | { kind: "list"; items: { name: string; awayKm: number; loopKm?: number; minutes?: number; lat: number; lon: number }[] };

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
  "failed",
];
const line = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/**
 * The reply's action as a card, when it is one of the catalog's kinds that change something (open_screen stays the
 * existing button): its fields checked and bounded again by game-core (`cleanCoachAction`), `planned` kept, and the
 * server's card and result lines (already in the athlete's language) kept over ours. Null for anything else. Pure.
 */
export function cardActionOf(raw: unknown, lang: Lang, today?: TodayPlan): CoachAppAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isCoachActionKind(r.type) || r.type === "open_screen") return null;
  const clean = cleanCoachAction(r, { lang, ...(today ? { today } : {}) });
  if (!clean) return null;
  const c = (r.card ?? {}) as Record<string, unknown>;
  const title = line(c.title, 80);
  const confirm = line(c.confirm, 24);
  const cancel = line(c.cancel, 24);
  const detail = line(c.detail, 120);
  const card = title && confirm && cancel ? { title, ...(detail ? { detail } : {}), confirm, cancel } : clean.card;
  const sent = (r.lines ?? {}) as Record<string, unknown>;
  const lines = { ...clean.lines };
  for (const k of LINE_KEYS) {
    const v = line(sent[k], 200);
    if (v) lines[k] = v;
  }
  return { ...clean, ...(r.planned === true && r.type === "start_workout" ? { planned: true } : {}), card, lines };
}

/** The habits the web keeps (rhythm.ts HabitKey) for a habit as the athlete named it, else null. Pure. */
export function webHabitOf(habit: string | undefined): "water" | "meal" | "bed" | null {
  const h = normalizeSportWord(habit ?? "");
  if (!h) return null;
  if (/\b(water|drink|glass|glasses|hydrat\w*|eau|boire|verre|verres)\b/.test(h)) return "water";
  if (/\b(meal|meals|eat|food|breakfast|lunch|dinner|repas|manger|petit dejeuner|dejeuner|diner)\b/.test(h)) return "meal";
  if (/\b(bed|bedtime|sleep|asleep|coucher|dormir|sommeil|lit)\b/.test(h)) return "bed";
  return null;
}

/** What the card offers on the web now. */
export type WebCardPlan = { kind: "run" } | { kind: "line"; reason: CoachActionFail; turnOnCamera?: boolean };

/**
 * May the web run this card now: `run` (show [confirm] [cancel]), or the one line to show instead (no button):
 * `in_workout` while a workout runs here, `camera_off` (with a button to turn Camera & trainings on), `not_here` for
 * what starts on the phone. Quiet never blocks it (the athlete asked). Pure.
 */
export function webCardPlan(a: CoachAppAction, s: { inWorkout: boolean; cameraOn: boolean }): WebCardPlan {
  const g = gateCoachAction(a, { device: "web", inWorkout: s.inWorkout, cameraOn: s.cameraOn });
  if (!g.ok) return { kind: "line", reason: g.reason, ...(g.reason === "camera_off" ? { turnOnCamera: true } : {}) };
  // The catalog hands log_habit to the phone; the web keeps water, meals and bedtime itself, so it logs those here.
  if (g.handoff) return a.type === "log_habit" && webHabitOf(a.habit) ? { kind: "run" } : { kind: "line", reason: "not_here" };
  return { kind: "run" };
}

/** The coach's line once the web ran (or could not run) it: the server's line when it sent one, else game-core's. Pure. */
export function resultLine(
  a: CoachAppAction,
  outcome: { ok: true } | { ok: false; reason: CoachActionFail | "cancelled" },
  lang: Lang,
): string {
  const key: ActionLineKey = outcome.ok ? "done" : outcome.reason;
  return a.lines?.[key] ?? coachActionResult(a, outcome.ok ? { ok: true, on: "web" } : { ok: false, reason: outcome.reason }, lang);
}

/** The sport a confirmed start_workout starts: the one given, else today's planned one; none → `no_plan_today`. Pure. */
export function workoutSport(
  a: Pick<CoachAppAction, "sport" | "planned">,
  today?: TodayPlan,
): { sport: string } | { fail: "no_plan_today" } {
  if (a.sport) return { sport: a.sport };
  if (today && !today.rest && today.sport) return { sport: today.sport };
  return { fail: "no_plan_today" };
}

/** The camera workout's routine: a catalogue id, or undefined for the last pick (the screen's Start at the top). Pure. */
export const cameraRoutineOf = (a: Pick<CoachAppAction, "routine">): string | undefined =>
  a.routine && a.routine !== "last" ? a.routine : undefined;

/** The streak pause's last day (inclusive) for `days` from `today` (YYYY-MM-DD, local). Pure. */
export function pauseUntil(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + Math.max(1, Math.round(days)) - 1));
  return t.toISOString().slice(0, 10);
}

const icsUtc = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/**
 * The calendar entry as an .ics file (one VEVENT in UTC, a 15-minute alarm, nothing personal), or `past_time` when
 * it starts before now. `date` + `at` are this browser's local day and time. Pure given the clock and the zone.
 */
export function actionIcs(
  a: Pick<CoachAppAction, "date" | "at" | "sport" | "minutes">,
  lang: Lang,
  nowMs: number,
  uid: string,
): { ics: string; file: string } | { fail: "past_time" | "failed" } {
  if (!a.date || !a.at) return { fail: "failed" };
  const [y, m, d] = a.date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = a.at.split(":").map(Number) as [number, number];
  const start = new Date(y, m - 1, d, hh, mm).getTime();
  if (!Number.isFinite(start)) return { fail: "failed" };
  if (start < nowMs) return { fail: "past_time" };
  const minutes = a.minutes ?? 30;
  const what = a.sport ? sportName(a.sport, lang) : lang === "fr" ? "Séance" : "Workout";
  const summary = `${what.charAt(0).toUpperCase()}${what.slice(1)} · VVake`;
  const desc = lang === "fr" ? "Prévu avec ton coach VVake." : "Planned with your VVake coach.";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VVake//Coach 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:coach-${uid}@vvake.com`,
    `DTSTAMP:${icsUtc(nowMs)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(start + minutes * 60_000)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT15M",
    `DESCRIPTION:${icsEscape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { ics: lines.map(icsFold).join("\r\n") + "\r\n", file: `vvake-${a.sport ?? "workout"}-${a.date}.ics` };
}

// ── The web's own fallback (the coach can't be reached) ─────────────────────────────────────────────────────────

const START = /\b(start|begin|go for|kick off|lets go|launch|lance|lancer|lance moi|demarre|demarrer|commence|commencer|on y va)\b/;
const TODAY = /\b(today|todays|planned|my session|my workout|aujourd hui|du jour|prevue?|ma seance)\b/;
const CAMERA = /\b(camera|webcam)\b/;
const wordsCache: Partial<Record<Lang, [string, string][]>> = {};
const sportPhrases = (lang: Lang): [string, string][] =>
  (wordsCache[lang] ??= Object.entries(sportWords(lang))
    .map(([w, k]) => [normalizeSportWord(w), k] as [string, string])
    .filter(([w]) => w.length >= 3)
    .sort((x, y) => y[0].length - x[0].length));

/**
 * When the coach can't be reached (offline, the API down): a plain "start a run" / « lance une course » still gets its
 * card, made here with game-core's `cleanCoachAction`, and the coach's offer line (`offerLine`), which never says it
 * was done. Anything else: null (the chat says it couldn't reach the coach). Pure.
 */
export function localCardFor(message: string, lang: Lang, today?: TodayPlan): { action: CoachAppAction; reply: string } | null {
  const m = ` ${normalizeSportWord(message)} `;
  if (!START.test(m)) return null;
  let raw: Record<string, unknown> | null = null;
  const mins = /\b(\d{1,3}) ?(min|mins|minute|minutes)\b/.exec(m);
  const minutes = mins ? Number(mins[1]) : undefined;
  if (CAMERA.test(m)) raw = { type: "start_camera_workout", routine: "last", ...(minutes ? { minutes } : {}) };
  else {
    const hit = sportPhrases(lang).find(([w]) => m.includes(` ${w} `));
    if (hit) raw = { type: "start_workout", sport: hit[1], ...(minutes ? { minutes } : {}) };
    else if (TODAY.test(m) && today && !today.rest && today.sport) raw = { type: "start_workout", planned: true };
  }
  const action = raw ? cleanCoachAction(raw, { lang, ...(today ? { today } : {}) }) : null;
  return action ? { action, reply: offerLine(action, lang) } : null;
}
