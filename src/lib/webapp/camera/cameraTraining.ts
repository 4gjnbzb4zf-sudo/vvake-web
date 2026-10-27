// Copied from VVFit packages/game-core/src/cameraTraining.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Custom trainings (ADR-0047): a video training series you build and share. A list of sets (a catalogue move or one
 * you taught, reps or a hold time, an intensity: a target heart zone, or an effort out of 10 when there's no
 * sensor, the rest after it), repeated for a number of rounds. It runs in the hands-free camera flow like the built-in
 * routines (cameraFlow.ts: demo twice, 3-2-1, sets that end by themselves, rests that follow the heart), and the share
 * link carries it with the custom moves it uses (their templates: numbers only, never video).
 *
 * Pure: validation, expansion into a routine, the time it takes, the score of a run (challenges: "beat my score on
 * my training"), the zone feedback during a set, and the coach score of a creator.
 */
import { cameraMove, CAMERA_MOVES, isOwnMove } from "./cameraMoves";
import type { CameraRoutine, PlannedSet } from "./cameraSession";
import type { CameraSummary } from "./cameraPoints";
import { cleanCustomMove, CUSTOM_MOVE_ID, type CustomMove } from "./cameraCustom";
import { ugcProblem } from "./ugc";
import type { CameraHeartStats } from "./cameraHeart";
import { DEMO_LOOPS, DEMO_LOOP_MS } from "./cameraDemo";

export const TRAINING_ID = /^t_[a-z0-9]{10}$/;
export const TRAINING_LIMITS = {
  nameMax: 48,
  descriptionMax: 280,
  sets: 40,
  rounds: 10,
  /** Expanded (sets × rounds). */
  totalSets: 120,
  reps: 200,
  holdS: 600,
  restS: 600,
  customMoves: 12,
  tags: 5,
  /** The words of a step of your own (ADR-0061). */
  labelMax: 32,
} as const;

export type TrainingLevel = "beginner" | "intermediate" | "advanced";
export type TrainingVisibility = "public" | "unlisted" | "private";
export const TRAINING_LEVELS: readonly TrainingLevel[] = ["beginner", "intermediate", "advanced"];

/** One set of a training: the move, the target (reps or a hold), the intensity, the rest after it. */
export interface TrainingSet extends PlannedSet {
  /** Target heart zone 1–5 (watch or strap). */
  zone?: 1 | 2 | 3 | 4 | 5;
  /** Effort out of 10 asked when there's no heart sensor (RPE); derived from the zone when not set. */
  rpe?: number;
}

export interface Training {
  id: string;
  v: 1;
  name: string;
  description: string;
  level: TrainingLevel;
  /** How many times the sets repeat. */
  rounds: number;
  /** Rest between rounds (s), after the last set of a round. */
  roundRestS?: number;
  sets: TrainingSet[];
  /** How its rests may follow the heart: "flex" (default) or "fixed" (intervals). */
  rest?: "flex" | "fixed";
  /** The custom moves its sets use (carried by the share link). */
  moves: CustomMove[];
  visibility: TrainingVisibility;
  lang: "en" | "fr";
  tags?: string[];
  creator?: { id: string; name: string } | null;
}

/** Effort out of 10 a zone means (when there's no sensor, the screen asks for this). */
export const ZONE_RPE: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = { 1: 3, 2: 4, 3: 6, 4: 8, 5: 9 };
export const rpeOf = (s: TrainingSet) => s.rpe ?? (s.zone ? ZONE_RPE[s.zone] : undefined);

export type TrainingProblem =
  "name" | "description" | "no_sets" | "too_many_sets" | "unknown_move" | "target" | "zone" | "rest" | "rounds" | "custom_move" | "label";

/** A training as received (an editor, the API, a share link): cleaned, or the first problem found. */
export function cleanTraining(x: unknown): { training: Training } | { problem: TrainingProblem } {
  if (!x || typeof x !== "object") return { problem: "no_sets" };
  const o = x as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  if (!name || [...name].length > TRAINING_LIMITS.nameMax || ugcProblem(name)) return { problem: "name" };
  const description =
    typeof o.description === "string"
      ? o.description
          .normalize("NFC")
          .replace(/[ \t]+/g, " ")
          .trim()
      : "";
  if ([...description].length > TRAINING_LIMITS.descriptionMax || (description && ugcProblem(description)))
    return { problem: "description" };
  const moves: CustomMove[] = [];
  for (const m of Array.isArray(o.moves) ? o.moves.slice(0, TRAINING_LIMITS.customMoves + 1) : []) {
    const c = cleanCustomMove(m);
    if (!c || ugcProblem(c.name)) return { problem: "custom_move" };
    if (!moves.some((y) => y.id === c.id)) moves.push(c);
  }
  if (moves.length > TRAINING_LIMITS.customMoves) return { problem: "custom_move" };
  const known = (id: string) =>
    CUSTOM_MOVE_ID.test(id) ? moves.some((m) => m.id === id) : isOwnMove(id) || !!CAMERA_MOVES.find((m) => m.id === id);
  const rawSets = Array.isArray(o.sets) ? o.sets : [];
  if (!rawSets.length) return { problem: "no_sets" };
  if (rawSets.length > TRAINING_LIMITS.sets) return { problem: "too_many_sets" };
  const sets: TrainingSet[] = [];
  const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  for (const r of rawSets) {
    const s = (r ?? {}) as Record<string, unknown>;
    if (typeof s.move !== "string" || !known(s.move)) return { problem: "unknown_move" };
    const kind = CUSTOM_MOVE_ID.test(s.move) ? moves.find((m) => m.id === s.move)!.kind : cameraMove(s.move)!.kind;
    const set: TrainingSet = { move: s.move };
    // A step of your own (ADR-0061): its words, short and clean (never on a catalogue move: its name is its own).
    if (isOwnMove(s.move)) {
      const label = typeof s.label === "string" ? s.label.normalize("NFC").replace(/\s+/g, " ").trim() : "";
      if ([...label].length > TRAINING_LIMITS.labelMax || (label && ugcProblem(label))) return { problem: "label" };
      if (label) set.label = label;
    }
    if (s.easier === true) set.easier = true;
    if (kind === "reps") {
      const n = int(s.reps, 1, TRAINING_LIMITS.reps);
      if (n === null) return { problem: "target" };
      set.reps = n;
    } else {
      const h = int(s.holdS, 5, TRAINING_LIMITS.holdS);
      if (h === null) return { problem: "target" };
      set.holdS = h;
    }
    if (s.zone !== undefined && s.zone !== null) {
      const z = int(s.zone, 1, 5);
      if (z === null) return { problem: "zone" };
      set.zone = z as 1 | 2 | 3 | 4 | 5;
    }
    if (s.rpe !== undefined && s.rpe !== null) {
      const e = int(s.rpe, 1, 10);
      if (e === null) return { problem: "zone" };
      set.rpe = e;
    }
    if (s.restS !== undefined && s.restS !== null) {
      const rs = int(s.restS, 0, TRAINING_LIMITS.restS);
      if (rs === null) return { problem: "rest" };
      set.restS = rs;
    }
    sets.push(set);
  }
  const rounds = o.rounds === undefined ? 1 : int(o.rounds, 1, TRAINING_LIMITS.rounds);
  if (rounds === null || rounds * sets.length > TRAINING_LIMITS.totalSets) return { problem: "rounds" };
  const roundRestS = o.roundRestS === undefined || o.roundRestS === null ? undefined : int(o.roundRestS, 0, TRAINING_LIMITS.restS);
  if (roundRestS === null) return { problem: "rest" };
  // Only the custom moves the sets use travel with it.
  const used = moves.filter((m) => sets.some((s) => s.move === m.id));
  const tags = Array.isArray(o.tags)
    ? [
        ...new Set(
          o.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) =>
              t
                .toLowerCase()
                .replace(/[^\p{L}\p{N}-]+/gu, "")
                .slice(0, 20),
            )
            .filter((t) => t && !ugcProblem(t)),
        ),
      ].slice(0, TRAINING_LIMITS.tags)
    : [];
  const training: Training = {
    id: typeof o.id === "string" && TRAINING_ID.test(o.id) ? o.id : "t_0000000000",
    v: 1,
    name,
    description,
    level: TRAINING_LEVELS.includes(o.level as TrainingLevel) ? (o.level as TrainingLevel) : "intermediate",
    rounds,
    ...(roundRestS !== undefined ? { roundRestS } : {}),
    sets,
    ...(o.rest === "fixed" ? { rest: "fixed" as const } : {}),
    moves: used,
    visibility: o.visibility === "public" || o.visibility === "private" ? o.visibility : "unlisted",
    lang: o.lang === "fr" ? "fr" : "en",
    ...(tags.length ? { tags } : {}),
    creator: null,
  };
  return { training };
}

/** The sets in the order they run (rounds expanded; the round rest replaces the last set's rest). */
export function trainingSets(t: Pick<Training, "sets" | "rounds" | "roundRestS">): TrainingSet[] {
  const out: TrainingSet[] = [];
  for (let r = 0; r < t.rounds; r++)
    t.sets.forEach((s, i) => {
      const last = i === t.sets.length - 1 && r < t.rounds - 1;
      out.push({ ...s, ...(last && t.roundRestS !== undefined ? { restS: t.roundRestS } : {}) });
    });
  return out;
}

/** The training as a routine the hands-free flow runs (the zones ride along on each set). */
export function trainingRoutine(t: Training): CameraRoutine {
  return {
    id: t.id,
    name: { en: t.name, fr: t.name },
    minutes: trainingMinutes(t),
    equipment: "none",
    sets: trainingSets(t),
    ...(t.rest ? { rest: t.rest } : {}),
  };
}

/** About how long a rep takes (s): a custom move's taught pace, else 2.5 s (3 s with weights). */
function repSeconds(id: string, t: Pick<Training, "moves">): number {
  const c = t.moves.find((m) => m.id === id);
  if (c) return c.template.minS && c.template.maxS ? (c.template.minS + c.template.maxS) / 3.2 : 2.5;
  return cameraMove(id)?.weighted ? 3 : 2.5;
}

/** The time it takes, minutes (sets, rests, each new move's demo twice and the 3-2-1), rounded up. */
export function trainingMinutes(t: Pick<Training, "sets" | "rounds" | "roundRestS" | "moves">): number {
  const all = trainingSets(t);
  let s = 0;
  let prev = "";
  all.forEach((x, i) => {
    if (x.move !== prev) s += (DEMO_LOOP_MS.rep * DEMO_LOOPS) / 1000;
    prev = x.move;
    s += 3; // 3-2-1
    s += x.holdS ?? (x.reps ?? 10) * repSeconds(x.move, t);
    if (i < all.length - 1) s += x.restS ?? (cameraMove(x.move)?.weighted ? 90 : 60);
  });
  return Math.max(1, Math.ceil(s / 60));
}

// ── A run's score (challenges) ───────────────────────────────────────────────────────────────────────────────────

export const TRAINING_SCORE = {
  /** Points for doing what the sets asked (reps and holds, each set capped at its target). */
  work: 700,
  /** Points for the time in the target zones (only with a watch or a strap). */
  heart: 300,
  /** A run counts as completed from this share of the work. */
  completeAt: 0.8,
} as const;

export interface TrainingRun {
  /** 0–1: the share of the planned work done. */
  completion: number;
  /** 0–1: the share of the set time with a target zone spent in it (null: no heart data, or no zones). */
  inZone: number | null;
  score: number;
  completed: boolean;
}

/**
 * Scores a run of a training from its camera summary: each planned set's reps (or hold seconds) against its target,
 * capped at the target (doing more doesn't beat a friend who did it all), in plan order per move. The heart part
 * counts only with sensor data (`zoneS` time in zones over the sets): without it the best score is 700.
 */
export function trainingRun(
  t: Pick<Training, "sets" | "rounds" | "roundRestS">,
  summary: Pick<CameraSummary, "moves">,
  heart?: Pick<CameraHeartStats, "zoneS"> | null,
): TrainingRun {
  const plan = trainingSets(t);
  const done = new Map(summary.moves.map((m) => [m.id, m.sets.map((s) => (s.holdS && !s.reps ? s.holdS : s.reps))]));
  const used = new Map<string, number>();
  let total = 0;
  for (const s of plan) {
    const target = s.reps ?? s.holdS ?? 0;
    if (!target) continue;
    const i = used.get(s.move) ?? 0;
    used.set(s.move, i + 1);
    const got = done.get(s.move)?.[i] ?? 0;
    total += Math.min(1, got / target);
  }
  const completion = plan.length ? total / plan.length : 0;
  let inZone: number | null = null;
  const zoned = plan.filter((s) => s.zone);
  if (heart && zoned.length) {
    // The time in or above the lowest target zone, out of all the time with a reading (rests included: they're short).
    const minZone = Math.min(...zoned.map((s) => s.zone!));
    const all = heart.zoneS.reduce((a, b) => a + b, 0);
    const inside = heart.zoneS.slice(minZone).reduce((a, b) => a + b, 0);
    inZone = all > 0 ? inside / all : null;
  }
  const score = Math.round(TRAINING_SCORE.work * completion + (inZone === null ? 0 : TRAINING_SCORE.heart * inZone));
  return {
    completion: round3(completion),
    inZone: inZone === null ? null : round3(inZone),
    score,
    completed: completion >= TRAINING_SCORE.completeAt,
  };
}
const round3 = (x: number) => Math.round(x * 1000) / 1000;

// ── During a set: the target zone ────────────────────────────────────────────────────────────────────────────────

export type ZoneFeel = "below" | "in" | "above";
export function zoneFeel(target: number, zoneNow: number): ZoneFeel {
  return zoneNow < target ? "below" : zoneNow > target ? "above" : "in";
}

/** The line for the target zone (screen and voice, both apps, the watches and the web say the same). */
export function zoneLine(target: number, feel: ZoneFeel, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  if (feel === "in") return fr ? `Zone ${target} : parfait, garde ce rythme.` : `Zone ${target}: right on target, keep it up.`;
  if (feel === "below") return fr ? `Un peu plus fort : vise la zone ${target}.` : `Push a little: aim for zone ${target}.`;
  return fr ? `Doucement : la zone ${target} suffit.` : `Ease off a little: zone ${target} is enough.`;
}

/** Says the zone line when the feel changed and held 8 s, at most every 25 s (calm, like the framing voice). */
export class ZoneCuePacer {
  private feel: ZoneFeel | null = null;
  private since = 0;
  private saidAt = -Infinity;
  private said: ZoneFeel | null = null;
  push(target: number | undefined, zoneNow: number | null, nowMs: number): ZoneFeel | null {
    if (!target || zoneNow === null) {
      this.feel = null;
      return null;
    }
    const f = zoneFeel(target, zoneNow);
    if (f !== this.feel) {
      this.feel = f;
      this.since = nowMs;
      return null;
    }
    if (nowMs - this.since < 8000 || nowMs - this.saidAt < 25_000 || f === this.said) return null;
    this.saidAt = nowMs;
    this.said = f;
    return f;
  }
  /** A new set: the next line can be said again. */
  reset() {
    this.feel = null;
    this.said = null;
  }
}

// ── Creators: coach score ────────────────────────────────────────────────────────────────────────────────────────

export interface CoachStats {
  /** Distinct other people who completed one of the creator's trainings (qualifying: established, heart data). */
  athletes: number;
  /** Of them, people who did it (or another of theirs) again another week. */
  returning: number;
  /** Average completion of those runs (0–1). */
  avgCompletion: number;
}

/**
 * "How effective a coach you are": grows with the people your trainings moved (slower and slower: ten people is
 * already good), how far they got, and who came back. Only qualifying runs count (the same rules as creator points:
 * other established accounts, real heart data), so friends tapping "done" can't make it.
 */
export function coachScore(s: CoachStats): number {
  if (s.athletes <= 0) return 0;
  const reach = 400 * Math.log10(1 + s.athletes);
  return Math.round(reach * Math.max(0, Math.min(1, s.avgCompletion)) + 25 * Math.min(s.returning, s.athletes));
}
