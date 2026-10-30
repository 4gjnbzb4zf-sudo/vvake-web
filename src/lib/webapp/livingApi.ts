import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import { LEAGUE_TIERS, type LeagueTier } from "./living/leagues";
import type { MilestoneSnapshot } from "./living/celebrations";
import type { PauseKind } from "./living/streakCare";

/**
 * The living app's API calls on the web (VVFit docs/05-tech/api-v1.md: "Place notes and meetups", "The journey, the
 * pause and weekly leagues"): the same endpoints the phone uses, parsed leniently (a field a newer API renames reads as
 * missing, never as a broken screen). The rules (checks, copy, celebrations) are game-core's, copied in ./living.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());
const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

// ── The journey ─────────────────────────────────────────────────────────────────────────────────────────────────────

const stoneSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  done: z.boolean(),
  doneDay: str,
  count: num,
  target: num,
});
export type JourneyStoneView = z.infer<typeof stoneSchema>;
const chapterSchema = z.object({
  id: z.string(),
  index: z.number(),
  kind: z.string(),
  phase: str,
  title: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.string(),
  stones: z.catch(z.array(stoneSchema), []),
  stonesDone: num,
  complete: bool,
});
export type JourneyChapterView = z.infer<typeof chapterSchema>;
const pauseSchema = z.object({
  kind: z.string(),
  from: z.string(),
  until: z.string(),
  at: str,
  active: bool,
  daysLeft: num,
  text: str,
});
export type PauseView = z.infer<typeof pauseSchema>;
export const journeySchema = z.object({
  today: z.string(),
  kind: str,
  chapters: z.catch(z.array(chapterSchema), []),
  current: opt(chapterSchema),
  currentStone: opt(stoneSchema),
  road: z.catch(z.array(z.object({ day: z.string(), mark: z.string() })), []),
  progress: opt(z.object({ chapter: num, chapters: num, stonesDone: num, stones: num, fraction: num })),
  line: str,
  weeklyStreak: opt(z.object({ weeks: z.number(), best: num, thisWeek: str, needed: num, minimum: num, firstForPlan: bool })),
  pause: opt(pauseSchema),
  comeback: opt(
    z.object({
      stage: z.string(),
      card: bool,
      next: str,
      choices: z.catch(z.array(z.string()), []),
      text: str,
      lighter: bool,
    }),
  ),
  counters: opt(z.object({ sessions: num, weeksKept: num, weeklyStreak: num, stones: num, chapters: num, skillLevels: num })),
});
export type JourneyView = z.infer<typeof journeySchema>;

const leagueSchema = z.object({
  on: z.boolean(),
  week: str,
  region: opt(z.object({ kind: str, name: str })),
  tier: str,
  tierName: str,
  resting: bool,
  placed: bool,
  hint: str,
  cohort: opt(
    z.object({
      size: z.number(),
      members: z.catch(z.array(z.object({ rank: z.number(), label: z.string(), handle: str, me: bool, score: num })), []),
    }),
  ),
  rules: opt(z.object({ promote: num, demote: num, maxScore: num })),
  last: opt(z.object({ week: str, rank: num, size: num, score: num, outcome: str, nextTier: str, text: str })),
});
export type LeagueView = z.infer<typeof leagueSchema>;

export const isLeagueTier = (t: unknown): t is LeagueTier => typeof t === "string" && (LEAGUE_TIERS as readonly string[]).includes(t);

// ── Place notes ─────────────────────────────────────────────────────────────────────────────────────────────────────

const notesViewSchema = z.object({
  placeKey: str,
  shown: bool,
  count: z.catch(z.number(), 0),
  rating: num,
  recommendPct: num,
  tags: z.catch(z.array(z.object({ tag: z.string(), count: z.number() })), []),
  tips: z.catch(z.array(z.object({ id: str, text: z.string() })), []),
});
export type NotesView = z.infer<typeof notesViewSchema>;
const notesSchema = z.object({ notes: z.catch(z.record(z.string(), notesViewSchema), {}) });
const nearNewSchema = z.object({
  undocumented: bool,
  key: str,
  partial: bool,
  spot: opt(z.object({ key: z.string(), id: str, kind: str, name: str, distanceM: num, notes: opt(notesViewSchema) })),
});
export type NearNew = z.infer<typeof nearNewSchema>;
const noteReplySchema = z.object({ note: opt(z.object({ id: str, placeKey: str, textStatus: str })), notes: opt(notesViewSchema) });

// ── Meetups and friends ─────────────────────────────────────────────────────────────────────────────────────────────

const personSchema = z.object({ id: z.string(), name: str, castId: str, host: bool, answer: str, here: bool });
export const meetupSchema = z.object({
  id: z.string(),
  sport: z.string(),
  startsAt: z.string(),
  endsAt: str,
  durationMin: z.number(),
  status: z.string(),
  phase: z.string(),
  level: str,
  maxPeople: z.number(),
  going: num,
  sequence: num,
  host: z.object({ id: z.string(), name: str, castId: str }),
  me: z.object({ role: z.string(), answer: z.string(), here: bool, canHere: bool }),
  people: z.catch(z.array(personSchema), []),
  point: z.object({
    key: z.string(),
    kind: str,
    name: str,
    lat: num,
    lon: num,
    id: str,
    unavailable: bool,
    note: str,
    photo: bool,
    gone: bool,
  }),
  attribution: str,
  /** Build 63 (ADR-0071): "call" (train together over a call), the coach's lines, the countdown's end; a pin's expiry. */
  mode: str,
  coach: bool,
  goAt: str,
  pinExpiresAt: str,
});
export type MeetupView = z.infer<typeof meetupSchema>;
const friendSchema = z.object({ id: z.string(), displayName: str, castId: str, lastChallengeAt: str });
export type Friend = z.infer<typeof friendSchema>;
const friendsSchema = z.union([z.array(friendSchema), z.object({ friends: z.array(friendSchema) })]);

export interface MeetupCreate {
  sport: string;
  startsAt: string;
  durationMin: number;
  /** Absent for a call; `key: "pin"` with `pin`: a custom meeting point (members only). */
  point?: { key: string; set?: string; near?: { lat: number; lon: number } };
  pin?: { name: string; note?: string; lat: number; lon: number };
  mode?: "place" | "call";
  coach?: boolean;
  level?: string;
  maxPeople: number;
  invitees: string[];
}
export type MeetupReport = { reason: string; personId?: string; note?: string; block?: boolean };

const boardRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  state: z.string(),
  elapsedS: num,
  atMs: num,
  distanceM: num,
  reps: num,
  zone: num,
  audio: bool,
  me: z.boolean(),
  stale: bool,
  elapsedNowS: z.number(),
});
/** GET/POST /v1/meetups/:id/call…: the train-together board (ADR-0071). */
export const callBoardSchema = z.object({
  meetupId: z.string(),
  sport: z.string(),
  durationMin: z.number(),
  open: z.boolean(),
  goAt: str,
  coach: bool,
  host: bool,
  beatS: num,
  board: z.catch(z.array(boardRowSchema), []),
  cheers: z.catch(z.array(z.object({ fromId: z.string(), from: z.string(), kind: z.string(), atMs: z.number() })), []),
  audio: z.object({ state: z.string(), inCall: bool, minutesLeft: num, text: str }),
  serverMs: z.number(),
});
export type CallBoardView = z.infer<typeof callBoardSchema>;
export interface CallBeat {
  state: "waiting" | "running" | "paused" | "done";
  elapsedS?: number;
  distanceM?: number;
  reps?: number;
  zone?: number;
  audio?: boolean;
}
const sdpSchema = z.object({ type: z.string(), sdp: z.string() });
export type SdpView = { type: "offer" | "answer"; sdp: string };

export function livingApi(s: RewardsSession) {
  const fr = (lang: string) => (lang === "fr" ? "fr" : "en");
  return {
    journey: (tz: string, lang: string) => s.call(`/v1/journey?${q({ tz, lang: fr(lang) })}`, GET, journeySchema),
    /**
     * `from`: the first day off (default today); `shiftPlan`: the plan's sessions in those days move back (time off,
     * ADR-0068; an older API ignores it and only the streak pauses).
     */
    pause: (kind: PauseKind, tz: string, until?: string, o: { from?: string; shiftPlan?: boolean } = {}) =>
      s.call(
        `/v1/me/pause?${q({ tz })}`,
        send("POST", {
          kind,
          at: new Date().toISOString(),
          ...(until ? { until } : {}),
          ...(o.from ? { from: o.from } : {}),
          ...(o.shiftPlan ? { shiftPlan: true } : {}),
        }),
        z.object({ pause: opt(pauseSchema), ignored: bool }),
      ),
    endPause: (tz: string) => s.call(`/v1/me/pause?${q({ tz })}`, send("DELETE"), z.object({ pause: opt(pauseSchema) })),
    league: (tz: string, lang: string) => s.call(`/v1/leagues/me?${q({ tz, lang: fr(lang) })}`, GET, leagueSchema),
    notes: async (keys: readonly string[]) =>
      keys.length ? (await s.call(`/v1/places/notes?${q({ keys: keys.slice(0, 50).join(",") })}`, GET, notesSchema)).notes : {},
    /** Is this spot new? The point goes with 3 decimals at most (about 110 m), used for the answer and never kept. */
    nearNew: (sport: string, lat: number, lon: number) =>
      s.call(`/v1/places/near-new?${q({ sport, lat: lat.toFixed(3), lon: lon.toFixed(3) })}`, GET, nearNewSchema),
    addNote: (b: { placeKey: string; sport: string; rating: number; recommend: boolean; tags: string[]; text?: string }) =>
      s.call("/v1/places/notes", send("POST", b), noteReplySchema),
    reportTip: (id: string) => s.call(`/v1/places/notes/${encodeURIComponent(id)}/report`, send("POST", {}), null),
    friends: async (): Promise<Friend[]> => {
      const r = await s.call("/v1/friends", GET, friendsSchema);
      return Array.isArray(r) ? r : r.friends;
    },
    meetups: async () => (await s.call("/v1/meetups", GET, z.object({ meetups: z.catch(z.array(meetupSchema), []) }))).meetups,
    meetup: (id: string) => s.call(`/v1/meetups/${encodeURIComponent(id)}`, GET, meetupSchema),
    createMeetup: (b: MeetupCreate) => s.call("/v1/meetups", send("POST", b), meetupSchema),
    cancelMeetup: (id: string) => s.call(`/v1/meetups/${encodeURIComponent(id)}`, send("PATCH", { status: "cancelled" }), meetupSchema),
    meetupAct: (id: string, act: "join" | "leave" | "here") =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/${act}`, send("POST", {}), meetupSchema),
    reportMeetup: (id: string, b: MeetupReport) => s.call(`/v1/meetups/${encodeURIComponent(id)}/report`, send("POST", b), null),
    /** A custom pin's photo: a JPEG re-encoded in this page (no EXIF), and read back as a data: URL (members only). */
    putPinPhoto: (id: string, jpeg: Uint8Array) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/pin/photo`, { method: "PUT", body: jpeg as unknown as BodyInit }, null),
    pinPhoto: async (id: string) => {
      const r = await s.call(
        `/v1/meetups/${encodeURIComponent(id)}/pin/photo?format=b64`,
        GET,
        z.object({ mediaType: z.string(), data: z.string() }),
      );
      return `data:${r.mediaType};base64,${r.data}`;
    },
    // Train together over a call (ADR-0071): the board every 10 s, the countdown, cheers, leave quietly, audio.
    callBeat: (id: string, b: CallBeat, lang: string) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/call/beat?${q({ lang: fr(lang) })}`, send("POST", b), callBoardSchema),
    callGo: (id: string, lang: string) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/call/go?${q({ lang: fr(lang) })}`, send("POST", {}), callBoardSchema),
    callCheer: (id: string, to: string, kind: string, lang: string) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/call/cheer?${q({ lang: fr(lang) })}`, send("POST", { to, kind }), callBoardSchema),
    callLeave: (id: string, lang: string) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/call/leave?${q({ lang: fr(lang) })}`, send("POST", {}), callBoardSchema),
    callAudioJoin: async (id: string, offer: SdpView, mid: string) => {
      const r = await s.call(
        `/v1/meetups/${encodeURIComponent(id)}/call/audio`,
        send("POST", { offer, mid }),
        z.object({ sessionId: z.string(), answer: opt(sdpSchema), iceServers: z.catch(z.array(z.unknown()), []) }),
      );
      return { sessionId: r.sessionId, answer: (r.answer ?? null) as SdpView | null, iceServers: r.iceServers };
    },
    callAudioPull: async (id: string, sessionId: string, userIds: string[]) => {
      const r = await s.call(
        `/v1/meetups/${encodeURIComponent(id)}/call/audio/pull`,
        send("POST", { sessionId, userIds }),
        z.object({ offer: opt(sdpSchema), tracks: z.catch(z.array(z.object({ userId: z.string(), mid: str })), []) }),
      );
      return { offer: (r.offer ?? null) as SdpView | null, tracks: r.tracks.map((t) => ({ userId: t.userId, mid: t.mid ?? null })) };
    },
    callAudioRenegotiate: (id: string, sessionId: string, answer: SdpView) =>
      s.call(`/v1/meetups/${encodeURIComponent(id)}/call/audio/renegotiate`, send("PUT", { sessionId, answer }), null),
    callAudioLeave: (id: string) => s.call(`/v1/meetups/${encodeURIComponent(id)}/call/audio`, send("DELETE"), null),
  };
}
export type LivingApi = ReturnType<typeof livingApi>;

// ── Celebrations: the counters before and after a session ─────────────────────────────────────────────────────────

/**
 * What the web knows of the athlete's milestones (celebrations.ts MilestoneSnapshot): the journey's counters, the
 * day streak, the league tier. Personal bests, goals done and the VVaker level aren't known on the web: they stay 0 on
 * both sides, so they never fire here. Pure.
 */
export function snapshotOf(j: JourneyView | null, streakDays: number | null, league: LeagueView | null): MilestoneSnapshot | null {
  const c = j?.counters;
  if (!c) return null;
  const tier = league?.on && isLeagueTier(league.tier) ? league.tier : undefined;
  return {
    sessions: c.sessions ?? 0,
    weeksKept: c.weeksKept ?? 0,
    streakDays: streakDays ?? 0,
    weeklyStreak: c.weeklyStreak ?? j?.weeklyStreak?.weeks ?? 0,
    pbs: 0,
    stones: c.stones ?? 0,
    chapters: c.chapters ?? 0,
    vvakerLevel: 0,
    ...(tier ? { leagueTier: tier } : {}),
    goalsDone: 0,
    skillLevels: c.skillLevels ?? 0,
  };
}

export const snapshotKey = (userId: string) => `vvake-app-milestones:${userId}`;
/** Sessions already celebrated (or looked at) in this browser: one celebration per session, never twice. */
export const celebratedKey = (userId: string) => `vvake-app-celebrated:${userId}`;

/** A stored snapshot, or null when it isn't one. Pure. */
export function parseSnapshot(raw: unknown): MilestoneSnapshot | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const n = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) >= 0 ? (o[k] as number) : null);
  const keys = [
    "sessions",
    "weeksKept",
    "streakDays",
    "weeklyStreak",
    "pbs",
    "stones",
    "chapters",
    "vvakerLevel",
    "goalsDone",
    "skillLevels",
  ];
  const vals = keys.map(n);
  if (vals.some((v) => v === null)) return null;
  const snap = Object.fromEntries(keys.map((k, i) => [k, vals[i]!])) as unknown as MilestoneSnapshot;
  return isLeagueTier(o.leagueTier) ? { ...snap, leagueTier: o.leagueTier } : snap;
}

/**
 * The "before" of the session just done: the snapshot this browser kept last, or, for a very first session (no
 * snapshot yet and one session now), all zeros so the first one is celebrated. Null when there's nothing to compare.
 * Pure.
 */
export function beforeOf(stored: MilestoneSnapshot | null, after: MilestoneSnapshot): MilestoneSnapshot | null {
  if (stored) return stored;
  if (after.sessions === 1)
    return { ...after, sessions: 0, weeksKept: 0, streakDays: 0, weeklyStreak: 0, stones: 0, chapters: 0, skillLevels: 0 };
  return null;
}

// ── Meetups helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A download of a text file (the meetup's .ics) from the click that asked for it. */
export function downloadText(name: string, text: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** `YYYY-MM-DDTHH:MM` (a datetime-local input's value) for a time, in this browser's zone. Pure given the zone. */
export function localInputValue(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A meetup's first proposed time: tomorrow at 18:00, this browser's time. */
export function defaultMeetupStart(nowMs: number): number {
  const d = new Date(nowMs + 24 * 3_600_000);
  d.setHours(18, 0, 0, 0);
  return d.getTime();
}

// ── The session's spot ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Where a GPS session spent the most time (living-app §6.1: "start/most-time area"): route points binned in cells of
 * about 300 m, the busiest cell's first point; the start for a short route. Kept in the page's memory only, to ask
 * GET /v1/places/near-new once with 3 decimals. Null without a route. Pure.
 */
export function spotOfRoute(route: readonly { lat: number; lon: number; t: number }[]): { lat: number; lon: number } | null {
  if (!route.length) return null;
  const cell = (p: { lat: number; lon: number }) =>
    `${Math.round(p.lat / 0.0027)}:${Math.round(p.lon / (0.0027 / Math.max(0.1, Math.cos((p.lat * Math.PI) / 180))))}`;
  const time = new Map<string, number>();
  const first = new Map<string, { lat: number; lon: number }>();
  for (let i = 0; i < route.length; i++) {
    const p = route[i]!;
    const k = cell(p);
    const dt = i + 1 < route.length ? Math.max(0, route[i + 1]!.t - p.t) : 0;
    time.set(k, (time.get(k) ?? 0) + dt);
    if (!first.has(k)) first.set(k, { lat: p.lat, lon: p.lon });
  }
  let best = cell(route[0]!);
  for (const [k, s] of time) if (s > (time.get(best) ?? 0)) best = k;
  return first.get(best)!;
}
