/**
 * Build 54 (founder ask): the ways to start a workout, and what Home shows.
 *
 * 1. The camera workout's last pick (`CameraPick`): its screen opens with Start at the top, set to what you picked last
 *    (a catalogue routine, a move, or "just start moving"); the first time, the beginner routine with the choices
 *    open. Kept on each device (phone storage, browser storage).
 * 2. Show on Home (`StartWaysPrefs`): GPS & sensor workouts (watch, phone GPS, strap) and camera workouts, each shown
 *    or hidden on Home and the main entries, synced as `prefs.startWays = { gps, camera, at }` (newest `at` wins).
 *    Never both hidden: at least one way to start stays on Home. Hidden never means gone: Start › All sports keeps
 *    every sport and the camera workout.
 *
 * Pure. Copied from VVFit packages/game-core/src/startWays.ts (keep in step).
 */

// ── The camera workout's last pick ──────────────────────────────────────────────────────────────────────────────

export type CameraPick = { kind: "free" } | { kind: "move"; id: string } | { kind: "routine"; id: string };

/** The routine a first camera workout starts with. */
export const DEFAULT_CAMERA_ROUTINE = "beginner-full-body";

const ID = /^[a-z0-9_-]{1,64}$/;

/** A stored pick (JSON), or null when missing or unreadable. Pure. */
export function parseCameraPick(json: string | null | undefined): CameraPick | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as { kind?: unknown; id?: unknown } | null;
    if (!v || typeof v !== "object") return null;
    if (v.kind === "free") return { kind: "free" };
    if ((v.kind === "move" || v.kind === "routine") && typeof v.id === "string" && ID.test(v.id)) return { kind: v.kind, id: v.id };
    return null;
  } catch {
    return null;
  }
}

/**
 * What to remember from a plan about to start: a catalogue routine, a catalogue (or taught) move, or "just start
 * moving". Trainings, skills, your own workout and plan-made routines are opened from their own screens: null. Pure.
 */
export function cameraPickOf(
  plan: { routine: { id: string } | null; move: string | null; training?: unknown; skill?: unknown },
  known: { routine: (id: string) => boolean; move: (id: string) => boolean },
): CameraPick | null {
  if (plan.training || plan.skill) return null;
  if (plan.routine) return known.routine(plan.routine.id) ? { kind: "routine", id: plan.routine.id } : null;
  if (plan.move) return known.move(plan.move) ? { kind: "move", id: plan.move } : null;
  return { kind: "free" };
}

/**
 * The pick the screen opens with, and whether the choices start open: the last pick when it still exists, else the
 * beginner routine with the choices open (first use, or the routine or move is gone). Pure.
 */
export function openingPick(
  last: CameraPick | null,
  known: { routine: (id: string) => boolean; move: (id: string) => boolean },
): { pick: CameraPick; open: boolean } {
  if (last?.kind === "free") return { pick: last, open: false };
  if (last?.kind === "routine" && known.routine(last.id)) return { pick: last, open: false };
  if (last?.kind === "move" && known.move(last.id)) return { pick: last, open: false };
  return { pick: { kind: "routine", id: DEFAULT_CAMERA_ROUTINE }, open: true };
}

// ── Show on Home ────────────────────────────────────────────────────────────────────────────────────────────────

export type StartWay = "gps" | "camera";
export const START_WAYS: readonly StartWay[] = ["gps", "camera"];

export interface StartWaysPrefs {
  gps: boolean;
  camera: boolean;
  /** When it was chosen (ISO), for newest-wins sync. */
  at: string;
}

/** Stored prefs, cleaned (anything else: null, i.e. both shown). Pure. */
export function cleanStartWays(v: unknown): StartWaysPrefs | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.gps !== "boolean" || typeof o.camera !== "boolean" || typeof o.at !== "string" || !Number.isFinite(Date.parse(o.at)))
    return null;
  // Never both hidden, even from an old or broken client.
  return { gps: o.gps || !o.camera, camera: o.camera, at: o.at };
}

/** The newer of two (either may be missing). Pure. */
export function newerStartWays(a: StartWaysPrefs | null | undefined, b: StartWaysPrefs | null | undefined): StartWaysPrefs | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

/**
 * What Home shows: camera only while the Camera & trainings feature is on, GPS & sensors whenever the camera is
 * not shown (never both hidden). Absent prefs: both. Pure.
 */
export function homeWays(
  prefs: Pick<StartWaysPrefs, "gps" | "camera"> | null | undefined,
  cameraFeature: boolean,
): { gps: boolean; camera: boolean } {
  const camera = cameraFeature && (prefs ? prefs.camera : true);
  return { gps: !camera || (prefs ? prefs.gps : true), camera };
}

/** Can this way be hidden now? Not when it is the only one Home shows. Pure. */
export function canHideWay(
  way: StartWay,
  prefs: Pick<StartWaysPrefs, "gps" | "camera"> | null | undefined,
  cameraFeature: boolean,
): boolean {
  const shown = homeWays(prefs, cameraFeature);
  return way === "gps" ? shown.camera : shown.gps;
}

/**
 * One way shown or hidden (stamped `now`). Hiding the only way Home shows does nothing (null): at least one way to
 * start a workout stays. Pure.
 */
export function setStartWay(
  prefs: Pick<StartWaysPrefs, "gps" | "camera"> | null | undefined,
  way: StartWay,
  show: boolean,
  cameraFeature: boolean,
  now = new Date(),
): StartWaysPrefs | null {
  if (!show && !canHideWay(way, prefs, cameraFeature)) return null;
  const cur = homeWays(prefs, cameraFeature);
  const next = { gps: cur.gps, camera: prefs ? prefs.camera : true, [way]: show } as { gps: boolean; camera: boolean };
  return { gps: next.gps || !(cameraFeature && next.camera), camera: next.camera, at: now.toISOString() };
}
