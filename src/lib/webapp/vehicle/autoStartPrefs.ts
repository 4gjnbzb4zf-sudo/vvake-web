import { type AutoStartMode, type AutoStartPrefs } from "./autoStart";

/**
 * Start workouts for me on vvake.com/account (VVFit build 58): a new choice stamped now and always after the one the
 * account has, so it wins on every device (newest `at` wins, game-core newerAutoStartPrefs on the server). Pure but
 * for the clock.
 */
export function nextAutoStart(prev: unknown, mode: AutoStartMode, now = Date.now()): AutoStartPrefs {
  const at = typeof (prev as { at?: unknown } | null)?.at === "string" ? Date.parse((prev as { at: string }).at) : NaN;
  return { mode, at: new Date(Math.max(now, Number.isFinite(at) ? at + 1 : 0)).toISOString() };
}
