// Copied from VVFit packages/game-core/src/autoStart.ts (c5415dec 2026-10-30) by scripts/sync-vehicle-core.ts. Do not edit: re-sync.
/**
 * Start workouts for me (build 58, ADR-0064): when you start walking or running, VVake notices and either asks
 * ("Looks like a walk, start it?") or starts the workout by itself, back-dated to when the movement began.
 *
 * One setting per account (`prefs.autoStart = { mode, at }`, newest `at` wins, ADR-0044's rule): Off / Ask me (the
 * default) / Start automatically. The detector is the phone's motion chip (iPhone CMMotionActivity + pedometer
 * history, Android Activity Recognition transitions); the watch records when it is worn (better evidence), so a
 * workout never starts twice (ADR-0057 workout.state). Never in a vehicle (vehicleGuard.ts), never during a workout.
 * Points and prize rules are unchanged: an auto-started session earns like a manual one.
 *
 * Pure. Mirrored in Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/auto-start-golden.json.
 */
import type { MotionActivity } from "./vehicleGuard";

export const AUTO_START_MODES = ["off", "ask", "auto"] as const;
export type AutoStartMode = (typeof AUTO_START_MODES)[number];
export const DEFAULT_AUTO_START_MODE: AutoStartMode = "ask";

export interface AutoStartPrefs {
  mode: AutoStartMode;
  /** When it was chosen (ISO), for newest-wins sync. */
  at: string;
}

/** A mode from anything stored (unknown or missing: the default). Pure. */
export function autoStartModeOf(v: unknown): AutoStartMode {
  return typeof v === "string" && (AUTO_START_MODES as readonly string[]).includes(v) ? (v as AutoStartMode) : DEFAULT_AUTO_START_MODE;
}

/** The newer of two stored prefs (either may be missing). Pure. */
export function newerAutoStartPrefs(a: AutoStartPrefs | null | undefined, b: AutoStartPrefs | null | undefined): AutoStartPrefs | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

export const AUTO_START = {
  /** Walking this long in a row (motion chip, or steps ≥ minCadenceSpm) before VVake asks or starts. */
  walkConfirmS: 120,
  /** Running this long in a row. */
  runConfirmS: 60,
  /** Steps a minute that make "walking" when the chip is unsure. */
  minCadenceSpm: 60,
  /** Steps a minute from which a bout is a run (when the chip says nothing). */
  runCadenceSpm: 140,
  /** A bout that began after the last vehicle reading by less than this is not trusted yet (getting out of a car). */
  afterVehicleS: 60,
  /** An auto-started workout shorter than this (moving time) is dropped silently: a walk to the car, not a workout. */
  minKeepS: 300,
  /** No steps / stationary this long: an auto-started workout ends by itself (end time = the last movement). */
  autoEndStillS: 300,
  /** "Ask me": one ask per bout; at most this many a local day. */
  maxAsksPerDay: 3,
  /** "Not now": no other ask for this long. */
  snoozeS: 2 * 3600,
  /** Back-dating limit: a confirmed start never goes further back than this. */
  maxBackdateS: 30 * 60,
  /** An ask not answered within this is withdrawn (the notification is removed). */
  askExpiresS: 20 * 60,
} as const;

/** The two sports VVake detects (API keys). Cycling is left out: from the motion chip alone it can't be told from traffic. */
export type AutoSport = "walk" | "run";

/** One motion bout as the detector saw it. */
export interface MotionBout {
  /** walking / running from the chip, or 'unknown' when only steps say it. */
  activity: MotionActivity;
  /** Wall-clock ms the bout began (first walking/running reading, or first minute with steps). */
  sinceMs: number;
  /** Steps a minute over the bout so far (pedometer), when known. */
  cadenceSpm?: number | null;
}

export interface AutoStartInput {
  mode: AutoStartMode;
  nowMs: number;
  bout: MotionBout | null;
  /** A workout is live on this device or a linked one (workout.state, ADR-0057). */
  inWorkout: boolean;
  /** Last wall-clock ms the chip said automotive (or the vehicle guard was on), if any. */
  lastVehicleMs?: number | null;
  /** Quiet (ADR-0062): the ask becomes a silent notification (no sound, no banner, no watch tap). */
  quiet: boolean;
  /** Quiet hours or the notification budget say not now (game-core notificationAllowed ≠ 'send'). */
  notifyHeld: boolean;
  asksToday: number;
  /** This bout was already asked about / started (one action per bout). */
  boutHandled: boolean;
  /** Last "Not now" (ms), if any. */
  snoozedAtMs?: number | null;
}

export type AutoStartAction =
  | { kind: "none"; why: "off" | "no_bout" | "in_workout" | "vehicle" | "not_yet" | "handled" | "snoozed" | "asks_spent" }
  | { kind: "ask"; sport: AutoSport; startedAtMs: number; silent: boolean }
  | { kind: "start"; sport: AutoSport; startedAtMs: number };

/** Walk or run, from the chip first, else the cadence. Pure. */
export function boutSport(b: MotionBout): AutoSport | null {
  if (b.activity === "running") return "run";
  if (b.activity === "walking") return (b.cadenceSpm ?? 0) >= AUTO_START.runCadenceSpm ? "run" : "walk";
  if (b.activity !== "unknown") return null;
  const c = b.cadenceSpm ?? 0;
  if (c >= AUTO_START.runCadenceSpm) return "run";
  return c >= AUTO_START.minCadenceSpm ? "walk" : null;
}

/**
 * What to do about the current motion bout. "Start automatically" is the athlete's own choice, so Quiet, quiet hours
 * and the budget never hold it (its notification is exempt, kind `auto_workout`); "Ask me" goes through them (kind
 * `workout_detected`): under Quiet, or held by the budget/quiet hours, the ask is a silent notification (it stays in
 * the notification list, no sound, no watch tap), never dropped, so the walk can still be saved later. Pure.
 */
export function autoStartDecision(i: AutoStartInput): AutoStartAction {
  if (i.mode === "off") return { kind: "none", why: "off" };
  if (!i.bout) return { kind: "none", why: "no_bout" };
  if (i.inWorkout) return { kind: "none", why: "in_workout" };
  if (
    i.bout.activity === "automotive" ||
    (i.lastVehicleMs != null &&
      i.bout.sinceMs - i.lastVehicleMs < AUTO_START.afterVehicleS * 1000 &&
      i.nowMs - i.lastVehicleMs < AUTO_START.maxBackdateS * 1000)
  )
    return { kind: "none", why: "vehicle" };
  const sport = boutSport(i.bout);
  if (!sport) return { kind: "none", why: "no_bout" };
  const needS = sport === "run" ? AUTO_START.runConfirmS : AUTO_START.walkConfirmS;
  if (i.nowMs - i.bout.sinceMs < needS * 1000) return { kind: "none", why: "not_yet" };
  if (i.boutHandled) return { kind: "none", why: "handled" };
  const startedAtMs = Math.max(i.bout.sinceMs, i.nowMs - AUTO_START.maxBackdateS * 1000);
  if (i.mode === "auto") return { kind: "start", sport, startedAtMs };
  if (i.snoozedAtMs != null && i.nowMs - i.snoozedAtMs < AUTO_START.snoozeS * 1000) return { kind: "none", why: "snoozed" };
  if (i.asksToday >= AUTO_START.maxAsksPerDay) return { kind: "none", why: "asks_spent" };
  return { kind: "ask", sport, startedAtMs, silent: i.quiet || i.notifyHeld };
}

/** An auto-started workout that ended: keep it, or drop it silently (too short to be a workout). Pure. */
export function autoStartKeep(i: { activeS: number; autoStarted: boolean }): boolean {
  return !i.autoStarted || i.activeS >= AUTO_START.minKeepS;
}

/** An auto-started workout: end it by itself now? (still / no steps for autoEndStillS). Pure. */
export function autoStartShouldEnd(i: { autoStarted: boolean; nowMs: number; lastMoveMs: number }): boolean {
  return i.autoStarted && i.nowMs - i.lastMoveMs >= AUTO_START.autoEndStillS * 1000;
}

/**
 * Which device records an auto-start (ADR-0057: one session): the watch when it is paired, has VVake and is worn or
 * reachable (heart rate, better evidence), else the phone. Pure.
 */
export function autoStartDevice(i: { watchPaired: boolean; watchAppInstalled: boolean; watchReachable: boolean }): "watch" | "phone" {
  return i.watchPaired && i.watchAppInstalled && i.watchReachable ? "watch" : "phone";
}
