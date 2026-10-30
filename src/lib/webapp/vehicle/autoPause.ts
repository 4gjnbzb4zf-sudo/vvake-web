// Copied from VVFit packages/game-core/src/autoPause.ts (d19df350 2026-10-30) by scripts/sync-vehicle-core.ts. Do not edit: re-sync.
/**
 * Auto-pause and auto-resume (build 59, founder 2026-10-30, ADR-0065): during a workout, a stop (no speed and no
 * steps for a few seconds, tuned per sport) pauses the workout or suggests pausing; moving again resumes it or offers
 * "Resume?". The pause is back-dated to where the stop began and the resume to where you moved again, so a traffic
 * light never eats moving time and a short stop doesn't count at all. Auto-pauses are ordinary pause spans
 * (moving.ts `pauses`), so moving time, pace, Apple Health / Health Connect and Strava exports exclude them.
 *
 * - Modes per sport: off / suggest / auto (`prefs.autoPause = { bySport: { run: 'auto', … }, at }`, newest wins).
 *   Defaults: Automatic for run, trail run, orienteering and ride (stops are lights and crossings, and runners and
 *   riders expect it from their sport watches); Suggest for walk, hike, nordic walking, snowshoe, wheelchair (a stop
 *   is often part of the outing: a view, a chat, a photo, so VVake asks instead of deciding).
 * - Never judged: pool and indoor, strength, camera workouts, yoga and the like (`autoPauseSport` null).
 * - Cycling, wheelchair and skating use speed only; foot sports use speed and cadence (either shows movement).
 * - Suggest: at most one pause suggestion every 2 min (and one "Resume?"); a stop shorter than the threshold never counts.
 * - A pause you made yourself is never resumed by itself: VVake offers "Resume?" when you move again.
 * - A vehicle stretch (vehicleGuard.ts) is a pause of its own: no suggestion, no "Resume?" while in it.
 * - One pause state per workout (ADR-0057 `workout.state`): only the recording device runs this.
 *
 * Pure. Mirrored in Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/auto-pause-golden.json. Wear OS
 * uses Health Services' own auto-pause for mode auto (ExerciseConfig isAutoPauseAndResumeEnabled) and this for suggest.
 */

export const AUTO_PAUSE_MODES = ["off", "suggest", "auto"] as const;
export type AutoPauseMode = (typeof AUTO_PAUSE_MODES)[number];

export interface AutoPauseSport {
  /** Still this long (s) → stopped. */
  stopS: number;
  /** Moving this long (s) → moving again. */
  moveS: number;
  /** Under this speed (m/s) is "not moving". */
  stillMs: number;
  /** From this speed (m/s) is "moving". */
  movingMs: number;
  /** Steps a minute from which you are moving (null: speed only). */
  movingCadence: number | null;
  defaultMode: AutoPauseMode;
}

const FOOT_RUN: AutoPauseSport = { stopS: 10, moveS: 3, stillMs: 0.5, movingMs: 1.5, movingCadence: 100, defaultMode: "auto" };
const FOOT_WALK: AutoPauseSport = { stopS: 20, moveS: 4, stillMs: 0.3, movingMs: 0.7, movingCadence: 50, defaultMode: "suggest" };
const WHEELS: AutoPauseSport = { stopS: 8, moveS: 3, stillMs: 0.8, movingMs: 2, movingCadence: null, defaultMode: "auto" };
const ROLL: AutoPauseSport = { stopS: 15, moveS: 4, stillMs: 0.4, movingMs: 0.9, movingCadence: null, defaultMode: "suggest" };

/** Sports that can auto-pause (API keys), with their thresholds. */
export const AUTO_PAUSE_SPORTS: Readonly<Record<string, AutoPauseSport>> = {
  run: FOOT_RUN,
  "trail-run": FOOT_RUN,
  orienteering: FOOT_RUN,
  walk: FOOT_WALK,
  hike: FOOT_WALK,
  "nordic-walking": FOOT_WALK,
  snowshoe: FOOT_WALK,
  ride: WHEELS,
  "hand-cycling": WHEELS,
  skate: { ...WHEELS, defaultMode: "suggest" },
  "wheelchair-walk": ROLL,
  "wheelchair-run": { ...ROLL, stopS: 10, defaultMode: "auto" },
};

export const AUTO_PAUSE = {
  /** Suggest mode: at most one suggestion (pause or resume) this often (s). */
  suggestEveryS: 120,
  /** A pause suggestion not answered is withdrawn once you move again. */
} as const;

/** The sport's thresholds, or null when it never auto-pauses (indoor, pool, strength, camera, yoga…). Pure. */
export function autoPauseSport(sport: string): AutoPauseSport | null {
  return AUTO_PAUSE_SPORTS[sport] ?? null;
}

export interface AutoPausePrefs {
  /** Per sport (API key); a sport missing here uses its default. */
  bySport: Record<string, AutoPauseMode>;
  at: string;
}

/** The mode for a sport from the stored prefs (off for sports that never auto-pause). Pure. */
export function autoPauseModeFor(sport: string, prefs: Pick<AutoPausePrefs, "bySport"> | null | undefined): AutoPauseMode {
  const s = autoPauseSport(sport);
  if (!s) return "off";
  const m = prefs?.bySport?.[sport];
  return m && (AUTO_PAUSE_MODES as readonly string[]).includes(m) ? m : s.defaultMode;
}

/** The newer of two stored prefs. Pure. */
export function newerAutoPausePrefs(a: AutoPausePrefs | null | undefined, b: AutoPausePrefs | null | undefined): AutoPausePrefs | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

export interface AutoPauseInput {
  /** Wall-clock seconds. Readings every 1–5 s. */
  t: number;
  /** GPS speed (m/s) from good fixes, or null without one. */
  speedMs: number | null;
  /** Steps a minute (null when unknown or stale: then speed alone decides). */
  cadenceSpm: number | null;
  /** The workout's pause right now: null = running; 'auto' = paused by this; 'user' = paused by the athlete
   * (button, Siri, a suggestion they accepted, the watch); 'vehicle' = the vehicle guard. */
  pausedBy: null | "auto" | "user" | "vehicle";
}

export interface AutoPauseState {
  stillSince: number | null;
  movingSince: number | null;
  /** Last pause suggestion, wall-clock s (traffic lights: one every suggestEveryS). */
  lastSuggestAt: number | null;
  /** Last "Resume?", wall-clock s (its own limit, so a pause you just accepted can still be offered back). */
  lastResumeAt: number | null;
  /** A suggestion is showing ('pause' | 'resume'). */
  showing: "pause" | "resume" | null;
  /** The pause state at the last reading: a change starts the stop/move clocks again (no "Resume?" right after you pause). */
  prev?: AutoPauseInput["pausedBy"];
}

export const newAutoPause = (): AutoPauseState => ({
  stillSince: null,
  movingSince: null,
  lastSuggestAt: null,
  lastResumeAt: null,
  showing: null,
});

export type AutoPauseAction =
  | { kind: "pause"; from: number }
  | { kind: "resume"; at: number }
  | { kind: "suggest_pause"; from: number }
  | { kind: "suggest_resume" }
  /** Withdraw the suggestion on screen (the situation changed). */
  | { kind: "withdraw" }
  | null;

/** Is this reading still / moving for the sport? (both false = in between: keeps the current state). Pure. */
export function motionOf(s: AutoPauseSport, i: Pick<AutoPauseInput, "speedMs" | "cadenceSpm">): "still" | "moving" | "between" {
  const c = s.movingCadence === null ? null : i.cadenceSpm;
  const v = i.speedMs;
  if ((v !== null && v >= s.movingMs) || (c !== null && s.movingCadence !== null && c >= s.movingCadence)) return "moving";
  const slow = v === null ? c !== null : v < s.stillMs;
  const noSteps = s.movingCadence === null || c === null || c < s.movingCadence / 4;
  // Without a speed, steps alone decide (a treadmill-like GPS loss is not a stop unless the steps stop too).
  if (slow && noSteps && !(v === null && c === null)) return "still";
  return "between";
}

/**
 * One reading (pure). Auto: `pause {from}` back-dated to the start of the stop, `resume {at}` back-dated to where you
 * moved; an auto-pause resumes by itself, a pause of yours never does (a `suggest_resume` instead, rate-limited).
 * Suggest: `suggest_pause {from}` (accepting it pauses from `from`) and `suggest_resume`, one per suggestEveryS.
 * Vehicle: nothing at all.
 */
export function autoPauseTick(
  sport: string,
  mode: AutoPauseMode,
  s: AutoPauseState,
  i: AutoPauseInput,
): { state: AutoPauseState; action: AutoPauseAction } {
  const sp = autoPauseSport(sport);
  if (!sp || mode === "off") return { state: s, action: null };
  if (i.pausedBy === "vehicle")
    return {
      state: { ...newAutoPause(), lastSuggestAt: s.lastSuggestAt, lastResumeAt: s.lastResumeAt },
      action: s.showing ? { kind: "withdraw" } : null,
    };
  const m = motionOf(sp, i);
  // The pause changed since the last reading (you paused or resumed, or this did): count from now.
  if ((s.prev ?? null) !== i.pausedBy) s = { ...s, stillSince: null, movingSince: null, prev: i.pausedBy };
  const stillSince = m === "still" ? (s.stillSince ?? i.t) : m === "moving" ? null : s.stillSince;
  const movingSince = m === "moving" ? (s.movingSince ?? i.t) : m === "still" ? null : s.movingSince;
  const next: AutoPauseState = { ...s, stillSince, movingSince };
  const canSuggest = s.lastSuggestAt === null || i.t - s.lastSuggestAt >= AUTO_PAUSE.suggestEveryS;
  const canOfferResume = s.lastResumeAt === null || i.t - s.lastResumeAt >= AUTO_PAUSE.suggestEveryS;
  const stopped = stillSince !== null && i.t - stillSince >= sp.stopS;
  const moved = movingSince !== null && i.t - movingSince >= sp.moveS;

  if (i.pausedBy === null) {
    // Running. A pause suggestion on screen goes away once you move again.
    if (s.showing === "pause" && m === "moving") return { state: { ...next, showing: null }, action: { kind: "withdraw" } };
    if (s.showing === "resume") return { state: { ...next, showing: null }, action: { kind: "withdraw" } };
    if (!stopped) return { state: next, action: null };
    if (mode === "auto")
      return { state: { ...next, stillSince: null, movingSince: null, showing: null }, action: { kind: "pause", from: stillSince! } };
    if (s.showing || !canSuggest) return { state: next, action: null };
    return { state: { ...next, showing: "pause", lastSuggestAt: i.t }, action: { kind: "suggest_pause", from: stillSince! } };
  }
  // Paused (by this or by the athlete).
  if (s.showing === "pause") return { state: { ...next, showing: null }, action: { kind: "withdraw" } };
  if (s.showing === "resume" && m === "still") return { state: { ...next, showing: null }, action: { kind: "withdraw" } };
  if (!moved) return { state: next, action: null };
  if (i.pausedBy === "auto")
    return { state: { ...next, stillSince: null, movingSince: null, showing: null }, action: { kind: "resume", at: movingSince! } };
  if (s.showing || !canOfferResume) return { state: next, action: null };
  return { state: { ...next, showing: "resume", lastResumeAt: i.t }, action: { kind: "suggest_resume" } };
}
