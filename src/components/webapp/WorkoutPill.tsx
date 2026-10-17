"use client";

import { clock } from "@/lib/webapp/format";
import { elapsedS, isPaused, sportLabel } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { useWorkout } from "./WorkoutContext";

/** "Back to your workout" on every other screen (apps/mobile components/LiveWorkoutPill.tsx), above the tab bar. */
export function WorkoutPill() {
  const { t, lang, go } = useApp();
  const wk = useWorkout();
  if (!wk.w && !wk.summary) return null;
  const label = wk.w
    ? `${sportLabel(wk.w.sport, lang)} · ${clock(elapsedS(wk.w, wk.now))}${isPaused(wk.w) ? ` · ${t.workout.paused}` : ""}`
    : t.workout.summary;
  return (
    <button
      type="button"
      onClick={() => go({ name: "workout" })}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex h-12 max-w-[34rem] items-center justify-between rounded-full bg-pulse px-5 font-display text-sm font-semibold text-ink shadow-lg"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-ink" />
        {label}
      </span>
      <span aria-hidden>›</span>
    </button>
  );
}
