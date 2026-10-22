import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import type { WebSession } from "./workout";

/**
 * The web app's API calls (vvake.com/app): the same endpoints the phone uses (monorepo docs/05-tech/api-v1.md), on the
 * signed-in web session (src/lib/rewardsApi.ts RewardsSession, "local" kind). Parsed leniently like the account page:
 * a field a newer API renames shows as missing, never as a broken screen.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());

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
  coach: opt(z.object({ on: bool, chattiness: str, voice: str, units: str })),
  prefs: opt(
    z.object({
      lang: str,
      theme: str,
      timeFormat: str,
      dateFormat: str,
      /** ADR-0044: `{ mode, at }` and `{ at, sports }`, checked by workoutPrefs.ts (a bad value reads as none). */
      workoutVoice: z.optional(z.unknown()),
      speedZones: z.optional(z.unknown()),
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

const planChangeSchema = z.object({ id: z.string(), status: z.string(), summary: str, day: str });
export type PlanChange = z.infer<typeof planChangeSchema>;

const coachReplySchema = z.object({
  reply: z.string(),
  /** Plus, when asked for: the reply in the coach's voice (`tag`: which voice, the API's voiceTag). */
  voice: opt(z.object({ key: z.string(), url: z.string(), tag: str })),
  action: opt(z.object({ type: z.string(), sport: str, minutes: num, proposal: opt(planChangeSchema) })),
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

export interface CoachContext {
  sport?: string;
  elapsedS?: number;
  bpm?: number;
  zone?: number;
  distanceM?: number;
  paceSPerKm?: number;
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

export function webApi(s: RewardsSession) {
  return {
    me: () => s.call("/v1/me", GET, appMeSchema),
    patchMe: (p: Record<string, unknown>) => s.call("/v1/me", send("PATCH", p), appMeSchema),
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
    decidePlan: (id: string, decision: "accept" | "reject") => s.call(`/v1/plan/changes/${id}`, send("POST", { decision }), null),
    coachTalk: (b: {
      message: string;
      history?: { role: "user" | "coach"; text: string }[];
      context?: CoachContext;
      lang: string;
      units: string;
      clock: string;
      /** The reply in the coach's voice (Plus; counted in the API's daily voice quota). */
      voice?: boolean;
    }) => s.call("/v1/coach/talk", send("POST", { ...b, voice: b.voice === true }), coachReplySchema),
    voicePack: (lang: string) => s.call(`/v1/voice/pack${lang === "fr" ? "?lang=fr" : ""}`, GET, voiceSetSchema),
    voiceLibrary: (lang: string, imperial: boolean) => {
      const q = [lang === "fr" ? "lang=fr" : "", imperial ? "units=imperial" : ""].filter(Boolean).join("&");
      return s.call(`/v1/voice/library${q ? `?${q}` : ""}`, GET, voiceSetSchema);
    },
    /** GET /v1/voice/app: the app's fixed lines (camera, teach a move, check-ins, the preview), for every account. */
    voiceApp: (lang: string) => s.call(`/v1/voice/app${lang === "fr" ? "?lang=fr" : ""}`, GET, voiceSetSchema),
    voiceLines: (lines: string[], lang: string) =>
      s.call("/v1/voice/lines", send("POST", { lines, lang: lang === "fr" ? "fr" : "en" }), voiceLinesSchema),
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
