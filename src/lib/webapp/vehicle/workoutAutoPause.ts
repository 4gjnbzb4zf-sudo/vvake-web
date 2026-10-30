import { resume, type WorkoutSnapshot } from "../workout";
import {
  AUTO_PAUSE_MODES,
  autoPauseModeFor,
  autoPauseSport,
  autoPauseTick,
  newAutoPause,
  type AutoPauseAction,
  type AutoPauseInput,
  type AutoPauseMode,
  type AutoPausePrefs,
  type AutoPauseState,
} from "./autoPause";
import { cutFrom, type SpeedFix } from "./workoutVehicle";

/**
 * Auto-pause and auto-resume in a browser workout (VVFit build 59, ADR-0065; game-core autoPause.ts copied unchanged).
 * The browser has no step count, so every reading has `cadenceSpm: null`: the GPS speed alone decides (the same
 * speed reading the vehicle guard uses). Per sport the account's prefs.autoPause says Off / Suggest / Automatic.
 *
 * - Automatic: a stop pauses the workout from where it began (back-dated: the distance, route points and samples since
 *   are dropped, like the vehicle guard's cut) and moving again resumes it from where you moved (the moving seconds
 *   since count, and the distance is measured again from the fix of that moment).
 * - Suggest: a card "Stopped? Pause" (Pause pauses from where the stop began) or "Moving again? Resume", withdrawn
 *   when the situation changes. An accepted suggestion is your own pause: it never resumes by itself.
 * - Your own pause (button, accepted card) is never resumed by itself; a vehicle stretch is left to the vehicle guard.
 *
 * The web session has one pause truth: `pausedAt` / `pausedMs` (moving time = elapsed minus every pause), so an
 * auto-pause counts exactly as a pause of yours in moving time, pace and splits. Pure: tested in workoutAutoPause.test.ts.
 */

/** A suggestion card on screen (`fromMs`: where the stop began, for Pause). */
export type AutoPauseCard = { kind: "pause"; fromMs: number } | { kind: "resume" };

/** prefs.autoPause from the account, or null when it is missing or malformed (then every sport uses its default). Pure. */
export function parseAutoPausePrefs(raw: unknown): AutoPausePrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { bySport?: unknown; at?: unknown };
  if (typeof r.at !== "string" || !Number.isFinite(Date.parse(r.at))) return null;
  const bySport: Record<string, AutoPauseMode> = {};
  if (r.bySport && typeof r.bySport === "object")
    for (const [k, v] of Object.entries(r.bySport as Record<string, unknown>))
      if (typeof v === "string" && (AUTO_PAUSE_MODES as readonly string[]).includes(v)) bySport[k] = v as AutoPauseMode;
  return { bySport, at: r.at };
}

/**
 * A new choice for one sport on vvake.com/account: the others kept, stamped now and always after the account's `at`,
 * so it wins on every device (newest wins, game-core newerAutoPausePrefs on the server). Pure but for the clock.
 */
export function nextAutoPause(prev: unknown, sport: string, mode: AutoPauseMode, now = Date.now()): AutoPausePrefs {
  const p = parseAutoPausePrefs(prev);
  const at = p ? Date.parse(p.at) : NaN;
  return {
    bySport: { ...(p?.bySport ?? {}), [sport]: mode },
    at: new Date(Math.max(now, Number.isFinite(at) ? at + 1 : 0)).toISOString(),
  };
}

/** Who holds the pause now, as autoPauseTick reads it. Pure. */
export function pausedByOf(w: WorkoutSnapshot): AutoPauseInput["pausedBy"] {
  if (w.vehiclePaused) return "vehicle";
  if (!w.pausedAt) return null;
  return w.autoPaused ? "auto" : "user";
}

/** Pause from `fromMs` (back-dated; the stop is not moving time). `auto`: held by auto-pause (resumes by itself). Pure. */
export function pauseFrom(w: WorkoutSnapshot, fromMs: number, now: number, auto: boolean): WorkoutSnapshot {
  if (w.pausedAt) return w;
  return { ...cutFrom(w, fromMs, now), vehiclePaused: false, autoPaused: auto, autoCard: null };
}

/**
 * Resume from `atMs` (back-dated to where you moved again: those seconds count). The distance starts again from the
 * good fix closest after that moment (from `fixes`, the speed buffer), so the metres walked since count too. Pure.
 */
export function resumeAt(w: WorkoutSnapshot, atMs: number, now: number, fixes: readonly SpeedFix[] = []): WorkoutSnapshot {
  if (!w.pausedAt) return w;
  const at = Math.min(Math.max(atMs, w.pausedAt), now);
  const from = fixes.find((f) => f.at >= at && f.at <= now) ?? null;
  const r = resume(w, at);
  return {
    ...r,
    track: { ...r.track, last: from ? { lat: from.lat, lon: from.lon, at: from.at } : null },
    autoPaused: false,
    autoCard: null,
  };
}

/**
 * One speed reading through auto-pause (`mode` from autoPauseModeFor). Returns the workout and the action game-core
 * gave: "pause"/"resume" are applied (back-dated), "suggest_*" put a card up, "withdraw" takes it down. Pure.
 */
export function autoPauseStep(
  w: WorkoutSnapshot,
  r: { now: number; speedMs: number | null; mode: AutoPauseMode; fixes?: readonly SpeedFix[] },
): { w: WorkoutSnapshot; action: AutoPauseAction } {
  if (!autoPauseSport(w.sport) || r.mode === "off" || w.endedAt) return { w, action: null };
  const x = autoPauseTick(w.sport, r.mode, w.autoPause ?? newAutoPause(), {
    t: r.now / 1000,
    speedMs: r.speedMs,
    cadenceSpm: null,
    pausedBy: pausedByOf(w),
  });
  let next: WorkoutSnapshot = { ...w, autoPause: x.state };
  const a = x.action;
  if (a?.kind === "pause") next = pauseFrom(next, a.from * 1000, r.now, true);
  else if (a?.kind === "resume") next = resumeAt(next, a.at * 1000, r.now, r.fixes);
  else if (a?.kind === "suggest_pause") next = { ...next, autoCard: { kind: "pause", fromMs: a.from * 1000 } };
  else if (a?.kind === "suggest_resume") next = { ...next, autoCard: { kind: "resume" } };
  else if (a?.kind === "withdraw") next = { ...next, autoCard: null };
  return { w: next, action: a };
}

/** The card's main button: Pause (from where the stop began; your own pause) or Resume (now). Pure. */
export function acceptAutoCard(w: WorkoutSnapshot, now: number): WorkoutSnapshot {
  const c = w.autoCard;
  if (!c) return w;
  const state: AutoPauseState | undefined = w.autoPause ? { ...w.autoPause, showing: null } : undefined;
  if (c.kind === "pause") return { ...pauseFrom(w, c.fromMs, now, false), autoPause: state };
  return { ...resume(w, now), autoPaused: false, autoCard: null, autoPause: state };
}

/** The card's ×: hidden; the next suggestion waits its turn (one every 2 min). Pure. */
export function dismissAutoCard(w: WorkoutSnapshot): WorkoutSnapshot {
  if (!w.autoCard) return w;
  return { ...w, autoCard: null, autoPause: w.autoPause ? { ...w.autoPause, showing: null } : undefined };
}

export { autoPauseModeFor };
