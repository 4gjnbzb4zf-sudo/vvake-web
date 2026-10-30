"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getNutritionDict } from "@/i18n/nutrition";
import { cleanNutritionProfile, defaultNutritionProfile, newerNutritionProfile, type NutritionProfile } from "@/lib/webapp/nutrition/core";
import { nutritionApi, NutritionUnavailable } from "@/lib/webapp/nutrition/nutritionApi";
import { canShowNumbers, numbersHidden } from "@/lib/webapp/nutrition/view";
import { nextTailorPrefs } from "@/lib/webapp/tailor/prefs";
import { useApp } from "./AppContext";

/**
 * Nutrition's shared state on the web: the account's nutrition profile (GET / PUT /v1/nutrition/profile, newest `at`
 * wins like prefs.tailor; /v1/me's prefs.nutrition shown first), whether numbers show, the API, and turning Nutrition
 * on or off (the profile's `on` and, with Your VVake on, its `nutrition` feature). `state`: loading, ready, unavailable
 * (an API without Nutrition yet), error.
 */
export function useNutrition() {
  const app = useApp();
  const { session, lang, featureOn, nutrition, setNutrition, tailor, profile: tailorProfile, saveTailor } = app;
  const api = useMemo(() => nutritionApi(session), [session]);
  const tn = getNutritionDict(lang);
  const [profile, setProfile] = useState<NutritionProfile | null>(nutrition);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">(nutrition ? "ready" : "loading");

  const load = useCallback(async () => {
    try {
      const raw = await api.profile();
      const got = raw ? cleanNutritionProfile(raw) : null;
      setProfile((cur) => newerNutritionProfile(cur, got) ?? defaultNutritionProfile());
      setState("ready");
    } catch (e) {
      setState((s) => (s === "ready" ? s : e instanceof NutritionUnavailable ? "unavailable" : "error"));
    }
  }, [api]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  /** Saves a change (stamped now, kept newer than the last); shown at once everywhere, the server's answer adopted. */
  const save = useCallback(
    async (change: Partial<NutritionProfile>) => {
      const prev = profile ?? defaultNutritionProfile();
      const next = cleanNutritionProfile({ ...prev, ...change, at: Math.max(Date.now(), prev.at + 1) });
      setProfile(next);
      setNutrition(next);
      try {
        const back = await api.saveProfile(next);
        if (back) {
          const b = cleanNutritionProfile(back);
          setProfile(b);
          setNutrition(b);
        }
        return true;
      } catch {
        return false;
      }
    },
    [api, profile, setNutrition],
  );

  /** Turn Nutrition on or off: the profile's switch, and Your VVake's feature when the tailored app is on. */
  const setOn = useCallback(
    async (on: boolean) => {
      const ok = await save({ on });
      if (tailorProfile && tailor) {
        const overrides = { ...(tailor.overrides ?? {}), nutrition: on };
        await saveTailor(nextTailorPrefs(tailor, { overrides })).catch(() => undefined);
      }
      return ok;
    },
    [save, tailor, tailorProfile, saveTailor],
  );

  const on = featureOn("nutrition");
  const hidden = profile ? numbersHidden(profile) : true;
  const canShow = profile ? canShowNumbers(profile) : false;
  return { api, tn, profile, state, load, save, setOn, on, hidden, canShow };
}
export type NutritionState = ReturnType<typeof useNutrition>;

/**
 * Nutrition's on / off from elsewhere (the Your VVake survey's yes, All features): the profile's `on` (read fresh,
 * newest wins), saved and shown at once. Your VVake's own feature switch is the caller's (it already saves it).
 */
export function useNutritionSwitch() {
  const { session, nutrition, setNutrition } = useApp();
  return useCallback(
    async (on: boolean) => {
      const api = nutritionApi(session);
      try {
        const raw = await api.profile();
        const cur = newerNutritionProfile(nutrition, raw ? cleanNutritionProfile(raw) : null) ?? defaultNutritionProfile();
        if (cur.on === on) return true;
        const next = cleanNutritionProfile({ ...cur, on, at: Math.max(Date.now(), cur.at + 1) });
        setNutrition(next);
        const back = await api.saveProfile(next);
        if (back) setNutrition(cleanNutritionProfile(back));
        return true;
      } catch {
        return false;
      }
    },
    [session, nutrition, setNutrition],
  );
}
