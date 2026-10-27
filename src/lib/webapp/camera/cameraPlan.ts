// Copied from VVFit packages/game-core/src/cameraPlan.ts (7f2a8945 2026-10-27) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * Camera workouts, the plan as you see it (tester report 2026-10-27, ADR-0046 amendment): after goblet squats,
 * Romanian deadlifts, rows and presses (3 sets each) the same sequence started again and nobody had said so. Before a
 * workout starts you now see all of it (the order, sets × reps or time, the load you used last, the rounds, the
 * rests, about how long), and during it "Set 2 of 3 · Round 1 of 2", with "Round 2 of 2: same moves again." when the
 * sequence repeats.
 *
 * A plan is the flat list of sets the flow runs (cameraSession.ts PlannedSet). Rounds aren't stored: they're read
 * back from the list (a run of sets of two or more moves, repeated in a row), so a training's rounds, an own
 * workout's circuits and ladders all show the same way. Pure, EN/FR.
 */
import { cameraMove } from "./cameraMoves";
import type { PlannedSet } from "./cameraSession";
import { trainingMinutes, type TrainingSet } from "./cameraTraining";
import { workoutPlacement, type WorkoutPlacement } from "./cameraPrep";

type Lang = "en" | "fr";

/** Round `n` of `of` for a set (null: not part of a repeated sequence). */
export type RoundOf = { n: number; of: number; start: number; len: number };

const key = (s: Pick<PlannedSet, "move" | "label">) => `${s.move}|${s.label ?? ""}`;

/**
 * The rounds in a plan: from each set, the shortest sequence of two or more different moves that repeats right after
 * itself (at least twice); its repeats are rounds 1…k. Sets of one move in a row are sets, never rounds.
 */
export function planRounds(plan: readonly Pick<PlannedSet, "move" | "label">[]): (RoundOf | null)[] {
  const out: (RoundOf | null)[] = plan.map(() => null);
  const ks = plan.map(key);
  let i = 0;
  while (i < plan.length) {
    let found: { len: number; k: number } | null = null;
    for (let len = 2; i + 2 * len <= plan.length && !found; len++) {
      const seq = ks.slice(i, i + len);
      if (new Set(seq).size < 2) continue;
      let k = 1;
      while (i + (k + 1) * len <= plan.length && ks.slice(i + k * len, i + (k + 1) * len).every((x, j) => x === seq[j])) k++;
      if (k >= 2) found = { len, k };
    }
    if (!found) {
      i++;
      continue;
    }
    for (let r = 0; r < found.k; r++)
      for (let j = 0; j < found.len; j++) out[i + r * found.len + j] = { n: r + 1, of: found.k, start: i, len: found.len };
    i += found.k * found.len;
  }
  return out;
}

/** About how long a plan takes (minutes): sets, rests, each new move's demo and the 3-2-1 (like a training). */
export function planMinutes(plan: readonly PlannedSet[]): number {
  return plan.length ? trainingMinutes({ sets: [...plan] as TrainingSet[], rounds: 1, moves: [] }) : 0;
}

export interface OverviewItem {
  move: string;
  /** The name shown ("Goblet squat", or the words of a step of your own). */
  name: string;
  /** Sets of it in a row (in one round). */
  sets: number;
  /** "10 reps", "30 s", or "8–12 reps" when the sets differ. */
  target: string;
  /** The rest after each set (s). */
  restS: number;
  /** The load you used last (kg), when the screen knows it. */
  loadKg?: number;
  easier?: boolean;
}

export interface OverviewBlock {
  /** 1: straight sets; 2+: the items repeat this many times, in this order. */
  rounds: number;
  items: OverviewItem[];
}

export interface PlanOverview {
  blocks: OverviewBlock[];
  /** Sets in the whole workout (rounds included): the number the counter goes to. */
  totalSets: number;
  minutes: number;
  placement: WorkoutPlacement;
}

const targetOf = (sets: readonly PlannedSet[], lang: Lang): string => {
  const reps = sets.map((s) => s.reps).filter((x): x is number => !!x);
  const hold = sets.map((s) => s.holdS).filter((x): x is number => !!x);
  const span = (xs: number[]) => (Math.min(...xs) === Math.max(...xs) ? String(xs[0]) : `${Math.min(...xs)}–${Math.max(...xs)}`);
  if (reps.length) return lang === "fr" ? `${span(reps)} rép.` : `${span(reps)} reps`;
  if (hold.length) return `${span(hold)} s`;
  return lang === "fr" ? "à ton rythme" : "your pace";
};

/** The plan as blocks of moves (straight sets, then any repeated rounds), what the overview before Start lists. */
export function planOverview(plan: readonly PlannedSet[], lang: Lang, loads: Readonly<Record<string, number>> = {}): PlanOverview {
  const rounds = planRounds(plan);
  const blocks: OverviewBlock[] = [];
  const group = (sets: readonly PlannedSet[]): OverviewItem[] => {
    const items: OverviewItem[] = [];
    let run: PlannedSet[] = [];
    const flush = () => {
      if (!run.length) return;
      const f = run[0]!;
      const m = cameraMove(f.move);
      const load = loads[f.move];
      items.push({
        move: f.move,
        name: f.label || (m?.name[lang] ?? f.move),
        sets: run.length,
        target: targetOf(run, lang),
        restS: f.restS ?? (m?.weighted ? 90 : 60),
        ...(load ? { loadKg: load } : {}),
        ...(f.easier ? { easier: true } : {}),
      });
      run = [];
    };
    for (const s of sets) {
      if (run.length && key(run[0]!) !== key(s)) flush();
      run.push(s);
    }
    flush();
    return items;
  };
  let i = 0;
  while (i < plan.length) {
    const r = rounds[i];
    if (r) {
      blocks.push({ rounds: r.of, items: group(plan.slice(r.start, r.start + r.len)) });
      i = r.start + r.of * r.len;
      continue;
    }
    let j = i;
    while (j < plan.length && !rounds[j]) j++;
    blocks.push({ rounds: 1, items: group(plan.slice(i, j)) });
    i = j;
  }
  return {
    blocks,
    totalSets: plan.length,
    minutes: planMinutes(plan),
    placement: workoutPlacement(
      plan.map((s) => s.move),
      lang,
    ),
  };
}

/** "Set 2 of 3 · Round 1 of 2" (either part alone when the other doesn't apply; empty: neither). */
export function setRoundLine(set: { n: number; of: number }, round: Pick<RoundOf, "n" | "of"> | null, lang: Lang): string {
  const fr = lang === "fr";
  const parts: string[] = [];
  if (set.of > 1) parts.push(fr ? `Série ${set.n} sur ${set.of}` : `Set ${set.n} of ${set.of}`);
  if (round && round.of > 1) parts.push(fr ? `Tour ${round.n} sur ${round.of}` : `Round ${round.n} of ${round.of}`);
  return parts.join(" · ");
}

/** Said when a sequence starts again: "Round 2 of 2: same moves again." */
export function roundLine(n: number, of: number, lang: Lang): string {
  return lang === "fr" ? `Tour ${n} sur ${of} : les mêmes mouvements.` : `Round ${n} of ${of}: same moves again.`;
}
