// Copied from VVFit packages/game-core/src/goalProgress.ts (15193a8f 2026-10-30) by scripts/sync-adaptive-core.ts. Do not edit: re-sync.
/**
 * Progress toward goals (build 62, ADR-0069): for each season goal, where the athlete's fitness (athleteModel.ts,
 * 42-day load) is heading by the event date against what the event needs, with the trend and the safe best case.
 *
 * - Needed fitness: the event's peak training week (seasonGoals EVENT_PRESETS peakWeekly, first-timer end for a
 *   finish, the middle for a target time) turned into load units (≈ 1.6 per minute of mostly-easy training).
 * - Projection: fitness now + the recent ramp (last 3 weeks) × weeks left before the taper, with a lighter week in 4.
 * - Safe best case: the fastest ramp that stays healthy (10% of fitness a week, 2 to 6), the same way. When even that
 *   falls short, VVake offers a later date (`postponeDate`) or a shorter event of the same kind (`resizeTo`) as
 *   proposals: always the athlete's call.
 * - Learning: under 3 weeks of data or 6 sessions, no verdict yet ("still learning"), never a scary line.
 *
 * Health and free goals have no event: their progress is consistency (weeks with 2 sessions or more) and the fitness
 * trend. Pure.
 */
import type { AthleteModel } from "./athleteModel";
import { eventLadder } from "./feasibilityCore";
import { addDays, dayNum, EVENT_PRESETS, presetFor, weekdayOf, type EventKind, type SeasonGoal } from "../living/seasonGoals";

type Lang = "en" | "fr";

export type GoalTrend = "ahead" | "on_track" | "behind" | "at_risk" | "learning";

export interface SeasonGoalProgress {
  goalId: string;
  date: string;
  daysLeft: number;
  /** Event goals: fitness needed on the day, now, projected at the current trend, and in the safe best case. */
  needed?: number;
  now: number;
  projected?: number;
  safeBest?: number;
  /** 0–120: projected / needed (100 = ready). */
  readiness?: number;
  trend: GoalTrend;
  /** At risk even in the safe best case: a later date that makes it realistic, and a shorter event that fits now. */
  postponeDate?: string;
  resizeTo?: EventKind;
  /** Health / free goals: weeks with 2+ sessions among the last 8. */
  consistentWeeks?: number;
  /** Weekly points for the chart: fitness so far, then the projection to the event. */
  series: { week: string; fitness: number; projected?: boolean }[];
}

/** Load units per minute of mostly easy training (80/20). */
const LOAD_PER_MIN = 1.6;
const DELOAD = 0.85;

export function neededFitness(kind: EventKind, timeGoal: boolean): number {
  const p = EVENT_PRESETS[kind];
  const weekly = timeGoal ? (p.peakWeekly[0] + p.peakWeekly[1]) / 2 : p.peakWeekly[0];
  return Math.round(((weekly * LOAD_PER_MIN) / 7) * 0.9);
}

export const safeRamp = (fitness: number) => Math.min(6, Math.max(2, fitness * 0.1));

/** One goal's progress. Pure. */
export function seasonGoalProgress(goal: SeasonGoal, model: AthleteModel): SeasonGoalProgress {
  const today = model.today;
  const daysLeft = dayNum(goal.date) - dayNum(today);
  const now = model.load.fitness;
  const trace = model.trace;
  const series: SeasonGoalProgress["series"] = trace.map((t) => ({ week: t.week, fitness: t.fitness }));
  const dataWeeks = trace.filter((t) => t.sessions > 0).length;
  const learning = dataWeeks < 3 || model.sessionsUsed < 6;

  if (!goal.event || (goal.type !== "event" && goal.type !== "performance")) {
    const last8 = trace.slice(-8);
    const consistentWeeks = last8.filter((t) => t.sessions >= 2).length;
    const trend: GoalTrend = learning
      ? "learning"
      : consistentWeeks >= 6
        ? "ahead"
        : consistentWeeks >= 4
          ? "on_track"
          : consistentWeeks >= 2
            ? "behind"
            : "at_risk";
    return { goalId: goal.id, date: goal.date, daysLeft, now, trend, consistentWeeks, series };
  }

  const kind = presetFor(goal.event).kind;
  const preset = EVENT_PRESETS[kind];
  const needed = neededFitness(kind, goal.targetTimeS !== undefined);
  const weeks = Math.max(0, (daysLeft - preset.taperDays) / 7);
  const ago3 = trace.length >= 4 ? trace[trace.length - 4]!.fitness : 0;
  const rate = Math.min(safeRamp(now), Math.max(-3, (now - ago3) / 3));
  const projected = Math.round(Math.max(0, now + rate * weeks * DELOAD));
  const safeBest = Math.round(Math.min(needed * 1.2, now + safeRamp(now) * weeks * DELOAD));
  const readiness = Math.round(Math.min(120, (100 * projected) / Math.max(1, needed)));
  let trend: GoalTrend;
  if (learning) trend = "learning";
  else if (projected >= needed * 1.1) trend = "ahead";
  else if (projected >= needed) trend = "on_track";
  else if (safeBest >= needed * 0.9) trend = "behind";
  else trend = "at_risk";
  // The projection, week by week, for the chart.
  const lastWeek = trace.length ? trace[trace.length - 1]!.week : today;
  for (let w = 1; w <= Math.min(52, Math.ceil(weeks)); w++)
    series.push({ week: addDays(lastWeek, 7 * w), fitness: Math.round(now + rate * w * DELOAD), projected: true });

  const out: SeasonGoalProgress = {
    goalId: goal.id,
    date: goal.date,
    daysLeft,
    needed,
    now,
    projected,
    safeBest,
    readiness,
    trend,
    series,
  };
  if (trend === "at_risk" && daysLeft > 0) {
    // Weeks the safe ramp needs to reach 95% of what the event needs, then the taper; on a Sunday.
    const weeksNeeded = Math.ceil(Math.max(0, needed * 0.95 - now) / (safeRamp(now) * DELOAD)) + Math.ceil(preset.taperDays / 7);
    let d = addDays(today, weeksNeeded * 7);
    while (weekdayOf(d) !== 6) d = addDays(d, 1);
    if (dayNum(d) > dayNum(goal.date)) out.postponeDate = d;
    const smaller = eventLadder(kind).find((k) => neededFitness(k, false) <= safeBest);
    if (smaller) out.resizeTo = smaller;
  }
  return out;
}

const TREND: Record<GoalTrend, { en: string; fr: string }> = {
  ahead: { en: "Ahead of plan", fr: "En avance" },
  on_track: { en: "On track", fr: "Dans les temps" },
  behind: { en: "A little behind", fr: "Un peu en retard" },
  at_risk: { en: "At risk", fr: "Compromis" },
  learning: { en: "Still learning", fr: "En apprentissage" },
};
export const goalTrendWord = (t: GoalTrend, lang: Lang) => TREND[t][lang];

/** One or two plain lines under the goal. Pure. */
export function seasonGoalProgressLines(g: SeasonGoalProgress, lang: Lang): string[] {
  const fr = lang === "fr";
  if (g.trend === "learning")
    return [
      fr
        ? "VVake apprend encore ton niveau : quelques séances de plus et tu verras ta trajectoire."
        : "VVake is still learning your level: a few more sessions and you will see where you are heading.",
    ];
  if (g.needed === undefined) {
    const c = g.consistentWeeks ?? 0;
    return [fr ? `${c} semaine${c > 1 ? "s" : ""} sur 8 avec au moins 2 séances.` : `${c} of the last 8 weeks with 2 sessions or more.`];
  }
  const lines: string[] = [];
  lines.push(fr ? `Prêt à ${g.readiness} % le jour J au rythme actuel.` : `${g.readiness}% ready on the day at your current pace.`);
  if (g.trend === "behind")
    lines.push(
      fr
        ? "Encore jouable : un peu plus de régularité suffit, sans forcer."
        : "Still doable: a bit more consistency is enough, no need to force it.",
    );
  if (g.trend === "at_risk")
    lines.push(
      fr
        ? "Même en progressant au plus vite sans te blesser, ce sera juste. VVake te propose une autre option."
        : "Even at the fastest safe progression it will be tight. VVake suggests another option.",
    );
  if (g.trend === "ahead")
    lines.push(fr ? "Tu es en avance : pas besoin d’en faire plus, garde le cap." : "You are ahead: no need to do more, keep it steady.");
  return lines;
}
