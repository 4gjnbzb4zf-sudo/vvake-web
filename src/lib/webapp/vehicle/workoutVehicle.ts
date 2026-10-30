import { metresBetween, type LatLon } from "../geo";
import type { WorkoutSnapshot } from "../workout";
import { elapsedS, resume } from "../workout";
import {
  footMaxSpeedMs,
  newVehicleGuard,
  VEHICLE_GUARD,
  vehicleResume,
  vehicleSeconds,
  vehicleTick,
  vehicleVerdict,
  type VehicleEvent,
  type VehicleVerdict,
} from "./vehicleGuard";

/**
 * The vehicle guard in a browser workout (VVFit build 58, ADR-0064; game-core vehicleGuard.ts copied unchanged): a
 * walk, run or hike recorded in a car, bus or train. The browser has no step count and no motion chip, so every
 * reading has `cadenceSpm: null` and `activity: "unknown"`: only the GPS speed judges (well over the foot maximum, or
 * anything over 9 m/s). When the guard enters "vehicle", the workout pauses from where the stretch began (its distance,
 * route points and samples since then are dropped); it resumes by itself once you are on foot again, or with Resume.
 *
 * Pure: tested in workoutVehicle.test.ts.
 */

/** A good fix for the speed reading (the guard's rule: accuracy ≤ 25 m). */
export const SPEED_FIX_ACCURACY_M = 25;
/** The speed is measured over at least this long (s) between good fixes, at most over SPEED_WINDOW_MAX_S. */
export const SPEED_WINDOW_MIN_S = 5;
export const SPEED_WINDOW_MAX_S = 15;

export interface SpeedFix extends LatLon {
  at: number;
}

/**
 * The GPS speed (m/s) now: the device's own when it gives one, else from the good fixes of the last 5–15 s. The fix
 * buffer comes back trimmed (keep it between calls). Null without a good fix. Pure.
 */
export function speedReading(
  buffer: readonly SpeedFix[],
  fix: { lat: number; lon: number; acc: number; at: number; speed?: number | null },
): { speedMs: number | null; buffer: SpeedFix[] } {
  if (!(fix.acc <= SPEED_FIX_ACCURACY_M)) return { speedMs: null, buffer: [...buffer] };
  const next = [...buffer, { lat: fix.lat, lon: fix.lon, at: fix.at }].filter((f) => fix.at - f.at <= SPEED_WINDOW_MAX_S * 1000);
  if (typeof fix.speed === "number" && Number.isFinite(fix.speed) && fix.speed >= 0) return { speedMs: fix.speed, buffer: next };
  const first = next[0]!;
  const dt = (fix.at - first.at) / 1000;
  if (dt < SPEED_WINDOW_MIN_S) return { speedMs: null, buffer: next };
  return { speedMs: metresBetween(first, fix) / dt, buffer: next };
}

/** Is the guard watching this sport (a foot sport with GPS)? */
export const vehicleWatched = (sport: string) => footMaxSpeedMs(sport) !== null;

/** The fix-to-fix cap for distance (km/h, before geo.ts's 1.5× slack): a foot sport never adds a step over 9 m/s. */
export function distanceCapKmh(sport: string, capKmh: number | null, slack = 1.5): number | null {
  if (!vehicleWatched(sport)) return capKmh;
  const hard = (VEHICLE_GUARD.hardMaxMs * 3.6) / slack;
  return capKmh === null ? hard : Math.min(capKmh, hard);
}

/** The workout is held by the vehicle guard (not by the athlete's own pause). */
export const inVehicle = (w: WorkoutSnapshot | null | undefined) => !!w?.vehicle && w.vehicle.mode === "vehicle";

/**
 * Pause the workout from `fromMs` (back-dated): the clock stops there, the samples, route points and distance recorded
 * since are dropped. Pure.
 */
export function cutFrom(w: WorkoutSnapshot, fromMs: number, now: number): WorkoutSnapshot {
  const at = Math.min(Math.max(fromMs, w.startedAt), now);
  const tFrom = elapsedS(w, at);
  const samples = w.samples.filter((s) => s.t <= tFrom);
  const route = w.track.route.filter((p) => p.t <= tFrom);
  const metres = Math.max(route.at(-1)?.m ?? 0, samples.at(-1)?.m ?? 0);
  return {
    ...w,
    pausedAt: w.pausedAt || at,
    samples,
    lastSampleT: samples.at(-1)?.t ?? 0,
    track: { ...w.track, metres: Math.min(w.track.metres, metres), route, last: null },
    vehiclePaused: true,
  };
}

/**
 * One speed reading through the guard (only while the workout runs, or while the guard itself holds it). Returns the
 * workout and what changed: "entered" pauses it from where the stretch began, "left" resumes it now. Pure.
 */
export function vehicleStep(w: WorkoutSnapshot, r: { now: number; speedMs: number | null }): { w: WorkoutSnapshot; event: VehicleEvent } {
  if (!vehicleWatched(w.sport)) return { w, event: null };
  // The athlete's own pause: the guard waits (a parked car looks like a pause anyway).
  if (w.pausedAt && !w.vehiclePaused) return { w, event: null };
  const x = vehicleTick(w.sport, w.vehicle ?? newVehicleGuard(), {
    t: r.now / 1000,
    speedMs: r.speedMs,
    cadenceSpm: null,
    activity: "unknown",
  });
  let next: WorkoutSnapshot = { ...w, vehicle: x.state };
  if (x.event?.kind === "entered") next = cutFrom(next, x.event.from * 1000, r.now);
  else if (x.event?.kind === "left") next = { ...resume(next, r.now), vehiclePaused: false };
  return { w: next, event: x.event };
}

/** Resume tapped on the vehicle banner: the stretch ends now, the guard watches again from scratch. Pure. */
export function vehicleResumeNow(w: WorkoutSnapshot, now: number): WorkoutSnapshot {
  if (!inVehicle(w)) return w;
  return { ...resume(w, now), vehicle: vehicleResume(w.vehicle!, now / 1000), vehiclePaused: false };
}

/** At the end: the seconds left out and the verdict ("vehicle" = mostly vehicle: kept, not counted). Pure. */
export function vehicleOutcome(w: WorkoutSnapshot, activeS: number, now: number): { vehicleS: number; verdict: VehicleVerdict } {
  if (!w.vehicle) return { vehicleS: 0, verdict: "ok" };
  const vehicleS = Math.min(13 * 3600, Math.round(vehicleSeconds(w.vehicle, now / 1000)));
  return { vehicleS, verdict: vehicleVerdict({ footS: activeS, vehicleS }) };
}
