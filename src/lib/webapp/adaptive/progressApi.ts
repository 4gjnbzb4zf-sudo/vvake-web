import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import { cleanAdaptivePrefs, type AdaptivePrefs, type RpeCheckMode, type SessionTiming } from "./adaptiveSession";

/**
 * Adaptive coaching's endpoints on the web (VVFit ADR-0069, docs/05-tech/adaptive-coaching.md): GET
 * /v1/athlete/progress (readiness and its reasons, each goal's trend and projection, what changed and why, the pending
 * insight proposals, the one question of the day, "still learning"), POST /v1/athlete/answer, and the coach settings
 * changes endpoints (ADR-0038) to accept, turn down and undo an insight proposal. Parsed leniently like the rest of the
 * web app: an older API (404, missing fields) reads as "nothing to show", never a broken screen.
 *
 * `prefs.adaptive = { timing, rpeChecks, at }` (newest `at` wins): read with game-core's cleanAdaptivePrefs, a change is
 * stamped after the account's (nextAdaptivePrefs).
 */

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
/** A list whose bad entries are dropped instead of failing the whole answer. */
const list = <T extends z.ZodMiniType>(t: T) =>
  z.pipe(
    z.catch(z.array(z.unknown()), []),
    z.transform((xs: unknown[]) =>
      xs.flatMap((x) => {
        const r = z.safeParse(t, x);
        return r.success ? [r.data as z.infer<T>] : [];
      }),
    ),
  );
const strings = list(z.string());

const READINESS = ["fresh", "ok", "tired", "strained"] as const;
export type ReadinessLevel = (typeof READINESS)[number];
const TRENDS = ["ahead", "on_track", "behind", "at_risk", "learning"] as const;
export type Trend = (typeof TRENDS)[number];

const tracePoint = z.object({ week: z.string(), fitness: z.catch(z.number(), 0), fatigue: num, minutes: num, sessions: num });
const goalSchema = z.object({
  goalId: z.catch(z.string(), ""),
  name: z.catch(z.string(), ""),
  date: str,
  daysLeft: num,
  needed: num,
  now: num,
  projected: num,
  safeBest: num,
  readiness: num,
  trend: z.catch(z.enum(TRENDS), "learning"),
  trendWord: str,
  lines: strings,
  postponeDate: str,
  resizeTo: str,
  consistentWeeks: num,
  series: list(z.object({ week: z.string(), fitness: z.number(), projected: opt(z.boolean()) })),
});
export type GoalProgressView = z.infer<typeof goalSchema>;

const proposalSchema = z.object({
  id: z.string(),
  source: str,
  status: z.catch(z.string(), "pending"),
  summary: str,
  /** Why, in plain words (insight proposals); older answers have none. */
  why: strings,
  lines: list(z.object({ label: z.string(), from: str, to: z.string() })),
  createdAt: str,
  decidedAt: str,
  undoUntil: str,
});
export type ProposalView = z.infer<typeof proposalSchema>;

const questionSchema = z.object({
  key: z.enum(["max_hr", "rpe_session"]),
  text: z.string(),
  value: num,
  sessionId: str,
  ref: str,
  answers: strings,
});
export type QuestionView = z.infer<typeof questionSchema>;

export const progressSchema = z.object({
  model: opt(
    z.object({
      load: opt(z.object({ fitness: num, fatigue: num, form: num, rampPerWeek: num, weekMinutes: num })),
      trace: list(tracePoint),
      sessionsUsed: num,
      updatedAt: str,
    }),
  ),
  readiness: opt(z.object({ level: z.catch(z.enum(READINESS), "ok"), word: str, lines: strings })),
  goals: list(goalSchema),
  changes: list(z.object({ at: z.string(), param: str, line: z.string() })),
  proposals: list(proposalSchema),
  question: opt(questionSchema),
  learning: opt(z.boolean()),
});
export type Progress = z.infer<typeof progressSchema>;

const changesSchema = z.object({ changes: list(proposalSchema) });

export type AnswerValue = "yes" | "no" | "easy" | "moderate" | "hard";

export function progressApi(s: RewardsSession) {
  return {
    progress: (lang: string, units: string) =>
      s.call(
        `/v1/athlete/progress?lang=${lang === "fr" ? "fr" : "en"}&units=${units === "imperial" ? "imperial" : "metric"}`,
        GET,
        progressSchema,
      ),
    answer: (b: { key: "max_hr" | "rpe_session"; ref?: string; value: AnswerValue }) => s.call("/v1/athlete/answer", send("POST", b), null),
    /** The coach settings changes (ADR-0038) of the last 30 days: insight ones accepted lately keep their Undo here. */
    changes: async (lang: string, units: string, clock: string) =>
      (await s.call(`/v1/coach/settings/changes?lang=${lang}&units=${units}&clock=${clock}`, GET, changesSchema)).changes,
    decide: (id: string, decision: "accept" | "reject") =>
      s.call(`/v1/coach/settings/changes/${id}`, send("POST", { decision, by: "phone" }), null),
    undo: (id: string) => s.call(`/v1/coach/settings/changes/${id}/undo`, send("POST"), null),
  };
}
export type ProgressApi = ReturnType<typeof progressApi>;

/** The question's `ref` for POST /v1/athlete/answer: the session asked about (rpe_session), else the API's own ref. */
export const questionRef = (q: QuestionView): string | undefined => q.ref ?? q.sessionId ?? undefined;

/** Insight proposals accepted lately that can still be undone (newest first). Pure. */
export function undoable(changes: readonly ProposalView[], nowMs: number): ProposalView[] {
  return changes.filter((c) => c.source === "insight" && c.status === "accepted" && !!c.undoUntil && Date.parse(c.undoUntil) > nowMs);
}

// ── Chart ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ChartPoint {
  x: number;
  y: number;
  projected: boolean;
}

/**
 * A goal's series as an SVG path in a w × h box (fitness so far solid, the projection dashed) and the needed level as
 * a line. Null with fewer than two points. Pure.
 */
export function goalChart(g: Pick<GoalProgressView, "series" | "needed">, w: number, h: number) {
  const pts = g.series;
  if (pts.length < 2) return null;
  const top = Math.max(1, g.needed ?? 0, ...pts.map((p) => p.fitness)) * 1.1;
  const at = (i: number, v: number): ChartPoint => ({
    x: Math.round((i / (pts.length - 1)) * w * 10) / 10,
    y: Math.round((h - (Math.max(0, v) / top) * h) * 10) / 10,
    projected: !!pts[i]!.projected,
  });
  const xy = pts.map((p, i) => at(i, p.fitness));
  const firstProj = xy.findIndex((p) => p.projected);
  const solid = firstProj < 0 ? xy : xy.slice(0, Math.max(1, firstProj));
  // The projection starts where the measured line ends.
  const dashed = firstProj < 0 ? [] : xy.slice(Math.max(0, firstProj - 1));
  const path = (ps: ChartPoint[]) => (ps.length < 2 ? "" : ps.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "));
  return {
    solid: path(solid),
    dashed: path(dashed),
    neededY: g.needed ? Math.round((h - (g.needed / top) * h) * 10) / 10 : null,
    last: xy[xy.length - 1]!,
    nowPoint: solid[solid.length - 1]!,
  };
}

// ── prefs.adaptive ──────────────────────────────────────────────────────────────────────────────────────────────

/** The account's prefs.adaptive, or null until set on a device (then: Adaptive, Auto). */
export function parseAdaptivePrefs(raw: unknown): AdaptivePrefs | null {
  if (!raw || typeof raw !== "object" || typeof (raw as { at?: unknown }).at !== "string") return null;
  return cleanAdaptivePrefs(raw) ?? null;
}

/** A new choice: the other field kept, stamped now and always after the account's `at` (newest wins). Pure. */
export function nextAdaptivePrefs(
  prev: unknown,
  patch: { timing?: SessionTiming; rpeChecks?: RpeCheckMode },
  now = Date.now(),
): AdaptivePrefs {
  const p = parseAdaptivePrefs(prev);
  const at = p ? Date.parse(p.at) : NaN;
  return {
    timing: patch.timing ?? p?.timing ?? "adaptive",
    rpeChecks: patch.rpeChecks ?? p?.rpeChecks ?? "auto",
    at: new Date(Math.max(now, Number.isFinite(at) ? at + 1 : 0)).toISOString(),
  };
}

/** The API has adaptive coaching (`/v1/me` `features.adaptive: true`, build 62): the screens and the upload fields show. */
export const adaptiveOn = (me: { features?: unknown }): boolean =>
  !!me.features && typeof me.features === "object" && (me.features as { adaptive?: unknown }).adaptive === true;

/** The account's new answer, with `features` kept from the last GET when the answer has none (PATCH /v1/me). Pure. */
export function keepFeatures<T extends { features?: unknown }>(prev: { features?: unknown } | null, next: T): T {
  return next.features === undefined && prev?.features !== undefined ? { ...next, features: prev.features } : next;
}
