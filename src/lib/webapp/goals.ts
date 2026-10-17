/**
 * Personal goals on the web (the apps' goals, VVFit packages/game-core goals.ts: be consistent, X sessions in Y days,
 * a distance in Y days). The phone keeps its goals on the phone, so the web app keeps its own in this browser, counted
 * from the account's sessions (every device's). Weight goals stay in the app (they need the adult check and weigh-ins).
 * Pure: tested in goals.test.ts.
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type GoalKind = "consistency" | "sessions" | "distance";
export const GOAL_KINDS: readonly GoalKind[] = ["consistency", "sessions", "distance"];
/** As in the app. */
export const MAX_GOALS = 8;

export interface WebGoal {
  id: string;
  kind: GoalKind;
  startMs: number;
  /** consistency: sessions a week; sessions: total sessions; distance: total km. */
  target: number;
  /** consistency: weeks; sessions and distance: days. */
  span: number;
  /** Only this API sport counts; unset: all sports. */
  sport?: string;
}

export interface GoalSession {
  sport: string;
  startMs: number;
  distanceM?: number;
}

export interface GoalProgress {
  done: number;
  target: number;
  fraction: number;
  daysLeft: number;
  onTrack: boolean;
  status: "active" | "reached" | "ended";
}

export const goalEndMs = (g: WebGoal) => g.startMs + (g.kind === "consistency" ? g.span * WEEK : g.span * DAY);

/** A goal the API's ranges allow (the app's goal screen limits). */
export function validGoal(g: Partial<WebGoal>): g is WebGoal {
  if (!g.id || !g.kind || !GOAL_KINDS.includes(g.kind) || !Number.isFinite(g.startMs)) return false;
  if (!(typeof g.target === "number" && g.target > 0) || !(typeof g.span === "number" && g.span > 0)) return false;
  if (g.kind === "consistency") return g.target <= 7 && g.span <= 52;
  if (g.kind === "sessions") return g.target <= 400 && g.span <= 366;
  return g.target <= 10_000 && g.span <= 366;
}

export function goalProgress(g: WebGoal, sessions: readonly GoalSession[], now: number): GoalProgress {
  const end = goalEndMs(g);
  const spanMs = end - g.startMs;
  const elapsed = Math.min(1, Math.max(0, (now - g.startMs) / spanMs));
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const mine = sessions.filter((s) => s.startMs >= g.startMs && s.startMs < end && (!g.sport || s.sport === g.sport));
  let done: number;
  let target: number;
  if (g.kind === "consistency") {
    const weeks = Math.ceil(Math.max(0, Math.min(now, end) - g.startMs) / WEEK);
    done = 0;
    for (let w = 0; w < weeks; w++) {
      const n = mine.filter((s) => s.startMs >= g.startMs + w * WEEK && s.startMs < g.startMs + (w + 1) * WEEK).length;
      if (n >= g.target) done++;
    }
    target = g.span;
  } else if (g.kind === "sessions") {
    done = mine.length;
    target = g.target;
  } else {
    done = Math.round(mine.reduce((a, s) => a + (s.distanceM ?? 0), 0) / 100) / 10;
    target = g.target;
  }
  const fraction = target ? Math.min(1, done / target) : 1;
  const status = done >= target ? "reached" : now >= end ? "ended" : "active";
  return { done, target, fraction, daysLeft, onTrack: fraction >= elapsed - 0.05, status };
}

/** The goals kept for this account in this browser (malformed entries dropped). */
export function parseGoals(raw: string | null): WebGoal[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v.filter((g) => validGoal(g as Partial<WebGoal>)) as WebGoal[]).slice(0, MAX_GOALS) : [];
  } catch {
    return [];
  }
}
