import { cleanSpeedSetting, SPEED_SPORTS_MAX, WORKOUT_VOICE_MODES, type SpeedZonesPrefs, type WorkoutVoicePref } from "./speedZones";

/**
 * The two workout settings kept with the account (ADR-0044, api-v1.md "prefs also carries two workout settings"):
 * the workout voice switch (`prefs.workoutVoice`) and the speed zones per sport (`prefs.speedZones`). This browser
 * keeps its own copy per account with its `at` (localStorage, every access wrapped: private windows work for the
 * visit); on load the account's copy is adopted when newer, ours is sent when newer (newest wins, as on the server,
 * which ignores an older one). Pure apart from the storage helpers; tested in workoutPrefs.test.ts.
 */

export const voiceKey = (userId: string) => `vvake-app-workout-voice:${userId}`;
export const zonesKey = (userId: string) => `vvake-app-speed-zones:${userId}`;

const validAt = (at: unknown): at is string => typeof at === "string" && Number.isFinite(Date.parse(at));

/** A workout voice choice as stored or received, or null when it isn't one. */
export function parseWorkoutVoice(x: unknown): WorkoutVoicePref | null {
  const v = x as Partial<WorkoutVoicePref> | null | undefined;
  if (!v || !validAt(v.at) || !WORKOUT_VOICE_MODES.includes(v.mode as WorkoutVoicePref["mode"])) return null;
  return { mode: v.mode as WorkoutVoicePref["mode"], at: v.at };
}

/** Speed zones as stored or received: every usable sport cleaned (at most 40, keys a-z0-9_-), or null. */
export function parseSpeedZones(x: unknown): SpeedZonesPrefs | null {
  const v = x as { at?: unknown; sports?: unknown } | null | undefined;
  if (!v || !validAt(v.at) || !v.sports || typeof v.sports !== "object" || Array.isArray(v.sports)) return null;
  const sports: SpeedZonesPrefs["sports"] = {};
  for (const [k, s] of Object.entries(v.sports as Record<string, unknown>).slice(0, SPEED_SPORTS_MAX)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    const c = cleanSpeedSetting(s);
    if (c) sports[k] = c;
  }
  return { at: v.at, sports };
}

/**
 * Newest wins between this browser's copy and the account's: `adopt` the account's when it is newer (or ours is
 * missing), `push` ours when it is newer (or the account has none). Same time: nothing to do.
 */
export function reconcile<T extends { at: string }>(local: T | null, account: T | null): { adopt?: T; push?: T } {
  if (!account) return local ? { push: local } : {};
  if (!local) return { adopt: account };
  const a = Date.parse(account.at);
  const l = Date.parse(local.at);
  if (a > l) return { adopt: account };
  if (l > a) return { push: local };
  return {};
}

export function readStored<T>(key: string, parse: (x: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode or full storage: kept for this visit (and on the account)
  }
}
