import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import type { WebSession } from "./workout";
import {
  auditSchema,
  editReplySchema,
  feasibilityReplySchema,
  reviewReplySchema,
  seasonSchema,
  todaySchema,
  type EditDraft,
  type HealthFlags,
  type SeasonGoal,
  type SeasonPrefs,
  type ServerEdit,
} from "./season";
import { editBody, editsBody } from "./planEdit";
import { coachVoiceGender, coachVoicesSchema, type CoachVoiceGender } from "@/lib/coachVoices";

/**
 * The web app's API calls (vvake.com/app): the same endpoints the phone uses (monorepo docs/05-tech/api-v1.md), on the
 * signed-in web session (src/lib/rewardsApi.ts RewardsSession, "local" kind). Parsed leniently like the account page:
 * a field a newer API renames shows as missing, never as a broken screen.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());
/** `lang=en&voice=woman`: a voice endpoint's query (the language and the coach voice, always both). */
export const voiceQ = (lang: string, voice: unknown) => `lang=${lang === "fr" ? "fr" : "en"}&voice=${coachVoiceGender(voice)}`;

export const athleteSchemaForApp = z.object({
  survey: opt(
    z.object({
      sports: opt(z.array(z.object({ sport: z.string(), experience: str, sessionsPerWeek: num, usualMin: num }))),
      aim: str,
      daysPerWeek: num,
      minutesPerDay: num,
      painOrInjury: bool,
    }),
  ),
  health: opt(
    z.object({
      age: num,
      sex: str,
      restingHr: num,
      maxHr: num,
      zones: opt(z.record(z.string(), z.array(z.number()))),
    }),
  ),
});
export type AppAthlete = z.infer<typeof athleteSchemaForApp>;

/** What the app's first-run survey sends (PUT /v1/athlete; the API's surveySchema). */
export interface SurveyPut {
  sports: {
    sport: string;
    experience: "new" | "returning" | "regular" | "trained" | "competitive";
    sessionsPerWeek: number;
    usualMin: number;
  }[];
  aim: "health" | "consistency" | "faster" | "longer" | "event" | "weight" | "strength" | "calm";
  daysPerWeek: number;
  minutesPerDay: number;
  painOrInjury: boolean;
}

export const appMeSchema = z.object({
  id: z.string(),
  name: str,
  email: str,
  city: str,
  guest: bool,
  castId: str,
  vvakerCode: str,
  plan: str,
  plusUntil: str,
  /** Free / Plus / Premium (ADR-0051; "pro" before the rename) and early testers (Premium): coachPlus.ts. */
  tier: str,
  earlyTester: bool,
  coach: opt(
    z.object({ on: bool, chattiness: str, voice: str, units: str, /** ADR-0056: "woman" | "man" (absent: woman). */ voiceGender: str }),
  ),
  prefs: opt(
    z.object({
      lang: str,
      theme: str,
      timeFormat: str,
      dateFormat: str,
      /** ADR-0044: `{ mode, at }` and `{ at, sports }`, checked by workoutPrefs.ts (a bad value reads as none). */
      workoutVoice: z.optional(z.unknown()),
      speedZones: z.optional(z.unknown()),
      /** Sport zones (ADR-0048): `{ at, rpe?, sports }`, checked by sportHeart.ts; absent until the API keeps it. */
      heartZones: z.optional(z.unknown()),
      /** "Your VVake" (ADR-0059): `{ v, tailorOn, answers, overrides?, source, at }`, checked by tailor/prefs.ts. */
      tailor: z.optional(z.unknown()),
      /** Quiet (ADR-0062 §4.4): `{ level, at }`, checked by suggest/prefs.ts; absent until the API keeps it. */
      suggest: z.optional(z.unknown()),
      /** Show on Home (build 54): `{ gps, camera, at }`, checked by startWays.ts; absent until the API keeps it. */
      startWays: z.optional(z.unknown()),
      /** Next steps (ADR-0062 §4.3): `{ ledger, at }`, checked by suggest/steps.ts; absent until the API keeps it. */
      steps: z.optional(z.unknown()),
    }),
  ),
  consents: opt(z.object({ disclaimer: opt(z.object({ version: z.number(), acceptedAt: z.string() })) })),
});
export type AppMe = z.infer<typeof appMeSchema>;

const period = z.object({ sessions: z.number(), activeMin: z.number(), distanceM: z.number(), scored: z.number() });
export const statsSchema = z.object({
  week: period,
  month: period,
  all: period,
  streakDays: num,
  best: opt(z.object({ longestM: num, longestMin: num, fastestKmS: num })),
});
export type Stats = z.infer<typeof statsSchema>;

export const streakSchema = z.object({ days: z.number(), best: num, todayCounts: bool, multiplier: num });
export type Streak = z.infer<typeof streakSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  sport: z.string(),
  source: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  activeS: z.number(),
  distanceM: num,
  avgBpm: num,
  maxBpm: num,
  zoneS: opt(z.array(z.number())),
  tier: str,
  flags: opt(z.array(z.string())),
  points: num,
  excluded: bool,
  samples: opt(z.array(z.object({ t: z.number(), m: z.number(), bpm: num }))),
  pointsDetail: opt(z.object({ base: z.number(), streakBonus: z.number(), total: z.number(), streakDays: z.number() })),
  /** A camera workout (ADR-0046): its counts, the camera points it got and why (ok, budget, too_little…). */
  camera: opt(
    z.object({
      moves: z.array(
        z.object({ id: z.string(), sets: z.array(z.object({ reps: z.number(), holdS: num, loadKg: num, side: str, judged: z.string() })) }),
      ),
      liveness: opt(z.object({ asked: z.number(), passed: z.number() })),
    }),
  ),
  cameraPoints: num,
  cameraReason: str,
  /** Vehicle guard (build 58): seconds left out as a vehicle stretch (flag "vehicle" when mostly vehicle). */
  vehicleS: num,
  /** A workout continued on another device (build 58, watch takeover): the parts merged by the API, in order. */
  handover: bool,
  sources: opt(z.array(z.object({ device: z.string(), minutes: z.number(), hr: bool }))),
});
export type ApiSession = z.infer<typeof sessionSchema>;
const sessionsSchema = z.object({ sessions: z.array(sessionSchema), next: str });

const pointsSchema = z.object({ base: z.number(), streakBonus: z.number(), total: z.number(), streakDays: z.number() });
const uploadSchema = z.object({ session: opt(sessionSchema), points: opt(pointsSchema), status: str });
export type UploadReply = z.infer<typeof uploadSchema>;
const batchSchema = z.object({ results: z.array(z.object({ id: z.string(), status: z.string(), error: str })) });

const weekSchema = z.object({
  days: z.array(z.object({ date: z.string(), sport: z.string(), minutes: z.number(), start: z.string(), end: z.string() })),
  fromSurvey: bool,
});
export type Week = z.infer<typeof weekSchema>;

const planChangeSchema = z.object({
  id: z.string(),
  status: z.string(),
  summary: str,
  day: str,
  source: str,
  /** A season change (ADR-0050): its edits, and one plain line per edit to show under the summary. */
  season: opt(z.object({ lines: opt(z.array(z.string())), reason: str })),
});
export type PlanChange = z.infer<typeof planChangeSchema>;

const coachReplySchema = z.object({
  reply: z.string(),
  /** Plus, when asked for: the reply in the coach's voice (`tag`: which voice, the API's voiceTag). */
  voice: opt(z.object({ key: z.string(), url: z.string(), tag: str })),
  /**
   * `open_screen` (ADR-0062 §5): an app route and its button label; the web opens the matching screen (suggest/steps.ts).
   * The app actions (ADR-0063, with `actions: 2`): every other field is kept as sent (card, lines, planned, routine…)
   * and checked again by coach/webActions.ts cardActionOf before a card is shown.
   */
  action: opt(z.looseObject({ type: z.string(), sport: str, minutes: num, proposal: opt(planChangeSchema), route: str, label: str })),
});
export type CoachReply = z.infer<typeof coachReplySchema>;

/** GET /v1/voice/pack and /v1/voice/library: the recorded lines (the same for every account) and their audio. */
const voiceItems = z.array(z.object({ id: z.string(), text: z.string(), url: opt(z.string()) }));
export const voiceSetSchema = z.object({
  version: z.union([z.string(), z.number()]),
  voice: str,
  voiceTag: str,
  items: voiceItems,
});
export type VoiceSet = z.infer<typeof voiceSetSchema>;
/** POST /v1/voice/lines: a line's audio when Plus may record it or anyone recorded it already, else url null. */
const voiceLinesSchema = z.object({
  voiceTag: str,
  items: z.array(z.object({ text: z.string(), key: str, url: str })),
});

const clashSide = z.object({ city: z.string(), score: z.number(), movers: num, participants: num });
const clashSchema = z.object({
  id: z.string(),
  a: clashSide,
  b: clashSide,
  status: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  focus: bool,
  calledOutBy: str,
  result: opt(z.object({ winner: str, winnerSide: str })),
});
export type Clash = z.infer<typeof clashSchema>;
const clashesSchema = z.object({ clashes: z.array(clashSchema) });

const habitsSchema = z.object({
  days: opt(z.array(z.object({ day: z.string(), score: num, points: num }))),
  streak: opt(z.object({ current: z.number(), best: z.number() })),
  lastDay: str,
  points: num,
});
export type Habits = z.infer<typeof habitsSchema>;

export interface HabitDaySend {
  day: string;
  water?: { glasses: number; target: number };
  meals?: { done: number; target: number };
  sleep?: { bedAt?: number; target: number };
}

/** The coach's `context.where`: the web screen talked from and the last moment (a finished session) when there is one. */
export interface CoachWhere {
  screen: string;
  last?: { kind: string; sport?: string; minutes?: number; feel?: SessionFeel };
}

/** How a finished session felt (the phone's SessionFeel). */
export type SessionFeel = "hard" | "right" | "easy";

export interface CoachContext {
  sport?: string;
  elapsedS?: number;
  bpm?: number;
  zone?: number;
  distanceM?: number;
  paceSPerKm?: number;
  /** "How did it feel?" after a session (the phone's SessionFeedback): the coach answers it and may propose a change. */
  feedback?: { feel: SessionFeel; sport: string; minutes: number };
  /** Where the athlete is (ADR-0062 §5): the screen, and what they just finished (≤ 200 characters as JSON). */
  where?: CoachWhere;
  /** Today's planned session (or a rest day): the coach's "start today's session" card follows it (ADR-0063). */
  today?: { rest?: boolean; sport?: string; minutes?: number };
  goals?: {
    title: string;
    kind: string;
    done: number;
    target: number;
    daysLeft: number;
    onTrack: boolean;
    perWeekNeeded: number;
    status: string;
  }[];
}

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const tzQ = (tz: string) => `tz=${encodeURIComponent(tz)}`;

/** GET /v1/me/usage30 (ADR-0059): what the survey is pre-filled with; checked by tailor/prefs.ts (cleanAnswers). */
const usage30Schema = z.object({
  usage: z.optional(z.object({ desk: opt(z.object({ linked: bool })) })),
  inferred: opt(z.object({ answers: z.optional(z.unknown()), overrides: z.optional(z.unknown()) })),
});
export type Usage30 = z.infer<typeof usage30Schema>;
/** GET /v1/desk: only whether a Mac or Claude desk is linked (the Desk feature's default, ADR-0059 decision 9). */
const deskLinkSchema = z.object({ desks: opt(z.array(z.object({ id: z.string() }))) });

export function webApi(s: RewardsSession) {
  return {
    me: () => s.call("/v1/me", GET, appMeSchema),
    patchMe: (p: Record<string, unknown>) => s.call("/v1/me", send("PATCH", p), appMeSchema),
    usage30: () => s.call("/v1/me/usage30", GET, usage30Schema),
    deskLinked: async () => ((await s.call("/v1/desk", GET, deskLinkSchema)).desks?.length ?? 0) > 0,
    stats: (tz: string) => s.call(`/v1/stats?${tzQ(tz)}`, GET, statsSchema),
    streak: (tz: string) => s.call(`/v1/streak?${tzQ(tz)}`, GET, streakSchema),
    sessions: (before?: string, limit = 30) =>
      s.call(`/v1/sessions?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`, GET, sessionsSchema),
    session: (id: string) => s.call(`/v1/sessions/${encodeURIComponent(id)}`, GET, sessionSchema),
    deleteSession: (id: string) => s.call(`/v1/sessions/${encodeURIComponent(id)}`, send("DELETE"), null),
    upload: (session: WebSession, tz: string) => s.call(`/v1/sessions?${tzQ(tz)}`, send("POST", session), uploadSchema),
    uploadBatch: (sessions: WebSession[], tz: string) => s.call(`/v1/sessions/batch?${tzQ(tz)}`, send("POST", { sessions }), batchSchema),
    athlete: () => s.call("/v1/athlete", GET, athleteSchemaForApp),
    putAthlete: (b: { survey: SurveyPut; health?: { age?: number; sex?: "female" | "male"; restingHr?: number; maxHr?: number } }) =>
      s.call("/v1/athlete", send("PUT", b), athleteSchemaForApp),
    week: (tz: string, lang: string) => s.call(`/v1/plan/week?${tzQ(tz)}&lang=${lang}`, GET, weekSchema),
    planChanges: async () => (await s.call("/v1/plan/changes", GET, z.object({ changes: z.array(planChangeSchema) }))).changes,
    decidePlan: (id: string, decision: "accept" | "reject") =>
      s.call(`/v1/plan/changes/${id}?device=web`, send("POST", { decision }), null),
    /** An approved season change taken back (within 30 days): all its edits stop applying. */
    undoPlanChange: (id: string) => s.call(`/v1/plan/changes/${id}/undo?device=web`, send("POST", {}), null),
    /** POST /v1/plan/today: today's session, with the season's purpose, phase and goal when there is a season. */
    planToday: (tz: string, lang: string) => s.call("/v1/plan/today", send("POST", { tz, lang: lang === "fr" ? "fr" : "en" }), todaySchema),
    // Season plans (ADR-0050): every answer is the whole season (GET /v1/season's shape).
    season: (tz: string, lang: string, week?: number) =>
      s.call(`/v1/season?${tzQ(tz)}&lang=${lang}${week !== undefined ? `&week=${week}` : ""}`, GET, seasonSchema),
    putSeason: (b: { goals?: SeasonGoal[]; deleted?: string[]; prefs?: SeasonPrefs; health?: HealthFlags }, tz: string, lang: string) =>
      s.call(`/v1/season?${tzQ(tz)}&lang=${lang}`, send("PUT", { ...b, device: "web" }), seasonSchema),
    deleteSeasonGoal: (id: string, tz: string, lang: string) =>
      s.call(`/v1/season/goals/${encodeURIComponent(id)}?${tzQ(tz)}&lang=${lang}`, send("DELETE"), seasonSchema),
    /** The what-if: a goal's verdict for another date or other weekly hours; nothing is stored. */
    feasibility: (b: { goal: SeasonGoal; date?: string; hoursPerWeek?: number; health?: HealthFlags }, tz: string, lang: string) =>
      s.call(`/v1/season/feasibility?${tzQ(tz)}`, send("POST", { ...b, lang: lang === "fr" ? "fr" : "en" }), feasibilityReplySchema),
    reviewGoal: (id: string, tz: string, lang: string) =>
      s.call(`/v1/season/goals/${encodeURIComponent(id)}/review?${tzQ(tz)}&lang=${lang}`, send("POST", {}), reviewReplySchema),
    seasonEdit: (edit: EditDraft | ServerEdit, tz: string, lang: string) =>
      s.call(`/v1/season/edits?${tzQ(tz)}&lang=${lang}`, send("POST", editBody(edit)), editReplySchema),
    /** Several edits at once (the coach note's one-tap rebalance), undone together. */
    seasonEdits: (edits: readonly (EditDraft | ServerEdit)[], tz: string, lang: string) =>
      s.call(`/v1/season/edits?${tzQ(tz)}&lang=${lang}`, send("POST", editsBody(edits)), editReplySchema),
    undoSeasonEdit: (id: string, tz: string, lang: string) =>
      s.call(`/v1/season/edits/${encodeURIComponent(id)}?${tzQ(tz)}&lang=${lang}&device=web`, send("DELETE"), seasonSchema),
    seasonAudit: () => s.call("/v1/season/audit", GET, auditSchema),
    /** A plain request about the week: understood → a proposal to approve; else the app sends it to the coach chat. */
    seasonAsk: (text: string, tz: string, lang: string) =>
      s.call(
        `/v1/season/ask?${tzQ(tz)}`,
        send("POST", { text, lang: lang === "fr" ? "fr" : "en" }),
        z.object({ understood: z.boolean(), intent: str, proposal: opt(planChangeSchema) }),
      ),
    /** Does the plan want to change (sick, hurt, tired, missed sessions)? A proposal to approve, never applied by itself. */
    seasonAdapt: (signals: { sick?: boolean; injured?: boolean; sleepHours?: number } | undefined, lang: string) =>
      s.call(
        "/v1/season/adapt",
        send("POST", { ...(signals ? { signals } : {}), lang: lang === "fr" ? "fr" : "en" }),
        z.object({
          proposal: opt(planChangeSchema),
          waiting: opt(z.boolean()),
          raceDone: opt(z.object({ goalId: z.string(), summary: str })),
        }),
      ),
    /**
     * POST /v1/coach/live-call/ticket: a one-use ticket (60 s) for a live call's WebSocket (monorepo
     * docs/05-tech/live-call.md). A 409 `{ reason }` (off, scripted, used, quiet, day_cap…) means "go on without it".
     */
    liveCallTicket: (b: { mode: "workout" | "call" | "onboarding" | "talk"; lang: string; callId?: string; sessionId?: string }) =>
      s.call(
        "/v1/coach/live-call/ticket",
        send("POST", { ...b, lang: b.lang === "fr" ? "fr" : "en" }),
        z.object({ ticket: z.string(), url: str, liveCallId: str, allowanceS: num }),
      ),
    coachTalk: (b: {
      message: string;
      history?: { role: "user" | "coach"; text: string }[];
      context?: CoachContext;
      lang: string;
      units: string;
      clock: string;
      /** The reply in the coach's voice (Plus; counted in the API's daily voice quota). */
      voice?: boolean;
      /** The coach action card on screen (ADR-0068): "no, rather Thursday" is read against it by the server. */
      card?: { id: string; type: string };
      /** The athlete's local hour and day (meals, "the next 5 hours", summaries); the screen the talk was opened on. */
      localHour?: number;
      localDay?: string;
    }) =>
      // actions: 2 = this app shows the coach's action cards (ADR-0063); an older API just ignores it.
      s.call("/v1/coach/talk", send("POST", { ...b, voice: b.voice === true, actions: 2 }), coachReplySchema),
    // Every voice fetch names the coach voice (ADR-0056: `voice=woman|man`), never left to the account's setting.
    voicePack: (lang: string, voice: CoachVoiceGender) => s.call(`/v1/voice/pack?${voiceQ(lang, voice)}`, GET, voiceSetSchema),
    voiceLibrary: (lang: string, imperial: boolean, voice: CoachVoiceGender) =>
      s.call(`/v1/voice/library?${voiceQ(lang, voice)}${imperial ? "&units=imperial" : ""}`, GET, voiceSetSchema),
    /** GET /v1/voice/app: the app's fixed lines (camera, teach a move, check-ins, the preview), for every account. */
    voiceApp: (lang: string, voice: CoachVoiceGender) => s.call(`/v1/voice/app?${voiceQ(lang, voice)}`, GET, voiceSetSchema),
    voiceLines: (lines: string[], lang: string, voice: CoachVoiceGender) =>
      s.call(
        "/v1/voice/lines",
        send("POST", { lines, lang: lang === "fr" ? "fr" : "en", voice: coachVoiceGender(voice) }),
        voiceLinesSchema,
      ),
    /** GET /v1/voice/voices (public): the language's two coach voices and their "Hear it" line. */
    coachVoices: (lang: string) => s.call(`/v1/voice/voices?lang=${lang === "fr" ? "fr" : "en"}`, GET, coachVoicesSchema),
    clashes: (status?: "live" | "upcoming" | "recent") => s.call(`/v1/clashes${status ? `?status=${status}` : ""}`, GET, clashesSchema),
    habits: (tz: string) => s.call(`/v1/habits?${tzQ(tz)}`, GET, habitsSchema),
    sendHabitDay: (d: HabitDaySend, tz: string) => s.call(`/v1/habits/days?${tzQ(tz)}`, send("POST", d), habitsSchema),
  };
}
export type WebApi = ReturnType<typeof webApi>;

export const localTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
