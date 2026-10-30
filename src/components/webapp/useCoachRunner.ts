"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/rewardsApi";
import { localTz, type Week } from "@/lib/webapp/api";
import { localDay } from "@/lib/webapp/format";
import { downloadText, livingApi } from "@/lib/webapp/livingApi";
import { isCatalogSport, LEGACY_SPORT_KEYS } from "@/lib/webapp/living/sportCatalog";
import { dayOf, logHabit, readDays, withDay, writeDays } from "@/lib/webapp/rhythm";
import { fetchPlaces } from "@/lib/webapp/places";
import { uuid } from "@/lib/webapp/workout";
import type { CoachActionFail, CoachAppAction } from "@/lib/webapp/coach/coachActions";
import { outingPlaces, placesSportOf, type OutingPlace } from "@/lib/webapp/coach/talkFlow";
import { talkApi } from "@/lib/webapp/coach/talkApi";
import {
  actionIcs,
  cameraRoutineOf,
  pauseUntil,
  webCardPlan,
  webHabitOf,
  workoutSport,
  type TodayPlan,
  type WebCardPlan,
} from "@/lib/webapp/coach/webActions";
import { useApp, type Route } from "./AppContext";
import { useWorkout } from "./WorkoutContext";
import { useNow } from "./useNow";

/**
 * Runs the coach's action cards on the web (ADR-0063 + ADR-0068's new kinds), shared by the Coach tab and the talk
 * sheet. Nothing runs before the athlete's yes (a tap, or a said / typed yes with the card on screen), except what
 * answers rather than changes (pause / resume a running workout, a summary, places). Every outcome is the truth the
 * coach then says: done, or why not.
 *
 * - start_workout / start_camera_workout: `go` names the screen (the caller saves its chat, then goes).
 * - add_to_calendar: an .ics file. pause_streak: POST /v1/me/pause with `from` and `shiftPlan` (time off).
 * - log_habit / log_meal: this browser's habits of the day (rhythm.ts; a meal is one of the three).
 * - correct_data: POST /v1/me/corrections (next to Health's value, never over it).
 * - control_workout: the browser's GPS workout (pause, resume, end). music: the web has no music control (not_here).
 * - show_places: the browser's location (after the card's own ask), GET /v1/places, 1-3 places. show_summary: its lines.
 */

export type RunOutcome = { ok: true; go?: Route; places?: OutingPlace[] } | { ok: false; reason: CoachActionFail; line?: string };

/** Today's planned session (GET /v1/plan/week), or a rest day; undefined while unknown. */
export function useTodayPlan(): TodayPlan | undefined {
  const { api, lang } = useApp();
  const now = useNow();
  const [week, setWeek] = useState<Week | null>(null);
  useEffect(() => {
    void api
      .week(localTz(), lang)
      .then(setWeek)
      .catch(() => setWeek(null));
  }, [api, lang]);
  const todayKey = localDay(now);
  return useMemo<TodayPlan | undefined>(() => {
    if (!week) return undefined;
    const d = week.days.find((x) => x.date === todayKey);
    if (!d) return week.days.length ? { rest: true } : undefined;
    const sport = LEGACY_SPORT_KEYS[d.sport] ?? d.sport;
    return isCatalogSport(sport) ? { sport, minutes: Math.max(0, Math.min(600, Math.round(d.minutes))) } : undefined;
  }, [week, todayKey]);
}

/** Has this site the location permission already (no ask needed)? Unknown = ask. */
export async function locationGranted(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return p?.state === "granted";
  } catch {
    return false;
  }
}

const here = (): Promise<{ lat: number; lon: number } | null> =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 120_000 },
    );
  });

/** When a card is tapped (read in the handler, not during render). */
const tapTime = () => Date.now();

export function useCoachRunner(today?: TodayPlan) {
  const { session, me, apiUrl, featureOn, online } = useApp();
  const wk = useWorkout();
  const la = useMemo(() => livingApi(session), [session]);
  const ta = useMemo(() => talkApi(session), [session]);
  const cameraOn = featureOn("camera");
  const inWorkout = !!wk.w;

  const plan = useCallback((a: CoachAppAction): WebCardPlan => webCardPlan(a, { inWorkout, cameraOn }), [inWorkout, cameraOn]);

  /** Places for the outing (show_places, the live coach's find_places), after the athlete allowed the location. */
  const findPlaces = useCallback(
    async (
      o: { sport?: string; minutes?: number; distanceKm?: number; maxTravelKm?: number },
      lang: "en" | "fr",
    ): Promise<{ ok: true; places: OutingPlace[] } | { ok: false; reason: "no_location" | "offline" | "busy" | "failed" }> => {
      if (!online) return { ok: false, reason: "offline" };
      const at = await here();
      if (!at) return { ok: false, reason: "no_location" };
      const radiusKm = Math.min(25, Math.max(3, Math.round(o.maxTravelKm ?? 10)));
      const r = await fetchPlaces(apiUrl, { sport: placesSportOf(o.sport), lat: at.lat, lon: at.lon, radiusKm });
      if (r.kind === "busy") return { ok: false, reason: "busy" };
      if (r.kind === "error") return { ok: false, reason: "failed" };
      return { ok: true, places: outingPlaces(r.answer.places, at, { ...o, maxTravelKm: o.maxTravelKm ?? radiusKm }, lang) };
    },
    [apiUrl, online],
  );

  const run = useCallback(
    async (a: CoachAppAction, o: { lang: "en" | "fr"; source?: "voice" | "chat" | "tap" }): Promise<RunOutcome> => {
      const p = webCardPlan(a, { inWorkout: !!wk.w, cameraOn });
      if (p.kind === "line") return { ok: false, reason: p.reason };
      switch (a.type) {
        case "start_workout": {
          const s = workoutSport(a, today);
          if ("fail" in s) return { ok: false, reason: s.fail };
          wk.start(s.sport);
          return { ok: true, go: { name: "workout" } };
        }
        case "start_camera_workout": {
          const routine = cameraRoutineOf(a);
          return { ok: true, go: { name: "camera", ...(routine ? { routine } : {}) } };
        }
        case "add_to_calendar": {
          const r = actionIcs(a, o.lang, tapTime(), uuid());
          if ("fail" in r) return { ok: false, reason: r.fail };
          downloadText(r.file, r.ics);
          return { ok: true };
        }
        case "pause_streak": {
          if (!online) return { ok: false, reason: "offline" };
          const from = a.from ?? localDay(tapTime());
          try {
            const r = await la.pause(a.pauseKind ?? "sick", localTz(), pauseUntil(from, a.days ?? 1), {
              ...(a.from ? { from: a.from } : {}),
              ...(a.shiftPlan ? { shiftPlan: true } : {}),
            });
            return r.ignored ? { ok: false, reason: "failed" } : { ok: true };
          } catch (e) {
            if (e instanceof ApiError && e.status === 409) return { ok: false, reason: "failed", line: "pause_conflict" };
            return { ok: false, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "failed" };
          }
        }
        case "log_habit":
        case "log_meal": {
          const k = a.type === "log_meal" ? "meal" : webHabitOf(a.habit);
          if (!k) return { ok: false, reason: "not_here" };
          const at = tapTime();
          const latest = readDays(me.id);
          const next = logHabit(dayOf(latest, at), k, at);
          if (!next) return { ok: false, reason: "no_such_habit" };
          writeDays(me.id, withDay(latest, next));
          return { ok: true };
        }
        case "correct_data": {
          if (!a.metric || a.value === undefined) return { ok: false, reason: "failed" };
          if (!online) return { ok: false, reason: "offline" };
          try {
            await ta.addCorrection({
              metric: a.metric,
              day: a.date ?? localDay(tapTime()),
              value: a.value,
              ...(a.shown !== undefined ? { shown: a.shown } : {}),
              source: o.source ?? "chat",
            });
            return { ok: true };
          } catch {
            return { ok: false, reason: "failed" };
          }
        }
        case "control_workout": {
          if (!wk.w) return { ok: false, reason: "no_workout" };
          if (a.op === "pause") wk.pause();
          else if (a.op === "resume") wk.resume();
          else if (a.op === "stop") wk.end();
          else return { ok: false, reason: "failed" };
          return { ok: true };
        }
        case "show_places": {
          const r = await findPlaces(a, o.lang);
          if (!r.ok)
            return { ok: false, reason: r.reason === "no_location" ? "no_location" : r.reason === "offline" ? "offline" : "failed" };
          return { ok: true, places: r.places };
        }
        case "show_summary":
          return { ok: true };
        default:
          return { ok: false, reason: "not_here" };
      }
    },
    [wk, cameraOn, today, online, la, ta, me.id, findPlaces],
  );

  return { plan, run, findPlaces };
}
