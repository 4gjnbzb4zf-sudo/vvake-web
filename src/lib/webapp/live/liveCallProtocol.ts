/**
 * The live call's messages: a copy of the monorepo's game-core `liveCall.ts` (the protocol the API's live call
 * session speaks, docs/05-tech/live-call.md). Keep it identical to the source; the phone re-exports the same types.
 */

export const LIVE_CALL_MODES = ["workout", "call", "onboarding"] as const;
/** workout: live talk the athlete starts during a workout; call: the live part of a coach call; onboarding: day one. */
export type LiveCallMode = (typeof LIVE_CALL_MODES)[number];

/** What `show_permission` may ask the app to explain (its PermissionWhy sheet; the OS sheet only on the athlete's tap). */
export const LIVE_PERMISSIONS = ["health", "location", "notifications", "mic", "calendar", "camera"] as const;
export type LivePermission = (typeof LIVE_PERMISSIONS)[number];

/** Audio the app can play: mp3 chunks (concatenable) or raw PCM16 mono at 16 kHz. */
export const LIVE_AUDIO_FORMATS = ["mp3", "pcm16"] as const;
export type LiveAudioFormat = (typeof LIVE_AUDIO_FORMATS)[number];

export const LIVE_CALL = {
  /** The meter stops after this long with nobody speaking (live-call.md §4 "What counts"). */
  pauseAfterMs: 8_000,
  /** And the call ends after this long of silence ("I"ll let you go"). */
  silenceEndMs: 30_000,
  /** Default live part of a coach call / a workout talk, seconds of metered time (LIVE_CALL_MAX_MIN). */
  callMaxS: 5 * 60,
  /** The day-one call (ONBOARDING_CALL_MAX_MIN), free once per account and device. */
  onboardingMaxS: 6 * 60,
  /** Wall clock: a call never stays open longer than this many times its metered allowance. */
  hardCapFactor: 2,
  /** Day-one calls a UTC day across all accounts (ONBOARDING_CALLS_PER_DAY); past it: the survey cards. */
  onboardingPerDay: 200,
  /** The meter's warning, once, when this many seconds are left. */
  warnAtS: 60,
  /** A ticket is good for this long, once. */
  ticketTtlMs: 60_000,
  /** Turns a call at most (a runaway client). */
  maxTurns: 60,
  /** Model rounds for one athlete turn (a tool, then the words that follow it). */
  maxRoundsPerTurn: 3,
  /** How long the coach waits for the athlete to answer a permission sheet. */
  permissionWaitMs: 90_000,
  /** One athlete turn is at most this many characters (more is cut). */
  maxTurnChars: 600,
  /** Misunderstood turns in a row before the day-one call hands over to the cards. */
  missesToCards: 3,
} as const;

// ── Messages ───────────────────────────────────────────────────────────────────────────────────────────────

export interface LiveHello {
  type: "hello";
  mode: LiveCallMode;
  lang: "en" | "fr";
  /** The coach voice (woman / man); absent = the account's choice. */
  voice?: "woman" | "man";
  /** false: no coach voice at all, captions only (the app's voice off). */
  speak?: boolean;
  /** false (default): nothing about Health is said aloud (public place, Quiet, "show, don't say"); shown only. */
  healthAloud?: boolean;
  /** Who hears the athlete: the device (words come as `text`) or the server (`audio`, Scribe realtime). */
  stt?: "device" | "cloud";
  audioFormat?: LiveAudioFormat;
  /** mode call: the coach call this conversation continues. */
  callId?: string;
  /** mode workout: the running workout's id (the server must have seen its heartbeat). */
  sessionId?: string;
  units?: "metric" | "imperial";
}

export type LiveClientMsg =
  | LiveHello
  /** The athlete's words: partials while they speak, one final when their turn ends. */
  | { type: "text"; final: boolean; text: string }
  /** Base64 PCM16 16 kHz mono, ≤ 1 s a frame (cloud STT only). */
  | { type: "audio"; data: string }
  /** The athlete talked over the coach: the app already stopped playing; `heardMs` of this turn's audio were played. */
  | { type: "interrupt"; heardMs?: number }
  /** Same as interrupt (older name in the brief). */
  | { type: "barge_in"; heardMs?: number }
  | { type: "tool_result"; id: string; result: unknown }
  | { type: "end" }
  | { type: "ping" };

export type LiveEndReason =
  "bye" | "hangup" | "cap" | "call_max" | "silence" | "scripted" | "summary" | "cards" | "off_topic" | "error" | "turns";

export type LiveServerMsg =
  | { type: "ready"; callId: string; mode: LiveCallMode; voice: string | null; leftS: number }
  /** The coach's words for turn `turn` (`say`: who speaks them: the cloud voice in `audio`, the device, or nobody). */
  | { type: "caption"; turn: number; text: string; say: "cloud" | "device" | "none" }
  | { type: "audio"; turn: number; seq: number; format: LiveAudioFormat; data: string; durMs: number }
  /** A fixed line (greeting, cap, goodbye): its cached audio url, or null (device voice). */
  | { type: "line"; turn: number; text: string; url: string | null }
  | { type: "turn_end"; turn: number }
  /** The server heard the athlete talk over the coach (cloud STT): stop playing turn `turn` now. */
  | { type: "stop"; turn: number }
  | { type: "heard"; text: string; final: boolean }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "meter"; usedS: number; leftS: number; warn: boolean }
  | { type: "end"; reason: LiveEndReason }
  | { type: "error"; code: string };

/** What the app read from Health on the device, as ranges ("about"), never samples or exact values. */
export interface LiveHealthSummary {
  access: "granted" | "partial" | "denied";
  stepsPerDay?: [number, number];
  restingHr?: [number, number];
  sleepH?: [number, number];
  workoutsPerWeek?: [number, number];
}

const TYPES = new Set(["ready", "caption", "audio", "line", "turn_end", "stop", "heard", "tool_call", "meter", "end", "error"]);

/** One server frame, or null when it isn't one we know (a newer server's message is ignored, never a crash). Pure. */
export function parseServerMsg(raw: unknown): LiveServerMsg | null {
  if (typeof raw !== "string") return null;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const t = (j as { type?: unknown }).type;
  return typeof t === "string" && TYPES.has(t) ? (j as LiveServerMsg) : null;
}
