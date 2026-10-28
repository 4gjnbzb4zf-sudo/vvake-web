import type { Route } from "@/components/webapp/AppContext";
import type { ApiSession } from "@/lib/webapp/api";
import { mergeLedgers, type Moment, type Step, type StepLedger, type StepRecord } from "./nextStep";

/**
 * Next steps on the web (VVFit ADR-0062 §4): the step ledger kept in this browser per account and with the account as
 * `prefs.steps = { ledger, at }` (PATCH /v1/me; the server merges per step, newest `lastAt` wins; an API that doesn't
 * keep it yet never answers with it and this browser's ledger still holds), the moments built from what the web really
 * knows (a field the web can't know stays undefined, so a step that needs it is never offered), where each step opens
 * in the web app (steps for screens the web doesn't have are left out), and the first-time tours recorded in the same
 * ledger as `tour:<activity>`. The engine itself is game-core's nextStep.ts, copied unchanged.
 */

export const stepsKey = (userId: string) => `vvake-app-steps:${userId}`;

export interface StepsPrefs {
  ledger: StepLedger;
  /** The newest change (ISO). */
  at: string;
}

const DAY = 86_400_000;
const isIso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** One stored or received step record, or null when it isn't one. Pure. */
function parseRecord(x: unknown): StepRecord | null {
  const r = x as Partial<StepRecord> | null | undefined;
  if (!r || typeof r !== "object" || !isIso(r.lastAt)) return null;
  return {
    shown: count(r.shown),
    accepted: count(r.accepted),
    dismissed: count(r.dismissed),
    ignoredRun: count(r.ignoredRun),
    acceptedAt: Array.isArray(r.acceptedAt) ? r.acceptedAt.filter(isIso).slice(-5) : [],
    lastAt: r.lastAt,
    ...(isIso(r.lastShown) ? { lastShown: r.lastShown } : {}),
    ...(isIso(r.mutedUntil) ? { mutedUntil: r.mutedUntil } : {}),
  };
}

/** A stored or received `prefs.steps`, cleaned (bad records dropped), or null when it isn't one. Pure. */
export function parseStepsPrefs(x: unknown): StepsPrefs | null {
  const v = x as { ledger?: unknown; at?: unknown } | null | undefined;
  if (!v || typeof v !== "object" || !isIso(v.at) || !v.ledger || typeof v.ledger !== "object") return null;
  const ledger: StepLedger = {};
  for (const [k, r] of Object.entries(v.ledger as Record<string, unknown>).slice(0, 400)) {
    const rec = k.length <= 60 ? parseRecord(r) : null;
    if (rec) ledger[k] = rec;
  }
  return { ledger, at: v.at };
}

/** Steps untouched for 90 days are forgotten (tours stay: once means once). Pure. */
export function pruneLedger(ledger: StepLedger, now: Date): StepLedger {
  const out: StepLedger = {};
  for (const [k, r] of Object.entries(ledger)) if (k.startsWith("tour:") || now.getTime() - Date.parse(r.lastAt) < 90 * DAY) out[k] = r;
  return out;
}

/** Two devices' ledgers as one: per step the record touched last, the newest `at`. Pure. */
export function mergeStepsPrefs(a: StepsPrefs | null, b: StepsPrefs | null): StepsPrefs | null {
  if (!a) return b;
  if (!b) return a;
  return { ledger: mergeLedgers(a.ledger, b.ledger), at: Date.parse(b.at) > Date.parse(a.at) ? b.at : a.at };
}

/** Does the account need ours (a step it lacks, or one we touched later)? Pure. */
export function accountBehind(local: StepLedger, account: StepLedger | null): boolean {
  for (const [k, r] of Object.entries(local)) {
    const o = account?.[k];
    if (!o || Date.parse(r.lastAt) > Date.parse(o.lastAt)) return true;
  }
  return false;
}

// ── Tours ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The web's first-time tours: the GPS workout, the webcam camera workout, a training run. */
export const TOURS = ["gps", "camera", "training"] as const;
export type TourId = (typeof TOURS)[number];
export const tourKey = (id: TourId) => `tour:${id}`;

/** Shown once: a tour already shown (finished, skipped or left) never comes back unless replayed. Pure. */
export const tourSeen = (ledger: StepLedger, id: TourId) => (ledger[tourKey(id)]?.shown ?? 0) > 0;

/** "Replay tours": every tour starts fresh, stamped now so it wins the merge on every device. Pure. */
export function replayTours(ledger: StepLedger, now: Date): StepLedger {
  const out = { ...ledger };
  for (const id of TOURS) {
    const k = tourKey(id);
    if (out[k]) out[k] = { shown: 0, accepted: 0, dismissed: 0, ignoredRun: 0, acceptedAt: [], lastAt: now.toISOString() };
  }
  return out;
}

// ── Moments from what the web knows ─────────────────────────────────────────────────────────────────────────────────

/** Outdoor nature sports end as a hike (trail, water, climb, snow); the rest as a GPS session. */
const HIKE_SPORTS = new Set([
  "hike",
  "open-water",
  "climbing",
  "paddle",
  "surf",
  "sailing",
  "cross-country-ski",
  "downhill-ski",
  "snowboard",
  "snow-sports",
]);

/** Sessions in the 7 days before `now` from the account's recent sessions, with the one just done when not listed yet. Pure. */
export function sessionsLast7(sessions: readonly ApiSession[], now: number, justDone?: string): number {
  const recent = sessions.filter((s) => !s.excluded && now - Date.parse(s.startedAt) < 7 * DAY && Date.parse(s.startedAt) <= now);
  return recent.length + (justDone && !recent.some((s) => s.id === justDone) ? 1 : 0);
}

export interface MomentFacts {
  sport: string;
  activeS: number;
  feel?: "hard" | "right" | "easy" | null;
  /** Sessions in the last 7 days, this one included (undefined: unknown). */
  last7?: number;
  /** The day streak (undefined: unknown). */
  streak?: number;
  /** A season plan exists (undefined: not loaded). */
  hasPlan?: boolean;
}

const known = <K extends keyof Moment>(k: K, v: Moment[K] | undefined | null): Partial<Moment> =>
  v === undefined || v === null ? {} : ({ [k]: v } as Partial<Moment>);

function base(f: MomentFacts): Omit<Moment, "kind"> {
  return {
    sport: f.sport,
    minutes: Math.max(0, Math.round(f.activeS / 60)),
    ...known("feel", f.feel),
    ...known("last7", f.last7),
    ...known("streak", f.streak),
    ...known("hasPlan", f.hasPlan),
  };
}

/** The web GPS workout's summary. Places, routes, personal bests and friends aren't known here: left undefined. Pure. */
export const gpsMoment = (f: MomentFacts): Moment => ({ kind: HIKE_SPORTS.has(f.sport) ? "hike_end" : "gps_end", ...base(f) });

/** The webcam camera workout's summary: how many moves the athlete taught VVake when known. Pure. */
export const cameraMoment = (f: MomentFacts & { taughtMoves?: number }): Moment => ({
  kind: "camera_end",
  ...base(f),
  ...known("taughtMoves", f.taughtMoves),
});

/** A training run's summary: its score (0–1000) when known. Pure. */
export const trainingMoment = (f: MomentFacts & { score?: number }): Moment => ({
  kind: "training_end",
  ...base(f),
  ...known("score", f.score),
});

// ── Where a step opens on the web ───────────────────────────────────────────────────────────────────────────────

/** What a step may need from the screen it was offered on (the training just run). */
export interface StepTarget {
  trainingRef?: string;
}

/**
 * The web screen for a step (game-core's phone routes), or null when the web has no such screen (place notes, meetups,
 * ghost races, skills, calendars, watch install, friend invites): those steps are not offered here. Pure.
 */
export function webRouteForStep(step: Pick<Step, "route" | "params">, target: StepTarget = {}): Route | null {
  const p = step.params ?? {};
  switch (step.route) {
    case "/places":
      return p.plan ? null : p.sport ? { name: "places", sport: p.sport } : { name: "places" };
    case "/crew":
      return { name: "crew" };
    case "/challenge":
      // Challenging friends on a training lives on the training's page; duels and invites are in the phone app.
      return p.from === "training" && target.trainingRef ? { name: "training", ref: target.trainingRef } : null;
    case "/training-builder":
      return { name: "build" };
    case "/teach-move":
      return { name: "teach" };
    case "/discover":
      return { name: "trainings" };
    case "/plan":
      return { name: "plan" };
    case "/season-sports":
      return { name: "season-sports" };
    case "/season-goal":
      return { name: "season-goal" };
    default:
      return null;
  }
}

/**
 * The coach's `open_screen` route (an allow-listed app route, with or without its slash, a few names the web knows
 * too) as a web screen, or null when the web has none. Pure.
 */
export function webRouteForScreen(route: string): Route | null {
  const r = route.trim().replace(/^\/+/, "").replace(/\?.*$/, "");
  const [head = "", arg] = r.split("/");
  const name = head.toLowerCase();
  if ((name === "training" || name === "train") && arg && /^([A-HJ-NP-Z2-9]{8}|t_[a-z0-9]{10})$/i.test(arg))
    return { name: "training", ref: /^t_/i.test(arg) ? arg.toLowerCase() : arg.toUpperCase() };
  if ((name === "places" || name === "spots") && arg && /^[a-z-]{2,30}$/.test(arg)) return { name: "places", sport: arg };
  const map: Record<string, Route> = {
    today: { name: "today" },
    plan: { name: "plan" },
    train: { name: "plan" },
    library: { name: "trainings" },
    trainings: { name: "trainings" },
    discover: { name: "trainings" },
    "my-moves": { name: "trainings" },
    "my-trainings": { name: "trainings" },
    "training-builder": { name: "build" },
    build: { name: "build" },
    "teach-move": { name: "teach" },
    teach: { name: "teach" },
    camera: { name: "camera" },
    workout: { name: "workout" },
    places: { name: "places" },
    spots: { name: "places" },
    crew: { name: "crew" },
    coach: { name: "coach" },
    you: { name: "you" },
    settings: { name: "you" },
    points: { name: "points" },
    goals: { name: "goals" },
    rhythm: { name: "rhythm" },
    habits: { name: "rhythm" },
    vvaker: { name: "vvaker" },
    zones: { name: "zones" },
    "sport-zones": { name: "zones" },
    "speed-zones": { name: "zones" },
    sensor: { name: "sensor" },
    season: { name: "season" },
    "season-goal": { name: "season-goal" },
    "season-sports": { name: "season-sports" },
    "season-health": { name: "season-health" },
    "season-history": { name: "season-history" },
    "your-vvake": { name: "your-vvake" },
    tailor: { name: "your-vvake" },
    features: { name: "features" },
    "coach-profile": { name: "coach-profile" },
  };
  return map[name] ?? null;
}
