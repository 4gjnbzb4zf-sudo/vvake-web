// Copied from VVFit packages/game-core/src/dataCorrections.ts (c525a71a 2026-10-30) by scripts/sync-coach-core.ts. Do not edit: re-sync.
/**
 * The athlete's own corrections of a Health number (build 60, ADR-0068; founder: "the app shows 6 h sleep but I slept
 * 8"): stored as a user correction NEXT TO the Health value, never written over it (Apple Health / Health Connect stay
 * untouched), used by the coach and by readiness, shown with a "you corrected" mark, undoable. One correction per
 * metric and day (the newest wins). Pure.
 */
import { CORRECTION_BOUNDS, CORRECTION_METRICS, type CorrectionMetric } from "./coachActions";

export interface DataCorrection {
  metric: CorrectionMetric;
  /** The day it is about, YYYY-MM-DD (sleep: the night ending that morning). */
  day: string;
  value: number;
  /** What Health / the app had when corrected (for the "6 h → 8 h" line and the audit). */
  shown?: number;
  at: string;
  source: "voice" | "chat" | "tap";
}

/** Corrections older than this are dropped (readiness looks back 28 days at most). */
export const CORRECTION_KEEP_DAYS = 60;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A correction as stored, or null (unknown metric, bad day, out of bounds). Pure. */
export function cleanCorrection(raw: unknown, at: string): DataCorrection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const metric = CORRECTION_METRICS.find((m) => m === r.metric);
  if (!metric || typeof r.day !== "string" || !DAY.test(r.day)) return null;
  const [lo, hi] = CORRECTION_BOUNDS[metric];
  const v = typeof r.value === "number" ? r.value : Number(r.value);
  if (!Number.isFinite(v) || v < lo || v > hi) return null;
  const value = metric === "sleep_h" ? Math.round(v * 4) / 4 : Math.round(v);
  const s = typeof r.shown === "number" && Number.isFinite(r.shown) && r.shown >= lo && r.shown <= hi ? r.shown : undefined;
  const source = r.source === "chat" || r.source === "tap" ? r.source : "voice";
  return { metric, day: r.day, value, ...(s !== undefined ? { shown: s } : {}), at, source };
}

/** The value to use for a metric on a day: the athlete's correction if any, else Health's. Pure. */
export function effectiveValue(
  metric: CorrectionMetric,
  day: string,
  health: number | null | undefined,
  corrections: readonly DataCorrection[],
): { value: number | null; corrected: boolean } {
  const c = corrections.filter((x) => x.metric === metric && x.day === day).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (c) return { value: c.value, corrected: true };
  return { value: health ?? null, corrected: false };
}

/** Adds (or replaces the same metric + day) and drops the old ones. Pure. */
export function upsertCorrection(list: readonly DataCorrection[], c: DataCorrection, today: string): DataCorrection[] {
  const cutoff = Date.parse(`${today}T00:00:00Z`) - CORRECTION_KEEP_DAYS * 86_400_000;
  return [...list.filter((x) => !(x.metric === c.metric && x.day === c.day) && Date.parse(`${x.day}T00:00:00Z`) >= cutoff), c].sort(
    (a, b) => a.day.localeCompare(b.day),
  );
}

/** The coach's line about corrections in the window (so it never argues with the athlete's own number). Pure. */
export function correctionsLine(list: readonly DataCorrection[], fromDay: string): string {
  const recent = list.filter((c) => c.day >= fromDay);
  if (!recent.length) return "";
  return `The athlete corrected these (use their numbers, not Health's): ${recent.map((c) => `${c.metric} ${c.day} = ${c.value}${c.shown !== undefined ? ` (Health said ${c.shown})` : ""}`).join("; ")}.`;
}
