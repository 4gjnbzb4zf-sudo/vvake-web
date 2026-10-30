import type { Locale } from "@/i18n/config";
import type { Spoken } from "../voicePick";
import {
  adaptiveCueLine,
  adaptiveStep,
  adaptiveSummary,
  adaptiveView,
  newAdaptiveState,
  RPE_TAP,
  rpeChecksOn,
  sessionStructure,
  validStructure,
  type AdaptiveCue,
  type AdaptiveCueKind,
  type AdaptivePrefs,
  type AdaptiveState,
  type AdaptiveSummary,
  type AdaptiveView,
  type Readiness,
  type RpeTap,
  type Said,
  type SessionStructure,
  type SessionTiming,
} from "./adaptiveSession";
import type { SuggestLevel } from "../suggest/suggest";

/**
 * A planned session run in the browser (VVFit ADR-0069 §4, docs/05-tech/adaptive-coaching.md "In-session UX"): the
 * plan's purpose, minutes and zone become game-core's structure (`sessionStructure`, the day's readiness and the health
 * cap applied), and every second of the web GPS workout steps game-core's machine (`adaptiveStep`) with the heart zone
 * (Web Bluetooth strap) or the live pace. The state lives in the workout snapshot (IndexedDB), so a reload resumes it.
 * An effort answer (Easy / Moderate / Hard) is fed on the next step; the upload carries `rpe` and
 * `adaptive: { structure, summary }`. Free workouts (no plan) never get one: zone holds as before.
 *
 * Pure: workoutAdaptive.test.ts.
 */

export interface PlannedStart {
  /** seasonWeek purpose (intervals, tempo, easy, long…), or the plain plan's type. */
  purpose: string;
  minutes: number;
  zone?: number;
  /** The season session it came from (for the summary's link back, never uploaded). */
  sessionId?: string;
}

export interface WorkoutAdaptive {
  structure: SessionStructure;
  state: AdaptiveState;
  timing: SessionTiming;
  /** Effort checks allowed (prefs.adaptive.rpeChecks against Quiet, resolved at the start). */
  rpeChecks: boolean;
  /** An effort answer or words heard, fed on the next step. */
  pendingRpe?: number;
  pendingSaid?: Said;
  /** The effort card on screen since (active s), or null. */
  askT: number | null;
}

/** Shown for 20 s, then gone (the watch's rule). */
export const RPE_CARD_S = 20;

/** seasonWeek zoneCap from the season's health flags (never a condition's name): 3 with a condition not cleared, 2 easy only. */
export function zoneCapOf(
  h: { condition?: boolean | null; cleared?: boolean | null; easyOnly?: boolean | null } | null | undefined,
): number {
  if (h?.condition && !h.cleared) return 3;
  if (h?.easyOnly) return 2;
  return 5;
}

/** The athlete's set easy / hard speeds for the sport (km/h) as paces s/km, when both make sense. */
export function pacesOf(setting: { easy?: number; hard?: number } | null | undefined): { easy?: number; hard?: number } | undefined {
  const sPerKm = (kmh?: number) => (kmh && Number.isFinite(kmh) && kmh > 0.5 ? Math.round(3600 / kmh) : undefined);
  const easy = sPerKm(setting?.easy);
  if (!easy) return undefined;
  const hard = sPerKm(setting?.hard);
  return { easy, ...(hard && hard < easy ? { hard } : {}) };
}

/**
 * The session's machine at the start, or null when the plan's session has no live structure (strength, mobility,
 * technique, race day) or when the account has no adaptive setting to follow yet: then the workout runs as before.
 */
export function startAdaptive(
  plan: PlannedStart,
  o: {
    sport: string;
    prefs: AdaptivePrefs | null;
    level: SuggestLevel;
    readiness?: Readiness | null;
    zoneCap?: number;
    paces?: { easy?: number; hard?: number };
  },
): WorkoutAdaptive | null {
  if (!plan.purpose || !(plan.minutes > 0)) return null;
  const structure = sessionStructure({
    purpose: plan.purpose,
    minutes: plan.minutes,
    sport: o.sport,
    ...(plan.zone ? { zone: plan.zone } : {}),
    ...(o.paces ? { paces: o.paces } : {}),
    ...(o.readiness ? { readiness: o.readiness } : {}),
    ...(o.zoneCap !== undefined ? { zoneCap: o.zoneCap } : {}),
  });
  if (!structure) return null;
  return {
    structure,
    state: newAdaptiveState(structure),
    timing: o.prefs?.timing ?? "adaptive",
    rpeChecks: rpeChecksOn(o.prefs, o.level),
    askT: null,
  };
}

/** A snapshot from IndexedDB: kept only when its structure still checks out. */
export function restoreAdaptive(x: unknown): WorkoutAdaptive | undefined {
  if (!x || typeof x !== "object") return undefined;
  const a = x as Partial<WorkoutAdaptive>;
  const structure = validStructure(a.structure);
  if (!structure || !a.state || typeof a.state !== "object" || !Array.isArray(a.state.durS)) return undefined;
  if (a.state.durS.length !== structure.segments.length) return undefined;
  return {
    structure,
    state: a.state,
    timing: a.timing === "fixed" ? "fixed" : "adaptive",
    rpeChecks: a.rpeChecks === true,
    askT: typeof a.askT === "number" ? a.askT : null,
    ...(typeof a.pendingRpe === "number" ? { pendingRpe: a.pendingRpe } : {}),
  };
}

/**
 * One second of the session: heart zone (only from a streaming strap), live pace (s/km, GPS), and what is pending.
 * Returns the new state and the cues to say / buzz / show. The effort card opens on rpe_check and closes after 20 s.
 */
export function stepAdaptive(
  a: WorkoutAdaptive,
  x: { t: number; zone?: number; bpm?: number; paceSPerKm?: number },
): { a: WorkoutAdaptive; cues: AdaptiveCue[] } {
  const input = {
    t: x.t,
    ...(x.zone !== undefined && x.zone > 0 ? { zone: x.zone } : {}),
    ...(x.bpm ? { bpm: x.bpm } : {}),
    ...(x.paceSPerKm && Number.isFinite(x.paceSPerKm) && x.paceSPerKm > 0 ? { paceSPerKm: x.paceSPerKm } : {}),
    ...(a.pendingRpe ? { rpe: a.pendingRpe } : {}),
    ...(a.pendingSaid ? { said: a.pendingSaid } : {}),
  };
  const r = adaptiveStep(a.structure, a.state, input, { timing: a.timing, rpeChecks: a.rpeChecks });
  let askT = a.askT !== null && x.t - a.askT >= RPE_CARD_S ? null : a.askT;
  if (a.pendingRpe) askT = null;
  if (r.cues.some((c) => c.kind === "rpe_check")) askT = x.t;
  if (r.state.done) askT = null;
  return { a: { structure: a.structure, state: r.state, timing: a.timing, rpeChecks: a.rpeChecks, askT }, cues: r.cues };
}

/** Easy / Moderate / Hard tapped (the card, or a spoken answer): fed on the next step, the card closes. */
export const answerAdaptive = (a: WorkoutAdaptive, tap: RpeTap): WorkoutAdaptive => ({ ...a, pendingRpe: RPE_TAP[tap], askT: null });

/** Something said during the workout (classifySaid), fed on the next step. */
export const heardAdaptive = (a: WorkoutAdaptive, said: Said): WorkoutAdaptive => ({ ...a, pendingSaid: said });

export const viewOf = (a: WorkoutAdaptive, t: number, hasHr: boolean): AdaptiveView =>
  adaptiveView(a.structure, a.state, t, { timing: a.timing, hasHr });

/** What goes up with the session: the structure, the summary, and the effort answers' mean (1–10) as `rpe`. */
export function adaptiveUpload(
  a: WorkoutAdaptive,
  endT: number,
): { rpe?: number; adaptive: { structure: SessionStructure; summary: AdaptiveSummary } } {
  const summary = adaptiveSummary(a.structure, a.state, endT, a.timing);
  const answers = summary.rpe.filter((n) => n >= 1 && n <= 10);
  const rpe = answers.length ? Math.round(answers.reduce((x, y) => x + y, 0) / answers.length) : undefined;
  return { ...(rpe ? { rpe } : {}), adaptive: { structure: a.structure, summary } };
}

/** Cues said even on "Essential only": the structure's turns, safety and the question; the rest only with the voice on. */
const ESSENTIAL: ReadonlySet<AdaptiveCueKind> = new Set([
  "segment_start",
  "rest_ready",
  "rep_shortened",
  "rep_dropped",
  "pain_stop",
  "rpe_check",
  "session_done",
]);
export const cueEssential = (c: AdaptiveCue) => ESSENTIAL.has(c.kind);

/** The cue's line, through the workout's speech path (the browser or the coach voice). */
export const cueSpokenOf = (c: AdaptiveCue, lang: Locale): Spoken => ({ text: adaptiveCueLine(c, lang === "fr" ? "fr" : "en") });

/** navigator.vibrate patterns for the cue's haptic (where the browser buzzes: Android Chrome; iOS Safari has none). */
export function vibrationOf(c: AdaptiveCue): number[] | null {
  switch (c.haptic) {
    case "tap":
      return [40];
    case "double":
      return [40, 80, 40];
    case "strong":
      return [120];
    default:
      return null;
  }
}

/** Adjustments in plain words for the summary ("2 rests extended, last rep dropped"). */
export function adjustLine(s: AdaptiveSummary, lang: Locale): string | null {
  const fr = lang === "fr";
  const a = s.adjust;
  const parts: string[] = [];
  const n = (k: number, en: [string, string], frw: [string, string]) => `${k} ${fr ? frw[k > 1 ? 1 : 0] : en[k > 1 ? 1 : 0]}`;
  if (a.eased)
    parts.push(
      fr
        ? a.eased === "strained"
          ? "séance passée en facile (repos d’abord)"
          : "séance allégée (un peu fatigué)"
        : a.eased === "strained"
          ? "made easy today (rest first)"
          : "made lighter (a bit tired)",
    );
  if (a.extended) parts.push(n(a.extended, ["rest extended", "rests extended"], ["récup prolongée", "récups prolongées"]));
  if (a.early) parts.push(n(a.early, ["rest ended early", "rests ended early"], ["récup raccourcie", "récups raccourcies"]));
  if (a.shortened) parts.push(n(a.shortened, ["rep shortened", "reps shortened"], ["fraction raccourcie", "fractions raccourcies"]));
  if (a.stepUps) parts.push(n(a.stepUps, ["rep made longer", "reps made longer"], ["fraction allongée", "fractions allongées"]));
  if (a.dropped) parts.push(fr ? "dernière fraction enlevée" : "last rep dropped");
  if (a.pain) parts.push(fr ? "arrêt de l’intensité (douleur)" : "hard part stopped (pain)");
  return parts.length ? parts.join(", ") : null;
}
