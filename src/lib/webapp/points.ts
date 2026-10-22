/**
 * VV points on the web app (Today's pill, You → VV points): this week's points from the sessions already loaded,
 * and the short lines Today's doors show. Points only: no token amount, wallet or claim in the web app.
 */

export interface PointsSession {
  startedAt: string;
  points?: number | null;
  excluded?: boolean | null;
  pointsDetail?: { streakBonus: number } | null;
}

/** Monday 00:00 local time of the week `now` falls in (the apps' week, Monday first). */
export function weekStartMs(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** This week's VV points: the sessions started since Monday, excluded ones left out. */
export function weekPoints(sessions: readonly PointsSession[], now: number): { points: number; bonus: number; counted: number } {
  const from = weekStartMs(now);
  let points = 0;
  let bonus = 0;
  let counted = 0;
  for (const s of sessions) {
    const at = Date.parse(s.startedAt);
    if (!Number.isFinite(at) || at < from || at > now || s.excluded) continue;
    if (typeof s.points !== "number" || !Number.isFinite(s.points) || s.points <= 0) continue;
    points += s.points;
    bonus += Math.max(0, s.pointsDetail?.streakBonus ?? 0);
    counted++;
  }
  return { points: Math.round(points), bonus: Math.round(bonus), counted };
}

export interface HabitDayLike {
  on: { water: boolean; meals: boolean; sleep: boolean };
  glasses: number;
  meals: number;
}

/** What the Habits door says: today's glasses and meals for the habits that are on, or the generic line. */
export function habitsDoor(
  day: HabitDayLike | null,
):
  | { kind: "both"; glasses: number; meals: number }
  | { kind: "water"; glasses: number }
  | { kind: "meals"; meals: number }
  | { kind: "none" } {
  if (!day || (day.glasses <= 0 && day.meals <= 0)) return { kind: "none" };
  if (day.on.water && day.on.meals) return { kind: "both", glasses: day.glasses, meals: day.meals };
  if (day.on.water) return { kind: "water", glasses: day.glasses };
  if (day.on.meals) return { kind: "meals", meals: day.meals };
  return { kind: "none" };
}
