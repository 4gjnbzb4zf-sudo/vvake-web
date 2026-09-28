// Mirrors packages/game-core/src/plan.ts (keep in sync; shared test vectors in plan.test.ts).
/**
 * Training planner (docs/02-product/training-plan.md): planned, recurring sessions, alone or with a crew,
 * and a weekly plan built from the user's reality (days free, time per day, sports they like,
 * what they actually did lately), not from an ideal athlete.
 *
 * Rules:
 * - Fixed sessions first (your own recurring slots and your crew sessions); the plan fills around them.
 * - At least one rest day a week, sessions spread out, never two hard days in a row, mostly easy (80/20).
 * - Progress only when the last weeks were mostly done (+10% max), hold or go lighter otherwise, lighter
 *   every 4th week (deload). Missed sessions shrink the next plan, never guilt.
 * - Long-term volume is capped per goal, around WHO guidance (150–300 min moderate activity a week).
 * Wellness guidance only (C19): no medical advice; injuries or health conditions → see a professional.
 */

/** 0 = Monday … 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type PlanGoal = "start" | "consistency" | "endurance" | "strength" | "calm" | "event";
export type SessionIntensity = "easy" | "moderate" | "hard" | "mindful";

export interface PlannedSession {
  day: Weekday;
  sport: string;
  durationMin: number;
  intensity: SessionIntensity;
  with: "solo" | "crew";
  /** Links the session to a crew session (crew.ts) for RSVPs and reminders. */
  crewId?: string;
  /** Weekly sessions repeat on the same day; the plan may still adjust their length. */
  recurrence: "weekly" | "once";
  /** A slot the user set themselves (their own habit or a crew session): the plan never moves it. */
  fixed?: boolean;
  /** The week's long session (endurance goals). */
  long?: boolean;
}

export interface Reality {
  goal: PlanGoal;
  /** Days the user can usually train. */
  availableDays: readonly Weekday[];
  /** Typical time available on those days. */
  minutesPerDay: number;
  /** Sports the user enjoys (VVaker sport keys, e.g. runner, lifter, meditator). */
  sports: readonly string[];
  /** Recurring slots already in the user's week, solo or crew. */
  fixed?: readonly Omit<PlannedSession, "fixed" | "recurrence">[];
  /** Average active minutes per week over the last 4 weeks (from the journal). */
  recentWeeklyMinutes: number;
  /** Share of planned sessions actually done over the last 4 weeks (undefined for a new plan). */
  completionRate?: number;
}

export type PlanNote = "progress" | "holding" | "lighter" | "deload" | "goal-cap" | "time-cap";

export interface WeekPlan {
  week: number;
  targetMinutes: number;
  plannedMinutes: number;
  sessions: PlannedSession[];
  restDays: Weekday[];
  notes: PlanNote[];
}

const GOAL: Record<PlanGoal, { sessions: number; cap: number; hard: number }> = {
  start: { sessions: 3, cap: 150, hard: 0 },
  consistency: { sessions: 4, cap: 180, hard: 1 },
  endurance: { sessions: 5, cap: 300, hard: 1 },
  strength: { sessions: 4, cap: 200, hard: 2 },
  calm: { sessions: 5, cap: 150, hard: 0 },
  event: { sessions: 5, cap: 360, hard: 2 },
};
const STRENGTH_SPORTS = ["lifter", "martial", "boxer"];
const EASY_SPORTS = ["yogi", "walker"];
const MINDFUL = "meditator";
const MIN_SESSION = 10;
const MINDFUL_MIN = 10;

const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);
const circGap = (a: number, b: number) => (b - a + 7) % 7 || 7;

/** Picks `n` days from `pool` that include `must` and spread as evenly as possible across the week. */
export function spreadDays(pool: readonly Weekday[], n: number, must: readonly Weekday[] = []): Weekday[] {
  const days = [...new Set(pool)].sort((a, b) => a - b);
  let best: Weekday[] = [];
  let bestScore = -Infinity;
  for (let mask = 0; mask < 1 << days.length; mask++) {
    const pick = days.filter((_, i) => mask & (1 << i));
    if (pick.length !== Math.min(n, days.length) || !must.every((d) => pick.includes(d))) continue;
    const gaps = pick.map((d, i) => circGap(d, pick[(i + 1) % pick.length]!));
    // Widest smallest gap first, then the most even week.
    const score = Math.min(...gaps) * 100 - gaps.reduce((s, g) => s + g * g, 0);
    if (score > bestScore) [best, bestScore] = [pick, score];
  }
  return best;
}

export function planWeek(r: Reality, week = 0, baseMinutes = Math.max(r.recentWeeklyMinutes, 60)): WeekPlan {
  const g = GOAL[r.goal];
  const notes: PlanNote[] = [];

  // 1. How much this week, from what the user actually did.
  let target: number;
  if (r.completionRate !== undefined && r.completionRate < 0.6) {
    target = Math.max(45, baseMinutes * 0.85);
    notes.push("lighter");
  } else if (r.completionRate !== undefined && r.completionRate < 0.8) {
    target = baseMinutes;
    notes.push("holding");
  } else {
    target = baseMinutes * 1.1;
    notes.push("progress");
  }
  if (target > g.cap) {
    target = g.cap;
    notes.push("goal-cap");
  }
  if ((week + 1) % 4 === 0) {
    target *= 0.8;
    notes.push("deload");
  }

  // 2. Which days: fixed ones first, at least one rest day, spread out.
  const fixed: PlannedSession[] = (r.fixed ?? []).map((f) => ({ ...f, fixed: true, recurrence: "weekly" }));
  const fixedDays = [...new Set(fixed.map((f) => f.day))];
  const pool = [...new Set([...r.availableDays, ...fixedDays])];
  const count = Math.max(fixedDays.length, Math.min(g.sessions, pool.length, 6));
  const days = spreadDays(pool, count, fixedDays);
  const openDays = days.filter((d) => !fixedDays.includes(d));

  // 3. Mindful slots (calm goal, or meditation among the user's sports) don't count toward the target.
  const mindfulSlots = r.goal === "calm" ? Math.min(2, openDays.length) : 0;
  const mindfulDays = openDays.slice(-mindfulSlots || openDays.length);
  const moveDays = mindfulSlots ? openDays.filter((d) => !mindfulDays.includes(d)) : openDays;

  // 4. Minutes: what's left after fixed sessions, capped by the time the user really has.
  const fixedMinutes = fixed.filter((f) => f.intensity !== "mindful").reduce((s, f) => s + f.durationMin, 0);
  const capacity = fixedMinutes + moveDays.length * r.minutesPerDay;
  if (target > capacity) {
    target = capacity;
    notes.push("time-cap");
  }
  const longDay = (r.goal === "endurance" || r.goal === "event") && moveDays.length >= 3 ? moveDays[moveDays.length - 1] : undefined;
  const shares = moveDays.map((d) => (d === longDay ? 1.5 : 1));
  const shareSum = shares.reduce((s, x) => s + x, 0);
  const remaining = Math.max(0, target - fixedMinutes);

  const sportsFor = (goalSports: readonly string[]) => {
    const liked = r.sports.filter((s) => s !== MINDFUL);
    const preferred = liked.filter((s) => goalSports.includes(s));
    return preferred.length ? preferred : liked.length ? liked : ["walker"];
  };
  const main = sportsFor(r.goal === "strength" ? STRENGTH_SPORTS : r.goal === "calm" ? EASY_SPORTS : []);
  const all = sportsFor([]);

  const planned: PlannedSession[] = moveDays.map((day, i) => ({
    day,
    sport: (i % 2 === 0 ? main : all)[Math.floor(i / 2) % (i % 2 === 0 ? main : all).length]!,
    durationMin: Math.min(r.minutesPerDay, Math.max(MIN_SESSION, round5((remaining * shares[i]!) / (shareSum || 1)))),
    intensity: r.goal === "calm" || day === longDay ? "easy" : "moderate",
    with: "solo",
    recurrence: "weekly",
    ...(day === longDay ? { long: true } : {}),
  }));
  for (const day of mindfulDays.slice(0, mindfulSlots)) {
    planned.push({ day, sport: MINDFUL, durationMin: MINDFUL_MIN, intensity: "mindful", with: "solo", recurrence: "weekly" });
  }

  // 5. Hard sessions: never on back-to-back days, never the long one, none in a beginner's first 2 weeks.
  const hardBudget = Math.min(r.goal === "start" ? (week < 2 ? 0 : 1) : g.hard, Math.floor(days.length * 0.4));
  const sessions = [...fixed, ...planned].sort((a, b) => a.day - b.day);
  const isHardOn = (d: number) => sessions.some((s) => s.intensity === "hard" && s.day === d);
  let hard = sessions.filter((s) => s.intensity === "hard").length;
  const candidates = planned
    .filter((s) => s.intensity === "moderate" && !s.long)
    .sort((a, b) => Number(STRENGTH_SPORTS.includes(b.sport)) - Number(STRENGTH_SPORTS.includes(a.sport)) || a.day - b.day);
  for (const s of candidates) {
    if (hard >= hardBudget) break;
    if (isHardOn((s.day + 6) % 7) || isHardOn((s.day + 1) % 7)) continue;
    s.intensity = "hard";
    hard++;
  }
  // After a hard week start, keep the rest mostly easy (80/20).
  for (const s of planned) if (s.intensity === "moderate" && r.goal !== "strength" && r.goal !== "consistency") s.intensity = "easy";

  const plannedMinutes = sessions.filter((s) => s.intensity !== "mindful").reduce((s, x) => s + x.durationMin, 0);
  const used = new Set(sessions.map((s) => s.day));
  return {
    week,
    targetMinutes: round5(target),
    plannedMinutes,
    sessions,
    restDays: ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((d) => !used.has(d)),
    notes,
  };
}

/** A few weeks ahead, assuming each week is done as planned (the real plan is recomputed every week). */
export function planWeeks(r: Reality, weeks: number): WeekPlan[] {
  const out: WeekPlan[] = [];
  let base = Math.max(r.recentWeeklyMinutes, 60);
  for (let w = 0; w < weeks; w++) {
    const p = planWeek(w === 0 ? r : { ...r, completionRate: 1 }, w, base);
    out.push(p);
    // A deload week doesn't lower the next week's starting point.
    if (!p.notes.includes("deload")) base = p.targetMinutes;
  }
  return out;
}

/** Share of planned sessions done, for the next plan's `completionRate`. Moving a session to another day still counts. */
export function completion(planned: readonly Pick<PlannedSession, "sport">[], done: readonly Pick<PlannedSession, "sport">[]): number {
  if (!planned.length) return 1;
  const left = [...done];
  let hit = 0;
  for (const p of planned) {
    const i = left.findIndex((d) => d.sport === p.sport);
    if (i >= 0) {
      hit++;
      left.splice(i, 1);
    }
  }
  return hit / planned.length;
}
