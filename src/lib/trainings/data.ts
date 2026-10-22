import * as z from "zod/mini";
import { cameraMove } from "@/lib/webapp/camera/cameraMoves";
import { heartZoneLabel } from "@/lib/webapp/camera/cameraHeart";
import { CUSTOM_MOVE_ID, type CustomMove } from "@/lib/webapp/camera/cameraCustom";
import {
  cleanTraining,
  rpeOf,
  TRAINING_LEVELS,
  trainingMinutes,
  trainingSets,
  type Training,
  type TrainingLevel,
  type TrainingProblem,
  type TrainingSet,
} from "@/lib/webapp/camera/cameraTraining";
import { parseHandle, parseTrainingCode } from "./link";

/**
 * What the custom training pages and the web app read from the API (docs/05-tech/custom-trainings.md, ADR-0047),
 * parsed leniently like the rest of the site: a field the API renames or leaves out reads as missing, never as a
 * broken page. A training itself always goes through game-core's cleanTraining (the phone's and the API's own
 * check), so a page only ever runs a training the apps would run.
 */

const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));
const str = opt(z.string());
const num = opt(z.number());
const bool = opt(z.boolean());

const statsSchema = z.object({ athletes: num, runs: num, totalReps: num, heartPoints: num, coachScore: num });
export interface TrainingStats {
  athletes: number;
  runs: number;
  totalReps: number;
  heartPoints: number;
  coachScore: number;
}
const statsOf = (x: z.infer<typeof statsSchema> | null | undefined): TrainingStats => ({
  athletes: Math.max(0, Math.round(x?.athletes ?? 0)),
  runs: Math.max(0, Math.round(x?.runs ?? 0)),
  totalReps: Math.max(0, Math.round(x?.totalReps ?? 0)),
  heartPoints: Math.max(0, Math.round(x?.heartPoints ?? 0)),
  coachScore: Math.max(0, Math.round(x?.coachScore ?? 0)),
});

export interface CreatorRef {
  /** Only from signed-in routes (blocking needs it); the public share route never sends user ids. */
  id: string | null;
  name: string;
  handle: string | null;
}
const creatorRefSchema = z.object({ id: str, name: str, handle: str });
const creatorRefOf = (x: z.infer<typeof creatorRefSchema> | null | undefined): CreatorRef | null =>
  x ? { id: x.id ?? null, name: (x.name ?? "").slice(0, 60) || "VVake", handle: parseHandle(x.handle) } : null;

/** GET /v1/t/:code: the training (cleaned), who made it, its numbers. */
export interface SharedTraining {
  training: Training;
  code: string | null;
  creator: CreatorRef;
  stats: TrainingStats;
}

const sharedSchema = z.object({
  training: z.unknown(),
  creator: opt(creatorRefSchema),
  stats: opt(statsSchema),
});

/** A training from the API (share route, GET /v1/trainings/:id): cleaned, or the problem. */
export function readTraining(raw: unknown): { training: Training; code: string | null } | { problem: TrainingProblem } {
  const c = cleanTraining(raw);
  if ("problem" in c) return c;
  const code = raw && typeof raw === "object" ? parseTrainingCode(String((raw as { code?: unknown }).code ?? "")) : null;
  return { training: c.training, code };
}

export function readShared(json: unknown, code?: string | null): SharedTraining | null {
  const p = sharedSchema.safeParse(json);
  if (!p.success) return null;
  const t = readTraining(p.data.training);
  if ("problem" in t) return null;
  return {
    training: t.training,
    code: t.code ?? parseTrainingCode(code ?? null),
    creator: creatorRefOf(p.data.creator) ?? { id: null, name: "VVake", handle: null },
    stats: statsOf(p.data.stats),
  };
}

/** A training as a list shows it (Discover, my trainings, a creator page). */
export interface TrainingCard {
  id: string;
  code: string | null;
  name: string;
  level: TrainingLevel;
  minutes: number | null;
  sets: number | null;
  sport: string | null;
  visibility: string | null;
  tags: string[];
  creator: CreatorRef | null;
  athletes: number;
  runs: number;
  joins: number;
  coachScore: number;
  joined: boolean;
}

const cardSchema = z.object({
  id: z.string(),
  code: str,
  name: str,
  level: str,
  minutes: num,
  sets: num,
  sport: str,
  visibility: str,
  tags: opt(z.array(z.string())),
  creator: opt(creatorRefSchema),
  athletes: num,
  runs: num,
  joins: num,
  coachScore: num,
  joined: bool,
  stats: opt(statsSchema),
});

export function readCard(x: unknown): TrainingCard | null {
  const p = cardSchema.safeParse(x);
  if (!p.success) return null;
  const d = p.data;
  return {
    id: d.id,
    code: parseTrainingCode(d.code),
    name: (d.name ?? "").slice(0, 48),
    level: TRAINING_LEVELS.includes(d.level as TrainingLevel) ? (d.level as TrainingLevel) : "intermediate",
    minutes: d.minutes ?? null,
    sets: d.sets ?? null,
    sport: d.sport ?? null,
    visibility: d.visibility ?? null,
    tags: (d.tags ?? []).slice(0, 5),
    creator: creatorRefOf(d.creator),
    athletes: Math.round(d.athletes ?? d.stats?.athletes ?? 0),
    runs: Math.round(d.runs ?? d.stats?.runs ?? 0),
    joins: Math.round(d.joins ?? 0),
    coachScore: Math.round(d.coachScore ?? d.stats?.coachScore ?? 0),
    joined: d.joined === true,
  };
}
export const readCards = (x: unknown): TrainingCard[] => (Array.isArray(x) ? x.map(readCard).filter((c): c is TrainingCard => !!c) : []);

/** A creator in a list (Discover) and a creator page's header. */
export interface CreatorCard {
  name: string;
  handle: string;
  bio: string;
  city: string | null;
  followers: number;
  joins: number;
  coachScore: number;
  following: boolean;
}
const creatorSchema = z.object({
  name: str,
  handle: z.string(),
  bio: str,
  city: str,
  followers: num,
  joins: num,
  coachScore: num,
  following: bool,
});
export function readCreatorCard(x: unknown): CreatorCard | null {
  const p = creatorSchema.safeParse(x);
  if (!p.success) return null;
  const handle = parseHandle(p.data.handle);
  if (!handle) return null;
  return {
    name: (p.data.name ?? "").slice(0, 60) || handle,
    handle,
    bio: (p.data.bio ?? "").slice(0, 140),
    city: p.data.city ?? null,
    followers: Math.round(p.data.followers ?? 0),
    joins: Math.round(p.data.joins ?? 0),
    coachScore: Math.round(p.data.coachScore ?? 0),
    following: p.data.following === true,
  };
}

/** GET /v1/creators/:handle. */
export interface CreatorPageData {
  creator: CreatorCard;
  trainings: TrainingCard[];
  /** People who trained with them in the last 7 days (newer API; null when not sent). */
  weekAthletes: number | null;
}
const countOrNull = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : null);
export function readCreatorPage(json: unknown): CreatorPageData | null {
  if (!json || typeof json !== "object") return null;
  const o = json as { creator?: unknown; trainings?: unknown; weekAthletes?: unknown };
  const creator = readCreatorCard(o.creator);
  const inner = o.creator && typeof o.creator === "object" ? (o.creator as { weekAthletes?: unknown }).weekAthletes : undefined;
  return creator ? { creator, trainings: readCards(o.trainings), weekAthletes: countOrNull(o.weekAthletes ?? inner) } : null;
}

/** "This week's coaches" in Discover (newer API, optional). */
export interface CoachHighlight {
  handle: string;
  name: string;
  athletes: number;
}
export function readHighlights(x: unknown): CoachHighlight[] {
  if (!Array.isArray(x)) return [];
  const out: CoachHighlight[] = [];
  for (const h of x) {
    if (!h || typeof h !== "object") continue;
    const o = h as { handle?: unknown; name?: unknown; athletes?: unknown };
    const handle = parseHandle(typeof o.handle === "string" ? o.handle : null);
    if (!handle || out.some((c) => c.handle === handle)) continue;
    const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 60) : handle;
    out.push({ handle, name, athletes: countOrNull(o.athletes) ?? 0 });
  }
  return out.slice(0, 10);
}

/** GET /v1/discover. */
export interface DiscoverResult {
  trainings: TrainingCard[];
  creators: CreatorCard[];
  highlights: CoachHighlight[];
  next: string | null;
}
export function readDiscover(json: unknown): DiscoverResult {
  const o = (json && typeof json === "object" ? json : {}) as {
    trainings?: unknown;
    creators?: unknown;
    highlights?: unknown;
    next?: unknown;
  };
  return {
    trainings: readCards(o.trainings),
    creators: Array.isArray(o.creators) ? o.creators.map(readCreatorCard).filter((c): c is CreatorCard => !!c) : [],
    highlights: readHighlights(o.highlights),
    next: typeof o.next === "string" && o.next ? o.next : null,
  };
}

/** GET /v1/trainings: mine and joined. */
export function readMyTrainings(json: unknown): { mine: TrainingCard[]; joined: TrainingCard[] } {
  const o = (json && typeof json === "object" ? json : {}) as { mine?: unknown; joined?: unknown };
  return { mine: readCards(o.mine), joined: readCards(o.joined) };
}

/** GET /v1/training-challenges/:code. `startsAt`, `windowHours` and `stage` are optional (newer API). */
export type ChallengeStage = "live" | "closing" | "ended";
export interface ChallengeBoard {
  training: { code: string | null; name: string };
  endsAt: string | null;
  startsAt: string | null;
  windowHours: number | null;
  /** The API's own stage, when it sends one. */
  stage: ChallengeStage | null;
  members: number;
  leaderboard: { name: string | null; score: number }[];
}
const STAGES: readonly ChallengeStage[] = ["live", "closing", "ended"];
const boardSchema = z.object({
  training: opt(z.object({ code: str, name: str })),
  endsAt: str,
  startsAt: str,
  windowHours: num,
  stage: str,
  members: num,
  leaderboard: opt(z.array(z.object({ name: str, score: num }))),
});
const isoOrNull = (s: string | null | undefined) => (s && Number.isFinite(Date.parse(s)) ? s : null);
export function readBoard(json: unknown): ChallengeBoard | null {
  const p = boardSchema.safeParse(json);
  if (!p.success) return null;
  const hours = p.data.windowHours;
  return {
    training: { code: parseTrainingCode(p.data.training?.code), name: (p.data.training?.name ?? "").slice(0, 48) },
    endsAt: isoOrNull(p.data.endsAt),
    startsAt: isoOrNull(p.data.startsAt),
    windowHours: hours && hours > 0 && hours <= 24 * 31 ? Math.round(hours) : null,
    stage: STAGES.includes(p.data.stage as ChallengeStage) ? (p.data.stage as ChallengeStage) : null,
    members: Math.max(0, Math.round(p.data.members ?? 0)),
    leaderboard: (p.data.leaderboard ?? [])
      .map((r) => ({ name: r.name ? r.name.slice(0, 40) : null, score: Math.max(0, Math.min(1000, Math.round(r.score ?? 0))) }))
      .sort((a, b) => b.score - a.score),
  };
}

/** The last hours of a challenge: the final quarter of its window, at most 6 h (3 h when the window isn't known). */
export function closingMs(b: Pick<ChallengeBoard, "startsAt" | "endsAt" | "windowHours">): number {
  const span =
    b.windowHours !== null ? b.windowHours * 3_600_000 : b.startsAt && b.endsAt ? Date.parse(b.endsAt) - Date.parse(b.startsAt) : null;
  return span && span > 0 ? Math.min(6 * 3_600_000, span / 4) : 3 * 3_600_000;
}

/**
 * Where a challenge stands now: the clock wins over the API's stage once the end has passed (a page left open ends on
 * time), otherwise the API's stage, otherwise the time left against the last hours.
 */
export function challengeStage(b: Pick<ChallengeBoard, "startsAt" | "endsAt" | "windowHours" | "stage">, nowMs: number): ChallengeStage {
  const end = b.endsAt ? Date.parse(b.endsAt) : null;
  if (end !== null && nowMs > 0 && end <= nowMs) return "ended";
  if (b.stage) return b.stage;
  if (end === null || nowMs <= 0) return "live";
  return end - nowMs <= closingMs(b) ? "closing" : "live";
}

/** How far through its window the challenge is, 0..1, or null when the start isn't known. */
export function challengeProgress(b: Pick<ChallengeBoard, "startsAt" | "endsAt" | "windowHours">, nowMs: number): number | null {
  if (!b.endsAt || nowMs <= 0) return null;
  const end = Date.parse(b.endsAt);
  const start = b.startsAt ? Date.parse(b.startsAt) : b.windowHours !== null ? end - b.windowHours * 3_600_000 : null;
  if (start === null || !(end > start)) return null;
  return Math.max(0, Math.min(1, (nowMs - start) / (end - start)));
}

/** GET/PATCH /v1/me/profile. */
export interface MyProfile {
  handle: string | null;
  public: boolean;
  bio: string;
  showCity: boolean;
}
export function readProfile(json: unknown): MyProfile {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  return {
    handle: parseHandle(typeof o.handle === "string" ? o.handle : null),
    public: o.public === true,
    bio: typeof o.bio === "string" ? o.bio.slice(0, 140) : "",
    showCity: o.showCity === true,
  };
}

/** POST /v1/trainings/:id/runs. */
export interface RunReply {
  score: number;
  completion: number;
  inZone: number | null;
  completed: boolean;
  qualifying: boolean;
}
export function readRun(json: unknown): RunReply | null {
  const r = json && typeof json === "object" ? (json as { run?: unknown }).run : null;
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.score !== "number") return null;
  return {
    score: Math.round(o.score),
    completion: typeof o.completion === "number" ? o.completion : 0,
    inZone: typeof o.inZone === "number" ? o.inZone : null,
    completed: o.completed === true,
    qualifying: o.qualifying === true,
  };
}

/** GET /v1/me/creator, points only (the web never asks for a token amount here). */
export interface CreatorStats {
  pointsToday: number;
  pointsWeek: number;
  qualifyingWeek: number;
  athletes: number;
  coachScore: number;
}
export function readCreatorStats(json: unknown): CreatorStats | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const n = (k: string) => (typeof o[k] === "number" ? Math.round(o[k] as number) : 0);
  return {
    pointsToday: n("pointsToday"),
    pointsWeek: n("pointsWeek"),
    qualifyingWeek: n("qualifyingWeek"),
    athletes: n("athletes"),
    coachScore: n("coachScore"),
  };
}

// ── What a page shows of a training ─────────────────────────────────────────────────────────────────────────────

/** A move's name: a custom move's own name (from the training), else the catalogue's, else its id. */
export function moveName(id: string, moves: readonly Pick<CustomMove, "id" | "name">[], lang: "en" | "fr"): string {
  if (CUSTOM_MOVE_ID.test(id)) return moves.find((m) => m.id === id)?.name ?? id;
  return cameraMove(id)?.name[lang] ?? id;
}

export interface SetRow {
  move: string;
  name: string;
  custom: boolean;
  /** "15 reps" / "30 s". */
  target: string;
  /** "Zone 3 · Aerobic" / "Effort 6/10" / null. */
  intensity: string | null;
  zone: number | null;
  rpe: number | null;
  /** Rest after the set (s), null when not set. */
  restS: number | null;
}

export function setRows(t: Pick<Training, "sets" | "moves">, lang: "en" | "fr"): SetRow[] {
  const fr = lang === "fr";
  return t.sets.map((s: TrainingSet) => {
    const rpe = rpeOf(s) ?? null;
    return {
      move: s.move,
      name: moveName(s.move, t.moves, lang),
      custom: CUSTOM_MOVE_ID.test(s.move),
      target: s.reps ? (fr ? `${s.reps} répétitions` : `${s.reps} reps`) : `${s.holdS ?? 0} s`,
      intensity: s.zone ? heartZoneLabel(s.zone, lang) : rpe ? (fr ? `Effort ${rpe}/10` : `Effort ${rpe}/10`) : null,
      zone: s.zone ?? null,
      rpe,
      restS: s.restS ?? null,
    };
  });
}

/** The summary line: minutes, sets once expanded, rounds. */
export function trainingFacts(t: Training): { minutes: number; sets: number; rounds: number; customMoves: number } {
  return { minutes: trainingMinutes(t), sets: trainingSets(t).length, rounds: t.rounds, customMoves: t.moves.length };
}

/** "1,234" / "1 234" (French), for the stats. */
export const count = (n: number, lang: "en" | "fr") => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB").format(n);
