// Copied from VVFit packages/game-core/src/handover.ts (6881583e 2026-10-30) by scripts/sync-vehicle-core.ts. Do not edit: re-sync.
/**
 * Watch takeover (build 58, founder 2026-10-30, ADR-0064 §C): a workout runs on the phone and the watch turns on,
 * comes back in range, or VVake opens on it mid-session → the watch offers "Workout running on your iPhone: continue
 * on your watch?" (Continue / Not now). On Continue the watch records from that moment (heart rate, its own GPS and
 * motion); the phone stops recording and hands over. One workout: both parts carry the same `link` (the phone's
 * session id) and flag 'handover', and the server shows them as one session (ADR-0046's link merge), each stretch
 * scored under its own tier (the heart-rate part can count, the phone-only part stays tier C). If the watch drops
 * out again, the phone resumes recording (a new part, same link). Built on ADR-0057 workout.state.
 *
 * Pure. Mirrored in Swift (Apple Watch) and Kotlin (Wear OS) against test/fixtures/handover-golden.json.
 */

export const HANDOVER = {
  /** No offer in the last minute of a planned session. */
  lastPlannedS: 60,
  /** No offer in the first seconds of a workout (the start path itself may already put it on the watch). */
  minRunningS: 20,
  /** "Not now": no other offer for this workout until the watch reconnects after being out of range this long. */
  reofferAfterAwayS: 120,
  /** The phone keeps recording until the watch confirms it has started (or this many seconds pass → phone keeps it). */
  confirmTimeoutS: 15,
  /** Watch silent this long during its part (workout.state every 60 s, ADR-0057): the phone resumes recording. */
  watchLostS: 150,
} as const;

export type HandoverTrigger = "watch_on" | "in_range" | "app_opened" | "reconnected";

export interface HandoverOfferInput {
  /** The phone's workout.state: a workout running or paused on the phone (owner phone). */
  phoneWorkout: { state: "running" | "paused" | "ended"; elapsedS: number; plannedS?: number | null; vehiclePaused?: boolean } | null;
  /** The watch already records a workout (its own, or this one). */
  watchRecording: boolean;
  /** "Not now" was tapped for this workout, and when (ms); `awayS`: how long the watch was out of range since. */
  declinedAtMs?: number | null;
  awaySinceDeclineS?: number;
  trigger: HandoverTrigger;
}

/** Should the watch offer to take over now? (Start automatically never makes it silent: always one tap.) Pure. */
export function handoverOffer(i: HandoverOfferInput): {
  offer: boolean;
  why: "ok" | "no_phone_workout" | "watch_busy" | "vehicle" | "too_soon" | "ending" | "declined";
} {
  const w = i.phoneWorkout;
  if (!w || w.state === "ended") return { offer: false, why: "no_phone_workout" };
  if (i.watchRecording) return { offer: false, why: "watch_busy" };
  if (w.vehiclePaused) return { offer: false, why: "vehicle" };
  if (w.elapsedS < HANDOVER.minRunningS) return { offer: false, why: "too_soon" };
  if (w.plannedS && w.plannedS - w.elapsedS <= HANDOVER.lastPlannedS) return { offer: false, why: "ending" };
  if (i.declinedAtMs != null && !(i.trigger === "reconnected" && (i.awaySinceDeclineS ?? 0) >= HANDOVER.reofferAfterAwayS))
    return { offer: false, why: "declined" };
  return { offer: true, why: "ok" };
}

/** One recorded part of a handed-over workout (seconds since the workout's start, wall clock). */
export interface HandoverPart {
  device: "phone" | "watch";
  fromS: number;
  toS: number;
  activeS: number;
  distanceM?: number;
  steps?: number;
  hr: boolean;
}

/**
 * The parts as one workout for the summary (pure): totals, and the sources in order with their minutes. Parts that
 * overlap (a late confirm) keep the earlier part's time; the later one counts from where the earlier ended.
 */
export function handoverSummary(parts: readonly HandoverPart[]): {
  activeS: number;
  distanceM: number;
  steps: number;
  sources: { device: "phone" | "watch"; minutes: number; hr: boolean }[];
} {
  const sorted = [...parts].sort((a, b) => a.fromS - b.fromS);
  let activeS = 0;
  let distanceM = 0;
  let steps = 0;
  let end = -Infinity;
  const sources: { device: "phone" | "watch"; minutes: number; hr: boolean }[] = [];
  for (const p of sorted) {
    const span = Math.max(1, p.toS - p.fromS);
    const overlap = Math.max(0, Math.min(end, p.toS) - p.fromS);
    const share = Math.max(0, 1 - overlap / span);
    const a = Math.round(p.activeS * share);
    activeS += a;
    distanceM += Math.round((p.distanceM ?? 0) * share);
    steps += Math.round((p.steps ?? 0) * share);
    end = Math.max(end, p.toS);
    const last = sources.at(-1);
    if (last && last.device === p.device && last.hr === p.hr) last.minutes += Math.round(a / 60);
    else sources.push({ device: p.device, minutes: Math.round(a / 60), hr: p.hr });
  }
  return { activeS, distanceM, steps, sources };
}
