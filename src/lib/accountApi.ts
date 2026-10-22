import * as z from "zod/mini";
import type { RewardsSession } from "./rewardsApi";
import type { HeartZonesPrefs } from "@/lib/webapp/sportHeart";
import type { SpeedZonesPrefs } from "@/lib/webapp/speedZones";

/**
 * vvake.com/account: every setting the VVake account keeps on the API (monorepo docs/05-tech/api-v1.md "Me",
 * "Integrations", "Coach settings changes and memory", "Coach calls", "Live coach", "Plan changes", My Pulse, Desk).
 * Reuses the rewards page's session (src/lib/rewardsApi.ts: e-mail code or the app's link code, 24-hour web sign-in).
 *
 * Everything is parsed leniently: a field a newer API renames or drops shows as "not set", never as a broken page.
 * Settings the phone keeps only on itself (goals, focus lock on the phone, music choice, units read back…) aren't
 * here: the page says so instead of pretending to edit them.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());

// ── /v1/me ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const remindersSchema = z.object({
  rhythmOn: z.boolean(),
  waterOn: z.boolean(),
  mealsOn: z.boolean(),
  sleepOn: z.boolean(),
  wakeMinutes: z.number(),
  meals: z.array(z.number()),
  dailyMove: z.optional(z.nullable(z.object({ remind: z.boolean(), at: z.number() }))),
  pulseAlerts: z.optional(z.boolean()),
});
export type Reminders = z.infer<typeof remindersSchema>;

const prefsSchema = z.object({
  lang: str,
  theme: str,
  timeFormat: str,
  dateFormat: str,
  region: str,
  reminders: opt(remindersSchema),
  cityClashAlerts: bool,
  /** ADR-0044 / ADR-0048: `{ at, sports }` and `{ at, rpe?, sports }`, checked by speedZones.ts / sportHeart.ts. */
  speedZones: z.optional(z.unknown()),
  heartZones: z.optional(z.unknown()),
});
export type Prefs = z.infer<typeof prefsSchema>;

const coachSchema = z.object({
  on: bool,
  chattiness: str,
  voice: str,
  units: str,
  vibrateWithMusic: bool,
  callsOn: bool,
  callWindows: opt(z.array(z.tuple([z.number(), z.number()]))),
  ringWatch: bool,
});
export type CoachSettings = z.infer<typeof coachSchema>;

export const meSchema = z.object({
  id: z.string(),
  name: str,
  email: str,
  city: str,
  tz: str,
  guest: bool,
  plan: str,
  plusUntil: str,
  plusSource: str,
  /** Free / Plus / Premium (ADR-0051): "premium", or "pro" from APIs before the rename (read with coachTier). */
  tier: str,
  /** An early (beta) tester: Coach Premium for the beta, nothing charged. */
  earlyTester: bool,
  freshStartAt: str,
  coach: opt(coachSchema),
  prefs: opt(prefsSchema),
});
export type Me = z.infer<typeof meSchema>;

/** What PATCH /v1/me takes from this page (the API merges `prefs` and `coach` into what it has). */
export interface MePatch {
  name?: string;
  city?: string | null;
  prefs?: {
    lang?: "system" | "en" | "fr";
    theme?: "system" | "light" | "dark";
    timeFormat?: "system" | "12h" | "24h";
    dateFormat?: "system" | "dmy" | "mdy" | "ymd";
    reminders?: Reminders;
    cityClashAlerts?: boolean;
    /** Sent whole with a fresh `at` (newest wins on the server). */
    speedZones?: SpeedZonesPrefs;
    heartZones?: HeartZonesPrefs;
  };
  coach?: { callsOn?: boolean; callWindows?: [number, number][]; ringWatch?: boolean };
}

const devicesSchema = z.object({
  devices: z.array(z.object({ id: z.string(), kind: z.string(), model: str, lastSeenAt: str })),
});
export type Device = z.infer<typeof devicesSchema>["devices"][number];

// ── Coach ───────────────────────────────────────────────────────────────────────────────────────────────────────

const liveSchema = z.object({
  plus: bool,
  on: bool,
  reason: str,
  limitS: num,
  usedS: num,
  remainingS: num,
  resetsAt: str,
  // ADR-0051: the tier, the week's remainder and pack minutes (`remainingS` = both).
  tier: str,
  weekRemainingS: num,
  packS: num,
});
export type LiveStatus = z.infer<typeof liveSchema>;

const memorySchema = z.object({
  items: z.array(z.object({ id: z.string(), text: z.string(), source: str, createdAt: str })),
  max: num,
});
export type MemoryItem = z.infer<typeof memorySchema>["items"][number];

const settingsChangeSchema = z.object({
  id: z.string(),
  status: z.string(),
  summary: str,
  lines: opt(z.array(z.object({ label: z.string(), from: opt(z.string()), to: z.string() }))),
  createdAt: str,
  decidedAt: str,
  undoUntil: str,
});
export type SettingsChange = z.infer<typeof settingsChangeSchema>;
const settingsChangesSchema = z.object({ changes: z.array(settingsChangeSchema) });

// ── Plan ────────────────────────────────────────────────────────────────────────────────────────────────────────

const planChangeSchema = z.object({ id: z.string(), status: z.string(), summary: str, day: str, createdAt: str });
export type PlanChange = z.infer<typeof planChangeSchema>;
const planChangesSchema = z.object({ changes: z.array(planChangeSchema) });

const weekSchema = z.object({
  days: z.array(z.object({ date: z.string(), sport: z.string(), minutes: z.number(), start: z.string(), end: z.string() })),
  busySources: opt(z.array(z.string())),
  fromSurvey: bool,
});
export type Week = z.infer<typeof weekSchema>;

const athleteSchema = z.object({
  survey: opt(
    z.object({
      sports: opt(z.array(z.object({ sport: z.string(), experience: str }))),
      aim: str,
      daysPerWeek: num,
      minutesPerDay: num,
      painOrInjury: bool,
      event: opt(z.object({ sport: z.string(), date: z.string(), distanceM: num })),
    }),
  ),
  health: opt(
    z.object({
      age: num,
      sex: str,
      weightKg: num,
      heightCm: num,
      restingHr: num,
      maxHr: num,
      sleepHours: num,
      lowImpact: bool,
      easyOnly: bool,
      zones: opt(z.record(z.string(), z.array(z.number()))),
    }),
  ),
});
export type Athlete = z.infer<typeof athleteSchema>;

const syncSchema = z.object({ ok: bool, reason: str });

// ── Connections ─────────────────────────────────────────────────────────────────────────────────────────────────

const integrationsSchema = z.object({ google: opt(z.object({ connected: z.boolean(), email: str, blocks: bool })) });
export type Integrations = z.infer<typeof integrationsSchema>;

// route: the API keeps the watches' route on the account as { route, at } (ADR-0041, newest choice wins); a plain string is
// accepted too. recent: the link gives the last song played.
const routeSchema = opt(z.union([z.string(), z.object({ route: z.string(), at: z.number() })]));
const spotifySchema = z.object({ direct: bool, plus: bool, linked: bool, reason: str, web: bool, route: routeSchema, recent: bool });
export type SpotifyStatus = z.infer<typeof spotifySchema>;

/**
 * "Spotify on my watch" route (Auto / Through my phone / Watch on its own), kept on the account (ADR-0041): the phone,
 * both watches and this page read it from GET /v1/spotify/direct and write it with PUT /v1/spotify/route { route, at }.
 * The newest choice wins, so `at` is now.
 */
export const SPOTIFY_ROUTES = ["auto", "phone", "watch"] as const;
export type SpotifyRoute = (typeof SPOTIFY_ROUTES)[number];
export const SPOTIFY_ROUTE_SYNC: ((s: RewardsSession, route: SpotifyRoute) => Promise<unknown>) | null = (s, route) =>
  s.call("/v1/spotify/route", send("PUT", { route, at: Date.now() }), null);
export const spotifyRouteOf = (s: { route?: unknown } | null | undefined): SpotifyRoute | null => {
  const r = s?.route;
  const v = typeof r === "string" ? r : r && typeof r === "object" && "route" in r ? (r as { route: unknown }).route : null;
  return typeof v === "string" && (SPOTIFY_ROUTES as readonly string[]).includes(v) ? (v as SpotifyRoute) : null;
};

const deskRuleSchema = z.object({
  enabled: z.boolean(),
  afterMin: z.number(),
  unlockMin: z.number(),
  overridesPerDay: z.number(),
  unlockBy: z.string(),
  warnMin: z.number(),
});
export type DeskRule = z.infer<typeof deskRuleSchema>;
const deskSchema = z.object({
  rule: deskRuleSchema,
  desks: opt(z.array(z.object({ id: z.string(), name: str, lastSeenAt: str, lockedSince: str, toUnlock: num }))),
});
export type Desk = z.infer<typeof deskSchema>;

const watchItemSchema = z.object({
  symbol: z.string(),
  kind: z.string(),
  thresholdPct: z.optional(z.number()),
  direction: z.optional(z.string()),
});
export type WatchItem = z.infer<typeof watchItemSchema>;
const pulseSchema = z.object({
  watchlist: z.array(watchItemSchema),
  brandTeam: str,
  quietHours: opt(z.object({ start: z.string(), end: z.string() })),
  pushesPerDay: num,
});
export type Pulse = z.infer<typeof pulseSchema>;
export const MAX_WATCHLIST = 8;

// ── Plus ────────────────────────────────────────────────────────────────────────────────────────────────────────

const previewSchema = z.object({ plan: str, plusUntil: str, plusSource: str });

export type CoachTier = "free" | "plus" | "premium";

/**
 * The account's coach plan: VVake Coach Plus or Coach Premium. The API's tier key is "premium" ("pro" before the
 * rename, still read as Premium); an older API without `tier` falls back to the plan ("plus" = Coach Plus).
 */
export function coachTier(me: { plan?: string | null; tier?: string | null }): CoachTier {
  const t = (me.tier ?? "").toLowerCase();
  if (t === "premium" || t === "pro") return "premium";
  if (t === "plus" || me.plan === "plus") return "plus";
  return "free";
}

const freshSchema = z.object({ freshStartAt: z.string() });

// ── Calls ───────────────────────────────────────────────────────────────────────────────────────────────────────

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/** The account page's calls, on top of a signed-in session. */
export function accountApi(s: RewardsSession) {
  return {
    me: () => s.call("/v1/me", GET, meSchema),
    patchMe: (p: MePatch) => s.call("/v1/me", send("PATCH", p), meSchema),
    devices: async () => (await s.call("/v1/devices", GET, devicesSchema)).devices,
    removeDevice: (id: string) => s.call(`/v1/devices/${encodeURIComponent(id)}`, send("DELETE"), null),

    live: (lang: string) => s.call(`/v1/coach/live?lang=${lang}`, GET, liveSchema),
    memory: async () => (await s.call("/v1/coach/memory", GET, memorySchema)).items,
    forget: (id: string) => s.call(`/v1/coach/memory/${id}`, send("DELETE"), null),
    forgetAll: () => s.call("/v1/coach/memory", send("DELETE"), null),
    settingsChanges: async (lang: string, units: string, clock: string) =>
      (await s.call(`/v1/coach/settings/changes?lang=${lang}&units=${units}&clock=${clock}`, GET, settingsChangesSchema)).changes,
    decideSettings: (id: string, decision: "accept" | "reject") =>
      s.call(`/v1/coach/settings/changes/${id}`, send("POST", { decision, by: "phone" }), null),
    undoSettings: (id: string) => s.call(`/v1/coach/settings/changes/${id}/undo`, send("POST"), null),
    callNow: () => s.call("/v1/coach/calls/test", send("POST"), null),

    planChanges: async () => (await s.call("/v1/plan/changes", GET, planChangesSchema)).changes,
    decidePlan: (id: string, decision: "accept" | "reject") => s.call(`/v1/plan/changes/${id}`, send("POST", { decision }), null),
    week: (tz: string, lang: string) => s.call(`/v1/plan/week?tz=${encodeURIComponent(tz)}&lang=${lang}`, GET, weekSchema),
    athlete: () => s.call("/v1/athlete", GET, athleteSchema),
    calendarSync: (tz: string, lang: string, off: boolean) =>
      s.call("/v1/calendar/sync", send("POST", { tz, lang, ...(off ? { off } : {}) }), syncSchema),

    integrations: () => s.call("/v1/integrations", GET, integrationsSchema),
    googleStart: async (redirect: string) =>
      (await s.call("/v1/integrations/google/start", send("POST", { redirect }), z.object({ url: z.string() }))).url,
    googleDisconnect: () => s.call("/v1/integrations/google", send("DELETE"), null),
    spotify: () => s.call("/v1/spotify/direct", GET, spotifySchema),
    spotifyStart: async (redirect: string) =>
      (await s.call("/v1/spotify/web/start", send("POST", { redirect }), z.object({ url: z.string() }))).url,
    spotifyUnlink: () => s.call("/v1/spotify/link", send("DELETE"), null),
    desk: () => s.call("/v1/desk", GET, deskSchema),
    putDeskRule: (r: Partial<DeskRule>) => s.call("/v1/desk/rule", send("PUT", r), z.object({ rule: deskRuleSchema })),
    unlinkDesk: (id: string) => s.call(`/v1/desk/${encodeURIComponent(id)}`, send("DELETE"), null),
    pulse: () => s.call("/v1/pulse", GET, pulseSchema),
    putPulse: (p: {
      watchlist: WatchItem[];
      brandTeam: string | null;
      quietHours?: { start: string; end: string };
      pushesPerDay?: number;
    }) => s.call("/v1/pulse", send("PUT", p), pulseSchema),

    preview: (on: boolean) => s.call("/v1/me/plus/preview", send(on ? "POST" : "DELETE"), previewSchema),
    freshStart: () => s.call("/v1/me/fresh-start", send("POST"), freshSchema),
    deleteAccount: () => s.call("/v1/me", send("DELETE"), null),
  };
}
export type AccountApi = ReturnType<typeof accountApi>;

// ── Pure helpers (tested) ───────────────────────────────────────────────────────────────────────────────────────

/** The app's daily rhythm on a new install (apps/mobile lib/freshStartLocal.ts DEFAULT_RHYTHM, reminders off). */
export const DEFAULT_REMINDERS: Reminders = {
  rhythmOn: false,
  waterOn: false,
  mealsOn: false,
  sleepOn: false,
  wakeMinutes: 7 * 60,
  meals: [8 * 60, 12 * 60 + 30, 19 * 60 + 30],
  dailyMove: null,
  pulseAlerts: false,
};
/** The daily move's default time (the app's DailyMove: 12:30). */
export const DEFAULT_MOVE_AT = 12 * 60 + 30;

/** The account's reminders, or the app's defaults when none were ever saved (a copy: safe to edit). */
export const remindersOf = (me: Me | null): Reminders => {
  const r = me?.prefs?.reminders ?? DEFAULT_REMINDERS;
  return { ...r, meals: [...r.meals], dailyMove: r.dailyMove ? { ...r.dailyMove } : null, pulseAlerts: !!r.pulseAlerts };
};

/** "07:30" for an <input type="time"> (wraps the app's ±15 steps past midnight back into the day). */
export function toHhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes from midnight for "HH:MM", or null. */
export function fromHhmm(v: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** The API's default call windows (12:00–13:00 and 17:30–19:30). */
export const DEFAULT_CALL_WINDOWS: [number, number][] = [
  [12 * 60, 13 * 60],
  [17 * 60 + 30, 19 * 60 + 30],
];

/** Call windows the API takes: up to 2, each inside the day and 30 minutes or more. */
export const validWindows = (w: readonly (readonly [number, number])[]) =>
  w.length <= 2 && w.every(([a, b]) => a >= 0 && b <= 1440 && b - a >= 30);

/** Meal times the app keeps: up to 6 (the API's limit), sorted. */
export const sortedMeals = (meals: readonly number[]) => [...meals].sort((a, b) => a - b).slice(0, 6);

/** What came back from an OAuth redirect on this page (?google=ok, ?spotify=plus…), or null. */
export type ConnectNotice = "googleOk" | "googleError" | "spotifyOk" | "spotifyError" | "spotifyPlus";
export function connectNotice(search: string): ConnectNotice | null {
  const q = new URLSearchParams(search);
  const g = q.get("google");
  if (g === "ok") return "googleOk";
  if (g === "error") return "googleError";
  const s = q.get("spotify");
  if (s === "ok") return "spotifyOk";
  if (s === "plus") return "spotifyPlus";
  if (s === "error") return "spotifyError";
  return null;
}

/** The page's own URL without the redirect's parameters (kept clean after the notice is read). */
export function withoutConnectParams(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("google");
  u.searchParams.delete("spotify");
  return u.toString();
}

/**
 * Live coach minutes, rounded down for what's left (never shows more than there is): the week's ("12 of 15 min this
 * week") and pack minutes ("10 pack min", ADR-0051). Null with neither.
 */
export function liveMinutes(l: LiveStatus | null | undefined): { left: number; limit: number; pack: number } | null {
  if (!l || typeof l.limitS !== "number") return null;
  const packS = typeof l.packS === "number" ? Math.max(0, l.packS) : 0;
  if (l.limitS <= 0 && packS <= 0) return null;
  const week =
    typeof l.weekRemainingS === "number"
      ? l.weekRemainingS
      : typeof l.remainingS === "number"
        ? l.remainingS - packS
        : l.limitS - (l.usedS ?? 0);
  return { left: Math.max(0, Math.floor(week / 60)), limit: Math.round(l.limitS / 60), pack: Math.floor(packS / 60) };
}

/** A watchlist without one pick; the Brand Team goes with its stock. */
export function withoutPick(p: Pulse, symbol: string, kind: string): { watchlist: WatchItem[]; brandTeam: string | null } {
  const watchlist = p.watchlist.filter((w) => !(w.symbol === symbol && w.kind === kind));
  const team = p.brandTeam && watchlist.some((w) => w.kind === "stock" && w.symbol === p.brandTeam) ? p.brandTeam : null;
  return { watchlist, brandTeam: team };
}

/** A new pick, upper case, or null when it isn't a ticker, is already there or the list is full. */
export function withPick(p: Pulse, raw: string, kind: "stock" | "crypto"): WatchItem[] | null {
  const symbol = raw.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) return null;
  if (p.watchlist.length >= MAX_WATCHLIST || p.watchlist.some((w) => w.symbol === symbol && w.kind === kind)) return null;
  return [...p.watchlist, { symbol, kind }];
}

/** Whether a typed confirmation word matches (case and spaces don't matter). */
export const confirmed = (typed: string, word: string) => typed.trim().toUpperCase() === word.toUpperCase();
