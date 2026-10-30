// Copied from VVFit packages/game-core/src/vehicleGuard.ts (c5415dec 2026-10-30) by scripts/sync-vehicle-core.ts. Do not edit: re-sync.
/**
 * Vehicle guard (build 58, ADR-0064): a foot workout (walk, run, hike…) started or carried on in a car, bus or train.
 *
 * Founder report 2026-10-29: a walk started while driving recorded a humanly impossible pace with no steps. Build 57
 * kept it on the phone and the server refused it whole (`distanceM: average speed over 12 km/h for walk`, a schema
 * error), so the account never saw it and the journal said "The server refused this session".
 *
 * Now, live on every device: a stretch that looks like a vehicle (sustained speed above the sport's foot maximum with
 * no steps or an impossible stride, or the motion chip saying "automotive") pauses the workout from where it began
 * (back-dated, nothing of it counts) and says so calmly. The workout resumes by itself once you are on foot again
 * (steps, or the motion chip says walking/running), or with Resume. A session that is mostly vehicle is kept in the
 * journal as "Not counted: vehicle detected" and counts for nothing (points, prizes, streak, city/league, bests,
 * ghosts, challenges). The server checks the samples again (`vehicleSegments`), so a tampered client can't pass.
 *
 * Pure. Mirrored in Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/vehicle-golden.json.
 */

/** Foot sports the guard watches (API sport keys). Indoor ones (treadmill, stairs) have no GPS and are never judged. */
export const FOOT_MAX_SPEED_MS: Readonly<Record<string, number>> = {
  walk: 2.8,
  "nordic-walking": 3,
  hike: 3,
  snowshoe: 3,
  run: 7,
  "trail-run": 7,
  orienteering: 7,
};

export const VEHICLE_GUARD = {
  /** Suspicious for this long in a row (speed / stride evidence): a vehicle. The stretch starts where it began. */
  confirmS: 30,
  /** The motion chip says "automotive" for this long in a row: a vehicle. */
  activityConfirmS: 15,
  /** On foot again (steps, or the chip says walking/running, below the foot maximum) this long: the workout resumes. */
  leaveS: 20,
  /** Faster than this (m/s, 32 km/h) in any foot sport: nobody sustains it on foot, steps or not. */
  hardMaxMs: 9,
  /** Steps a minute under which a fast stretch is "no steps". */
  minCadenceSpm: 30,
  /** No step count at all (no permission, or the count is stale): fast means this many times the foot maximum. */
  unknownCadenceFactor: 1.5,
  /** Server tolerance over the foot maximum (GPS noise between samples). */
  serverFactor: 1.25,
  /** Server: vehicle segments are kept from this long (s); the client already removed the ones it saw. */
  serverMinSegmentS: 60,
  /** A session whose foot time is under this, with any vehicle stretch, is "mostly vehicle". */
  minFootS: 60,
  /** Default body height (cm) for the stride check when the profile has none. */
  defaultHeightCm: 175,
} as const;

/** The motion chip's guess (iPhone/Apple Watch CMMotionActivity, Android/Wear Activity Recognition), normalised. */
export type MotionActivity = "automotive" | "cycling" | "running" | "walking" | "stationary" | "unknown";

/** The foot maximum for a sport (m/s), or null when the sport isn't judged (indoor, not on foot). Pure. */
export function footMaxSpeedMs(sport: string): number | null {
  return FOOT_MAX_SPEED_MS[sport] ?? null;
}

/** One live reading, every 2–10 s. */
export interface VehicleTickInput {
  /** Wall-clock seconds (any epoch; only differences matter). */
  t: number;
  /** GPS speed over the last ~10 s from good fixes (m/s), or null without a good fix. */
  speedMs: number | null;
  /** Steps a minute over the last ~10–20 s, or null when unknown (no permission, or no update for 20 s: stale ≠ 0). */
  cadenceSpm: number | null;
  /** The motion chip (confident readings only; anything else is 'unknown'). */
  activity?: MotionActivity;
  heightCm?: number;
}

export type VehicleSuspicion = "activity" | "speed" | "stride" | null;

/** Why this one reading looks like a vehicle, or null (pure). */
export function vehicleSuspicion(sport: string, i: Omit<VehicleTickInput, "t">): VehicleSuspicion {
  const max = footMaxSpeedMs(sport);
  if (max === null) return null;
  if (i.activity === "automotive") return "activity";
  const v = i.speedMs;
  if (v === null || !(v >= 0)) return null;
  if (v > VEHICLE_GUARD.hardMaxMs) return "speed";
  if (v <= max) return null;
  const c = i.cadenceSpm;
  if (c === null || !(c >= 0)) return v > Math.max(4, max * VEHICLE_GUARD.unknownCadenceFactor) ? "speed" : null;
  if (c < VEHICLE_GUARD.minCadenceSpm) return "speed";
  // Steps, but each one longer than a body allows (1.3 × height): a bumpy car ride counted as steps.
  const stepM = v / (c / 60);
  return stepM > 1.3 * ((i.heightCm ?? VEHICLE_GUARD.defaultHeightCm) / 100) ? "stride" : null;
}

/** On foot: steps, or the chip says walking/running, and not faster than the foot maximum (pure). */
export function footEvidence(sport: string, i: Omit<VehicleTickInput, "t">): boolean {
  const max = footMaxSpeedMs(sport) ?? Infinity;
  if (i.activity === "automotive") return false;
  if (i.speedMs !== null && i.speedMs > max) return false;
  if (i.activity === "walking" || i.activity === "running") return true;
  if (i.cadenceSpm !== null && i.cadenceSpm >= VEHICLE_GUARD.minCadenceSpm) return true;
  // No step count and no chip: moving at a walking pace is foot evidence; standing still is not (a parked car).
  return i.cadenceSpm === null && (i.activity ?? "unknown") === "unknown" && i.speedMs !== null && i.speedMs >= 0.5;
}

export interface VehicleStretch {
  /** Wall-clock seconds. */
  from: number;
  to: number;
}

/** Serializable guard state (kept by the workout screen; the watch apps keep the same fields). */
export interface VehicleGuardState {
  mode: "foot" | "vehicle";
  /** Since when every reading looked like a vehicle (speed/stride evidence), or null. */
  suspectSince: number | null;
  /** Since when the chip says automotive, or null. */
  activitySince: number | null;
  /** In a vehicle: since when every reading shows you on foot again, or null. */
  footSince: number | null;
  /** In a vehicle: where this stretch began (back-dated to the first suspicious reading). */
  enteredAt: number | null;
  /** Closed vehicle stretches. */
  stretches: VehicleStretch[];
}

export type VehicleEvent = { kind: "entered"; from: number; why: Exclude<VehicleSuspicion, null> } | { kind: "left"; at: number } | null;

export const newVehicleGuard = (): VehicleGuardState => ({
  mode: "foot",
  suspectSince: null,
  activitySince: null,
  footSince: null,
  enteredAt: null,
  stretches: [],
});

/**
 * One reading through the guard: the next state and what changed. `entered.from` is where the vehicle stretch began
 * (pause the workout from there: drop the distance, time and samples recorded since). `left.at` is where you were on
 * foot again (the workout resumes from there). Pure.
 */
export function vehicleTick(sport: string, s: VehicleGuardState, i: VehicleTickInput): { state: VehicleGuardState; event: VehicleEvent } {
  if (footMaxSpeedMs(sport) === null) return { state: s, event: null };
  const why = vehicleSuspicion(sport, i);
  const activitySince = i.activity === "automotive" ? (s.activitySince ?? i.t) : null;
  const suspectSince = why === "speed" || why === "stride" ? (s.suspectSince ?? i.t) : why === "activity" ? s.suspectSince : null;
  if (s.mode === "foot") {
    const byActivity = activitySince !== null && i.t - activitySince >= VEHICLE_GUARD.activityConfirmS;
    const bySpeed = suspectSince !== null && i.t - suspectSince >= VEHICLE_GUARD.confirmS;
    if (byActivity || bySpeed) {
      // Back-dated to the earliest evidence of this stretch, whichever confirmed it.
      const from = Math.min(suspectSince ?? Infinity, activitySince ?? Infinity);
      const kind: Exclude<VehicleSuspicion, null> = byActivity ? "activity" : why === "stride" ? "stride" : "speed";
      return {
        state: { ...s, mode: "vehicle", suspectSince: null, activitySince: null, footSince: null, enteredAt: from },
        event: { kind: "entered", from, why: kind },
      };
    }
    return { state: { ...s, suspectSince, activitySince }, event: null };
  }
  // In a vehicle: resume once on foot for leaveS.
  const foot = footEvidence(sport, i);
  const footSince = foot ? (s.footSince ?? i.t) : null;
  if (footSince !== null && i.t - footSince >= VEHICLE_GUARD.leaveS) {
    const stretch = { from: s.enteredAt ?? footSince, to: footSince };
    return {
      state: {
        mode: "foot",
        suspectSince: null,
        activitySince: null,
        footSince: null,
        enteredAt: null,
        stretches: [...s.stretches, stretch],
      },
      event: { kind: "left", at: footSince },
    };
  }
  return { state: { ...s, footSince, suspectSince: null, activitySince }, event: null };
}

/** Resume tapped while in a vehicle: the stretch closes now; the guard watches again from scratch. Pure. */
export function vehicleResume(s: VehicleGuardState, t: number): VehicleGuardState {
  if (s.mode !== "vehicle") return s;
  return {
    mode: "foot",
    suspectSince: null,
    activitySince: null,
    footSince: null,
    enteredAt: null,
    stretches: [...s.stretches, { from: s.enteredAt ?? t, to: t }],
  };
}

/** Seconds spent in vehicle stretches (an open one counts up to `now`). Pure. */
export function vehicleSeconds(s: VehicleGuardState, now: number): number {
  const closed = s.stretches.reduce((a, x) => a + Math.max(0, x.to - x.from), 0);
  return closed + (s.mode === "vehicle" && s.enteredAt !== null ? Math.max(0, now - s.enteredAt) : 0);
}

export type VehicleVerdict = "ok" | "vehicle";

/**
 * The whole session: "mostly vehicle" (more vehicle than foot time, or under a minute on foot with any vehicle
 * stretch) → not counted, kept in the journal. Otherwise it counts, the vehicle stretches already left out. Pure.
 */
export function vehicleVerdict(i: { footS: number; vehicleS: number }): VehicleVerdict {
  if (!(i.vehicleS > 0)) return "ok";
  if (i.footS < VEHICLE_GUARD.minFootS) return "vehicle";
  return i.vehicleS >= i.footS ? "vehicle" : "ok";
}

/** A session sample as uploaded (game-core prize.ts ScoreSample): active seconds, cumulative metres and steps. */
export interface VehicleSample {
  t: number;
  m?: number;
  steps?: number;
}

/**
 * The server's own check, from the uploaded samples: stretches (≥ serverMinSegmentS) faster than the foot maximum
 * (× serverFactor) with no steps or impossible strides, or faster than hardMaxMs. A client that ran the live guard
 * already left those out; one that didn't (older builds, a tampered app) is caught here. Samples further apart than
 * 60 s are not judged (a pause). Pure.
 */
export function vehicleSegments(
  samples: readonly VehicleSample[],
  sport: string,
  heightCm: number = VEHICLE_GUARD.defaultHeightCm,
): { vehicleS: number; segments: { from: number; to: number }[] } {
  const max = footMaxSpeedMs(sport);
  if (max === null || samples.length < 2) return { vehicleS: 0, segments: [] };
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const hasSteps = sorted.some((x) => typeof x.steps === "number");
  const segments: { from: number; to: number }[] = [];
  let open: { from: number; to: number } | null = null;
  const close = () => {
    if (open && open.to - open.from >= VEHICLE_GUARD.serverMinSegmentS) segments.push(open);
    open = null;
  };
  for (let k = 1; k < sorted.length; k++) {
    const a = sorted[k - 1]!;
    const b = sorted[k]!;
    const dt = b.t - a.t;
    if (!(dt > 0) || dt > 60) {
      close();
      continue;
    }
    const v = Math.max(0, (b.m ?? 0) - (a.m ?? 0)) / dt;
    let bad = v > VEHICLE_GUARD.hardMaxMs;
    if (!bad && v > max * VEHICLE_GUARD.serverFactor) {
      if (!hasSteps) bad = v > Math.max(4, max * VEHICLE_GUARD.unknownCadenceFactor);
      else {
        const cadence = (Math.max(0, (b.steps ?? a.steps ?? 0) - (a.steps ?? 0)) / dt) * 60;
        bad = cadence < VEHICLE_GUARD.minCadenceSpm || v / (cadence / 60) > 1.3 * (heightCm / 100);
      }
    }
    if (bad) {
      if (open && open.to === a.t) open.to = b.t;
      else {
        close();
        open = { from: a.t, to: b.t };
      }
    } else close();
  }
  close();
  return { vehicleS: segments.reduce((s, x) => s + (x.to - x.from), 0), segments };
}

/**
 * The server's verdict for an upload (pure): `vehicle` when the client said so (flag 'vehicle'), when the average
 * speed is over the sport's cap (build 57 refused these whole), when the samples still hold a vehicle segment, or
 * when the client's own vehicle seconds make it mostly vehicle. `vehicle` = stored, shown, counted for nothing.
 */
export function serverVehicleCheck(i: {
  sport: string;
  activeS: number;
  distanceM?: number | null;
  samples?: readonly VehicleSample[];
  flags?: readonly string[];
  /** The client's live guard: seconds left out as vehicle (optional, build 58+). */
  vehicleS?: number;
  /** The sport's average speed cap, km/h (catalog speedCapKmh), when it has one. */
  capKmh?: number;
}): { vehicle: boolean; why: "client" | "average" | "samples" | "mostly" | null; segmentS: number } {
  if (footMaxSpeedMs(i.sport) === null) return { vehicle: false, why: null, segmentS: 0 };
  const seg = vehicleSegments(i.samples ?? [], i.sport);
  if (i.flags?.includes("vehicle")) return { vehicle: true, why: "client", segmentS: seg.vehicleS };
  const km = (i.distanceM ?? 0) / 1000;
  if (i.capKmh && km > 0 && km / (Math.max(i.activeS, 1) / 3600) > i.capKmh)
    return { vehicle: true, why: "average", segmentS: seg.vehicleS };
  if (seg.vehicleS > 0) return { vehicle: true, why: "samples", segmentS: seg.vehicleS };
  if ((i.vehicleS ?? 0) > 0 && vehicleVerdict({ footS: i.activeS, vehicleS: i.vehicleS! }) === "vehicle")
    return { vehicle: true, why: "mostly", segmentS: 0 };
  return { vehicle: false, why: null, segmentS: 0 };
}
